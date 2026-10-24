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
