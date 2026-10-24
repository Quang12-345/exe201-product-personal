"""Thêm INDEX cho các cột KHÓA NGOẠI chưa có index — cải thiện ổn định/hiệu năng.

Vì sao cần: cột FK không có index sẽ khiến (1) JOIN theo FK chậm, (2) khi xóa bản ghi
CHA (ON DELETE CASCADE), Postgres phải quét toàn bộ bảng con → chậm + giữ khoá lâu.
Đánh index các cột này là việc chuẩn để DB ổn định khi dữ liệu lớn dần.

An toàn: dùng CREATE INDEX IF NOT EXISTS (idempotent, chạy lại được). Bảng nhỏ nên
nhanh; nếu dữ liệu rất lớn có thể đổi sang CREATE INDEX CONCURRENTLY (chạy ngoài txn).

Usage:
    python scripts/add_fk_indexes.py          # tạo index còn thiếu
    python scripts/add_fk_indexes.py --dry-run # chỉ in ra, không chạy
"""

import argparse
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import text

from src.db.session import AsyncSessionLocal

# (bảng, cột) FK nên có index. Cột đã index sẵn (document_views, password_reset_otps)
# bỏ qua vì CREATE INDEX IF NOT EXISTS sẽ không trùng tên.
_FK_COLUMNS = [
    ("users", "role_id"),
    ("documents", "uploaded_by"),
    ("document_chunks", "document_id"),
    ("conversations", "user_id"),
    ("messages", "conversation_id"),
    ("citations", "message_id"),
    ("citations", "document_id"),
    ("citations", "chunk_id"),
    ("agent_runs", "conversation_id"),
    ("message_feedback", "message_id"),
    ("message_feedback", "user_id"),
    ("message_signals", "message_id"),
    ("message_signals", "user_id"),
    ("students", "created_by"),
    ("exams", "created_by"),
]


async def run(args) -> int:
    async with AsyncSessionLocal() as session:
        existing = set(
            (await session.execute(text(
                "SELECT indexname FROM pg_indexes WHERE schemaname='public'"
            ))).scalars().all()
        )
        created = skipped = 0
        for table, col in _FK_COLUMNS:
            idx = f"idx_{table}_{col}"
            if idx in existing:
                skipped += 1
                continue
            stmt = f'CREATE INDEX IF NOT EXISTS {idx} ON {table} ("{col}")'
            if args.dry_run:
                print("DRY-RUN:", stmt)
            else:
                await session.execute(text(stmt))
                print("✅", idx)
            created += 1
        if not args.dry_run:
            await session.commit()
        print(f"\n=== Xong: tạo {created} index, bỏ qua {skipped} (đã có). ===")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--dry-run", action="store_true", help="Chỉ in, không chạy")
    return asyncio.run(run(parser.parse_args()))


if __name__ == "__main__":
    raise SystemExit(main())
