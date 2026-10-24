import { useState, useEffect, useLayoutEffect, useCallback } from 'react'
import { useLocation } from 'react-router-dom'
import { createPortal } from 'react-dom'
import './GuidedTour.css'

// Tour hướng dẫn "từng nút": làm nổi (spotlight) từng phần tử theo CSS selector +
// tooltip, có Trước/Tiếp/Bỏ qua.
// - `overview`: tour tổng quan, tự chạy 1 lần cho người mới (lưu cờ storageKey).
// - `tours`: map { [pathname]: bước[] } — mỗi trang 1 tour riêng, mở lại bằng nút "?"
//   (sự kiện 'dmrs:start-tour' với detail.manual = true). Lần mở thủ công KHÔNG lưu cờ
//   nên xem lại bao nhiêu lần cũng được. Trang chưa có tour riêng thì dùng `overview`.
const GAP = 10
const TT_W = 320

function GuidedTour({ tours = {}, overview = [], storageKey, welcomeKey, enabled = true }) {
  const { pathname } = useLocation()
  const [idx, setIdx] = useState(-1)
  const [rect, setRect] = useState(null)
  const [steps, setSteps] = useState([])
  const [persist, setPersist] = useState(true) // có lưu cờ "đã xem" khi kết thúc không

  useEffect(() => {
    const done = () => { try { return !!localStorage.getItem(storageKey) } catch { return false } }

    // Bắt đầu tour tổng quan (tự chạy / từ màn chào) — chỉ 1 lần, có lưu cờ.
    const startOverview = () => {
      if (done() || !overview.length) return
      setSteps(overview); setPersist(true); setIdx(0)
    }
    // Mở thủ công từ nút "?" — tour của đúng trang hiện tại, không lưu cờ (xem lại được).
    const startManual = () => {
      const s = tours[pathname] || overview
      if (!s.length) return
      setSteps(s); setPersist(false); setIdx(0)
    }
    const onEvt = (e) => { if (e?.detail?.manual) startManual(); else startOverview() }
    window.addEventListener('dmrs:start-tour', onEvt)

    // Người đã xem màn chào nhưng chưa xem tour → tự chạy tour tổng quan.
    let timer
    if (enabled && !done()) {
      let welcomed = false
      try { welcomed = !!localStorage.getItem(welcomeKey) } catch { /* ignore */ }
      if (welcomed) timer = setTimeout(startOverview, 500)
    }
    return () => { clearTimeout(timer); window.removeEventListener('dmrs:start-tour', onEvt) }
  }, [enabled, storageKey, welcomeKey, pathname, tours, overview])

  const measure = useCallback(() => {
    if (idx < 0 || idx >= steps.length) return
    const el = steps[idx].selector ? document.querySelector(steps[idx].selector) : null
    if (!el) { setRect(null); return }
    el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' })
    const r = el.getBoundingClientRect()
    setRect({ top: r.top, left: r.left, width: r.width, height: r.height })
  }, [idx, steps])

  useLayoutEffect(() => {
    if (idx < 0) return undefined
    measure()
    const on = () => measure()
    window.addEventListener('resize', on)
    window.addEventListener('scroll', on, true)
    return () => { window.removeEventListener('resize', on); window.removeEventListener('scroll', on, true) }
  }, [idx, measure])

  if (idx < 0 || idx >= steps.length) return null

  const finish = () => {
    if (persist) { try { localStorage.setItem(storageKey, '1') } catch { /* ignore */ } }
    setIdx(-1)
  }
  const step = steps[idx]
  const last = idx === steps.length - 1
  const vw = window.innerWidth
  const vh = window.innerHeight
  const ttW = Math.min(TT_W, vw - 24)

  // Vị trí tooltip: dưới phần tử nếu đủ chỗ, không thì trên; không có target thì giữa.
  let popStyle
  let hlStyle = null
  if (rect) {
    hlStyle = {
      top: rect.top - 4,
      left: rect.left - 4,
      width: rect.width + 8,
      height: rect.height + 8,
    }
    const left = Math.min(Math.max(12, rect.left), vw - ttW - 12)
    if (rect.top + rect.height + 180 < vh) {
      popStyle = { top: rect.top + rect.height + GAP, left, width: ttW }
    } else {
      popStyle = { bottom: vh - rect.top + GAP, left, width: ttW }
    }
  } else {
    popStyle = { top: vh / 2 - 90, left: vw / 2 - ttW / 2, width: ttW }
  }

  return createPortal(
    <>
      {hlStyle && <div className="tour-hl" style={hlStyle} />}
      <div className="tour-pop" style={popStyle} role="dialog">
        <h4>{step.title}</h4>
        <p>{step.desc}</p>
        <div className="tour-foot">
          <button type="button" className="tour-skip" onClick={finish}>Bỏ qua</button>
          <div className="tour-right">
            <span className="tour-steps">{idx + 1}/{steps.length}</span>
            {idx > 0 && (
              <button type="button" className="tour-btn tour-btn--ghost" onClick={() => setIdx(idx - 1)}>Trước</button>
            )}
            <button type="button" className="tour-btn tour-btn--primary" onClick={() => (last ? finish() : setIdx(idx + 1))}>
              {last ? 'Xong' : 'Tiếp'}
            </button>
          </div>
        </div>
      </div>
    </>,
    document.body,
  )
}

export default GuidedTour
