from datetime import datetime

from pydantic import BaseModel


class FinanceOverview(BaseModel):
    """Tổng quan các chỉ số tài chính, doanh thu, chi phí và Unit Economics."""

    total_revenue_vnd: int
    paid_transactions_count: int
    total_transactions_count: int
    paid_users_count: int
    total_users_count: int
    conversion_rate_pct: float
    arpu_vnd: int

    # Chi phí & Unit Economics
    total_tokens_used: int
    ai_cost_vnd: int
    server_cost_vnd: int
    total_cost_vnd: int
    gross_profit_vnd: int
    net_margin_vnd: int
    gross_margin_pct: float
    break_even_subscriptions: int


class TransactionItem(BaseModel):
    """Chi tiết một giao dịch thanh toán."""

    id: str
    order_code: int
    amount: int
    currency: str = "VND"
    provider: str
    status: str
    plan_name: str
    user_id: str | None = None
    user_name: str = "Khách hàng ẩn danh"
    user_email: str = ""
    role_name: str = "Sinh viên"
    created_at: datetime
    paid_at: datetime | None = None


class RevenueByPlanItem(BaseModel):
    plan_name: str
    amount: int
    count: int


class RevenueByProviderItem(BaseModel):
    provider: str
    amount: int
    count: int


class FinanceReportResponse(BaseModel):
    """Toàn bộ báo cáo tài chính cho trang quản trị Admin."""

    overview: FinanceOverview
    revenue_by_plan: list[RevenueByPlanItem]
    revenue_by_provider: list[RevenueByProviderItem]
    transactions: list[TransactionItem]
