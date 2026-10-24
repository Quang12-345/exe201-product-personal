"""Worker arq xử lý tài liệu nền (docling + embedding + upsert Qdrant).

Chạy:  python -m src.worker         (hoặc: arq src.worker.WorkerSettings)

Cần Redis đang chạy (xem deploy/docker-compose.yml) và INGEST_ASYNC=true để
endpoint upload đẩy job sang đây.
"""

from pathlib import Path

from src.config import get_settings
from src.db.session import AsyncSessionLocal
from src.services import object_storage
from src.services.ingestion import ingest_document_file
from src.services.task_queue import INGEST_TASK, get_redis_settings


async def ingest_document_task(ctx, payload: dict) -> dict:
    """Job: xử lý 1 tài liệu đã được upload (local hoặc R2) thành chunks + vectors."""
    path = Path(payload["path"])

    # Nếu file local không còn nhưng có bản trên R2 thì tải về để xử lý.
    if not path.exists() and payload.get("r2_key"):
        path.parent.mkdir(parents=True, exist_ok=True)
        await object_storage.download_file(payload["r2_key"], path)

    async with AsyncSessionLocal() as session:
        stats = await ingest_document_file(
            session,
            path,
            dataset_name=payload.get("dataset_name", "uploads"),
            scope=payload.get("scope", "personal"),
            owner_id=payload.get("owner_id"),
            subject=payload.get("subject"),
            category=payload.get("category", "syllabus"),
            r2_key=payload.get("r2_key"),
            force=True,
        )
    return stats


async def startup(ctx) -> None:
    print(f"[worker] ready — env={get_settings().app_env}")


async def shutdown(ctx) -> None:
    print("[worker] shutting down")


class WorkerSettings:
    functions = [ingest_document_task]
    on_startup = startup
    on_shutdown = shutdown
    redis_settings = get_redis_settings()
    # Tên hàm phải khớp INGEST_TASK để enqueue_job tìm đúng.
    assert ingest_document_task.__name__ == INGEST_TASK


def main() -> None:
    from arq.worker import run_worker

    run_worker(WorkerSettings)


if __name__ == "__main__":
    main()
