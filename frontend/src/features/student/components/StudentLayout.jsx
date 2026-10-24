import { useState, useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import StudentSidebar from './StudentSidebar.jsx'
import StudentTopbar from './StudentTopbar.jsx'
import OnboardingModal from '../../../components/common/OnboardingModal.jsx'
import GuidedTour from '../../../components/common/GuidedTour.jsx'
import { STUDENT_OVERVIEW, STUDENT_TOURS } from '../tours.js'
import '../styles/student.css'

// Khung khu sinh viên: Sidebar + Topbar + nội dung (Outlet) + animation chuyển trang.
function StudentLayout() {
  const location = useLocation()
  const [navOpen, setNavOpen] = useState(false) // drawer mobile
  const [collapsed, setCollapsed] = useState(false) // thu gọn sidebar (desktop)

  useEffect(() => {
    setNavOpen(false)
  }, [location.pathname])

  return (
    <div className="st-layout">
      <StudentSidebar open={navOpen} collapsed={collapsed} />
      {navOpen && <div className="st-overlay" onClick={() => setNavOpen(false)} />}
      <div className="st-main">
        <StudentTopbar onMenu={() => setNavOpen(true)} onToggle={() => setCollapsed((c) => !c)} />
        <main className="st-content">
          <div key={location.pathname} className="st-page-anim">
            <Outlet />
          </div>
        </main>
      </div>
      <OnboardingModal role="student" />
      <GuidedTour
        overview={STUDENT_OVERVIEW}
        tours={STUDENT_TOURS}
        storageKey="dmrs_tour_student"
        welcomeKey="dmrs_onboarded_student"
        enabled={location.pathname === '/student/chat'}
      />
    </div>
  )
}

export default StudentLayout
