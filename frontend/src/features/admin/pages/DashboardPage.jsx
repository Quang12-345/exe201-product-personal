import { useNavigate, Link } from 'react-router-dom'
import StatCard from '../components/StatCard.jsx'
import StatusBadge from '../components/StatusBadge.jsx'
import { useAsync } from '../hooks/useAsync.js'
import { getStatsOverview } from '../../../services/statsApi'
import {
  ArchiveIcon,
  UsersIcon,
  BarChartIcon,
  BotIcon,
  FolderIcon,
  FileTextIcon,
  GridIcon,
  ArrowRightIcon,
} from '../../../components/common/icons.jsx'

const CARD_CONFIG = {
  users: {
    icon: <UsersIcon size={18} />,
    variant: 'blue',
  },
  documents: {
    icon: <ArchiveIcon size={18} />,
    variant: 'yellow',
  },
  conversations: {
    icon: <BotIcon size={18} />,
    variant: 'purple',
  },
  queries: {
    icon: <BarChartIcon size={18} />,
    variant: 'red',
  },
}

const AI_STATUS = {
  ready: { variant: 'success', label: 'Đã lập chỉ mục', dot: true },
  queued: { variant: 'neutral', label: 'Chờ xử lý' },
  processing: { variant: 'warning', label: 'Đang xử lý' },
}

// Bảng điều khiển: tổng quan realtime + lối tắt sang các khu vực.
function DashboardPage() {
  const navigate = useNavigate()
  const { data, loading } = useAsync(getStatsOverview, [])

  if (loading) return <p className="dmrs-loading">Đang tải dữ liệu hệ thống...</p>

  const shortcuts = [
    {
      label: 'Kho tài liệu',
      desc: 'Toàn quyền mọi tài liệu & tệp đính kèm',
      icon: <FolderIcon size={22} />,
      to: '/admin/documents',
      color: '#3b66f5',
      bg: '#eff6ff',
    },
    {
      label: 'Người dùng',
      desc: 'Quản lý tài khoản, vai trò & gói Pro',
      icon: <UsersIcon size={22} />,
      to: '/admin/users',
      color: '#ca8a04',
      bg: '#fefce8',
    },
    {
      label: 'Thống kê & Đánh giá',
      desc: 'Truy vấn RAG, độ trễ & chất lượng AI',
      icon: <BarChartIcon size={22} />,
      to: '/admin/analytics',
      color: '#7c3aed',
      bg: '#f5f3ff',
    },
  ]

  return (
    <div style={{ maxWidth: 1240, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Page Header */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              backgroundColor: '#e0e7ff',
              border: '2px solid #000000',
              boxShadow: '2px 2px 0px #000000',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              color: '#3b66f5',
            }}
          >
            <GridIcon size={22} />
          </div>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 900, margin: 0, color: '#000000', letterSpacing: '-0.4px' }}>
              Vận hành hệ thống
            </h1>
            <p style={{ margin: '4px 0 0 0', fontSize: 13.5, color: '#4b5563', fontWeight: 500 }}>
              Tài khoản dev/ops — toàn quyền quản lý dữ liệu, kiểm soát tài khoản và chất lượng AI.
            </p>
          </div>
        </div>
      </div>

      {/* 4 Thẻ Stat Cards */}
      <div className="dmrs-stat-grid">
        {data.cards.map((c) => {
          const cfg = CARD_CONFIG[c.key] || { icon: <BarChartIcon size={18} />, variant: 'blue' }
          return (
            <StatCard
              key={c.key}
              label={c.label}
              value={c.value.toLocaleString()}
              icon={cfg.icon}
              variant={cfg.variant}
              note={c.note}
            />
          )
        })}
      </div>

      {/* Bảng: Tài liệu mới nhất */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: '#000000', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <FileTextIcon size={20} /> Tài liệu mới nhất
          </h2>
          <Link
            to="/admin/documents"
            style={{
              fontSize: 13.5,
              fontWeight: 800,
              color: '#2563eb',
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            Xem tất cả tài liệu <ArrowRightIcon size={14} />
          </Link>
        </div>

        <div className="dmrs-card dmrs-table-card" style={{ overflow: 'hidden' }}>
          <div className="dmrs-table-scroll">
            <table className="dmrs-table dmrs-table--nowrap">
              <thead>
                <tr>
                  <th>Tên tài liệu</th>
                  <th>Môn học</th>
                  <th>Chủ sở hữu</th>
                  <th>Trạng thái AI</th>
                </tr>
              </thead>
              <tbody>
                {data.recentDocuments.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="dmrs-muted" style={{ textAlign: 'center', padding: '36px 16px' }}>
                      Chưa có tài liệu nào trong hệ thống.
                    </td>
                  </tr>
                ) : (
                  data.recentDocuments.map((d) => {
                    const st = AI_STATUS[d.status] || AI_STATUS.queued
                    return (
                      <tr key={d.id} className="dmrs-clickable" onClick={() => navigate(`/admin/documents/${d.id}/edit`)}>
                        <td>
                          <div className="dmrs-doc-cell" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <span
                              style={{
                                width: 34,
                                height: 34,
                                borderRadius: 8,
                                backgroundColor: '#eff6ff',
                                border: '1.5px solid #000000',
                                color: '#2563eb',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                              }}
                            >
                              <FileTextIcon size={18} />
                            </span>
                            <strong style={{ fontSize: 14, color: '#000000' }}>{d.title}</strong>
                          </div>
                        </td>
                        <td>
                          {d.subject ? (
                            <span className="dmrs-subject-badge">{d.subject}</span>
                          ) : (
                            <span style={{ color: '#9ca3af' }}>—</span>
                          )}
                        </td>
                        <td>
                          <span style={{ fontWeight: 600, color: '#374151' }}>{d.owner || '—'}</span>
                        </td>
                        <td>
                          <StatusBadge variant={st.variant} dot={st.dot}>{st.label}</StatusBadge>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Truy cập nhanh */}
      <div>
        <h2 style={{ fontSize: 18, fontWeight: 800, color: '#000000', margin: '0 0 14px 0' }}>
          Truy cập nhanh
        </h2>
        <div className="dmrs-shortcut-grid">
          {shortcuts.map((s) => (
            <button
              key={s.to}
              className="dmrs-shortcut"
              onClick={() => navigate(s.to)}
              style={{
                transition: 'transform 0.12s ease, box-shadow 0.12s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translate(-2px, -2px)'
                e.currentTarget.style.boxShadow = `5px 5px 0px ${s.color}`
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translate(0px, 0px)'
                e.currentTarget.style.boxShadow = '3px 3px 0px #000000'
              }}
            >
              <span
                className="dmrs-shortcut-icon"
                style={{
                  backgroundColor: s.bg,
                  color: s.color,
                  border: '1.8px solid #000000',
                  boxShadow: '1.5px 1.5px 0px #000000',
                }}
              >
                {s.icon}
              </span>
              <span className="dmrs-shortcut-text">
                <strong style={{ fontSize: 15 }}>{s.label}</strong>
                <span>{s.desc}</span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

export default DashboardPage
