import { Routes, Route, Navigate } from 'react-router-dom'
import ProtectedRoute from '../auth/components/ProtectedRoute.jsx'
import LecturerLayout from './components/LecturerLayout.jsx'
import DashboardPage from './pages/DashboardPage.jsx'
import DocumentsPage from './pages/DocumentsPage.jsx'
import DocumentUploadPage from './pages/DocumentUploadPage.jsx'
import DocumentEditPage from './pages/DocumentEditPage.jsx'
import ChatPage from './pages/ChatPage.jsx'
import SettingsPage from './pages/SettingsPage.jsx'
import StudentsPage from './pages/StudentsPage.jsx'
import ClassesPage from './pages/ClassesPage.jsx'
import ClassroomDetailPage from './pages/ClassroomDetailPage.jsx'
import ExamsPage from './pages/ExamsPage.jsx'
import PaymentSuccessPage from '../student/pages/PaymentSuccessPage.jsx'
import PaymentCancelPage from '../student/pages/PaymentCancelPage.jsx'

// Khu giảng viên:
// - Trang biên nhận thanh toán mở công khai để PayOS/VNPay redirect về mượt mà
// - Các trang học vụ nằm sau ProtectedRoute (role lecturer) + LecturerLayout
function LecturerRoutes() {
  return (
    <Routes>
      <Route path="payment/success" element={<PaymentSuccessPage />} />
      <Route path="payment/cancel" element={<PaymentCancelPage />} />

      <Route
        element={
          <ProtectedRoute role="lecturer">
            <LecturerLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="classes" element={<ClassesPage />} />
        <Route path="classes/:id" element={<ClassroomDetailPage />} />
        <Route path="students" element={<StudentsPage />} />
        <Route path="exams" element={<ExamsPage />} />
        <Route path="documents" element={<DocumentsPage />} />
        <Route path="documents/upload" element={<DocumentUploadPage />} />
        <Route path="documents/:id/edit" element={<DocumentEditPage />} />
        <Route path="chat" element={<ChatPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/lecturer" replace />} />
      </Route>
    </Routes>
  )
}

export default LecturerRoutes
