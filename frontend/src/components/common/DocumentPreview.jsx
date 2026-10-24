import { useState, useEffect, useRef } from 'react'
import { renderAsync } from 'docx-preview'
import { fetchDocBlob, fetchDocBlobUrl, fetchDocText } from '../../services/documentViewService'
import { FileTextIcon, LinkIcon, YouTubeIcon } from './icons.jsx'
import './DocumentPreview.css'

const INLINE_TYPES = ['PDF']
const VIDEO_TYPES = ['MP4', 'WEBM', 'MOV', 'MKV', 'AVI']

// Link YouTube → dạng nhúng; null nếu không phải.
function youtubeEmbed(url) {
  if (!url) return null
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/)
  return m ? `https://www.youtube.com/embed/${m[1]}` : null
}

// Xem trước tài liệu NHÚNG TRỰC TIẾP trong trang (không phải popup).
// PDF/video phát ngay, DOCX/PPTX hiện văn bản, link/YouTube nhúng iframe.
function DocumentPreview({ doc, height = 560 }) {
  const docxHostRef = useRef(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [blobUrl, setBlobUrl] = useState('')
  const [docBlob, setDocBlob] = useState(null)
  const [text, setText] = useState('')
  const [docxRendering, setDocxRendering] = useState(false)
  const [docxFallback, setDocxFallback] = useState(false)
  const [linkView, setLinkView] = useState('web')

  const type = (doc?.type || '').toUpperCase()
  const isLink = doc?.kind === 'link' || doc?.kind === 'youtube' || type === 'LINK' || type === 'YOUTUBE'
  const isVideo = doc?.kind === 'media' || VIDEO_TYPES.includes(type)
  const isInline = INLINE_TYPES.includes(type)
  const isDocx = type === 'DOCX'
  const needsBlob = isInline || isVideo
  const ytEmbed = isLink ? youtubeEmbed(doc?.url) : null
  const isEmbeddableLink = Boolean(ytEmbed)
  const isWebLink = isLink && !isEmbeddableLink
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

  return (
    <div className="dp-box" style={{ height }}>
      {isEmbeddableLink ? (
        <iframe className="dp-frame" src={ytEmbed} title={doc?.name}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
      ) : isWebLink ? (
        <div className="dp-link-preview">
          <div className="dp-link-toolbar">
            <div className="dp-link-tabs" role="tablist" aria-label="Chế độ xem liên kết">
              <button
                type="button"
                className={'dp-link-tab' + (linkView === 'web' ? ' is-active' : '')}
                onClick={() => setLinkView('web')}
              >
                <LinkIcon size={15} /> Trang web
              </button>
              <button
                type="button"
                className={'dp-link-tab' + (linkView === 'text' ? ' is-active' : '')}
                onClick={() => setLinkView('text')}
              >
                <FileTextIcon size={15} /> Nội dung
              </button>
            </div>
            <a className="dp-link-open" href={doc?.url} target="_blank" rel="noopener noreferrer">
              <OpenOriginalIcon size={15} /> Mở trang gốc
            </a>
          </div>
          <div className="dp-link-body">
            {linkView === 'web' ? (
              <iframe className="dp-frame" src={doc?.url} title={doc?.name} />
            ) : (
              <>
                {loading && <div className="dp-state">Đang tải nội dung tài liệu...</div>}
                {!loading && error && <div className="dp-state dp-error">{error}</div>}
                {!loading && !error && <pre className="dp-text">{text}</pre>}
              </>
            )}
          </div>
        </div>
      ) : (
        <>
          {loading && <div className="dp-state">Đang tải nội dung tài liệu...</div>}
          {!loading && error && <div className="dp-state dp-error">{error}</div>}
          {!loading && !error && isVideo && blobUrl && (
            <video className="dp-frame" src={blobUrl} controls style={{ background: '#000' }} />
          )}
          {!loading && !error && isInline && blobUrl && (
            <iframe className="dp-frame" src={blobUrl} title={doc?.name} />
          )}
          {!loading && !error && isDocx && (
            docxFallback ? (
              <pre className="dp-text">{text}</pre>
            ) : (
              <div className="dp-docx-shell">
                <div ref={docxHostRef} className="dp-docx-view" />
                {docxRendering && <div className="dp-state dp-docx-state">Đang dựng bố cục DOCX...</div>}
              </div>
            )
          )}
          {!loading && !error && !isInline && !isVideo && !isDocx && (
            <pre className="dp-text">{text}</pre>
          )}
        </>
      )}
    </div>
  )
}

export default DocumentPreview
