import { createContext, useContext, useState, useEffect } from 'react'

// Quản lý giao diện sáng/tối cho toàn app (mọi vai trò).
// Lưu localStorage + gắn data-theme lên <html> để CSS override.
const ThemeContext = createContext(null)
const KEY = 'dmrs_theme'

function initialTheme() {
  try {
    const saved = localStorage.getItem(KEY)
    if (saved === 'light' || saved === 'dark') return saved
  } catch {
    /* ignore */
  }
  return 'light'
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(initialTheme)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    try {
      localStorage.setItem(KEY, theme)
    } catch {
      /* ignore */
    }
  }, [theme])

  const toggle = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))

  return <ThemeContext.Provider value={{ theme, toggle, setTheme }}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (ctx === null) throw new Error('useTheme phải dùng trong <ThemeProvider>')
  return ctx
}
