import { useEffect, useRef, useState } from 'react'
import StatCard from '../components/StatCard.jsx'
import StatusBadge from '../components/StatusBadge.jsx'
import FeedbackSummaryCard from '../components/FeedbackSummaryCard.jsx'
import { useAsync } from '../hooks/useAsync.js'
import { getAnalytics } from '../services/analyticsService'
import { getSignalsSummary } from '../../../services/feedbackService'
import Portal from '../../../components/common/Portal.jsx'
import {
  CalendarIcon,
  DownloadIcon,
  SearchIcon,
  AlertCircleIcon,
  CheckCircleIcon,
  ClockIcon,
  GraduationCapIcon,
  FileTextIcon,
  EyeIcon,
  XIcon,
  ChevronDownIcon,
  CopyIcon,
  BookmarkIcon,
} from '../../../components/common/icons.jsx'

const STAT_ICON = { search: <SearchIcon size={18} />, alert: <AlertCircleIcon size={18} />, check: <CheckCircleIcon size={18} />, clock: <ClockIcon size={18} /> }
const TOPIC_ICON = [<GraduationCapIcon size={18} />, <FileTextIcon size={18} />, <FileTextIcon size={18} />, <CalendarIcon size={18} />]
const RANGE_OPTIONS = [
  { key: '30d', label: '30 ngày qua' },
  { key: '7d', label: '7 ngày qua' },
  { key: '24h', label: '24h vừa qua' },
]

// Thống kê truy vấn & chất lượng AI (đã gộp): số liệu + biểu đồ + feedback + tín hiệu.
function AnalyticsPage() {
  const [rangeKey, setRangeKey] = useState('30d')
  const [rangeOpen, setRangeOpen] = useState(false)
  const [selectedQuestion, setSelectedQuestion] = useState(null)
  const [signals, setSignals] = useState(null)
  const chartScrollRef = useRef(null)
  const { data, loading } = useAsync(() => getAnalytics(rangeKey), [rangeKey])

  // Tín hiệu ngầm & hệ thống (implicit + system) — gộp từ trang "Chất lượng AI" cũ.
  useEffect(() => {
    getSignalsSummary().then(setSignals).catch(() => setSignals(null))
  }, [])

  useEffect(() => {
    if (rangeKey !== '30d' || !data?.traffic?.length || !chartScrollRef.current) return
    const el = chartScrollRef.current
    const frame = requestAnimationFrame(() => {
      el.scrollLeft = el.scrollWidth
    })
    return () => cancelAnimationFrame(frame)
  }, [rangeKey, data])

  if (loading && !data) return <p className="dmrs-loading">Đang tải...</p>

  const activeRange = RANGE_OPTIONS.find((option) => option.key === rangeKey) || RANGE_OPTIONS[0]
  const max = Math.max(1, ...data.traffic.map((t) => t.value))
  const half = Math.round(max / 2)
  const selectRange = (key) => {
    setRangeKey(key)
    setRangeOpen(false)
    setSelectedQuestion(null)
  }

  return (
    <div>
      <div className="dmrs-page-head">
        <div>
          <h1 className="dmrs-page-title">Thống kê & Chất lượng AI</h1>
          <p className="dmrs-page-sub">Theo dõi truy vấn, phản hồi người dùng và chất lượng câu trả lời AI.</p>
        </div>
        <div className="dmrs-head-actions">
          <div className="dmrs-range-menu">
            <button
              className="dmrs-btn dmrs-btn--light dmrs-range-trigger"
              type="button"
              aria-haspopup="menu"
              aria-expanded={rangeOpen}
              onClick={() => setRangeOpen((open) => !open)}
            >
              <CalendarIcon size={18} />
              {activeRange.label}
              <ChevronDownIcon size={16} />
            </button>
            {rangeOpen && (
              <div className="dmrs-range-options" role="menu">
                {RANGE_OPTIONS.map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    className={'dmrs-range-option' + (option.key === rangeKey ? ' is-active' : '')}
                    role="menuitem"
                    onClick={() => selectRange(option.key)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button className="dmrs-btn dmrs-btn--light" onClick={() => window.print()}><DownloadIcon size={18} /> Xuất báo cáo</button>
        </div>
      </div>

      <div className="dmrs-stat-grid">
        {data.stats.map((s) => (
          <StatCard key={s.key} label={s.label} value={s.value} icon={STAT_ICON[s.icon]} delta={s.delta} deltaType={s.deltaType} note={s.note} danger={s.danger} />
        ))}
      </div>

      <FeedbackSummaryCard />

      {/* Tín hiệu ngầm & hệ thống — gộp từ trang "Chất lượng AI" cũ */}
      {signals && (
        <div className="dmrs-card dmrs-feedback-card">
          <h3 className="dmrs-card-title">
            Tín hiệu ngầm & hệ thống <span className="dmrs-muted" style={{ fontWeight: 400 }}>· implicit + system feedback</span>
          </h3>
          <div className="dmrs-feedback-stats">
            <div className="dmrs-feedback-stat">
              <strong className="dmrs-feedback-rate">{Math.round((signals.grounded_rate || 0) * 100)}%</strong>
              <span>Có nguồn (grounded)</span>
            </div>
            <div className="dmrs-feedback-stat">
              <strong>{Math.round((signals.avg_confidence || 0) * 100)}%</strong>
              <span>Độ tin cậy TB (system)</span>
            </div>
            <div className="dmrs-feedback-stat">
              <strong><EyeIcon size={16} /> {signals.opened_source || 0}</strong>
              <span>Mở nguồn (implicit)</span>
            </div>
            <div className="dmrs-feedback-stat">
              <strong><CopyIcon size={16} /> {signals.copied || 0}</strong>
              <span>Copy (implicit)</span>
            </div>
            <div className="dmrs-feedback-stat">
              <strong><BookmarkIcon size={16} /> {signals.saved || 0}</strong>
              <span>Lưu (implicit)</span>
            </div>
            <div className="dmrs-feedback-stat">
              <strong><FileTextIcon size={16} /> {signals.answers_with_system || 0}</strong>
              <span>Câu trả lời đã đo</span>
            </div>
          </div>
          <p className="dmrs-muted" style={{ marginTop: 10 }}>
            <CheckCircleIcon size={14} /> Implicit = hành vi người dùng (mở nguồn, copy, lưu). System = tín hiệu hệ thống (có nguồn, độ tin cậy). Cùng phản hồi 👍/👎 ở trên tạo thành vòng feedback đầy đủ.
          </p>
        </div>
      )}

      <div className="dmrs-analytics-grid">
        <div className="dmrs-card">
          <h3 className="dmrs-card-title">Lưu lượng truy vấn</h3>
          <div className={'dmrs-chart' + (rangeKey === '30d' ? ' dmrs-chart--scroll' : '') + (rangeKey === '24h' ? ' dmrs-chart--compact' : '')}>
            <div className="dmrs-chart-yaxis">
              <span>{max.toLocaleString()}</span><span>{half.toLocaleString()}</span><span>0</span>
            </div>
            <div className="dmrs-chart-scroll" ref={chartScrollRef}>
              <div className="dmrs-chart-bars">
                {data.traffic.map((t, i) => {
                  const showLabel = true
                  const barHeight = `${(t.value / max) * 100}%`
                  return (
                    <div key={`${t.label}-${i}`} className="dmrs-chart-col">
                      <span className="dmrs-chart-tip">{t.label} · {t.value.toLocaleString()} truy vấn</span>
                      <div
                        className={'dmrs-bar' + (t.value === 0 ? ' is-empty' : '')}
                        style={{
                          '--bar-height': barHeight,
                          height: t.value > 0 ? 'max(10px, var(--bar-height))' : '3px',
                          opacity: 0.4 + (0.6 * t.value) / max,
                        }}
                      />
                      <span className="dmrs-chart-label">{showLabel ? t.label : ''}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>

        <div className="dmrs-card">
          <h3 className="dmrs-card-title">Theo vai trò</h3>
          <div className="dmrs-role-list">
            {data.byRole.length === 0 ? (
              <p className="dmrs-muted">Chưa có truy vấn trong {activeRange.label}.</p>
            ) : data.byRole.map((r) => (
              <div key={r.role} className="dmrs-role-item">
                <div className="dmrs-role-top">
                  <span>{r.role}</span>
                  <strong>{r.value.toLocaleString()} ({r.percent}%)</strong>
                </div>
                <div className="dmrs-progress">
                  <div className="dmrs-progress-bar" style={{ width: `${r.percent}%`, background: r.color }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="dmrs-analytics-grid">
        <div className="dmrs-card">
          <div className="dmrs-card-title-row">
            <h3 className="dmrs-card-title">Câu hỏi không có câu trả lời phù hợp</h3>
            <StatusBadge variant={data.unansweredTotal > 0 ? 'danger' : 'success'}>
              {data.unansweredTotal > 0 ? 'Cần AI Training' : 'Ổn định'}
            </StatusBadge>
          </div>
          <div className="dmrs-table-scroll dmrs-table-scroll--unanswered">
            <table className="dmrs-table dmrs-table--compact">
              <thead>
                <tr><th>Câu hỏi</th><th>Số lần lặp</th><th>Ngày phát sinh</th><th>Thao tác</th></tr>
              </thead>
              <tbody>
                {data.unanswered.length === 0 ? (
                  <tr><td colSpan={4} className="dmrs-muted" style={{ textAlign: 'center', padding: 20 }}>Chưa ghi nhận câu hỏi lỗi hoặc thiếu trích dẫn trong {activeRange.label}.</td></tr>
                ) : data.unanswered.map((u, i) => (
                  <tr key={i}>
                    <td>{u.q}</td>
                    <td className={u.hot ? 'dmrs-hot' : ''}>{u.count}</td>
                    <td>{u.date}</td>
                    <td>
                      <button className="dmrs-link" type="button" onClick={() => setSelectedQuestion(u)}>
                        <EyeIcon size={15} /> {u.action}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="dmrs-center dmrs-mt"><span className="dmrs-muted">Tổng cộng {data.unansweredTotal.toLocaleString()} lượt trong {activeRange.label}</span></div>
        </div>

        <div className="dmrs-card">
          <h3 className="dmrs-card-title">Lĩnh vực được quan tâm</h3>
          <div className="dmrs-topic-list">
            {data.topics.length === 0 ? (
              <p className="dmrs-muted">Chưa có nguồn trích dẫn để thống kê lĩnh vực.</p>
            ) : data.topics.map((t, i) => (
              <div key={t.name} className="dmrs-topic">
                <span className="dmrs-topic-icon">{TOPIC_ICON[i] || <FileTextIcon size={18} />}</span>
                <div className="dmrs-topic-body">
                  <div className="dmrs-topic-top"><span>{t.name}</span><strong>{t.percent}% ({t.count.toLocaleString()})</strong></div>
                  <div className="dmrs-progress">
                    <div className="dmrs-progress-bar" style={{ width: `${t.percent}%`, background: t.color }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {selectedQuestion && (
        <Portal>
          <div className="dmrs-question-modal-backdrop is-visible" onClick={() => setSelectedQuestion(null)}>
            <div className="dmrs-modal dmrs-question-modal is-visible" role="dialog" aria-modal="true" aria-labelledby="question-detail-title" onClick={(e) => e.stopPropagation()}>
              <div className="dmrs-modal-head">
                <div>
                  <h3 id="question-detail-title">Chi tiết câu hỏi</h3>
                  <p className="dmrs-muted">Câu hỏi được ghi nhận từ dữ liệu truy vấn thực tế trong {activeRange.label}.</p>
                </div>
                <button className="dmrs-icon-btn" type="button" aria-label="Đóng" onClick={() => setSelectedQuestion(null)}>
                  <XIcon size={18} />
                </button>
              </div>
              <div className="dmrs-question-detail">
                <span className="dmrs-detail-label">Câu hỏi</span>
                <p>{selectedQuestion.q}</p>
              </div>
              <div className="dmrs-detail-grid">
                <div>
                  <span className="dmrs-detail-label">Số lần lặp</span>
                  <strong>{selectedQuestion.count.toLocaleString()}</strong>
                </div>
                <div>
                  <span className="dmrs-detail-label">Ngày phát sinh gần nhất</span>
                  <strong>{selectedQuestion.date || 'Chưa xác định'}</strong>
                </div>
              </div>
              <div className="dmrs-question-detail">
                <span className="dmrs-detail-label">Trạng thái</span>
                <p>Câu hỏi bị đánh dấu do lượt chạy lỗi hoặc câu trả lời không có nguồn trích dẫn phù hợp.</p>
              </div>
            </div>
          </div>
        </Portal>
      )}
    </div>
  )
}

export default AnalyticsPage
