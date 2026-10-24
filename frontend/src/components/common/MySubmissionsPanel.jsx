import { useState, useEffect, useCallback, useRef } from 'react'
import { FileTextIcon, LinkIcon } from './icons.jsx'
import './MySubmissionsPanel.css'

const isProcessing = (d) => d.aiStatus !== 'indexed' && d.aiStatus !== 'error'

// Panel "Đề trình của tôi": liệt kê tài liệu người dùng đã nộp, tách 2 tab
// "Đang xử lý" (chờ index) và "Đã tải lên" (đã sẵn sàng). Dùng chung mọi quyền.
// Tự động poll cập nhật trạng thái khi còn tài liệu đang xử lý + báo khi xong.
// props: fetchDocs() -> Promise<doc[]>, refreshKey (re-fetch khi đổi), onOpen(doc)
function MySubmissionsPanel({ fetchDocs, refreshKey = 0, onOpen, title = 'Đề trình của tôi', subtitle = 'Tài liệu bạn đã tải lên' }) {
  const [tab, setTab] = useState('processing') // processing | done
  const [docs, setDocs] = useState([])
  const [loading, setLoading] = useState(true)
  const [justDone, setJustDone] = useState('') // tên tài liệu vừa lập chỉ mục xong
  const processingIdsRef = useRef(new Set()) // theo dõi để phát hiện chuyển trạng thái

  const load = useCallback((showLoading = false) => {
    if (showLoading) setLoading(true)
    Promise.resolve(fetchDocs())
      .then((list) => {
        const arr = Array.isArray(list) ? list : []
        // Phát hiện tài liệu trước đó "đang xử lý" nay đã "đã lập chỉ mục" → thông báo.
        const prev = processingIdsRef.current
        const finished = arr.find((d) => prev.has(d.id) && d.aiStatus === 'indexed')
        if (finished) setJustDone(finished.title || finished.name)
        processingIdsRef.current = new Set(arr.filter(isProcessing).map((d) => d.id))
        setDocs(arr)
      })
      .catch(() => setDocs([]))
      .finally(() => { if (showLoading) setLoading(false) })
  }, [fetchDocs])

  useEffect(() => { load(true) }, [load, refreshKey])

  const processing = docs.filter(isProcessing)
  const done = docs.filter((d) => d.aiStatus === 'indexed')
  const shown = tab === 'processing' ? processing : done

  // Poll cập nhật trạng thái mỗi 4s khi còn tài liệu đang xử lý (không hiện spinner).
  useEffect(() => {
    if (processing.length === 0) return undefined
    const timer = setInterval(() => load(false), 4000)
    return () => clearInterval(timer)
  }, [processing.length, load])

  // Tự ẩn thông báo "đã lập chỉ mục xong" sau ít giây.
  useEffect(() => {
    if (!justDone) return undefined
    const t = setTimeout(() => setJustDone(''), 6000)
    return () => clearTimeout(t)
  }, [justDone])

  return (
    <div className="dmrs-card ms-panel">
      <div className="ms-head">
        <h3 className="ms-title">{title}</h3>
        <p className="ms-sub">{subtitle}</p>
      </div>
      {justDone ? (
        <div className="ms-toast">✅ Đã lập chỉ mục xong: <strong>{justDone}</strong></div>
      ) : null}
      <div className="ms-tabs">
        <button className={'ms-tab' + (tab === 'processing' ? ' is-active' : '')} onClick={() => setTab('processing')}>
          <span className="ms-dot ms-dot--amber" /> Đang xử lý{processing.length ? ` (${processing.length})` : ''}
        </button>
        <button className={'ms-tab' + (tab === 'done' ? ' is-active' : '')} onClick={() => setTab('done')}>
          <span className="ms-dot ms-dot--green" /> Đã tải lên{done.length ? ` (${done.length})` : ''}
        </button>
      </div>

      <div className="ms-list">
        {loading ? (
          <p className="ms-empty">Đang tải...</p>
        ) : shown.length === 0 ? (
          <div className="ms-empty-state">
            <FileTextIcon size={40} />
            <span>Không có tài liệu nào</span>
          </div>
        ) : (
          shown.map((d) => (
            <button key={d.id} type="button" className="ms-item" onClick={() => onOpen && onOpen(d)}>
              <span className="ms-item-icon">{d.kind === 'link' ? <LinkIcon size={16} /> : <FileTextIcon size={16} />}</span>
              <span className="ms-item-body">
                <span className="ms-item-name">{d.title || d.name}</span>
                <span className="ms-item-meta">{(d.type || 'TÀI LIỆU')}{d.uploadedAt ? ` · ${d.uploadedAt}` : ''}</span>
              </span>
              <span className={'ms-badge ms-badge--' + (d.aiStatus === 'indexed' ? 'green' : d.aiStatus === 'error' ? 'red' : 'amber')}>
                {d.aiStatus === 'indexed' ? 'Đã index' : d.aiStatus === 'error' ? 'Lỗi' : 'Đang xử lý'}
              </span>
            </button>
          ))
        )}
      </div>
    </div>
  )
}

export default MySubmissionsPanel
