import { useEffect, useRef, useState } from 'react'
import './comingSoon.css'

// Toast "tính năng đang phát triển" dùng chung cho TOÀN APP.
// Mục đích: những nút/icon chưa có chức năng (đính kèm chat, đổi mật khẩu,
// xuất báo cáo, trợ giúp...) thay vì bấm vào im lặng thì hiện thông báo nhẹ,
// để người dùng biết là "sắp có" chứ không phải app bị lỗi.
//
// Cơ chế: dùng CustomEvent trên window thay cho Context → gọi được ở bất cứ
// đâu mà không phải truyền prop/hook qua nhiều tầng component.
//   import { comingSoon } from '.../comingSoon.jsx'
//   onClick={() => comingSoon()}            // dùng câu mặc định
//   onClick={() => comingSoon('Sắp có: X')} // câu tùy chỉnh
// Lưu ý: <ComingSoonToast/> phải được mount 1 lần ở App.jsx thì toast mới hiện.
export function comingSoon(message = 'Tính năng đang được phát triển 🚧') {
  window.dispatchEvent(new CustomEvent('app:coming-soon', { detail: message }))
}

// Mount 1 lần ở App. Lắng nghe sự kiện và hiển thị toast góc dưới phải.
export default function ComingSoonToast() {
  const [items, setItems] = useState([])
  const counter = useRef(0)

  useEffect(() => {
    const onEvt = (e) => {
      const id = (counter.current += 1)
      const msg = e.detail || 'Tính năng đang được phát triển 🚧'
      setItems((cur) => [...cur, { id, msg }])
      window.setTimeout(() => {
        setItems((cur) => cur.filter((x) => x.id !== id))
      }, 2600)
    }
    window.addEventListener('app:coming-soon', onEvt)
    return () => window.removeEventListener('app:coming-soon', onEvt)
  }, [])

  if (items.length === 0) return null
  return (
    <div className="cs-toast-wrap" role="status" aria-live="polite">
      {items.map((it) => (
        <div key={it.id} className="cs-toast">
          <span className="cs-toast-icon">🚧</span>
          <span>{it.msg}</span>
        </div>
      ))}
    </div>
  )
}
