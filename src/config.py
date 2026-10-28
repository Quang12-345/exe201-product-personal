import os
from functools import lru_cache
from typing import Literal

from dotenv import load_dotenv
from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict

load_dotenv()


def _disable_broken_langsmith_tracing() -> None:
    """Tắt LangSmith tracing nếu API key trống/placeholder.

    LangChain đọc trực tiếp các biến môi trường này; nếu tracing bật mà key sai,
    mỗi lần gọi LLM sẽ POST tới LangSmith → lỗi 403 + retry → CHẬM toàn bộ
    (chat, gợi ý metadata...). Phát hiện key giả thì tắt hẳn tracing.
    """
    key = (os.environ.get("LANGCHAIN_API_KEY") or os.environ.get("LANGSMITH_API_KEY") or "").strip()
    looks_fake = (not key) or key.startswith("your-") or key in {"changeme", "...", "xxx"}
    if looks_fake:
        for var in ("LANGCHAIN_TRACING_V2", "LANGSMITH_TRACING", "LANGCHAIN_TRACING"):
            os.environ[var] = "false"
        os.environ.pop("LANGCHAIN_API_KEY", None)
        os.environ.pop("LANGSMITH_API_KEY", None)


_disable_broken_langsmith_tracing()


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # App
    app_name: str = "AI20K Agent"
    app_env: Literal["development", "production", "test"] = Field(
        default="development",
        validation_alias="APP_ENV",
    )
    app_port: int = Field(default=8000, ge=1, le=65535, validation_alias="APP_PORT")
    app_host: str = Field(default="0.0.0.0", validation_alias="APP_HOST")
    log_level: Literal["DEBUG", "INFO", "WARNING", "ERROR"] = Field(
        default="INFO",
        validation_alias="LOG_LEVEL",
    )
    cors_origins: str = Field(
        default="http://localhost:3000",
        validation_alias="CORS_ORIGINS",
    )
    # Regex origin bổ sung, vd. "https://.*\.vercel\.app" để cho phép domain preview của Vercel.
    cors_origin_regex: str = Field(default="", validation_alias="CORS_ORIGIN_REGEX")

    # LLM
    llm_provider: Literal["openai", "anthropic", "google"] = Field(
        default="openai",
        validation_alias="LLM_PROVIDER",
    )
    openai_api_key: str = Field(default="", validation_alias="OPENAI_API_KEY")
    anthropic_api_key: str = Field(default="", validation_alias="ANTHROPIC_API_KEY")
    google_api_key: str = Field(default="", validation_alias="GOOGLE_API_KEY")

    def has_usable_openai_key(self) -> bool:
        key = (self.openai_api_key or "").strip()
        if not key:
            return False
        if key.startswith("your-") or key in {"changeme", "...", "xxx"}:
            return False
        return True

    def has_usable_anthropic_key(self) -> bool:
        key = (self.anthropic_api_key or "").strip()
        if not key:
            return False
        if key.startswith("your-") or key in {"changeme", "...", "xxx"}:
            return False
        return True

    def has_usable_google_key(self) -> bool:
        key = (self.google_api_key or "").strip()
        if not key:
            return False
        if key.startswith("your-") or key in {"changeme", "...", "xxx"}:
            return False
        return True
    model_name: str = Field(default="gpt-4o-mini", validation_alias="MODEL_NAME")
    llm_temperature: float = Field(
        default=0.2,
        ge=0.0,
        le=2.0,
        validation_alias="LLM_TEMPERATURE",
    )
    # Timeout (giây) cho mỗi lần gọi LLM — fail nhanh thay vì treo vô hạn khi
    # nhà cung cấp (OpenAI) chậm/treo. Đây là nguyên nhân chính khiến chatbot
    # "AI đang trả lời" mãi không xong.
    llm_request_timeout: float = Field(
        default=60.0,
        gt=0.0,
        validation_alias="LLM_REQUEST_TIMEOUT",
    )
    llm_max_retries: int = Field(
        default=2,
        ge=0,
        le=5,
        validation_alias="LLM_MAX_RETRIES",
    )
    # Trần thời gian (giây) cho cả phiên trả lời streaming. Quá hạn → kết thúc
    # an toàn bằng sự kiện lỗi thay vì để client treo.
    chat_stream_timeout: float = Field(
        default=90.0,
        gt=0.0,
        validation_alias="CHAT_STREAM_TIMEOUT",
    )

    # Embedding
    embedding_provider: Literal["openai", "google"] = Field(
        default="openai",
        validation_alias="EMBEDDING_PROVIDER",
    )
    embedding_model: str = Field(
        default="text-embedding-3-small",
        validation_alias="EMBEDDING_MODEL",
    )
    embedding_dimension: int = Field(
        default=1536,
        gt=0,
        validation_alias="EMBEDDING_DIMENSION",
    )

    # Database
    database_url: str = Field(
        default="sqlite:///./data/app.db",
        validation_alias="DATABASE_URL",
    )

    # Vector Store - Qdrant
    qdrant_url: str = Field(
        default="http://localhost:6333",
        validation_alias="QDRANT_URL",
    )
    qdrant_api_key: str = Field(default="", validation_alias="QDRANT_API_KEY")
    qdrant_collection_name: str = Field(
        default="project-db",
        validation_alias="QDRANT_COLLECTION_NAME",
    )

    # Object storage - Cloudflare R2 (S3-compatible) cho tài liệu gốc.
    # Khi provider != "r2" hoặc thiếu credential, lớp lưu trữ tự động no-op.
    object_storage_provider: str = Field(
        default="local",
        validation_alias="OBJECT_STORAGE_PROVIDER",
        description='"r2" để bật Cloudflare R2; còn lại chỉ lưu file local.',
    )
    r2_account_id: str = Field(default="", validation_alias="R2_ACCOUNT_ID")
    r2_bucket_name: str = Field(default="", validation_alias="R2_BUCKET_NAME")
    r2_access_key_id: str = Field(default="", validation_alias="R2_ACCESS_KEY_ID")
    r2_secret_access_key: str = Field(default="", validation_alias="R2_SECRET_ACCESS_KEY")
    r2_endpoint_url: str = Field(default="", validation_alias="R2_ENDPOINT_URL")
    r2_region: str = Field(default="auto", validation_alias="R2_REGION")

    # Message queue - Redis + arq cho xử lý tài liệu nền.
    redis_url: str = Field(
        default="redis://localhost:6379/0",
        validation_alias="REDIS_URL",
    )
    ingest_async: bool = Field(
        default=False,
        validation_alias="INGEST_ASYNC",
        description="True: upload đẩy job vào hàng đợi (cần worker arq). False: xử lý inline.",
    )
    seed_demo: bool = Field(
        default=False,
        validation_alias="SEED_DEMO",
        description="True: tự tạo tài khoản demo khi khởi động (tiện cho deploy không có Shell).",
    )
    use_docling: bool = Field(
        default=True,
        validation_alias="USE_DOCLING",
        description="True: dùng docling (chất lượng cao, nặng RAM). False: trích xuất nhẹ "
        "(pypdf/docx/pptx) cho instance RAM thấp — tránh OOM.",
    )
    youtube_proxy_url: str = Field(
        default="",
        validation_alias="YOUTUBE_PROXY_URL",
        description="Proxy (http://user:pass@host:port) để lấy transcript YouTube khi chạy "
        "trên IP trung tâm dữ liệu bị YouTube chặn (Render...). Trống = gọi trực tiếp. "
        "Trên IP dân dụng (máy cá nhân) không cần proxy.",
    )

    # RAG retrieval & generation
    rag_min_score: float = Field(
        default=0.35,
        ge=0.0,
        le=1.0,
        validation_alias="RAG_MIN_SCORE",
        description="Ngưỡng cosine ƯU TIÊN: chunk đạt ngưỡng này được coi là chắc chắn "
        "liên quan. Đo thực tế: câu trong phạm vi tài liệu ~0.46-0.69, ngoài phạm vi "
        "~0.33-0.35. Hạ từ 0.4→0.35 vì tài liệu tiếng Việt/đoạn ngắn thường ghi điểm "
        "thấp hơn, dễ bị loại oan khiến 'tài liệu đã index nhưng hỏi không ra'.",
    )
    rag_fallback_min_score: float = Field(
        default=0.22,
        ge=0.0,
        le=1.0,
        validation_alias="RAG_FALLBACK_MIN_SCORE",
        description="Ngưỡng DỰ PHÒNG: chỉ dùng khi vòng truy hồi chính KHÔNG ra chunk "
        "nào. Cho phép lấy các chunk liên quan vừa phải (0.22-0.35) để tài liệu đã "
        "lập chỉ mục luôn trả lời được; vẫn loại nhiễu thực sự (<0.22). Chống bịa vẫn "
        "được đảm bảo ở tầng prompt (chỉ trả lời theo context + trích dẫn).",
    )
    rag_candidate_multiplier: int = Field(
        default=4,
        ge=1,
        le=20,
        validation_alias="RAG_CANDIDATE_MULTIPLIER",
        description="Số ứng viên truy hồi = top_k * hệ số này (để rerank chọn lại).",
    )
    rag_max_context_tokens: int = Field(
        default=4000,
        gt=0,
        validation_alias="RAG_MAX_CONTEXT_TOKENS",
        description="Giới hạn token của context đưa vào LLM. Nâng 3000→4000 để giữ "
        "đủ nhiều đoạn liên quan cho câu trả lời trọn vẹn (gpt-4o-mini thừa cửa sổ "
        "ngữ cảnh); tránh việc cắt mất đoạn chứa đáp án khiến trả lời thiếu/không ra.",
    )

    # Auth
    jwt_secret_key: str = Field(
        default="dev-secret-change-me",
        validation_alias="JWT_SECRET_KEY",
    )
    google_client_id: str = Field(
        default="",
        validation_alias=AliasChoices("GOOGLE_CLIENT_ID", "VITE_GOOGLE_CLIENT_ID"),
    )

    # Email
    email_host: str = Field(default="smtp.gmail.com", validation_alias="EMAIL_HOST")
    email_port: int = Field(default=587, ge=1, le=65535, validation_alias="EMAIL_PORT")
    email_username: str = Field(default="", validation_alias="EMAIL_USERNAME")
    email_password: str = Field(default="", validation_alias="EMAIL_PASSWORD")
    email_from: str = Field(default="", validation_alias="EMAIL_FROM")
    email_from_name: str = Field(default="DMRS", validation_alias="EMAIL_FROM_NAME")
    # Số giây timeout cho mỗi lần kết nối SMTP (fail nhanh thay vì treo ~60s).
    email_timeout: float = Field(
        default=15.0,
        ge=1.0,
        le=120.0,
        validation_alias="EMAIL_TIMEOUT",
    )
    # Brevo (Sendinblue) HTTP API — gửi email qua cổng 443, KHÔNG bị cloud
    # (Render) chặn như SMTP 25/465/587. Có key thì ưu tiên dùng Brevo.
    brevo_api_key: str = Field(default="", validation_alias="BREVO_API_KEY")

    # VNPay
    vnpay_tmn_code: str = Field(default="", validation_alias="VNPAY_TMN_CODE")
    vnpay_hash_secret: str = Field(default="", validation_alias="VNPAY_HASH_SECRET")
    vnpay_payment_url: str = Field(
        default="https://sandbox.vnpayment.vn/paymentv2/vpcpay.html",
        validation_alias="VNPAY_PAYMENT_URL",
    )
    vnpay_query_url: str = Field(
        default="https://sandbox.vnpayment.vn/merchant_webapi/api/transaction",
        validation_alias="VNPAY_QUERY_URL",
    )
    vnpay_server_ip: str = Field(default="127.0.0.1", validation_alias="VNPAY_SERVER_IP")
    vnpay_return_url: str = Field(
        default="http://localhost:8000/api/v1/payments/vnpay/return",
        validation_alias="VNPAY_RETURN_URL",
    )
    frontend_url: str = Field(default="http://localhost:5173", validation_alias="FRONTEND_URL")

    # Token quotas (Plan limits)
    free_daily_token_limit: int = Field(
        default=200_000,
        gt=0,
        validation_alias="FREE_DAILY_TOKEN_LIMIT",
        description="Giới hạn token hàng ngày cho gói Free.",
    )
    pro_daily_token_limit: int = Field(
        default=900_000,
        gt=0,
        validation_alias="PRO_DAILY_TOKEN_LIMIT",
        description="Giới hạn token hàng ngày cho gói Pro.",
    )

    # LangSmith tracing
    langchain_api_key: str = Field(default="", validation_alias="LANGCHAIN_API_KEY")
    langchain_project: str = Field(
        default="ai20k-agent",
        validation_alias="LANGCHAIN_PROJECT",
    )
    langchain_tracing_v2: bool = Field(
        default=False,
        validation_alias="LANGCHAIN_TRACING_V2",
    )

    # AI usage logging hooks
    ai_log_server: str = Field(
        default="https://ai-logs.note.transformerlabs.ai/api/ingest",
        validation_alias="AI_LOG_SERVER",
    )
    ai_log_api_key: str = Field(default="", validation_alias="AI_LOG_API_KEY")
    ai_log_dir: str = Field(default=".ai-log", validation_alias="AI_LOG_DIR")

    def model_post_init(self, __context) -> None:
        if isinstance(self.vnpay_tmn_code, str):
            self.vnpay_tmn_code = self.vnpay_tmn_code.strip()
        if isinstance(self.vnpay_hash_secret, str):
            self.vnpay_hash_secret = self.vnpay_hash_secret.strip()
        if isinstance(self.vnpay_return_url, str):
            self.vnpay_return_url = self.vnpay_return_url.strip()
        if isinstance(self.vnpay_payment_url, str):
            self.vnpay_payment_url = self.vnpay_payment_url.strip()
        if isinstance(self.vnpay_query_url, str):
            self.vnpay_query_url = self.vnpay_query_url.strip()
        if isinstance(self.frontend_url, str):
            self.frontend_url = self.frontend_url.strip().rstrip("/")
        if isinstance(self.google_client_id, str):
            self.google_client_id = self.google_client_id.strip()


@lru_cache
def get_settings() -> Settings:
    return Settings()
