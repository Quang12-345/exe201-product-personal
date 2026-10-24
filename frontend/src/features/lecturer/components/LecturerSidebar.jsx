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

// Menu điều hướng chuẩn StudyMind cho giảng viên (khớp 100% với thiết kế mẫu)
const MENU = [
  { to: '/lecturer', label: 'Trang chủ', icon: HomeIcon, end: true, tour: 'nav-home' },
  { to: '/lecturer/classes', label: 'Lớp học', icon: BookOpenIcon, tour: 'nav-classes' },
  { to: '/lecturer/chat', label: 'Sổ tay AI', icon: SparklesIcon, tour: 'nav-chat' },
  { to: '/lecturer/documents', label: 'Thư viện', icon: ArchiveIcon, tour: 'nav-library' },
  { to: '/lecturer/settings', label: 'Hồ sơ', icon: UserIcon, tour: 'nav-settings' },
]

function LecturerSidebar({ open = false, collapsed = false }) {
  const { user } = useAuth()
  const rawName = user?.name || user?.username || 'GS. Jenkins'
  const displayName = rawName.includes('GS.') || rawName.includes('ThS.') || rawName.includes('TS.')
    ? rawName
    : `GS. ${rawName}`

  const avatarChar = displayName.replace(/^(GS\.|ThS\.|TS\.)\s*/, '').trim().charAt(0).toUpperCase() || 'J'

  return (
    <aside className={'lec-sidebar' + (open ? ' is-open' : '') + (collapsed ? ' is-collapsed' : '')}>
      {/* Top Brand Logo */}
      <Link to="/lecturer" className="lec-brand">
        <div className="lec-brand-logo-box">
          <StudyMindMiniLogo size={18} />
        </div>
        <div className="lec-brand-info">
          <span className="lec-brand-title">StudyMind</span>
          <span className="lec-brand-ai-badge">AI</span>
        </div>
      </Link>

      {/* Nav Menu */}
      <nav className="lec-nav">
        {MENU.map(({ to, label, icon: Icon, end, tour }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            title={label}
            data-tour={tour}
            className={({ isActive }) => 'lec-nav-link' + (isActive ? ' is-active' : '')}
          >
            <Icon size={20} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Card thông tin giảng viên ở chân Sidebar */}
      <div className="lec-sidebar-footer">
        <Link to="/lecturer/settings" className="lec-user-card" title="Xem hồ sơ giảng viên">
          <div className="lec-user-avatar">
            {avatarChar}
          </div>
          <div className="lec-user-info">
            <div className="lec-user-name" title={displayName}>
              {displayName}
            </div>
            <div className="lec-user-role">GIẢNG VIÊN</div>
          </div>
        </Link>
      </div>
    </aside>
  )
}

export default LecturerSidebar
