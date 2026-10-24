// Hiệu ứng "đang trả lời" kiểu Claude Code: glyph xoay + chữ shimmer + dấu chấm nảy.
function TypingIndicator({ label = 'Đang suy nghĩ' }) {
  return (
    <div className="ai-typing" role="status" aria-live="polite">
      <span className="ai-typing-glyph">✦</span>
      <span className="ai-typing-text">{label}</span>
      <span className="ai-typing-dots"><i /><i /><i /></span>
    </div>
  )
}

export default TypingIndicator
