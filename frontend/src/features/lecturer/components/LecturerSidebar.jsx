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
