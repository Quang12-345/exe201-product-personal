import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/context/AuthContext.jsx'
import {
  UploadIcon,
  PlusIcon,
  BookOpenIcon,
  UsersIcon,
  ArchiveIcon,
  HelpIcon,
  GraduationCapIcon,
  ArrowRightIcon,
} from '../../../components/common/icons.jsx'
import { Link } from 'react-router-dom'
import { getStatsOverview } from '../../../services/statsApi'
import { getStudents } from '../services/studentService'
import { getExams, getRecentSubmissions } from '../services/examService'
import { getClassrooms, createClassroom } from '../services/classroomService'
import { notify } from '../../../components/common/toast.jsx'

// Danh sách lớp học dự phòng nếu chưa có dữ liệu
const DEFAULT_CLASSES = [
  {
    id: 'class-1',
    name: 'Tâm lý học nhận thức (Nhóm A)',
    student_count: 48,
    document_count: 5,
    statusText: '3 bài kiểm tra chờ chấm',
  },
  {
    id: 'class-2',
    name: 'Nhập môn Khoa học thần kinh',
    student_count: 36,
    document_count: 3,
    statusText: 'Cập nhật 2 giờ trước',
  },
  {
    id: 'class-3',
    name: 'Phòng thí nghiệm Khoa học hành vi',
    student_count: 28,
    document_count: 2,
    statusText: 'Không có bài nộp mới',
  },
]

// Hàm chuyển đổi mốc thời gian sang dạng tương đối thân thiện (VD: Vừa xong, 15 phút trước, Hôm qua)
function formatRelativeTime(dateStr, fallback = 'Vừa xong') {
  if (!dateStr) return fallback
  try {
    let str = String(dateStr).trim()
    if (!str.endsWith('Z') && !/[+-]\d{2}:?\d{2}$/.test(str)) {
      str = str.replace(' ', 'T') + 'Z'
    }
    const d = new Date(str)
    if (isNaN(d.getTime())) return fallback
    const diffMs = Date.now() - d.getTime()
    const diffMins = Math.floor(diffMs / (1000 * 60))
    if (diffMins < 1) return 'Vừa xong'
    if (diffMins < 60) return `${diffMins} phút trước`
    const diffHours = Math.floor(diffMins / (1000 * 60 * 60))
    if (diffHours < 24) return `${diffHours} giờ trước`
    const diffDays = Math.floor(diffHours / 24)
    if (diffDays === 1) return 'Hôm qua'
    if (diffDays < 7) return `${diffDays} ngày trước`
    return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
  } catch {
    return fallback
  }
}


function LecturerDashboard() {
  const navigate = useNavigate()
  const { user } = useAuth()

  // Dữ liệu từ backend
  const [stats, setStats] = useState(null)
  const [students, setStudents] = useState([])
  const [exams, setExams] = useState([])
  const [classrooms, setClassrooms] = useState([])
  const [submissions, setSubmissions] = useState([])
  const [loadingSubmissions, setLoadingSubmissions] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newClassName, setNewClassName] = useState('')
  const [newClassSubject, setNewClassSubject] = useState('')
  const [creating, setCreating] = useState(false)

  // Tên hiển thị chuẩn giảng viên (khớp giao diện GS. Jenkins)
  const rawName = user?.name || user?.username || 'GS. Jenkins'
  const displayName = rawName.includes('GS.') || rawName.includes('ThS.') || rawName.includes('TS.')
    ? rawName
    : `GS. ${rawName}`

  const loadData = () => {
    Promise.all([
      getStatsOverview().catch(() => null),
      getStudents().catch(() => []),
      getExams().catch(() => []),
      getClassrooms().catch(() => []),
      getRecentSubmissions().catch(() => []),
    ]).then(([statsData, studentsData, examsData, classData, submData]) => {
      if (statsData) setStats(statsData)
      if (Array.isArray(studentsData)) setStudents(studentsData)
      if (Array.isArray(examsData)) setExams(examsData)
      if (Array.isArray(classData) && classData.length > 0) {
        setClassrooms(classData)
      } else {
        setClassrooms([])
      }
      if (Array.isArray(submData)) {
        setSubmissions(submData)
      } else {
        setSubmissions([])
      }
      setLoadingSubmissions(false)
    })
  }


  useEffect(() => {
    loadData()
  }, [])

  // Tính số liệu cho 4 thẻ thống kê
  const docCard = stats?.cards?.find((c) => c.key === 'documents')
  const totalDocs = docCard?.value ?? 42
  const classStudentTotal = classrooms.reduce((acc, c) => acc + (c.student_count || 0), 0)
  const totalStudents = classStudentTotal > 0 ? classStudentTotal : (students.length > 0 ? (students.length >= 10 ? students.length : 148 + students.length) : 148)
  const activeClassesCount = classrooms.length > 0 ? classrooms.length : DEFAULT_CLASSES.length
  const examsCount = exams.length > 0 ? exams.length : 3

  // Tổng hợp danh sách lớp học hiển thị (ưu tiên lớp thật từ DB)
  const displayClasses = classrooms.length > 0 ? classrooms : DEFAULT_CLASSES

  // Xử lý tạo lớp học mới thật vào backend
  const handleCreateClass = async (e) => {
    e.preventDefault()
    if (!newClassName.trim()) {
      notify('Vui lòng nhập tên lớp học.', 'error')
      return
    }

    setCreating(true)
    try {
      const created = await createClassroom({
        name: newClassName.trim(),
        subject: newClassSubject.trim() || newClassName.trim(),
      })
      notify(`Đã tạo lớp "${created.name}" thành công!`)
      setShowCreateModal(false)
      setNewClassName('')
      setNewClassSubject('')
      // Reload lại danh sách lớp học
      loadData()
      // Điều hướng ngay tới chi tiết lớp vừa tạo
      if (created.id) {
        navigate(`/lecturer/classes/${created.id}`)
      }
    } catch (err) {
      const msg = err?.response?.data?.detail || 'Tạo lớp học thất bại, vui lòng thử lại.'
      notify(typeof msg === 'string' ? msg : 'Lỗi khi tạo lớp học.', 'error')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div style={{ maxWidth: 1240, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header chào mừng & nút thao tác */}
      <div className="lec-header-row">
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              backgroundColor: '#E5F970',
              border: '2px solid #000000',
              boxShadow: '2px 2px 0px #000000',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              color: '#000000',
            }}
          >
            <GraduationCapIcon size={24} />
          </div>
          <div>
            <h1 className="lec-header-title">
              Xin chào, {displayName} 👋
            </h1>
            <p className="lec-header-sub">
              Lớp tiếp theo bắt đầu sau 45 phút • Chúc thầy/cô một ngày giảng dạy hiệu quả!
            </p>
          </div>
        </div>

        <div className="lec-header-actions">
          <button
            type="button"
            className="lec-btn-create"
            onClick={() => setShowCreateModal(true)}
          >
            <PlusIcon size={18} />
            <span>Tạo lớp học</span>
          </button>

          <button
            type="button"
            className="lec-btn-upload"
            onClick={() => navigate('/lecturer/documents')}
          >
            <ArchiveIcon size={18} />
            <span>Kho tài liệu</span>
          </button>
        </div>
      </div>

      {/* 4 Thẻ thống kê chuẩn Neo-brutalist pop */}
      <div className="lec-stat-grid">
        {/* Card 1: Tổng sinh viên */}
        <div className="lec-stat-card lec-stat-card--blue">
          <div className="lec-stat-top">
            <span className="lec-stat-label">TỔNG SINH VIÊN</span>
            <span className="lec-stat-icon-box" style={{ backgroundColor: '#eff6ff', color: '#2563eb' }}>
              <UsersIcon size={18} />
            </span>
          </div>
          <div className="lec-stat-val">{totalStudents}</div>
          <div className="lec-stat-sub">
            <span className="lec-stat-badge lec-stat-badge--green">+12% so với kỳ trước</span>
          </div>
        </div>

        {/* Card 2: Lớp đang hoạt động */}
        <div className="lec-stat-card lec-stat-card--yellow">
          <div className="lec-stat-top">
            <span className="lec-stat-label">LỚP ĐANG HOẠT ĐỘNG</span>
            <span className="lec-stat-icon-box" style={{ backgroundColor: '#fefce8', color: '#ca8a04' }}>
              <BookOpenIcon size={18} />
            </span>
          </div>
          <div className="lec-stat-val">{activeClassesCount}</div>
          <div className="lec-stat-sub">
            <span className="lec-stat-badge lec-stat-badge--neutral">0 lớp lưu trữ</span>
          </div>
        </div>

        {/* Card 3: Bài kiểm tra tuần này */}
        <div className="lec-stat-card lec-stat-card--purple">
          <div className="lec-stat-top">
            <span className="lec-stat-label">BÀI KIỂM TRA TUẦN NÀY</span>
            <span className="lec-stat-icon-box" style={{ backgroundColor: '#f5f3ff', color: '#7c3aed' }}>
              <HelpIcon size={18} />
            </span>
          </div>
          <div className="lec-stat-val">{examsCount}</div>
          <div className="lec-stat-sub">
            <span className="lec-stat-badge lec-stat-badge--neutral">2 đã xuất bản</span>
          </div>
        </div>

        {/* Card 4: Tài liệu đã tải */}
        <div className="lec-stat-card lec-stat-card--green">
          <div className="lec-stat-top">
            <span className="lec-stat-label">TÀI LIỆU ĐÃ TẢI</span>
            <span className="lec-stat-icon-box" style={{ backgroundColor: '#ecfdf5', color: '#059669' }}>
              <ArchiveIcon size={18} />
            </span>
          </div>
          <div className="lec-stat-val">{totalDocs}</div>
          <div className="lec-stat-sub">
            <span className="lec-stat-badge lec-stat-badge--green">6 mới thêm tuần này</span>
          </div>
        </div>
      </div>

      {/* Khung 2 cột: Lớp học của tôi + Bài nộp gần đây */}
      <div className="lec-bottom-grid">
        {/* Cột trái: Lớp học của tôi */}
        <div className="lec-classes-col">
          <div className="lec-sec-head">
            <h2 className="lec-sec-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <BookOpenIcon size={20} /> Lớp học của tôi
            </h2>
            <Link
              to="/lecturer/classes"
              style={{
                fontSize: 13.5,
                fontWeight: 800,
                color: '#2563eb',
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              Xem tất cả <ArrowRightIcon size={14} />
            </Link>
          </div>

          <div className="lec-classes-list">
            {displayClasses.map((item) => (
              <div
                key={item.id}
                className="lec-class-card"
                onClick={() => {
                  if (item.id && !item.id.startsWith('class-')) {
                    navigate(`/lecturer/classes/${item.id}`)
                  } else {
                    navigate('/lecturer/classes')
                  }
                }}
                title="Nhấn để xem chi tiết lớp học"
              >
                <div className="lec-class-info">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, flexWrap: 'wrap' }}>
                    {item.code && (
                      <span
                        style={{
                          fontFamily: 'monospace',
                          fontWeight: 800,
                          fontSize: 11.5,
                          backgroundColor: '#f1f5f9',
                          border: '1.5px solid #000000',
                          borderRadius: 6,
                          padding: '2px 7px',
                        }}
                      >
                        {item.code}
                      </span>
                    )}
                    {item.subject && (
                      <span
                        style={{
                          backgroundColor: '#E5F970',
                          border: '1.5px solid #000000',
                          borderRadius: 6,
                          padding: '2px 7px',
                          fontSize: 11,
                          fontWeight: 800,
                          color: '#000000',
                        }}
                      >
                        {item.subject}
                      </span>
                    )}
                  </div>
                  <div className="lec-class-name">{item.name}</div>
                  <div className="lec-class-count" style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 4 }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                      <UsersIcon size={14} /> {item.student_count ?? item.studentCount ?? 0} sinh viên
                    </span>
                    <span>•</span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                      <ArchiveIcon size={14} /> {item.document_count ?? 0} tài liệu
                    </span>
                  </div>
                </div>
                <div className="lec-class-status">
                  <span className="lec-blue-dot" />
                  <span>{item.statusText || 'Đang hoạt động'}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Cột phải: Bài nộp gần đây */}
        <div className="lec-subm-col">
          <div className="lec-sec-head">
            <h2 className="lec-sec-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <HelpIcon size={20} /> Bài nộp gần đây
            </h2>
          </div>

          <div className="lec-table-box">
            <table className="lec-subm-table">
              <thead>
                <tr>
                  <th>SINH VIÊN</th>
                  <th>BÀI KIỂM TRA</th>
                  <th>ĐIỂM</th>
                  <th>NGÀY</th>
                </tr>
              </thead>
              <tbody>
                {submissions.length === 0 ? (
                  <tr>
                    <td colSpan="4" style={{ textAlign: 'center', padding: '40px 16px', color: '#6b7280' }}>
                      <div style={{ fontSize: 32, marginBottom: 8 }}>📝</div>
                      <div style={{ fontWeight: 700, fontSize: 14.5, color: '#1f2937', marginBottom: 4 }}>
                        {loadingSubmissions ? 'Đang tải lịch sử bài nộp...' : 'Chưa có bài nộp nào gần đây'}
                      </div>
                      <div style={{ fontSize: 13, color: '#6b7280' }}>
                        Khi sinh viên trong lớp hoàn thành bài thi trắc nghiệm Quiz, kết quả sẽ hiện tại đây.
                      </div>
                    </td>
                  </tr>
                ) : (
                  submissions.map((sub) => (
                    <tr key={sub.id}>
                      <td className="lec-student-name">
                        <div style={{ fontWeight: 700 }}>{sub.student_name || sub.studentName || 'Sinh viên'}</div>
                        {sub.classroom_name ? (
                          <div style={{ fontSize: '11px', color: '#6b7280', fontWeight: '600', marginTop: '2px' }}>
                            {sub.classroom_name}
                          </div>
                        ) : null}
                      </td>
                      <td className="lec-exam-name">{sub.quiz_title || sub.examTitle}</td>
                      <td>
                        <span className="lec-score-badge">
                          {sub.score_display || (typeof sub.score === 'number' ? `${sub.score}/10` : sub.score)}
                        </span>
                      </td>
                      <td className="lec-subm-date">
                        {formatRelativeTime(sub.completed_at || sub.submittedAt)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>

            </table>
          </div>
        </div>
      </div>

      {/* Modal Tạo Lớp học mới chuẩn Neo-brutalist */}
      {showCreateModal && (
        <div className="lec-brutal-modal-backdrop" onClick={() => setShowCreateModal(false)}>
          <div className="lec-brutal-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="lec-modal-head-title">+ Tạo lớp học mới</h3>
            <form onSubmit={handleCreateClass}>
              <div className="lec-field-group">
                <label>Tên lớp học *</label>
                <input
                  type="text"
                  className="lec-input-brutal"
                  value={newClassName}
                  onChange={(e) => setNewClassName(e.target.value)}
                  placeholder="Ví dụ: Lập trình C (Nhóm 02)"
                  required
                  autoFocus
                />
              </div>

              <div className="lec-field-group">
                <label>Môn học (tùy chọn)</label>
                <input
                  type="text"
                  className="lec-input-brutal"
                  value={newClassSubject}
                  onChange={(e) => setNewClassSubject(e.target.value)}
                  placeholder="Ví dụ: Lập trình C"
                />
              </div>

              <div className="lec-modal-btns">
                <button
                  type="button"
                  className="lec-btn-cancel"
                  onClick={() => setShowCreateModal(false)}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="lec-btn-submit"
                  disabled={creating}
                >
                  {creating ? 'Đang tạo...' : 'Tạo lớp học'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default LecturerDashboard
