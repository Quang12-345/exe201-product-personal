import { useNavigate, useSearchParams } from 'react-router-dom'

export default function PaymentCancelPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const returnTo = searchParams.get('return_to') || '/student/chat'

  return (
    <div className="st-payment-page-container">
      <div className="st-payment-card is-cancel">
        <div className="st-payment-header">
          <div className="st-payment-icon-wrapper is-warning">
            <svg className="st-payment-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <span className="st-payment-badge is-warning">Giao dịch đã hủy</span>
          <h1 className="st-payment-title">Thanh Toán Chưa Hoàn Tất</h1>
          <p className="st-payment-subtitle">
            Bạn đã hủy giao dịch hoặc phiên chuyển khoản đã kết thúc. Tài khoản chưa được trừ tiền.
          </p>
        </div>

        <div className="st-payment-actions">
          <button
            type="button"
            className="st-btn-primary-glow"
            onClick={() => navigate(returnTo)}
          >
            Thử nâng cấp Gói Pro lại
          </button>

          <button
            type="button"
            className="st-btn-secondary"
            onClick={() => navigate('/student')}
          >
            Quay về Bảng Điều Khiển
          </button>
        </div>
      </div>
    </div>
  )
}
