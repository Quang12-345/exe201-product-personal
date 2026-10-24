import { useLocation } from 'react-router-dom'
import { HelpIcon, MenuIcon } from '../../../components/common/icons.jsx'
import UserMenu from '../../auth/components/UserMenu.jsx'
import ThemeToggle from '../../theme/ThemeToggle.jsx'
import NotificationBell from '../../notifications/NotificationBell.jsx'

// Mở lại tour hướng dẫn cho đúng trang đang xem.
function openGuide() {
  window.dispatchEvent(new CustomEvent('dmrs:start-tour', { detail: { manual: true } }))
}

// Thanh trên cùng khu sinh viên: nút thu gọn menu + chuông + trợ giúp + hồ sơ.
function StudentTopbar({ onMenu, onToggle }) {
  const location = useLocation()
  const isDashboard = location.pathname === '/student'

  return (
    <header className={`st-topbar ${isDashboard ? 'st-topbar--dashboard' : ''}`}>
      {/* Desktop: thu gọn/mở sidebar (ẩn trên dashboard để giữ layout thoáng) */}
      {!isDashboard && (
        <button className="st-collapse-btn" onClick={onToggle} aria-label="Thu gọn menu">
          <MenuIcon size={22} />
        </button>
      )}
      {/* Mobile: mở drawer */}
      <button className="st-menu-btn" onClick={onMenu} aria-label="Mở menu">
        <MenuIcon size={22} />
      </button>

      <div className="st-topbar-right">
        <ThemeToggle className="st-icon-btn" />
        <NotificationBell className="st-icon-btn" />
        {/* Nút Trợ giúp */}
        <button
          className="st-icon-btn"
          aria-label="Hướng dẫn trang này"
          title="Hướng dẫn trang này"
          onClick={openGuide}
        >
          <HelpIcon size={20} />
        </button>
        {!isDashboard && (
          <>
            <span className="st-topbar-divider" />
            <UserMenu subtitle="Sinh viên" />
          </>
        )}
      </div>
    </header>
  )
}

export default StudentTopbar
