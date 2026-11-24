"""Lưu và truy vấn đánh giá / phản hồi của khách hàng (sinh viên, giảng viên) về StudyMind."""

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import CustomerReview


async def create_customer_review(
    session: AsyncSession,
    *,
    user_id: str | None,
    user_name: str,
    role_tag: str,
    rating: int,
    title: str,
    comment: str,
    category: str = "general",
) -> CustomerReview:
    """Tạo mới đánh giá khách hàng."""
    review = CustomerReview(
        user_id=user_id,
        user_name=user_name,
        role_tag=role_tag,
        rating=max(1, min(5, rating)),
        title=title.strip(),
        comment=comment.strip(),
        category=category,
        is_published=True,  # Mặc định công khai để hiển thị ngay
        is_featured=False,
    )
    session.add(review)
    await session.commit()
    await session.refresh(review)
    return review


async def get_public_reviews(
    session: AsyncSession,
    *,
    limit: int = 50,
) -> tuple[list[CustomerReview], float, int, dict[str, int]]:
    """Lấy danh sách review công khai kèm thống kê tổng thể."""
    query = (
        select(CustomerReview)
        .where(CustomerReview.is_published.is_(True))
        .order_by(CustomerReview.is_featured.desc(), CustomerReview.created_at.desc())
        .limit(limit)
    )
    result = await session.execute(query)
    reviews = list(result.scalars().all())

    total_count = len(reviews)
    if total_count == 0:
        return [], 0.0, 0, {"5": 0, "4": 0, "3": 0, "2": 0, "1": 0}

    total_score = sum(r.rating for r in reviews)
    avg_score = round(total_score / total_count, 1)

    breakdown = {"5": 0, "4": 0, "3": 0, "2": 0, "1": 0}
    for r in reviews:
        key = str(max(1, min(5, r.rating)))
        breakdown[key] = breakdown.get(key, 0) + 1

    return reviews, avg_score, total_count, breakdown


async def get_all_reviews_admin(
    session: AsyncSession,
    *,
    limit: int = 150,
) -> tuple[list[CustomerReview], float, int, int, dict[str, int], dict[str, int]]:
    """Lấy toàn bộ review cho trang quản trị Admin kèm chỉ số CSAT & phân bổ chi tiết."""
    query = (
        select(CustomerReview)
        .order_by(CustomerReview.created_at.desc())
        .limit(limit)
    )
    result = await session.execute(query)
    reviews = list(result.scalars().all())

    total_count = len(reviews)
    if total_count == 0:
        return [], 0.0, 0, 0, {"5": 0, "4": 0, "3": 0, "2": 0, "1": 0}, {}

    total_score = sum(r.rating for r in reviews)
    avg_score = round(total_score / total_count, 1)

    breakdown = {"5": 0, "4": 0, "3": 0, "2": 0, "1": 0}
    category_breakdown = {}
    positive_count = 0

    for r in reviews:
        key = str(max(1, min(5, r.rating)))
        breakdown[key] = breakdown.get(key, 0) + 1
        if r.rating >= 4:
            positive_count += 1
        cat = r.category or "general"
        category_breakdown[cat] = category_breakdown.get(cat, 0) + 1

    csat_rate = round((positive_count / total_count) * 100)

    return reviews, avg_score, total_count, csat_rate, breakdown, category_breakdown


async def toggle_publish_review(session: AsyncSession, review_id: str) -> CustomerReview | None:
    """Bật/tắt trạng thái hiển thị của review."""
    result = await session.execute(select(CustomerReview).where(CustomerReview.id == review_id))
    review = result.scalar_one_or_none()
    if review:
        review.is_published = not review.is_published
        await session.commit()
        await session.refresh(review)
    return review


async def toggle_feature_review(session: AsyncSession, review_id: str) -> CustomerReview | None:
    """Ghim hoặc bỏ ghim review nổi bật."""
    result = await session.execute(select(CustomerReview).where(CustomerReview.id == review_id))
    review = result.scalar_one_or_none()
    if review:
        review.is_featured = not review.is_featured
        await session.commit()
        await session.refresh(review)
    return review


async def delete_customer_review(session: AsyncSession, review_id: str) -> bool:
    """Xóa một đánh giá."""
    result = await session.execute(delete(CustomerReview).where(CustomerReview.id == review_id))
    await session.commit()
    return bool(result.rowcount)
