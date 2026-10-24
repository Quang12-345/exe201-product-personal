from pydantic import BaseModel, Field


class Source(BaseModel):
    document_id: str = Field(..., description="ID tài liệu nguồn")
    title: str = Field(..., description="Tên tài liệu nguồn")
    page_number: int | None = Field(default=None, description="Trang trong tài liệu")
    section_title: str | None = Field(default=None, description="Tên chương/mục chứa đoạn trích")
    chunk_id: str = Field(..., description="ID chunk được truy xuất")
    score: float = Field(..., description="Điểm tương đồng từ vector search")
    quote: str | None = Field(default=None, description="Đoạn trích dẫn từ tài liệu")
    cite: int | None = Field(default=None, description="Số trích dẫn [n] tương ứng trong câu trả lời")
    url: str | None = Field(default=None, description="Link nguồn (YouTube nhảy tới đúng mốc thời gian)")
    timestamp: str | None = Field(default=None, description="Mốc thời gian video (MM:SS) nếu nguồn là YouTube")


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=5000, description="Tin nhắn từ user")
    conversation_id: str | None = Field(default=None, description="ID hội thoại hiện có")
    top_k: int = Field(default=5, ge=1, le=20, description="Số chunk liên quan cần truy xuất")
    request_id: str | None = Field(default=None, max_length=64, description="Mã duy nhất cho lần gửi chat")


class ChatResponse(BaseModel):
    response: str = Field(..., description="Phản hồi từ RAG agent")
    conversation_id: str | None = Field(default=None, description="ID hội thoại")
    message_id: str | None = Field(default=None, description="ID câu trả lời AI (để gắn feedback)")
    sources: list[Source] = Field(default_factory=list, description="Nguồn trích dẫn")
    grounded: bool = Field(default=False, description="Câu trả lời có bám tài liệu (có trích dẫn) không")
    confidence: float = Field(default=0.0, description="Độ tin cậy 0..1 (đa tín hiệu, đã hiệu chuẩn)")
    confidence_level: str = Field(default="thấp", description="cao | trung bình | thấp")


# ---- Feedback loop (Product AI): đánh giá câu trả lời AI ----
class FeedbackRequest(BaseModel):
    message_id: str = Field(..., description="ID câu trả lời AI được đánh giá")
    rating: str = Field(..., pattern="^(up|down)$", description="'up' (hữu ích) | 'down' (chưa tốt)")
    reason: str = Field(default="", max_length=1000, description="Lý do tuỳ chọn (nhất là khi 👎)")


class FeedbackResponse(BaseModel):
    ok: bool = True
    rating: str | None = Field(default=None, description="Đánh giá hiện tại sau khi lưu")


class FeedbackReason(BaseModel):
    rating: str
    reason: str
    created_at: str | None = None


class FeedbackQuestion(BaseModel):
    message_id: str
    conversation_id: str | None = None
    question: str = ""
    answer: str = ""
    reason: str = ""
    created_at: str | None = None


class FeedbackSummary(BaseModel):
    total: int = 0
    up: int = 0
    down: int = 0
    helpful_rate: float = 0.0  # up / total (0..1)
    recent: list[FeedbackReason] = Field(default_factory=list)
    bad_questions: list[FeedbackQuestion] = Field(default_factory=list)


# ---- Implicit + System feedback (tín hiệu) ----
class SignalRequest(BaseModel):
    message_id: str = Field(..., description="ID câu trả lời AI")
    kind: str = Field(..., pattern="^(implicit|system)$", description="implicit | system")
    name: str = Field(..., min_length=1, max_length=40, description="copied | opened_source | saved | grounded | confidence...")
    value: float | None = Field(default=None, description="Giá trị tuỳ chọn (vd confidence 0..1)")


class SignalsSummary(BaseModel):
    answers_with_system: int = 0   # số câu trả lời có ghi tín hiệu hệ thống
    grounded_rate: float = 0.0     # tỉ lệ câu trả lời có trích dẫn nguồn
    avg_confidence: float = 0.0    # độ tin cậy trung bình (điểm truy hồi)
    opened_source: int = 0         # implicit: số câu trả lời được mở nguồn
    copied: int = 0                # implicit: số câu trả lời được copy
    saved: int = 0                 # implicit: số câu trả lời được lưu
