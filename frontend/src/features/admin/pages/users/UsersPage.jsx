import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useUsers } from '../../hooks/useUsers.js'
import StatusBadge from '../../components/StatusBadge.jsx'
import Pagination from '../../components/Pagination.jsx'
import IconSelect from '../../../../components/common/IconSelect.jsx'
import {
  roleAll,
  roleOptions,
  userStatusAll,
  userStatusOptions,
} from '../../services/filterMeta'
import {
  PlusIcon,
  DownloadIcon,
  EditIcon,
  TrashIcon,
  MoreVerticalIcon,
  InfoIcon,
  CheckCircleIcon,
  SparklesIcon,
} from '../../../../components/common/icons.jsx'
import { comingSoon } from '../../../../components/common/comingSoon.jsx'

const ROLE_VARIANT = { 'Giảng viên': 'success', 'Vận hành': 'info', Admin: 'info', 'Sinh viên': 'neutral' }
const STATUS = {
  active: { variant: 'success', label: 'Đang hoạt động' },
  pending: { variant: 'warning', label: 'Chờ xác nhận' },
  locked: { variant: 'danger', label: 'Bị khóa' },
  deleted: { variant: 'danger', label: 'Đã vô hiệu hóa' },
}
// Trạng thái không xác định (backend trả giá trị lạ) → fallback an toàn, tránh crash trắng trang.
const statusOf = (s) => STATUS[s] || { variant: 'neutral', label: s || 'Không rõ' }
// Người dùng đã bị vô hiệu hóa (xóa mềm) — ẩn khỏi danh sách mặc định.
const isDeleted = (u) => u.status === 'deleted'
const PAGE_SIZE = 10

function initials(name) {
  return (name || '?').trim().split(/\s+/).slice(-2).map((w) => w[0] || '').join('').toUpperCase() || '?'
}

function formatDate(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString('vi-VN')
}

// Quản lý người dùng: lọc theo vai trò/trạng thái/gói + bảng + phân trang + quản lý Pro/Free sinh viên.
function UsersPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const { users, loading, removeUser, revokePro, grantPro } = useUsers()
  const [role, setRole] = useState('all')
  const [status, setStatus] = useState('all')
  const [planFilter, setPlanFilter] = useState('all')
  const [success, setSuccess] = useState(location.state?.success || '')
  const [page, setPage] = useState(1)
  const keyword = (searchParams.get('q') || '').trim().toLowerCase()

  useEffect(() => {
    if (!location.state?.success) return
    navigate(location.pathname, { replace: true, state: {} })
  }, [location.pathname, location.state?.success, navigate])

  useEffect(() => {
    if (!success) return
    const timer = setTimeout(() => setSuccess(''), 5000)
    return () => clearTimeout(timer)
  }, [success])

  const shown = useMemo(
    () =>
      users.filter(
        (u) => {
          const haystack = `${u.name || ''} ${u.email || ''} ${u.id || ''} ${u.role || ''}`.toLowerCase()
          const matchPlan =
            planFilter === 'all' ||
            (planFilter === 'pro' && u.isStudent && u.isPro) ||
            (planFilter === 'free' && u.isStudent && !u.isPro)
          return (
            // Ẩn tài khoản đã vô hiệu hóa, trừ khi lọc đúng trạng thái đó.
            (status === 'deleted' || !isDeleted(u)) &&
            (role === 'all' || u.role === role) &&
            (status === 'all' || u.status === status) &&
            matchPlan &&
            (keyword === '' || haystack.includes(keyword))
          )
        }
      ),
    [users, role, status, planFilter, keyword]
  )
  const activeCount = useMemo(() => users.filter((u) => !isDeleted(u)).length, [users])
  const totalPages = Math.max(1, Math.ceil(shown.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const pageStart = (currentPage - 1) * PAGE_SIZE
  const paged = useMemo(
    () => shown.slice(pageStart, pageStart + PAGE_SIZE),
    [shown, pageStart],
  )

  useEffect(() => {
    setPage(1)
  }, [role, status, planFilter, keyword])

  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  const handleDelete = (u) => {
    if (confirm(`Xóa người dùng "${u.name}"?`)) removeUser(u.id)
  }

  const handleRevokePro = async (u) => {
    const ok = window.confirm(
      `Xác nhận cắt quyền Pro của sinh viên "${u.name}"?\n\nSinh viên này sẽ quay lại gói Free (giới hạn 200.000 tokens/ngày).`
    )
    if (!ok) return
    await revokePro(u.id)
  }

  const handleGrantPro = async (u) => {
    const ok = window.confirm(
      `Cấp quyền Pro (30 ngày) cho sinh viên "${u.name}"?\n\nSinh viên sẽ được nâng hạn mức lên 900.000 tokens/ngày.`
    )
    if (!ok) return
    await grantPro(u.id)
  }

  return (
    <div>
      <div className="dmrs-page-head">
        <div>
          <h1 className="dmrs-page-title">Quản lý người dùng</h1>
          <p className="dmrs-page-sub">Toàn quyền xem/sửa/xóa, kiểm soát gói Free/Pro của sinh viên và phân quyền hệ thống.</p>
        </div>
        <div className="dmrs-head-actions">
          <button className="dmrs-btn dmrs-btn--light" onClick={() => comingSoon('Xuất báo cáo đang được phát triển 🚧')}>
            <DownloadIcon size={18} /> Xuất báo cáo
          </button>
          <button className="dmrs-btn dmrs-btn--primary" onClick={() => navigate('/admin/users/new')}>
            <PlusIcon size={18} /> Thêm người dùng
          </button>
        </div>
      </div>

      {success ? (
        <div className="dmrs-alert dmrs-alert--success" role="status" aria-live="polite">
          <CheckCircleIcon size={18} />
          <span>{success}</span>
          <button type="button" className="dmrs-alert-close" aria-label="Đóng thông báo" onClick={() => setSuccess('')}>×</button>
        </div>
      ) : null}

      <div className="dmrs-filter-row">
        <div className="dmrs-select">
          <span>VAI TRÒ</span>
          <IconSelect
            value={role}
            onChange={setRole}
            options={roleOptions}
            allOption={roleAll}
            placeholder="Tất cả vai trò"
          />
        </div>
        <div className="dmrs-select">
          <span>GÓI DỊCH VỤ</span>
          <select
            className="dmrs-native-select"
            value={planFilter}
            onChange={(e) => setPlanFilter(e.target.value)}
          >
            <option value="all">Tất cả gói</option>
            <option value="pro">Gói Pro (Sinh viên) ⭐</option>
            <option value="free">Gói Free (Sinh viên)</option>
          </select>
        </div>
        <div className="dmrs-select">
          <span>TRẠNG THÁI</span>
          <IconSelect
            value={status}
            onChange={setStatus}
            options={userStatusOptions}
            allOption={userStatusAll}
            placeholder="Tất cả trạng thái"
          />
        </div>
        <div className="dmrs-total-card">
          <InfoIcon size={22} />
          <div>
            <span>Tổng số người dùng</span>
            <strong>{activeCount.toLocaleString()}</strong>
          </div>
        </div>
      </div>

      <div className="dmrs-card dmrs-table-card dmrs-table-card--paged">
        {loading ? (
          <p className="dmrs-loading">Đang tải...</p>
        ) : (
          <div className="dmrs-table-scroll">
            <table className="dmrs-table">
            <thead>
              <tr>
                <th>Người dùng</th>
                <th>Email</th>
                <th>Vai trò</th>
                <th>Gói dịch vụ</th>
                <th>Trạng thái</th>
                <th className="dmrs-col-actions">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {paged.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '36px 16px', color: '#64748b' }}>
                    Không tìm thấy người dùng nào phù hợp với bộ lọc.
                  </td>
                </tr>
              ) : (
                paged.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <div className="dmrs-user-cell">
                        <span className="dmrs-avatar dmrs-avatar--sm">{initials(u.name)}</span>
                        <div>
                          <strong>{u.name}</strong>
                          <span className="dmrs-muted">ID: {u.id}</span>
                        </div>
                      </div>
                    </td>
                    <td>{u.email}</td>
                    <td>
                      <StatusBadge variant={ROLE_VARIANT[u.role] || 'neutral'}>{u.role}</StatusBadge>
                    </td>
                    <td>
                      {u.isStudent ? (
                        u.isPro ? (
                          <div className="dmrs-plan-badge-box">
                            <span className="dmrs-badge dmrs-badge--pro">
                              ⭐ Gói Pro
                            </span>
                            {u.subscriptionExpiresAt && (
                              <span className="dmrs-plan-expiry">HSD: {formatDate(u.subscriptionExpiresAt)}</span>
                            )}
                          </div>
                        ) : (
                          <div className="dmrs-plan-badge-box">
                            <span className="dmrs-badge dmrs-badge--free">
                              Gói Free
                            </span>
                          </div>
                        )
                      ) : (
                        <span className="dmrs-badge dmrs-badge--neutral">
                          Hệ thống
                        </span>
                      )}
                    </td>
                    <td>
                      <StatusBadge variant={statusOf(u.status).variant} dot>
                        {statusOf(u.status).label}
                      </StatusBadge>
                    </td>
                    <td className="dmrs-col-actions">
                      <div className="dmrs-row-actions">
                        {u.isStudent && (
                          u.isPro ? (
                            <button
                              type="button"
                              className="dmrs-plan-btn dmrs-plan-btn--revoke"
                              onClick={() => handleRevokePro(u)}
                              title="Cắt quyền Pro — Chuyển sinh viên này về gói Free"
                            >
                              Cắt quyền Pro
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="dmrs-plan-btn dmrs-plan-btn--grant"
                              onClick={() => handleGrantPro(u)}
                              title="Cấp quyền Pro (30 ngày) cho sinh viên"
                            >
                              <SparklesIcon size={14} /> Cấp Pro
                            </button>
                          )
                        )}
                        <button className="dmrs-link-btn" onClick={() => navigate(`/admin/users/${u.id}/edit`)}>
                          <EditIcon size={16} /> Sửa
                        </button>
                        <button className="dmrs-icon-btn dmrs-icon-btn--danger" onClick={() => handleDelete(u)} aria-label="Xóa">
                          <TrashIcon size={16} />
                        </button>
                        <button className="dmrs-icon-btn" aria-label="Thêm" onClick={() => comingSoon('Tùy chọn người dùng đang được phát triển 🚧')}>
                          <MoreVerticalIcon size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            </table>
          </div>
        )}
        <Pagination
          current={currentPage}
          total={totalPages}
          info={`Hiển thị ${shown.length === 0 ? 0 : pageStart + 1}-${Math.min(pageStart + paged.length, shown.length)} / ${shown.length} người dùng`}
          onChange={setPage}
        />
      </div>
    </div>
  )
}

export default UsersPage
