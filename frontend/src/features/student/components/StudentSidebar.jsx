import { NavLink, Link } from 'react-router-dom'
import { useAuth } from '../../auth/context/AuthContext.jsx'
import {
  HomeIcon,
  BookOpenIcon,
  SparklesIcon,
  ArchiveIcon,
  UserIcon,
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

// Menu điều hướng chuẩn StudyMind cho sinh viên
const MENU = [
  { to: '/student', label: 'Trang chủ', icon: HomeIcon, end: true, tour: 'nav-home' },
  { to: '/student/classes', label: 'Lớp học', icon: BookOpenIcon, tour: 'nav-classes' },
  { to: '/student/chat', label: 'Sổ tay AI', icon: SparklesIcon, tour: 'nav-chat' },
  { to: '/student/library', label: 'Thư viện', icon: ArchiveIcon, tour: 'nav-library' },
  { to: '/student/settings', label: 'Hồ sơ', icon: UserIcon, tour: 'nav-settings' },
]

function StudentSidebar({ open = false, collapsed = false }) {
  const { user } = useAuth()
  const displayName = user?.name || user?.username || 'Sarah Carter'

  return (
    <aside className={'st-sidebar' + (open ? ' is-open' : '') + (collapsed ? ' is-collapsed' : '')}>
      {/* Top Brand Logo */}
      <Link to="/student" className="st-brand">
        <div className="st-brand-logo-box">
          <StudyMindMiniLogo size={18} />
        </div>
        <div className="st-brand-info">
          <span className="st-brand-title">StudyMind</span>
          <span className="st-brand-ai-badge">AI</span>
        </div>
      </Link>

      {/* Nav Menu */}
      <nav className="st-nav">
        {MENU.map(({ to, label, icon: Icon, end, tour }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            title={label}
            data-tour={tour}
            className={({ isActive }) => 'st-nav-link' + (isActive ? ' is-active' : '')}
          >
            <Icon size={20} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Card thông tin người dùng ở chân Sidebar */}
      <div className="st-sidebar-footer">
        <Link to="/student/settings" className="st-user-card" title="Xem hồ sơ">
          <div className="st-user-avatar">
            {displayName.charAt(0).toUpperCase()}
          </div>
          <div className="st-user-info">
            <div className="st-user-name" title={displayName}>
              {displayName}
            </div>
            <div className="st-user-role">SINH VIÊN</div>
          </div>
        </Link>
      </div>
    </aside>
  )
}

export default StudentSidebar
