import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useSearchParams, Link } from 'react-router-dom'
import { getStudentExams, formatExamDate } from '../services/examService'
import { fetchQuiz, submitQuiz } from '../services/studyService'
import { getEnrolledClassrooms } from '../services/classroomService'
import {
  CalendarIcon,
  ClockIcon,
  SearchIcon,
  CheckCircleIcon,
  BookOpenIcon,
} from '../../../components/common/icons.jsx'
import IconSelect from '../../../components/common/IconSelect.jsx'
import { subjectAll } from '../../admin/services/filterMeta'
import { notify } from '../../../components/common/toast.jsx'

function getExamStatus(iso) {
  if (!iso) return { label: 'Chưa xếp ngày', color: '#6b7280', bg: '#f3f4f6' }
  const examTime = new Date(iso).getTime()
  if (Number.isNaN(examTime)) return { label: 'Chưa xếp ngày', color: '#6b7280', bg: '#f3f4f6' }

  const now = Date.now()
  const diffDays = Math.ceil((examTime - now) / (1000 * 60 * 60 * 24))

  if (diffDays < 0) {
    return { label: 'Đã kết thúc', color: '#6b7280', bg: '#f3f4f6' }
  }
  if (diffDays === 0) {
    return { label: 'Hôm nay', color: '#dc2626', bg: '#fee2e2' }
  }
  if (diffDays === 1) {
    return { label: 'Ngày mai', color: '#ea580c', bg: '#ffedd5' }
  }
  if (diffDays <= 7) {
    return { label: `Còn ${diffDays} ngày`, color: '#2563eb', bg: '#dbeafe' }
  }
  return { label: `Còn ${diffDays} ngày`, color: '#059669', bg: '#d1fae5' }
}

function getScoreBadge(score) {
  if (score >= 8.5) return { text: 'Xuất sắc', color: '#15803d', bg: '#dcfce7', desc: 'Bạn đã nắm rất vững toàn bộ kiến thức bài thi!' }
  if (score >= 7.0) return { text: 'Khá Giỏi', color: '#1d4ed8', bg: '#dbeafe', desc: 'Kết quả bài thi tốt, hãy tiếp tục phát huy!' }
  if (score >= 5.0) return { text: 'Đạt yêu cầu', color: '#b45309', bg: '#fef3c7', desc: 'Bạn đã vượt qua bài thi, nên ôn lại các câu trả lời sai.' }
  return { text: 'Chưa đạt', color: '#b91c1c', bg: '#fee2e2', desc: 'Hãy đọc kỹ phần giải thích chi tiết bên dưới để củng cố kiến thức.' }
}

// Định dạng thời gian đếm ngược theo đúng phút:giây của bài thi (Ví dụ 90 phút -> 90:00 -> 89:59)
function formatTimer(seconds) {
  if (seconds === null || seconds === undefined || Number.isNaN(Number(seconds))) return '00:00'
  const sec = Math.max(0, Math.floor(seconds))
  const m = Math.floor(sec / 60)
  const s = sec % 60
  const pad = (n) => String(n).padStart(2, '0')
  return `${pad(m)}:${pad(s)}`
}

function StudentExamsPage() {
  const [searchParams] = useSearchParams()
  const examIdParam = searchParams.get('examId')
  const [enrolledClassrooms, setEnrolledClassrooms] = useState([])
  const [exams, setExams] = useState([])
  const [loading, setLoading] = useState(true)
  const [subject, setSubject] = useState('all')
  const [search, setSearch] = useState('')

  // Modal / Full-screen làm bài thi trắc nghiệm
  const [activeExam, setActiveExam] = useState(null)
  const [quizData, setQuizData] = useState(null)
  const [quizLoading, setQuizLoading] = useState(false)
  const [userAnswers, setUserAnswers] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [submissionResult, setSubmissionResult] = useState(null)
  const [quizError, setQuizError] = useState('')

  // Đếm ngược thời gian và tự động nộp bài
  const [timeLeft, setTimeLeft] = useState(null)
  const [isTimeUp, setIsTimeUp] = useState(false)
  const userAnswersRef = useRef({})
  const submittingRef = useRef(false)
  const autoSubmittedRef = useRef(false)

  // Đồng bộ ref lưu câu trả lời mới nhất
  useEffect(() => {
    userAnswersRef.current = userAnswers
  }, [userAnswers])

  useEffect(() => {
    getEnrolledClassrooms()
      .then((data) => setEnrolledClassrooms(data || []))
      .catch(() => setEnrolledClassrooms([]))
  }, [])

  useEffect(() => {
    setLoading(true)
    getStudentExams(subject)
      .then(setExams)
      .catch(() => setExams([]))
      .finally(() => setLoading(false))
  }, [subject])

  // Lọc danh sách môn thi chỉ hiển thị các môn thuộc lớp học sinh viên đã tham gia
  const studentSubjectOptions = useMemo(() => {
    const subs = new Set()
    enrolledClassrooms.forEach((c) => {
      if (c.subject && c.subject.trim()) {
        subs.add(c.subject.trim())
      }
    })
    exams.forEach((x) => {
      if (x.subject && x.subject.trim()) {
        subs.add(x.subject.trim())
      }
    })
    return Array.from(subs)
      .sort((a, b) => a.localeCompare(b, 'vi'))
      .map((s) => ({
        value: s,
        label: s,
        icon: BookOpenIcon,
        color: '#2563eb',
      }))
  }, [enrolledClassrooms, exams])

  // Tự động mở bài thi nếu truy cập từ đường link trực tiếp trong lớp học (?examId=...)
  useEffect(() => {
    if (examIdParam && exams.length > 0 && !activeExam && !quizLoading) {
      const target = exams.find((x) => x.id === examIdParam)
      if (target && target.quiz_id) {
        startExam(target)
      }
    }
  }, [examIdParam, exams])

  // Tự động nộp bài khi hết giờ
  const handleAutoSubmit = useCallback(async () => {
    if (autoSubmittedRef.current || submittingRef.current || submissionResult) return
    autoSubmittedRef.current = true
    submittingRef.current = true
    setIsTimeUp(true)
    setSubmitting(true)
    setQuizError('')
    notify('⏰ Đã hết thời gian làm bài! Hệ thống đang tự động nộp bài thi của bạn...')

    try {
      const answersToSend = userAnswersRef.current || {}
      const result = await submitQuiz(quizData.id, answersToSend)
      setSubmissionResult(result)
    } catch (err) {
      const detail = err?.response?.data?.detail
      setQuizError(typeof detail === 'string' ? detail : 'Tự động nộp bài thất bại. Vui lòng thử lại.')
    } finally {
      setSubmitting(false)
      submittingRef.current = false
    }
  }, [quizData, submissionResult])

  // Đồng hồ đếm ngược từng giây
  useEffect(() => {
    if (!activeExam || !quizData || submissionResult) return

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev === null) return null
        if (prev <= 1) {
          clearInterval(timer)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [activeExam, quizData, submissionResult])

  // Kích hoạt tự động nộp khi hết giờ
  useEffect(() => {
    if (timeLeft !== null && timeLeft <= 0 && activeExam && quizData && !submissionResult) {
      if (!autoSubmittedRef.current && !submittingRef.current) {
        handleAutoSubmit()
      }
    }
  }, [timeLeft, activeExam, quizData, submissionResult, handleAutoSubmit])

  // Khi mở thi của 1 kỳ thi (chuyển sang toàn màn hình)
  const startExam = async (item) => {
    if (!item.quiz_id) return
    setActiveExam(item)
    setUserAnswers({})
    userAnswersRef.current = {}
    setSubmissionResult(null)
    setQuizError('')
    setIsTimeUp(false)
    autoSubmittedRef.current = false
    submittingRef.current = false

    const durationMins = Number(item.duration_minutes) > 0 ? Number(item.duration_minutes) : 90
    setTimeLeft(durationMins * 60)

    // Khóa cuộn trang nền và mở toàn màn hình
    try {
      document.body.style.overflow = 'hidden'
      if (document.documentElement.requestFullscreen && !document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {})
      }
    } catch (_) {}

    setQuizLoading(true)
    try {
      // includeAnswers = false: bảo mật đề thi, không trả đáp án trước khi nộp
      const data = await fetchQuiz(item.quiz_id, false)
      setQuizData(data)
    } catch (err) {
      const detail = err?.response?.data?.detail
      setQuizError(typeof detail === 'string' ? detail : 'Không thể tải đề thi. Vui lòng thử lại.')
    } finally {
      setQuizLoading(false)
    }
  }

  // Đóng bài thi và thoát toàn màn hình
  const closeExamModal = () => {
    if (!submissionResult && quizData && !isTimeUp) {
      const confirmExit = window.confirm(
        'Bạn có chắc chắn muốn rời khỏi bài thi? Bài thi chưa nộp sẽ không được lưu điểm!'
      )
      if (!confirmExit) return
    }

    try {
      document.body.style.overflow = ''
      if (document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen().catch(() => {})
      }
    } catch (_) {}

    setActiveExam(null)
    setQuizData(null)
    setUserAnswers({})
    userAnswersRef.current = {}
    setSubmissionResult(null)
    setQuizError('')
    setTimeLeft(null)
    setIsTimeUp(false)
    autoSubmittedRef.current = false
    submittingRef.current = false
  }

  const handleSelectOption = (questionId, option) => {
    if (submissionResult || isTimeUp || submitting) return // Đã nộp hoặc hết giờ thì không cho chọn
    setUserAnswers((prev) => {
      const next = { ...prev, [questionId]: option }
      userAnswersRef.current = next
      return next
    })
  }

  const handleSubmitExam = async () => {
    if (!quizData || !quizData.questions || submitting || submissionResult || isTimeUp) return
    const total = quizData.questions.length
    const answeredCount = Object.keys(userAnswers).length

    if (answeredCount < total) {
      const confirmSubmit = window.confirm(
        `Bạn mới trả lời ${answeredCount}/${total} câu hỏi. Bạn có chắc chắn muốn nộp bài thi ngay bây giờ để hệ thống chấm điểm?`
      )
      if (!confirmSubmit) return
    } else {
      const confirmSubmit = window.confirm(
        `Bạn đã trả lời ${answeredCount}/${total} câu hỏi. Bạn có chắc chắn muốn nộp bài thi?`
      )
      if (!confirmSubmit) return
    }

    submittingRef.current = true
    setSubmitting(true)
    setQuizError('')
    try {
      const result = await submitQuiz(quizData.id, userAnswers)
      setSubmissionResult(result)
    } catch (err) {
      const detail = err?.response?.data?.detail
      setQuizError(typeof detail === 'string' ? detail : 'Chấm điểm thất bại. Vui lòng thử lại.')
    } finally {
      setSubmitting(false)
      submittingRef.current = false
    }
  }

  // Cuộn mượt đến câu hỏi tương ứng trong bài thi
  const scrollToQuestion = (idx) => {
    const el = document.getElementById(`exam-question-${idx}`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }

  const filtered = useMemo(() => {
    let list = exams || []
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter(
        (x) =>
          (x.title || '').toLowerCase().includes(q) ||
          (x.subject || '').toLowerCase().includes(q) ||
          (x.quiz_title || '').toLowerCase().includes(q)
      )
    }
    return list
  }, [exams, search])

  return (
    <div style={{ padding: '4px 0 32px' }}>
      {/* Page Header */}
      <div className="dmrs-page-head" style={{ marginBottom: 20 }}>
        <div>
          <h1 className="dmrs-page-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <CalendarIcon size={26} /> Lịch thi trắc nghiệm của tôi
          </h1>
          <p className="dmrs-page-sub">
            Tra cứu thời gian và vào làm bài thi trắc nghiệm trực tuyến. Điểm thi được hệ thống tự động chấm và lưu kết quả ngay lập tức.
          </p>
        </div>
      </div>

      {/* Toolbar filter */}
      <div
        className="dmrs-card dmrs-toolbar"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          flexWrap: 'wrap',
          marginBottom: 20,
        }}
      >
        <div style={{ flex: '1 1 240px', minWidth: 200 }}>
          <IconSelect
            value={subject}
            onChange={setSubject}
            options={studentSubjectOptions}
            allOption={subjectAll}
            placeholder="Tất cả môn học"
          />
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            backgroundColor: 'var(--color-bg-card, #ffffff)',
            border: '2px solid #000000',
            borderRadius: 8,
            padding: '6px 12px',
            flex: '2 1 300px',
          }}
        >
          <SearchIcon size={16} />
          <input
            type="text"
            placeholder="Tìm theo môn học, tiêu đề kỳ thi hoặc tên bộ đề..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              border: 'none',
              outline: 'none',
              background: 'transparent',
              width: '100%',
              fontSize: 13.5,
              fontWeight: 500,
            }}
          />
        </div>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700 }}>
          <CalendarIcon size={16} />
          <span>{filtered.length} lịch thi</span>
        </div>
      </div>

      {/* Main Content */}
      {!loading && enrolledClassrooms.length === 0 ? (
        <div
          className="dmrs-card"
          style={{
            padding: '48px 24px',
            textAlign: 'center',
            backgroundColor: '#ffffff',
            border: '2px dashed #cbd5e1',
            borderRadius: 14,
            maxWidth: 620,
            margin: '20px auto 40px',
            boxShadow: '3px 3px 0px #000000',
          }}
        >
          <div style={{ fontSize: 44, marginBottom: 12 }}>🏫</div>
          <h3 style={{ margin: '0 0 10px 0', fontSize: 19, fontWeight: 900, color: '#0f172a' }}>
            Bạn chưa tham gia lớp học nào
          </h3>
          <p style={{ margin: '0 0 22px 0', fontSize: 13.5, color: '#64748b', lineHeight: 1.6 }}>
            Lịch thi và bài kiểm tra trắc nghiệm được bảo mật theo từng lớp học. Bạn cần tham gia lớp học của giảng viên để xem lịch thi và làm bài trắc nghiệm của lớp.
          </p>
          <Link
            to="/student/classes"
            className="dmrs-btn dmrs-btn--primary"
            style={{
              textDecoration: 'none',
              display: 'inline-flex',
              padding: '11px 24px',
              fontWeight: 800,
              fontSize: 14,
            }}
          >
            Khám phá & Tham gia lớp học →
          </Link>
        </div>
      ) : loading ? (
        <div className="dmrs-card" style={{ padding: 48, textAlign: 'center', color: '#6b7280' }}>
          Đang tải danh sách lịch thi...
        </div>
      ) : filtered.length === 0 ? (
        <div
          className="dmrs-card"
          style={{
            padding: '48px 24px',
            textAlign: 'center',
            backgroundColor: '#fafafa',
            border: '2px dashed #d1d5db',
            borderRadius: 12,
          }}
        >
          <CalendarIcon size={40} />
          <h3 style={{ margin: '14px 0 6px', fontSize: 16, fontWeight: 800 }}>Chưa có lịch thi nào</h3>
          <p style={{ margin: 0, fontSize: 13, color: '#6b7280' }}>
            Hiện tại bạn chưa có lịch thi nào theo bộ lọc đang chọn.
          </p>
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: 18,
          }}
        >
          {filtered.map((item) => {
            const status = getExamStatus(item.exam_date)

            return (
              <div
                key={item.id}
                className="dmrs-card"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 800,
                        backgroundColor: '#eff6ff',
                        color: '#1d4ed8',
                        border: '1.5px solid #000000',
                        borderRadius: 6,
                        padding: '3px 8px',
                      }}
                    >
                      {item.subject}
                    </span>
                    {item.classroom_name || item.classroom_code ? (
                      <span
                        style={{
                          fontSize: 11.5,
                          fontWeight: 700,
                          backgroundColor: '#f8fafc',
                          color: '#475569',
                          borderRadius: 6,
                          padding: '2px 7px',
                          border: '1px solid #cbd5e1',
                        }}
                      >
                        🏫 {item.classroom_name || item.classroom_code}
                      </span>
                    ) : null}
                  </div>

                  <span
                    style={{
                      fontSize: 11.5,
                      fontWeight: 800,
                      backgroundColor: status.bg,
                      color: status.color,
                      border: '1.5px solid #000000',
                      borderRadius: 6,
                      padding: '3px 8px',
                    }}
                  >
                    {status.label}
                  </span>
                </div>

                <h3
                  style={{
                    fontSize: 16.5,
                    fontWeight: 800,
                    margin: 0,
                    color: 'var(--color-text-main, #000000)',
                    lineHeight: 1.35,
                  }}
                >
                  {item.title}
                </h3>

                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                    fontSize: 13,
                    color: 'var(--color-text-muted, #4b5563)',
                    backgroundColor: '#fafafa',
                    border: '1.5px solid #000000',
                    borderRadius: 9,
                    padding: '10px 14px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <CalendarIcon size={15} />
                    <span>
                      Thời gian: <strong>{formatExamDate(item.exam_date)}</strong>
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <ClockIcon size={15} />
                    <span>
                      Thời lượng: <strong>{item.duration_minutes ? `${item.duration_minutes} phút` : 'Chưa quy định'}</strong>
                    </span>
                  </div>
                </div>

                {/* Khối Đề thi trắc nghiệm */}
                <div
                  style={{
                    backgroundColor: item.quiz_id ? '#f0fdf4' : '#f8fafc',
                    border: item.quiz_id ? '2px solid #16a34a' : '1.5px dashed #cbd5e1',
                    borderRadius: 10,
                    padding: '12px 14px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                    marginTop: 'auto',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 16 }}>⚡</span>
                      <strong style={{ fontSize: 13, color: item.quiz_id ? '#15803d' : '#64748b' }}>
                        {item.quiz_id ? item.quiz_title || 'Đề thi trắc nghiệm' : 'Chưa gắn đề thi'}
                      </strong>
                    </div>

                    {item.quiz_question_count ? (
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 800,
                          backgroundColor: '#dcfce7',
                          color: '#166534',
                          border: '1px solid #16a34a',
                          padding: '1px 6px',
                          borderRadius: 4,
                        }}
                      >
                        {item.quiz_question_count} câu
                      </span>
                    ) : null}
                  </div>

                  <div style={{ fontSize: 12, color: '#64748b' }}>
                    {item.quiz_id
                      ? 'Đề thi trắc nghiệm trực tuyến · Tự động chấm điểm'
                      : 'Giảng viên đang chuẩn bị bộ đề thi trắc nghiệm...'}
                  </div>

                  {item.quiz_id ? (
                    <button
                      type="button"
                      className="dmrs-btn dmrs-btn--primary"
                      style={{
                        width: '100%',
                        justifyContent: 'center',
                        padding: '8px 14px',
                        fontSize: 13,
                        fontWeight: 800,
                        backgroundColor: '#4f46e5',
                        borderColor: '#000000',
                        boxShadow: '3px 3px 0px #000000',
                      }}
                      onClick={() => startExam(item)}
                    >
                      Vào làm bài thi trắc nghiệm
                    </button>
                  ) : null}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* GIAO DIỆN LÀM BÀI THI TOÀN MÀN HÌNH (FULL-SCREEN EXAM MODE QUA REACT PORTAL) */}
      {activeExam &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              width: '100vw',
              height: '100vh',
              backgroundColor: '#f8fafc',
              zIndex: 2147483647,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            {/* HEADER TOÀN MÀN HÌNH: Đã bỏ đồng hồ ở giữa theo yêu cầu, giữ giao diện thoáng và tinh gọn */}
            <header
              style={{
                height: 66,
                minHeight: 66,
                backgroundColor: '#ffffff',
                borderBottom: '2.5px solid #000000',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0 28px',
                zIndex: 100,
                gap: 16,
                boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
              }}
            >
              {/* Cụm trái: Thông tin bài thi */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 800,
                    backgroundColor: '#e0e7ff',
                    color: '#3730a3',
                    padding: '4px 10px',
                    borderRadius: 6,
                    border: '1.5px solid #000000',
                    flexShrink: 0,
                  }}
                >
                  {activeExam.subject}
                </span>
                <div style={{ minWidth: 0 }}>
                  <h2
                    style={{
                      fontSize: 17,
                      fontWeight: 900,
                      margin: 0,
                      color: '#0f172a',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      maxWidth: 420,
                    }}
                    title={activeExam.title}
                  >
                    ⚡ {activeExam.title}
                  </h2>
                  <div style={{ fontSize: 12, color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    Thời lượng: <strong>{activeExam.duration_minutes || 90} phút</strong> · Đề thi: {activeExam.quiz_title || 'Trắc nghiệm online'}
                  </div>
                </div>
              </div>

              {/* Cụm phải: Tiến độ làm bài & Nút nộp bài / Thoát */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                {!submissionResult && quizData && quizData.questions && (
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#334155' }}>
                    Đã làm:{' '}
                    <strong style={{ color: '#2563eb', fontSize: 15 }}>
                      {Object.keys(userAnswers).length} / {quizData.questions.length}
                    </strong>
                  </div>
                )}

                {!submissionResult ? (
                  <button
                    type="button"
                    onClick={handleSubmitExam}
                    disabled={submitting || isTimeUp || quizLoading}
                    style={{
                      backgroundColor: '#2563eb',
                      color: '#ffffff',
                      border: '2px solid #000000',
                      borderRadius: 8,
                      padding: '8px 20px',
                      fontSize: 13.5,
                      fontWeight: 800,
                      cursor: submitting || isTimeUp || quizLoading ? 'not-allowed' : 'pointer',
                      boxShadow: '2px 2px 0px #000000',
                      opacity: submitting || isTimeUp || quizLoading ? 0.6 : 1,
                    }}
                  >
                    {submitting ? 'Đang nộp...' : 'Nộp bài thi'}
                  </button>
                ) : (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '6px 14px',
                      borderRadius: 20,
                      backgroundColor: '#dcfce7',
                      border: '1.5px solid #16a34a',
                      color: '#15803d',
                      fontWeight: 800,
                      fontSize: 12.5,
                    }}
                  >
                    <CheckCircleIcon size={16} />
                    <span>ĐÃ NỘP BÀI THI</span>
                  </div>
                )}

                <button
                  type="button"
                  onClick={closeExamModal}
                  style={{
                    backgroundColor: '#f3f4f6',
                    border: '2px solid #000000',
                    borderRadius: 8,
                    padding: '7px 16px',
                    fontSize: 13.5,
                    fontWeight: 800,
                    cursor: 'pointer',
                  }}
                >
                  {submissionResult ? 'Đóng & Thoát' : 'Thoát ✕'}
                </button>
              </div>
            </header>

            {/* NỘI DUNG TOÀN MÀN HÌNH */}
            <div
              style={{
                flex: 1,
                display: 'flex',
                overflow: 'hidden',
                position: 'relative',
              }}
            >
              {/* Trạng thái Đang tải */}
              {quizLoading && (
                <div
                  style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 12,
                    color: '#475569',
                  }}
                >
                  <div style={{ fontSize: 36 }}>⚡</div>
                  <div style={{ fontSize: 16, fontWeight: 800 }}>Đang chuẩn bị đề thi trắc nghiệm trực tuyến...</div>
                  <div style={{ fontSize: 13, color: '#64748b' }}>Vui lòng đợi trong giây lát.</div>
                </div>
              )}

              {/* Trạng thái Lỗi */}
              {quizError && !quizLoading && (
                <div
                  style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 24,
                  }}
                >
                  <div
                    style={{
                      backgroundColor: '#fee2e2',
                      border: '2px solid #dc2626',
                      color: '#991b1b',
                      borderRadius: 12,
                      padding: '20px 28px',
                      maxWidth: 500,
                      textAlign: 'center',
                      boxShadow: '4px 4px 0px #000000',
                    }}
                  >
                    <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 6 }}>Đã xảy ra lỗi</div>
                    <div style={{ fontSize: 13.5, marginBottom: 16 }}>{quizError}</div>
                    <button
                      type="button"
                      onClick={closeExamModal}
                      className="dmrs-btn dmrs-btn--primary"
                      style={{ backgroundColor: '#dc2626' }}
                    >
                      Đóng bài thi
                    </button>
                  </div>
                </div>
              )}

              {/* GIAO DIỆN LÀM BÀI THI TOÀN MÀN HÌNH (KHI CHƯA NỘP) */}
              {!quizLoading && !quizError && quizData && !submissionResult && (
                <>
                  {/* CỘT CHÍNH: DANH SÁCH CÂU HỎI CUỘN DỌC */}
                  <main
                    style={{
                      flex: 1,
                      overflowY: 'auto',
                      padding: '28px 36px 54px',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                    }}
                  >
                    <div style={{ width: '100%', maxWidth: 880 }}>
                      {/* Cảnh báo hết giờ làm bài */}
                      {isTimeUp && (
                        <div
                          style={{
                            backgroundColor: '#fee2e2',
                            border: '2px solid #dc2626',
                            borderRadius: 10,
                            padding: '14px 18px',
                            color: '#991b1b',
                            fontWeight: 800,
                            fontSize: 14,
                            marginBottom: 20,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                            boxShadow: '0 2px 6px rgba(220, 38, 38, 0.15)',
                          }}
                        >
                          <span style={{ fontSize: 20 }}>⏰</span>
                          <span>Đã hết thời gian làm bài! Toàn bộ lựa chọn đã được khóa. Hệ thống đang tự động nộp bài và chấm điểm...</span>
                        </div>
                      )}

                      {/* Danh sách các câu hỏi */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                        {(quizData.questions || []).map((q, idx) => {
                          const chosen = userAnswers[q.id]
                          const isAnswered = Boolean(chosen)

                          return (
                            <div
                              key={q.id}
                              id={`exam-question-${idx}`}
                              style={{
                                backgroundColor: '#ffffff',
                                border: isAnswered ? '2px solid #2563eb' : '2px solid #cbd5e1',
                                borderRadius: 12,
                                padding: '20px 24px',
                                boxShadow: '0 2px 4px rgba(0,0,0,0.03)',
                                transition: 'all 0.15s ease',
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
                                <div style={{ fontSize: 15.5, fontWeight: 800, color: '#0f172a', lineHeight: 1.45 }}>
                                  Câu {idx + 1}: {q.question_text}
                                </div>
                                <span
                                  style={{
                                    fontSize: 11,
                                    fontWeight: 800,
                                    padding: '2px 8px',
                                    borderRadius: 5,
                                    backgroundColor: isAnswered ? '#dbeafe' : '#f1f5f9',
                                    color: isAnswered ? '#1d4ed8' : '#64748b',
                                    border: isAnswered ? '1px solid #2563eb' : '1px solid #cbd5e1',
                                    flexShrink: 0,
                                  }}
                                >
                                  {isAnswered ? '✓ Đã chọn' : 'Chưa chọn'}
                                </span>
                              </div>

                              {/* Danh sách lựa chọn A, B, C, D */}
                              <div
                                style={{
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: 10,
                                  pointerEvents: isTimeUp || submitting ? 'none' : 'auto',
                                  opacity: isTimeUp || submitting ? 0.75 : 1,
                                }}
                              >
                                {(q.options || []).map((opt, optIdx) => {
                                  const isSelected = chosen === opt
                                  const letter = String.fromCharCode(65 + optIdx)

                                  return (
                                    <div
                                      key={opt}
                                      onClick={() => handleSelectOption(q.id, opt)}
                                      role="button"
                                      tabIndex={0}
                                      style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 12,
                                        padding: '12px 16px',
                                        borderRadius: 9,
                                        border: isSelected ? '2px solid #2563eb' : '1.5px solid #cbd5e1',
                                        backgroundColor: isSelected ? '#eff6ff' : '#ffffff',
                                        cursor: isTimeUp || submitting ? 'not-allowed' : 'pointer',
                                        fontSize: 14,
                                        fontWeight: isSelected ? 700 : 500,
                                        color: isSelected ? '#1d4ed8' : '#1e293b',
                                        transition: 'all 0.15s ease',
                                      }}
                                    >
                                      <span
                                        style={{
                                          width: 26,
                                          height: 26,
                                          borderRadius: '50%',
                                          backgroundColor: isSelected ? '#2563eb' : '#f1f5f9',
                                          color: isSelected ? '#ffffff' : '#64748b',
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                          fontWeight: 800,
                                          fontSize: 12.5,
                                          flexShrink: 0,
                                          border: isSelected ? '1px solid #1d4ed8' : '1px solid #cbd5e1',
                                        }}
                                      >
                                        {letter}
                                      </span>
                                      <span style={{ flex: 1, wordBreak: 'break-word' }}>{opt}</span>
                                    </div>
                                  )
                                })}
                              </div>
                            </div>
                          )
                        })}
                      </div>

                      {/* Footer cuối trang làm bài */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          marginTop: 32,
                          paddingTop: 20,
                          borderTop: '2px solid #e2e8f0',
                        }}
                      >
                        <button
                          type="button"
                          className="dmrs-btn dmrs-btn--ghost"
                          onClick={closeExamModal}
                        >
                          Thoát bài thi
                        </button>

                        <button
                          type="button"
                          className="dmrs-btn dmrs-btn--primary"
                          disabled={submitting || isTimeUp}
                          onClick={handleSubmitExam}
                          style={{
                            padding: '11px 28px',
                            fontSize: 14.5,
                            fontWeight: 800,
                            backgroundColor: '#2563eb',
                            borderColor: '#000000',
                            boxShadow: '3px 3px 0px #000000',
                          }}
                        >
                          {submitting ? 'Đang nộp bài...' : `Nộp bài thi (${Object.keys(userAnswers).length}/${quizData.questions?.length || 0} câu)`}
                        </button>
                      </div>
                    </div>
                  </main>

                  {/* CỘT PHẢI: BẢNG CÂU HỎI & ĐỒNG HỒ ĐẾM NGƯỢC DUY NHẤT */}
                  <aside
                    style={{
                      width: 290,
                      minWidth: 290,
                      backgroundColor: '#ffffff',
                      borderLeft: '2px solid #e2e8f0',
                      padding: '20px 18px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 16,
                      overflowY: 'auto',
                      boxShadow: '-2px 0 6px rgba(0,0,0,0.02)',
                    }}
                  >
                    <div>
                      <h3 style={{ fontSize: 15.5, fontWeight: 900, margin: '0 0 4px 0', color: '#0f172a' }}>
                        Bảng câu hỏi ({quizData.questions?.length || 0} câu)
                      </h3>
                      <div style={{ fontSize: 12, color: '#64748b' }}>
                        Bấm vào số câu để chuyển nhanh đến câu hỏi.
                      </div>
                    </div>

                    {/* Đồng hồ đếm ngược duy nhất đặt ở cột bên phải theo yêu cầu */}
                    <div
                      style={{
                        backgroundColor: isTimeUp
                          ? '#fee2e2'
                          : timeLeft !== null && timeLeft <= 60
                          ? '#fee2e2'
                          : timeLeft !== null && timeLeft <= 300
                          ? '#fef3c7'
                          : '#f0fdf4',
                        border: isTimeUp
                          ? '2.5px solid #dc2626'
                          : timeLeft !== null && timeLeft <= 60
                          ? '2.5px solid #dc2626'
                          : timeLeft !== null && timeLeft <= 300
                          ? '2.5px solid #d97706'
                          : '2.5px solid #16a34a',
                        borderRadius: 12,
                        padding: '14px 16px',
                        textAlign: 'center',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.04)',
                      }}
                    >
                      <div style={{ fontSize: 11.5, fontWeight: 800, textTransform: 'uppercase', color: '#475569', marginBottom: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                        <ClockIcon size={16} />
                        <span>{isTimeUp ? 'Đã hết giờ làm bài' : 'Thời gian còn lại'}</span>
                      </div>
                      <div
                        style={{
                          fontSize: 28,
                          fontWeight: 900,
                          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                          color: isTimeUp
                            ? '#b91c1c'
                            : timeLeft !== null && timeLeft <= 60
                            ? '#b91c1c'
                            : timeLeft !== null && timeLeft <= 300
                            ? '#b45309'
                            : '#15803d',
                          letterSpacing: 2,
                          lineHeight: 1.15,
                        }}
                      >
                        {formatTimer(timeLeft)}
                      </div>
                      <div style={{ fontSize: 12, color: '#64748b', marginTop: 4, fontWeight: 700 }}>
                        {isTimeUp
                          ? 'Hệ thống đang nộp bài...'
                          : `${Math.floor((timeLeft || 0) / 60)} phút ${String((timeLeft || 0) % 60).padStart(2, '0')} giây`}
                      </div>
                    </div>

                    {/* Thanh tiến độ phần trăm */}
                    <div>
                      {(() => {
                        const total = quizData.questions?.length || 1
                        const answered = Object.keys(userAnswers).length
                        const pct = Math.round((answered / total) * 100)
                        return (
                          <>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 700, marginBottom: 5 }}>
                              <span>Tiến độ hoàn thành</span>
                              <span style={{ color: '#2563eb' }}>{pct}% ({answered}/{total})</span>
                            </div>
                            <div style={{ height: 8, backgroundColor: '#e2e8f0', borderRadius: 4, overflow: 'hidden' }}>
                              <div
                                style={{
                                  height: '100%',
                                  width: `${pct}%`,
                                  backgroundColor: '#2563eb',
                                  transition: 'width 0.3s ease',
                                }}
                              />
                            </div>
                          </>
                        )
                      })()}
                    </div>

                    {/* Grid các số câu hỏi */}
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(4, 1fr)',
                        gap: 8,
                      }}
                    >
                      {(quizData.questions || []).map((q, idx) => {
                        const isAnswered = Boolean(userAnswers[q.id])
                        return (
                          <button
                            key={q.id}
                            type="button"
                            onClick={() => scrollToQuestion(idx)}
                            style={{
                              height: 38,
                              borderRadius: 8,
                              border: isAnswered ? '2px solid #2563eb' : '1.5px solid #cbd5e1',
                              backgroundColor: isAnswered ? '#2563eb' : '#f8fafc',
                              color: isAnswered ? '#ffffff' : '#475569',
                              fontWeight: 800,
                              fontSize: 13,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              transition: 'all 0.15s ease',
                            }}
                          >
                            {idx + 1}
                          </button>
                        )
                      })}
                    </div>

                    {/* Chú thích màu sắc */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, color: '#475569', marginTop: 'auto', paddingTop: 14, borderTop: '1px solid #e2e8f0' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ width: 14, height: 14, backgroundColor: '#2563eb', borderRadius: 3, display: 'inline-block' }} />
                        <span>Đã chọn đáp án ({Object.keys(userAnswers).length})</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ width: 14, height: 14, backgroundColor: '#f8fafc', border: '1.5px solid #cbd5e1', borderRadius: 3, display: 'inline-block' }} />
                        <span>Chưa chọn đáp án ({(quizData.questions?.length || 0) - Object.keys(userAnswers).length})</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleSubmitExam}
                      disabled={submitting || isTimeUp}
                      className="dmrs-btn dmrs-btn--primary"
                      style={{
                        width: '100%',
                        justifyContent: 'center',
                        padding: '11px 14px',
                        fontSize: 13.5,
                        fontWeight: 800,
                        backgroundColor: '#2563eb',
                        borderColor: '#000000',
                        boxShadow: '2px 2px 0px #000000',
                      }}
                    >
                      {submitting ? 'Đang nộp...' : 'Nộp bài thi ngay'}
                    </button>
                  </aside>
                </>
              )}

              {/* GIAO DIỆN KẾT QUẢ SAU KHI NỘP BÀI (XEM ĐIỂM VÀ LỜI GIẢI CHI TIẾT) */}
              {submissionResult && (
                <main
                  style={{
                    flex: 1,
                    overflowY: 'auto',
                    padding: '32px 32px 64px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                  }}
                >
                  <div style={{ width: '100%', maxWidth: 860 }}>
                    {/* Khối Điểm số tổng quan */}
                    {(() => {
                      const badge = getScoreBadge(submissionResult.score)
                      return (
                        <div
                          style={{
                            backgroundColor: badge.bg,
                            border: '2.5px solid #000000',
                            borderRadius: 14,
                            padding: '24px 28px',
                            boxShadow: '4px 4px 0px #000000',
                            textAlign: 'center',
                            marginBottom: 28,
                          }}
                        >
                          <span
                            style={{
                              fontSize: 12,
                              fontWeight: 800,
                              backgroundColor: '#000000',
                              color: '#ffffff',
                              padding: '3px 12px',
                              borderRadius: 20,
                              display: 'inline-block',
                              marginBottom: 10,
                            }}
                          >
                            HỆ THỐNG ĐÃ CHẤM ĐIỂM HOÀN TẤT
                          </span>

                          <div style={{ fontSize: 42, fontWeight: 900, color: badge.color, lineHeight: 1.15 }}>
                            {submissionResult.score} / 10
                          </div>

                          <div style={{ fontSize: 17, fontWeight: 800, color: '#111827', marginTop: 6 }}>
                            Đánh giá: <span style={{ color: badge.color }}>{badge.text}</span> · Trả lời đúng{' '}
                            <strong>{submissionResult.correct_count}</strong> / {submissionResult.total_questions} câu
                          </div>

                          <p style={{ fontSize: 13.5, color: '#4b5563', margin: '8px 0 0' }}>
                            {badge.desc} Kết quả điểm thi đã được tự động lưu vào hệ thống cho giảng viên.
                          </p>
                        </div>
                      )
                    })()}

                    {/* Chi tiết từng câu hỏi & Lời giải thích */}
                    <h3 style={{ fontSize: 17, fontWeight: 800, margin: '0 0 16px 0', color: '#0f172a' }}>
                      Chi tiết bài làm & Lời giải thích:
                    </h3>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                      {(submissionResult.details || []).map((d, idx) => (
                        <div
                          key={d.question_id || idx}
                          style={{
                            backgroundColor: '#ffffff',
                            border: d.is_correct ? '2px solid #16a34a' : '2px solid #dc2626',
                            borderRadius: 10,
                            padding: '16px 20px',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.03)',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
                            <span style={{ fontSize: 14.5, fontWeight: 800, color: '#0f172a' }}>
                              Câu {idx + 1}: {d.question_text}
                            </span>
                            <span
                              style={{
                                fontSize: 12,
                                fontWeight: 800,
                                padding: '2px 8px',
                                borderRadius: 6,
                                backgroundColor: d.is_correct ? '#dcfce7' : '#fee2e2',
                                color: d.is_correct ? '#15803d' : '#b91c1c',
                                flexShrink: 0,
                              }}
                            >
                              {d.is_correct ? '✓ Đúng' : '✗ Sai'}
                            </span>
                          </div>

                          <div style={{ fontSize: 13.5, color: '#334155', marginBottom: 4 }}>
                            Lựa chọn của bạn:{' '}
                            <strong style={{ color: d.is_correct ? '#15803d' : '#b91c1c' }}>
                              {d.chosen_answer || 'Chưa chọn'}
                            </strong>
                          </div>

                          {!d.is_correct && (
                            <div style={{ fontSize: 13.5, color: '#15803d', marginBottom: 6 }}>
                              Đáp án đúng chính xác: <strong>{d.correct_answer}</strong>
                            </div>
                          )}

                          {/* Lời giải thích */}
                          {d.explanation && (
                            <div
                              style={{
                                marginTop: 10,
                                padding: '10px 14px',
                                backgroundColor: '#eff6ff',
                                border: '1px solid #bfdbfe',
                                borderRadius: 8,
                                fontSize: 13,
                                color: '#1e40af',
                              }}
                            >
                              <strong>💡 Lời giải thích:</strong> {d.explanation}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Nút đóng & quay lại */}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 28 }}>
                      <button
                        type="button"
                        className="dmrs-btn dmrs-btn--ghost"
                        onClick={() => {
                          setUserAnswers({})
                          userAnswersRef.current = {}
                          setSubmissionResult(null)
                          setIsTimeUp(false)
                          autoSubmittedRef.current = false
                          submittingRef.current = false
                          const durationMins = Number(activeExam?.duration_minutes) > 0 ? Number(activeExam.duration_minutes) : 90
                          setTimeLeft(durationMins * 60)
                        }}
                      >
                        Làm lại bài thi
                      </button>
                      <button
                        type="button"
                        className="dmrs-btn dmrs-btn--primary"
                        onClick={closeExamModal}
                        style={{
                          padding: '10px 24px',
                          fontSize: 14,
                          fontWeight: 800,
                          backgroundColor: '#2563eb',
                          borderColor: '#000000',
                          boxShadow: '3px 3px 0px #000000',
                        }}
                      >
                        <CheckCircleIcon size={16} /> Hoàn thành & Thoát
                      </button>
                    </div>
                  </div>
                </main>
              )}
            </div>
          </div>,
          document.body
        )}
    </div>
  )
}

export default StudentExamsPage
