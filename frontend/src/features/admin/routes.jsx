import { Routes, Route, Navigate } from 'react-router-dom'
import ProtectedRoute from '../auth/components/ProtectedRoute.jsx'
import AdminLayout from './components/AdminLayout.jsx'
import DashboardPage from './pages/DashboardPage.jsx'
import UsersPage from './pages/users/UsersPage.jsx'
import UserCreatePage from './pages/users/UserCreatePage.jsx'
import UserEditPage from './pages/users/UserEditPage.jsx'
import DocumentsPage from './pages/documents/DocumentsPage.jsx'
import DocumentEditPage from './pages/documents/DocumentEditPage.jsx'
import AnalyticsPage from './pages/AnalyticsPage.jsx'

// Khu quản trị — toàn bộ nằm sau ProtectedRoute (role admin) + AdminLayout.
function AdminRoutes() {
  return (
    <ProtectedRoute role="admin">
      <Routes>
        <Route element={<AdminLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="users" element={<UsersPage />} />
          <Route path="users/new" element={<UserCreatePage />} />
          <Route path="users/:id/edit" element={<UserEditPage />} />
          <Route path="documents" element={<DocumentsPage />} />
          <Route path="documents/upload" element={<Navigate to="/admin/documents" replace />} />
          <Route path="documents/:id/edit" element={<DocumentEditPage />} />
          <Route path="analytics" element={<AnalyticsPage />} />
          {/* Trang "Chất lượng AI" đã gộp vào Thống kê — giữ redirect cho link cũ. */}
          <Route path="ai-quality" element={<Navigate to="/admin/analytics" replace />} />
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Route>
      </Routes>
    </ProtectedRoute>
  )
}

export default AdminRoutes
