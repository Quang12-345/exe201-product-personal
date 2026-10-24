import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { renderAsync } from 'docx-preview'
import { FileTextIcon, XIcon, DownloadIcon, LinkIcon, YouTubeIcon } from './icons.jsx'
import { notify } from './toast.jsx'
import { fetchDocBlob, fetchDocBlobUrl, fetchDocText } from '../../services/documentViewService'
import './DocumentViewerModal.css'

// Icon phóng to / thu nhỏ (inline vì bộ icon chưa có).
const ExpandIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
  </svg>
)

// Loại file xem trực tiếp bằng iframe (trình duyệt render được).
const INLINE_TYPES = ['PDF']
const VIDEO_TYPES = ['MP4', 'WEBM', 'MOV', 'MKV', 'AVI']

// Chuyển link YouTube (watch?v=… hoặc youtu.be/…) sang dạng nhúng được; null nếu không phải.
function youtubeEmbed(url) {
  if (!url) return null
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/)
  return m ? `https://www.youtube.com/embed/${m[1]}` : null
}

// Tìm vị trí đoạn trích (quote) trong văn bản, chịu được khác biệt khoảng trắng/xuống dòng.
// Trả {start, end} theo chỉ số của text GỐC, hoặc null nếu không khớp.
function findQuoteRange(text, quote) {
  if (!text || !quote) return null
  // Chuẩn hoá text + giữ map chỉ số normalize → gốc.
  const map = []
  let norm = ''
  let lastSpace = true
  for (let i = 0; i < text.length; i++) {
    const ch = /\s/.test(text[i]) ? ' ' : text[i].toLowerCase()
    if (ch === ' ' && lastSpace) continue
    norm += ch
    map.push(i)
    lastSpace = ch === ' '
  }
  const cleanQuote = quote.replace(/\s+/g, ' ').trim().toLowerCase()
  // Thử khớp tiền tố dài → ngắn dần (chunk có thể bị cắt/lệch vài ký tự cuối).
  for (const len of [300, 180, 100, 60, 40]) {
    const needle = cleanQuote.slice(0, len)
    if (needle.length < 25 && len !== 40) continue
    const idx = norm.indexOf(needle)
    if (idx >= 0) {
      return { start: map[idx], end: map[Math.min(idx + needle.length, map.length) - 1] + 1 }
    }
  }
  return null
}

// Văn bản có bôi sáng đoạn trích + tự cuộn tới (dùng cho chế độ xem dạng text).
function TextWithHighlight({ text, quote }) {
  const markRef = useRef(null)
  const range = findQuoteRange(text, quote)
  useEffect(() => {
    if (markRef.current) markRef.current.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [text, quote])
  if (!range) return <pre className="dv-text">{text}</pre>
  return (
    <pre className="dv-text">
      {text.slice(0, range.start)}
      <mark ref={markRef} className="dv-mark">{text.slice(range.start, range.end)}</mark>
      {text.slice(range.end)}
    </pre>
  )
}

// Thẻ "Đoạn được trích dẫn": gọn 2 dòng, bấm mở rộng; badge trang nếu có.
function QuoteRibbon({ quote, page }) {
  const [open, setOpen] = useState(false)
  const clean = String(quote).replace(/\s+/g, ' ').trim()
  const isLong = clean.length > 150
  return (
    <div className="dv-quote">
      <div className="dv-quote-head">
        <span className="dv-quote-icon"><FileTextIcon size={13} /></span>
        <span className="dv-quote-title">Đoạn được trích dẫn</span>
        {page ? <span className="dv-quote-page">tr.{page}</span> : null}
        {isLong && (
          <button type="button" className="dv-quote-toggle" onClick={() => setOpen((v) => !v)}>
            {open ? 'Thu gọn' : 'Xem đầy đủ'}
          </button>
        )}
      </div>
      <p className={'dv-quote-body' + (open ? ' is-open' : '')}>{clean}</p>
    </div>
  )
}

// Popup xem tài liệu dùng chung (sinh viên / giảng viên / admin):
// PDF nhúng iframe, DOCX/PPTX hiện văn bản, video phát trực tiếp, link YouTube nhúng player.
function DocumentViewerModal({ doc, onClose }) {
  const docxHostRef = useRef(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [blobUrl, setBlobUrl] = useState('')
  const [docBlob, setDocBlob] = useState(null)
  const [text, setText] = useState('')
  const [docxRendering, setDocxRendering] = useState(false)
  const [docxFallback, setDocxFallback] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [linkView, setLinkView] = useState('web')

  const type = (doc?.type || '').toUpperCase()
  const isLink = doc?.kind === 'link' || doc?.kind === 'youtube' || doc?.kind === 'web' || type === 'LINK' || type === 'YOUTUBE'
  const isVideo = doc?.kind === 'media' || VIDEO_TYPES.includes(type)
  const isInline = INLINE_TYPES.includes(type)
  const isDocx = type === 'DOCX'
  const needsBlob = isInline || isVideo
  const ytEmbed = isLink ? youtubeEmbed(doc?.url) : null
  const isEmbeddableLink = Boolean(ytEmbed)
  const isWebLink = isLink && !isEmbeddableLink
  const HeaderIcon = isEmbeddableLink || doc?.kind === 'youtube' || type === 'YOUTUBE' ? YouTubeIcon : FileTextIcon
  const OpenOriginalIcon = isEmbeddableLink || doc?.kind === 'youtube' || type === 'YOUTUBE' ? YouTubeIcon : LinkIcon

  useEffect(() => {
    setLinkView('web')
  }, [doc?.id, doc?.url])

  useEffect(() => {
    let revoke = ''
    let cancelled = false
    setLoading(true)
    setError('')
    setBlobUrl('')
    setDocBlob(null)
    setText('')
    setDocxRendering(false)
    setDocxFallback(false)

    if (isEmbeddableLink) { setLoading(false); return }

    const load = async () => {
      try {
        if (needsBlob) {
          const url = await fetchDocBlobUrl(doc.id)
          if (cancelled) { URL.revokeObjectURL(url); return }
          revoke = url
          setBlobUrl(url)
        } else if (isDocx) {
          const blob = await fetchDocBlob(doc.id)
          if (cancelled) return
          setDocBlob(blob)
        } else {
          const data = await fetchDocText(doc.id)
          if (cancelled) return
          setText(data?.text || '(Tài liệu không có nội dung văn bản để hiển thị.)')
        }
      } catch (e) {
        if (!cancelled) {
          const detail = e?.response?.data?.detail
          setError(typeof detail === 'string' ? detail : 'Không tải được nội dung tài liệu.')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true; if (revoke) URL.revokeObjectURL(revoke) }
  }, [doc, needsBlob, isDocx, isEmbeddableLink])

  useEffect(() => {
    if (!isDocx || !docBlob || loading || !docxHostRef.current) return undefined

    let cancelled = false
    const host = docxHostRef.current
    host.innerHTML = ''
    setDocxRendering(true)
    setDocxFallback(false)

    const renderDocx = async () => {
      try {
        await renderAsync(docBlob, host, undefined, {
          className: 'docx',
          inWrapper: true,
          breakPages: true,
          renderHeaders: true,
          renderFooters: true,
          renderFootnotes: true,
          renderEndnotes: true,
        })
      } catch {
        if (cancelled) return
        host.innerHTML = ''
        setDocxFallback(true)
        try {
          const data = await fetchDocText(doc.id)
          if (!cancelled) {
            setText(data?.text || '(Tài liệu không có nội dung văn bản để hiển thị.)')
          }
        } catch (e) {
          if (!cancelled) {
            const detail = e?.response?.data?.detail
            setError(typeof detail === 'string' ? detail : 'Không dựng được bản xem trước DOCX.')
          }
        }
      } finally {
        if (!cancelled) setDocxRendering(false)
      }
    }

    renderDocx()
    return () => {
      cancelled = true
      host.innerHTML = ''
    }
  }, [doc?.id, docBlob, isDocx, loading])

  // Đóng bằng phím Escape + khóa cuộn nền khi popup mở (đảm bảo luôn tắt được popup,
  // kể cả khi layout cha tạo stacking/overflow context).
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose?.() }
    document.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [onClose])

  // Tải xuống bằng chính bytes đã lấy hoặc mở endpoint xem ở tab mới.
  const download = async () => {
    try {
      const url = blobUrl || (await fetchDocBlobUrl(doc.id))
      const a = document.createElement('a')
      a.href = url
      a.download = doc.name || 'tai-lieu'
      a.click()
    } catch {
      notify('Không tải được tài liệu.', 'error')
    }
  }

  return createPortal(
    <div className="dv-backdrop" onClick={onClose}>
      <div className={'dv-modal' + (expanded ? ' is-expanded' : '')} onClick={(e) => e.stopPropagation()}>
        <div className="dv-head">
          <div className="dv-title">
            <span className="dv-file-icon"><HeaderIcon size={18} /></span>
            <div>
              <div className="dv-name">{doc?.name}</div>
              <div className="dv-sub">{isVideo ? 'Video' : isLink ? 'Liên kết' : (type || 'Tài liệu')}</div>
            </div>
          </div>
          <div className="dv-actions">
            <button className="dv-icon-btn" onClick={() => setExpanded((v) => !v)}
              aria-label={expanded ? 'Thu nhỏ' : 'Phóng to'} title={expanded ? 'Thu nhỏ' : 'Phóng to'}>
              <ExpandIcon size={18} />
            </button>
            <button className="dv-icon-btn" onClick={onClose} aria-label="Đóng" title="Đóng">
              <XIcon size={18} />
            </button>
          </div>
        </div>

        {/* Đoạn được AI trích dẫn — thẻ gọn: 2 dòng + nút mở rộng, badge trang */}
        {doc?.quote && <QuoteRibbon quote={doc.quote} page={doc?.page} />}

        <div className="dv-body">
          {isEmbeddableLink ? (
            <iframe className="dv-frame" src={ytEmbed} title={doc?.name}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen />
          ) : isWebLink ? (
            <div className="dv-link-preview">
              <div className="dv-link-toolbar">
                <div className="dv-link-tabs" role="tablist" aria-label="Chế độ xem liên kết">
                  <button
                    type="button"
                    className={'dv-link-tab' + (linkView === 'web' ? ' is-active' : '')}
                    onClick={() => setLinkView('web')}
                  >
                    <LinkIcon size={15} /> Trang web
                  </button>
                  <button
                    type="button"
                    className={'dv-link-tab' + (linkView === 'text' ? ' is-active' : '')}
                    onClick={() => setLinkView('text')}
                  >
                    <FileTextIcon size={15} /> Nội dung
                  </button>
                </div>
              </div>
              <div className="dv-link-body">
                {linkView === 'web' ? (
                  <iframe className="dv-frame" src={doc?.url} title={doc?.name} />
                ) : (
                  <>
                    {loading && <div className="dv-state">Đang tải nội dung tài liệu...</div>}
                    {!loading && error && <div className="dv-state dv-error">{error}</div>}
                    {!loading && !error && <TextWithHighlight text={text} quote={doc?.quote} />}
                  </>
                )}
              </div>
            </div>
          ) : (
            <>
              {loading && <div className="dv-state">Đang tải nội dung tài liệu...</div>}
              {!loading && error && <div className="dv-state dv-error">{error}</div>}
              {!loading && !error && isVideo && blobUrl && (
                <video className="dv-frame" src={blobUrl} controls autoPlay style={{ background: '#000' }} />
              )}
              {!loading && !error && isInline && blobUrl && (
                <iframe
                  className="dv-frame"
                  src={doc?.page ? `${blobUrl}#page=${doc.page}` : blobUrl}
                  title={doc?.name}
                />
              )}
              {!loading && !error && isDocx && (
                docxFallback ? (
                  <TextWithHighlight text={text} quote={doc?.quote} />
                ) : (
                  <div className="dv-docx-shell">
                    <div ref={docxHostRef} className="dv-docx-view" />
                    {docxRendering && <div className="dv-state dv-docx-state">Đang dựng bố cục DOCX...</div>}
                  </div>
                )
              )}
              {!loading && !error && !isInline && !isVideo && !isDocx && (
                <TextWithHighlight text={text} quote={doc?.quote} />
              )}
            </>
          )}
        </div>

        <div className="dv-foot">
          {isLink ? (
            <a className="dv-download" href={doc?.url} target="_blank" rel="noopener noreferrer">
              <OpenOriginalIcon size={16} /> Mở trang gốc
            </a>
          ) : (
            <button className="dv-download" onClick={download}>
              <DownloadIcon size={16} /> Tải xuống
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}

export default DocumentViewerModal
