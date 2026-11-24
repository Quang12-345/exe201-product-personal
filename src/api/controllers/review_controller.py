"""Controller xử lý Đánh giá / Phản hồi từ khách hàng (Customer Reviews)."""

from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import Role, User
from src.models.review import (
    AdminReviewsResponse,
    CreateReviewRequest,
    PublicReviewsResponse,
    ReviewItem,
)
from src.repositories import review_repo

RATING_DEFAULT_TITLES = {
    5: "Rất hài lòng & Xuất sắc! 🌟",
    4: "Hài lòng & Trải nghiệm tốt 😊",
    3: "Bình thường 😐",
    2: "Cần cải thiện 🙁",
    1: "Chưa hài lòng 😞",
}


async def submit_review_controller(
    request: CreateReviewRequest,
    session: AsyncSession,
    user: User | None = None,
) -> ReviewItem:
    """Xử lý gửi đánh giá từ người dùng (tự động nhận diện tên và khoa/vai trò)."""
    user_id = user.id if user else None

    # Tự động nhận diện Tên người dùng
    user_name = "Sinh viên StudyMind"
    if user:
        user_name = getattr(user, "full_name", None) or (
            user.email.split("@")[0] if getattr(user, "email", None) else user_name
        )

    # Tự động nhận diện Khoa / Khóa / Vai trò
    role_tag = request.role_tag.strip() if request.role_tag else ""
    if not role_tag:
        user_role_name = None
        if user and getattr(user, "role_id", None):
            role_obj = await session.get(Role, user.role_id)
            if role_obj:
                user_role_name = role_obj.name

        if user_role_name == "lecturer":
            role_tag = "Giảng viên"
        elif user_role_name == "admin":
            role_tag = "Quản trị viên"
        else:
            role_tag = "Sinh viên"

    # Tự động tạo Tiêu đề nếu để trống
    title = request.title.strip() if request.title else ""
    if not title:
        title = RATING_DEFAULT_TITLES.get(request.rating, "Đánh giá StudyMind")

    review = await review_repo.create_customer_review(
        session,
        user_id=user_id,
        user_name=user_name,
        role_tag=role_tag,
        rating=request.rating,
        title=title,
        comment=request.comment,
        category=request.category,
    )

    return ReviewItem(
        id=review.id,
        user_name=review.user_name,
        role_tag=review.role_tag,
        avatar_url=review.avatar_url,
        rating=review.rating,
        title=review.title,
        comment=review.comment,
        category=review.category,
        is_published=review.is_published,
        is_featured=review.is_featured,
        created_at=review.created_at,
    )


async def get_public_reviews_controller(
    session: AsyncSession,
) -> PublicReviewsResponse:
    """Lấy danh sách đánh giá khách hàng công khai và chỉ số hài lòng."""
    reviews, avg_score, total_count, breakdown = await review_repo.get_public_reviews(session)

    items = [
        ReviewItem(
            id=r.id,
            user_name=r.user_name,
            role_tag=r.role_tag,
            avatar_url=r.avatar_url,
            rating=r.rating,
            title=r.title,
            comment=r.comment,
            category=r.category,
            is_published=r.is_published,
            is_featured=r.is_featured,
            created_at=r.created_at,
        )
        for r in reviews
    ]

    return PublicReviewsResponse(
        average_rating=avg_score,
        total_reviews=total_count,
        rating_breakdown=breakdown,
        reviews=items,
    )


async def get_admin_reviews_controller(
    session: AsyncSession,
) -> AdminReviewsResponse:
    """Lấy danh sách toàn bộ đánh giá cho trang Admin kèm CSAT & phân bổ chi tiết."""
    reviews, avg_score, total_count, csat_rate, breakdown, cat_breakdown = (
        await review_repo.get_all_reviews_admin(session)
    )

    items = [
        ReviewItem(
            id=r.id,
            user_name=r.user_name,
            role_tag=r.role_tag,
            avatar_url=r.avatar_url,
            rating=r.rating,
            title=r.title,
            comment=r.comment,
            category=r.category,
            is_published=r.is_published,
            is_featured=r.is_featured,
            created_at=r.created_at,
        )
        for r in reviews
    ]

    return AdminReviewsResponse(
        average_rating=avg_score,
        total_reviews=total_count,
        csat_rate=csat_rate,
        rating_breakdown=breakdown,
        category_breakdown=cat_breakdown,
        reviews=items,
    )


async def toggle_publish_controller(review_id: str, session: AsyncSession) -> ReviewItem:
    """Admin bật/tắt hiển thị review trên trang chủ."""
    review = await review_repo.toggle_publish_review(session, review_id)
    if not review:
        raise HTTPException(status_code=404, detail="Không tìm thấy đánh giá này")
    return ReviewItem(
        id=review.id,
        user_name=review.user_name,
        role_tag=review.role_tag,
        avatar_url=review.avatar_url,
        rating=review.rating,
        title=review.title,
        comment=review.comment,
        category=review.category,
        is_published=review.is_published,
        is_featured=review.is_featured,
        created_at=review.created_at,
    )


async def toggle_feature_controller(review_id: str, session: AsyncSession) -> ReviewItem:
    """Admin ghim/bỏ ghim review nổi bật."""
    review = await review_repo.toggle_feature_review(session, review_id)
    if not review:
        raise HTTPException(status_code=404, detail="Không tìm thấy đánh giá này")
    return ReviewItem(
        id=review.id,
        user_name=review.user_name,
        role_tag=review.role_tag,
        avatar_url=review.avatar_url,
        rating=review.rating,
        title=review.title,
        comment=review.comment,
        category=review.category,
        is_published=review.is_published,
        is_featured=review.is_featured,
        created_at=review.created_at,
    )


async def delete_review_controller(review_id: str, session: AsyncSession) -> dict:
    """Admin xóa một đánh giá."""
    ok = await review_repo.delete_customer_review(session, review_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Không tìm thấy đánh giá để xóa")
    return {"ok": True, "message": "Đã xóa đánh giá thành công"}
