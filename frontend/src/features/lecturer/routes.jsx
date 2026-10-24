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

// Khu giảng viên — nằm sau ProtectedRoute (role lecturer) + LecturerLayout.
function LecturerRoutes() {
  return (
    <ProtectedRoute role="lecturer">
      <Routes>
        <Route element={<LecturerLayout />}>
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
    </ProtectedRoute>
  )
}

export default LecturerRoutes
