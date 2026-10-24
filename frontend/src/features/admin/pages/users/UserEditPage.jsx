import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getUser, updateUser, getAssignableRoles, revokePro, grantPro } from '../../services/userService'
import { useAuth } from '../../../auth/context/AuthContext.jsx'
import StatusBadge from '../../components/StatusBadge.jsx'
import { CameraIcon, ShieldIcon, SparklesIcon } from '../../../../components/common/icons.jsx'
import { notify } from '../../../../components/common/toast.jsx'

function initials(name = '') {
  return (name || '?').trim().split(/\s+/).slice(-2).map((w) => w[0] || '').join('').toUpperCase() || '?'
}

function formatDate(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString('vi-VN')
}

// Chỉnh sửa thông tin người dùng: hồ sơ + thông tin cơ bản + gói Pro/Free.
function UserEditPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user: currentUser, updateCurrentUser } = useAuth()
  const [form, setForm] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    getUser(id).then(setForm)
  }, [id])

  if (!form) return <p className="dmrs-loading">Đang tải...</p>

  const change = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }))

  const handleRevokePro = async () => {
    if (!window.confirm(`Xác nhận cắt quyền Pro của người dùng "${form.name}"?\n\nTài khoản sẽ chuyển về gói Free (200.000 tokens/ngày).`)) return
    try {
      const updated = await revokePro(id)
      setForm((prev) => ({ ...prev, ...updated }))
      notify('Đã cắt quyền Pro thành công. Người dùng về gói Free.')
    } catch {
      notify('Thao tác thất bại. Vui lòng thử lại.', 'error')
    }
  }

  const handleGrantPro = async () => {
    if (!window.confirm(`Cấp quyền Pro (30 ngày) cho người dùng "${form.name}"?\n\nTài khoản sẽ được mở rộng 900.000 tokens/ngày.`)) return
    try {
      const updated = await grantPro(id)
      setForm((prev) => ({ ...prev, ...updated }))
      notify('Đã cấp quyền Pro (30 ngày) thành công.')
    } catch {
      notify('Thao tác thất bại. Vui lòng thử lại.', 'error')
    }
  }

  const submit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const updated = await updateUser(id, form)
      if (currentUser?.id === id) {
        updateCurrentUser({
          name: updated.name,
          email: updated.email,
          phone: updated.phone,
          status: updated.status,
        })
      }
      notify('Cập nhật thông tin thành công.')
      navigate('/admin/users')
    } catch (err) {
      const detail = err?.response?.data?.detail
      notify(typeof detail === 'string' ? detail : 'Lưu thất bại. Vui lòng thử lại.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit}>
      <div className="dmrs-page-head">
        <div>
          <h1 className="dmrs-page-title">Chỉnh sửa thông tin</h1>
          <p className="dmrs-page-sub">Cập nhật hồ sơ, phân quyền và kiểm soát gói dịch vụ của người dùng.</p>
        </div>
        <div className="dmrs-head-status">
          <StatusBadge variant="success">Hoạt động</StatusBadge>
        </div>
      </div>

      <div className="dmrs-form-grid dmrs-form-grid--edit">
        <div className="dmrs-form-col">
          <section className="dmrs-card dmrs-profile-card">
            <div className="dmrs-profile-avatar">
              <span className="dmrs-avatar dmrs-avatar--lg">{initials(form.name)}</span>
              <button
                type="button"
                className="dmrs-cam-btn"
                aria-label="Đổi ảnh"
                title="Tính năng đang được phát triển"
                onClick={() => notify('Tính năng đổi avatar đang được phát triển.')}
              >
                <CameraIcon size={16} />
              </button>
            </div>
            <strong className="dmrs-profile-name">{form.name}</strong>
            <span className="dmrs-muted dmrs-profile-role">{form.role}</span>
            <div className="dmrs-doc-count">
              <span>TÀI LIỆU</span>
              <strong>{form.documentCount ?? 0}</strong>
            </div>
          </section>

          {/* Card Gói dịch vụ & Bản quyền Pro/Free */}
          <section className="dmrs-card">
            <h3 className="dmrs-card-title"><SparklesIcon size={18} /> Gói dịch vụ & Hạn mức</h3>
            {form.isStudent ? (
              <div>
                <div className="dmrs-info-row">
                  <span>Gói hiện tại:</span>
                  {form.isPro ? (
                    <span className="dmrs-badge dmrs-badge--pro">⭐ Gói Pro (900k tokens/ngày)</span>
                  ) : (
                    <span className="dmrs-badge dmrs-badge--free">Gói Free (200k tokens/ngày)</span>
                  )}
                </div>
                {form.isPro && form.subscriptionExpiresAt && (
                  <div className="dmrs-info-row">
                    <span>Hạn sử dụng:</span>
                    <strong>{formatDate(form.subscriptionExpiresAt)}</strong>
                  </div>
                )}
                <div style={{ marginTop: 14 }}>
                  {form.isPro ? (
                    <button
                      type="button"
                      className="dmrs-plan-btn dmrs-plan-btn--revoke"
                      style={{ width: '100%', justifyContent: 'center' }}
                      onClick={handleRevokePro}
                    >
                      Cắt quyền Pro (quay về gói Free)
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="dmrs-plan-btn dmrs-plan-btn--grant"
                      style={{ width: '100%', justifyContent: 'center' }}
                      onClick={handleGrantPro}
                    >
                      <SparklesIcon size={16} /> Cấp quyền Pro (30 ngày)
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div>
                <div className="dmrs-info-row">
                  <span>Phân loại:</span>
                  <span className="dmrs-badge dmrs-badge--neutral">Tài khoản Hệ thống</span>
                </div>
                <p className="dmrs-muted" style={{ fontSize: 13, marginTop: 8, lineHeight: 1.5 }}>
                  Tài khoản giảng viên / cán bộ quản trị có hạn mức tối đa hệ thống.
                </p>
              </div>
            )}
          </section>

          <section className="dmrs-card">
            <h3 className="dmrs-card-title"><ShieldIcon size={18} /> Quyền hạn & Phân loại</h3>
            <div className="dmrs-info-row"><span>Cấp bậc:</span><strong>{form.level || '—'}</strong></div>
            <div className="dmrs-info-row"><span>Phòng ban:</span><strong>{form.dept || '—'}</strong></div>
            {form.joinedAt ? (
              <div className="dmrs-info-row"><span>Ngày tham gia:</span><strong>{formatDate(form.joinedAt)}</strong></div>
            ) : null}
          </section>
        </div>

        <div className="dmrs-form-col">
          <section className="dmrs-card">
            <h3 className="dmrs-card-title">Thông tin cơ bản</h3>
            <div className="dmrs-field-row">
              <div className="dmrs-field">
                <label>Họ và tên</label>
                <input name="name" value={form.name} onChange={change} />
              </div>
              <div className="dmrs-field">
                <label>Email công vụ</label>
                <input name="email" type="email" value={form.email} onChange={change} />
              </div>
            </div>
            <div className="dmrs-field-row">
              <div className="dmrs-field">
                <label>Mã định danh</label>
                <input value={form.id} readOnly className="dmrs-input--readonly" />
              </div>
              <div className="dmrs-field">
                <label>Vai trò hệ thống</label>
                <select name="role" value={form.role} onChange={change}>
                  {(getAssignableRoles().includes(form.role)
                    ? getAssignableRoles()
                    : [form.role, ...getAssignableRoles()]
                  ).map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="dmrs-field">
              <label>Trạng thái tài khoản</label>
              <div className="dmrs-radio-bar">
                <label className="dmrs-radio">
                  <input type="radio" name="status" value="active" checked={form.status === 'active'} onChange={change} />
                  Đang hoạt động
                </label>
                <label className="dmrs-radio">
                  <input type="radio" name="status" value="locked" checked={form.status === 'locked'} onChange={change} />
                  Tạm khóa
                </label>
              </div>
            </div>
          </section>

        </div>
      </div>

      <div className="dmrs-form-footer">
        <button type="button" className="dmrs-btn dmrs-btn--ghost" onClick={() => navigate('/admin/users')}>Hủy bỏ</button>
        <button type="submit" className="dmrs-btn dmrs-btn--primary" disabled={saving}>
          {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
        </button>
      </div>
    </form>
  )
}

export default UserEditPage
