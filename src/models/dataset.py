from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class IngestResponse(BaseModel):
    documents: int
    chunks: int
    points: int
    failed_documents: int
    skipped_documents: int = 0
    deleted_stale_documents: int = 0
    deleted_orphan_points: int = 0
    dataset_dir: str


class DocumentResponse(BaseModel):
    """Tóm tắt 1 tài liệu cho trang quản lý của giảng viên/quản trị."""

    id: str
    title: str
    file_name: str
    file_type: str
    scope: str = "school"
    category: str = "syllabus"
    subject: str | None = None
    description: str | None = None
    kind: str = "file"  # "file" | "link"
    url: str | None = None  # với tài liệu dạng liên kết
    status: str
    total_pages: int = 0
    total_chunks: int = 0
    uploaded_by: str | None = None
    uploaded_by_name: str | None = None
    classroom_id: str | None = None
    classroom_name: str | None = None
    created_at: datetime | None = None
    is_new: bool = False


class LinkDocumentRequest(BaseModel):
    """Yêu cầu đăng ký 1 tài liệu dạng liên kết (URL)."""

    url: str
    title: str | None = None
    description: str | None = None
    category: str | None = Field(default=None, max_length=50)
    subject: str | None = Field(default=None, max_length=255)


class UpdateDocumentRequest(BaseModel):
    """Các trường metadata được phép chỉnh sửa cho tài liệu."""

    model_config = ConfigDict(extra="forbid")

    title: str | None = Field(default=None, min_length=1, max_length=255)
    category: str | None = Field(default=None, max_length=50)
    subject: str | None = Field(default=None, max_length=255)


class UploadDocumentResponse(BaseModel):
    """Kết quả tải lên + ingest 1 tài liệu."""

    document: DocumentResponse
    chunks: int
    points: int
    failed: bool = False
    error: str | None = None


class DeleteDocumentResponse(BaseModel):
    id: str
    deleted: bool = True


class DocumentDownloadResponse(BaseModel):
    """URL tải xuống tạm thời (presigned) cho bản gốc trên object store."""

    url: str
    expires_in: int = 3600
