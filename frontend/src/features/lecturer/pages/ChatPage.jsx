import { useState, useEffect, useRef } from 'react'
import { useChatConversations } from '../../../hooks/useChatConversations.js'
import TypingIndicator from '../../../components/common/TypingIndicator.jsx'
import ChatMessage from '../../../components/common/ChatMessage.jsx'
import SuggestedQuestions from '../../../components/common/SuggestedQuestions.jsx'
import {
  BotIcon, PaperclipIcon, SendIcon,
  PlusIcon, EditIcon, TrashIcon, HistoryIcon, XIcon,
} from '../../../components/common/icons.jsx'
import { comingSoon } from '../../../components/common/comingSoon.jsx'

const LEC_SUGGESTIONS = [
  'Quy định về coi thi và chấm thi kết thúc học phần?',
  'Hướng dẫn nộp đề cương chi tiết học phần mới',
  'Quy trình đề xuất mở học phần tự chọn',
]

function greeting() {
  return {
    id: 'g' + Date.now(),
    from: 'ai',
    text: 'Xin chào! Tôi là trợ lý AI dành cho **Giảng viên**. Tôi trả lời dựa trên **quy định/tài liệu của nhà trường** và **tài liệu bạn đã tải lên**. Bạn muốn hỏi gì?',
  }
}

function LecturerChat() {
  const conv = useChatConversations({ greeting })
  const [input, setInput] = useState('')
  const [listOpen, setListOpen] = useState(false)
  const [renaming, setRenaming] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const bottomRef = useRef(null)

  useEffect(() => {
    try {
      const q = sessionStorage.getItem('dmrs_prefill_q')
      if (q) {
        setInput(q)
        sessionStorage.removeItem('dmrs_prefill_q')
      }
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [conv.messages, conv.sending])

  const submit = (e) => {
    e.preventDefault()
    const text = input.trim()
    if (!text) return
    conv.send(text)
    setInput('')
  }

  const renameConv = (e, c) => {
    e.stopPropagation()
    setRenaming(c)
  }

  const submitRename = (title) => {
    const nextTitle = title.trim()
    if (renaming && nextTitle) conv.rename(renaming.id, nextTitle)
    setRenaming(null)
  }

  const deleteConv = (e, c) => {
    e.stopPropagation()
    setDeleting(c)
  }

  const confirmDelete = () => {
    if (deleting) conv.remove(deleting.id)
    setDeleting(null)
  }

  return (
    <div className="lec-chat-layout">
      <aside className={'lec-convlist' + (listOpen ? ' is-open' : '')}>
        <button className="lec-new-chat" onClick={() => { conv.createNew(); setListOpen(false) }}>
          <PlusIcon size={16} /> Cuộc trò chuyện mới
        </button>
        <div className="lec-conv-items">
          {conv.list.length === 0 && <p className="dmrs-muted" style={{ padding: 12 }}>Chưa có cuộc trò chuyện.</p>}
          {conv.list.map((c) => (
            <button
              key={c.id}
              className={'lec-conv-item' + (c.id === conv.activeId ? ' is-active' : '')}
              onClick={() => { conv.select(c.id); setListOpen(false) }}
            >
              <span className="lec-conv-icon"><BotIcon size={16} /></span>
              <div className="lec-conv-text">
                <strong>{c.title}</strong>
                <span className="lec-conv-preview">{c.preview || c.updatedAt}</span>
              </div>
              <span className="lec-conv-actions">
                <span className="lec-conv-act" onClick={(e) => renameConv(e, c)} title="Đổi tên"><EditIcon size={14} /></span>
                <span className="lec-conv-act" onClick={(e) => deleteConv(e, c)} title="Xóa"><TrashIcon size={14} /></span>
              </span>
            </button>
          ))}
        </div>
      </aside>
      {listOpen && <div className="lec-overlay" onClick={() => setListOpen(false)} />}
      {renaming && (
        <RenameModal initial={renaming.title} onSubmit={submitRename} onClose={() => setRenaming(null)} />
      )}
      {deleting && (
        <DeleteModal title={deleting.title} onConfirm={confirmDelete} onClose={() => setDeleting(null)} />
      )}

      <div className="lec-chat">
        <div className="lec-chat-head">
          <button className="dmrs-icon-btn lec-history-toggle" onClick={() => setListOpen(true)} aria-label="Lịch sử"><HistoryIcon size={18} /></button>
          <h2>{conv.active?.title || 'Chat AI - Giảng viên'}</h2>
        </div>
        <div className="lec-chat-body">
          {conv.messages.filter((m) => !(m.from === 'ai' && !m.text)).map((m) => <ChatMessage key={m.id} msg={m} />)}
          {conv.messages.every((m) => String(m.id).startsWith('g')) && !conv.sending && (
            <SuggestedQuestions questions={LEC_SUGGESTIONS} onPick={(q) => conv.send(q)} disabled={conv.sending} />
          )}
          {conv.sending && <TypingIndicator label="Trợ lý AI đang trả lời" />}
          <div ref={bottomRef} />
        </div>
        <form className="lec-chat-input" onSubmit={submit}>
          <button type="button" className="dmrs-icon-btn" aria-label="Đính kèm" onClick={() => comingSoon('Đính kèm tệp đang được phát triển')}><PaperclipIcon size={18} /></button>
          <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Nhập câu hỏi của bạn..." />
          <button type="submit" className="lec-send-btn" aria-label="Gửi" disabled={conv.sending}><SendIcon size={18} /></button>
        </form>
      </div>
    </div>
  )
}

function RenameModal({ initial, onSubmit, onClose }) {
  const [value, setValue] = useState(initial)
  const inputRef = useRef(null)

  useEffect(() => {
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [])

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const submit = (e) => {
    e.preventDefault()
    onSubmit(value)
  }

  return (
    <div className="lec-modal-backdrop" onClick={onClose}>
      <form className="lec-modal" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <div className="lec-modal-head">
          <h3>Đổi tên cuộc trò chuyện</h3>
          <button type="button" className="dmrs-icon-btn" onClick={onClose} aria-label="Đóng"><XIcon size={18} /></button>
        </div>
        <input
          ref={inputRef}
          className="lec-rename-input"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Tên cuộc trò chuyện"
          maxLength={120}
        />
        <div className="lec-modal-actions">
          <button type="button" className="lec-btn-ghost" onClick={onClose}>Hủy</button>
          <button type="submit" className="lec-btn-primary" disabled={!value.trim()}>Lưu</button>
        </div>
      </form>
    </div>
  )
}

function DeleteModal({ title, onConfirm, onClose }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="lec-modal-backdrop" onClick={onClose}>
      <div className="lec-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="lec-delete-title">
        <div className="lec-modal-head">
          <h3 id="lec-delete-title">Xóa cuộc trò chuyện</h3>
          <button type="button" className="dmrs-icon-btn" onClick={onClose} aria-label="Đóng"><XIcon size={18} /></button>
        </div>
        <p className="lec-modal-desc">Bạn có chắc muốn xóa "{title}"? Hành động này không thể hoàn tác.</p>
        <div className="lec-modal-actions">
          <button type="button" className="lec-btn-ghost" onClick={onClose}>Hủy</button>
          <button type="button" className="lec-btn-danger" onClick={onConfirm}>Xóa</button>
        </div>
      </div>
    </div>
  )
}

export default LecturerChat
