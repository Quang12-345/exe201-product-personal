import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { SearchIcon, MenuIcon } from '../../../components/common/icons.jsx'
import UserMenu from '../../auth/components/UserMenu.jsx'
import ThemeToggle from '../../theme/ThemeToggle.jsx'
import NotificationBell from '../../notifications/NotificationBell.jsx'

// Thanh trên cùng console vận hành: ô tìm kiếm + chuông + hồ sơ.
// `onMenu` mở drawer sidebar trên mobile.
function Topbar({ searchPlaceholder = 'Tìm kiếm tài liệu', onMenu, showSearch = true }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [term, setTerm] = useState('')
  const isUsersSection = location.pathname === '/admin/users' || location.pathname.startsWith('/admin/users/')
  const placeholder = isUsersSection ? 'Tìm kiếm người dùng' : searchPlaceholder

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    setTerm(params.get('q') || '')
  }, [location.pathname, location.search])

  // Gửi (Enter) → mở trang danh sách tương ứng với từ khóa áp vào bộ lọc.
  const submitSearch = (e) => {
    e.preventDefault()
    const target = isUsersSection ? '/admin/users' : '/admin/documents'
    const keyword = term.trim()
    navigate(keyword ? `${target}?q=${encodeURIComponent(keyword)}` : target)
  }

  const changeSearch = (e) => {
    const value = e.target.value
    setTerm(value)

    if (!isUsersSection) return
    const keyword = value.trim()
    navigate(keyword ? `/admin/users?q=${encodeURIComponent(keyword)}` : '/admin/users', { replace: true })
  }

  return (
    <header className="dmrs-topbar">
      <button className="dmrs-menu-btn" onClick={onMenu} aria-label="Mở menu">
        <MenuIcon size={22} />
      </button>
      {showSearch && (
        <form className="dmrs-search" onSubmit={submitSearch}>
          <SearchIcon size={18} />
          <input value={term} onChange={changeSearch} placeholder={placeholder} />
        </form>
      )}

      <div className="dmrs-topbar-right">
        <ThemeToggle className="dmrs-icon-btn" />
        <NotificationBell className="dmrs-icon-btn" />
        <span className="dmrs-topbar-divider" />
        <UserMenu subtitle="Quản trị viên" />
      </div>
    </header>
  )
}

export default Topbar
