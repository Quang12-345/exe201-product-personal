import { useState, useEffect } from 'react'
import { useLocation, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../auth/context/AuthContext.jsx'
import { changeMyPassword, getMyProfile } from '../../auth/services/profileService.js'
import { getClassrooms } from '../services/classroomService'
import {
  getBillingStatus,
  startLecturerCheckout,
  reconcileProPayment,
} from '../../student/services/billingService'
import { UserIcon, LockIcon, SparklesIcon } from '../../../components/common/icons.jsx'
import { notify as showToast } from '../../../components/common/toast.jsx'

const PASSWORD_GUIDE = 'Mật khẩu mới phải có ít nhất 6 ký tự, gồm chữ hoa, số và ký tự đặc biệt.'
const STRONG_PASSWORD_RE = /^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{6,}$/

function formatDate(isoStr) {
  if (!isoStr) return '—'
  const d = new Date(isoStr)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function LecturerSettings() {
  const { user } = useAuth()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const [profileData, setProfileData] = useState(null)
  const [classrooms, setClassrooms] = useState([])
  const [billing, setBilling] = useState(null)
  const [loading, setLoading] = useState(true)
  const [checkoutBusy, setCheckoutBusy] = useState(false)
  const [paymentCheckBusy, setPaymentCheckBusy] = useState(false)
  const [paymentCheckStatus, setPaymentCheckStatus] = useState(null)
  const [paymentCheckError, setPaymentCheckError] = useState('')

  const [pwd, setPwd] = useState({ current: '', next: '', confirm: '' })
  const [pwdSaving, setPwdSaving] = useState(false)

  const paymentResult = searchParams.get('payment') || (searchParams.get('status') === 'PAID' ? 'success' : null)
  const paymentOrderCode = searchParams.get('order_code') || searchParams.get('orderCode') || billing?.pending_order_code

  useEffect(() => {
    Promise.all([
      getMyProfile().catch(() => null),
      getClassrooms().catch(() => []),
      getBillingStatus().catch(() => null),
    ]).then(([me, classList, billingData]) => {
      if (me) setProfileData(me)
      if (Array.isArray(classList)) setClassrooms(classList)
      if (billingData) setBilling(billingData)
      setLoading(false)
    })
  }, [])

  useEffect(() => {
    const code = searchParams.get('order_code') || searchParams.get('orderCode') || billing?.pending_order_code
    if (paymentResult === 'success' || code) {
      if (code) {
        reconcileProPayment(code)
          .then((res) => {
            if (res?.status === 'paid') {
              getBillingStatus().then(setBilling).catch(() => {})
            }
          })
          .catch(() => {
            getBillingStatus().then(setBilling).catch(() => {})
          })
      } else {
        getBillingStatus().then(setBilling).catch(() => {})
      }
    }
    if (paymentResult !== 'pending') return undefined
    let attempts = 0
    const timer = window.setInterval(async () => {
      attempts += 1
      try {
        const status = await getBillingStatus()
        setBilling(status)
        if (status?.is_pro || attempts >= 20) window.clearInterval(timer)
      } catch {
        if (attempts >= 20) window.clearInterval(timer)
      }
    }, 3000)
    return () => window.clearInterval(timer)
  }, [paymentResult])

  const checkPayment = async () => {
    if (!paymentOrderCode || paymentCheckBusy) return
    setPaymentCheckError('')
    setPaymentCheckBusy(true)
    try {
      const result = await reconcileProPayment(paymentOrderCode)
      setPaymentCheckStatus(result.status)
      if (result.status === 'paid') {
        const nextBilling = await getBillingStatus()
        setBilling(nextBilling)
        showToast('Đã kích hoạt Gói Giảng viên thành công!')
      }
    } catch (err) {
      const detail = err?.response?.data?.detail
      setPaymentCheckError(typeof detail === 'string' ? detail : detail?.message || 'Chưa kiểm tra được giao dịch.')
    } finally {
      setPaymentCheckBusy(false)
    }
  }

  const handleUpgradeLecturer = async () => {
    setCheckoutBusy(true)
    try {
      const returnTo = `${location.pathname}${location.search || ''}`
      const res = await startLecturerCheckout(returnTo)
      const redirectUrl = res?.checkout_url || res?.payment_url
      if (redirectUrl) {
        window.location.assign(redirectUrl)
      } else {
        showToast('Không lấy được liên kết thanh toán.', 'error')
      }
    } catch (err) {
      const detail = err?.response?.data?.detail
      showToast(typeof detail === 'string' ? detail : detail?.message || 'Lỗi khi kết nối cổng thanh toán.', 'error')
    } finally {
      setCheckoutBusy(false)
    }
  }

  const isPaidLecturer = Boolean(billing?.is_pro)
  const currentClasses = billing?.current_classes ?? classrooms.length
  const maxClasses = billing?.max_classes ?? (isPaidLecturer ? 50 : 5)

  const rawName = profileData?.name || user?.name || user?.username || 'Giảng Viên Demo'
  const displayName = rawName.includes('GS.') || rawName.includes('ThS.') || rawName.includes('TS.')
    ? rawName
    : `GS. ${rawName}`
  const avatarChar = displayName.replace(/^(GS\.|ThS\.|TS\.)\s*/, '').trim().charAt(0).toUpperCase() || 'G'

  const username = profileData?.username || user?.username || ''
  const email = profileData?.email || user?.email || ''
  const phone = profileData?.phone || user?.phone || ''
  const roleLabel = profileData?.roleLabel || (user?.role === 'lecturer' ? 'Giảng viên' : (user?.role || 'Giảng viên'))
  const statusRaw = profileData?.status || user?.status || 'active'
  const statusText = statusRaw === 'active' ? 'Đang hoạt động' : statusRaw
  const joinedDate = formatDate(profileData?.joinedAt)

  // Thống kê giảng dạy thực tế
  const classroomsCount = classrooms.length
  const docsCount = profileData?.documentCount ?? classrooms.reduce((acc, c) => acc + (c.document_count || 0), 0)
  const studentsCount = classrooms.reduce((acc, c) => acc + (c.student_count || 0), 0)

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
    <div className="lec-settings">
      <h1 className="dmrs-page-title">Hồ sơ giảng viên</h1>
      <p className="dmrs-page-sub">Quản lý thông tin tài khoản giảng viên và bảo mật hệ thống.</p>

      <section className="dmrs-card" id="lec-set-profile">
        <div className="dmrs-card-title-row">
          <h3 className="dmrs-card-title"><UserIcon size={18} /> Thông tin cá nhân</h3>
        </div>

        {/* Khung đại diện giảng viên */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px', paddingBottom: '20px', borderBottom: '1.5px solid #000000' }}>
          <div style={{
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            backgroundColor: '#2563eb',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '22px',
            fontWeight: '800',
            border: '2px solid #000000',
            boxShadow: '2px 2px 0px #000000',
            flexShrink: 0,
          }}>
            {avatarChar}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '18px', fontWeight: '800', color: '#000000', marginBottom: '4px' }}>
              {displayName}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                backgroundColor: '#dbeafe',
                color: '#1d4ed8',
                border: '1.5px solid #000000',
                borderRadius: '6px',
                padding: '2px 8px',
                fontSize: '12px',
                fontWeight: '700',
              }}>
                {roleLabel}
              </span>
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                backgroundColor: '#dcfce7',
                color: '#15803d',
                border: '1.5px solid #000000',
                borderRadius: '6px',
                padding: '2px 8px',
                fontSize: '12px',
                fontWeight: '700',
              }}>
                ● {statusText}
              </span>
            </div>
          </div>
        </div>

        {/* Chi tiết thông tin có thực trong hệ thống */}
        <div className="dmrs-field-row">
          <div className="dmrs-field">
            <label>Họ và tên</label>
            <input value={rawName} readOnly className="dmrs-input--readonly" />
          </div>
          <div className="dmrs-field">
            <label>Tên tài khoản (Username)</label>
            <input value={username} readOnly className="dmrs-input--readonly" />
          </div>
        </div>

        <div className="dmrs-field-row">
          <div className="dmrs-field">
            <label>Email giảng viên</label>
            <input value={email} readOnly className="dmrs-input--readonly" />
          </div>
          <div className="dmrs-field">
            <label>Vai trò</label>
            <input value={roleLabel} readOnly className="dmrs-input--readonly" />
          </div>
        </div>

        <div className="dmrs-field-row">
          <div className="dmrs-field">
            <label>Trạng thái tài khoản</label>
            <input value={statusText} readOnly className="dmrs-input--readonly" />
          </div>
          <div className="dmrs-field">
            <label>Ngày tham gia</label>
            <input value={joinedDate} readOnly className="dmrs-input--readonly" />
          </div>
        </div>

        {/* Số điện thoại: Chỉ hiển thị khi có dữ liệu thật */}
        {phone ? (
          <div className="dmrs-field-row">
            <div className="dmrs-field">
              <label>Số điện thoại</label>
              <input value={phone} readOnly className="dmrs-input--readonly" />
            </div>
          </div>
        ) : null}

        {/* Tóm tắt hoạt động giảng dạy */}
        <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1.5px dashed #cbd5e1' }}>
          <h4 style={{ fontSize: '13px', fontWeight: '800', margin: '0 0 12px', color: '#1e293b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Tổng quan giảng dạy
          </h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px' }}>
            <div style={{ padding: '12px 14px', border: '2px solid #000000', borderRadius: '10px', boxShadow: '2px 2px 0px #000000', background: '#f8fafc' }}>
              <div style={{ fontSize: '11px', fontWeight: '700', color: '#64748b' }}>LỚP HỌC PHỤ TRÁCH</div>
              <div style={{ fontSize: '20px', fontWeight: '800', color: '#000000', marginTop: '2px' }}>{classroomsCount} lớp</div>
            </div>
            <div style={{ padding: '12px 14px', border: '2px solid #000000', borderRadius: '10px', boxShadow: '2px 2px 0px #000000', background: '#f8fafc' }}>
              <div style={{ fontSize: '11px', fontWeight: '700', color: '#64748b' }}>TÀI LIỆU BÀI GIẢNG</div>
              <div style={{ fontSize: '20px', fontWeight: '800', color: '#000000', marginTop: '2px' }}>{docsCount} tài liệu</div>
            </div>
            <div style={{ padding: '12px 14px', border: '2px solid #000000', borderRadius: '10px', boxShadow: '2px 2px 0px #000000', background: '#f8fafc' }}>
              <div style={{ fontSize: '11px', fontWeight: '700', color: '#64748b' }}>SINH VIÊN THEO HỌC</div>
              <div style={{ fontSize: '20px', fontWeight: '800', color: '#000000', marginTop: '2px' }}>{studentsCount} sinh viên</div>
            </div>
          </div>
        </div>

        <p className="dmrs-muted" style={{ marginTop: 14, fontSize: 13 }}>
          Thông tin cá nhân do nhà trường quản lý. Bạn chỉ có thể tự đổi mật khẩu bên dưới.
        </p>
      </section>

      <section className="dmrs-card" id="lec-set-plan">
        <div className="dmrs-card-title-row">
          <h3 className="dmrs-card-title"><SparklesIcon size={18} /> Gói Giảng viên &amp; Hạn mức</h3>
        </div>

        <div
          style={{
            backgroundColor: isPaidLecturer ? '#ECFDF5' : '#FFFBEB',
            border: '2px solid #000000',
            boxShadow: '3px 3px 0px #000000',
            borderRadius: 12,
            padding: '16px 18px',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span
                style={{
                  padding: '4px 10px',
                  borderRadius: 999,
                  fontSize: 12,
                  fontWeight: 800,
                  border: '1.5px solid #000000',
                  backgroundColor: isPaidLecturer ? '#E5F970' : '#ffffff',
                  color: '#000000',
                }}
              >
                {isPaidLecturer ? '⭐ GÓI GIẢNG VIÊN (129.000đ/tháng)' : 'GÓI MIỄN PHÍ'}
              </span>
              <strong style={{ fontSize: 14, color: '#0f172a' }}>
                Đã tạo {currentClasses} / {maxClasses} lớp học
              </strong>
            </div>
            {isPaidLecturer && billing?.expires_at && (
              <span style={{ fontSize: 13, fontWeight: 700, color: '#15803d' }}>
                HSD: {formatDate(billing.expires_at)}
              </span>
            )}
          </div>

          <div style={{ fontSize: 13.5, color: '#334155', lineHeight: 1.55 }}>
            {isPaidLecturer ? (
              <span>
                Tài khoản của thầy/cô đang sử dụng <strong>Gói Giảng viên</strong> với đầy đủ quyền quản lý tối đa <strong>50 lớp học</strong>, Lịch thi trắc nghiệm tự chấm điểm và Nhập đề từ file Word (.docx).
              </span>
            ) : (
              <ul style={{ margin: '4px 0 0 18px', padding: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <li><strong>Gói Miễn phí:</strong> Tạo tối đa <strong>5 lớp học</strong>, tải tài liệu cô lập theo lớp và chat Sổ tay AI.</li>
                <li><strong>Gói Giảng viên (129.000đ/tháng):</strong> Tạo tối đa <strong>50 lớp học</strong>, mở khóa toàn bộ chức năng giảng viên gồm <strong>Lịch thi trắc nghiệm</strong> &amp; <strong>Nhập đề Word (.docx)</strong>.</li>
              </ul>
            )}
          </div>

          {(paymentResult === 'pending' || paymentCheckStatus || paymentCheckError) && !isPaidLecturer && (
            <div style={{ fontSize: 13, fontWeight: 700, color: paymentCheckError ? '#dc2626' : '#b45309' }}>
              {paymentCheckError ||
                (paymentCheckStatus === 'pending'
                  ? 'Giao dịch đang chờ cổng thanh toán xác nhận...'
                  : paymentResult === 'pending'
                    ? 'Đang chờ xác nhận thanh toán...'
                    : null)}
            </div>
          )}

          {!isPaidLecturer && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <button
                type="button"
                className="lec-btn-submit"
                disabled={checkoutBusy}
                onClick={handleUpgradeLecturer}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, backgroundColor: '#3b66f5' }}
              >
                <SparklesIcon size={16} />
                <span>{checkoutBusy ? 'Đang chuyển thanh toán...' : 'Nâng cấp Gói Giảng viên · 129.000đ/tháng'}</span>
              </button>
              {paymentOrderCode && (
                <button
                  type="button"
                  className="lec-btn-cancel"
                  disabled={paymentCheckBusy}
                  onClick={checkPayment}
                >
                  {paymentCheckBusy ? 'Đang kiểm tra...' : 'Kiểm tra thanh toán'}
                </button>
              )}
            </div>
          )}
        </div>
      </section>

      <section className="dmrs-card" id="lec-set-security">
        <h3 className="dmrs-card-title"><LockIcon size={18} /> Bảo mật &amp; Mật khẩu</h3>
        <div className="dmrs-field">
          <label>Mật khẩu hiện tại</label>
          <input
            type="password"
            name="current"
            value={pwd.current}
            onChange={changePwdField}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck="false"
          />
        </div>
        <div className="dmrs-field">
          <label>Mật khẩu mới</label>
          <input
            type="password"
            name="next"
            value={pwd.next}
            onChange={changePwdField}
            autoComplete="new-password"
            placeholder="Ít nhất 6 ký tự"
            aria-describedby="password-help"
          />
          <p id="password-help" className="dmrs-muted" style={{ marginTop: 6, fontSize: 13 }}>
            {PASSWORD_GUIDE}
          </p>
        </div>
        <div className="dmrs-field">
          <label>Xác nhận mật khẩu mới</label>
          <input
            type="password"
            name="confirm"
            value={pwd.confirm}
            onChange={changePwdField}
            autoComplete="new-password"
          />
        </div>
        <button
          className="dmrs-btn dmrs-btn--primary"
          onClick={submitPassword}
          disabled={pwdSaving}
        >
          {pwdSaving ? 'Đang đổi...' : 'Cập nhật mật khẩu'}
        </button>
      </section>
    </div>
  )
}

export default LecturerSettings
