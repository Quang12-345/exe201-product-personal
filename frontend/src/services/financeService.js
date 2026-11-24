import api from './api.js'

/**
 * Lấy toàn bộ báo cáo tài chính, doanh thu, chi phí và lịch sử giao dịch thanh toán cho Admin.
 */
export async function getFinanceReport() {
  const res = await api.get('/api/v1/admin/finance/overview')
  return res.data
}
