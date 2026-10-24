import { useState, useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import LecturerSidebar from './LecturerSidebar.jsx'
import LecturerTopbar from './LecturerTopbar.jsx'
import OnboardingModal from '../../../components/common/OnboardingModal.jsx'
import GuidedTour from '../../../components/common/GuidedTour.jsx'
import { LECTURER_OVERVIEW, LECTURER_TOURS } from '../tours.js'
import '../../admin/styles/admin.css'
import '../styles/lecturer.css'

// Khung khu giảng viên: Sidebar StudyMind + Topbar + nội dung + animation chuyển trang.
function LecturerLayout() {
  const location = useLocation()
  const [navOpen, setNavOpen] = useState(false)

  useEffect(() => {
    setNavOpen(false)
  }, [location.pathname])

  return (
    <div className="lec-layout dmrs-layout">
      <LecturerSidebar open={navOpen} />
      {navOpen && <div className="lec-overlay dmrs-overlay" onClick={() => setNavOpen(false)} />}
      <div className="lec-main dmrs-main">
        <LecturerTopbar onMenu={() => setNavOpen(true)} />
        <main className="lec-content dmrs-content">
          <div key={location.pathname} className="lec-page-anim dmrs-page-anim">
            <Outlet />
          </div>
        </main>
      </div>
      <OnboardingModal role="lecturer" />
      <GuidedTour overview={LECTURER_OVERVIEW} tours={LECTURER_TOURS} storageKey="dmrs_tour_lecturer" welcomeKey="dmrs_onboarded_lecturer" />
    </div>
  )
}

export default LecturerLayout
