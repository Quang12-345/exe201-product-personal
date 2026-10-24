import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { HOME_BY_ROLE } from '../services/authService'

// Bảo vệ route:
// - Chưa đăng nhập  -> về /login (nhớ trang đích).
// - Sai vai trò      -> về trang chủ đúng vai trò của người dùng.
function ProtectedRoute({ role, children }) {
  const { isAuthenticated, role: userRole } = useAuth()
  const location = useLocation()

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }
  if (role && userRole !== role) {
    return <Navigate to={HOME_BY_ROLE[userRole] || '/login'} replace />
  }
  return children
}

export default ProtectedRoute
