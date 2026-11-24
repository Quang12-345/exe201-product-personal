import { useState, useEffect, useMemo } from 'react'
import {
  getAdminReviews,
  togglePublishReview,
  toggleFeatureReview,
  deleteCustomerReview,
} from '../../../services/reviewService.js'
import { notify as showToast } from '../../../components/common/toast.jsx'
import { StarIcon, CheckCircleIcon, TrashIcon, SearchIcon } from '../../../components/common/icons.jsx'
import './AdminCustomerReviewsReport.css'

const CATEGORY_NAMES = {
  general: 'Trải nghiệm chung',
  rag_ai: 'Trợ lý AI & Trích dẫn',
  study_aid: 'Thẻ Flashcard 3D',
  exam: 'Thi trắc nghiệm & Word',
  pricing: 'Gói Pro & Thanh toán',
}

const CATEGORY_COLORS = {
  general: '#f1f5f9',
  rag_ai: '#e0f2fe',
  study_aid: '#dcfce7',
  exam: '#fef3c7',
  pricing: '#fae8ff',
}

function getInitials(name = '') {
  const parts = name.trim().split(' ')
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  }
  return name.slice(0, 2).toUpperCase()
}

export default function AdminCustomerReviewsReport() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [starFilter, setStarFilter] = useState('all')
  const [catFilter, setCatFilter] = useState('all')

  const fetchReviews = async () => {
    try {
      setLoading(true)
      const res = await getAdminReviews()
      setData(res)
    } catch {
      showToast('Không thể tải dữ liệu đánh giá của khách hàng.', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchReviews()
  }, [])

  const handleTogglePublish = async (id) => {
    try {
      const updated = await togglePublishReview(id)
      showToast(
        updated.is_published
          ? 'Đã hiển thị đánh giá lên trang chủ.'
          : 'Đã ẩn đánh giá khỏi trang chủ.',
        'success'
      )
      setData((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          reviews: prev.reviews.map((r) => (r.id === id ? updated : r)),
        }
      })
    } catch {
      showToast('Thao tác thất bại. Vui lòng thử lại!', 'error')
    }
  }

  const handleToggleFeature = async (id) => {
    try {
      const updated = await toggleFeatureReview(id)
      showToast(
        updated.is_featured
          ? 'Đã ghim đánh giá nổi bật trên trang chủ!'
          : 'Đã bỏ ghim đánh giá.',
        'success'
      )
      setData((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          reviews: prev.reviews.map((r) => (r.id === id ? updated : r)),
        }
      })
    } catch {
      showToast('Thao tác thất bại. Vui lòng thử lại!', 'error')
    }
  }

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa đánh giá của "${name}" không?`)) {
      return
    }
    try {
      await deleteCustomerReview(id)
      showToast('Đã xóa đánh giá thành công.', 'success')
      setData((prev) => {
        if (!prev) return prev
        const filtered = prev.reviews.filter((r) => r.id !== id)
        return {
          ...prev,
          total_reviews: Math.max(0, prev.total_reviews - 1),
          reviews: filtered,
        }
      })
    } catch {
      showToast('Không thể xóa đánh giá.', 'error')
    }
  }

  const filteredReviews = useMemo(() => {
    if (!data?.reviews) return []
    return data.reviews.filter((r) => {
      const matchSearch =
        search === '' ||
        r.user_name.toLowerCase().includes(search.toLowerCase()) ||
        r.comment.toLowerCase().includes(search.toLowerCase()) ||
        (r.role_tag && r.role_tag.toLowerCase().includes(search.toLowerCase()))

      const matchStar = starFilter === 'all' || String(r.rating) === starFilter
      const matchCat = catFilter === 'all' || r.category === catFilter

      return matchSearch && matchStar && matchCat
    })
  }, [data, search, starFilter, catFilter])

  if (loading && !data) {
    return (
      <div className="dmrs-card" style={{ textAlign: 'center', padding: '36px' }}>
        <p className="dmrs-muted">Đang tải báo cáo đánh giá & phản hồi từ khách hàng...</p>
      </div>
    )
  }

  if (!data) return null

  const breakdown = data.rating_breakdown || {}
  const total = data.total_reviews || 1
  const publishedCount = data.reviews.filter((r) => r.is_published).length

  return (
    <div className="acrr-wrapper">
      {/* Header */}
      <div className="acrr-header-row">
        <div className="acrr-title-group">
          <h2 className="acrr-title">
            <span>⭐</span> Báo cáo Đánh giá & Phản hồi Khách hàng (Customer CSAT)
          </h2>
          <p className="acrr-subtitle">
            Minh chứng độ hài lòng và trải nghiệm thực tế từ sinh viên & giảng viên (Phục vụ đồ án EXE201)
          </p>
        </div>
        <button
          type="button"
          className="dmrs-btn dmrs-btn--light"
          onClick={fetchReviews}
          title="Tải lại số liệu mới nhất"
        >
          🔄 Làm mới dữ liệu
        </button>
      </div>

      {/* KPI Cards */}
      <div className="acrr-kpi-grid">
        <div className="acrr-kpi-card">
          <span className="acrr-kpi-label">Chỉ số hài lòng (CSAT)</span>
          <div className="acrr-kpi-val acrr-kpi-val--csat">
            {data.csat_rate}%
          </div>
          <span className="acrr-kpi-note">
            <CheckCircleIcon size={14} /> Tỷ lệ đánh giá 4★ - 5★ tích cực
          </span>
        </div>

        <div className="acrr-kpi-card">
          <span className="acrr-kpi-label">Điểm đánh giá trung bình</span>
          <div className="acrr-kpi-val acrr-kpi-val--star">
            ★ {data.average_rating.toFixed(1)} <span style={{ fontSize: 16, color: '#64748b' }}>/ 5.0</span>
          </div>
          <span className="acrr-kpi-note">Dựa trên thang điểm 5 sao</span>
        </div>

        <div className="acrr-kpi-card">
          <span className="acrr-kpi-label">Tổng lượt đánh giá</span>
          <div className="acrr-kpi-val">
            {data.total_reviews}
          </div>
          <span className="acrr-kpi-note">Sinh viên & Giảng viên đã gửi</span>
        </div>

        <div className="acrr-kpi-card">
          <span className="acrr-kpi-label">Đang hiển thị trang chủ</span>
          <div className="acrr-kpi-val" style={{ color: '#2563eb' }}>
            {publishedCount}
          </div>
          <span className="acrr-kpi-note">Xuất hiện mục Social Proof</span>
        </div>
      </div>

      {/* Breakdown Rows */}
      <div className="acrr-breakdown-grid">
        {/* Rating Breakdown */}
        <div className="acrr-breakdown-card">
          <h3 className="acrr-breakdown-title">Phân bổ đánh giá theo số sao</h3>
          {[5, 4, 3, 2, 1].map((s) => {
            const count = breakdown[String(s)] || 0
            const pct = total > 0 ? Math.round((count / total) * 100) : 0
            return (
              <div key={s} className="acrr-bar-row">
                <span style={{ width: 45 }}>{s} sao</span>
                <div className="acrr-bar-track">
                  <div
                    className={`acrr-bar-fill acrr-bar-fill--${s}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span style={{ width: 65, textAlign: 'right', color: '#64748b' }}>
                  {count} ({pct}%)
                </span>
              </div>
            )
          })}
        </div>

        {/* Category Breakdown */}
        <div className="acrr-breakdown-card">
          <h3 className="acrr-breakdown-title">Mối quan tâm theo tính năng</h3>
          {Object.entries(CATEGORY_NAMES).map(([key, label]) => {
            const count = data.category_breakdown?.[key] || 0
            const pct = total > 0 ? Math.round((count / total) * 100) : 0
            return (
              <div key={key} className="acrr-bar-row">
                <span style={{ width: 160, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {label}
                </span>
                <div className="acrr-bar-track">
                  <div
                    className="acrr-bar-fill"
                    style={{ width: `${pct}%`, backgroundColor: '#2563eb' }}
                  />
                </div>
                <span style={{ width: 65, textAlign: 'right', color: '#64748b' }}>
                  {count} lượt
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Toolbar */}
      <div className="acrr-toolbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <input
            type="text"
            className="acrr-search-input"
            placeholder="🔍 Tìm theo tên, nhận xét, khoa..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <div className="acrr-filters">
            <select
              className="acrr-select"
              value={starFilter}
              onChange={(e) => setStarFilter(e.target.value)}
            >
              <option value="all">Tất cả số sao</option>
              <option value="5">5 sao ⭐⭐⭐⭐⭐</option>
              <option value="4">4 sao ⭐⭐⭐⭐</option>
              <option value="3">3 sao ⭐⭐⭐</option>
              <option value="2">2 sao ⭐⭐</option>
              <option value="1">1 sao ⭐</option>
            </select>

            <select
              className="acrr-select"
              value={catFilter}
              onChange={(e) => setCatFilter(e.target.value)}
            >
              <option value="all">Tất cả khía cạnh</option>
              {Object.entries(CATEGORY_NAMES).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>
        </div>

        <span className="dmrs-muted" style={{ fontSize: 13, fontWeight: 700 }}>
          Hiển thị {filteredReviews.length} / {data.reviews.length} đánh giá
        </span>
      </div>

      {/* Table Card */}
      <div className="dmrs-card dmrs-table-card">
        <div className="dmrs-table-scroll">
          <table className="dmrs-table">
            <thead>
              <tr>
                <th style={{ width: 220 }}>Người đánh giá</th>
                <th style={{ width: 110 }}>Đánh giá</th>
                <th style={{ width: 160 }}>Khía cạnh</th>
                <th>Lời nhận xét / Cảm nhận</th>
                <th style={{ width: 130 }}>Thời gian</th>
                <th style={{ width: 110 }}>Trạng thái</th>
                <th style={{ width: 160, textAlign: 'center' }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {filteredReviews.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: 32 }} className="dmrs-muted">
                    Không tìm thấy đánh giá nào phù hợp với bộ lọc.
                  </td>
                </tr>
              ) : (
                filteredReviews.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div
                          style={{
                            width: 34,
                            height: 34,
                            backgroundColor: '#2563eb',
                            color: '#ffffff',
                            borderRadius: 8,
                            border: '1.5px solid #000000',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 13,
                            fontWeight: 800,
                            flexShrink: 0,
                          }}
                        >
                          {getInitials(r.user_name)}
                        </div>
                        <div>
                          <strong style={{ display: 'block', fontSize: 13.5 }}>
                            {r.user_name}
                          </strong>
                          <span className="dmrs-muted" style={{ fontSize: 11.5 }}>
                            {r.role_tag || 'Sinh viên'}
                          </span>
                        </div>
                      </div>
                    </td>

                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 2, color: '#eab308' }}>
                        {Array.from({ length: 5 }).map((_, i) => (
                          <span
                            key={i}
                            style={{
                              fontSize: 14,
                              color: i < r.rating ? '#eab308' : '#cbd5e1',
                            }}
                          >
                            ★
                          </span>
                        ))}
                      </div>
                    </td>

                    <td>
                      <span
                        className="acrr-badge-cat"
                        style={{ backgroundColor: CATEGORY_COLORS[r.category] || '#f1f5f9' }}
                      >
                        {CATEGORY_NAMES[r.category] || r.category}
                      </span>
                    </td>

                    <td>
                      <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.5, color: '#1e293b' }}>
                        "{r.comment}"
                      </p>
                    </td>

                    <td>
                      <span className="dmrs-muted" style={{ fontSize: 12.5 }}>
                        {new Date(r.created_at).toLocaleDateString('vi-VN', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                        })}
                      </span>
                    </td>

                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <span
                          className={`dmrs-badge ${
                            r.is_published ? 'dmrs-badge--active' : 'dmrs-badge--inactive'
                          }`}
                          style={{ fontSize: 11 }}
                        >
                          {r.is_published ? '✓ Hiển thị' : 'Đã ẩn'}
                        </span>
                        {r.is_featured && (
                          <span
                            style={{
                              fontSize: 11,
                              color: '#854d0e',
                              background: '#fef08a',
                              padding: '2px 6px',
                              borderRadius: 4,
                              fontWeight: 800,
                              border: '1px solid #000000',
                              textAlign: 'center',
                            }}
                          >
                            ⭐ Nổi bật
                          </span>
                        )}
                      </div>
                    </td>

                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                        <button
                          type="button"
                          className={`acrr-btn-action ${r.is_published ? 'is-active' : ''}`}
                          onClick={() => handleTogglePublish(r.id)}
                          title={r.is_published ? 'Bấm để ẩn khỏi trang chủ' : 'Bấm để hiện lên trang chủ'}
                        >
                          {r.is_published ? 'Ẩn' : 'Hiện'}
                        </button>

                        <button
                          type="button"
                          className={`acrr-btn-action ${r.is_featured ? 'is-active' : ''}`}
                          onClick={() => handleToggleFeature(r.id)}
                          title={r.is_featured ? 'Bỏ ghim nổi bật' : 'Ghim làm review tiêu biểu'}
                        >
                          {r.is_featured ? 'Bỏ ghim' : 'Ghim ⭐'}
                        </button>

                        <button
                          type="button"
                          className="acrr-btn-action acrr-btn-action--del"
                          onClick={() => handleDelete(r.id, r.user_name)}
                          title="Xóa đánh giá này"
                        >
                          <TrashIcon size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
