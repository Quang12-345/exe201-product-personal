// Thẻ số liệu dùng ở Dashboard / Thống kê truy vấn.
function StatCard({ label, value, icon, delta, deltaType, note, danger, variant }) {
  const variantClass = variant ? ` dmrs-stat-card--${variant}` : ''
  return (
    <div className={'dmrs-stat-card' + (danger ? ' is-danger' : '') + variantClass}>
      <div className="dmrs-stat-top">
        <span className="dmrs-stat-label">{label}</span>
        {icon && <span className="dmrs-stat-icon">{icon}</span>}
      </div>
      <div className="dmrs-stat-value">{value}</div>
      <div className="dmrs-stat-foot">
        {delta && (
          <span className={'dmrs-stat-delta dmrs-stat-delta--' + (deltaType || 'up')}>{delta}</span>
        )}
        {note && <span className="dmrs-stat-note">{note}</span>}
      </div>
    </div>
  )
}

export default StatCard
