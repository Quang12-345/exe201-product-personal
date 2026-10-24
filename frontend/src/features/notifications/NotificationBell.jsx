import { BellIcon } from '../../components/common/icons.jsx'
import { comingSoon } from '../../components/common/comingSoon.jsx'
import './NotificationBell.css'

// Chuông thông báo: tính năng chưa làm xong → click hiện toast "đang phát triển"
// thay vì mở panel. `className` để khớp icon-button của từng topbar (dmrs-/st-).
function NotificationBell({ className = 'dmrs-icon-btn' }) {
  return (
    <button
      type="button"
      className={className}
      onClick={() => comingSoon('Thông báo đang được phát triển 🚧')}
      aria-label="Thông báo"
    >
      <BellIcon size={20} />
    </button>
  )
}

export default NotificationBell
