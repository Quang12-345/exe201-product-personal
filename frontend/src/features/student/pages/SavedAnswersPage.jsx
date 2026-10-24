import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { getSaved, removeSaved } from '../services/savedService'
import { SearchIcon, ArrowRightIcon, TrashIcon, XIcon } from '../../../components/common/icons.jsx'
import { notify } from '../../../components/common/toast.jsx'
import { confirmDialog } from '../../../components/common/confirmDialog.jsx'

const TAG_VARIANT = { Academic: 'info', Technical: 'success', Policy: 'neutral', 'Chat AI': 'info' }
const clamp = (v, min, max) => Math.min(Math.max(v, min), max)
const MIN_W = 380
const MIN_H = 280

// Icon tay cầm resize (3 gạch chéo góc, kiểu cửa sổ desktop).
function ResizeGripIcon() {
  return (
    <svg width={14} height={14} viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <path d="M12 2 2 12M12 6.5 6.5 12M12 11l-1 1" />
    </svg>
  )
}

// Trang Câu trả lời đã lưu: lưới thẻ + tìm kiếm + xem chi tiết + xóa (lưu localStorage).
function SavedAnswersPage() {
  const [items, setItems] = useState([])
  const [q, setQ] = useState('')
  const [detail, setDetail] = useState(null) // item đang xem chi tiết
  // Cửa sổ chi tiết kéo-thả/resize được, giống popup desktop: vị trí + kích
  // thước lưu ở đây, cập nhật trực tiếp khi kéo chuột (không qua CSS transition
  // để tránh cảm giác trễ/lag lúc đang kéo).
  const [win, setWin] = useState(null)
  const dragRef = useRef(null) // { startX, startY, startTop, startLeft } trong lúc kéo tiêu đề
  const resizeRef = useRef(null) // { startX, startY, startW, startH } trong lúc kéo góc resize

  useEffect(() => {
    setItems(getSaved())
  }, [])

  // Mỗi lần mở 1 câu trả lời khác, đặt lại cửa sổ về giữa màn hình với kích
  // thước mặc định.
  useEffect(() => {
    if (!detail) return
    const width = clamp(720, MIN_W, window.innerWidth - 32)
    const height = clamp(620, MIN_H, window.innerHeight - 32)
    setWin({ width, height, left: (window.innerWidth - width) / 2, top: (window.innerHeight - height) / 2 })
  }, [detail])

  const startDrag = (e) => {
    if (e.target.closest('button')) return // không kéo cửa sổ khi bấm nút trong tiêu đề
    dragRef.current = { startX: e.clientX, startY: e.clientY, startTop: win.top, startLeft: win.left }
    window.addEventListener('mousemove', onDrag)
    window.addEventListener('mouseup', endDrag)
  }
  const onDrag = (e) => {
    const { startX, startY, startTop, startLeft } = dragRef.current
    setWin((w) => ({
      ...w,
      left: clamp(startLeft + (e.clientX - startX), -w.width + 160, window.innerWidth - 160),
      top: clamp(startTop + (e.clientY - startY), 0, window.innerHeight - 48),
    }))
  }
  const endDrag = () => {
    dragRef.current = null
    window.removeEventListener('mousemove', onDrag)
    window.removeEventListener('mouseup', endDrag)
  }

  const startResize = (e) => {
    e.stopPropagation()
    resizeRef.current = { startX: e.clientX, startY: e.clientY, startW: win.width, startH: win.height }
    window.addEventListener('mousemove', onResize)
    window.addEventListener('mouseup', endResize)
  }
  const onResize = (e) => {
    const { startX, startY, startW, startH } = resizeRef.current
    setWin((w) => ({
      ...w,
      width: clamp(startW + (e.clientX - startX), MIN_W, window.innerWidth - 16),
      height: clamp(startH + (e.clientY - startY), MIN_H, window.innerHeight - 16),
    }))
  }
  const endResize = () => {
    resizeRef.current = null
    window.removeEventListener('mousemove', onResize)
    window.removeEventListener('mouseup', endResize)
  }

  const remove = async (e, id) => {
    e?.stopPropagation()
    const ok = await confirmDialog('Xóa câu trả lời đã lưu này?', { confirmText: 'Xóa' })
    if (!ok) return
    setItems(removeSaved(id)) // xóa + lưu localStorage, trả về danh sách mới
    if (detail?.id === id) {
      closeDetail()
      return
    }
    setDetail((d) => (d && d.id === id ? null : d))
    notify('Xóa câu trả lời thành công.')
  }

  const closeDetail = () => setDetail(null)

  const shown = items.filter(
    (x) =>
      x.title.toLowerCase().includes(q.toLowerCase()) ||
      (x.content || '').toLowerCase().includes(q.toLowerCase())
  )

  return (
    <div className="st-wrap">
      <h1 className="st-title">Câu trả lời đã lưu</h1>
      <p className="st-sub">Quản lý và tra cứu các câu trả lời hữu ích từ Chat AI.</p>

      <div className="st-card st-toolbar">
        <div className="st-search">
          <SearchIcon size={18} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm trong câu trả lời..." />
        </div>
      </div>

      {shown.length === 0 ? (
        <div className="st-card" style={{ textAlign: 'center', padding: 32, color: '#64748b' }}>
          {items.length === 0
            ? 'Chưa có câu trả lời nào được lưu. Trong khung chat, bấm "Lưu câu trả lời" để lưu lại.'
            : 'Không tìm thấy câu trả lời khớp từ khóa.'}
        </div>
      ) : (
        <div className="st-saved-grid">
          {shown.map((it) => (
            <div key={it.id} className="st-saved-card" onClick={() => setDetail(it)} style={{ cursor: 'pointer' }}>
              <div className="st-saved-top">
                <span className={'st-badge st-badge--' + (TAG_VARIANT[it.tag] || 'neutral')}>{it.tag}</span>
                <span className="st-muted">{it.date}</span>
              </div>
              <h3 className="st-saved-title">{it.title}</h3>
              <p className="st-saved-snippet">{it.snippet}</p>
              <div className="st-saved-foot">
                <button className="st-link" onClick={(e) => { e.stopPropagation(); setDetail(it) }}>
                  Xem chi tiết <ArrowRightIcon size={14} />
                </button>
                <button className="st-icon-btn st-icon-btn--danger" onClick={(e) => remove(e, it.id)} aria-label="Xóa">
                  <TrashIcon size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="st-pagination">
        <span className="st-muted">Đang hiển thị {shown.length} câu trả lời đã lưu</span>
      </div>

      {detail && win && createPortal(
        // Render thẳng ra document.body: .st-page-anim (bọc mọi trang) có
        // animation để lại transform:translateY(0) sau khi chạy xong, khiến
        // nó thành "containing block" cho mọi con position:fixed bên trong —
        // popup sẽ bị định vị lệch theo vùng nội dung (trừ sidebar) thay vì
        // giữa MÀN HÌNH THẬT. Portal thoát hẳn khỏi vùng bị ảnh hưởng đó.
        <div className="st-modal-backdrop is-visible" onClick={closeDetail}>
          <div
            className="st-modal st-modal--detail is-visible"
            style={{ top: win.top, left: win.left, width: win.width, height: win.height }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="st-modal-head" onMouseDown={startDrag}>
              <div>
                <span className={'st-badge st-badge--' + (TAG_VARIANT[detail.tag] || 'neutral')}>{detail.tag}</span>
                <span className="st-muted" style={{ marginLeft: 8 }}>{detail.date}</span>
              </div>
              <button className="st-icon-btn" onClick={closeDetail} aria-label="Đóng"><XIcon size={18} /></button>
            </div>
            <h2 className="st-modal-title">{detail.title}</h2>
            <div className="st-modal-body chat-md">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{detail.content || detail.snippet || ''}</ReactMarkdown>
            </div>
            <div className="st-modal-foot">
              <button className="st-btn st-btn--danger" onClick={(e) => remove(e, detail.id)}>
                <TrashIcon size={16} /> Xóa
              </button>
              <button className="st-btn st-btn--ghost" onClick={closeDetail}>Đóng</button>
            </div>
            <div className="st-modal-resize-handle" onMouseDown={startResize} title="Kéo để thay đổi kích thước">
              <ResizeGripIcon />
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}

export default SavedAnswersPage
