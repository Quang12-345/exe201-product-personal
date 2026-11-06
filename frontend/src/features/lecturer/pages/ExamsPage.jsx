import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  getExams,
  createExam,
  updateExam,
  deleteExam,
  formatExamDate,
  getExamResources,
} from '../services/examService'
import { getClassrooms } from '../services/classroomService'
import {
  PlusIcon,
  EditIcon,
  TrashIcon,
  CalendarIcon,
  BookOpenIcon,
} from '../../../components/common/icons.jsx'
import { notify } from '../../../components/common/toast.jsx'
import IconSelect from '../../../components/common/IconSelect.jsx'
import UploadDocxQuizModal from '../components/UploadDocxQuizModal.jsx'
import { subjectAll } from '../../admin/services/filterMeta'

const EMPTY = {
  classroom_id: '',
  subject: '',
  title: '',
  exam_date: '',
  duration_minutes: 90,
  quiz_id: '',
}

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
  const [classrooms, setClassrooms] = useState([])
  const [resources, setResources] = useState({ quizzes: [] })
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [form, setForm] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [customSubjectMode, setCustomSubjectMode] = useState(false)
  const [uploadModalOpen, setUploadModalOpen] = useState(false)

  const handleQuizUploaded = (newQuiz) => {
    setResources((prev) => ({
      ...prev,
      quizzes: [
        {
          id: newQuiz.id,
          title: newQuiz.title,
          question_count: newQuiz.questions?.length || 0,
        },
        ...(prev.quizzes || []),
      ],
    }))
    setForm((f) => (f ? { ...f, quiz_id: newQuiz.id } : f))
  }

  // Tải danh sách lớp học và các bộ đề Quiz của giảng viên
  const loadMeta = useCallback(async () => {
    try {
      const [clsData, resData] = await Promise.all([
        getClassrooms().catch(() => []),
        getExamResources().catch(() => ({ quizzes: [] })),
      ])
      setClassrooms(clsData || [])
      setResources(resData || { quizzes: [] })
    } catch {
      // bỏ qua lỗi
    }
  }, [])

  useEffect(() => {
    loadMeta()
  }, [loadMeta])

  // Danh sách các môn học mà giảng viên phụ trách (từ các lớp học)
  const managedSubjects = useMemo(() => {
    const set = new Set()
    classrooms.forEach((c) => {
      if (c.subject && c.subject.trim()) {
        set.add(c.subject.trim())
      }
    })
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'vi'))
  }, [classrooms])

  // Danh sách tất cả các môn cho bộ lọc (bao gồm cả các môn đã có trong lịch thi)
  const filterSubjectOptions = useMemo(() => {
    const allSubjects = new Set(managedSubjects)
    exams.forEach((x) => {
      if (x.subject && x.subject.trim()) {
        allSubjects.add(x.subject.trim())
      }
    })
    return Array.from(allSubjects)
      .sort((a, b) => a.localeCompare(b, 'vi'))
      .map((s) => ({
        value: s,
        label: s,
        icon: BookOpenIcon,
        color: '#2563eb',
      }))
  }, [managedSubjects, exams])

  const load = useCallback(() => {
    setLoading(true)
    getExams(filter).then(setExams).catch(() => setExams([])).finally(() => setLoading(false))
  }, [filter])

  useEffect(() => { load() }, [load])

  const openAdd = () => {
    setEditingId(null)
    const firstClass = classrooms[0]
    setCustomSubjectMode(classrooms.length === 0)
    setForm({
      ...EMPTY,
      classroom_id: firstClass ? firstClass.id : '',
      subject: firstClass ? (firstClass.subject || '') : (filter !== 'all' ? filter : ''),
    })
    setError('')
  }

  const openEdit = (x) => {
    setEditingId(x.id)
    const isKnown = classrooms.some((c) => c.id === x.classroom_id) || managedSubjects.includes(x.subject)
    setCustomSubjectMode(!isKnown)
    setForm({
      classroom_id: x.classroom_id || '',
      subject: x.subject || '',
      title: x.title,
      exam_date: toLocalInput(x.exam_date),
      duration_minutes: x.duration_minutes || 90,
      quiz_id: x.quiz_id || '',
    })
    setError('')
  }

  const cancel = () => {
    setForm(null)
    setEditingId(null)
    setCustomSubjectMode(false)
    setError('')
  }

  const change = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }))

  const submit = async (e) => {
    e.preventDefault()
    if (!form.subject?.trim() || !form.title?.trim()) {
      setError('Vui lòng nhập môn học và tiêu đề.')
      return
    }
    setSaving(true)
    setError('')
    const payload = {
      classroom_id: form.classroom_id || null,
      subject: form.subject.trim(),
      title: form.title.trim(),
      exam_date: form.exam_date || null,
      room: form.room || null,
      duration_minutes: Number(form.duration_minutes) || 0,
      note: form.note || null,
      quiz_id: form.quiz_id || null,
      document_id: null,
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
          <h1 className="dmrs-page-title">Lịch thi trắc nghiệm</h1>
          <p className="dmrs-page-sub">
            Quản lý lịch thi và gắn đề trắc nghiệm. Hệ thống tự động chấm điểm khi sinh viên nộp bài.
          </p>
        </div>
        <button className="dmrs-btn dmrs-btn--primary" onClick={openAdd}>
          <PlusIcon size={18} /> Thêm lịch thi
        </button>
      </div>

      <div className="dmrs-card dmrs-toolbar">
        <IconSelect
          value={filter}
          onChange={setFilter}
          options={filterSubjectOptions}
          allOption={subjectAll}
          placeholder="Tất cả môn học"
        />
        <span className="dmrs-muted" style={{ marginLeft: 'auto' }}>
          <CalendarIcon size={16} /> {exams.length} lịch thi
        </span>
      </div>

      {form && (
        <form className="dmrs-card" onSubmit={submit} noValidate style={{ marginBottom: 16 }}>
          <h3 className="dmrs-card-title">{editingId ? 'Chỉnh sửa lịch thi' : 'Thêm lịch thi trắc nghiệm'}</h3>
          <div className="dmrs-field-row">
            <div className="dmrs-field">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <label style={{ margin: 0 }}>
                  Lớp học & Môn thi <span className="dmrs-req">*</span>
                </label>
                {classrooms.length > 0 && (
                  <button
                    type="button"
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#2563eb',
                      fontSize: 12,
                      cursor: 'pointer',
                      padding: 0,
                      fontWeight: 600,
                      textDecoration: 'underline',
                    }}
                    onClick={() => {
                      setCustomSubjectMode((prev) => !prev)
                      if (!customSubjectMode) {
                        setForm((f) => ({ ...f, classroom_id: '', subject: '' }))
                      }
                    }}
                  >
                    {customSubjectMode ? '← Chọn từ lớp học của tôi' : '+ Nhập môn học tự do'}
                  </button>
                )}
              </div>

              {customSubjectMode || classrooms.length === 0 ? (
                <input
                  name="subject"
                  value={form.subject}
                  onChange={change}
                  placeholder={classrooms.length === 0 ? 'Nhập tên môn học (chưa có lớp nào)...' : 'Nhập tên môn học khác...'}
                  required
                />
              ) : (
                <select
                  name="classroom_id"
                  value={form.classroom_id || ''}
                  onChange={(e) => {
                    const val = e.target.value
                    if (val === '__custom__') {
                      setCustomSubjectMode(true)
                      setForm((f) => ({ ...f, classroom_id: '', subject: '' }))
                    } else {
                      const matched = classrooms.find((c) => c.id === val)
                      setForm((f) => ({
                        ...f,
                        classroom_id: val,
                        subject: matched?.subject || f.subject,
                      }))
                    }
                  }}
                  required
                >
                  <option value="">-- Chọn lớp học áp dụng đề thi này --</option>
                  {classrooms.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.subject ? `[${c.subject}] ` : ''}{c.name} {c.code ? `(Mã lớp: ${c.code})` : ''}
                    </option>
                  ))}
                  <option value="__custom__">+ Môn học tự do (không theo lớp)...</option>
                </select>
              )}
            </div>

            <div className="dmrs-field">
              <label>
                Tiêu đề kỳ thi <span className="dmrs-req">*</span>
              </label>
              <input
                name="title"
                value={form.title}
                onChange={change}
                placeholder="Ví dụ: Thi trắc nghiệm giữa kỳ, Thi cuối kỳ..."
                required
              />
            </div>
          </div>

          <div className="dmrs-field-row">
            <div className="dmrs-field">
              <label>Thời gian thi</label>
              <input name="exam_date" type="datetime-local" value={form.exam_date} onChange={change} />
              <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 4 }}>
                💡 Điền đủ cả <strong>Ngày</strong> và <strong>Giờ thi</strong> (hoặc nhấn biểu tượng 📅). Để trống nếu chưa xếp ngày.
              </div>
            </div>
            <div className="dmrs-field">
              <label>Thời lượng (phút)</label>
              <input name="duration_minutes" type="number" min="0" value={form.duration_minutes} onChange={change} placeholder="90" />
            </div>
          </div>

          {/* GẮN BỘ ĐỀ THI TRẮC NGHIỆM AI */}
          <div
            style={{
              marginTop: 14,
              marginBottom: 10,
              padding: '14px 16px',
              backgroundColor: '#f8fafc',
              border: '1.5px solid #cbd5e1',
              borderRadius: 8,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <span style={{ fontSize: 18 }}>⚡</span>
                <strong style={{ fontSize: 14, color: '#0f172a' }}>
                  Bộ đề thi trắc nghiệm (File Word)
                </strong>
              </div>
              <button
                type="button"
                onClick={() => setUploadModalOpen(true)}
                style={{
                  backgroundColor: '#ffffff',
                  border: '1.5px solid #4338ca',
                  color: '#4338ca',
                  borderRadius: 6,
                  padding: '3px 9px',
                  fontSize: 12,
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                }}
              >
                📥 Nhập đề từ file Word (.docx)
              </button>
            </div>
            <div className="dmrs-field" style={{ margin: 0 }}>
              <select name="quiz_id" value={form.quiz_id || ''} onChange={change}>
                <option value="">-- Chọn bộ đề thi trắc nghiệm --</option>
                {(resources.quizzes || []).map((q) => (
                  <option key={q.id} value={q.id}>
                    {q.title} ({q.question_count} câu hỏi trắc nghiệm)
                  </option>
                ))}
              </select>
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 5 }}>
                💡 Sinh viên chỉ được làm bài thi trực tuyến, không được xem trước hay tải đề thi về máy. Sau khi sinh viên nộp bài, <strong>hệ thống sẽ tự động chấm điểm</strong> và hiển thị kết quả tại mục &quot;Bài nộp gần đây&quot;.
              </div>
            </div>
          </div>

          {error ? <p style={{ color: '#dc2626', margin: '8px 0', fontSize: 13 }}>{error}</p> : null}
          <div className="dmrs-form-footer">
            <button type="button" className="dmrs-btn dmrs-btn--ghost" onClick={cancel}>
              Hủy
            </button>
            <button type="submit" className="dmrs-btn dmrs-btn--primary" disabled={saving}>
              {saving ? 'Đang lưu...' : 'Lưu lịch thi'}
            </button>
          </div>
        </form>
      )}

      <div className="dmrs-card dmrs-table-card">
        <table className="dmrs-table">
          <thead>
            <tr>
              <th>Môn học / Lớp</th>
              <th>Tiêu đề</th>
              <th>Thời gian</th>
              <th>Thời lượng</th>
              <th>Đề thi trắc nghiệm</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="dmrs-muted" style={{ textAlign: 'center', padding: 24 }}>
                  Đang tải...
                </td>
              </tr>
            ) : exams.length === 0 ? (
              <tr>
                <td colSpan={6} className="dmrs-muted" style={{ textAlign: 'center', padding: 24 }}>
                  Chưa có lịch thi nào.
                </td>
              </tr>
            ) : (
              exams.map((x) => (
                <tr key={x.id}>
                  <td>
                    <div style={{ fontWeight: 700, color: '#1d4ed8' }}>{x.subject}</div>
                    {x.classroom_name || x.classroom_code ? (
                      <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 2 }}>
                        🏫 {x.classroom_name || x.classroom_code}
                      </div>
                    ) : null}
                  </td>
                  <td>
                    <strong>{x.title}</strong>
                  </td>
                  <td>{formatExamDate(x.exam_date)}</td>
                  
                  <td>{x.duration_minutes ? `${x.duration_minutes} phút` : '—'}</td>
                  <td>
                    {x.quiz_id ? (
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          padding: '4px 9px',
                          borderRadius: 5,
                          fontSize: 12,
                          backgroundColor: '#f5f3ff',
                          color: '#6d28d9',
                          border: '1px solid #ddd6fe',
                          fontWeight: 700,
                        }}
                      >
                        ⚡ {x.quiz_title || 'Quiz'} ({x.quiz_question_count || 0} câu)
                      </span>
                    ) : (
                      <span className="dmrs-muted" style={{ fontSize: 12 }}>
                        Chưa gắn đề
                      </span>
                    )}
                  </td>
                  
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <button type="button" className="dmrs-icon-btn" title="Sửa" onClick={() => openEdit(x)}>
                      <EditIcon size={16} />
                    </button>
                    <button
                      type="button"
                      className="dmrs-icon-btn dmrs-icon-btn--danger"
                      title="Xóa"
                      onClick={() => remove(x)}
                    >
                      <TrashIcon size={16} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <UploadDocxQuizModal
        isOpen={uploadModalOpen}
        onClose={() => setUploadModalOpen(false)}
        onSuccess={handleQuizUploaded}
      />
    </div>
  )
}

export default LecturerExams
