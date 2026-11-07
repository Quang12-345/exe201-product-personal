import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  fetchAttemptEvaluation,
  generateLearningEvaluation,
} from '../services/studyService'
import {
  SparklesIcon,
  CheckCircleIcon,
  BookOpenIcon,
  ArrowRightIcon,
} from '../../../components/common/icons.jsx'
import { notify } from '../../../components/common/toast.jsx'

export default function LearningEvaluationCard({
  attemptId,
  initialEvaluation = null,
  onRetake = null,
}) {
  const navigate = useNavigate()
  const [evaluation, setEvaluation] = useState(initialEvaluation)
  const [loading, setLoading] = useState(!initialEvaluation && Boolean(attemptId))
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!attemptId) return
    if (initialEvaluation) {
      setEvaluation(initialEvaluation)
      return
    }

    let isMounted = true
    setLoading(true)
    setError('')

    fetchAttemptEvaluation(attemptId)
      .then((data) => {
        if (isMounted) {
          setEvaluation(data)
        }
      })
      .catch((err) => {
        if (isMounted) {
          console.error('Lỗi tải đánh giá năng lực:', err)
          setError('Chưa tải được bản phân tích năng lực.')
        }
      })
      .finally(() => {
        if (isMounted) setLoading(false)
      })

    return () => {
      isMounted = false
    }
  }, [attemptId, initialEvaluation])

  const handleGenerate = async () => {
    if (!attemptId || generating) return
    setGenerating(true)
    setError('')
    try {
      const data = await generateLearningEvaluation(attemptId)
      setEvaluation(data)
      notify('AI đã phân tích xong năng lực học tập của bạn!')
    } catch (err) {
      const msg = err?.response?.data?.detail || 'Không thể tạo bản phân tích AI. Vui lòng thử lại.'
      setError(typeof msg === 'string' ? msg : 'Lỗi khi gọi AI phân tích.')
    } finally {
      setGenerating(false)
    }
  }

  const getLevelBadge = (level) => {
    switch (level) {
      case 'Xuất sắc':
        return { color: '#15803d', bg: '#dcfce7', border: '#86efac', text: 'Xuất sắc 🏆' }
      case 'Khá Giỏi':
        return { color: '#1d4ed8', bg: '#dbeafe', border: '#93c5fd', text: 'Khá Giỏi ⭐' }
      case 'Đạt yêu cầu':
        return { color: '#b45309', bg: '#fef3c7', border: '#fcd34d', text: 'Đạt yêu cầu 👍' }
      default:
        return { color: '#b91c1c', bg: '#fee2e2', border: '#fca5a5', text: 'Cần củng cố ⚠️' }
    }
  }

  if (loading) {
    return (
      <div
        style={{
          padding: '36px 24px',
          textAlign: 'center',
          backgroundColor: '#ffffff',
          borderRadius: 14,
          border: '2px dashed #cbd5e1',
          margin: '20px 0',
        }}
      >
        <div style={{ display: 'inline-block', animation: 'spin 1.5s linear infinite', marginBottom: 12 }}>
          <SparklesIcon size={32} />
        </div>
        <h4 style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 800, color: '#0f172a' }}>
          AI đang phân tích năng lực và bài làm của bạn...
        </h4>
        <p style={{ margin: 0, fontSize: 13, color: '#64748b' }}>
          Đang quét từng câu trả lời đúng/sai để xác định điểm mạnh và lỗ hổng kiến thức.
        </p>
      </div>
    )
  }

  if (error && !evaluation) {
    return (
      <div
        style={{
          padding: '28px 24px',
          textAlign: 'center',
          backgroundColor: '#fff1f2',
          borderRadius: 14,
          border: '1.5px solid #fecdd3',
          margin: '20px 0',
        }}
      >
        <p style={{ color: '#be123c', fontWeight: 700, margin: '0 0 14px' }}>{error}</p>
        <button
          type="button"
          onClick={handleGenerate}
          disabled={generating}
          className="dmrs-btn dmrs-btn--primary"
          style={{ padding: '8px 20px', fontSize: 13.5, fontWeight: 800 }}
        >
          {generating ? 'Đang phân tích...' : '✨ Yêu cầu AI Phân Tích Lại'}
        </button>
      </div>
    )
  }

  if (!evaluation) {
    return (
      <div
        style={{
          padding: '32px 24px',
          textAlign: 'center',
          backgroundColor: '#f8fafc',
          borderRadius: 14,
          border: '2px dashed #cbd5e1',
          margin: '20px 0',
        }}
      >
        <div style={{ fontSize: 36, marginBottom: 10 }}>🎯</div>
        <h4 style={{ margin: '0 0 8px', fontSize: 17, fontWeight: 800, color: '#0f172a' }}>
          Báo cáo Đánh Giá Năng Lực & Lộ Trình Học Tập AI
        </h4>
        <p style={{ margin: '0 0 18px', fontSize: 13.5, color: '#64748b', maxWidth: 520, marginInline: 'auto' }}>
          Hệ thống AI có thể quét toàn bộ câu đúng và sai trong bài làm này để tìm ra bạn đang mạnh phần nào,
          bị hổng kiến thức ở đâu và vạch ra lộ trình ôn tập cá nhân hóa.
        </p>
        <button
          type="button"
          onClick={handleGenerate}
          disabled={generating}
          className="dmrs-btn dmrs-btn--primary"
          style={{
            padding: '10px 24px',
            fontSize: 14,
            fontWeight: 800,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <SparklesIcon size={18} />
          {generating ? 'AI đang phân tích...' : 'Kích hoạt AI Đánh Giá Năng Lực'}
        </button>
      </div>
    )
  }

  const levelInfo = getLevelBadge(evaluation.competency_level)

  return (
    <div
      style={{
        backgroundColor: '#ffffff',
        border: '2px solid #000000',
        borderRadius: 14,
        padding: '24px 28px',
        boxShadow: '4px 4px 0px #000000',
        margin: '20px 0',
      }}
    >
      {/* Header Banner */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 14,
          borderBottom: '2px solid #f1f5f9',
          paddingBottom: 18,
          marginBottom: 20,
        }}
      >
        <div>
          <span
            style={{
              fontSize: 11.5,
              fontWeight: 800,
              backgroundColor: '#000000',
              color: '#ffffff',
              padding: '3px 10px',
              borderRadius: 20,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
              display: 'inline-block',
              marginBottom: 8,
            }}
          >
            AI ADAPTIVE LEARNING
          </span>
          <h3 style={{ margin: 0, fontSize: 19, fontWeight: 900, color: '#0f172a' }}>
            Đánh Giá Năng Lực & Lộ Trình Cá Nhân Hóa
          </h3>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span
            style={{
              backgroundColor: levelInfo.bg,
              color: levelInfo.color,
              border: `1.5px solid ${levelInfo.border}`,
              padding: '6px 14px',
              borderRadius: 30,
              fontWeight: 800,
              fontSize: 14,
            }}
          >
            Năng lực: {levelInfo.text}
          </span>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={generating}
            title="Chạy lại phân tích AI"
            style={{
              background: '#f8fafc',
              border: '1.5px solid #cbd5e1',
              borderRadius: 8,
              padding: '6px 10px',
              cursor: generating ? 'not-allowed' : 'pointer',
              fontSize: 12.5,
              fontWeight: 700,
              color: '#475569',
            }}
          >
            {generating ? '...' : '↻ Phân tích lại'}
          </button>
        </div>
      </div>

      {/* Summary quote */}
      {evaluation.summary && (
        <div
          style={{
            backgroundColor: '#f8fafc',
            borderLeft: '4px solid #2563eb',
            borderRadius: '0 8px 8px 0',
            padding: '12px 18px',
            fontSize: 14,
            color: '#334155',
            lineHeight: 1.6,
            marginBottom: 24,
            fontStyle: 'normal',
          }}
        >
          <strong>Nhận xét của AI:</strong> {evaluation.summary}
        </div>
      )}

      {/* Grid: Strengths & Weaknesses */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 18,
          marginBottom: 28,
        }}
      >
        {/* Điểm mạnh */}
        <div
          style={{
            backgroundColor: '#f0fdf4',
            border: '1.5px solid #bbf7d0',
            borderRadius: 12,
            padding: '18px 20px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <span style={{ fontSize: 20 }}>🌟</span>
            <h4 style={{ margin: 0, fontSize: 16, fontWeight: 900, color: '#166534' }}>
              Điểm Mạnh Của Bạn
            </h4>
          </div>

          {evaluation.strengths && evaluation.strengths.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {evaluation.strengths.map((item, idx) => (
                <div
                  key={idx}
                  style={{
                    backgroundColor: '#ffffff',
                    border: '1px solid #86efac',
                    borderRadius: 8,
                    padding: '10px 14px',
                  }}
                >
                  <div style={{ fontWeight: 800, fontSize: 13.5, color: '#15803d', marginBottom: 3 }}>
                    ✓ {item.topic}
                  </div>
                  <div style={{ fontSize: 12.5, color: '#374151', lineHeight: 1.45 }}>
                    {item.description}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ fontSize: 13, color: '#65a30d' }}>Chưa ghi nhận điểm mạnh vượt trội.</div>
          )}
        </div>

        {/* Điểm yếu & Lỗ hổng */}
        <div
          style={{
            backgroundColor: '#fffbeb',
            border: '1.5px solid #fde68a',
            borderRadius: 12,
            padding: '18px 20px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <span style={{ fontSize: 20 }}>⚠️</span>
            <h4 style={{ margin: 0, fontSize: 16, fontWeight: 900, color: '#92400e' }}>
              Lỗ Hổng Kiến Thức Cần Bổ Sung
            </h4>
          </div>

          {evaluation.weaknesses && evaluation.weaknesses.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {evaluation.weaknesses.map((item, idx) => (
                <div
                  key={idx}
                  style={{
                    backgroundColor: '#ffffff',
                    border: '1px solid #fcd34d',
                    borderRadius: 8,
                    padding: '10px 14px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                    <div style={{ fontWeight: 800, fontSize: 13.5, color: '#b45309' }}>
                      • {item.topic}
                    </div>
                    {item.failed_questions && item.failed_questions.length > 0 && (
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          backgroundColor: '#fee2e2',
                          color: '#dc2626',
                          padding: '2px 8px',
                          borderRadius: 12,
                        }}
                      >
                        Sai câu: {item.failed_questions.join(', ')}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 12.5, color: '#4b5563', marginBottom: 4 }}>
                    <strong>Vấn đề:</strong> {item.issue}
                  </div>
                  {item.advice && (
                    <div style={{ fontSize: 12, color: '#0369a1', fontStyle: 'italic' }}>
                      💡 Lời khuyên: {item.advice}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div style={{ fontSize: 13, color: '#16a34a', fontWeight: 700 }}>
              Không có lỗ hổng kiến thức nghiêm trọng!
            </div>
          )}
        </div>
      </div>

      {/* Roadmap section */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <span style={{ fontSize: 22 }}>🗺️</span>
          <h4 style={{ margin: 0, fontSize: 17, fontWeight: 900, color: '#0f172a' }}>
            Lộ Trình Học Tập Cá Nhân Hóa Đề Xuất
          </h4>
        </div>

        {evaluation.roadmap && evaluation.roadmap.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {evaluation.roadmap.map((step, idx) => {
              const stepNumber = step.step || idx + 1
              return (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 16,
                    backgroundColor: '#f8fafc',
                    border: '1.5px solid #e2e8f0',
                    borderRadius: 10,
                    padding: '14px 18px',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: '50%',
                      backgroundColor: '#0f172a',
                      color: '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 900,
                      fontSize: 14,
                      flexShrink: 0,
                    }}
                  >
                    {stepNumber}
                  </div>

                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 4 }}>
                      <span style={{ fontWeight: 800, fontSize: 14.5, color: '#0f172a' }}>
                        {step.title}
                      </span>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          backgroundColor: '#e0e7ff',
                          color: '#4338ca',
                          padding: '2px 8px',
                          borderRadius: 12,
                        }}
                      >
                        {step.action_type === 'flashcard'
                          ? '🗂️ Flashcard'
                          : step.action_type === 'quiz'
                          ? '📝 Làm Quiz bù'
                          : '📖 Đọc tài liệu'}
                      </span>
                    </div>

                    <p style={{ margin: '0 0 8px', fontSize: 13, color: '#475569', lineHeight: 1.5 }}>
                      {step.description}
                    </p>

                    {/* Action buttons */}
                    <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
                      {step.document_id && (
                        <button
                          type="button"
                          onClick={() => navigate(`/student/study/${step.document_id}?tab=flashcards`)}
                          style={{
                            background: '#ffffff',
                            border: '1px solid #0f172a',
                            borderRadius: 6,
                            padding: '4px 12px',
                            fontSize: 12,
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 5,
                            color: '#0f172a',
                          }}
                        >
                          <BookOpenIcon size={14} />
                          Mở tài liệu ôn tập
                        </button>
                      )}
                      {step.action_type === 'quiz' && onRetake && (
                        <button
                          type="button"
                          onClick={onRetake}
                          style={{
                            background: '#2563eb',
                            color: '#ffffff',
                            border: 'none',
                            borderRadius: 6,
                            padding: '4px 12px',
                            fontSize: 12,
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 5,
                          }}
                        >
                          <ArrowRightIcon size={14} />
                          Làm lại bài thi ngay
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div style={{ fontSize: 13, color: '#64748b' }}>Chưa có lộ trình cụ thể.</div>
        )}
      </div>
    </div>
  )
}
