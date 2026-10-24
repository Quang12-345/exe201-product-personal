"""Schemas cho lịch sử hội thoại Chat AI."""

from datetime import datetime

from pydantic import BaseModel, Field

from src.models.chat import Source


class ConversationSummary(BaseModel):
    id: str
    title: str | None = None
    preview: str = ""
    message_count: int = 0
    updated_at: datetime | None = None


class MessageItem(BaseModel):
    id: str
    role: str  # "user" | "assistant"
    content: str
    sources: list[Source] = Field(default_factory=list)
    confidence: dict | None = Field(default=None, description="Độ tin cậy đã tính (grounded/level/value/factors)")
    my_rating: str | None = Field(default=None, description="Đánh giá 👍/👎 của user hiện tại: up | down")
    created_at: datetime | None = None


class RenameConversationRequest(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)


class DeleteConversationResponse(BaseModel):
    id: str
    deleted: bool = True
