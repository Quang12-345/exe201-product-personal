import { useState, useEffect } from 'react'
import { SparklesIcon, ArrowRightIcon } from '../../../components/common/icons.jsx'
import { generateFlashcards, deleteFlashcard, createFlashcard } from '../services/studyService'
import { notify } from '../../../components/common/toast.jsx'

export default function FlashcardViewer({
  documentId,
  flashcards = [],
  setFlashcards,
  onRefresh,
  isPro = true,
  onUpgradePro,
  checkoutBusy = false,
}) {
  const cards = flashcards || []
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isFlipped, setIsFlipped] = useState(false)
  const [loading, setLoading] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)
  const [newFront, setNewFront] = useState('')
  const [newBack, setNewBack] = useState('')

  // Reset về thẻ đầu tiên khi chuyển tài liệu
  useEffect(() => {
    setCurrentIndex(0)
    setIsFlipped(false)
  }, [documentId])

  const total = cards.length

  // Đảm bảo currentIndex luôn hợp lệ khi số lượng thẻ thay đổi
  useEffect(() => {
    if (total > 0 && currentIndex >= total) {
      setCurrentIndex(Math.max(0, total - 1))
    }
  }, [total, currentIndex])

  const currentCard = total > 0 ? cards[currentIndex] : null

  const handleNext = () => {
    setIsFlipped(false)
    setCurrentIndex((prev) => (prev + 1) % total)
  }

  const handlePrev = () => {
    setIsFlipped(false)
    setCurrentIndex((prev) => (prev - 1 + total) % total)
  }

  const handleFlip = () => {
    setIsFlipped((prev) => !prev)
  }

  const handleGenerateAI = async () => {
    if (!isPro) {
      notify('Tính năng tạo Flashcard bằng AI chỉ dành riêng cho gói Pro. Vui lòng nâng cấp tài khoản!', 'error')
      onUpgradePro?.()
      return
    }
    if (!documentId) return
    setLoading(true)
    try {
      const generated = await generateFlashcards(documentId, 10)
      const list = generated || []
      const updated = [...cards, ...list]
      if (setFlashcards) {
        setFlashcards(updated)
      }
      setCurrentIndex(cards.length)
      setIsFlipped(false)
      notify(`AI đã tạo thành công ${list.length} thẻ flashcard!`)
    } catch (err) {
      const detail = err.response?.data?.detail
      notify(typeof detail === 'string' ? detail : detail?.message || 'Lỗi khi sinh flashcard bằng AI', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteCard = async () => {
    if (!currentCard) return
    if (!window.confirm('Bạn có chắc muốn xóa thẻ flashcard này?')) return
    const cardIdToDelete = currentCard.id
    try {
      await deleteFlashcard(cardIdToDelete)
      const remaining = cards.filter((c) => c.id !== cardIdToDelete)
      if (setFlashcards) {
        setFlashcards(remaining)
      }
      setIsFlipped(false)

      if (currentIndex >= remaining.length && remaining.length > 0) {
        setCurrentIndex(remaining.length - 1)
      } else if (remaining.length === 0) {
        setCurrentIndex(0)
      }
      notify('Đã xóa thẻ flashcard')
    } catch (err) {
      notify('Lỗi khi xóa thẻ flashcard', 'error')
    }
  }

  const handleCreateManual = async (e) => {
    e.preventDefault()
    if (!isPro) {
      notify('Tính năng thêm Flashcard chỉ dành riêng cho gói Pro. Vui lòng nâng cấp tài khoản!', 'error')
      onUpgradePro?.()
      return
    }
    if (!newFront.trim() || !newBack.trim()) return
    setLoading(true)
    try {
      const created = await createFlashcard(documentId, { front_text: newFront, back_text: newBack })
      const updated = [...cards, created]
      if (setFlashcards) {
        setFlashcards(updated)
      }
      setCurrentIndex(updated.length - 1)
      setIsFlipped(false)
      setNewFront('')
      setNewBack('')
      setShowAddModal(false)
      notify('Đã thêm flashcard mới')
    } catch (err) {
      notify('Lỗi khi thêm thẻ', 'error')
    } finally {
      setLoading(false)
    }
  }

  if (!isPro) {
    return (
      <div className="study-pro-locked-box">
        <div className="study-pro-locked-icon">🔒</div>
        <h3 className="study-pro-locked-title">Thẻ Flashcard chỉ dành cho DMRS Pro</h3>
        <p className="study-pro-locked-desc">
          Tài khoản của bạn hiện là gói Miễn phí. Toàn bộ thẻ ghi nhớ Flashcard và tính năng tự động tạo thẻ bằng AI chỉ có thể sử dụng khi nâng cấp gói <strong>DMRS Pro</strong>.
        </p>
        <button
          type="button"
          className="study-pro-upgrade-btn"
          onClick={onUpgradePro}
          disabled={checkoutBusy}
        >
          {checkoutBusy ? 'Đang kết nối...' : '👑 Nâng cấp DMRS Pro để mở khóa · 99.000đ/tháng'}
        </button>
      </div>
    )
  }

  return (
    <div>
      {/* Khi chưa có thẻ nào */}
      {total === 0 ? (
        <div className="study-empty">
          <SparklesIcon size={44} style={{ color: '#1a56db' }} />
          <h4>Tài liệu chưa có thẻ Flashcard nào</h4>
          <p>Sử dụng AI để tự động phân tích và tạo bộ câu hỏi khái niệm giúp bạn ôn thi nhanh chóng.</p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 16 }}>
            <button
              type="button"
              className={`fc-btn fc-btn--primary ${!isPro ? 'fc-btn--pro-locked' : ''}`}
              onClick={handleGenerateAI}
              disabled={loading}
              title={!isPro ? 'Cần tài khoản Pro để sử dụng' : 'AI sinh bộ Flashcard'}
            >
              <SparklesIcon size={18} />
              {loading ? 'AI đang đọc tài liệu & tạo thẻ...' : 'AI sinh bộ Flashcard ngay'}
              {!isPro && <span className="pro-tag-badge">👑 Pro</span>}
            </button>
            <button
              type="button"
              className="fc-btn"
              onClick={() => {
                if (!isPro) {
                  notify('Vui lòng nâng cấp Pro để thêm thẻ Flashcard!', 'error')
                  onUpgradePro?.()
                  return
                }
                setShowAddModal(true)
              }}
              disabled={loading}
            >
              + Thêm thẻ thủ công
              {!isPro && <span className="pro-tag-badge">👑 Pro</span>}
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Thanh công cụ phụ */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <span style={{ fontSize: 15, fontWeight: 600, color: '#475569' }}>
              Thẻ {currentIndex + 1} / {total}
            </span>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="button"
                className="fc-btn"
                onClick={() => {
                  if (!isPro) {
                    notify('Vui lòng nâng cấp Pro để thêm thẻ Flashcard!', 'error')
                    onUpgradePro?.()
                    return
                  }
                  setShowAddModal(true)
                }}
                style={{ fontSize: 13, padding: '6px 14px' }}
              >
                + Thêm thẻ thủ công
                {!isPro && <span className="pro-tag-badge">👑 Pro</span>}
              </button>
              <button
                type="button"
                className={`fc-btn fc-btn--primary ${!isPro ? 'fc-btn--pro-locked' : ''}`}
                onClick={handleGenerateAI}
                disabled={loading}
                style={{ fontSize: 13, padding: '6px 14px' }}
                title={!isPro ? 'Cần tài khoản Pro để sử dụng' : 'AI tạo thêm'}
              >
                <SparklesIcon size={15} />
                {loading ? 'Đang sinh thêm...' : 'AI tạo thêm'}
                {!isPro && <span className="pro-tag-badge">👑 Pro</span>}
              </button>
            </div>
          </div>

          {/* 3D Flip Card */}
          <div className="fc-scene" onClick={handleFlip}>
            <div className={`fc-card ${isFlipped ? 'is-flipped' : ''}`}>
              {/* Mặt trước */}
              <div className="fc-face fc-face--front">
                <span className="fc-badge fc-badge--front">Mặt trước · Khái niệm / Câu hỏi</span>
                <div className="fc-content">
                  {currentCard?.front_text}
                </div>
                <div className="fc-hint">👉 Nhấp vào thẻ để lật xem đáp án</div>
              </div>

              {/* Mặt sau */}
              <div className="fc-face fc-face--back">
                <span className="fc-badge fc-badge--back">Mặt sau · Định nghĩa / Đáp án</span>
                <div className="fc-content">
                  {currentCard?.back_text}
                </div>
                <div className="fc-hint">👉 Nhấp vào thẻ để lật lại</div>
              </div>
            </div>
          </div>

          {/* Điều khiển lật thẻ */}
          <div className="fc-controls">
            <button
              type="button"
              className="fc-btn"
              onClick={handlePrev}
              title="Thẻ trước đó"
            >
              ◀ Trước
            </button>

            <button
              type="button"
              className="fc-btn fc-btn--primary"
              onClick={handleFlip}
              style={{ minWidth: 130 }}
            >
              🔄 {isFlipped ? 'Xem câu hỏi' : 'Lật xem đáp án'}
            </button>

            <button
              type="button"
              className="fc-btn"
              onClick={handleNext}
              title="Thẻ tiếp theo"
            >
              Tiếp theo ▶
            </button>

            <button
              type="button"
              className="fc-btn"
              onClick={handleDeleteCard}
              style={{ color: '#dc2626', borderColor: '#fca5a5', marginLeft: 16 }}
              title="Xóa thẻ này"
            >
              Xóa
            </button>
          </div>
        </>
      )}

      {/* Modal thêm thẻ thủ công */}
      {showAddModal && (
        <div className="st-modal-backdrop" onClick={() => setShowAddModal(false)}>
          <div className="st-modal" style={{ maxWidth: 500 }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>Thêm thẻ Flashcard mới</h3>
            <form onSubmit={handleCreateManual}>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>
                  Mặt trước (Khái niệm / Câu hỏi):
                </label>
                <textarea
                  className="st-input"
                  rows={3}
                  value={newFront}
                  onChange={(e) => setNewFront(e.target.value)}
                  placeholder="Ví dụ: Định luật Ôm là gì?"
                  required
                  style={{ width: '100%', resize: 'vertical' }}
                />
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>
                  Mặt sau (Định nghĩa / Đáp án):
                </label>
                <textarea
                  className="st-input"
                  rows={4}
                  value={newBack}
                  onChange={(e) => setNewBack(e.target.value)}
                  placeholder="Ví dụ: Cường độ dòng điện qua dây dẫn tỉ lệ thuận với hiệu điện thế..."
                  required
                  style={{ width: '100%', resize: 'vertical' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button
                  type="button"
                  className="fc-btn"
                  onClick={() => setShowAddModal(false)}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="fc-btn fc-btn--primary"
                  disabled={loading}
                >
                  Lưu thẻ
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
