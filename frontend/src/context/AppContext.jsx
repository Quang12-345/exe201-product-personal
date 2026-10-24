import { createContext, useContext, useState } from 'react'

// Global state đơn giản bằng React Context.
// Khi app lớn hơn có thể thay bằng Redux / Zustand.
const AppContext = createContext(null)

export function AppProvider({ children }) {
  const [user, setUser] = useState(null)

  const value = { user, setUser }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

// Hook tiện ích để đọc context, kèm guard.
export function useApp() {
  const ctx = useContext(AppContext)
  if (ctx === null) {
    throw new Error('useApp phải được dùng bên trong <AppProvider>')
  }
  return ctx
}
