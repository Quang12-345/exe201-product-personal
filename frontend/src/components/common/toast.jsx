import { useEffect, useRef, useState } from 'react'
import { CheckCircleIcon, AlertCircleIcon } from './icons.jsx'
import './toast.css'

// Toast thông báo dùng chung TOÀN APP — thay cho window.alert() (chặn thao
// tác, xấu, không đồng bộ giao diện). Cùng cơ chế CustomEvent như
// comingSoon.jsx: gọi được ở bất cứ đâu không cần truyền prop/hook qua nhiều
// tầng component.
//   import { notify } from '.../toast.jsx'
//   notify('Cập nhật thành công.')
// Lưu ý: <NotificationToast/> phải được mount 1 lần ở App.jsx thì toast mới hiện.
export function notify(message, variant) {
  const detail = { message }
  if (variant) detail.variant = variant
  window.dispatchEvent(new CustomEvent('app:notify', { detail }))
}

notify.success = (message) => notify(message, 'success')
notify.error = (message) => notify(message, 'error')
notify.info = (message) => notify(message, 'info')

function inferVariant(message) {
  const text = String(message || '').toLowerCase()
  if (
    text.includes('thất bại') ||
    text.includes('lỗi') ||
    text.includes('không ') ||
    text.startsWith('không') ||
    text.startsWith('vui lòng') ||
    text.includes('không khớp') ||
    text.includes('không tải') ||
    text.includes('không mở') ||
    text.includes('không thể') ||
    text.includes('phải')
    
  ) {
    return 'error'
  }
  return 'success'
}

// Mount 1 lần ở App. Lắng nghe sự kiện và hiển thị toast góc trên-phải.
export default function NotificationToast() {
  const [items, setItems] = useState([])
  const counter = useRef(0)

  useEffect(() => {
    const onEvt = (e) => {
      const payload = typeof e.detail === 'string' ? { message: e.detail } : e.detail || {}
      const inferred = inferVariant(payload.message)
      const variant = payload.variant === 'error' || inferred === 'error'
        ? 'error'
        : 'success'
      const id = (counter.current += 1)
      setItems((cur) => [...cur, { id, msg: payload.message || '', variant }])
      window.setTimeout(() => {
        setItems((cur) => cur.filter((x) => x.id !== id))
      }, 3200)
    }
    window.addEventListener('app:notify', onEvt)
    return () => window.removeEventListener('app:notify', onEvt)
  }, [])

  if (items.length === 0) return null
  return (
    <div className="nt-toast-wrap" role="status" aria-live="polite">
      {items.map((it) => (
        <div key={it.id} className={'nt-toast' + (it.variant === 'error' ? ' nt-toast--error' : '')} role={it.variant === 'error' ? 'alert' : 'status'}>
          {it.variant === 'error' ? <AlertCircleIcon size={18} /> : <CheckCircleIcon size={18} />}
          <span>{it.msg}</span>
        </div>
      ))}
    </div>
  )
}
