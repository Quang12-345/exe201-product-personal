from pydantic import BaseModel, Field


class RecordVisitRequest(BaseModel):
    """Yêu cầu ghi nhận lượt xem trang từ người dùng / sinh viên."""

    path: str = Field(..., max_length=255, description="Đường dẫn trang web (VD: /student, /login)")
    page_title: str = Field(default="", max_length=255, description="Tiêu đề trang (VD: Sổ tay AI, Trang chủ)")
    visitor_id: str = Field(..., max_length=64, description="Mã định danh trình duyệt khách ẩn danh")
    device_type: str = Field(default="desktop", max_length=32, description="desktop | mobile | tablet")
    referrer: str | None = Field(default=None, max_length=500)


class RecordVisitResponse(BaseModel):
    ok: bool = True


class TrafficTrendPoint(BaseModel):
    """Số liệu lượt xem trang và số khách theo từng ngày."""

    label: str
    pageviews: int
    unique_visitors: int


class TopPageItem(BaseModel):
    """Trang được người dùng truy cập nhiều nhất."""

    path: str
    page_title: str
    views_count: int
    percent: float


class DeviceBreakdownItem(BaseModel):
    """Phân bổ truy cập theo thiết bị (Desktop, Mobile, Tablet)."""

    device: str
    label: str
    count: int
    percent: float


class WebTrafficStatsResponse(BaseModel):
    """Toàn bộ báo cáo thống kê lượt truy cập website cho trang Admin."""

    total_pageviews: int
    today_pageviews: int
    unique_visitors: int
    today_unique_visitors: int
    avg_daily_pageviews: int
    traffic_trend: list[TrafficTrendPoint]
    top_pages: list[TopPageItem]
    device_breakdown: list[DeviceBreakdownItem]
