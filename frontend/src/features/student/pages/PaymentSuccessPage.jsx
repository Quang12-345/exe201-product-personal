import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { getPaymentReceipt, getBillingStatus } from '../services/billingService'

export default function PaymentSuccessPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const orderCodeParam = searchParams.get('order_code') || searchParams.get('orderCode')
  const returnTo = searchParams.get('return_to') || '/student/chat'

  const [loading, setLoading] = useState(true)
  const [receipt, setReceipt] = useState(null)
  const [error, setError] = useState('')
  const [countdown, setCountdown] = useState(10)
  const [pausedCountdown, setPausedCountdown] = useState(false)

  const fetchReceipt = async () => {
    if (!orderCodeParam) {
      setLoading(false)
      setError('Không tìm thấy mã đơn hàng để đối soát.')
      return
    }

    setLoading(true)
    setError('')
    try {
      const data = await getPaymentReceipt(orderCodeParam)
      setReceipt(data)
      // Cập nhật trạng thái billing trong bộ nhớ
      getBillingStatus().catch(() => {})
    } catch (err) {
      const msg = err?.response?.data?.detail || err?.message || 'Không thể lấy thông tin hóa đơn.'
      setError(typeof msg === 'string' ? msg : 'Lỗi kiểm tra biên lai thanh toán.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchReceipt()
  }, [orderCodeParam])

  // Đếm ngược tự động chuyển về trang học tập
  useEffect(() => {
    if (loading || error || pausedCountdown) return undefined
    if (countdown <= 0) {
      navigate(returnTo)
      return undefined
    }

    const timer = setInterval(() => {
      setCountdown((prev) => prev - 1)
    }, 1000)

    return () => clearInterval(timer)
  }, [countdown, loading, error, pausedCountdown, navigate, returnTo])

  const formatCurrency = (val) => {
    if (!val && val !== 0) return '99.000 đ'
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val)
  }

  return (
    <div className="st-payment-page-container">
      <div className="st-payment-card">
        {/* Header thành công */}
        <div className="st-payment-header">
          <div className="st-payment-icon-wrapper">
            <svg className="st-payment-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          </div>
          <span className="st-payment-badge">Giao dịch thành công</span>
          <h1 className="st-payment-title">Thanh Toán Thành Công!</h1>
          <p className="st-payment-subtitle">
            Gói Pro đã được kích hoạt thành công trên tài khoản của bạn.
          </p>
        </div>

        {/* Số tiền lớn nổi bật */}
        <div className="st-payment-amount-box">
          <span className="st-amount-label">Số tiền đã thanh toán</span>
          <div className="st-amount-value">
            {formatCurrency(receipt?.amount || 99000)}
          </div>
          <span className="st-amount-status">ĐÃ CHUYỂN KHOẢN VÀO TÀI KHOẢN</span>
        </div>

        {/* Thông tin hóa đơn chuyển khoản như app ngân hàng */}
        <div className="st-receipt-details">
          <div className="st-receipt-section-title">
            <span>Thông tin giao dịch ngân hàng</span>
          </div>

          <div className="st-receipt-row">
            <span className="st-receipt-label">Đơn vị nhận</span>
            <span className="st-receipt-value is-highlight">
              {receipt?.recipient_name || 'STUDYMIND - Nền Tảng Học Tập AI'}
            </span>
          </div>

          <div className="st-receipt-row">
            <span className="st-receipt-label">Gói dịch vụ</span>
            <span className="st-receipt-value is-bold">
              {receipt?.plan_name || 'Gói Pro Sinh Viên (30 ngày)'}
            </span>
          </div>

          <div className="st-receipt-row">
            <span className="st-receipt-label">Thời gian thanh toán</span>
            <span className="st-receipt-value">
              {receipt?.transaction_time || new Date().toLocaleString('vi-VN')}
            </span>
          </div>

          <div className="st-receipt-row">
            <span className="st-receipt-label">Mã đơn hàng</span>
            <span className="st-receipt-value font-mono">
              #{receipt?.order_code || orderCodeParam || '---'}
            </span>
          </div>

          {receipt?.transaction_ref && (
            <div className="st-receipt-row">
              <span className="st-receipt-label">Mã tham chiếu ngân hàng</span>
              <span className="st-receipt-value font-mono">
                {receipt.transaction_ref}
              </span>
            </div>
          )}

          <div className="st-receipt-row">
            <span className="st-receipt-label">Hình thức thanh toán</span>
            <span className="st-receipt-value">
              Chuyển khoản VietQR (PayOS)
            </span>
          </div>

          <div className="st-receipt-row">
            <span className="st-receipt-label">Trạng thái</span>
            <span className="st-receipt-value is-success-tag">
              ✓ Thành công · Gói Pro kích hoạt
            </span>
          </div>
        </div>

        {/* Quyền lợi Gói Pro */}
        <div className="st-pro-perks-box">
          <div className="st-perks-title">Quyền lợi Gói Pro sẵn sàng cho bạn:</div>
          <ul className="st-perks-list">
            <li>
              <span className="st-perk-bullet">⚡</span>
              <span><strong>Không giới hạn Tokens:</strong> Thỏa sức hỏi đáp AI chuyên sâu mỗi ngày.</span>
            </li>
            <li>
              <span className="st-perk-bullet">📚</span>
              <span><strong>Tài liệu học tập:</strong> Phân tích tài liệu PDF, DOCX dung lượng lớn.</span>
            </li>
            <li>
              <span className="st-perk-bullet">🎯</span>
              <span><strong>Ôn thi thông minh:</strong> Tự động sinh đề thi, trắc nghiệm và lộ trình cá nhân.</span>
            </li>
          </ul>
        </div>

        {/* Thông báo lỗi nếu có */}
        {error && (
          <div className="st-payment-error-alert" role="alert">
            <p>{error}</p>
            <button type="button" onClick={fetchReceipt} className="st-btn-retry">
              Thử kiểm tra lại
            </button>
          </div>
        )}

        {/* Các nút điều hướng */}
        <div className="st-payment-actions">
          <button
            type="button"
            className="st-btn-primary-glow"
            onClick={() => navigate(returnTo)}
          >
            <span>Quay về trang web để sử dụng Gói Pro</span>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </button>

          <button
            type="button"
            className="st-btn-secondary"
            onClick={() => navigate('/student')}
          >
            Về Bảng Điều Khiển Học Tập
          </button>
        </div>

        {/* Đồng hồ đếm ngược */}
        {!error && !loading && (
          <div className="st-payment-countdown">
            {pausedCountdown ? (
              <span>Đã tạm dừng tự động chuyển trang.</span>
            ) : (
              <span>
                Tự động quay về trang học tập sau <strong>{countdown}s</strong>...{' '}
                <button
                  type="button"
                  className="st-btn-pause"
                  onClick={() => setPausedCountdown(true)}
                >
                  (Tạm dừng)
                </button>
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
