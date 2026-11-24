"""Controller xử lý ghi nhận lượt truy cập trang và thống kê lưu lượng web cho Admin."""

from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import User
from src.models.traffic import (
    RecordVisitRequest,
    RecordVisitResponse,
    WebTrafficStatsResponse,
)
from src.repositories import traffic_repo


async def record_visit_controller(
    request: RecordVisitRequest,
    session: AsyncSession,
    user: User | None = None,
    ip_address: str | None = None,
    user_agent: str | None = None,
) -> RecordVisitResponse:
    """Ghi nhận lượt xem trang web từ client."""
    user_id = user.id if user else None

    # Tự động phát hiện loại thiết bị từ user-agent nếu client không gửi rõ
    device_type = request.device_type
    if (not device_type or device_type == "desktop") and user_agent:
        ua_lower = user_agent.lower()
        if "mobile" in ua_lower or "android" in ua_lower or "iphone" in ua_lower:
            device_type = "mobile"
        elif "tablet" in ua_lower or "ipad" in ua_lower:
            device_type = "tablet"

    await traffic_repo.record_web_visit(
        session,
        path=request.path,
        page_title=request.page_title,
        user_id=user_id,
        visitor_id=request.visitor_id,
        ip_address=ip_address,
        user_agent=user_agent,
        device_type=device_type,
        referrer=request.referrer,
    )

    return RecordVisitResponse(ok=True)


async def get_traffic_stats_controller(
    session: AsyncSession,
    range_key: str = "14d",
) -> WebTrafficStatsResponse:
    """Lấy báo cáo thống kê lượt truy cập website cho trang Admin."""
    days = 14
    if range_key == "7d":
        days = 7
    elif range_key == "30d":
        days = 30

    return await traffic_repo.get_web_traffic_stats(session, days=days)
