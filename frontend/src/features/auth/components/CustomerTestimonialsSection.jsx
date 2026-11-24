import { useState, useEffect } from 'react'
import { getPublicReviews } from '../../../services/reviewService.js'
import CustomerReviewModal from '../../../components/common/CustomerReviewModal.jsx'
import { CheckCircleIcon } from '../../../components/common/icons.jsx'
import './CustomerTestimonialsSection.css'

function getInitials(name = '') {
  const parts = name.trim().split(' ')
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  }
  return name.slice(0, 2).toUpperCase()
}

export default function CustomerTestimonialsSection() {
  const [reviews, setReviews] = useState([])
  const [stats, setStats] = useState({
    average_rating: 5.0,
    total_reviews: 0,
    csat_rate: 100,
  })
  const [modalOpen, setModalOpen] = useState(false)

  const loadReviews = async () => {
    try {
      const data = await getPublicReviews()
      if (data && Array.isArray(data.reviews)) {
        setReviews(data.reviews)
        const total = data.total_reviews ?? data.reviews.length
        setStats({
          average_rating: data.average_rating || (total > 0 ? 5.0 : 0.0),
          total_reviews: total,
          csat_rate: total > 0 ? (data.csat_rate ?? 100) : 100,
        })
      }
    } catch {
      // Offline fallback
    }
  }

  useEffect(() => {
    loadReviews()
  }, [])

  return (
    <section className="cts-container" aria-label="Đánh giá từ khách hàng">
      <div className="cts-card-main">
        {/* Header */}
        <div className="cts-header">
          <div className="cts-badge">
            <span>✨</span> Minh chứng người dùng & Đánh giá thực tế
          </div>
          <h2 className="cts-title">Cộng đồng Sinh viên & Giảng viên nói gì?</h2>
          <p className="cts-subtitle">
            Hơn 120+ sinh viên và giảng viên các trường đại học đã trải nghiệm StudyMind để nâng cao hiệu suất học tập và quản lý lớp học.
          </p>
        </div>

        {/* Big metrics row */}
        <div className="cts-stats-row">
          <div className="cts-stat-box">
            <div className="cts-stat-value">
              <span>★</span> {stats.average_rating.toFixed(1)} / 5.0
            </div>
            <div className="cts-stat-label">Điểm hài lòng trung bình (CSAT)</div>
          </div>
          <div className="cts-stat-box">
            <div className="cts-stat-value">{stats.total_reviews}+</div>
            <div className="cts-stat-label">Lượt đánh giá & phản hồi</div>
          </div>
          <div className="cts-stat-box">
            <div className="cts-stat-value">{stats.csat_rate}%</div>
            <div className="cts-stat-label">Sinh viên nâng cao điểm số</div>
          </div>
        </div>

        {/* Grid of reviews */}
        <div className="cts-grid">
          {reviews.map((item, idx) => (
            <article key={item.id || idx} className="cts-review-item">
              <div>
                <div className="cts-review-header">
                  <div
                    className="cts-avatar"
                    style={{ backgroundColor: item.avatar_color || '#2563eb' }}
                  >
                    {getInitials(item.user_name)}
                  </div>
                  <div className="cts-user-info">
                    <span className="cts-user-name">{item.user_name}</span>
                    <span className="cts-user-tag">{item.role_tag || 'Sinh viên'}</span>
                  </div>
                </div>

                <div className="cts-stars" aria-label={`${item.rating} sao`}>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <span
                      key={i}
                      style={{ color: i < item.rating ? '#eab308' : '#cbd5e1' }}
                    >
                      ★
                    </span>
                  ))}
                </div>

                {item.title && <h3 className="cts-review-title">{item.title}</h3>}
                <p className="cts-review-comment">"{item.comment}"</p>
              </div>

              <div className="cts-review-footer">
                <span className="cts-verified-badge">
                  <CheckCircleIcon size={14} /> Người dùng đã xác thực
                </span>
                <span>{item.created_at ? new Date(item.created_at).toLocaleDateString('vi-VN') : 'Gần đây'}</span>
              </div>
            </article>
          ))}
        </div>

        {/* Action Button */}
        <div className="cts-cta-row">
          <button
            type="button"
            className="cts-btn-give-review"
            onClick={() => setModalOpen(true)}
          >
            ✍️ Viết đánh giá & Góp ý trải nghiệm
          </button>
        </div>
      </div>

      {/* Review Modal */}
      <CustomerReviewModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSuccess={loadReviews}
      />
    </section>
  )
}
