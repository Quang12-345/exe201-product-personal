import { useState, useEffect } from 'react'
import { getWebTrafficStats } from '../../../services/trackingService.js'
import './AdminWebTrafficSection.css'

export default function AdminWebTrafficSection() {
  const [range, setRange] = useState('14d')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  const loadTraffic = async () => {
    try {
      setLoading(true)
      const res = await getWebTrafficStats(range)
      setData(res)
    } catch (err) {
      console.error('Lỗi tải thống kê truy cập web:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadTraffic()
  }, [range])

  const trend = data?.traffic_trend || []
  const maxViews = Math.max(1, ...trend.map((t) => t.pageviews))

  return (
    <div className="awts-card">
      {/* Header */}
      <div className="awts-header">
        <div className="awts-header-left">
          <div className="awts-header-icon">🌐</div>
          <div>
            <h3 className="awts-title">Thống kê Lượt truy cập Website</h3>
            <p className="awts-subtitle">
              Tổng số lượt sinh viên và giảng viên đăng nhập, truy cập vào hệ thống StudyMind.
            </p>
          </div>
        </div>

        <div className="awts-range-pills">
          <button
            type="button"
            className={`awts-range-pill ${range === '7d' ? 'is-active' : ''}`}
            onClick={() => setRange('7d')}
          >
            7 ngày qua
          </button>
          <button
            type="button"
            className={`awts-range-pill ${range === '14d' ? 'is-active' : ''}`}
            onClick={() => setRange('14d')}
          >
            14 ngày qua
          </button>
          <button
            type="button"
            className={`awts-range-pill ${range === '30d' ? 'is-active' : ''}`}
            onClick={() => setRange('30d')}
          >
            30 ngày qua
          </button>
        </div>
      </div>

      {/* 3 Thẻ chỉ số tổng hợp gọn gàng */}
      <div className="awts-metrics-grid">
        <div className="awts-metric-box">
          <span className="awts-metric-label">Tổng lượt truy cập</span>
          <div className="awts-metric-val" style={{ color: '#0284c7' }}>
            {(data?.total_pageviews || 0).toLocaleString()}
          </div>
          <span className="awts-metric-note">Toàn bộ lượt đăng nhập hệ thống</span>
        </div>

        <div className="awts-metric-box">
          <span className="awts-metric-label">Lượt truy cập hôm nay</span>
          <div className="awts-metric-val" style={{ color: '#16a34a' }}>
            +{(data?.today_pageviews || 0).toLocaleString()}
          </div>
          <span className="awts-metric-note">Phát sinh trong 24h qua</span>
        </div>

        <div className="awts-metric-box">
          <span className="awts-metric-label">Tài khoản đã truy cập</span>
          <div className="awts-metric-val" style={{ color: '#7c3aed' }}>
            {(data?.unique_visitors || 0).toLocaleString()}
          </div>
          <span className="awts-metric-note">Số người dùng riêng biệt</span>
        </div>
      </div>

      {/* Biểu đồ xu hướng lượt truy cập theo ngày */}
      <div className="awts-chart-box">
        <div className="awts-chart-title">
          <span>Xu hướng lượt đăng nhập & truy cập theo ngày</span>
          <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>
            {range === '7d' ? '7 ngày qua' : range === '14d' ? '14 ngày qua' : '30 ngày qua'}
          </span>
        </div>

        <div className="awts-bars-row">
          {trend.length > 0 ? (
            trend.map((pt, i) => {
              const heightPct = Math.max(6, Math.round((pt.pageviews / maxViews) * 100))
              return (
                <div key={i} className="awts-bar-col">
                  {pt.pageviews > 0 && <span className="awts-bar-val">{pt.pageviews}</span>}
                  <div
                    className="awts-bar"
                    style={{ height: `${heightPct}%` }}
                    title={`${pt.label}: ${pt.pageviews} lượt truy cập`}
                  />
                  <span className="awts-bar-label">{pt.label}</span>
                </div>
              )
            })
          ) : (
            <div style={{ textAlign: 'center', width: '100%', color: '#94a3b8', padding: '30px 0' }}>
              Chưa có dữ liệu lượt truy cập trong khoảng thời gian này
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
