import { createContext, useContext, useState } from 'react'
import * as authService from '../services/authService'

// Quản lý phiên đăng nhập cho toàn app (mọi vai trò).
const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(() => authService.getStoredSession())

  const login = async (credentials) => {
    const s = await authService.login(credentials)
    setSession(s)
    return s
  }

  // Đăng nhập bằng Google: xác minh credential rồi cập nhật phiên vào context
  // (nếu chỉ lưu localStorage mà không setSession thì route bảo vệ vẫn coi là chưa đăng nhập).
  const loginWithGoogle = async (credential) => {
    const s = await authService.gmailLogin(credential)
    setSession(s)
    return s
  }

  const logout = () => {
    authService.logout()
    setSession(null)
  }

  const updateCurrentUser = (updates) => {
    setSession((current) => {
      if (!current?.user) return current
      const next = { ...current, user: { ...current.user, ...updates } }
      authService.saveSession(next)
      return next
    })
  }

  const value = {
    user: session?.user ?? null,
    role: session?.user?.role ?? null,
    isAuthenticated: !!session,
    login,
    loginWithGoogle,
    updateCurrentUser,
    logout,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (ctx === null) {
    throw new Error('useAuth phải được dùng bên trong <AuthProvider>')
  }
  return ctx
}
