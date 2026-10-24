import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { SearchIcon, HelpIcon, MenuIcon } from '../../../components/common/icons.jsx'
import UserMenu from '../../auth/components/UserMenu.jsx'
import ThemeToggle from '../../theme/ThemeToggle.jsx'
import NotificationBell from '../../notifications/NotificationBell.jsx'

// Mở lại tour hướng dẫn cho đúng trang đang xem.
function openGuide() {
  window.dispatchEvent(new CustomEvent('dmrs:start-tour', { detail: { manual: true } }))
}

// Thanh trên cùng khu giảng viên.
function LecturerTopbar({ searchPlaceholder = 'Tìm kiếm tài liệu, bài giảng...', onMenu }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [term, setTerm] = useState('')
  const isDashboard = location.pathname === '/lecturer'
  const isDocs = location.pathname.startsWith('/lecturer/documents')

  // Gửi (Enter) → mở Kho tài liệu giảng viên với từ khóa áp vào bộ lọc.
  const submitSearch = (e) => {
    e.preventDefault()
    navigate('/lecturer/documents?q=' + encodeURIComponent(term.trim()))
  }

  return (
    <header className="lec-topbar">
      <button className="lec-menu-btn" onClick={onMenu} aria-label="Mở menu">
        <MenuIcon size={22} />
      </button>

      {!isDocs && (
        <form className="dmrs-search lec-search" onSubmit={submitSearch}>
          <SearchIcon size={18} />
          <input value={term} onChange={(e) => setTerm(e.target.value)} placeholder={searchPlaceholder} />
        </form>
      )}

      <div className="lec-topbar-right">
        <ThemeToggle className="lec-icon-btn" />
        <NotificationBell className="lec-icon-btn" />
        <button
          className="lec-icon-btn"
          aria-label="Hướng dẫn trang này"
          title="Hướng dẫn trang này"
          onClick={openGuide}
        >
          <HelpIcon size={20} />
        </button>
        <span className="lec-topbar-divider" />
        <UserMenu subtitle="Giảng viên" />
      </div>
    </header>
  )
}

export default LecturerTopbar
