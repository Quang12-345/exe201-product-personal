import { useEffect, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { getFeedbackSummary } from '../../../services/feedbackService'
import { ThumbsUpIcon, ThumbsDownIcon, XIcon } from '../../../components/common/icons.jsx'
import Portal from '../../../components/common/Portal.jsx'

// Thẻ tổng hợp feedback câu trả lời AI (khép vòng lặp Product AI) — hiển thị ở trang Phân tích.
function FeedbackSummaryCard() {
  const [s, setS] = useState(null)
  const [showBadQuestions, setShowBadQuestions] = useState(false)
  const [isModalMounted, setIsModalMounted] = useState(false)

  useEffect(() => {
    getFeedbackSummary().then(setS).catch(() => setS(null))
  }, [])

  useEffect(() => {
    if (!isModalMounted) return

    const frame = window.requestAnimationFrame(() => setShowBadQuestions(true))
    return () => window.cancelAnimationFrame(frame)
  }, [isModalMounted])

  useEffect(() => {
    if (!showBadQuestions) return

    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'auto'

    return () => {
      document.body.style.overflow = prevOverflow
    }
  }, [showBadQuestions])

  if (!s) return null
  const rate = Math.round((s.helpful_rate || 0) * 100)
  const badQuestions = s.bad_questions || []
  const canOpenBadQuestions = badQuestions.length > 0

  const normalizeParagraphs = (rawText) => {
    const lines = rawText
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)

    const normalized = []

    lines.forEach((line) => {
      const isListItem = /^([-*+] |\d+\.)/.test(line)
      if (isListItem) {
        normalized.push(line)
        return
      }

      if (!normalized.length) {
        normalized.push(line)
        return
      }

      const lastLine = normalized[normalized.length - 1]
      normalized[normalized.length - 1] = `${lastLine} ${line}`
    })

    return normalized.join('\n').trim()
  }

  const normalizeAnswer = (text) => {
    if (!text) return ''

    const marker = '**Có thể bạn muốn hỏi:**'
    const normalized = text
      .replace(/\r\n/g, '\n')
      .replace(/\t/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim()

    const markerIndex = normalized.indexOf(marker)
    if (markerIndex === -1) return normalizeParagraphs(normalized)

    const before = normalizeParagraphs(normalized.slice(0, markerIndex).trim())
    const after = normalizeParagraphs(normalized.slice(markerIndex + marker.length).trim())
    const markerWithContent = after.match(/^([-*+] |\d+\.)/) ? `${marker}\n${after}` : `${marker} ${after}`

    return before ? `${before}\n${markerWithContent}` : markerWithContent
  }

  return (
    <div className="dmrs-card dmrs-feedback-card">
      <h3 className="dmrs-card-title">
        Phản hồi câu trả lời AI <span className="dmrs-muted" style={{ fontWeight: 400 }}>· feedback loop</span>
      </h3>

      <div className="dmrs-feedback-stats">
        <div className="dmrs-feedback-stat">
          <strong className="dmrs-feedback-rate">{rate}%</strong>
          <span>Tỉ lệ hữu ích</span>
        </div>
        <div className="dmrs-feedback-stat">
          <strong className="up"><ThumbsUpIcon size={16} /> {s.up}</strong>
          <span>Hữu ích</span>
        </div>
        <button
          type="button"
          className="dmrs-feedback-stat dmrs-feedback-stat-btn"
          onClick={() => {
            if (!canOpenBadQuestions) return
            setIsModalMounted(true)
            setShowBadQuestions(true)
          }}
          disabled={!canOpenBadQuestions}
          aria-label="Xem danh sách câu hỏi được đánh giá chưa tốt"
          title={canOpenBadQuestions ? 'Xem danh sách câu hỏi chưa tốt' : 'Chưa có câu hỏi được đánh giá chưa tốt'}
        >
          <strong className="down"><ThumbsDownIcon size={16} /> {s.down}</strong>
          <span>Chưa tốt</span>
        </button>
        <div className="dmrs-feedback-stat">
          <strong>{s.total}</strong>
          <span>Tổng lượt đánh giá</span>
        </div>
      </div>

      {s.recent?.length > 0 ? (
        <div className="dmrs-feedback-recent">
          <p className="dmrs-muted">Góp ý gần đây của người dùng:</p>
          {s.recent.map((r, i) => (
            <div key={i} className={'dmrs-feedback-reason is-' + r.rating}>
              {r.rating === 'up' ? <ThumbsUpIcon size={13} /> : <ThumbsDownIcon size={13} />}
              <span>{r.reason}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="dmrs-muted">
          Chưa có góp ý kèm lý do. Người dùng bấm 👍/👎 dưới mỗi câu trả lời để hệ thống cải thiện AI.
        </p>
      )}

      {isModalMounted && (
        <Portal>
          <div
            className={`dmrs-feedback-modal-backdrop ${showBadQuestions ? 'is-visible' : 'is-hidden'}`}
            onClick={() => {
              setShowBadQuestions(false)
              setTimeout(() => setIsModalMounted(false), 480)
            }}
          >
            <div
              className={`dmrs-modal dmrs-feedback-modal ${showBadQuestions ? 'is-visible' : 'is-hidden'}`}
              role="dialog"
              aria-modal="true"
              aria-labelledby="bad-feedback-title"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="dmrs-modal-head">
                <div>
                  <h3 id="bad-feedback-title">Câu hỏi được đánh giá chưa tốt</h3>
                  <p className="dmrs-muted">{badQuestions.length} câu hỏi cần xem lại</p>
                </div>
                <button
                  type="button"
                  className="dmrs-icon-btn"
                  onClick={() => {
                    setShowBadQuestions(false)
                    window.setTimeout(() => setIsModalMounted(false), 480)
                  }}
                  aria-label="Đóng"
                  title="Đóng"
                >
                  <XIcon size={18} />
                </button>
              </div>

              <div className="dmrs-feedback-question-list">
                {badQuestions.map((item, i) => (
                  <div key={item.message_id || i} className="dmrs-feedback-question">
                    <div className="dmrs-feedback-question-head">
                      <span className="dmrs-badge dmrs-badge--danger">
                        <ThumbsDownIcon size={12} /> Chưa tốt
                      </span>
                      {item.created_at && (
                        <span className="dmrs-muted">
                          {new Date(item.created_at).toLocaleString('vi-VN')}
                        </span>
                      )}
                    </div>
                    <strong>{item.question || 'Không tìm thấy nội dung câu hỏi'}</strong>
                    {item.reason && <p className="dmrs-feedback-question-reason">Lý do: {item.reason}</p>}
                    {item.answer && (
                      <div className="dmrs-feedback-question-answer chat-md">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {normalizeAnswer(item.answer)}
                        </ReactMarkdown>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Portal>
      )}
    </div>
  )
}

export default FeedbackSummaryCard
