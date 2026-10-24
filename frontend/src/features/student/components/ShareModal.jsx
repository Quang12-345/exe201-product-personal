import { useState } from 'react'
import { buildShareLink } from '../services/conversationService'
import { XIcon, CheckCircleIcon } from '../../../components/common/icons.jsx'

// Modal chia sẻ cuộc trò chuyện: 1 link ai cũng có thể sao chép và xem.
function ShareModal({ conversation, onClose }) {
  const link = buildShareLink(conversation.id)
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link)
    } catch {
      /* clipboard có thể bị chặn — bỏ qua */
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="st-modal-backdrop" onClick={onClose}>
      <div className="st-modal" onClick={(e) => e.stopPropagation()}>
        <div className="st-modal-head">
          <h3>Chia sẻ cuộc trò chuyện</h3>
          <button className="st-icon-btn" onClick={onClose} aria-label="Đóng"><XIcon size={18} /></button>
        </div>
        <p className="st-muted">Bất kỳ ai có liên kết dưới đây đều có thể xem nội dung cuộc trò chuyện này.</p>

        <label className="st-share-label">Liên kết chia sẻ</label>
        <div className="st-share-link">
          <input value={link} readOnly onFocus={(e) => e.target.select()} />
          <button className={'st-btn st-btn--primary' + (copied ? ' is-copied' : '')} onClick={copy}>
            {copied ? <><CheckCircleIcon size={16} /> Đã sao chép</> : 'Sao chép'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default ShareModal
