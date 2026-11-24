import { useState, useEffect, useMemo } from 'react'
import { getFinanceReport } from '../../../services/financeService.js'
import { notify as showToast } from '../../../components/common/toast.jsx'
import StatusBadge from '../components/StatusBadge.jsx'
import {
  DownloadIcon,
  SearchIcon,
  CopyIcon,
  TrendingUpIcon,
  CreditCardIcon,
  CheckCircleIcon,
  ClockIcon,
  AlertCircleIcon,
} from '../../../components/common/icons.jsx'
import './AdminFinancePage.css'

function formatVND(val) {
  if (val === undefined || val === null) return '0 ₫'
  return new Intl.NumberFormat('vi-VN').format(val) + ' ₫'
}

function formatDate(isoStr) {
  if (!isoStr) return '-'
  try {
    const d = new Date(isoStr)
    return d.toLocaleString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return isoStr
  }
}

export default function AdminFinancePage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState('all')
  const [search, setSearch] = useState('')

  const loadData = async () => {
    try {
      setLoading(true)
      const res = await getFinanceReport()
      setData(res)
    } catch (err) {
      console.error('Lỗi tải báo cáo tài chính:', err)
      showToast('Không thể tải báo cáo tài chính. Vui lòng thử lại!', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  // Lọc danh sách giao dịch
  const filteredTransactions = useMemo(() => {
    if (!data?.transactions) return []
    return data.transactions.filter((tx) => {
      // Lọc trạng thái
      if (filterStatus !== 'all' && tx.status !== filterStatus) return false

      // Tìm kiếm
      if (search.trim()) {
        const q = search.trim().toLowerCase()
        const orderStr = String(tx.order_code).toLowerCase()
        const nameStr = (tx.user_name || '').toLowerCase()
        const emailStr = (tx.user_email || '').toLowerCase()
        const planStr = (tx.plan_name || '').toLowerCase()
        return (
          orderStr.includes(q) ||
          nameStr.includes(q) ||
          emailStr.includes(q) ||
          planStr.includes(q)
        )
      }
      return true
    })
  }, [data?.transactions, filterStatus, search])

  // Xuất file CSV báo cáo tài chính chuẩn cho Excel (UTF-8 BOM)
  const handleExportCSV = () => {
    if (!data?.transactions || data.transactions.length === 0) {
      showToast('Chưa có dữ liệu giao dịch để xuất file.', 'warning')
      return
    }

    const headers = [
      'Mã đơn hàng',
      'Khách hàng',
      'Email',
      'Vai trò',
      'Gói cước',
      'Số tiền (VND)',
      'Cổng thanh toán',
      'Trạng thái',
      'Thời gian tạo',
      'Thời gian thanh toán',
    ]

    const rows = filteredTransactions.map((t) => [
      t.order_code,
      `"${t.user_name || ''}"`,
      t.user_email || '',
      t.role_name || '',
      `"${t.plan_name || ''}"`,
      t.amount,
      t.provider.toUpperCase(),
      t.status === 'paid' ? 'Đã thanh toán' : t.status === 'pending' ? 'Chờ thanh toán' : 'Thất bại',
      formatDate(t.created_at),
      formatDate(t.paid_at),
    ])

    const csvContent =
      '\uFEFF' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `Bao_cao_Doanh_thu_StudyMind_${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)

    showToast('Đã xuất file báo cáo tài chính CSV thành công!', 'success')
  }

  const copyOrderCode = (code) => {
    navigator.clipboard.writeText(String(code))
    showToast(`Đã sao chép mã đơn #${code}`, 'success')
  }

  if (loading && !data) {
    return (
      <div style={{ padding: '60px 20px', textAlign: 'center', fontWeight: 800 }}>
        ⏳ Đang tổng hợp dữ liệu doanh thu & chi phí hệ thống...
      </div>
    )
  }

  const overview = data?.overview || {
    total_revenue_vnd: 0,
    paid_transactions_count: 0,
    total_transactions_count: 0,
    paid_users_count: 0,
    total_users_count: 0,
    conversion_rate_pct: 0,
    arpu_vnd: 0,
    total_tokens_used: 0,
    ai_cost_vnd: 0,
    server_cost_vnd: 250000,
    total_cost_vnd: 250000,
    gross_profit_vnd: 0,
    gross_margin_pct: 0,
    break_even_subscriptions: 7,
  }

  const breakevenPercent = overview.server_cost_vnd > 0
    ? Math.min(100, Math.round((overview.total_revenue_vnd / overview.server_cost_vnd) * 100))
    : 100

  return (
    <div className="afp-container">
      {/* Page Header */}
      <div className="afp-header">
        <div className="afp-header-left">
          <div className="afp-header-icon">💵</div>
          <div>
            <h1 className="afp-title">Tài chính & Doanh thu</h1>
            <p className="afp-subtitle">
              Báo cáo dòng tiền thực tế, chi phí vận hành AI, hạ tầng đám mây và bảng cân đối Unit Economics.
            </p>
          </div>
        </div>

        <div className="afp-actions">
          <button
            type="button"
            className="afp-btn afp-btn--success"
            onClick={handleExportCSV}
            title="Tải bảng tính Excel CSV"
          >
            <DownloadIcon size={16} /> Xuất báo cáo CSV
          </button>
        </div>
      </div>

      {/* 4 Thẻ KPI Tài chính hàng đầu */}
      <div className="afp-kpi-grid">
        {/* Doanh thu */}
        <div className="afp-kpi-card" style={{ borderColor: '#000000' }}>
          <div className="afp-kpi-top">
            <span className="afp-kpi-label">Tổng doanh thu thực tế</span>
            <div className="afp-kpi-icon" style={{ backgroundColor: '#dcfce7' }}>
              💰
            </div>
          </div>
          <div className="afp-kpi-value" style={{ color: '#15803d' }}>
            {formatVND(overview.total_revenue_vnd)}
          </div>
          <div className="afp-kpi-sub">
            <CheckCircleIcon size={14} /> {overview.paid_transactions_count} đơn hàng đã thanh toán thành công
          </div>
        </div>

        {/* Chi phí */}
        <div className="afp-kpi-card">
          <div className="afp-kpi-top">
            <span className="afp-kpi-label">Chi phí vận hành & AI</span>
            <div className="afp-kpi-icon" style={{ backgroundColor: '#fee2e2' }}>
              📉
            </div>
          </div>
          <div className="afp-kpi-value" style={{ color: '#b91c1c' }}>
            {formatVND(overview.total_cost_vnd)}
          </div>
          <div className="afp-kpi-sub">
            AI: {formatVND(overview.ai_cost_vnd)} • Server: {formatVND(overview.server_cost_vnd)}/th
          </div>
        </div>

        {/* Lợi nhuận gộp */}
        <div className="afp-kpi-card">
          <div className="afp-kpi-top">
            <span className="afp-kpi-label">Lợi nhuận gộp dịch vụ</span>
            <div className="afp-kpi-icon" style={{ backgroundColor: '#fef08a' }}>
              🚀
            </div>
          </div>
          <div
            className="afp-kpi-value"
            style={{ color: overview.gross_profit_vnd >= 0 ? '#15803d' : '#b91c1c' }}
          >
            {formatVND(overview.gross_profit_vnd)}
          </div>
          <div className="afp-kpi-sub">
            <TrendingUpIcon size={14} /> Biên lợi nhuận gộp: {overview.gross_margin_pct}%
          </div>
        </div>

        {/* Chuyển đổi khách hàng */}
        <div className="afp-kpi-card">
          <div className="afp-kpi-top">
            <span className="afp-kpi-label">Khách trả phí & Chuyển đổi</span>
            <div className="afp-kpi-icon" style={{ backgroundColor: '#e0e7ff' }}>
              👥
            </div>
          </div>
          <div className="afp-kpi-value" style={{ color: '#3730a3' }}>
            {overview.paid_users_count} <span style={{ fontSize: '16px', color: '#64748b' }}>/ {overview.total_users_count} users</span>
          </div>
          <div className="afp-kpi-sub">
            Tỷ lệ chuyển đổi: {overview.conversion_rate_pct}% • ARPU: {formatVND(overview.arpu_vnd)}
          </div>
        </div>
      </div>

      {/* Middle: Unit Economics & Revenue Breakdown */}
      <div className="afp-mid-grid">
        {/* Phân tích Unit Economics cho Startup EXE201 */}
        <div className="afp-card">
          <h2 className="afp-card-title">
            <span>📊</span> Phân tích Unit Economics & Điểm hòa vốn (Break-even Analysis)
          </h2>

          <div className="afp-ue-boxes">
            <div className="afp-ue-box">
              <div className="afp-ue-box-label">Doanh thu TB / Khách (ARPU)</div>
              <div className="afp-ue-box-val">{formatVND(overview.arpu_vnd)}</div>
              <div className="afp-ue-box-note">Trung bình mỗi đơn trả phí</div>
            </div>

            <div className="afp-ue-box">
              <div className="afp-ue-box-label">Chi phí API AI / Người dùng</div>
              <div className="afp-ue-box-val">~{Math.round(overview.ai_cost_vnd / Math.max(1, overview.total_users_count))} ₫</div>
              <div className="afp-ue-box-note">Cực kỳ tối ưu nhờ kiến trúc RAG</div>
            </div>

            <div className="afp-ue-box">
              <div className="afp-ue-box-label">Token AI đã phục vụ</div>
              <div className="afp-ue-box-val">{overview.total_tokens_used.toLocaleString()}</div>
              <div className="afp-ue-box-note">Tổng token Gemini/OpenAI</div>
            </div>

            <div className="afp-ue-box">
              <div className="afp-ue-box-label">Mục tiêu hòa vốn máy chủ</div>
              <div className="afp-ue-box-val">{overview.break_even_subscriptions} gói Pro</div>
              <div className="afp-ue-box-note">Gói Pro Sinh viên (39k/tháng)</div>
            </div>
          </div>

          <div className="afp-breakeven-banner">
            <div>
              🎯 <strong>Đánh giá khả thi tài chính:</strong> Chi phí biến đổi của mô hình RAG chỉ chiếm chưa đến <strong>0.5%</strong> doanh thu gói cước. Hệ thống chỉ cần duy trì tối thiểu <strong>{overview.break_even_subscriptions} sinh viên</strong> mua gói Pro Sinh viên (39.000 ₫/tháng) là hoàn toàn tự trang trải chi phí máy chủ và bắt đầu tạo ra dòng tiền dương.
            </div>
            <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ flex: 1, height: '8px', backgroundColor: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ width: `${breakevenPercent}%`, height: '100%', backgroundColor: '#16a34a' }} />
              </div>
              <span style={{ fontSize: '11px', fontWeight: 800 }}>{breakevenPercent}% Điểm hòa vốn</span>
            </div>
          </div>
        </div>

        {/* Phân bổ theo Gói & Cổng */}
        <div className="afp-card">
          <h2 className="afp-card-title">
            <span>💳</span> Doanh thu theo Gói & Cổng thanh toán
          </h2>

          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: '#64748b', marginBottom: 8, textTransform: 'uppercase' }}>
              Theo Gói cước dịch vụ
            </div>
            <div className="afp-breakdown-row">
              {data?.revenue_by_plan && data.revenue_by_plan.length > 0 ? (
                data.revenue_by_plan.map((item) => (
                  <div key={item.plan_name} className="afp-breakdown-item">
                    <span className="afp-breakdown-name">{item.plan_name}</span>
                    <div className="afp-breakdown-meta">
                      <div className="afp-breakdown-amount">{formatVND(item.amount)}</div>
                      <div className="afp-breakdown-count">{item.count} lượt đăng ký</div>
                    </div>
                  </div>
                ))
              ) : (
                <div style={{ fontSize: 13, color: '#94a3b8' }}>Chưa có phát sinh</div>
              )}
            </div>
          </div>

          <div>
            <div style={{ fontSize: 12, fontWeight: 800, color: '#64748b', marginBottom: 8, textTransform: 'uppercase' }}>
              Theo Cổng thanh toán
            </div>
            <div className="afp-breakdown-row">
              {data?.revenue_by_provider && data.revenue_by_provider.length > 0 ? (
                data.revenue_by_provider.map((p) => (
                  <div key={p.provider} className="afp-breakdown-item">
                    <span className="afp-breakdown-name">
                      {p.provider === 'PAYOS' ? '⚡ Chuyển khoản VietQR (PayOS)' : '💳 Cổng thanh toán VNPay'}
                    </span>
                    <div className="afp-breakdown-meta">
                      <div className="afp-breakdown-amount">{formatVND(p.amount)}</div>
                      <div className="afp-breakdown-count">{p.count} giao dịch</div>
                    </div>
                  </div>
                ))
              ) : (
                <div style={{ fontSize: 13, color: '#94a3b8' }}>Chưa có phát sinh</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Sổ cái Giao dịch Thanh toán */}
      <div className="afp-ledger-card">
        <div className="afp-ledger-header">
          <div className="afp-filter-pills">
            <button
              type="button"
              className={`afp-pill ${filterStatus === 'all' ? 'is-active' : ''}`}
              onClick={() => setFilterStatus('all')}
            >
              Tất cả ({data?.transactions?.length || 0})
            </button>
            <button
              type="button"
              className={`afp-pill ${filterStatus === 'paid' ? 'is-active' : ''}`}
              onClick={() => setFilterStatus('paid')}
            >
              Đã thanh toán ({overview.paid_transactions_count})
            </button>
            <button
              type="button"
              className={`afp-pill ${filterStatus === 'pending' ? 'is-active' : ''}`}
              onClick={() => setFilterStatus('pending')}
            >
              Chờ thanh toán ({overview.total_transactions_count - overview.paid_transactions_count})
            </button>
            <button
              type="button"
              className={`afp-pill ${filterStatus === 'failed' ? 'is-active' : ''}`}
              onClick={() => setFilterStatus('failed')}
            >
              Thất bại (0)
            </button>
          </div>

          <div className="afp-search-box">
            <SearchIcon size={16} />
            <input
              type="text"
              className="afp-search-input"
              placeholder="Tìm mã đơn, tên khách, email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Data Table */}
        <div className="afp-table-wrapper">
          <table className="afp-table">
            <thead>
              <tr>
                <th>Mã đơn hàng</th>
                <th>Khách hàng</th>
                <th>Gói dịch vụ</th>
                <th>Số tiền</th>
                <th>Cổng</th>
                <th>Trạng thái</th>
                <th>Thời gian</th>
              </tr>
            </thead>
            <tbody>
              {filteredTransactions.length > 0 ? (
                filteredTransactions.map((tx) => (
                  <tr key={tx.id || tx.order_code}>
                    <td>
                      <span
                        className="afp-order-code"
                        onClick={() => copyOrderCode(tx.order_code)}
                        title="Bấm để sao chép"
                        style={{ cursor: 'pointer' }}
                      >
                        #{tx.order_code} <CopyIcon size={12} />
                      </span>
                    </td>

                    <td>
                      <div className="afp-user-cell">
                        <div className="afp-avatar">
                          {(tx.user_name || 'U').charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="afp-user-name">{tx.user_name}</div>
                          <div className="afp-user-email">{tx.user_email || 'Chưa cung cấp'}</div>
                          <span className="afp-role-tag">{tx.role_name}</span>
                        </div>
                      </div>
                    </td>

                    <td>
                      <span style={{ fontWeight: 800, color: '#1e293b' }}>{tx.plan_name}</span>
                    </td>

                    <td>
                      <span
                        style={{
                          fontWeight: 900,
                          fontSize: '14px',
                          color: tx.status === 'paid' ? '#15803d' : '#0f172a',
                        }}
                      >
                        {formatVND(tx.amount)}
                      </span>
                    </td>

                    <td>
                      <span className={`afp-provider-badge ${tx.provider?.toLowerCase()}`}>
                        {tx.provider?.toUpperCase() === 'PAYOS' ? '⚡ PayOS' : '💳 VNPay'}
                      </span>
                    </td>

                    <td>
                      {tx.status === 'paid' ? (
                        <StatusBadge variant="success" dot>
                          Đã thanh toán
                        </StatusBadge>
                      ) : tx.status === 'pending' ? (
                        <StatusBadge variant="warning" dot>
                          Chờ xử lý
                        </StatusBadge>
                      ) : (
                        <StatusBadge variant="danger" dot>
                          Thất bại
                        </StatusBadge>
                      )}
                    </td>

                    <td style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>
                      {tx.status === 'paid' && tx.paid_at ? (
                        <span title="Thời gian thanh toán">
                          {formatDate(tx.paid_at)}
                        </span>
                      ) : (
                        <span title="Thời gian tạo đơn">
                          {formatDate(tx.created_at)}
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="afp-empty-state">
                    Không tìm thấy giao dịch nào phù hợp với bộ lọc hiện tại.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
