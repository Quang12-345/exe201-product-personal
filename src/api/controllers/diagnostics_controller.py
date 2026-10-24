"""Chẩn đoán cấu hình runtime (admin-only) — soi nhanh môi trường deploy.

KHÔNG trả về secret (chỉ boolean/đếm/thông báo lỗi rút gọn) để an toàn.
Dùng để biết vì sao chat/ingest lỗi trên môi trường deploy (Qdrant/OpenAI/DB).
"""

from sqlalchemy.ext.asyncio import AsyncSession

from src.config import get_settings
from src.repositories import document_repo, user_repo
from src.services import object_storage


async def diagnostics_controller(session: AsyncSession) -> dict:
    s = get_settings()
    out: dict = {
        "app_env": s.app_env,
        "use_docling": s.use_docling,
        "youtube_proxy_configured": bool(s.youtube_proxy_url),
        "ingest_async": s.ingest_async,
        "model_name": s.model_name,
        "embedding_model": s.embedding_model,
        "embedding_dimension": s.embedding_dimension,
        "openai_key_configured": bool(s.openai_api_key),
        "qdrant_url_configured": bool(s.qdrant_url) and "localhost" not in s.qdrant_url,
        "qdrant_collection": s.qdrant_collection_name,
        "qdrant_api_key_configured": bool(s.qdrant_api_key),
        "object_storage_provider": s.object_storage_provider,
        "r2_configured": object_storage.is_enabled(),
        "cors_origins": s.cors_origins,
    }

    # Qdrant: kết nối được không + số điểm
    try:
        from src.services.vector_store import get_qdrant_client

        client = get_qdrant_client()
        exists = await client.collection_exists(s.qdrant_collection_name)
        out["qdrant_reachable"] = True
        out["qdrant_collection_exists"] = exists
        out["qdrant_points"] = (
            (await client.count(collection_name=s.qdrant_collection_name, exact=True)).count
            if exists
            else 0
        )
    except Exception as exc:
        out["qdrant_reachable"] = False
        out["qdrant_error"] = str(exc)[:200]

    # DB: đếm tài liệu/người dùng
    try:
        out["db_documents"] = await document_repo.count_documents(session)
        out["db_users"] = len(await user_repo.list_all(session))
    except Exception as exc:
        out["db_error"] = str(exc)[:200]

    return out
