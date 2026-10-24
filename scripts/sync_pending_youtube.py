"""Đồng bộ video YouTube "đang chờ" → lấy transcript ở MÁY CÁ NHÂN rồi nạp vào prod.

Khi người dùng thêm link YouTube trên web (chạy Render), server KHÔNG lấy được
transcript vì YouTube chặn IP datacenter → tài liệu được lưu trạng thái
`pending_transcript`. Script này chạy ở máy bạn (IP dân dụng, không bị chặn): quét các
tài liệu đang chờ trong DB prod → lấy transcript → nạp DB + Qdrant → đánh dấu "sẵn sàng".

Yêu cầu: .env trỏ DATABASE_URL/QDRANT_URL/OPENAI_API_KEY vào PRODUCTION.

Usage:
    # Xử lý 1 lần rồi thoát
    python scripts/sync_pending_youtube.py

    # CHẠY NỀN TỰ ĐỘNG: cứ vài giây quét 1 lần — thêm link trên web là tự xử lý
    python scripts/sync_pending_youtube.py --watch            # mỗi 30s
    python scripts/sync_pending_youtube.py --watch --interval 15
"""

import argparse
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from src.db.session import AsyncSessionLocal
from src.repositories import document_repo
from src.services import youtube

PENDING = "pending_transcript"


def _is_youtube_doc(doc) -> bool:
    meta = doc.metadata_json or {}
    return meta.get("kind") == "youtube" or doc.file_type == "youtube"


async def _process_one(session, doc) -> str:
    """Trả về: 'ready' | 'failed' | 'skip' | 'retry'."""
    meta = doc.metadata_json or {}
    url = meta.get("url") or meta.get("video_url")
    if not url:
        return "skip"
    try:
        result = await youtube.ingest_youtube_transcript(
            session,
            doc,
            url,
            scope=meta.get("scope", "school"),
            owner_id=meta.get("owner_id"),
            category=meta.get("category", "syllabus"),
        )
        print(f"  ✅ '{doc.title}' — {result['chunks']} đoạn (id={doc.id})")
        return "ready"
    except youtube.YoutubeTranscriptError as exc:
        # Ngay cả IP dân dụng cũng không có → video thật sự không có phụ đề/riêng tư.
        await document_repo.mark_document_failed(
            session, doc, str(exc), status="failed_no_transcript"
        )
        await session.commit()
        print(f"  ❌ '{doc.title}': {str(exc)[:120]} → đánh dấu failed")
        return "failed"
    except Exception as exc:  # noqa: BLE001 — lỗi tạm thời (mạng/embed) → để chờ lần sau
        print(f"  ⚠️  '{doc.title}': lỗi tạm thời, thử lại sau ({str(exc)[:100]})")
        return "retry"


async def process_pending_once() -> int:
    """Xử lý hết các tài liệu đang chờ. Trả về số đã nạp thành công."""
    async with AsyncSessionLocal() as session:
        pending = await document_repo.list_documents_by_status(session, PENDING)
        pending = [d for d in pending if _is_youtube_doc(d)]
        if not pending:
            return 0
        print(f"→ Có {len(pending)} video đang chờ, đang xử lý...")
        ok = 0
        for doc in pending:
            if await _process_one(session, doc) == "ready":
                ok += 1
        return ok


async def watch(interval: int) -> None:
    print(f"👀 Chế độ tự động: quét mỗi {interval}s. Nhấn Ctrl+C để dừng.")
    while True:
        try:
            done = await process_pending_once()
            if done:
                print(f"   (đã xử lý {done} video lúc này)")
        except Exception as exc:  # noqa: BLE001 — không để vòng lặp chết (vd mất mạng)
            print(f"   ⚠️ lỗi vòng quét (bỏ qua, thử lại): {str(exc)[:120]}")
        await asyncio.sleep(interval)


async def run(args: argparse.Namespace) -> int:
    if args.watch:
        await watch(args.interval)
        return 0
    done = await process_pending_once()
    print(f"=== Xong: nạp {done} video. ===" if done else "Không có video nào đang chờ.")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--watch", action="store_true", help="Chạy nền, tự quét liên tục")
    parser.add_argument("--interval", type=int, default=30, help="Giây giữa mỗi lần quét (watch)")
    args = parser.parse_args()
    try:
        return asyncio.run(run(args))
    except KeyboardInterrupt:
        print("\nĐã dừng.")
        return 0


if __name__ == "__main__":
    raise SystemExit(main())
