import { Routes, Route, Navigate } from 'react-router-dom'
import LoginPage from '../features/auth/pages/LoginPage.jsx'
import ForgotPasswordPage from '../features/auth/pages/ForgotPasswordPage.jsx'
import UpdatePasswordPage from '../features/auth/pages/UpdatePasswordPage.jsx'
import AdminRoutes from '../features/admin/routes.jsx'
import StudentRoutes from '../features/student/routes.jsx'
import LecturerRoutes from '../features/lecturer/routes.jsx'
import PaymentSuccessPage from '../features/student/pages/PaymentSuccessPage.jsx'
import PaymentCancelPage from '../features/student/pages/PaymentCancelPage.jsx'

// Routing cấp ứng dụng:
// - Trang công khai: /login, /register, /forgot-password, /payment/success, /payment/cancel
// - Khu vực theo vai trò: /admin/*, /student/*, /lecturer/*
function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/update-password" element={<UpdatePasswordPage />} />
      <Route path="/payment/success" element={<PaymentSuccessPage />} />
      <Route path="/payment/cancel" element={<PaymentCancelPage />} />
      <Route path="/admin/*" element={<AdminRoutes />} />
      <Route path="/student/*" element={<StudentRoutes />} />
      <Route path="/lecturer/*" element={<LecturerRoutes />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}

export default AppRoutes
