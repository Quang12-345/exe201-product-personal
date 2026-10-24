import { useState, useEffect, useCallback } from 'react'
import { getExams, createExam, updateExam, deleteExam, getSubjects, formatExamDate } from '../services/examService'
import { PlusIcon, EditIcon, TrashIcon, CalendarIcon } from '../../../components/common/icons.jsx'
import { notify } from '../../../components/common/toast.jsx'
import IconSelect from '../../../components/common/IconSelect.jsx'
import { subjectAll, subjectOptions } from '../../admin/services/filterMeta'

const EMPTY = { subject: '', title: '', exam_date: '', room: '', duration_minutes: 90, note: '' }

// ISO → giá trị input datetime-local (YYYY-MM-DDTHH:mm) theo giờ địa phương.
function toLocalInput(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function LecturerExams() {
  const [exams, setExams] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [form, setForm] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(() => {
    setLoading(true)
    getExams(filter).then(setExams).catch(() => setExams([])).finally(() => setLoading(false))
  }, [filter])

  useEffect(() => { load() }, [load])

  const openAdd = () => { setEditingId(null); setForm({ ...EMPTY, subject: filter !== 'all' ? filter : '' }); setError('') }
  const openEdit = (x) => {
    setEditingId(x.id)
    setForm({ subject: x.subject, title: x.title, exam_date: toLocalInput(x.exam_date), room: x.room || '', duration_minutes: x.duration_minutes || 0, note: x.note || '' })
    setError('')
  }
  const cancel = () => { setForm(null); setEditingId(null); setError('') }
  const change = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }))

  const submit = async (e) => {
    e.preventDefault()
    if (!form.subject || !form.title) { setError('Vui lòng nhập môn học và tiêu đề.'); return }
    setSaving(true)
    setError('')
    const payload = {
      subject: form.subject,
      title: form.title,
      exam_date: form.exam_date || null,
      room: form.room || null,
      duration_minutes: Number(form.duration_minutes) || 0,
      note: form.note || null,
    }
    try {
      if (editingId) await updateExam(editingId, payload)
      else await createExam(payload)
      notify(editingId ? 'Cập nhật lịch thi thành công.' : 'Thêm lịch thi thành công.')
      cancel()
      load()
    } catch (err) {
      const detail = err?.response?.data?.detail
      setError(typeof detail === 'string' ? detail : 'Lưu thất bại. Vui lòng thử lại.')
    } finally {
      setSaving(false)
    }
  }

  const remove = async (x) => {
    if (!window.confirm(`Xóa lịch thi "${x.title}"?`)) return
    try {
      await deleteExam(x.id)
      setExams((prev) => prev.filter((e) => e.id !== x.id))
      notify('Xóa lịch thi thành công.')
    } catch {
      notify('Xóa thất bại. Vui lòng thử lại.', 'error')
    }
  }

  return (
    <div>
      <div className="dmrs-page-head">
        <div>
          <h1 className="dmrs-page-title">Lịch thi</h1>
          <p className="dmrs-page-sub">Quản lý lịch thi theo môn học bạn phụ trách.</p>
        </div>
        <button className="dmrs-btn dmrs-btn--primary" onClick={openAdd}><PlusIcon size={18} /> Thêm lịch thi</button>
      </div>

      <div className="dmrs-card dmrs-toolbar">
        <IconSelect
          value={filter}
          onChange={setFilter}
          options={subjectOptions}
          allOption={subjectAll}
          placeholder="Tất cả môn học"
        />
        <span className="dmrs-muted" style={{ marginLeft: 'auto' }}><CalendarIcon size={16} /> {exams.length} lịch thi</span>
      </div>

      {form && (
        <form className="dmrs-card" onSubmit={submit} style={{ marginBottom: 16 }}>
          <h3 className="dmrs-card-title">{editingId ? 'Chỉnh sửa lịch thi' : 'Thêm lịch thi'}</h3>
          <div className="dmrs-field-row">
            <div className="dmrs-field">
              <label>Môn học <span className="dmrs-req">*</span></label>
              <select name="subject" value={form.subject} onChange={change} required>
                <option value="">Chọn môn học</option>
                {getSubjects().map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="dmrs-field"><label>Tiêu đề <span className="dmrs-req">*</span></label><input name="title" value={form.title} onChange={change} required /></div>
          </div>
          <div className="dmrs-field-row">
            <div className="dmrs-field"><label>Thời gian thi</label><input name="exam_date" type="datetime-local" value={form.exam_date} onChange={change} /></div>
            <div className="dmrs-field"><label>Phòng thi</label><input name="room" value={form.room} onChange={change} /></div>
          </div>
          <div className="dmrs-field-row">
            <div className="dmrs-field"><label>Thời lượng (phút)</label><input name="duration_minutes" type="number" min="0" value={form.duration_minutes} onChange={change} /></div>
            <div className="dmrs-field"><label>Ghi chú</label><input name="note" value={form.note} onChange={change} /></div>
          </div>
          {error ? <p style={{ color: '#dc2626' }}>{error}</p> : null}
          <div className="dmrs-form-footer">
            <button type="button" className="dmrs-btn dmrs-btn--ghost" onClick={cancel}>Hủy</button>
            <button type="submit" className="dmrs-btn dmrs-btn--primary" disabled={saving}>{saving ? 'Đang lưu...' : 'Lưu'}</button>
          </div>
        </form>
      )}

      <div className="dmrs-card dmrs-table-card">
        <table className="dmrs-table">
          <thead><tr><th>Môn học</th><th>Tiêu đề</th><th>Thời gian</th><th>Phòng</th><th>Thời lượng</th><th>Ghi chú</th><th></th></tr></thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="dmrs-muted" style={{ textAlign: 'center', padding: 24 }}>Đang tải...</td></tr>
            ) : exams.length === 0 ? (
              <tr><td colSpan={7} className="dmrs-muted" style={{ textAlign: 'center', padding: 24 }}>Chưa có lịch thi nào.</td></tr>
            ) : exams.map((x) => (
              <tr key={x.id}>
                <td>{x.subject}</td>
                <td><strong>{x.title}</strong></td>
                <td>{formatExamDate(x.exam_date)}</td>
                <td>{x.room || '—'}</td>
                <td>{x.duration_minutes ? `${x.duration_minutes} phút` : '—'}</td>
                <td>{x.note || '—'}</td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  <button type="button" className="dmrs-icon-btn" title="Sửa" onClick={() => openEdit(x)}><EditIcon size={16} /></button>
                  <button type="button" className="dmrs-icon-btn dmrs-icon-btn--danger" title="Xóa" onClick={() => remove(x)}><TrashIcon size={16} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default LecturerExams
