"""Sửa lại documents.total_pages bị ghi sai (bug cũ: mọi PDF đều ghi 1 trang).

Nguyên nhân: _extract_pdf_text nối các trang bằng "\\n\\n" trong khi lightweight_convert
đếm trang bằng số ký tự "\\f" → luôn ra 1. Code đã sửa; script này BACKFILL dữ liệu cũ:
tải file PDF gốc (ưu tiên local, fallback R2) → đếm số trang thật bằng pypdf → cập nhật DB.

Usage (trỏ .env vào DB prod nếu sửa production):
    python scripts/fix_page_counts.py            # sửa các PDF có total_pages <= 1
    python scripts/fix_page_counts.py --dry-run  # chỉ in ra, không ghi
"""

import argparse
import asyncio
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from src.db.session import AsyncSessionLocal
from src.repositories import document_repo
from src.services import object_storage


def _count_pdf_pages(path: Path) -> int:
    from pypdf import PdfReader

    return len(PdfReader(str(path)).pages)


async def _real_pages(document) -> int | None:
    """Đếm số trang thật: file local nếu còn, không thì tải từ R2 (xoá sau khi đếm)."""
    local = Path(document.storage_path or "")
    if local.exists():
        try:
            return _count_pdf_pages(local)
        except Exception:  # noqa: BLE001
            return None
    r2_key = (document.metadata_json or {}).get("r2_key")
    if not r2_key or not object_storage.is_enabled():
        return None
    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
        tmp_path = Path(tmp.name)
    try:
        if not await object_storage.download_file(r2_key, tmp_path):
            return None
        return _count_pdf_pages(tmp_path)
    except Exception:  # noqa: BLE001
        return None
    finally:
        tmp_path.unlink(missing_ok=True)


async def run(args) -> int:
    fixed = skipped = failed = 0
    async with AsyncSessionLocal() as session:
        documents = await document_repo.list_documents(session)
        targets = [
            d for d in documents
            if (d.file_type or "").lower() == "pdf" and (d.total_pages or 0) <= 1
        ]
        print(f"PDF nghi sai số trang (total_pages <= 1): {len(targets)}")
        for d in targets:
            pages = await _real_pages(d)
            if pages is None:
                print(f"  ⚠️  '{d.title[:50]}': không đọc được file gốc — bỏ qua")
                failed += 1
                continue
            if pages == d.total_pages:
                skipped += 1
                continue
            print(f"  {'DRY-RUN ' if args.dry_run else '✅ '}'{d.title[:50]}': {d.total_pages} → {pages} trang")
            if not args.dry_run:
                d.total_pages = pages
                await session.flush()
            fixed += 1
        if not args.dry_run:
            await session.commit()
    print(f"\n=== Xong: sửa {fixed}, đúng sẵn {skipped}, không đọc được {failed} ===")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--dry-run", action="store_true")
    return asyncio.run(run(parser.parse_args()))


if __name__ == "__main__":
    raise SystemExit(main())
