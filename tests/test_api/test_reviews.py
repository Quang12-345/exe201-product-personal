from datetime import datetime
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from src.api.controllers.review_controller import (
    get_public_reviews_controller,
    submit_review_controller,
)
from src.db.models import CustomerReview
from src.models.review import CreateReviewRequest


@pytest.mark.asyncio
async def test_submit_review_controller_success(monkeypatch):
    """Kiểm tra controller tạo đánh giá từ người dùng."""
    fake_review = CustomerReview(
        id="rev-123",
        user_id="user-1",
        user_name="Nguyễn Văn A",
        role_tag="Khoa CNTT",
        rating=5,
        title="Rất hài lòng",
        comment="AI trả lời chuẩn có trích dẫn",
        category="rag_ai",
        is_published=True,
        is_featured=False,
        created_at=datetime.utcnow(),
    )

    async def fake_create_review(session, **kwargs):
        return fake_review

    monkeypatch.setattr(
        "src.repositories.review_repo.create_customer_review",
        fake_create_review,
    )

    session = AsyncMock()
    user = SimpleNamespace(
        id="user-1",
        full_name="Nguyễn Văn A",
        username="nguyenvana",
        faculty="CNTT",
        role=SimpleNamespace(name="student"),
    )
    req = CreateReviewRequest(
        rating=5,
        title="Rất hài lòng",
        comment="AI trả lời chuẩn có trích dẫn",
        category="rag_ai",
    )

    result = await submit_review_controller(req, session, user)
    assert result.id == "rev-123"
    assert result.user_name == "Nguyễn Văn A"
    assert result.role_tag == "Khoa CNTT"
    assert result.rating == 5


@pytest.mark.asyncio
async def test_get_public_reviews_controller_success(monkeypatch):
    """Kiểm tra controller lấy danh sách review công khai."""
    fake_review = CustomerReview(
        id="rev-456",
        user_name="Trần Thị B",
        role_tag="Sinh viên FPTU",
        rating=5,
        title="Học flashcard rất hay",
        comment="Flashcard 3D giúp nhớ từ vựng tốt",
        category="study_aid",
        is_published=True,
        is_featured=True,
        created_at=datetime.utcnow(),
    )

    async def fake_get_public(session, **kwargs):
        return [fake_review], 5.0, 1, {"5": 1, "4": 0, "3": 0, "2": 0, "1": 0}

    monkeypatch.setattr(
        "src.repositories.review_repo.get_public_reviews",
        fake_get_public,
    )

    session = AsyncMock()
    res = await get_public_reviews_controller(session)
    assert res.average_rating == 5.0
    assert res.total_reviews == 1
    assert len(res.reviews) == 1
    assert res.reviews[0].user_name == "Trần Thị B"
    assert res.reviews[0].category == "study_aid"
