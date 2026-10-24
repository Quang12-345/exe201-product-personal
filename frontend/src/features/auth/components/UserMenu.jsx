import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { ChevronDownIcon, LogOutIcon } from '../../../components/common/icons.jsx'
import './UserMenu.css'

const ROLE_LABEL = { admin: 'Vận hành', student: 'Sinh viên', lecturer: 'Giảng viên' }
const PROFILE_PATH_BY_ROLE = { student: '/student/settings', lecturer: '/lecturer/settings' }

function initials(name = 'User') {
  return name.split(' ').slice(-2).map((w) => w[0]).join('').toUpperCase()
}

// Hồ sơ người dùng + menu đăng xuất, dùng chung cho mọi topbar.
// `subtitle` ghi đè dòng phụ (mặc định theo vai trò).
function UserMenu({ subtitle }) {
  const { user, role, logout } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)

  const name = user?.name || 'Người dùng'
  const sub = subtitle ?? ROLE_LABEL[role] ?? ''

  const handleProfile = () => {
    setOpen(false)
    if (role === 'admin' && user?.id) {
      navigate(`/admin/users/${user.id}/edit`)
      return
    }
    navigate(PROFILE_PATH_BY_ROLE[role] || '/')
  }

  const handleLogout = () => {
    setOpen(false)
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="um">
      <button className="um-trigger" onClick={() => setOpen((o) => !o)}>
        <div className="um-meta">
          <strong>{name}</strong>
          {sub && <span>{sub}</span>}
        </div>
        <div className="um-avatar">{initials(name)}</div>
        <ChevronDownIcon size={16} />
      </button>

      {open && (
        <>
          <div className="um-backdrop" onClick={() => setOpen(false)} />
          <div className="um-menu">
            <button className="um-menu-head" onClick={handleProfile}>
              <strong>{name}</strong>
              {sub && <span>{sub}</span>}
            </button>
            <button className="um-menu-item" onClick={handleLogout}>
              <LogOutIcon size={18} /> Đăng xuất
            </button>
          </div>
        </>
      )}
    </div>
  )
}

export default UserMenu
