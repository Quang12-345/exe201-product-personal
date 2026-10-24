// Nhãn trạng thái tái sử dụng (badge). variant quyết định màu; dot bật chấm tròn.
function StatusBadge({ variant = 'neutral', dot = false, children }) {
  return (
    <span className={`dmrs-badge dmrs-badge--${variant}`}>
      {dot && <span className="dmrs-badge-dot" />}
      {children}
    </span>
  )
}

export default StatusBadge
