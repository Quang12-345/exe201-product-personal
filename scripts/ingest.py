"""Ingest dataset documents into the database + Qdrant (idempotent).

Usage:
    python scripts/ingest.py                  # ingest mới/thay đổi, dọn points mồ côi
    python scripts/ingest.py --force          # xử lý + embed lại toàn bộ tài liệu
    python scripts/ingest.py --reset          # xóa collection Qdrant rồi ingest lại từ đầu
    python scripts/ingest.py --dataset-dir datasets/docs

An toàn để chạy lặp lại (cron/CI/deploy hook): tài liệu không thay đổi sẽ được
bỏ qua, tài liệu bị xóa khỏi dataset sẽ được dọn points tương ứng trên Qdrant.
"""

import argparse
import asyncio
import json
import socket
import sys
from pathlib import Path
from urllib.parse import urlsplit

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from src.config import get_settings
from src.db.session import AsyncSessionLocal
from src.services.data_pipeline import DEFAULT_DATASET_DIR
from src.services.ingestion import ingest_dataset
from src.services.vector_store import recreate_collection


async def run(args: argparse.Namespace) -> dict:
    if args.reset:
        await recreate_collection()

    async with AsyncSessionLocal() as session:
        return await ingest_dataset(
            session,
            dataset_dir=args.dataset_dir,
            dataset_name=args.dataset_name,
            # Sau khi reset collection, bắt buộc embed lại — nếu không, các tài
            # liệu "ready" trong DB sẽ bị skip và vector store rỗng.
            force=args.force or args.reset,
            cleanup_orphans=True,
        )


def database_preflight_error(database_url: str, *, timeout: float = 2.0) -> str | None:
    """Return a friendly setup error when Postgres is not listening locally."""
    parsed = urlsplit(database_url)
    if not parsed.scheme.startswith("postgresql"):
        return None

    host = parsed.hostname or "localhost"
    port = parsed.port or 5432
    try:
        with socket.create_connection((host, port), timeout=timeout):
            return None
    except OSError as exc:
        database_name = parsed.path.lstrip("/") or "<database>"
        user = parsed.username or "<user>"
        return (
            f"Cannot connect to Postgres at {host}:{port} from DATABASE_URL "
            f"(database={database_name}, user={user}): {exc}\n\n"
            "Start a Postgres instance that listens on this host/port and make "
            "sure the configured database/user exist. For quick local ingest, "
            "you can also switch DATABASE_URL to sqlite:///./data/app.db."
        )


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--dataset-dir", type=Path, default=DEFAULT_DATASET_DIR)
    parser.add_argument("--dataset-name", default="docs")
    parser.add_argument(
        "--force",
        action="store_true",
        help="Xử lý + embed lại cả tài liệu không thay đổi.",
    )
    parser.add_argument(
        "--reset",
        action="store_true",
        help="Xóa và tạo lại collection Qdrant trước khi ingest (kéo theo --force).",
    )
    args = parser.parse_args()

    if error := database_preflight_error(get_settings().database_url):
        print(error, file=sys.stderr)
        return 2

    stats = asyncio.run(run(args))
    print(json.dumps(stats, ensure_ascii=False, indent=2))
    return 1 if stats.get("failed_documents") else 0


if __name__ == "__main__":
    raise SystemExit(main())
