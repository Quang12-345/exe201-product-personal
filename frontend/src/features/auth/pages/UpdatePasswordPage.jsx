import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { updateUserPassword } from '../services/authService'
import { DatabaseIcon } from '../../../components/common/icons.jsx'
import './ForgotPassword.css'

const errStyle = { color: '#dc2626', fontSize: 13, margin: '8px 0 0' }

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

function getUserId(user) {
  return user?.id || user?.userId || user?.userID || user?._id
}

function UpdatePasswordPage() {
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const userId = getUserId(user)
  const [pwd, setPwd] = useState({ next: '', confirm: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    if (!userId) {
      navigate('/login', { replace: true })
    }
  }, [navigate, userId])

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (pwd.next.length < 8) {
      setError('Mật khẩu mới tối thiểu 8 ký tự')
      return
    }
    if (pwd.next !== pwd.confirm) {
      setError('Mật khẩu xác nhận không khớp')
      return
    }

    setLoading(true)
    try {
      await updateUserPassword(userId, pwd.next)
      setSuccess('Cập nhật mật khẩu thành công. Đang chuyển về trang đăng nhập...')
      window.setTimeout(() => {
        logout()
        navigate('/login', {
          replace: true,
          state: { successMessage: 'Cập nhật mật khẩu thành công. Vui lòng đăng nhập lại.' },
        })
      }, 900)
    } catch (e) {
      setError(e.message || 'Đã có lỗi, vui lòng thử lại')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fp-page">
      <div className="fp-card">
        <div className="fp-visual"><HexCluster /></div>

        <div className="fp-form-wrap">
          <div className="fp-brand"><DatabaseIcon size={24} /> StudyMind</div>
          <h1 className="fp-title">Cập nhật mật khẩu</h1>
          <p className="fp-desc">Tạo mật khẩu đăng nhập cho tài khoản <strong>{user?.email}</strong>.</p>

          <form onSubmit={submit}>
            <div className="fp-field">
              <label htmlFor="up-new">Mật khẩu mới</label>
              <input
                id="up-new"
                type="password"
                value={pwd.next}
                onChange={(e) => setPwd((p) => ({ ...p, next: e.target.value }))}
                required
                autoFocus
                autoComplete="new-password"
              />
            </div>
            <div className="fp-field">
              <label htmlFor="up-confirm">Xác nhận mật khẩu</label>
              <input
                id="up-confirm"
                type="password"
                value={pwd.confirm}
                onChange={(e) => setPwd((p) => ({ ...p, confirm: e.target.value }))}
                required
                autoComplete="new-password"
              />
            </div>
            {error && <p style={errStyle}>{error}</p>}
            {success && <div className="fp-success">{success}</div>}
            <button type="submit" className="fp-btn" disabled={loading || Boolean(success)}>
              {loading ? 'Đang lưu...' : 'Cập nhật mật khẩu'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

export default UpdatePasswordPage
