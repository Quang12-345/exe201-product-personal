import { useState, useRef } from 'react'
import {
  parseDocxQuiz,
  createCustomQuiz,
  downloadSampleQuizTemplate,
} from '../services/examService'
import { notify } from '../../../components/common/toast.jsx'

function UploadDocxQuizModal({ isOpen, onClose, onSuccess }) {
  const [file, setFile] = useState(null)
  const [parsing, setParsing] = useState(false)
  const [parsedData, setParsedData] = useState(null)
  const [title, setTitle] = useState('')
  const [questions, setQuestions] = useState([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const fileInputRef = useRef(null)

  if (!isOpen) return null

  const handleFileChange = async (e) => {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return
    if (!selectedFile.name.toLowerCase().endsWith('.docx')) {
      setError('Vui lòng chọn file định dạng Microsoft Word (.docx).')
      return
    }

    setFile(selectedFile)
    setError('')
    setParsing(true)
    try {
      const data = await parseDocxQuiz(selectedFile)
      setParsedData(data)
      setTitle(data.title || selectedFile.name.replace(/\.[^/.]+$/, ''))
      setQuestions(
        (data.questions || []).map((q) => ({
          question_text: q.question_text || '',
          options: q.options || [],
          correct_answer: q.correct_answer || (q.options?.[0] || ''),
          explanation: q.explanation || '',
        }))
      )
      notify(`Đã nhận diện thành công ${data.total} câu hỏi trắc nghiệm!`)
    } catch (err) {
      const detail = err?.response?.data?.detail
      setError(typeof detail === 'string' ? detail : 'Không thể bóc tách file Word. Vui lòng kiểm tra lại định dạng.')
      setParsedData(null)
      setQuestions([])
    } finally {
      setParsing(false)
    }
  }

  const handleSelectCorrect = (qIdx, opt) => {
    setQuestions((prev) =>
      prev.map((q, idx) => (idx === qIdx ? { ...q, correct_answer: opt } : q))
    )
  }

  const handleDownloadSample = async () => {
    try {
      await downloadSampleQuizTemplate()
      notify('Đang tải file mẫu về máy...')
    } catch {
      notify('Không thể tải file mẫu. Vui lòng thử lại sau.', 'error')
    }
  }

  const handleSaveQuiz = async () => {
    if (!title.trim()) {
      setError('Vui lòng nhập tiêu đề cho bộ đề thi.')
      return
    }
    if (questions.length === 0) {
      setError('Chưa có câu hỏi nào để lưu.')
      return
    }

    setSaving(true)
    setError('')
    try {
      const payload = {
        title: title.trim(),
        questions: questions.map((q) => ({
          question_text: q.question_text,
          options: q.options,
          correct_answer: q.correct_answer,
          explanation: q.explanation || null,
        })),
      }
      const created = await createCustomQuiz(payload)
      notify(`Tạo bộ đề thi "${created.title}" thành công!`)
      if (onSuccess) onSuccess(created)
      onClose()
    } catch (err) {
      const detail = err?.response?.data?.detail
      setError(typeof detail === 'string' ? detail : 'Lưu bộ đề thất bại. Vui lòng thử lại.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        zIndex: 1100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        style={{
          backgroundColor: '#ffffff',
          border: '3px solid #000000',
          borderRadius: 14,
          boxShadow: '6px 6px 0px #000000',
          width: '100%',
          maxWidth: 820,
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 22px',
            borderBottom: '2.5px solid #000000',
            backgroundColor: '#f8fafc',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 900, margin: 0, color: '#0f172a' }}>
              📥 Nhập đề thi từ file Word (.docx)
            </h2>
            <div style={{ fontSize: 12.5, color: '#64748b', marginTop: 2 }}>
              Hệ thống tự động quét và bóc tách câu hỏi, phương án và đáp án đúng.
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              backgroundColor: '#ffffff',
              border: '2px solid #000000',
              borderRadius: 8,
              padding: '4px 10px',
              fontWeight: 800,
              cursor: 'pointer',
              fontSize: 13,
            }}
          >
            Đóng ✕
          </button>
        </div>

        {/* Body (scrollable) */}
        <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Box hướng dẫn & Nút tải mẫu */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 16px',
              backgroundColor: '#eff6ff',
              border: '1.5px solid #bfdbfe',
              borderRadius: 10,
              gap: 12,
              flexWrap: 'wrap',
            }}
          >
            <div style={{ fontSize: 13, color: '#1e40af' }}>
              💡 Soạn câu hỏi với tiền tố <strong>Câu 1:</strong>, các đáp án <strong>A. B. C. D.</strong> và đánh dấu <strong>*</strong> hoặc gạch chân đáp án đúng.
            </div>
            <button
              type="button"
              onClick={handleDownloadSample}
              style={{
                backgroundColor: '#ffffff',
                border: '1.5px solid #2563eb',
                color: '#2563eb',
                borderRadius: 8,
                padding: '6px 12px',
                fontSize: 12.5,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                boxShadow: '2px 2px 0px rgba(37,99,235,0.3)',
              }}
            >
              📄 Tải file Word mẫu chuẩn (.docx)
            </button>
          </div>

          {/* Khu vực chọn file */}
          {!parsedData && (
            <div
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: '2px dashed #64748b',
                borderRadius: 12,
                padding: '36px 20px',
                textAlign: 'center',
                backgroundColor: '#f8fafc',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".docx"
                style={{ display: 'none' }}
                onChange={handleFileChange}
              />
              <div style={{ fontSize: 36, marginBottom: 8 }}>📄</div>
              <div style={{ fontSize: 15, fontWeight: 800, color: '#0f172a' }}>
                {file ? file.name : 'Nhấp vào đây để chọn tệp đề thi (.docx)'}
              </div>
              <div style={{ fontSize: 12.5, color: '#64748b', marginTop: 4 }}>
                Hỗ trợ file Microsoft Word định dạng .docx (dung lượng tối đa 15MB)
              </div>
              {parsing && (
                <div style={{ marginTop: 12, color: '#2563eb', fontWeight: 700, fontSize: 13 }}>
                  ⚡ Đang quét và bóc tách câu hỏi, vui lòng chờ chút...
                </div>
              )}
            </div>
          )}

          {error && (
            <div
              style={{
                backgroundColor: '#fee2e2',
                border: '1.5px solid #dc2626',
                color: '#991b1b',
                borderRadius: 8,
                padding: '10px 14px',
                fontSize: 13,
              }}
            >
              {error}
            </div>
          )}

          {/* Giao diện xem trước & chỉnh sửa */}
          {parsedData && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Toolbar thông tin tệp & đổi file khác */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  backgroundColor: '#f1f5f9',
                  borderRadius: 8,
                  border: '1px solid #cbd5e1',
                  flexWrap: 'wrap',
                  gap: 8,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 800, color: '#15803d' }}>
                    ✓ Đã nhận diện: {questions.length} câu hỏi
                  </span>
                  <span style={{ fontSize: 12, color: '#64748b' }}>({file?.name})</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setParsedData(null)
                    setFile(null)
                    setQuestions([])
                    if (fileInputRef.current) fileInputRef.current.value = ''
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#2563eb',
                    fontSize: 12.5,
                    fontWeight: 700,
                    cursor: 'pointer',
                    padding: 0,
                  }}
                >
                  Chọn file khác
                </button>
              </div>

              {/* Ô sửa tiêu đề đề thi */}
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 700, marginBottom: 5 }}>
                  Tiêu đề bộ đề thi <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Nhập tiêu đề bộ đề..."
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: 8,
                    border: '2px solid #000000',
                    fontSize: 14,
                    fontWeight: 600,
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              {/* Danh sách câu hỏi xem trước */}
              <div style={{ fontSize: 13.5, fontWeight: 800, color: '#1e293b', marginTop: 4 }}>
                Xem trước danh sách câu hỏi (nhấp vào phương án để thay đổi đáp án đúng nếu cần):
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {questions.map((q, qIdx) => (
                  <div
                    key={qIdx}
                    style={{
                      border: '1.5px solid #cbd5e1',
                      borderRadius: 10,
                      padding: '12px 16px',
                      backgroundColor: '#ffffff',
                    }}
                  >
                    <div style={{ fontSize: 14, fontWeight: 800, color: '#0f172a', marginBottom: 8 }}>
                      Câu {qIdx + 1}: {q.question_text}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 8 }}>
                      {q.options.map((opt, optIdx) => {
                        const isCorrect = q.correct_answer === opt
                        return (
                          <div
                            key={optIdx}
                            onClick={() => handleSelectCorrect(qIdx, opt)}
                            style={{
                              padding: '8px 12px',
                              borderRadius: 6,
                              border: isCorrect ? '2px solid #16a34a' : '1px solid #e2e8f0',
                              backgroundColor: isCorrect ? '#f0fdf4' : '#ffffff',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              fontSize: 13,
                              fontWeight: isCorrect ? 700 : 500,
                              color: isCorrect ? '#15803d' : '#334155',
                            }}
                          >
                            <span>{opt}</span>
                            {isCorrect && (
                              <span style={{ fontSize: 11, fontWeight: 800, color: '#16a34a' }}>
                                ✓ Đúng
                              </span>
                            )}
                          </div>
                        )
                      })}
                    </div>

                    {q.explanation && (
                      <div
                        style={{
                          marginTop: 8,
                          fontSize: 12,
                          color: '#1e40af',
                          backgroundColor: '#f0f9ff',
                          padding: '6px 10px',
                          borderRadius: 6,
                        }}
                      >
                        💡 <strong>Lời giải:</strong> {q.explanation}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '14px 22px',
            borderTop: '2px solid #e2e8f0',
            backgroundColor: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: 10,
          }}
        >
          <button
            type="button"
            onClick={onClose}
            className="dmrs-btn dmrs-btn--ghost"
            disabled={saving}
          >
            Hủy bỏ
          </button>
          {parsedData && (
            <button
              type="button"
              onClick={handleSaveQuiz}
              disabled={saving}
              className="dmrs-btn dmrs-btn--primary"
              style={{
                backgroundColor: '#16a34a',
                borderColor: '#000000',
                boxShadow: '3px 3px 0px #000000',
              }}
            >
              {saving ? 'Đang lưu...' : `Lưu bộ đề thi (${questions.length} câu)`}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default UploadDocxQuizModal
