import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  CATEGORIES,
  getDocument,
  deleteDocument,
  getDownloadUrl,
  getSubjects,
  updateDocument,
} from '../services/documentService'
import StatusBadge from '../../admin/components/StatusBadge.jsx'
import DocumentPreview from '../../../components/common/DocumentPreview.jsx'
import { TrashIcon, DownloadIcon, EyeIcon } from '../../../components/common/icons.jsx'
import { notify } from '../../../components/common/toast.jsx'
import { fileTypeMeta } from '../../admin/services/filterMeta'

const AI_STATUS = {
  indexed: { variant: 'success', label: 'Đã lập chỉ mục', dot: true },
  pending: { variant: 'neutral', label: 'Chờ xử lý' },
  error: { variant: 'danger', label: 'Lỗi', dot: true },
}

function LecturerDocumentDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [doc, setDoc] = useState(undefined)
  const [form, setForm] = useState({ title: '', category: 'syllabus', subject: '' })
  const [deleting, setDeleting] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    getDocument(id)
      .then((data) => {
        setDoc(data)
        if (data) {
          setForm({
            title: data.title || data.name || '',
            category: data.category || 'syllabus',
            subject: data.subject === '—' ? '' : data.subject || '',
          })
        }
      })
      .catch(() => setDoc(null))
  }, [id])

  if (doc === undefined) return <p className="dmrs-loading">Đang tải...</p>
  if (doc === null) {
    return (
      <div>
        <div className="dmrs-breadcrumb"><Link to="/lecturer/documents">Kho tài liệu</Link> <span>›</span> Chi tiết</div>
        <p className="dmrs-muted">Không tìm thấy tài liệu.</p>
      </div>
    )
  }

  const st = AI_STATUS[doc.aiStatus] || AI_STATUS.pending
  const isSyllabus = form.category === 'syllabus'
  const fileMeta = fileTypeMeta(doc.type)
  const FileIcon = fileMeta.icon
  const change = (e) => setForm((current) => ({ ...current, [e.target.name]: e.target.value }))

  const save = async (e) => {
    e.preventDefault()
    if (!form.title.trim()) {
      notify('Vui lòng nhập tên tài liệu.')
      return
    }
    if (isSyllabus && !form.subject) {
      notify('Vui lòng chọn môn học.')
      return
    }
    setSaving(true)
    try {
      const updated = await updateDocument(doc.id, {
        title: form.title.trim(),
        category: form.category,
        subject: isSyllabus ? form.subject : null,
      })
      setDoc(updated)
      setForm({
        title: updated.title || updated.name || '',
        category: updated.category || 'syllabus',
        subject: updated.subject === '—' ? '' : updated.subject || '',
      })
      notify('Cập nhật tài liệu thành công.')
    } catch (err) {
      const detail = err?.response?.data?.detail
      notify(typeof detail === 'string' ? detail : 'Lưu tài liệu thất bại. Vui lòng thử lại.')
    } finally {
      setSaving(false)
    }
  }

  const remove = async () => {
    if (!window.confirm(`Xóa tài liệu "${doc.name}"? Hành động này không thể hoàn tác.`)) return
    setDeleting(true)
    try {
      await deleteDocument(doc.id)
      navigate('/lecturer/documents')
    } catch {
      notify('Xóa thất bại. Vui lòng thử lại.', 'error')
      setDeleting(false)
    }
  }

  const download = async () => {
    try {
      const url = await getDownloadUrl(doc.id)
      window.open(url, '_blank', 'noopener')
    } catch (err) {
      const detail = err?.response?.data?.detail
      notify(typeof detail === 'string' ? detail : 'Không tải được bản gốc.')
    }
  }

  return (
    <div>
      <div className="dmrs-breadcrumb"><Link to="/lecturer/documents">Kho tài liệu</Link> <span>›</span> Chỉnh sửa tài liệu</div>
      <div className="dmrs-page-head">
        <div>
          <h1 className="dmrs-page-title">Chỉnh sửa tài liệu</h1>
          <p className="dmrs-page-sub">Cập nhật tên tài liệu, phân loại và môn học cho trợ lý AI.</p>
        </div>
        <div className="dmrs-head-actions">
          <button type="button" className="dmrs-btn dmrs-btn--ghost" onClick={() => navigate('/lecturer/documents')}>Quay lại</button>
          <button type="button" className="dmrs-btn dmrs-btn--light" onClick={download}><DownloadIcon size={16} /> Tải bản gốc</button>
          <button type="button" className="dmrs-btn dmrs-btn--danger" onClick={remove} disabled={deleting}>
            <TrashIcon size={16} /> {deleting ? 'Đang xóa...' : 'Xóa tài liệu'}
          </button>
        </div>
      </div>

      <form className="dmrs-form-grid dmrs-form-grid--doc" onSubmit={save}>
        <div className="dmrs-form-col">
          <section className="dmrs-card">
            <h3 className="dmrs-card-title">Thông tin chỉnh sửa</h3>
            <div className="dmrs-field">
              <label>Tên tài liệu</label>
              <input name="title" value={form.title} onChange={change} />
            </div>
            <div className="dmrs-field">
              <label>Phân loại tài liệu</label>
              <select name="category" value={form.category} onChange={change}>
                {CATEGORIES.map((category) => (
                  <option key={category.value} value={category.value}>{category.label}</option>
                ))}
              </select>
            </div>
            <div className="dmrs-field">
              <label>Môn học</label>
              <select name="subject" value={form.subject} onChange={change} disabled={!isSyllabus}>
                <option value="">Chọn môn học</option>
                {getSubjects().map((subject) => (
                  <option key={subject} value={subject}>{subject}</option>
                ))}
              </select>
            </div>
            <div className="dmrs-form-footer dmrs-form-footer--tight">
              <button type="submit" className="dmrs-btn dmrs-btn--primary" disabled={saving}>
                {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
              </button>
            </div>
          </section>

          <section className="dmrs-card">
            <h3 className="dmrs-card-title">Thông tin tệp</h3>
            <div className="dmrs-file-row">
              <span className="dmrs-file-icon" style={{ color: fileMeta.color }}><FileIcon size={20} /></span>
              <div className="dmrs-file-row-info">
                <strong>{doc.name}</strong>
                <span className="dmrs-muted">{doc.type} • {doc.scope === 'school' ? 'Tài liệu nhà trường' : 'Tài liệu cá nhân'}</span>
              </div>
            </div>
          </section>
        </div>

        <div className="dmrs-form-col">
          <section className="dmrs-card">
            <h3 className="dmrs-card-title dmrs-underline">Thuộc tính</h3>
            <div className="dmrs-info-row"><span>Phân loại</span><strong>{doc.categoryLabel}</strong></div>
            <div className="dmrs-info-row"><span>Môn học</span><strong>{doc.subject}</strong></div>
            <div className="dmrs-info-row"><span>Ngày tải lên</span><strong>{doc.uploadedAt || '—'}</strong></div>
            <div className="dmrs-info-row"><span>Số trang</span><strong>{doc.totalPages || '—'}</strong></div>
            <div className="dmrs-info-row"><span>Số đoạn (chunks)</span><strong>{doc.totalChunks || 0}</strong></div>
            <div className="dmrs-info-row"><span>Trạng thái AI</span><StatusBadge variant={st.variant} dot={st.dot}>{st.label}</StatusBadge></div>
          </section>
        </div>
      </form>

      <section className="dmrs-card" style={{ marginTop: 22 }}>
        <h3 className="dmrs-card-title"><EyeIcon size={18} /> Xem trước tài liệu</h3>
        <DocumentPreview doc={doc} height={620} />
      </section>
    </div>
  )
}

export default LecturerDocumentDetail
