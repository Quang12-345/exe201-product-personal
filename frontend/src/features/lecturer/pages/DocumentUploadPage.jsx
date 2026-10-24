import { useRef, useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { uploadDocument, submitLink, getDocuments } from '../services/documentService'
import { getClassrooms } from '../services/classroomService'
import IconSelect from '../../../components/common/IconSelect.jsx'
import { subjectOptions } from '../../admin/services/filterMeta'
import { suggestMetadataFromFile, suggestMetadataFromLink } from '../../../services/documentMetaService'
import MySubmissionsPanel from '../../../components/common/MySubmissionsPanel.jsx'
import DocumentViewerModal from '../../../components/common/DocumentViewerModal.jsx'
import UploadGuideCard from '../../../components/common/UploadGuideCard.jsx'
import { UploadCloudIcon, FileTextIcon, LinkIcon, SparklesIcon } from '../../../components/common/icons.jsx'
import { notify } from '../../../components/common/toast.jsx'

const ACCEPT = '.pdf,.docx,.pptx,.txt,.md,.markdown,.mp4,.webm,.mov,.mkv,.avi'

function LecturerUpload() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const initialClassroomId = searchParams.get('classroom_id') || ''

  const fileInputRef = useRef(null)
  const [mode, setMode] = useState('file') // file | link
  const [file, setFile] = useState(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [subject, setSubject] = useState('')
  const [classroomId, setClassroomId] = useState(initialClassroomId)
  const [classrooms, setClassrooms] = useState([])
  const [linkUrl, setLinkUrl] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)
  const [viewing, setViewing] = useState(null)
  const [aiLoading, setAiLoading] = useState(false)

  useEffect(() => {
    getClassrooms()
      .then((data) => {
        setClassrooms(data || [])
        if (initialClassroomId) {
          const matched = data.find((c) => c.id === initialClassroomId)
          if (matched && matched.subject) {
            setSubject(matched.subject)
          }
        }
      })
      .catch(() => setClassrooms([]))
  }, [initialClassroomId])

  // AI tự điền tiêu đề/mô tả — chỉ điền vào ô đang trống để không ghi đè nội dung
  // người dùng đã nhập; người dùng vẫn chỉnh sửa lại được sau đó.
  const autoFill = async (loader) => {
    setAiLoading(true)
    try {
      const meta = await loader()
      if (meta.title) setTitle((t) => t.trim() || meta.title)
      if (meta.description) setDescription((d) => d.trim() || meta.description)
    } catch { /* soft-fail: không chặn luồng tải lên */ } finally {
      setAiLoading(false)
    }
  }

  const pickFile = (f) => {
    setError(''); setSuccess(''); setFile(f || null)
    if (f) autoFill(() => suggestMetadataFromFile(f))
  }

  const handleLinkBlur = () => {
    const url = linkUrl.trim()
    if (/^https?:\/\//i.test(url)) autoFill(() => suggestMetadataFromLink(url))
  }

  const resetForm = () => { setFile(null); setTitle(''); setDescription(''); setSubject(''); setLinkUrl('') }

  // Đổi tab tệp/liên kết: xoá tiêu đề/mô tả + dữ liệu nhập cũ để AI gợi ý LẠI đúng nguồn mới.
  const switchMode = (m) => {
    if (m === mode) return
    setMode(m); setError(''); setSuccess('')
    setTitle(''); setDescription(''); setFile(null); setLinkUrl('')
  }

  const submit = async (e) => {
    e.preventDefault()
    setError(''); setSuccess('')
    if (mode === 'file') {
      if (!file) { setError('Vui lòng chọn tệp tài liệu.'); return }
    } else if (!linkUrl.trim()) {
      setError('Vui lòng nhập liên kết.'); return
    }
    if (!subject) { setError('Vui lòng chọn môn học.'); return }
    setSaving(true)
    try {
      if (mode === 'file') {
        const res = await uploadDocument({
          file,
          subject,
          title,
          description,
          classroom_id: classroomId || undefined,
        })
        if (res.failed) { setError(`Xử lý tài liệu thất bại: ${res.error || 'lỗi không xác định'}`); return }
        setSuccess('Đã tải lên tài liệu. Xem trạng thái ở "Đề trình của tôi".')
        notify('Tải lên tài liệu thành công.')
      } else {
        const doc = await submitLink({ url: linkUrl.trim(), subject, title, description })
        setSuccess(
          doc?.status === 'pending_transcript'
            ? 'Đã thêm video. Đang chờ lấy phụ đề (transcript) để xử lý — sẽ tự sẵn sàng sau giây lát.'
            : 'Đã thêm liên kết vào kho tri thức.'
        )
        notify('Thêm liên kết thành công.')
      }
      resetForm()
      setRefreshKey((k) => k + 1)
    } catch (err) {
      const detail = err?.response?.data?.detail
      setError(typeof detail === 'string' ? detail : 'Tải lên thất bại. Vui lòng thử lại.')
      notify(typeof detail === 'string' ? detail : 'Tải lên thất bại. Vui lòng thử lại.')
    } finally {
      setSaving(false)
    }
  }

  const openDoc = (d) => {
    if (d.kind === 'link' && d.url) { window.open(d.url, '_blank', 'noopener'); return }
    setViewing(d)
  }

  return (
    <div>
      <div className="dmrs-page-head">
        <div>
          <h1 className="dmrs-page-title">Tải lên tài liệu học tập</h1>
          <p className="dmrs-page-sub">Thêm tài liệu cá nhân vào kho tri thức của trợ lý AI.</p>
        </div>
      </div>

      <div className="lec-upload-grid">
        <form className="dmrs-card" onSubmit={submit}>
          <div className="dmrs-upload-tabs">
            <button type="button" className={'dmrs-upload-tab' + (mode === 'file' ? ' is-active' : '')} onClick={() => switchMode('file')}>
              <FileTextIcon size={18} /> Tài liệu
            </button>
            <button type="button" className={'dmrs-upload-tab' + (mode === 'link' ? ' is-active' : '')} onClick={() => switchMode('link')}>
              <LinkIcon size={18} /> Liên kết
            </button>
          </div>

          {mode === 'file' ? (
            <>
              <input ref={fileInputRef} type="file" accept={ACCEPT} style={{ display: 'none' }} onChange={(e) => pickFile(e.target.files?.[0])} />
              <div
                className="dmrs-dropzone"
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); pickFile(e.dataTransfer.files?.[0]) }}
                style={{ cursor: 'pointer' }}
              >
                <span className="dmrs-dropzone-icon"><UploadCloudIcon size={32} /></span>
                {file ? <strong>{file.name}</strong> : <strong>Thả tệp của bạn vào đây</strong>}
                <p className="dmrs-muted">hoặc nhấp để duyệt từ máy tính</p>
                <button type="button" className="dmrs-btn dmrs-btn--light" onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click() }}>
                  {file ? 'Chọn tệp khác' : 'Duyệt tệp'}
                </button>
                <p className="dmrs-muted dmrs-dropzone-hint">Hỗ trợ PDF, Word, PowerPoint, Text (.txt/.md), Video</p>
              </div>
            </>
          ) : (
            <div className="dmrs-field">
              <label>Liên kết (URL) <span className="dmrs-req">*</span></label>
              <input type="url" value={linkUrl} onChange={(e) => { setLinkUrl(e.target.value); setError(''); setSuccess('') }} onBlur={handleLinkBlur} placeholder="https://... (web, YouTube, video)" />
              <p className="dmrs-muted" style={{ fontSize: 12, marginTop: 6 }}>Dán liên kết trang web, video hoặc YouTube để lưu vào kho tri thức.</p>
            </div>
          )}

          <div className="dmrs-field" style={{ marginTop: 18 }}>
            <label>
              Tiêu đề {mode === 'link' ? <span className="dmrs-req">*</span> : null}
              {aiLoading ? <span style={{ color: '#7c3aed', fontSize: 12, marginLeft: 8, fontWeight: 500 }}><SparklesIcon size={12} /> AI đang gợi ý...</span> : null}
            </label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Nhập tiêu đề tài liệu" />
          </div>

          <>
            <div className="dmrs-field">
              <label>Môn học <span className="dmrs-req">*</span></label>
              <IconSelect
                value={subject}
                onChange={setSubject}
                options={subjectOptions}
                placeholder="Chọn môn học"
                clearable={false}
                className="dmrs-field-select"
              />
            </div>

            <div className="dmrs-field">
              <label>Phạm vi lưu trữ & Cô lập tài liệu</label>
              <select
                value={classroomId}
                onChange={(e) => {
                  const val = e.target.value
                  setClassroomId(val)
                  if (val) {
                    const matched = classrooms.find((c) => c.id === val)
                    if (matched && matched.subject) setSubject(matched.subject)
                  }
                }}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: 8,
                  border: '1.5px solid #000000',
                  fontWeight: 600,
                  backgroundColor: '#ffffff',
                }}
              >
                <option value="">🌐 Thư viện chung (Toàn trường)</option>
                {classrooms.map((c) => (
                  <option key={c.id} value={c.id}>
                    🔒 Lớp học: {c.name} ({c.code})
                  </option>
                ))}
              </select>
              {classroomId ? (
                <p style={{ fontSize: 12.5, color: '#1d4ed8', marginTop: 6, fontWeight: 600 }}>
                  🔒 Tài liệu này sẽ được cô lập tuyệt đối cho lớp học đã chọn. Lớp khác không thể xem được.
                </p>
              ) : (
                <p style={{ fontSize: 12.5, color: '#6b7280', marginTop: 6 }}>
                  Tài liệu chung có thể hiển thị trong kho tài nguyên toàn trường cho môn học tương ứng.
                </p>
              )}
            </div>
          </>

          <div className="dmrs-field">
            <label>Mô tả</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Mô tả ngắn gọn về nội dung này" rows={3} />
          </div>

          {error ? <p className="dmrs-error" style={{ color: '#dc2626', marginTop: 12 }}>{error}</p> : null}
          {success ? <p style={{ color: '#059669', marginTop: 12, fontSize: 14 }}>{success}</p> : null}

          <div className="dmrs-form-footer">
            <button type="button" className="dmrs-btn dmrs-btn--ghost" onClick={() => navigate('/lecturer/documents')}>Về kho tài liệu</button>
            <button type="submit" className="dmrs-btn dmrs-btn--primary" disabled={saving}>
              {saving ? 'Đang xử lý...' : mode === 'file' ? 'Lưu và Tải lên' : 'Thêm liên kết'}
            </button>
          </div>
        </form>

        <div className="lec-upload-side">
          <MySubmissionsPanel fetchDocs={getDocuments} refreshKey={refreshKey} onOpen={openDoc} />
          <UploadGuideCard />
        </div>
      </div>

      {viewing && <DocumentViewerModal doc={viewing} onClose={() => setViewing(null)} />}
    </div>
  )
}

export default LecturerUpload
