import Header from '../components/layout/Header.jsx'
import { Button } from '../components/common'

// Component cấp trang: lắp ráp layout + component con. Logic đẩy xuống hook/service.
function HomePage() {
  return (
    <div>
      <Header />
      <main>
        <p>Chào mừng đến C2 App 👋</p>
        <Button onClick={() => alert('Hello!')}>Bắt đầu</Button>
      </main>
    </div>
  )
}

export default HomePage
