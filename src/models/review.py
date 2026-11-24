from datetime import datetime

from pydantic import BaseModel, Field


class CreateReviewRequest(BaseModel):
    rating: int = Field(..., ge=1, le=5, description="Đánh giá từ 1 đến 5 sao")
    comment: str = Field(..., min_length=2, max_length=2000, description="Lời nhận xét của bạn")
    title: str = Field(default="", max_length=200, description="Tiêu đề ngắn (tùy chọn)")
    role_tag: str = Field(default="", max_length=100, description="Khóa / Khoa / Trường (tùy chọn)")
    category: str = Field(default="general", max_length=50)


class ReviewItem(BaseModel):
    id: str
    user_name: str
    role_tag: str
    avatar_url: str | None = None
    rating: int
    title: str
    comment: str
    category: str
    is_published: bool = True
    is_featured: bool = False
    created_at: datetime


class PublicReviewsResponse(BaseModel):
    average_rating: float
    total_reviews: int
    rating_breakdown: dict[str, int]
    reviews: list[ReviewItem]


class AdminReviewsResponse(BaseModel):
    average_rating: float
    total_reviews: int
    csat_rate: int
    rating_breakdown: dict[str, int]
    category_breakdown: dict[str, int]
    reviews: list[ReviewItem]
