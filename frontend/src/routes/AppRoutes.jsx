import { Routes, Route, Navigate } from 'react-router-dom'
import LoginPage from '../features/auth/pages/LoginPage.jsx'
import ForgotPasswordPage from '../features/auth/pages/ForgotPasswordPage.jsx'
import UpdatePasswordPage from '../features/auth/pages/UpdatePasswordPage.jsx'
import AdminRoutes from '../features/admin/routes.jsx'
import StudentRoutes from '../features/student/routes.jsx'
import LecturerRoutes from '../features/lecturer/routes.jsx'

// Routing cấp ứng dụng:
// - Trang công khai: /login, /register, /forgot-password
// - Khu vực theo vai trò: /admin/* và /student/* (ủy quyền cho router của từng feature)
function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/update-password" element={<UpdatePasswordPage />} />
      <Route path="/admin/*" element={<AdminRoutes />} />
      <Route path="/student/*" element={<StudentRoutes />} />
      <Route path="/lecturer/*" element={<LecturerRoutes />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}

export default AppRoutes
