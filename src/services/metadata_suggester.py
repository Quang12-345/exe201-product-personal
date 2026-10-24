"""Gợi ý tiêu đề + mô tả tự động cho tài liệu/liên kết bằng LLM.

Dùng cho form tải lên (giảng viên & quản trị): khi chọn tệp hoặc dán link, FE gọi
endpoint này để điền sẵn tiêu đề/mô tả; người dùng vẫn chỉnh sửa được.
Mọi lỗi đều "soft-fail" → trả gợi ý rỗng để không chặn luồng tải lên.
"""

from __future__ import annotations

import asyncio
import json
import re
from pathlib import Path
from urllib.parse import quote

import httpx

from src.services.llm import get_llm

# Số ký tự nội dung tối đa đưa vào LLM (đủ để tóm tắt, tránh tốn token).
_MAX_CHARS = 6000

_PROMPT = (
    "Bạn là trợ lý quản lý kho tài liệu học thuật. Dựa trên nội dung dưới đây, hãy đặt:\n"
    "- TIÊU ĐỀ: ngắn gọn, rõ chủ đề, dạng tiêu đề tài liệu (KHÔNG chấm câu cuối, tối "
    "đa 100 ký tự).\n"
    "- MÔ TẢ: 1-2 câu hoàn chỉnh, nêu nội dung/chủ đề chính và đối tượng dùng, văn "
    "phong trang trọng, dễ đọc (tối đa 300 ký tự). KHÔNG copy nguyên văn, KHÔNG bịa số "
    "liệu, KHÔNG ghi 'tài liệu này nói về'.\n"
    "Cả hai bằng TIẾNG VIỆT có dấu.\n"
    "CHỈ trả về JSON hợp lệ đúng định dạng: "
    '{{"title": "...", "description": "..."}} — không thêm chữ nào khác.\n\n'
    "NGUỒN: {source}\n\nNỘI DUNG:\n{content}"
)


async def _fetch_link_text(url: str) -> tuple[str, str]:
    """Lấy <title> + meta description + một ít nội dung trang (best-effort)."""
    try:
        async with httpx.AsyncClient(follow_redirects=True, timeout=10) as client:
            resp = await client.get(url, headers={"User-Agent": "Mozilla/5.0"})
            resp.raise_for_status()
            html = resp.text
    except Exception:
        return "", ""

    try:
        from bs4 import BeautifulSoup

        soup = BeautifulSoup(html, "html.parser")
        page_title = (soup.title.string if soup.title else "") or ""
        meta = soup.find("meta", attrs={"name": "description"}) or soup.find(
            "meta", attrs={"property": "og:description"}
        )
        meta_desc = (meta.get("content") if meta else "") or ""
        for tag in soup(["script", "style", "nav", "footer", "header"]):
            tag.decompose()
        body = re.sub(r"\s+", " ", soup.get_text(" ")).strip()
        return page_title.strip(), (meta_desc.strip() + " " + body).strip()
    except Exception:
        return "", ""


async def fetch_link_text(url: str) -> tuple[str, str]:
    """Public wrapper for previewing link documents without embedding the page."""
    return await _fetch_link_text(url)


def _parse_llm_json(raw: str) -> dict:
    """Tách JSON {title, description} từ output LLM (bỏ ```json nếu có)."""
    text = raw.strip()
    text = re.sub(r"^```(?:json)?", "", text).strip()
    text = re.sub(r"```$", "", text).strip()
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if not match:
        return {}
    try:
        data = json.loads(match.group(0))
    except Exception:
        return {}
    return {
        "title": str(data.get("title") or "").strip()[:200],
        "description": str(data.get("description") or "").strip()[:500],
    }


async def _ask_llm(source: str, content: str, fallback_title: str = "") -> dict:
    content = (content or "").strip()[:_MAX_CHARS]
    if not content:
        return {"title": fallback_title, "description": ""}
    try:
        from langchain_core.messages import HumanMessage

        prompt = _PROMPT.format(source=source, content=content)
        response = await get_llm().ainvoke([HumanMessage(content=prompt)])
        result = _parse_llm_json(str(response.content))
    except Exception:
        result = {}
    if not result.get("title"):
        result["title"] = fallback_title
    return {"title": result.get("title", ""), "description": result.get("description", "")}


async def suggest_metadata_for_file(path: Path, original_name: str) -> dict:
    """AI tự đặt tiêu đề + mô tả cho tệp (PDF/DOCX/PPTX/TXT/MD).

    Trích nhanh một phần văn bản (giới hạn trang/ký tự) rồi nhờ LLM đặt tiêu đề +
    mô tả gọn, đẹp. Soft-fail: không đọc/được nội dung → dùng tên tệp đã chuẩn hoá.
    Người dùng vẫn chỉnh sửa lại tuỳ ý trong form.
    """
    from src.services.data_pipeline import extract_text_quick

    fallback = _humanize_filename(original_name)
    content = await asyncio.to_thread(extract_text_quick, path)
    if not content.strip():
        return {"title": fallback, "description": _short_description(fallback)}
    return await _ask_llm(f"Tệp: {original_name}", content, fallback_title=fallback)


def _short_description(title: str) -> str:
    """Mô tả ngắn gọn suy ra từ tiêu đề (không gọi LLM, tức thì)."""
    clean = (title or "").strip()
    if not clean:
        return ""
    return f"Tài liệu về {clean}."[:300]


async def _youtube_oembed(url: str) -> dict:
    """Lấy tiêu đề (+ kênh) video YouTube qua oEmbed — endpoint công khai, KHÔNG bị
    chặn IP như API phụ đề. Không có mô tả → mô tả đầy đủ sẽ được điền khi xử lý
    transcript (yt-dlp) lúc nạp."""
    api = f"https://www.youtube.com/oembed?url={quote(url, safe='')}&format=json"
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(api, headers={"User-Agent": "Mozilla/5.0"})
            resp.raise_for_status()
            data = resp.json()
    except Exception:
        return {}
    title = str(data.get("title") or "").strip()
    author = str(data.get("author_name") or "").strip()
    if not title:
        return {}
    desc = f"Video YouTube{(' từ kênh ' + author) if author else ''}."
    return {"title": title[:200], "description": desc[:300]}


def _title_from_url(url: str) -> str:
    """Suy tiêu đề tạm từ URL (KHÔNG trả nguyên URL): lấy slug cuối, chuẩn hoá."""
    from urllib.parse import urlsplit

    parts = [p for p in urlsplit(url).path.split("/") if p]
    slug = parts[-1] if parts else (urlsplit(url).netloc or url)
    slug = re.sub(r"\.(html?|php|aspx?)$", "", slug)
    slug = re.sub(r"[-_]+", " ", slug).strip()
    return slug.title()[:200] or (urlsplit(url).netloc or "Liên kết")[:200]


async def suggest_metadata_for_link(url: str) -> dict:
    # Link YouTube: lấy tiêu đề thật của video (mô tả đầy đủ điền khi nạp transcript).
    from src.services import youtube

    if youtube.is_youtube_url(url):
        info = await _youtube_oembed(url)
        if info.get("title"):
            return info

    # Trang web: TIÊU ĐỀ = h1 (yêu cầu), MÔ TẢ = AI. Không bao giờ trả nguyên URL làm tên.
    from src.services import web_page

    page = await web_page.fetch_web_page(url)
    title = (page.get("title") or "").strip() or _title_from_url(url)
    body = (page.get("text") or "").strip()
    if not body:
        return {"title": title[:200], "description": (page.get("description") or "")[:300]}
    meta = await _ask_llm(f"Trang web (tiêu đề: {title})", body, fallback_title=title)
    description = meta.get("description") or page.get("description") or ""
    # Giữ tiêu đề = h1 (không để LLM đổi thành thứ khác).
    return {"title": title[:200], "description": description[:300]}


def _humanize_filename(name: str) -> str:
    stem = Path(name).stem
    return stem.replace("-", " ").replace("_", " ").strip().title()[:200] or "Tài liệu"
