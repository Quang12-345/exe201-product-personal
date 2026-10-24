import { AppProvider } from './context/AppContext.jsx'
import { ThemeProvider } from './features/theme/ThemeContext.jsx'
import { AuthProvider } from './features/auth/context/AuthContext.jsx'
import AppRoutes from './routes/AppRoutes.jsx'
import ComingSoonToast from './components/common/comingSoon.jsx'
import NotificationToast from './components/common/toast.jsx'
import ConfirmDialogHost from './components/common/confirmDialog.jsx'

// Component gốc: bọc app trong các Provider rồi render routes.
// ThemeProvider: giao diện sáng/tối. AuthProvider: phiên đăng nhập theo vai trò.
function App() {
  return (
    <ThemeProvider>
      <AppProvider>
        <AuthProvider>
          <AppRoutes />
          {/* Mount 1 lần ở gốc để toast comingSoon() hiện được ở mọi trang/role.
              Đừng xóa nếu còn nút gọi comingSoon() — bỏ đi thì bấm nút sẽ im lặng. */}
          <ComingSoonToast />
          {/* Toast thông báo dùng chung (thay window.alert) — mount 1 lần ở gốc. */}
          <NotificationToast />
          {/* Modal xác nhận dùng chung (thay window.confirm) — mount 1 lần ở gốc. */}
          <ConfirmDialogHost />
        </AuthProvider>
      </AppProvider>
    </ThemeProvider>
  )
}

export default App
