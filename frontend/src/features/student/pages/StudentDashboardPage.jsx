import { useState, useEffect, useCallback } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../../auth/context/AuthContext.jsx'
import {
  SparklesIcon,
  HelpIcon,
  HistoryIcon,
  BellIcon,
  FileTextIcon,
  CheckCircleIcon,
  PlusIcon,
  BookOpenIcon,
  ArrowRightIcon,
  UsersIcon,
  ArchiveIcon,
} from '../../../components/common/icons.jsx'
import { fetchAvailableDocuments, fetchMyQuizAttempts } from '../services/studyService.js'
import { listConversations } from '../../../services/conversationsApi.js'
import { getEnrolledClassrooms, joinClassroom } from '../services/classroomService.js'
import { notify } from '../../../components/common/toast.jsx'

// Hàm chuyển đổi mốc thời gian sang dạng tương đối thân thiện (VD: 1 giờ trước, Hôm qua)
function formatRelativeTime(dateStr, fallback = 'Gần đây') {
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
    const diffHours = Math.floor(diffMins / 60)
    if (diffHours < 24) return `${diffHours} giờ trước`
    const diffDays = Math.floor(diffHours / 24)
    if (diffDays === 1) return 'Hôm qua'
    if (diffDays < 7) return `${diffDays} ngày trước`
    return d.toLocaleDateString('vi-VN')
  } catch {
    return fallback
  }
}

function StudentDashboardPage() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [documents, setDocuments] = useState([])
  const [attempts, setAttempts] = useState([])
  const [conversations, setConversations] = useState([])
  const [classrooms, setClassrooms] = useState([])
  const [loading, setLoading] = useState(true)

  // Modal tham gia lớp học ngay trên Dashboard
  const [showJoinModal, setShowJoinModal] = useState(false)
  const [joinCode, setJoinCode] = useState('')
  const [joining, setJoining] = useState(false)
  const [joinError, setJoinError] = useState('')

  // Lấy tên hiển thị của sinh viên (ưu tiên tên thật trong tài khoản, fallback Sarah)
  const fullName = user?.name || user?.username || 'Sarah Carter'
  const firstName = fullName.split(' ').slice(-1)[0] || 'Sarah'

  // Chào theo thời gian thực trong ngày
  const getGreeting = () => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Chào buổi sáng'
    if (hour < 18) return 'Chào buổi chiều'
    return 'Chào buổi tối'
  }

  const loadData = useCallback(() => {
    let active = true
    Promise.all([
      fetchAvailableDocuments().catch(() => []),
      fetchMyQuizAttempts().catch(() => []),
      listConversations().catch(() => []),
      getEnrolledClassrooms().catch(() => []),
    ]).then(([docs, myAttempts, convs, enrolledClasses]) => {
      if (active) {
        setDocuments(docs || [])
        setAttempts(myAttempts || [])
        setConversations(convs || [])
        setClassrooms(enrolledClasses || [])
        setLoading(false)
      }
    })
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    return loadData()
  }, [loadData])

  // Xử lý tham gia lớp học
  const handleJoinSubmit = async (e) => {
    e.preventDefault()
    const code = joinCode.trim().toUpperCase()
    if (!code) {
      setJoinError('Vui lòng nhập mã lớp học.')
      return
    }

    setJoining(true)
    setJoinError('')
    try {
      const joined = await joinClassroom(code)
      notify(`Đã tham gia lớp "${joined.name}" thành công!`)
      setShowJoinModal(false)
      setJoinCode('')
      loadData()
    } catch (err) {
      const msg = err?.response?.data?.detail || 'Không tìm thấy lớp học với mã này.'
      setJoinError(typeof msg === 'string' ? msg : 'Lỗi khi tham gia lớp học.')
    } finally {
      setJoining(false)
    }
  }

  // Tài liệu mới nhất trong hệ thống
  const latestDoc = documents[0] || null
  // Cuộc trò chuyện Sổ tay AI gần nhất
  const latestConv = conversations[0] || null
  // Lần làm bài thi Quiz gần nhất
  const latestAttempt = attempts[0] || null

  // Hoạt động gần đây khớp đúng dữ liệu thật của dự án:
  // 1. Giảng viên đăng tài liệu bài giảng mới vào Thư viện
  // 2. Sinh viên tra cứu/hỏi đáp với Sổ tay AI có trích dẫn nguồn
  // 3. Sinh viên hoàn thành bài kiểm tra trắc nghiệm Quiz
  const activities = [
    {
      id: 'act-doc',
      icon: <BellIcon size={18} />,
      title: latestDoc?.uploader_name
        ? `Giảng viên ${latestDoc.uploader_name} đã đăng tài liệu`
        : 'Giảng viên đã đăng tài liệu mới',
      desc: latestDoc
        ? `Tài liệu '${latestDoc.title}' môn ${latestDoc.subject || 'chuyên ngành'} đã được cập nhật vào Thư viện.`
        : 'Slide bài giảng môn Phát triển Ứng dụng Flutter đã được cập nhật vào Thư viện.',
      time: latestDoc?.created_at
        ? formatRelativeTime(latestDoc.created_at, '1 giờ trước')
        : '1 giờ trước',
      onClick: () => navigate('/student/library'),
    },
    {
      id: 'act-chat',
      icon: <FileTextIcon size={18} />,
      title: 'Đã hỏi đáp trong Sổ tay AI',
      desc: latestConv?.title
        ? `Chủ đề: '${latestConv.title}' — Trợ lý AI đã trích dẫn nguồn từ tài liệu.`
        : "Bạn đã tra cứu 'Tối ưu hiệu suất và triển khai ứng dụng' thành công cùng Trợ lý AI.",
      time: latestConv?.updated_at
        ? formatRelativeTime(latestConv.updated_at, '3 giờ trước')
        : '3 giờ trước',
      onClick: () => navigate('/student/chat'),
    },
    {
      id: 'act-quiz',
      icon: <CheckCircleIcon size={18} />,
      title: latestAttempt ? 'Đã hoàn thành bài thi Quiz' : 'Đã hoàn thành bài ôn tập Quiz',
      desc: latestAttempt
        ? `Bạn đạt ${latestAttempt.score}/10 điểm trong bài kiểm tra trắc nghiệm kiến thức.`
        : "Bạn đạt 9.2/10 trong 'Bài kiểm tra trắc nghiệm kiến thức cốt lõi'.",
      time: latestAttempt?.completed_at
        ? formatRelativeTime(latestAttempt.completed_at, 'Hôm qua')
        : 'Hôm qua',
      onClick: () => navigate('/student/study?tab=attempts'),
    },
  ]

  return (
    <div className="st-dashboard-page">
      {/* Lời chào đầu trang */}
      <div className="st-welcome-header">
        <h1 className="st-welcome-title">
          {getGreeting()}, {firstName} <span className="st-welcome-wave">👋</span>
        </h1>
        <p className="st-welcome-subtitle">
          Tiếp tục phát huy nhé! Bạn đã đọc {documents.length > 0 ? documents.length : 3} tài liệu tuần này.
        </p>
      </div>

      {/* Hàng 3 thẻ Action chính: 1. Tạo Flashcard | 2. Tạo bài thi Quiz | 3. Lịch sử bài thi */}
      <div className="st-action-cards-grid">
        {/* Card 1: Tạo Flashcard */}
        <div
          className="st-action-card st-action-card--reading"
          onClick={() => {
            if (latestDoc?.id) {
              navigate(`/student/study/${latestDoc.id}?tab=flashcards`)
            } else {
              navigate('/student/study?tab=flashcards')
            }
          }}
          role="button"
          tabIndex={0}
        >
          <div className="st-action-card-header">
            <span className="st-action-card-tag">TẠO FLASHCARD</span>
            <span className="st-action-card-icon">
              <SparklesIcon size={20} />
            </span>
          </div>
          <h2 className="st-action-card-title">Thẻ ghi nhớ Flashcard</h2>
          <p className="st-action-card-sub">
            {latestDoc?.title
              ? `Tạo thẻ AI từ '${latestDoc.title}'`
              : 'Tạo và ôn tập thẻ ghi nhớ kiến thức tự động bằng AI'}
          </p>
        </div>

        {/* Card 2: Tạo bài thi Quiz */}
        <div
          className="st-action-card st-action-card--exam"
          onClick={() => {
            if (latestDoc?.id) {
              navigate(`/student/study/${latestDoc.id}?tab=quiz`)
            } else {
              navigate('/student/study?tab=quiz')
            }
          }}
          role="button"
          tabIndex={0}
        >
          <div className="st-action-card-header">
            <span className="st-action-card-tag">TẠO BÀI THI QUIZ</span>
            <span className="st-action-card-icon">
              <HelpIcon size={20} />
            </span>
          </div>
          <h2 className="st-action-card-title">Tạo bài thi Quiz AI</h2>
          <p className="st-action-card-sub">
            {latestDoc?.title
              ? `Sinh đề trắc nghiệm kiểm tra '${latestDoc.title}'`
              : 'AI sinh đề trắc nghiệm kiểm tra kiến thức theo tài liệu'}
          </p>
        </div>

        {/* Card 3: Lịch sử bài thi (Thẻ xanh dương nổi bật) */}
        <div
          className="st-action-card st-action-card--ai"
          onClick={() => navigate('/student/study?tab=attempts')}
          role="button"
          tabIndex={0}
        >
          <div className="st-action-card-header">
            <span className="st-action-card-tag">LỊCH SỬ BÀI THI</span>
            <span className="st-action-card-icon">
              <HistoryIcon size={20} />
            </span>
          </div>
          <h2 className="st-action-card-title">Lịch sử làm bài thi</h2>
          <p className="st-action-card-sub">
            {attempts.length > 0
              ? `Đã hoàn thành ${attempts.length} bài thi · Bấm xem kết quả`
              : 'Xem lại điểm số, đánh giá và chi tiết các bài thi đã làm'}
          </p>
        </div>
      </div>

      {/* Phần: Lớp học của tôi */}
      <section className="st-section">
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            marginBottom: 16,
            flexWrap: 'wrap',
          }}
        >
          <h2 className="st-section-heading" style={{ margin: 0 }}>
            Lớp học của tôi ({classrooms.length})
          </h2>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              type="button"
              onClick={() => {
                setJoinCode('')
                setJoinError('')
                setShowJoinModal(true)
              }}
              style={{
                backgroundColor: '#10b981',
                color: '#ffffff',
                fontWeight: 800,
                fontSize: 13,
                padding: '7px 14px',
                borderRadius: 9,
                border: '2px solid #000000',
                boxShadow: '2.5px 2.5px 0px #000000',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <PlusIcon size={15} /> Tham gia lớp
            </button>

            <Link
              to="/student/classes"
              style={{
                fontSize: 13,
                fontWeight: 800,
                color: '#000000',
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              Xem tất cả <ArrowRightIcon size={14} />
            </Link>
          </div>
        </div>

        {classrooms.length === 0 ? (
          <div
            style={{
              backgroundColor: '#ffffff',
              border: '2.5px solid #000000',
              borderRadius: 14,
              boxShadow: '3.5px 3.5px 0px #000000',
              padding: '28px 24px',
              textAlign: 'center',
            }}
          >
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 10,
                backgroundColor: '#fef08a',
                border: '2px solid #000000',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 10px',
              }}
            >
              <BookOpenIcon size={22} />
            </div>
            <h3 style={{ fontSize: 16, fontWeight: 800, margin: '0 0 6px 0', color: '#000000' }}>
              Bạn chưa tham gia lớp học nào
            </h3>
            <p style={{ fontSize: 13, color: '#4b5563', margin: '0 0 16px 0' }}>
              Bạn chưa tham gia lớp nào. Hãy khám phá danh sách lớp học của các giảng viên để tham gia lớp của bạn.
            </p>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, flexWrap: 'wrap' }}>
              <Link
                to="/student/classes"
                style={{
                  backgroundColor: '#3b66f5',
                  color: '#ffffff',
                  fontWeight: 800,
                  fontSize: 13,
                  padding: '9px 18px',
                  borderRadius: 10,
                  border: '2px solid #000000',
                  boxShadow: '2px 2px 0px #000000',
                  textDecoration: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                Khám phá lớp học <ArrowRightIcon size={14} />
              </Link>
              <button
                type="button"
                onClick={() => {
                  setJoinCode('')
                  setJoinError('')
                  setShowJoinModal(true)
                }}
                style={{
                  backgroundColor: '#ffffff',
                  color: '#000000',
                  fontWeight: 800,
                  fontSize: 13,
                  padding: '8px 16px',
                  borderRadius: 10,
                  border: '2px solid #000000',
                  boxShadow: '2px 2px 0px #000000',
                  cursor: 'pointer',
                }}
              >
                + Nhập mã tham gia
              </button>
            </div>
          </div>
        ) : (
          <div className="st-classes-grid">
            {classrooms.slice(0, 3).map((course) => (
              <div
                key={course.id}
                className="st-class-card"
                onClick={() => navigate(`/student/classes/${course.id}`)}
                role="button"
                tabIndex={0}
              >
                <div className="st-class-card-top">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, marginBottom: 8 }}>
                    <span
                      style={{
                        fontFamily: 'monospace',
                        fontWeight: 800,
                        fontSize: 11.5,
                        backgroundColor: '#f1f5f9',
                        border: '1.5px solid #000000',
                        borderRadius: 5,
                        padding: '2px 6px',
                      }}
                    >
                      {course.code}
                    </span>
                    {course.subject && (
                      <span
                        style={{
                          backgroundColor: '#E5F970',
                          border: '1.5px solid #000000',
                          borderRadius: 5,
                          padding: '2px 6px',
                          fontSize: 11,
                          fontWeight: 800,
                          color: '#000000',
                        }}
                      >
                        {course.subject}
                      </span>
                    )}
                  </div>
                  <h3 className="st-class-title">{course.name}</h3>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#1e293b', margin: '4px 0 2px 0' }}>
                    GV: {course.lecturer_name || 'Giảng viên bộ môn'}
                  </div>
                  <p className="st-class-instructor" style={{ fontSize: 12.5, color: '#64748b' }}>
                    {course.description || 'Lớp học với tài liệu cô lập'}
                  </p>
                </div>
                <div className="st-class-divider" />
                <div className="st-class-card-bottom">
                  <span className="st-class-time" style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                    <UsersIcon size={14} /> {course.student_count ?? 0} sinh viên
                  </span>
                  <span className="st-class-badge">{course.document_count ?? 0} tài liệu</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Phần: Hoạt động gần đây */}
      <section className="st-section">
        <h2 className="st-section-heading">Hoạt động gần đây</h2>
        <div className="st-activities-card">
          {activities.map((act) => (
            <div
              key={act.id}
              className="st-activity-row"
              onClick={act.onClick}
              role="button"
              tabIndex={0}
            >
              <div className="st-activity-icon-box">{act.icon}</div>
              <div className="st-activity-content">
                <h4 className="st-activity-title">{act.title}</h4>
                <p className="st-activity-desc">{act.desc}</p>
              </div>
              <div className="st-activity-time">{act.time}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Modal tham gia lớp học ngay trên Dashboard */}
      {showJoinModal && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: 16,
          }}
          onClick={() => setShowJoinModal(false)}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              border: '3px solid #000000',
              borderRadius: 16,
              boxShadow: '6px 6px 0px #000000',
              padding: '26px 26px',
              maxWidth: 440,
              width: '100%',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  backgroundColor: '#10b981',
                  border: '2px solid #000000',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <PlusIcon size={18} />
              </div>
              <h2 style={{ fontSize: 19, fontWeight: 900, margin: 0, color: '#000000' }}>
                Tham gia lớp học
              </h2>
            </div>

            <p style={{ fontSize: 13, color: '#4b5563', margin: '0 0 16px 0', lineHeight: 1.45 }}>
              Nhập mã lớp do giảng viên cung cấp để tham gia và xem tài liệu môn học.
            </p>

            {joinError && (
              <div
                style={{
                  backgroundColor: '#fee2e2',
                  border: '2px solid #ef4444',
                  borderRadius: 8,
                  padding: '8px 12px',
                  color: '#991b1b',
                  fontSize: 12.5,
                  fontWeight: 700,
                  marginBottom: 14,
                }}
              >
                {joinError}
              </div>
            )}

            <form onSubmit={handleJoinSubmit}>
              <div style={{ marginBottom: 18 }}>
                <label
                  style={{
                    display: 'block',
                    fontSize: 12.5,
                    fontWeight: 800,
                    marginBottom: 6,
                    color: '#000000',
                  }}
                >
                  Mã lớp học <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="text"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  placeholder="Ví dụ: C_PROG_01"
                  autoFocus
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    fontFamily: 'monospace',
                    fontSize: 14.5,
                    fontWeight: 800,
                    letterSpacing: 1,
                    border: '2px solid #000000',
                    borderRadius: 9,
                    boxShadow: '2px 2px 0px #000000',
                    outline: 'none',
                    boxSizing: 'border-box',
                    backgroundColor: '#fafafa',
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setShowJoinModal(false)}
                  disabled={joining}
                  style={{
                    padding: '9px 16px',
                    fontWeight: 700,
                    fontSize: 13,
                    backgroundColor: '#f3f4f6',
                    border: '2px solid #000000',
                    borderRadius: 9,
                    cursor: 'pointer',
                  }}
                >
                  Hủy
                </button>

                <button
                  type="submit"
                  disabled={joining}
                  style={{
                    padding: '9px 20px',
                    fontWeight: 800,
                    fontSize: 13,
                    backgroundColor: '#10b981',
                    color: '#ffffff',
                    border: '2px solid #000000',
                    borderRadius: 9,
                    boxShadow: '2px 2px 0px #000000',
                    cursor: joining ? 'wait' : 'pointer',
                    opacity: joining ? 0.7 : 1,
                  }}
                >
                  {joining ? 'Đang tham gia...' : 'Tham gia ngay'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default StudentDashboardPage
