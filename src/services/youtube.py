"""Lấy phụ đề (transcript) video YouTube và nạp vào RAG — KÈM mốc thời gian.

Mỗi đoạn (chunk) giữ `start_seconds` + `timestamp` để khi chatbot trích dẫn nguồn từ
video, hiển thị được thời điểm và link nhảy thẳng tới đúng phút (youtube.com/...&t=Ns).
"""

import asyncio
import re
from uuid import NAMESPACE_URL, uuid5

from sqlalchemy.ext.asyncio import AsyncSession

from src.repositories import document_repo
from src.services.embeddings import embed_documents
from src.services.vector_store import upsert_chunks

_YT_ID_RE = re.compile(
    r"(?:youtube\.com/(?:watch\?(?:.*&)?v=|embed/|shorts/|live/)|youtu\.be/)([A-Za-z0-9_-]{11})"
)


class YoutubeTranscriptError(Exception):
    """Không lấy được transcript của video (tắt phụ đề / video riêng tư / bị chặn...)."""


def extract_video_id(url: str) -> str | None:
    if not url:
        return None
    m = _YT_ID_RE.search(url)
    if m:
        return m.group(1)
    # dạng ?v=ID rời
    m = re.search(r"[?&]v=([A-Za-z0-9_-]{11})", url)
    return m.group(1) if m else None


def is_youtube_url(url: str) -> bool:
    return extract_video_id(url) is not None


def format_timestamp(seconds: float) -> str:
    s = int(seconds)
    h, m, sec = s // 3600, (s % 3600) // 60, s % 60
    return f"{h}:{m:02d}:{sec:02d}" if h else f"{m:02d}:{sec:02d}"


def _proxies() -> dict | None:
    """Proxy dạng requests {http, https} nếu cấu hình YOUTUBE_PROXY_URL — để vượt
    việc YouTube chặn IP trung tâm dữ liệu (Render...)."""
    from src.config import get_settings

    url = (get_settings().youtube_proxy_url or "").strip()
    return {"http": url, "https": url} if url else None


_BLOCK_TOKENS = (
    "ipblock",
    "requestblocked",
    "toomanyrequests",
    "blocking requests",
    "from your ip",
    # IP datacenter bị chặn ở bản 0.6.x: YouTube trả body RỖNG → XML ParseError.
    "no element found",
    "parseerror",
)


def _is_ip_block(exc: Exception) -> bool:
    name = type(exc).__name__.lower()
    text = str(exc).lower()
    return any(k in name or k in text for k in _BLOCK_TOKENS)


_IP_BLOCK_MSG = (
    "YouTube đang chặn IP máy chủ (thường gặp khi chạy trên Render/cloud — máy chủ "
    "trả phụ đề rỗng). Hãy đặt biến môi trường YOUTUBE_PROXY_URL (proxy dân dụng) "
    "hoặc nạp transcript từ máy cá nhân bằng scripts/ingest_youtube.py."
)


_PREFERRED_LANGS = ("vi", "en", "en-US", "en-GB", "en-orig")


def _pick_caption_track(subtitles: dict, auto: dict) -> tuple[str, list] | None:
    """Chọn track phụ đề tốt nhất: phụ đề thủ công VI/EN > tự sinh VI/EN > bất kỳ."""
    for pool in (subtitles, auto):
        for lang in _PREFERRED_LANGS:
            if pool.get(lang):
                return lang, pool[lang]
        # Khớp tiền tố (vd 'en-US', 'vi-VN') nếu không trùng chính xác.
        for lang, fmts in pool.items():
            if any(lang.startswith(p) for p in ("vi", "en")) and fmts:
                return lang, fmts
    for pool in (subtitles, auto):
        for lang, fmts in pool.items():
            if fmts:
                return lang, fmts
    return None


def _parse_json3(raw: bytes) -> list[dict]:
    """Phụ đề định dạng json3 của YouTube → [{text, start, duration}]."""
    import json

    data = json.loads(raw)
    out: list[dict] = []
    for ev in data.get("events", []):
        segs = ev.get("segs")
        if not segs:
            continue
        text = "".join(s.get("utf8", "") for s in segs).strip()
        if not text:
            continue
        out.append(
            {
                "text": text,
                "start": (ev.get("tStartMs", 0) or 0) / 1000.0,
                "duration": (ev.get("dDurationMs", 0) or 0) / 1000.0,
            }
        )
    return out


def _parse_vtt(raw_text: str) -> list[dict]:
    """Phân tích cú pháp phụ đề dạng WebVTT -> [{text, start, duration}]."""
    out: list[dict] = []
    # Match các mốc thời gian dạng "00:01:02.345 --> 00:01:05.678" hoặc "01:02.345 --> 01:05.678"
    time_pattern = re.compile(r"(\d{2}:)?(\d{2}):(\d{2})[.,](\d{3})")

    lines = raw_text.splitlines()
    i = 0
    while i < len(lines):
        line = lines[i].strip()
        if "-->" in line:
            parts = line.split("-->")
            start_str = parts[0].strip()

            # Parse thời gian bắt đầu
            match = time_pattern.match(start_str)
            start_seconds = 0.0
            if match:
                hrs = int(match.group(1).rstrip(":")) if match.group(1) else 0
                mins = int(match.group(2))
                secs = int(match.group(3))
                ms = int(match.group(4))
                start_seconds = hrs * 3600 + mins * 60 + secs + ms / 1000.0

            # Tính thời gian kết thúc (để tính duration)
            end_seconds = start_seconds
            if len(parts) > 1:
                end_str = parts[1].split()[0].strip() # Bỏ phần align/position nếu có
                match_end = time_pattern.match(end_str)
                if match_end:
                    hrs_e = int(match_end.group(1).rstrip(":")) if match_end.group(1) else 0
                    mins_e = int(match_end.group(2))
                    secs_e = int(match_end.group(3))
                    ms_e = int(match_end.group(4))
                    end_seconds = hrs_e * 3600 + mins_e * 60 + secs_e + ms_e / 1000.0

            duration = max(0.0, end_seconds - start_seconds)

            # Gom các dòng chữ phía sau cho đến khi gặp dòng trống hoặc mốc thời gian mới
            text_parts = []
            i += 1
            while i < len(lines) and lines[i].strip() and "-->" not in lines[i]:
                text_parts.append(lines[i].strip())
                i += 1

            text = " ".join(text_parts).strip()
            # Xóa các tag html/vtt dạng <c>...</c>
            text = re.sub(r"<[^>]+>", "", text)
            if text:
                out.append({
                    "text": text,
                    "start": start_seconds,
                    "duration": duration
                })
            # Không tăng i vì vòng lặp trong đã kiểm tra "-->" hoặc dòng trống rồi
            continue
        i += 1
    return out


def _fetch_via_ytdlp(video_id: str) -> tuple[list[dict], dict]:
    """Lấy phụ đề + thông tin video bằng yt-dlp (player API → bền với chặn IP datacenter).

    Trả (segments, info) với info={'title','description'}. segments=[] nếu video không
    có phụ đề (vẫn trả info). Raise nếu lỗi mạng/chặn (để fallback xử lý).
    """
    import urllib.request

    import yt_dlp

    url = f"https://www.youtube.com/watch?v={video_id}"
    proxy = (get_settings_proxy_url())
    opts = {
        "skip_download": True,
        "writesubtitles": True,
        "writeautomaticsub": True,
        "subtitleslangs": ["all"],
        "quiet": True,
        "no_warnings": True,
        "noprogress": True,
    }
    if proxy:
        opts["proxy"] = proxy
    with yt_dlp.YoutubeDL(opts) as ydl:
        info = ydl.extract_info(url, download=False)
    meta = {
        "title": (info.get("title") or "").strip(),
        "description": (info.get("description") or "").strip(),
    }
    track = _pick_caption_track(info.get("subtitles") or {}, info.get("automatic_captions") or {})
    if not track:
        return [], meta
    _lang, fmts = track
    # Ưu tiên json3 (dễ parse + có mốc thời gian); nếu không có thì lấy vtt, rồi lấy format đầu.
    fmt = next((f for f in fmts if f.get("ext") == "json3"), None)
    is_vtt = False
    if not fmt:
        fmt = next((f for f in fmts if f.get("ext") == "vtt"), None)
        is_vtt = True
    if not fmt:
        fmt = fmts[0]
        is_vtt = fmt.get("ext") == "vtt" or "vtt" in fmt["url"]

    req = urllib.request.Request(fmt["url"], headers={"User-Agent": "Mozilla/5.0"})
    handler = urllib.request.ProxyHandler({"http": proxy, "https": proxy}) if proxy else None
    opener = urllib.request.build_opener(handler) if handler else urllib.request.build_opener()
    with opener.open(req, timeout=30) as resp:
        raw = resp.read()
    try:
        if is_vtt:
            text_content = raw.decode("utf-8", errors="ignore")
            return _parse_vtt(text_content), meta
        return _parse_json3(raw), meta
    except Exception:
        # Fallback thử cả hai phương thức giải mã
        try:
            text_content = raw.decode("utf-8", errors="ignore")
            return _parse_vtt(text_content), meta
        except Exception:
            try:
                return _parse_json3(raw), meta
            except Exception:
                return [], meta


def get_settings_proxy_url() -> str:
    from src.config import get_settings

    return (get_settings().youtube_proxy_url or "").strip()


def _fetch_segments(video_id: str) -> tuple[list[dict], dict]:
    """Lấy transcript (đồng bộ): yt-dlp trước (bền với chặn IP), fallback youtube-transcript-api.

    Trả (segments, meta) với meta={'title','description'} (rỗng nếu dùng fallback).
    Mỗi segment: {text, start, duration}. Raise YoutubeTranscriptError nếu không lấy được.
    """
    # 1) yt-dlp — đường chính, chạy được cả trên IP datacenter (Render).
    try:
        segments, meta = _fetch_via_ytdlp(video_id)
        if segments:
            return segments, meta
    except Exception:  # noqa: BLE001 — yt-dlp lỗi thì thử fallback bên dưới
        pass

    # 2) Fallback: youtube-transcript-api (+ proxy nếu cấu hình). Không có title/desc.
    from youtube_transcript_api import YouTubeTranscriptApi

    proxies = _proxies()
    try:
        listing = YouTubeTranscriptApi.list_transcripts(video_id, proxies=proxies)

        # 1. Tìm trong transcript thủ công/tự sinh khớp danh sách ngôn ngữ ưu tiên
        transcript = None
        for lang in _PREFERRED_LANGS:
            try:
                transcript = listing.find_transcript([lang])
                break
            except Exception:
                continue

        if not transcript:
            try:
                transcript = listing.find_generated_transcript(_PREFERRED_LANGS)
            except Exception:
                pass

        # 2. Nếu không tìm thấy, lấy transcript đầu tiên trong danh sách (bất kể ngôn ngữ nào)
        if not transcript:
            for t in listing:
                transcript = t
                break

        if transcript:
            return transcript.fetch(), {}

    except Exception as primary:
        if _is_ip_block(primary):
            raise YoutubeTranscriptError(_IP_BLOCK_MSG) from primary
        raise YoutubeTranscriptError("Video không có phụ đề khả dụng hoặc bị lỗi: " + str(primary))

    raise YoutubeTranscriptError("Video không có phụ đề khả dụng.")


def _clean_description(desc: str, *, max_chars: int = 400) -> str:
    """Lấy đoạn mô tả gọn, đẹp từ description video: bỏ link, gộp xuống dòng, cắt câu."""
    if not desc:
        return ""
    text = re.sub(r"https?://\S+", "", desc)  # bỏ link (patreon, social...)
    text = re.sub(r"\s+", " ", text).strip(" -•|·\t")
    if len(text) <= max_chars:
        return text
    cut = text[:max_chars]
    # Cắt ở dấu kết câu gần cuối cho gọn; nếu không có thì cắt theo từ.
    end = max(cut.rfind("."), cut.rfind("!"), cut.rfind("?"))
    return (cut[: end + 1] if end >= 80 else cut.rsplit(" ", 1)[0].rstrip() + "…")


def build_transcript_chunks(segments: list[dict], *, max_chars: int = 800) -> list[dict]:
    """Gộp các câu phụ đề thành đoạn ~max_chars; mỗi đoạn giữ mốc bắt đầu (giây)."""
    chunks: list[dict] = []
    buf: list[str] = []
    buf_len = 0
    start: float | None = None
    for seg in segments:
        text = (seg.get("text") or "").replace("\n", " ").strip()
        if not text:
            continue
        if start is None:
            start = float(seg.get("start") or 0)
        buf.append(text)
        buf_len += len(text) + 1
        if buf_len >= max_chars:
            chunks.append({"content": " ".join(buf), "start_seconds": start})
            buf, buf_len, start = [], 0, None
    if buf:
        chunks.append({"content": " ".join(buf), "start_seconds": start or 0.0})
    return chunks


async def ingest_youtube_transcript(
    session: AsyncSession,
    document,
    url: str,
    *,
    scope: str,
    owner_id: str | None,
    category: str,
) -> dict:
    """Lấy transcript → tạo chunks (kèm timestamp) → embed → upsert Qdrant + lưu DB."""
    video_id = extract_video_id(url)
    if not video_id:
        raise YoutubeTranscriptError("Không nhận diện được ID video YouTube từ link.")

    segments, video_meta = await asyncio.to_thread(_fetch_segments, video_id)
    if not segments:
        raise YoutubeTranscriptError("Video không có phụ đề (transcript).")

    raw_chunks = build_transcript_chunks(segments)
    if not raw_chunks:
        raise YoutubeTranscriptError("Không tạo được đoạn nội dung từ transcript.")

    # Gắn TIÊU ĐỀ + MÔ TẢ thật của video (yt-dlp) vào tài liệu — đặt trước khi upsert
    # để tiêu đề trên Qdrant/nguồn trích dẫn cũng đúng.
    md = dict(document.metadata_json or {})
    if video_meta.get("title"):
        document.title = video_meta["title"][:300]
    if video_meta.get("description"):
        md["description"] = _clean_description(video_meta["description"])
    md["video_id"] = video_id
    await document_repo.update_document_metadata(session, document, md)

    chunk_dicts = []
    for index, ch in enumerate(raw_chunks):
        start = float(ch["start_seconds"])
        timestamp = format_timestamp(start)
        chunk_dicts.append(
            {
                "chunk_index": index,
                "content": ch["content"],
                "page_number": None,
                "token_count": len(ch["content"].split()),
                "qdrant_point_id": str(uuid5(NAMESPACE_URL, f"{document.id}:{index}")),
                "metadata": {
                    "kind": "youtube",
                    "video_id": video_id,
                    "video_url": url,
                    "start_seconds": int(start),
                    "timestamp": timestamp,
                    "section_title": f"Phút {timestamp}",
                },
            }
        )

    db_chunks = await document_repo.replace_document_chunks(
        session, document_id=document.id, chunks=chunk_dicts
    )
    await session.commit()

    vectors = await embed_documents([c.content for c in db_chunks])
    points = await upsert_chunks(
        vectors=vectors,
        chunks=[
            {
                "qdrant_point_id": c.qdrant_point_id,
                "chunk_id": c.id,
                "document_id": document.id,
                "title": document.title,
                "page_number": c.page_number,
                "file_type": "youtube",
                "scope": scope,
                "owner_id": owner_id or "",
                "category": category,
                "metadata": c.metadata_json,
            }
            for c in db_chunks
        ],
    )
    await document_repo.mark_document_ready(
        session, document, total_pages=0, total_chunks=len(db_chunks)
    )
    await session.commit()
    return {"chunks": len(db_chunks), "points": points, "video_id": video_id}
