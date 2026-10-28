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
    <svg width={size} height={size} viewBox="0 0 512 512" fill="none">
      <path
        d="M 153.52 51.44 H 356.87 V 75.55 A 186.18 186.18 0 0 0 177.63 255.60 H 153.52 Z"
        fill="#FFFFFF"
      />
      <path
        d="M 356.87 460.56 H 153.52 V 436.45 A 186.18 186.18 0 0 0 332.76 256.40 H 356.87 Z"
        fill="#FFFFFF"
      />
      <path
        d="M 290.96 166.38 L 307.84 166.38 L 289.36 204.16 C 293.05 205.60, 271.59 233.66, 317.49 243.54 L 310.25 258.01 C 253.03 270.63, 258.01 284.77, 243.54 298.20 L 224.25 335.17 L 207.37 335.17 L 225.86 297.39 C 222.16 295.95, 243.62 267.90, 197.73 258.01 L 204.96 243.54 C 262.19 230.92, 257.21 216.78, 271.67 203.35 Z"
        fill="#FFFFFF"
      />
    </svg>
  );
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
