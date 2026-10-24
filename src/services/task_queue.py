"""Hàng đợi xử lý tài liệu nền — Redis + arq.

Endpoint upload chỉ ENQUEUE job (nhanh) rồi trả về ngay; worker (src/worker.py)
mới thực sự chạy docling + embedding (chậm). Nhờ vậy xử lý được nhiều tài liệu
song song mà không block request.
"""

from arq import create_pool
from arq.connections import RedisSettings

from src.config import get_settings

INGEST_TASK = "ingest_document_task"


def get_redis_settings() -> RedisSettings:
    return RedisSettings.from_dsn(get_settings().redis_url)


async def enqueue_ingest(payload: dict) -> str | None:
    """Đẩy 1 job ingest vào hàng đợi. Trả về job_id, hoặc None nếu không kết nối được Redis."""
    try:
        pool = await create_pool(get_redis_settings())
    except Exception:
        return None
    try:
        job = await pool.enqueue_job(INGEST_TASK, payload)
        return job.job_id if job else None
    finally:
        await pool.aclose()
