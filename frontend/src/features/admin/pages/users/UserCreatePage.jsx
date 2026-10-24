import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { createUser, getAssignableRoles } from '../../services/userService'
import { UserIcon, InfoIcon, ShapesIcon, EyeIcon } from '../../../../components/common/icons.jsx'
import { notify } from '../../../../components/common/toast.jsx'

const PASSWORD_GUIDE = 'Mật khẩu phải có ít nhất 6 ký tự, gồm chữ hoa, số và ký tự đặc biệt.'
const STRONG_PASSWORD_RE = /^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{6,}$/

// Thêm người dùng mới: ảnh đại diện + thông tin cơ bản + quyền hạn.
function UserCreatePage() {
  const navigate = useNavigate()
  const fileInputRef = useRef(null)
  const [avatarPreview, setAvatarPreview] = useState(null)
  const [form, setForm] = useState({ name: '', email: '', code: '', role: 'Giảng viên', level: '', dept: '' })
  const [pwd, setPwd] = useState({ password: '', confirm: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const change = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }))

  const handleAvatarClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      notify('Vui lòng chọn tệp hình ảnh hợp lệ (JPG, PNG, WEBP).', 'error')
      return
    }

    if (file.size > 2 * 1024 * 1024) {
      notify('Dung lượng ảnh vượt quá 2MB. Vui lòng chọn ảnh nhỏ hơn.', 'error')
      return
    }

    const reader = new FileReader()
    reader.onload = (event) => {
      setAvatarPreview(event.target.result)
      notify('Đã tải ảnh đại diện thành công.')
    }
    reader.readAsDataURL(file)
  }

  const handleRemoveAvatar = (e) => {
    e.stopPropagation()
    setAvatarPreview(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    if (!STRONG_PASSWORD_RE.test(pwd.password)) {
      notify(PASSWORD_GUIDE, 'error')
      return
    }
    if (pwd.password !== pwd.confirm) {
      notify('Mật khẩu xác thực không khớp.', 'error')
      return
    }
    setSaving(true)
    try {
      const created = await createUser({ ...form, password: pwd.password, avatar: avatarPreview })
      notify('Tạo người dùng thành công.')
      const pwdNote = created?.initialPassword ? ` (Mật khẩu khởi tạo: ${created.initialPassword})` : ''
      navigate('/admin/users', {
        state: {
          success: `Tạo tài khoản ${created.name || form.name} thành công.${pwdNote} Thông tin đăng nhập đã được gửi tới ${created.email || form.email}.`,
        },
      })
    } catch (err) {
      const detail = err?.response?.data?.detail
      setError(typeof detail === 'string' ? detail : 'Tạo người dùng thất bại. Vui lòng thử lại.')
      notify(typeof detail === 'string' ? detail : 'Tạo người dùng thất bại. Vui lòng thử lại.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit}>
      <div className="dmrs-page-head">
        <div>
          <h1 className="dmrs-page-title">Thêm người dùng mới</h1>
          <p className="dmrs-page-sub">Cấp tài khoản giảng viên (sinh viên tự vào bằng Gmail). Tài khoản vận hành không tạo qua form này.</p>
        </div>
      </div>

      <div className="dmrs-form-grid">
        <div className="dmrs-card dmrs-avatar-card">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/jpg,image/webp"
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />
          <div
            className="dmrs-avatar-upload"
            onClick={handleAvatarClick}
            style={{ cursor: 'pointer', overflow: 'hidden', border: avatarPreview ? '2px solid #3b82f6' : '2px dashed #cbd5e1' }}
            title="Nhấp để tải ảnh lên"
          >
            {avatarPreview ? (
              <img
                src={avatarPreview}
                alt="Ảnh đại diện"
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : (
              <UserIcon size={42} />
            )}
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              type="button"
              className="dmrs-btn dmrs-btn--outline"
              onClick={handleAvatarClick}
            >
              {avatarPreview ? 'Đổi ảnh khác' : 'Tải ảnh lên'}
            </button>
            {avatarPreview && (
              <button
                type="button"
                className="dmrs-btn dmrs-btn--ghost"
                onClick={handleRemoveAvatar}
                style={{ color: '#dc2626' }}
              >
                Xóa
              </button>
            )}
          </div>
          <p className="dmrs-muted dmrs-center">Dung lượng tối đa 2MB. Hỗ trợ JPG, PNG.</p>
        </div>

        <div className="dmrs-form-col">
          <section className="dmrs-card">
            <h3 className="dmrs-card-title"><InfoIcon size={18} /> Thông tin cơ bản</h3>
            <div className="dmrs-field">
              <label>Họ và tên</label>
              <input name="name" value={form.name} onChange={change} placeholder="Nhập đầy đủ họ tên" required />
            </div>
            <div className="dmrs-field-row">
              <div className="dmrs-field">
                <label>Email công vụ</label>
                <input name="email" type="email" value={form.email} onChange={change} placeholder="example@dmrs.edu.vn" required />
              </div>
              <div className="dmrs-field">
                <label>Mã số nhân viên</label>
                <input name="code" value={form.code} onChange={change} placeholder="VD: NV2024001" />
              </div>
            </div>
            <div className="dmrs-field">
              <label>Vai trò hệ thống</label>
              <select name="role" value={form.role} onChange={change} required>
                {getAssignableRoles().map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
          </section>

          <section className="dmrs-card">
            <h3 className="dmrs-card-title">Thông tin mật khẩu</h3>
            <div className="dmrs-field-row">
              <div className="dmrs-field">
                <label>Nhập mật khẩu</label>
                <div className="dmrs-input-icon">
                  <input
                    type="password"
                    value={pwd.password}
                    onChange={(e) => setPwd((p) => ({ ...p, password: e.target.value }))}
                    placeholder="Nhập mật khẩu"
                    aria-describedby="admin-create-password-help"
                    required
                  />
                  <EyeIcon size={18} />
                </div>
                <p id="admin-create-password-help" className="dmrs-muted" style={{ marginTop: 6, fontSize: 13 }}>
                  {PASSWORD_GUIDE}
                </p>
              </div>
              <div className="dmrs-field">
                <label>Xác thực lại mật khẩu</label>
                <div className="dmrs-input-icon">
                  <input
                    type="password"
                    value={pwd.confirm}
                    onChange={(e) => setPwd((p) => ({ ...p, confirm: e.target.value }))}
                    placeholder="Xác thực lại mật khẩu"
                    required
                  />
                  <EyeIcon size={18} />
                </div>
              </div>
            </div>
          </section>

          <section className="dmrs-card">
            <h3 className="dmrs-card-title"><ShapesIcon size={18} /> Quyền hạn & Phân loại</h3>
            <div className="dmrs-field-row">
              <div className="dmrs-field">
                <label>Cấp bậc (Level)</label>
                <input name="level" value={form.level} onChange={change} placeholder="VD: Senior Manager" />
              </div>
              <div className="dmrs-field">
                <label>Khoa / Phòng ban</label>
                <input name="dept" value={form.dept} onChange={change} placeholder="VD: Khoa CNTT" />
              </div>
            </div>
          </section>
        </div>
      </div>

      {error ? <p className="dmrs-error" style={{ color: '#dc2626', marginTop: 12 }}>{error}</p> : null}

      <div className="dmrs-form-footer">
        <button type="button" className="dmrs-btn dmrs-btn--ghost" onClick={() => navigate('/admin/users')}>Hủy bỏ</button>
        <button type="submit" className="dmrs-btn dmrs-btn--primary" disabled={saving}>
          {saving ? 'Đang tạo...' : 'Tạo người dùng'}
        </button>
      </div>
    </form>
  )
}

export default UserCreatePage
