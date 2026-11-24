"""Repository lưu trữ và tổng hợp số liệu lưu lượng truy cập website (Web Traffic & Visitors)."""

from collections import Counter, defaultdict
from datetime import datetime, timedelta

from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import WebVisit
from src.models.traffic import (
    DeviceBreakdownItem,
    TopPageItem,
    TrafficTrendPoint,
    WebTrafficStatsResponse,
)

PAGE_TITLES_MAP = {
    "/": "Trang chủ / Giới thiệu",
    "/login": "Đăng nhập",
    "/register": "Đăng ký tài khoản",
    "/student": "Bàn học sinh viên",
    "/student/chat": "Sổ tay AI & Hỏi đáp",
    "/student/quizzes": "Thi trắc nghiệm AI",
    "/student/flashcards": "Thẻ ghi nhớ Flashcard 3D",
    "/student/documents": "Thư viện tài liệu",
    "/student/classrooms": "Lớp học của tôi",
    "/student/settings": "Hồ sơ & Gói Pro",
    "/lecturer": "Bảng điều khiển Giảng viên",
    "/admin": "Quản trị hệ thống Admin",
    "/admin/finance": "Tài chính & Doanh thu",
    "/admin/analytics": "Thống kê & Chất lượng AI",
    "/admin/reviews": "Đánh giá khách hàng",
}


def _resolve_page_title(path: str, given_title: str | None = None) -> str:
    if given_title and given_title.strip():
        return given_title.strip()
    clean_path = path.split("?")[0].rstrip("/")
    if not clean_path:
        clean_path = "/"
    return PAGE_TITLES_MAP.get(clean_path, f"Trang {clean_path}")


async def record_web_visit(
    session: AsyncSession,
    *,
    path: str,
    page_title: str | None = None,
    user_id: str | None = None,
    visitor_id: str,
    ip_address: str | None = None,
    user_agent: str | None = None,
    device_type: str = "desktop",
    referrer: str | None = None,
) -> WebVisit:
    """Ghi nhận một lượt xem trang của người dùng / khách ghé thăm."""
    clean_path = (path or "/").split("?")[0][:255]
    title = _resolve_page_title(clean_path, page_title)[:255]

    visit = WebVisit(
        path=clean_path,
        page_title=title,
        user_id=user_id,
        visitor_id=visitor_id[:64],
        ip_address=ip_address[:64] if ip_address else None,
        user_agent=user_agent[:500] if user_agent else None,
        device_type=device_type[:32] if device_type else "desktop",
        referrer=referrer[:500] if referrer else None,
    )
    session.add(visit)
    await session.commit()
    await session.refresh(visit)
    return visit


async def get_web_traffic_stats(
    session: AsyncSession,
    *,
    days: int = 14,
) -> WebTrafficStatsResponse:
    """Tổng hợp toàn bộ chỉ số lưu lượng truy cập trang web cho Admin."""

    now = datetime.utcnow()
    start_of_today = now.replace(hour=0, minute=0, second=0, microsecond=0)
    since_date = now - timedelta(days=days - 1)
    since_date = since_date.replace(hour=0, minute=0, second=0, microsecond=0)

    # 1. Tổng lượt xem toàn thời gian
    total_pageviews = (await session.execute(select(func.count(WebVisit.id)))).scalar() or 0

    # 2. Khách truy cập duy nhất toàn thời gian
    unique_visitors = (await session.execute(select(func.count(func.distinct(WebVisit.visitor_id))))).scalar() or 0

    # 3. Lượt xem hôm nay
    today_pageviews = (
        await session.execute(
            select(func.count(WebVisit.id)).where(WebVisit.created_at >= start_of_today)
        )
    ).scalar() or 0

    # 4. Khách duy nhất hôm nay
    today_unique_visitors = (
        await session.execute(
            select(func.count(func.distinct(WebVisit.visitor_id))).where(WebVisit.created_at >= start_of_today)
        )
    ).scalar() or 0

    # 5. Xu hướng theo ngày (Traffic Trend)
    visits_in_range_stmt = (
        select(WebVisit.created_at, WebVisit.visitor_id)
        .where(WebVisit.created_at >= since_date)
    )
    recent_visits = (await session.execute(visits_in_range_stmt)).all()

    day_views: dict[str, int] = Counter()
    day_visitors: dict[str, set[str]] = defaultdict(set)

    for created_at, v_id in recent_visits:
        date_key = created_at.strftime("%d/%m")
        day_views[date_key] += 1
        if v_id:
            day_visitors[date_key].add(v_id)

    traffic_trend: list[TrafficTrendPoint] = []
    for i in range(days):
        day = since_date + timedelta(days=i)
        date_key = day.strftime("%d/%m")
        traffic_trend.append(
            TrafficTrendPoint(
                label=date_key,
                pageviews=day_views.get(date_key, 0),
                unique_visitors=len(day_visitors.get(date_key, set())),
            )
        )

    # Trung bình lượt xem hàng ngày trong khoảng thời gian
    views_sum = sum(p.pageviews for p in traffic_trend)
    avg_daily_pageviews = round(views_sum / max(1, days)) if views_sum else 0

    # 6. Top trang được xem nhiều nhất
    top_pages_stmt = (
        select(WebVisit.path, WebVisit.page_title, func.count(WebVisit.id).label("cnt"))
        .group_by(WebVisit.path, WebVisit.page_title)
        .order_by(desc("cnt"))
        .limit(8)
    )
    top_page_rows = (await session.execute(top_pages_stmt)).all()

    top_pages: list[TopPageItem] = []
    for path, title, cnt in top_page_rows:
        pct = round((cnt / total_pageviews * 100), 1) if total_pageviews else 0.0
        top_pages.append(
            TopPageItem(
                path=path,
                page_title=title or _resolve_page_title(path),
                views_count=cnt,
                percent=pct,
            )
        )

    # 7. Phân bổ theo thiết bị
    device_stmt = (
        select(WebVisit.device_type, func.count(WebVisit.id).label("cnt"))
        .group_by(WebVisit.device_type)
        .order_by(desc("cnt"))
    )
    device_rows = (await session.execute(device_stmt)).all()

    device_labels = {
        "desktop": "Máy tính (Desktop)",
        "mobile": "Điện thoại (Mobile)",
        "tablet": "Máy tính bảng (Tablet)",
    }

    device_breakdown: list[DeviceBreakdownItem] = []
    for dev, cnt in device_rows:
        dev_key = (dev or "desktop").lower()
        pct = round((cnt / total_pageviews * 100), 1) if total_pageviews else 0.0
        device_breakdown.append(
            DeviceBreakdownItem(
                device=dev_key,
                label=device_labels.get(dev_key, dev_key.capitalize()),
                count=cnt,
                percent=pct,
            )
        )

    return WebTrafficStatsResponse(
        total_pageviews=total_pageviews,
        today_pageviews=today_pageviews,
        unique_visitors=unique_visitors,
        today_unique_visitors=today_unique_visitors,
        avg_daily_pageviews=avg_daily_pageviews,
        traffic_trend=traffic_trend,
        top_pages=top_pages,
        device_breakdown=device_breakdown,
    )
