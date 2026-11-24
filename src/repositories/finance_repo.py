"""Repository truy vấn dữ liệu tài chính, doanh thu giao dịch và tính toán chi phí vận hành (Unit Economics)."""

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import DailyChatUsage, PaymentTransaction, Role, User
from src.models.finance import (
    FinanceOverview,
    FinanceReportResponse,
    RevenueByPlanItem,
    RevenueByProviderItem,
    TransactionItem,
)

# Đơn giá API LLM ước tính (Google Gemini 1.5 Flash / OpenAI GPT-4o-mini blended)
# ~0.15 USD / 1,000,000 tokens * 25,400 VND = ~3.81 VND / 1,000 tokens
AI_TOKEN_PRICE_VND_PER_TOKEN = 0.00381

# Chi phí máy chủ / hosting hạ tầng cố định ước tính hàng tháng (VPS, PostgreSQL, Qdrant Vector Store)
MONTHLY_SERVER_COST_VND = 250_000

# Đơn giá gói Pro sinh viên chuẩn
STUDENT_PRO_PRICE_VND = 39_000


def _get_plan_display_name(amount: int) -> str:
    if amount == 39_000:
        return "Gói Pro Sinh Viên (30 ngày)"
    if amount == 129_000:
        return "Gói Pro Giảng Viên (30 ngày)"
    if amount == 99_000:
        return "Gói Pro Khuyến Mãi (30 ngày)"
    return f"Gói dịch vụ ({amount:,} ₫)"


async def get_finance_report(session: AsyncSession) -> FinanceReportResponse:
    """Tổng hợp toàn bộ báo cáo doanh thu, chi phí và danh sách giao dịch cho Admin."""

    # 1. Tải danh mục vai trò để map role name an toàn (tránh lazy load greenlet)
    roles = (await session.execute(select(Role))).scalars().all()
    roles_map = {r.id: r.name for r in roles}

    # 2. Lấy toàn bộ giao dịch thanh toán kèm thông tin người dùng
    stmt = (
        select(PaymentTransaction, User)
        .outerjoin(User, PaymentTransaction.user_id == User.id)
        .order_by(PaymentTransaction.created_at.desc())
    )
    rows = (await session.execute(stmt)).all()

    tx_items: list[TransactionItem] = []
    paid_txs: list[PaymentTransaction] = []
    plan_stats: dict[str, dict[str, int]] = {}
    provider_stats: dict[str, dict[str, int]] = {}

    for p, u in rows:
        plan_name = _get_plan_display_name(p.amount)

        user_name = "Khách hàng ẩn danh"
        user_email = ""
        role_label = "Sinh viên"

        if u:
            user_name = u.full_name or u.email.split("@")[0]
            user_email = u.email or ""
            role_name = roles_map.get(u.role_id, "student")
            if role_name == "lecturer":
                role_label = "Giảng viên"
            elif role_name == "admin":
                role_label = "Quản trị viên"
            else:
                role_label = "Sinh viên"

        item = TransactionItem(
            id=p.id,
            order_code=p.order_code,
            amount=p.amount,
            currency=p.currency or "VND",
            provider=p.provider or "payos",
            status=p.status or "pending",
            plan_name=plan_name,
            user_id=p.user_id,
            user_name=user_name,
            user_email=user_email,
            role_name=role_label,
            created_at=p.created_at,
            paid_at=p.paid_at,
        )
        tx_items.append(item)

        if p.status == "paid":
            paid_txs.append(p)

            # Thống kê theo gói
            if plan_name not in plan_stats:
                plan_stats[plan_name] = {"amount": 0, "count": 0}
            plan_stats[plan_name]["amount"] += p.amount
            plan_stats[plan_name]["count"] += 1

            # Thống kê theo cổng
            provider_key = (p.provider or "payos").lower()
            if provider_key not in provider_stats:
                provider_stats[provider_key] = {"amount": 0, "count": 0}
            provider_stats[provider_key]["amount"] += p.amount
            provider_stats[provider_key]["count"] += 1

    total_revenue = sum(p.amount for p in paid_txs)
    total_tx_count = len(rows)
    paid_tx_count = len(paid_txs)

    # 3. Thống kê người dùng
    total_users_count = (await session.execute(select(func.count(User.id)))).scalar() or 0
    paid_users = {p.user_id for p in paid_txs if p.user_id}
    paid_users_count = len(paid_users)
    conversion_rate = round((paid_users_count / total_users_count * 100), 1) if total_users_count else 0.0
    arpu = round(total_revenue / paid_users_count) if paid_users_count else 0

    # 4. Tính toán Chi phí & Unit Economics
    total_tokens = (await session.execute(select(func.sum(DailyChatUsage.tokens_used)))).scalar() or 0
    ai_cost_vnd = max(round(total_tokens * AI_TOKEN_PRICE_VND_PER_TOKEN), 1000) if total_tokens else 0
    server_cost_vnd = MONTHLY_SERVER_COST_VND
    total_cost_vnd = ai_cost_vnd + server_cost_vnd
    gross_profit_vnd = total_revenue - ai_cost_vnd
    net_margin_vnd = total_revenue - total_cost_vnd
    gross_margin_pct = round((gross_profit_vnd / total_revenue * 100), 1) if total_revenue else 0.0
    break_even_subs = max(1, round(server_cost_vnd / STUDENT_PRO_PRICE_VND))

    overview = FinanceOverview(
        total_revenue_vnd=total_revenue,
        paid_transactions_count=paid_tx_count,
        total_transactions_count=total_tx_count,
        paid_users_count=paid_users_count,
        total_users_count=total_users_count,
        conversion_rate_pct=conversion_rate,
        arpu_vnd=arpu,
        total_tokens_used=total_tokens,
        ai_cost_vnd=ai_cost_vnd,
        server_cost_vnd=server_cost_vnd,
        total_cost_vnd=total_cost_vnd,
        gross_profit_vnd=gross_profit_vnd,
        net_margin_vnd=net_margin_vnd,
        gross_margin_pct=gross_margin_pct,
        break_even_subscriptions=break_even_subs,
    )

    revenue_by_plan = [
        RevenueByPlanItem(plan_name=k, amount=v["amount"], count=v["count"])
        for k, v in plan_stats.items()
    ]
    revenue_by_provider = [
        RevenueByProviderItem(provider=k.upper(), amount=v["amount"], count=v["count"])
        for k, v in provider_stats.items()
    ]

    return FinanceReportResponse(
        overview=overview,
        revenue_by_plan=revenue_by_plan,
        revenue_by_provider=revenue_by_provider,
        transactions=tx_items,
    )
