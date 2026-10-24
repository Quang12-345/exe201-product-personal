import { useState, useEffect, useRef } from 'react'
import { SparklesIcon, CheckIcon, XIcon } from '../../../components/common/icons.jsx'
import {
  fetchQuiz,
  submitQuiz,
  generateQuiz,
  deleteQuiz,
} from '../services/studyService'
import { notify } from '../../../components/common/toast.jsx'

export default function QuizPlayer({
  documentId,
  quizzes = [],
  setQuizzes,
  onRefresh,
  isPro = true,
  onUpgradePro,
  checkoutBusy = false,
}) {
  const quizList = quizzes || []
  const [selectedQuizId, setSelectedQuizId] = useState(quizzes[0]?.id || null)
  const [quizData, setQuizData] = useState(null)
  const [userAnswers, setUserAnswers] = useState({})
  const [submissionResult, setSubmissionResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const currentQuizDataRef = useRef(quizData)
  currentQuizDataRef.current = quizData

  // Đồng bộ selectedQuizId khi quizList thay đổi
  useEffect(() => {
    if (quizList.length > 0) {
      if (!selectedQuizId || !quizList.some((q) => q.id === selectedQuizId)) {
        setSelectedQuizId(quizList[0].id)
      }
    } else {
      setSelectedQuizId(null)
      setQuizData(null)
    }
  }, [quizList, selectedQuizId])

  // Reset câu trả lời và kết quả khi đổi tài liệu
  useEffect(() => {
    setUserAnswers({})
    setSubmissionResult(null)
  }, [documentId])

  // Tải chi tiết câu hỏi của bài quiz đang chọn
  useEffect(() => {
    if (!selectedQuizId) {
      setQuizData(null)
      return
    }

    // Nếu quizData đã có sẵn đúng quizId (ví dụ AI vừa tạo xong), không cần gọi lại
    if (currentQuizDataRef.current && currentQuizDataRef.current.id === selectedQuizId) {
      return
    }

    let isMounted = true
    setLoading(true)
    setSubmissionResult(null)
    setUserAnswers({})

    fetchQuiz(selectedQuizId, false)
      .then((data) => {
        if (isMounted) setQuizData(data)
      })
      .catch((err) => {
        if (isMounted) {
          console.error('Lỗi tải quiz:', err)
          notify.error('Không thể tải câu hỏi trắc nghiệm')
        }
      })
      .finally(() => {
        if (isMounted) setLoading(false)
      })

    return () => {
      isMounted = false
    }
  }, [selectedQuizId])

  const handleSelectOption = (questionId, option) => {
    if (submissionResult) return // Không cho đổi sau khi nộp
    setUserAnswers((prev) => ({
      ...prev,
      [questionId]: option,
    }))
  }

  const handleSubmit = async () => {
    if (!quizData) return
    const totalCount = quizData.questions.length
    const answeredCount = Object.keys(userAnswers).length

    if (answeredCount < totalCount) {
      if (
        !window.confirm(
          `Bạn mới trả lời ${answeredCount}/${totalCount} câu hỏi. Bạn có chắc chắn muốn nộp bài?`
        )
      ) {
        return
      }
    }

    setSubmitting(true)
    try {
      const result = await submitQuiz(quizData.id, userAnswers)
      setSubmissionResult(result)
      notify(`Đã nộp bài! Điểm của bạn: ${result.score} / 10`)
    } catch (err) {
      console.error('Lỗi khi nộp bài:', err)
      notify(err.response?.data?.detail || 'Lỗi khi nộp bài thi', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const handleRetake = () => {
    setSubmissionResult(null)
    setUserAnswers({})
  }

  const handleGenerateAIQuiz = async () => {
    if (!isPro) {
      notify('Tính năng tạo bài thi Quiz bằng AI chỉ dành riêng cho gói Pro. Vui lòng nâng cấp tài khoản!', 'error')
      onUpgradePro?.()
      return
    }
    if (!documentId) {
      notify('Chưa có tài liệu nào được chọn.', 'error')
      return
    }
    setGenerating(true)
    try {
      const created = await generateQuiz(documentId, { num_questions: 5 })
      const newSummary = {
        id: created.id,
        document_id: created.document_id,
        title: created.title,
        question_count: created.questions?.length || 5,
        created_at: created.created_at,
      }

      // Cập nhật ngay lập tức danh sách đề thi tại parent
      const updatedList = [newSummary, ...quizList.filter((q) => q.id !== created.id)]
      if (setQuizzes) {
        setQuizzes(updatedList)
      }

      // Đặt đề vừa tạo và hiển thị nội dung câu hỏi lập tức mà không cần fetch lại
      currentQuizDataRef.current = created
      setSelectedQuizId(created.id)
      setQuizData(created)
      setUserAnswers({})
      setSubmissionResult(null)
      notify('AI đã tạo đề thi trắc nghiệm mới thành công!')
    } catch (err) {
      console.error('Lỗi sinh đề quiz:', err)
      const detail = err.response?.data?.detail
      notify(typeof detail === 'string' ? detail : detail?.message || 'Lỗi khi sinh đề trắc nghiệm bằng AI', 'error')
    } finally {
      setGenerating(false)
    }
  }

  const handleDeleteQuiz = async (id) => {
    if (!id) return
    if (!window.confirm('Bạn có chắc muốn xóa đề thi này?')) return
    setDeleting(true)
    try {
      await deleteQuiz(id)

      // Xóa đề khỏi state danh sách đề thi ngay lập tức
      const remaining = quizList.filter((q) => q.id !== id)
      if (setQuizzes) {
        setQuizzes(remaining)
      }

      setUserAnswers({})
      setSubmissionResult(null)

      if (remaining.length > 0) {
        currentQuizDataRef.current = null
        setSelectedQuizId(remaining[0].id)
        setQuizData(null)
      } else {
        currentQuizDataRef.current = null
        setSelectedQuizId(null)
        setQuizData(null)
      }
      notify('Đã xóa đề thi thành công')
    } catch (err) {
      console.error('Lỗi xóa quiz:', err)
      notify(err.response?.data?.detail || 'Lỗi khi xóa bài Quiz', 'error')
    } finally {
      setDeleting(false)
    }
  }

  if (!isPro) {
    return (
      <div className="study-pro-locked-box">
        <div className="study-pro-locked-icon">🔒</div>
        <h3 className="study-pro-locked-title">Luyện thi Quiz chỉ dành cho DMRS Pro</h3>
        <p className="study-pro-locked-desc">
          Tài khoản của bạn hiện là gói Miễn phí. Đề thi trắc nghiệm AI và toàn bộ bài luyện tập ôn thi chỉ có thể sử dụng khi nâng cấp gói <strong>DMRS Pro</strong>.
        </p>
        <button
          type="button"
          className="study-pro-upgrade-btn"
          onClick={onUpgradePro}
          disabled={checkoutBusy}
        >
          {checkoutBusy ? 'Đang kết nối...' : '👑 Nâng cấp DMRS Pro để mở khóa · 99.000đ/tháng'}
        </button>
      </div>
    )
  }

  // Khi đang sinh đề từ lúc chưa có đề nào
  if (generating) {
    return (
      <div className="study-empty">
        <SparklesIcon size={44} style={{ color: '#1a56db', animation: 'spin 2s linear infinite' }} />
        <h4>AI đang đọc tài liệu & soạn câu hỏi trắc nghiệm...</h4>
        <p>Quá trình này mất khoảng 5 - 10 giây để phân tích kiến thức và xây dựng phương án kiểm tra chuẩn xác.</p>
      </div>
    )
  }

  // Khi chưa có bài quiz nào VÀ chưa có dữ liệu quizData
  if (quizList.length === 0 && !quizData) {
    return (
      <div className="study-empty">
        <SparklesIcon size={44} style={{ color: '#1a56db' }} />
        <h4>Chưa có bài thi trắc nghiệm (Quiz) nào cho tài liệu này</h4>
        <p>Để AI tự động đọc hiểu tài liệu và tạo bộ câu hỏi trắc nghiệm 4 lựa chọn có đáp án và giải thích.</p>
        <button
          type="button"
          className={`fc-btn fc-btn--primary ${!isPro ? 'fc-btn--pro-locked' : ''}`}
          onClick={handleGenerateAIQuiz}
          disabled={generating}
          title={!isPro ? 'Cần tài khoản Pro để sử dụng' : 'AI tạo đề trắc nghiệm ngay'}
        >
          <SparklesIcon size={18} />
          {generating ? 'AI đang soạn câu hỏi trắc nghiệm...' : 'AI tạo đề trắc nghiệm ngay'}
          {!isPro && <span className="pro-tag-badge">👑 Pro</span>}
        </button>
      </div>
    )
  }

  return (
    <div>
      {/* Thanh chọn bài quiz & tạo mới */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          marginBottom: 20,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <label style={{ fontWeight: 600, color: '#475569' }}>Chọn đề thi:</label>
          <select
            className="study-select"
            value={selectedQuizId || ''}
            onChange={(e) => {
              setSelectedQuizId(e.target.value)
              setUserAnswers({})
              setSubmissionResult(null)
            }}
          >
            {quizList.map((q) => (
              <option key={q.id} value={q.id}>
                {q.title} ({q.question_count} câu)
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            type="button"
            className={`fc-btn ${!isPro ? 'fc-btn--pro-locked' : ''}`}
            onClick={handleGenerateAIQuiz}
            disabled={generating}
            style={{ fontSize: 13, padding: '6px 14px' }}
            title={!isPro ? 'Cần tài khoản Pro để sử dụng' : '+ Tạo thêm đề Quiz mới (AI)'}
          >
            <SparklesIcon size={15} />
            {generating ? 'Đang tạo...' : '+ Tạo thêm đề Quiz mới (AI)'}
            {!isPro && <span className="pro-tag-badge">👑 Pro</span>}
          </button>
          {selectedQuizId && (
            <button
              type="button"
              className="fc-btn"
              onClick={() => handleDeleteQuiz(selectedQuizId)}
              disabled={deleting}
              style={{ fontSize: 13, padding: '6px 14px', color: '#dc2626' }}
            >
              {deleting ? 'Đang xóa...' : 'Xóa đề này'}
            </button>
          )}
        </div>
      </div>

      {loading && (
        <div style={{ textAlign: 'center', padding: 40, color: '#64748b' }}>
          Đang tải nội dung câu hỏi...
        </div>
      )}

      {/* Hiển thị kết quả điểm sau khi nộp bài */}
      {submissionResult && (
        <div className="quiz-result-banner">
          <div style={{ fontSize: 16, fontWeight: 500, opacity: 0.9 }}>
            KẾT QUẢ BÀI LÀM CỦA BẠN
          </div>
          <div className="quiz-result-score">
            {submissionResult.score} / 10
          </div>
          <div style={{ fontSize: 15 }}>
            Đúng {submissionResult.correct_count} / {submissionResult.total_questions} câu hỏi
            {submissionResult.score >= 5 ? ' 🎉 Chúc mừng bạn đã hoàn thành!' : ' ⚠️ Hãy xem lại kiến thức các câu sai bên dưới nhé.'}
          </div>
          <button
            type="button"
            className="fc-btn"
            onClick={handleRetake}
            style={{ marginTop: 16, background: '#ffffff', color: '#1e40af', fontWeight: 700 }}
          >
            🔄 Làm lại bài thi
          </button>
        </div>
      )}

      {/* Danh sách câu hỏi */}
      {quizData && !loading && (
        <div className="quiz-card">
          <div className="quiz-header-bar">
            <div>
              <h3 style={{ margin: 0, color: '#0f172a' }}>{quizData.title}</h3>
              <span style={{ fontSize: 13, color: '#64748b' }}>
                Tổng số câu: {quizData.questions.length} · Thời gian gợi ý: {quizData.questions.length * 2} phút
              </span>
            </div>
            {!submissionResult && (
              <span style={{ fontSize: 14, fontWeight: 600, color: '#1a56db' }}>
                Đã chọn: {Object.keys(userAnswers).length} / {quizData.questions.length}
              </span>
            )}
          </div>

          {quizData.questions.map((q, idx) => {
            // Khi đã nộp, tìm chi tiết câu hỏi tương ứng trong kết quả
            const detail = submissionResult?.details?.find((d) => d.question_id === q.id)
            const chosen = userAnswers[q.id]

            return (
              <div key={q.id} className="quiz-question-box">
                <div className="quiz-question-title">
                  <span className="quiz-q-num">Câu {idx + 1}:</span>
                  <span>{q.question_text}</span>
                </div>

                <div className="quiz-options-list">
                  {q.options.map((opt, oIdx) => {
                    const isSelected = chosen === opt

                    let stateClass = ''
                    if (submissionResult && detail) {
                      if (opt === detail.correct_answer) {
                        stateClass = ' is-correct'
                      } else if (isSelected && !detail.is_correct) {
                        stateClass = ' is-wrong'
                      }
                    } else if (isSelected) {
                      stateClass = ' is-selected'
                    }

                    return (
                      <div
                        key={oIdx}
                        className={`quiz-option-label${stateClass}`}
                        onClick={() => !submissionResult && handleSelectOption(q.id, opt)}
                      >
                        <input
                          type="radio"
                          name={`q_${q.id}`}
                          checked={isSelected}
                          readOnly
                          disabled={Boolean(submissionResult)}
                          style={{ cursor: 'pointer', pointerEvents: 'none' }}
                        />
                        <span>{opt}</span>
                      </div>
                    )
                  })}
                </div>

                {/* Hiển thị giải thích sau khi đã nộp bài */}
                {detail && (
                  <div className="quiz-explanation">
                    <strong>
                      {detail.is_correct ? '✅ Chính xác!' : '❌ Chưa chính xác.'}
                    </strong>{' '}
                    <span>Đáp án đúng: <strong>{detail.correct_answer}</strong></span>
                    {detail.explanation && (
                      <div style={{ marginTop: 6 }}>
                        💡 <em>Giải thích: {detail.explanation}</em>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}

          {!submissionResult ? (
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 24 }}>
              <button
                type="button"
                className="fc-btn fc-btn--primary"
                onClick={handleSubmit}
                disabled={submitting}
                style={{ padding: '12px 28px', fontSize: 16 }}
              >
                {submitting ? 'Đang chấm điểm...' : 'Nộp bài thi'}
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: 24 }}>
              <button
                type="button"
                className="fc-btn fc-btn--primary"
                onClick={handleRetake}
              >
                🔄 Làm lại bài thi này
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
