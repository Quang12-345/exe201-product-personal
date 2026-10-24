import { useState, useEffect, useCallback } from 'react'
import { getStudents, createStudent, updateStudent, deleteStudent, getSubjects } from '../services/studentService'
import { PlusIcon, EditIcon, TrashIcon, UsersIcon } from '../../../components/common/icons.jsx'
import { notify } from '../../../components/common/toast.jsx'
import IconSelect from '../../../components/common/IconSelect.jsx'
import { subjectAll, subjectOptions } from '../../admin/services/filterMeta'

const EMPTY = { student_code: '', full_name: '', subject: '', email: '', note: '' }

function LecturerStudents() {
  const [students, setStudents] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [form, setForm] = useState(null) // null: ẩn form; object: đang thêm/sửa
  const [editingId, setEditingId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(() => {
    setLoading(true)
    getStudents(filter).then(setStudents).catch(() => setStudents([])).finally(() => setLoading(false))
  }, [filter])

  useEffect(() => { load() }, [load])

  const openAdd = () => { setEditingId(null); setForm({ ...EMPTY, subject: filter !== 'all' ? filter : '' }); setError('') }
  const openEdit = (s) => { setEditingId(s.id); setForm({ student_code: s.student_code, full_name: s.full_name, subject: s.subject, email: s.email || '', note: s.note || '' }); setError('') }
  const cancel = () => { setForm(null); setEditingId(null); setError('') }
  const change = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }))

  const submit = async (e) => {
    e.preventDefault()
    if (!form.student_code || !form.full_name || !form.subject) { setError('Vui lòng nhập mã SV, họ tên và môn học.'); return }
    setSaving(true)
    setError('')
    try {
      if (editingId) await updateStudent(editingId, form)
      else await createStudent(form)
      notify(editingId ? 'Cập nhật sinh viên thành công.' : 'Thêm sinh viên thành công.')
      cancel()
      load()
    } catch (err) {
      const detail = err?.response?.data?.detail
      setError(typeof detail === 'string' ? detail : 'Lưu thất bại. Vui lòng thử lại.')
    } finally {
      setSaving(false)
    }
  }

  const remove = async (s) => {
    if (!window.confirm(`Xóa sinh viên "${s.full_name}" (${s.student_code})?`)) return
    try {
      await deleteStudent(s.id)
      setStudents((prev) => prev.filter((x) => x.id !== s.id))
      notify('Xóa sinh viên thành công.')
    } catch {
      notify('Xóa thất bại. Vui lòng thử lại.', 'error')
    }
  }

  return (
    <div>
      <div className="dmrs-page-head">
        <div>
          <h1 className="dmrs-page-title">Danh sách sinh viên</h1>
          <p className="dmrs-page-sub">Quản lý sinh viên theo môn học bạn phụ trách.</p>
        </div>
        <button className="dmrs-btn dmrs-btn--primary" onClick={openAdd}><PlusIcon size={18} /> Thêm sinh viên</button>
      </div>

      <div className="dmrs-card dmrs-toolbar">
        <IconSelect
          value={filter}
          onChange={setFilter}
          options={subjectOptions}
          allOption={subjectAll}
          placeholder="Tất cả môn học"
        />
        <span className="dmrs-muted" style={{ marginLeft: 'auto' }}><UsersIcon size={16} /> {students.length} sinh viên</span>
      </div>

      {form && (
        <form className="dmrs-card" onSubmit={submit} style={{ marginBottom: 16 }}>
          <h3 className="dmrs-card-title">{editingId ? 'Chỉnh sửa sinh viên' : 'Thêm sinh viên'}</h3>
          <div className="dmrs-field-row">
            <div className="dmrs-field"><label>Mã sinh viên <span className="dmrs-req">*</span></label><input name="student_code" value={form.student_code} onChange={change} required /></div>
            <div className="dmrs-field"><label>Họ và tên <span className="dmrs-req">*</span></label><input name="full_name" value={form.full_name} onChange={change} required /></div>
          </div>
          <div className="dmrs-field-row">
            <div className="dmrs-field">
              <label>Môn học <span className="dmrs-req">*</span></label>
              <select name="subject" value={form.subject} onChange={change} required>
                <option value="">Chọn môn học</option>
                {getSubjects().map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="dmrs-field"><label>Email</label><input name="email" type="email" value={form.email} onChange={change} /></div>
          </div>
          <div className="dmrs-field"><label>Ghi chú</label><input name="note" value={form.note} onChange={change} /></div>
          {error ? <p style={{ color: '#dc2626' }}>{error}</p> : null}
          <div className="dmrs-form-footer">
            <button type="button" className="dmrs-btn dmrs-btn--ghost" onClick={cancel}>Hủy</button>
            <button type="submit" className="dmrs-btn dmrs-btn--primary" disabled={saving}>{saving ? 'Đang lưu...' : 'Lưu'}</button>
          </div>
        </form>
      )}

      <div className="dmrs-card dmrs-table-card">
        <table className="dmrs-table">
          <thead><tr><th>Mã SV</th><th>Họ và tên</th><th>Môn học</th><th>Email</th><th>Ghi chú</th><th></th></tr></thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="dmrs-muted" style={{ textAlign: 'center', padding: 24 }}>Đang tải...</td></tr>
            ) : students.length === 0 ? (
              <tr><td colSpan={6} className="dmrs-muted" style={{ textAlign: 'center', padding: 24 }}>Chưa có sinh viên nào.</td></tr>
            ) : students.map((s) => (
              <tr key={s.id}>
                <td><strong>{s.student_code}</strong></td>
                <td>{s.full_name}</td>
                <td>{s.subject}</td>
                <td>{s.email || '—'}</td>
                <td>{s.note || '—'}</td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  <button type="button" className="dmrs-icon-btn" title="Sửa" onClick={() => openEdit(s)}><EditIcon size={16} /></button>
                  <button type="button" className="dmrs-icon-btn dmrs-icon-btn--danger" title="Xóa" onClick={() => remove(s)}><TrashIcon size={16} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default LecturerStudents
