import { useState } from 'react'
import Portal from './Portal.jsx'
import { notify as showToast } from './toast.jsx'
import { XIcon } from './icons.jsx'
import { submitCustomerReview } from '../../services/reviewService.js'
import './CustomerReviewModal.css'

const CATEGORIES = [
  { key: 'general', label: 'Trải nghiệm chung' },
  { key: 'rag_ai', label: 'Trợ lý AI & Trích dẫn' },
  { key: 'study_aid', label: 'Thẻ Flashcard 3D' },
  { key: 'exam', label: 'Thi trắc nghiệm & Word' },
  { key: 'pricing', label: 'Gói Pro & Thanh toán' },
]

const RATING_LABELS = {
  1: 'Rất không hài lòng 😞',
  2: 'Chưa hài lòng 🙁',
  3: 'Bình thường 😐',
  4: 'Hài lòng & Tốt 😊',
  5: 'Rất hài lòng & Xuất sắc! 🌟',
}

export default function CustomerReviewModal({ isOpen, onClose, onSuccess }) {
  const [rating, setRating] = useState(5)
  const [hoverRating, setHoverRating] = useState(0)
  const [category, setCategory] = useState('general')
  const [comment, setComment] = useState('')
  const [loading, setLoading] = useState(false)

  if (!isOpen) return null

  const currentDisplayRating = hoverRating || rating

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!comment.trim()) {
      showToast('Vui lòng nhập lời nhận xét hoặc cảm nhận của bạn.', 'error')
      return
    }

    setLoading(true)
    try {
      await submitCustomerReview({
        rating,
        category,
        comment: comment.trim(),
      })
      showToast('Cảm ơn bạn đã gửi đánh giá quý báu cho StudyMind!', 'success')
      setComment('')
      if (onSuccess) onSuccess()
      onClose()
    } catch (err) {
      console.error('[CustomerReviewModal] Submit error:', err)
      const detail = err?.response?.data?.detail
      let errorMsg = 'Không thể gửi đánh giá. Vui lòng thử lại!'
      if (typeof detail === 'string') {
        errorMsg = detail
      } else if (Array.isArray(detail) && detail.length > 0) {
        errorMsg = detail.map((d) => d.msg || d.message || JSON.stringify(d)).join(', ')
      } else if (err?.response?.data?.message) {
        errorMsg = err.response.data.message
      } else if (err?.message) {
        errorMsg = err.message
      }
      showToast(errorMsg, 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Portal>
      <div className="crm-overlay" onClick={onClose} role="dialog" aria-modal="true">
        <div className="crm-card" onClick={(e) => e.stopPropagation()}>
          {/* Header */}
          <div className="crm-header">
            <div className="crm-title-box">
              <h3 className="crm-title">
                <span>⭐</span> Đánh giá StudyMind
              </h3>
              <p className="crm-subtitle">
                Chia sẻ cảm nhận thực tế của bạn để giúp đội ngũ hoàn thiện nền tảng học tập tốt hơn mỗi ngày.
              </p>
            </div>
            <button className="crm-close-btn" onClick={onClose} aria-label="Đóng modal">
              <XIcon size={16} />
            </button>
          </div>

          <form onSubmit={handleSubmit}>
            {/* Star Picker */}
            <div className="crm-star-picker">
              <div className="crm-stars-row">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    className={`crm-star-btn ${star <= currentDisplayRating ? 'is-active' : ''}`}
                    onClick={() => setRating(star)}
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(0)}
                    aria-label={`Chọn ${star} sao`}
                  >
                    ★
                  </button>
                ))}
              </div>
              <div className="crm-star-label">{RATING_LABELS[currentDisplayRating]}</div>
            </div>

            {/* Category selection */}
            <div className="crm-field">
              <label>Bạn muốn nhận xét về khía cạnh nào?</label>
              <div className="crm-category-row">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat.key}
                    type="button"
                    className={`crm-cat-pill ${category === cat.key ? 'is-active' : ''}`}
                    onClick={() => setCategory(cat.key)}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Comment */}
            <div className="crm-field">
              <label htmlFor="crm-comment">
                Cảm nhận chi tiết của bạn <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <textarea
                id="crm-comment"
                className="crm-textarea"
                placeholder="VD: Tính năng trích dẫn AI rất chính xác, giúp mình tiết kiệm nhiều giờ đọc slide..."
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                maxLength={1000}
                required
                rows={4}
              />
            </div>

            {/* Actions */}
            <div className="crm-actions">
              <button type="button" className="crm-btn-cancel" onClick={onClose} disabled={loading}>
                Để sau
              </button>
              <button type="submit" className="crm-btn-submit" disabled={loading}>
                {loading ? 'Đang gửi...' : 'Gửi đánh giá ✨'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Portal>
  )
}
