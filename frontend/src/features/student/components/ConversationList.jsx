import { useState, useEffect, useRef } from 'react'
import { PlusIcon, EditIcon, TrashIcon, BotIcon, XIcon } from '../../../components/common/icons.jsx'

function ConversationList({ list, activeId, open, onSelect, onNew, onRename, onDelete, onClose }) {
  const [renaming, setRenaming] = useState(null)
  const [deleting, setDeleting] = useState(null)

  const handleRename = (e, conv) => {
    e.stopPropagation()
    setRenaming(conv)
  }

  const handleDelete = (e, conv) => {
    e.stopPropagation()
    setDeleting(conv)
  }

  const submitRename = (title) => {
    const nextTitle = title.trim()
    if (renaming && nextTitle) onRename(renaming.id, nextTitle)
    setRenaming(null)
  }

  const confirmDelete = () => {
    if (deleting) onDelete(deleting.id)
    setDeleting(null)
  }

  return (
    <aside className={'st-convlist' + (open ? ' is-open' : '')}>
      <div className="st-convlist-head">
        <span>Cuộc trò chuyện</span>
        <button className="st-icon-btn st-convlist-close" onClick={onClose} aria-label="Đóng">
          <XIcon size={18} />
        </button>
      </div>

      <button className="st-new-chat" onClick={onNew}>
        <PlusIcon size={16} /> Cuộc trò chuyện mới
      </button>

      <div className="st-conv-items">
        {list.map((conv) => (
          <button
            key={conv.id}
            className={'st-conv-item' + (conv.id === activeId ? ' is-active' : '')}
            onClick={() => onSelect(conv.id)}
          >
            <span className="st-conv-icon"><BotIcon size={16} /></span>
            <div className="st-conv-text">
              <strong>{conv.title}</strong>
              <span className="st-conv-preview">{conv.preview || conv.updatedAt || ''}</span>
            </div>
            <span className="st-conv-actions">
              <span className="st-conv-act" onClick={(e) => handleRename(e, conv)} title="Đổi tên"><EditIcon size={14} /></span>
              <span className="st-conv-act" onClick={(e) => handleDelete(e, conv)} title="Xóa"><TrashIcon size={14} /></span>
            </span>
          </button>
        ))}
        {list.length === 0 && <p className="st-muted st-conv-empty">Chưa có cuộc trò chuyện nào.</p>}
      </div>

      {renaming && (
        <RenameModal
          initial={renaming.title}
          onSubmit={submitRename}
          onClose={() => setRenaming(null)}
        />
      )}
      {deleting && (
        <DeleteModal
          title={deleting.title}
          onConfirm={confirmDelete}
          onClose={() => setDeleting(null)}
        />
      )}
    </aside>
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
    <div className="st-modal-backdrop" onClick={onClose}>
      <form className="st-modal st-modal--sm" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <div className="st-modal-head">
          <h3>Đổi tên cuộc trò chuyện</h3>
          <button type="button" className="st-icon-btn" onClick={onClose} aria-label="Đóng"><XIcon size={18} /></button>
        </div>

        <input
          ref={inputRef}
          className="st-rename-input"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Tên cuộc trò chuyện"
          maxLength={120}
        />

        <div className="st-modal-actions">
          <button type="button" className="st-btn st-btn--ghost" onClick={onClose}>Hủy</button>
          <button type="submit" className="st-btn st-btn--primary" disabled={!value.trim()}>Lưu</button>
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
    <div className="st-modal-backdrop" onClick={onClose}>
      <div className="st-modal st-modal--sm" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="st-delete-title">
        <div className="st-modal-head">
          <h3 id="st-delete-title">Xóa cuộc trò chuyện</h3>
          <button type="button" className="st-icon-btn" onClick={onClose} aria-label="Đóng"><XIcon size={18} /></button>
        </div>
        <p className="st-modal-desc">Bạn có chắc muốn xóa "{title}"? Hành động này không thể hoàn tác.</p>
        <div className="st-modal-actions">
          <button type="button" className="st-btn st-btn--ghost" onClick={onClose}>Hủy</button>
          <button type="button" className="st-btn st-btn--danger" onClick={onConfirm}>Xóa</button>
        </div>
      </div>
    </div>
  )
}

export default ConversationList
