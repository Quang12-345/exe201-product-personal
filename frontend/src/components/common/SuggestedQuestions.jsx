import { SparklesIcon, ArrowRightIcon } from './icons.jsx'

// Chip câu hỏi gợi ý hiển thị trong khung chat (dùng chung student + lecturer).
// Bấm vào chip là GỬI câu hỏi luôn — không cần gõ. Chỉ nên hiện khi hội thoại
// còn trống (mới mở) để mời người dùng bắt đầu nhanh.
export default function SuggestedQuestions({ questions, onPick, disabled }) {
  if (!questions?.length) return null
  return (
    <div className="chat-suggest">
      <span className="chat-suggest-label"><SparklesIcon size={15} /> Gợi ý câu hỏi — bấm để hỏi ngay</span>
      <div className="chat-suggest-list">
        {questions.map((q) => (
          <button
            key={q}
            type="button"
            className="chat-suggest-chip"
            onClick={() => onPick(q)}
            disabled={disabled}
          >
            <span>{q}</span>
            <ArrowRightIcon size={15} />
          </button>
        ))}
      </div>
    </div>
  )
}
