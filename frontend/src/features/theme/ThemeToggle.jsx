import { useTheme } from './ThemeContext.jsx'
import { SunIcon, MoonIcon } from '../../components/common/icons.jsx'

// Nút đổi giao diện sáng/tối. `className` để khớp style icon-button của từng topbar.
function ThemeToggle({ className = 'dmrs-icon-btn' }) {
  const { theme, toggle } = useTheme()
  const dark = theme === 'dark'
  return (
    <button
      className={className}
      onClick={toggle}
      aria-label={dark ? 'Chuyển sang chế độ sáng' : 'Chuyển sang chế độ tối'}
      title={dark ? 'Chế độ sáng' : 'Chế độ tối'}
    >
      {dark ? <SunIcon size={20} /> : <MoonIcon size={20} />}
    </button>
  )
}

export default ThemeToggle
