import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { AlertCircleIcon } from './icons.jsx'
import './confirmDialog.css'

// Modal xác nhận dùng chung TOÀN APP — thay cho window.confirm() (hộp thoại
// mặc định xấu, không đồng bộ giao diện, không tuỳ biến được nút/màu).
//   import { confirmDialog } from '.../confirmDialog.jsx'
//   const ok = await confirmDialog('Xóa câu trả lời đã lưu này?')
//   if (!ok) return
// Trả về Promise<boolean> — true nếu bấm nút xác nhận, false nếu Hủy/Esc/click nền.
// Lưu ý: <ConfirmDialogHost/> phải được mount 1 lần ở App.jsx thì mới hoạt động.
let resolver = null

export function confirmDialog(message, opts = {}) {
  return new Promise((resolve) => {
    resolver = resolve
    window.dispatchEvent(new CustomEvent('app:confirm', { detail: { message, ...opts } }))
  })
}

export default function ConfirmDialogHost() {
  const [state, setState] = useState(null) // { message, confirmText, cancelText, danger }

  useEffect(() => {
    const onEvt = (e) => setState(e.detail)
    window.addEventListener('app:confirm', onEvt)
    return () => window.removeEventListener('app:confirm', onEvt)
  }, [])

  useEffect(() => {
    if (!state) return undefined
    const onKey = (e) => { if (e.key === 'Escape') respond(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state])

  const respond = (result) => {
    setState(null)
    resolver?.(result)
    resolver = null
  }

  if (!state) return null
  const { message, confirmText = 'Xóa', cancelText = 'Hủy', danger = true } = state

  return createPortal(
    <div className="cf-backdrop" onClick={() => respond(false)}>
      <div className="cf-modal" onClick={(e) => e.stopPropagation()} role="alertdialog" aria-modal="true">
        <span className={'cf-icon' + (danger ? ' cf-icon--danger' : '')}><AlertCircleIcon size={22} /></span>
        <p className="cf-message">{message}</p>
        <div className="cf-actions">
          <button type="button" className="cf-btn cf-btn--ghost" onClick={() => respond(false)}>{cancelText}</button>
          <button
            type="button"
            className={'cf-btn' + (danger ? ' cf-btn--danger' : ' cf-btn--primary')}
            onClick={() => respond(true)}
            autoFocus
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
