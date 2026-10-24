import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import {
  BotIcon, UserIcon, CheckCircleIcon, FileTextIcon, BookmarkIcon,
  ThumbsUpIcon, ThumbsDownIcon, ClockIcon, CopyIcon, AlertCircleIcon, LinkIcon,
} from './icons.jsx'
import { notify } from './toast.jsx'
import DocumentViewerModal from './DocumentViewerModal.jsx'
import { getDocumentForViewer } from '../../services/documentViewService'
import { clearFeedback, sendFeedback, sendSignal } from '../../services/feedbackService'

// Tin nhắn chat dùng CHUNG cho student + lecturer.
// - Khối nguồn trích dẫn; bấm nguồn → mở popup tài liệu (+ tín hiệu implicit 'opened_source').
// - 👍/👎 → EXPLICIT feedback. Copy/Lưu → IMPLICIT feedback. Badge độ tin cậy → SYSTEM feedback.
function ChatMessage({ msg, onSave, saved = false }) {
  const [viewingDoc, setViewingDoc] = useState(null)
  const [loadingId, setLoadingId] = useState(null)
  // Khởi tạo từ đánh giá đã lưu (msg.myRating) → giữ trạng thái 👍/👎 qua reload trang.
  const [rating, setRating] = useState(msg.myRating || null) // 'up' | 'down' | null
  const [reason, setReason] = useState('')
  // Đánh giá khôi phục từ DB → không hỏi lại lý do (chỉ hỏi khi vừa bấm 👎 trong phiên).
  const [reasonSent, setReasonSent] = useState(!!msg.myRating)
  const [copied, setCopied] = useState(false)

  const rate = (r) => {
    if (rating === r) {
      setRating(null)
      setReason('')
      setReasonSent(false)
      clearFeedback({ messageId: msg.messageId }).catch(() => {})
      return
    }
    setRating(r)
    setReason('')
    setReasonSent(r === 'up')
    sendFeedback({ messageId: msg.messageId, rating: r, reason: '' }).catch(() => {})
  }
  const submitReason = () => {
    setReasonSent(true)
    sendFeedback({ messageId: msg.messageId, rating: 'down', reason: reason.trim() }).catch(() => {})
  }

  // IMPLICIT: copy câu trả lời
  const handleCopy = async () => {
    try { await navigator.clipboard.writeText(msg.text || '') } catch { /* ignore */ }
    setCopied(true)
    setTimeout(() => setCopied(false), 1600)
    sendSignal({ messageId: msg.messageId, kind: 'implicit', name: 'copied' })
  }
  // IMPLICIT: lưu câu trả lời (gọi onSave gốc + ghi tín hiệu)
  const handleSave = () => {
    onSave?.(msg)
    sendSignal({ messageId: msg.messageId, kind: 'implicit', name: 'saved' })
  }

  const openSource = async (s) => {
    if (!s?.document_id || loadingId) return
    setLoadingId(s.document_id)
    sendSignal({ messageId: msg.messageId, kind: 'implicit', name: 'opened_source' }) // IMPLICIT
    try {
      const doc = await getDocumentForViewer(s.document_id)
      // Truyền trang + ĐOẠN TRÍCH (quote) để viewer nhảy đúng trang và bôi sáng đúng đoạn.
      if (doc) setViewingDoc({ ...doc, page: s.page_number || null, quote: s.quote || '' })
      else notify('Không mở được tài liệu nguồn (có thể đã bị xóa hoặc bạn không có quyền xem).', 'error')
    } catch {
      notify('Không mở được tài liệu nguồn. Vui lòng thử lại.', 'error')
    } finally {
      setLoadingId(null)
    }
  }

  if (msg.from === 'user') {
    return (
      <div className="chat-msg chat-msg--user">
        <div className="chat-bubble chat-bubble--user">{msg.text}</div>
        <span className="chat-avatar chat-avatar--user"><UserIcon size={16} /></span>
      </div>
    )
  }

  const body = msg.text ?? (msg.paragraphs || []).join('\n\n')
  // SYSTEM feedback: câu trả lời có dựa trên tài liệu không + độ tin cậy (điểm truy hồi).
  // Độ tin cậy: ƯU TIÊN giá trị backend (đa tín hiệu, đã hiệu chuẩn); cũ thì tính tạm.
  const hasText = (body || '').trim().length > 0
  const isGreetingMessage = String(msg.id || '').startsWith('g')
  const cf = msg.confidence
  const grounded = cf ? cf.grounded : (msg.sources?.length || 0) > 0
  const confVal = cf ? cf.value : (grounded ? Math.max(...msg.sources.map((s) => s.score || 0)) : 0)
  const confLabel = cf ? cf.level : confVal >= 0.7 ? 'cao' : confVal >= 0.5 ? 'trung bình' : 'thấp'
  const confClass = confLabel === 'cao' ? 'high' : confLabel === 'trung bình' ? 'med' : 'low'
  const confPct = Math.round(confVal * 100)
  const f = cf?.factors
  const confTitle = f
    ? `Cách tính độ tin cậy:\n• Liên quan nguồn tốt nhất: ${Math.round(f.top_relevance * 100)}%\n• Liên quan TB (top 3): ${Math.round(f.avg_relevance * 100)}%\n• Số nguồn hỗ trợ: ${f.n_sources}\n• Câu trả lời có trích dẫn [n]: ${f.cited ? 'có' : 'không'}`
    : 'Độ tin cậy dựa trên mức liên quan của nguồn truy hồi.'
  return (
    <div className="chat-msg">
      <span className="chat-avatar"><BotIcon size={16} /></span>
      <div className="chat-bubble">
        <div className="chat-md">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{body || ''}</ReactMarkdown>
        </div>

        {msg.sources?.length > 0 && (
          <div className="chat-citation">
            <div className="chat-citation-head"><CheckCircleIcon size={16} /> Nguồn trích dẫn</div>
            {msg.sources.map((s) =>
              s.timestamp ? (
                // Nguồn YouTube: link nhảy thẳng tới mốc thời gian + nhãn timestamp.
                <a
                  key={s.chunk_id || s.cite}
                  className="chat-citation-src chat-citation-src--video"
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={`Mở video tại ${s.timestamp}`}
                >
                  <ClockIcon size={14} /> [{s.cite}] {s.title} ⏱ {s.timestamp}
                </a>
              ) : s.url ? (
                // Nguồn trang web: mở trang gốc ở tab mới.
                <a
                  key={s.chunk_id || s.cite}
                  className="chat-citation-src chat-citation-src--web"
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Mở trang web nguồn"
                >
                  <LinkIcon size={14} /> [{s.cite}] {s.title}
                </a>
              ) : (
                // Nguồn tài liệu: bấm để mở popup xem đúng tài liệu nguồn.
                <button
                  key={s.chunk_id || s.cite}
                  type="button"
                  className="chat-citation-src chat-citation-src--link"
                  onClick={() => openSource(s)}
                  disabled={loadingId === s.document_id}
                  title="Mở tài liệu nguồn"
                >
                  <FileTextIcon size={14} /> [{s.cite}] {s.title}{s.page_number ? ` (tr.${s.page_number})` : ''}
                </button>
              )
            )}
          </div>
        )}

        {/* SYSTEM feedback: cảnh báo ngoài tài liệu — CHỈ với câu trả lời dạng kiến thức
            (đủ dài). Chào hỏi/xã giao/câu ngắn → không cảnh báo, không nguồn (tự nhiên). */}
        {hasText && !grounded && !isGreetingMessage && body.trim().length > 180 && (
          <div className="chat-trust chat-trust--warn">
            <AlertCircleIcon size={14} /> Câu trả lời không có nguồn trong tài liệu — hãy kiểm chứng thông tin.
          </div>
        )}
        {hasText && grounded && (
          <div className={'chat-trust chat-trust--' + confClass} title={confTitle}>
            <CheckCircleIcon size={14} /> Dựa trên tài liệu · độ tin cậy {confLabel} ({confPct}%)
          </div>
        )}

        <div className="chat-actions">
          {onSave && (msg.text || '').trim() && (
            <button
              className={'chat-act-btn' + (saved ? ' is-done' : '')}
              onClick={handleSave}
              disabled={saved}
              aria-label={saved ? 'Đã lưu' : 'Lưu câu trả lời'}
              title={saved ? 'Đã lưu' : 'Lưu câu trả lời'}
            >
              {saved ? <CheckCircleIcon size={16} /> : <BookmarkIcon size={16} />}
            </button>
          )}

          {/* IMPLICIT: copy câu trả lời */}
          {hasText && (
            <button
              className={'chat-act-btn' + (copied ? ' is-done' : '')}
              onClick={handleCopy}
              aria-label={copied ? 'Đã chép' : 'Sao chép câu trả lời'}
              title={copied ? 'Đã chép' : 'Sao chép câu trả lời'}
            >
              {copied ? <CheckCircleIcon size={16} /> : <CopyIcon size={16} />}
            </button>
          )}

          {/* Feedback EXPLICIT 👍/👎 — đã chọn 1 bên thì ẨN bên còn lại (giữ qua reload) */}
          {msg.messageId && (msg.text || '').trim() && (
            <>
              <span className="chat-actions-sep" />
              {rating !== 'down' && (
                <button
                  type="button"
                  className={'chat-act-btn' + (rating === 'up' ? ' is-up' : '')}
                  onClick={() => rate('up')}
                  aria-label="Hữu ích"
                  title="Hữu ích"
                >
                  <ThumbsUpIcon size={16} />
                </button>
              )}
              {rating !== 'up' && (
                <button
                  type="button"
                  className={'chat-act-btn' + (rating === 'down' ? ' is-down' : '')}
                  onClick={() => rate('down')}
                  aria-label="Chưa tốt"
                  title="Chưa tốt"
                >
                  <ThumbsDownIcon size={16} />
                </button>
              )}
              {rating && <span className="chat-fb-thanks-mini">Cảm ơn!</span>}
            </>
          )}
        </div>

        {/* Khi 👎 → hỏi lý do (tuỳ chọn) để cải thiện */}
        {rating === 'down' && !reasonSent && (
          <div className="chat-fb-reason">
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Vì sao chưa tốt? (tuỳ chọn) — giúp cải thiện AI"
              onKeyDown={(e) => { if (e.key === 'Enter') submitReason() }}
            />
            <button type="button" onClick={submitReason}>Gửi</button>
          </div>
        )}
      </div>

      {viewingDoc && <DocumentViewerModal doc={viewingDoc} onClose={() => setViewingDoc(null)} />}
    </div>
  )
}

export default ChatMessage
