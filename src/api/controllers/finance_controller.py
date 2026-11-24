"""Controller xử lý báo cáo tài chính, doanh thu và chi phí cho Admin."""

from sqlalchemy.ext.asyncio import AsyncSession

from src.models.finance import FinanceReportResponse
from src.repositories import finance_repo


async def get_finance_report_controller(session: AsyncSession) -> FinanceReportResponse:
    """Trả về báo cáo tài chính, tổng doanh thu, phân tích chi phí và danh sách giao dịch."""
    return await finance_repo.get_finance_report(session)
