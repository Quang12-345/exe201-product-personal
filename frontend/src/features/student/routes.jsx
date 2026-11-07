import { Routes, Route, Navigate } from 'react-router-dom'
import ProtectedRoute from '../auth/components/ProtectedRoute.jsx'
import StudentLayout from './components/StudentLayout.jsx'
import StudentDashboardPage from './pages/StudentDashboardPage.jsx'
import ChatPage from './pages/ChatPage.jsx'
import SavedAnswersPage from './pages/SavedAnswersPage.jsx'
import LibraryPage from './pages/LibraryPage.jsx'
import LibraryFieldPage from './pages/LibraryFieldPage.jsx'
import StudentClassesPage from './pages/StudentClassesPage.jsx'
import StudentClassroomDetailPage from './pages/StudentClassroomDetailPage.jsx'
import SettingsPage from './pages/SettingsPage.jsx'
import StudyPage from './pages/StudyPage.jsx'
import StudentExamsPage from './pages/StudentExamsPage.jsx'
import PaymentSuccessPage from './pages/PaymentSuccessPage.jsx'
import PaymentCancelPage from './pages/PaymentCancelPage.jsx'

// Khu sinh viên:
// - Trang biên nhận thanh toán (payment/success, payment/cancel) mở công khai để PayOS redirect về mượt mà
// - Các trang học vụ nằm sau ProtectedRoute (role student) + StudentLayout
function StudentRoutes() {
  return (
    <Routes>
      {/* Trang kết quả thanh toán / Hóa đơn điện tử */}
      <Route path="payment/success" element={<PaymentSuccessPage />} />
      <Route path="payment/cancel" element={<PaymentCancelPage />} />

      {/* Khu vực học tập chính */}
      <Route
        element={
          <ProtectedRoute role="student">
            <StudentLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<StudentDashboardPage />} />
        <Route path="classes" element={<StudentClassesPage />} />
        <Route path="classes/:id" element={<StudentClassroomDetailPage />} />
        <Route path="exams" element={<StudentExamsPage />} />
        <Route path="chat" element={<ChatPage />} />
        <Route path="chat/saved" element={<SavedAnswersPage />} />
        <Route path="library" element={<LibraryPage />} />
        <Route path="library/:fieldId" element={<LibraryFieldPage />} />
        <Route path="study" element={<StudyPage />} />
        <Route path="study/:docId" element={<StudyPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/student" replace />} />
      </Route>
    </Routes>
  )
}

export default StudentRoutes
