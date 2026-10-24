import { useState, useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import Sidebar from './Sidebar.jsx'
import Topbar from './Topbar.jsx'
import '../styles/admin.css'

// Console vận hành (dev/ops): toàn quyền, không onboarding sản phẩm.
function AdminLayout() {
  const location = useLocation()
  const [navOpen, setNavOpen] = useState(false)
  const showTopSearch = !location.pathname.startsWith('/admin/documents')

  // Đóng drawer mỗi khi chuyển trang (trên mobile).
  useEffect(() => {
    setNavOpen(false)
  }, [location.pathname])

  return (
    <div className="dmrs-layout">
      <Sidebar open={navOpen} />
      {navOpen && <div className="dmrs-overlay" onClick={() => setNavOpen(false)} />}
      <div className="dmrs-main">
        <Topbar onMenu={() => setNavOpen(true)} showSearch={showTopSearch} />
        <main className="dmrs-content">
          {/* key theo route => animation chạy lại mỗi lần chuyển trang */}
          <div key={location.pathname} className="dmrs-page-anim">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}

export default AdminLayout
