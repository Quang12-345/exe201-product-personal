import { NavLink, Link } from 'react-router-dom'
import { useAuth } from '../../auth/context/AuthContext.jsx'
import {
  GridIcon,
  UsersIcon,
  FolderIcon,
  BarChartIcon,
} from '../../../components/common/icons.jsx'

// Biểu tượng tia sét StudyMind
function StudyMindMiniLogo({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path
        d="M13 2.5L5.5 13H11.5L9.5 22L18.5 10.5H12.5L14.5 2.5H13Z"
        fill="#FFFFFF"
        stroke="#FFFFFF"
        strokeWidth="0.8"
        strokeLinejoin="round"
      />
    </svg>
  )
}

// Mục điều hướng — chuẩn StudyMind Admin
const MENU = [
  { to: '/admin', label: 'Bảng điều khiển', icon: GridIcon, end: true },
  { to: '/admin/users', label: 'Quản lý người dùng', icon: UsersIcon },
  { to: '/admin/documents', label: 'Kho tài liệu', icon: FolderIcon },
  { to: '/admin/analytics', label: 'Thống kê & Chất lượng AI', icon: BarChartIcon },
]

function Sidebar({ open = false }) {
  const { user } = useAuth()
  const displayName = user?.name || user?.username || 'Quản trị viên'
  const avatarChar = displayName.charAt(0).toUpperCase() || 'A'

  return (
    <aside className={'dmrs-sidebar' + (open ? ' is-open' : '')}>
      {/* Top Brand Logo */}
      <Link to="/admin" className="dmrs-brand">
        <div className="dmrs-brand-logo-box">
          <StudyMindMiniLogo size={18} />
        </div>
        <div className="dmrs-brand-info">
          <span className="dmrs-brand-title">StudyMind</span>
          <span className="dmrs-brand-admin-badge">ADMIN</span>
        </div>
      </Link>

      {/* Nav Menu */}
      <nav className="dmrs-nav">
        {MENU.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            data-tour={to}
            className={({ isActive }) => 'dmrs-nav-link' + (isActive ? ' is-active' : '')}
          >
            <Icon size={20} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Footer user card */}
      <div className="dmrs-sidebar-footer">
        <div className="dmrs-user-card" title="Tài khoản quản trị viên">
          <div className="dmrs-user-avatar">
            {avatarChar}
          </div>
          <div className="dmrs-user-info">
            <div className="dmrs-user-name" title={displayName}>
              {displayName}
            </div>
            <div className="dmrs-user-role">QUẢN TRỊ VIÊN</div>
          </div>
        </div>
      </div>
    </aside>
  )
}

export default Sidebar
