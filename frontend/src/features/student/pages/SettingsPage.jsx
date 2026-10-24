import { useState } from 'react'
import { useAuth } from '../../auth/context/AuthContext.jsx'
import { changeMyPassword } from '../../auth/services/profileService.js'
import { CameraIcon, UserIcon, LockIcon, ChevronRightIcon } from '../../../components/common/icons.jsx'
import { comingSoon } from '../../../components/common/comingSoon.jsx'
import { notify as showToast } from '../../../components/common/toast.jsx'

const NAV = [
  { key: 'profile', label: 'Thông tin cá nhân', icon: UserIcon },
  { key: 'security', label: 'Bảo mật & Mật khẩu', icon: LockIcon },
]

const PASSWORD_GUIDE = 'Mật khẩu mới phải có ít nhất 6 ký tự, gồm chữ hoa, số và ký tự đặc biệt.'
const STRONG_PASSWORD_RE = /^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{6,}$/

function initials(name = '') {
  return name.split(' ').slice(-2).map((w) => w[0]).join('').toUpperCase()
}

function profileFromUser(user) {
  return {
    name: user?.name || '',
    email: user?.email || '',
  }
}

function SettingsPage() {
  const { user } = useAuth()
  const [active, setActive] = useState('profile')
  const profile = profileFromUser(user)
  const [pwd, setPwd] = useState({ current: '', next: '', confirm: '' })
  const [pwdSaving, setPwdSaving] = useState(false)

  const changePwdField = (e) => setPwd((c) => ({ ...c, [e.target.name]: e.target.value }))

  const submitPassword = async () => {
    if (!pwd.current || !pwd.next) {
      showToast('Vui lòng nhập đủ mật khẩu hiện tại và mật khẩu mới.')
      return
    }
    if (!STRONG_PASSWORD_RE.test(pwd.next)) {
      showToast(PASSWORD_GUIDE, 'error')
      return
    }
    if (pwd.next !== pwd.confirm) {
      showToast('Xác nhận mật khẩu mới không khớp.')
      return
    }

    setPwdSaving(true)
    try {
      await changeMyPassword({ currentPassword: pwd.current, newPassword: pwd.next })
      setPwd({ current: '', next: '', confirm: '' })
      showToast('Đã đổi mật khẩu thành công.')
    } catch (err) {
      const detail = err?.response?.data?.detail
      showToast(typeof detail === 'string' ? detail : 'Đổi mật khẩu thất bại. Vui lòng thử lại.')
    } finally {
      setPwdSaving(false)
    }
  }

  return (
    <div className="st-wrap">
      <h1 className="st-title st-title--primary">Cài đặt hệ thống</h1>

      <div className="st-settings-grid">
        <div className="st-settings-aside">
          <div className="st-card st-profile-card">
            <div className="st-profile-avatar">
              <span className="st-avatar-lg">{initials(user?.name)}</span>
              <button className="st-cam-btn" aria-label="Đổi ảnh" onClick={() => comingSoon('Đổi ảnh đại diện đang được phát triển')}>
                <CameraIcon size={16} />
              </button>
            </div>
            <strong className="st-profile-name">{user?.name}</strong>
            <span className="st-muted">Khoa {user?.faculty}</span>
          </div>

          <div className="st-card st-settings-nav">
            {NAV.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                className={'st-settings-nav-item' + (active === key ? ' is-active' : '')}
                onClick={() => setActive(key)}
              >
                <span className="st-settings-nav-left"><Icon size={18} /> {label}</span>
                <ChevronRightIcon size={16} />
              </button>
            ))}
          </div>
        </div>

        <div className="st-settings-main">
          {active === 'profile' && (
            <section className="st-card" id="st-set-profile">
              <div className="st-card-title-row">
                <h3 className="st-card-title">Thông tin cá nhân</h3>
              </div>
              <div className="st-info-grid">
                <div className="st-info-field"><label>Họ và tên</label><input value={profile.name} readOnly className="dmrs-input--readonly" /></div>
                <div className="st-info-field"><label>Mã số sinh viên (MSSV)</label><input value={user?.mssv || ''} readOnly className="dmrs-input--readonly" /></div>
                <div className="st-info-field"><label>Lớp</label><input value={user?.class || ''} readOnly className="dmrs-input--readonly" /></div>
                <div className="st-info-field"><label>Khoa</label><input value={user?.faculty || ''} readOnly className="dmrs-input--readonly" /></div>
                <div className="st-info-field st-info-field--full"><label>Email sinh viên</label><input value={profile.email} readOnly className="dmrs-input--readonly" /></div>
              </div>
              <p className="st-muted" style={{ marginTop: 12, fontSize: 13 }}>
                Thông tin cá nhân do nhà trường quản lý. Bạn chỉ có thể tự đổi mật khẩu ở mục Bảo mật &amp; Mật khẩu.
              </p>
            </section>
          )}

          {active === 'security' && (
            <section className="st-card" id="st-set-security">
              <h3 className="st-card-title">Bảo mật &amp; Mật khẩu</h3>
              <div className="st-pwd-field"><label>Mật khẩu hiện tại</label><input type="password" name="current" value={pwd.current} onChange={changePwdField} autoComplete="current-password" /></div>
              <div className="st-pwd-field">
                <label>Mật khẩu mới</label>
                <input
                  type="password"
                  name="next"
                  value={pwd.next}
                  onChange={changePwdField}
                  autoComplete="new-password"
                  placeholder="Ít nhất 6 ký tự"
                  aria-describedby="student-password-help"
                />
                <p id="student-password-help" className="st-muted" style={{ marginTop: 6, fontSize: 13 }}>
                  {PASSWORD_GUIDE}
                </p>
              </div>
              <div className="st-pwd-field"><label>Xác nhận mật khẩu mới</label><input type="password" name="confirm" value={pwd.confirm} onChange={changePwdField} autoComplete="new-password" /></div>
              <button className="st-btn st-btn--primary" onClick={submitPassword} disabled={pwdSaving}>{pwdSaving ? 'Đang đổi...' : 'Đổi mật khẩu'}</button>
            </section>
          )}
        </div>
      </div>
    </div>
  )
}

export default SettingsPage
