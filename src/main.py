import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.api.routes import router
from src.config import get_settings


async def _startup_db(settings) -> None:
    """Khởi tạo DB Ở NỀN — KHÔNG chặn việc uvicorn bind cổng.

    uvicorn chạy lifespan startup TRƯỚC khi mở cổng; nếu await init_db (kết nối DB
    chậm/treo, hoặc DDL chờ khóa lúc deploy rolling) thì cổng KHÔNG bao giờ mở →
    Render báo "no open ports". Vì vậy mọi việc DB chuyển sang task nền; app phục vụ
    /health ngay, các endpoint DB sẽ sẵn sàng sau vài giây khi init xong.
    """
    from src.db.session import ensure_schema_safe, init_db

    try:
        await init_db()
        print("Database initialized (tables + default roles ready)")
        if settings.seed_demo:
            from src.db.seed import seed_demo_accounts

            await seed_demo_accounts(ensure_schema=False)
            print("Demo accounts seeded (SEED_DEMO=true)")
    except Exception as exc:  # noqa: BLE001
        print(f"[startup_db] init/seed lỗi (sẽ thử lại nền): {exc}")

    # Thử lại nâng cấp schema ở nền (phòng khi bị khóa lúc deploy rolling).
    for delay in (10, 20, 40):
        try:
            if await ensure_schema_safe():
                break
        except Exception:  # noqa: BLE001
            pass
        await asyncio.sleep(delay)


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    print(f"Starting {settings.app_name} in {settings.app_env} mode")
    # Chạy init DB ở NỀN, KHÔNG await → cổng được bind ngay (tránh 'no open ports').
    db_task = asyncio.create_task(_startup_db(settings))
    yield
    db_task.cancel()
    print("Shutting down...")


app = FastAPI(
    title="AI20K Agent",
    description="AI Agent built with LangGraph",
    version="1.0.0",
    lifespan=lifespan,
)

settings = get_settings()
# CORS: danh sách origin tách bằng dấu phẩy. Đặt CORS_ORIGINS=* để cho phép mọi domain
# (tiện khi deploy). Vì xác thực dùng Bearer token (không dùng cookie) nên có thể tắt
# allow_credentials khi dùng "*" — trình duyệt không cho dùng "*" kèm credentials.
# Chuẩn hoá: bỏ dấu "/" cuối vì header Origin của trình duyệt KHÔNG có "/" cuối
# (nếu để "https://site/" sẽ không khớp → CORS chặn → preflight 400).
_cors_origins = [o.strip().rstrip("/") for o in settings.cors_origins.split(",") if o.strip()]
_allow_all = "*" in _cors_origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if _allow_all else _cors_origins,
    allow_origin_regex=settings.cors_origin_regex.strip() or None,
    allow_credentials=not _allow_all,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router, prefix="/api/v1")


@app.get("/health")
async def health():
    return {"status": "ok", "env": settings.app_env}
