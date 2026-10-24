import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { requestPasswordReset, verifyOtp, resetPassword } from '../services/authService'
import { DatabaseIcon } from '../../../components/common/icons.jsx'
import './ForgotPassword.css'

// Cụm hexagon trang trí cho cột ảnh.
function HexCluster() {
  const hex = 'M30 2 56 16 56 44 30 58 4 44 4 16Z'
  const cells = [
    [0, 0], [60, 0], [120, 0],
    [30, 50], [90, 50],
    [0, 100], [60, 100], [120, 100],
  ]
  return (
    <svg className="fp-hex" width="220" height="180" viewBox="0 0 240 180" fill="none">
      {cells.map(([x, y], i) => (
        <path key={i} d={hex} transform={`translate(${x} ${y})`} fill="currentColor" opacity={0.12 + (i % 4) * 0.06} />
      ))}
    </svg>
  )
}

const errStyle = { color: '#dc2626', fontSize: 13, margin: '8px 0 0' }

// Quên mật khẩu: email -> OTP (mã gửi qua email) -> đặt lại mật khẩu mới.
function ForgotPasswordPage() {
  const navigate = useNavigate()
  const location = useLocation()
  // Khi đến từ trang đăng nhập với tài khoản chờ kích hoạt: điền sẵn email + đổi nội dung.
  const activation = Boolean(location.state?.activation)
  const [step, setStep] = useState('email') // email | otp | reset | done
  const [email, setEmail] = useState(location.state?.email || '')
  const [otp, setOtp] = useState('')
  const [pwd, setPwd] = useState({ next: '', confirm: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const run = async (fn) => {
    setLoading(true)
    setError('')
    try {
      await fn()
    } catch (e) {
      setError(e.message || 'Đã có lỗi, vui lòng thử lại')
    } finally {
      setLoading(false)
    }
  }

  const submitEmail = (e) => {
    e.preventDefault()
    run(async () => { await requestPasswordReset(email.trim()); setStep('otp') })
  }

  const submitOtp = (e) => {
    e.preventDefault()
    if (otp.trim().length !== 6) { setError('Mã OTP gồm 6 chữ số'); return }
    run(async () => { await verifyOtp(email.trim(), otp.trim()); setStep('reset') })
  }

  const submitReset = (e) => {
    e.preventDefault()
    if (pwd.next.length < 8) { setError('Mật khẩu mới tối thiểu 8 ký tự'); return }
    if (pwd.next !== pwd.confirm) { setError('Mật khẩu xác nhận không khớp'); return }
    run(async () => { await resetPassword(email.trim(), otp.trim(), pwd.next); setStep('done') })
  }

  const resend = () => run(async () => { await requestPasswordReset(email.trim()); setOtp('') })

  return (
    <div className="fp-page">
      <div className="fp-card">
        <div className="fp-visual"><HexCluster /></div>

        <div className="fp-form-wrap">
          <div className="fp-brand"><DatabaseIcon size={24} /> StudyMind</div>

          {step === 'email' && (
            <>
              <h1 className="fp-title">{activation ? 'Kích hoạt tài khoản' : 'Quên mật khẩu?'}</h1>
              <p className="fp-desc">{activation
                ? 'Tài khoản của bạn đã được tạo và đang chờ kích hoạt. Nhập email để nhận mã OTP và đặt mật khẩu đăng nhập.'
                : 'Nhập email đã đăng ký. Chúng tôi sẽ gửi mã xác minh (OTP) 6 số tới email của bạn.'}</p>
              <form onSubmit={submitEmail}>
                <div className="fp-field">
                  <label htmlFor="fp-email">Địa chỉ Email</label>
                  <input id="fp-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                    placeholder="nguoidung@ai20k.vn" required autoFocus />
                </div>
                {error && <p style={errStyle}>{error}</p>}
                <button type="submit" className="fp-btn" disabled={loading}>{loading ? 'Đang gửi...' : 'Gửi mã OTP'}</button>
              </form>
            </>
          )}

          {step === 'otp' && (
            <>
              <h1 className="fp-title">Nhập mã xác minh</h1>
              <p className="fp-desc">Mã OTP 6 số đã được gửi tới <strong>{email}</strong>. Mã có hiệu lực trong 5 phút.</p>
              <form onSubmit={submitOtp}>
                <div className="fp-field">
                  <label htmlFor="fp-otp">Mã OTP</label>
                  <input id="fp-otp" inputMode="numeric" maxLength={6} value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                    placeholder="------" required autoFocus
                    style={{ letterSpacing: '8px', textAlign: 'center', fontSize: 20 }} />
                </div>
                {error && <p style={errStyle}>{error}</p>}
                <button type="submit" className="fp-btn" disabled={loading}>{loading ? 'Đang kiểm tra...' : 'Xác minh'}</button>
              </form>
              <button type="button" className="fp-back" onClick={resend} disabled={loading}
                style={{ background: 'none', border: 'none', cursor: 'pointer' }}>Gửi lại mã</button>
            </>
          )}

          {step === 'reset' && (
            <>
              <h1 className="fp-title">{activation ? 'Đặt mật khẩu' : 'Đặt lại mật khẩu'}</h1>
              <p className="fp-desc">Tạo mật khẩu {activation ? '' : 'mới '}(tối thiểu 8 ký tự) cho tài khoản <strong>{email}</strong>.</p>
              <form onSubmit={submitReset}>
                <div className="fp-field">
                  <label htmlFor="fp-new">Mật khẩu mới</label>
                  <input id="fp-new" type="password" value={pwd.next}
                    onChange={(e) => setPwd((p) => ({ ...p, next: e.target.value }))} required autoFocus />
                </div>
                <div className="fp-field">
                  <label htmlFor="fp-confirm">Xác nhận mật khẩu</label>
                  <input id="fp-confirm" type="password" value={pwd.confirm}
                    onChange={(e) => setPwd((p) => ({ ...p, confirm: e.target.value }))} required />
                </div>
                {error && <p style={errStyle}>{error}</p>}
                <button type="submit" className="fp-btn" disabled={loading}>{loading ? 'Đang lưu...' : 'Đặt lại mật khẩu'}</button>
              </form>
            </>
          )}

          {step === 'done' && (
            <>
              <h1 className="fp-title">Thành công!</h1>
              <div className="fp-success">{activation
                ? 'Tài khoản đã được kích hoạt. Bạn có thể đăng nhập bằng mật khẩu vừa đặt.'
                : 'Mật khẩu đã được đặt lại. Bạn có thể đăng nhập bằng mật khẩu mới.'}</div>
              <button type="button" className="fp-btn" onClick={() => navigate('/login')} style={{ marginTop: 16 }}>
                Đăng nhập ngay
              </button>
            </>
          )}

          <Link className="fp-back" to="/login">← Quay lại trang đăng nhập</Link>
        </div>
      </div>
    </div>
  )
}

export default ForgotPasswordPage
