import { useState, useEffect } from 'react'
import { useParams, useNavigate, useSearchParams, useLocation } from 'react-router-dom'
import {
  fetchDocumentFlashcards,
  fetchDocumentQuizzes,
  fetchMyQuizAttempts,
} from '../services/studyService'
import { getEnrolledClassrooms, getClassroomDocuments } from '../services/classroomService'
import { getBillingStatus, reconcileProPayment, startProCheckout } from '../services/billingService'
import FlashcardViewer from '../components/FlashcardViewer.jsx'
import QuizPlayer from '../components/QuizPlayer.jsx'
import { SparklesIcon, GraduationCapIcon, BookOpenIcon } from '../../../components/common/icons.jsx'
import { notify } from '../../../components/common/toast.jsx'
import { formatDate } from '../../../utils/index.js'
import '../styles/study.css'

export default function StudyPage() {
  const { docId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()

  const [classrooms, setClassrooms] = useState([])
  const [classesLoading, setClassesLoading] = useState(true)
  const [selectedClassId, setSelectedClassId] = useState(location.state?.classroomId || '')

  const [documents, setDocuments] = useState([])
  const [docsLoading, setDocsLoading] = useState(false)
  const [selectedDocId, setSelectedDocId] = useState(docId || '')
  
  const tabFromUrl = searchParams.get('tab') || location.state?.tab
  const [activeTab, setActiveTab] = useState(
    tabFromUrl && ['flashcards', 'quiz', 'attempts'].includes(tabFromUrl) ? tabFromUrl : 'flashcards'
  )

  useEffect(() => {
    const currentTab = searchParams.get('tab') || location.state?.tab
    if (currentTab && ['flashcards', 'quiz', 'attempts'].includes(currentTab)) {
      setActiveTab(currentTab)
    }
  }, [searchParams, location.state])

  const handleTabChange = (tabName) => {
    setActiveTab(tabName)
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      next.set('tab', tabName)
      return next
    }, { replace: true })
  }

  const [billing, setBilling] = useState(null)
  const [billingLoading, setBillingLoading] = useState(true)
  const [checkoutBusy, setCheckoutBusy] = useState(false)

  const paymentResult = searchParams.get('payment')
  const paymentOrderCode = searchParams.get('order_code') || billing?.pending_order_code
  const [paymentCheckBusy, setPaymentCheckBusy] = useState(false)
  const [paymentCheckStatus, setPaymentCheckStatus] = useState(null)
  const [paymentCheckError, setPaymentCheckError] = useState('')

  const [flashcards, setFlashcards] = useState([])
  const [quizzes, setQuizzes] = useState([])
  const [attempts, setAttempts] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let isMounted = true
    getBillingStatus()
      .then((data) => {
        if (isMounted) setBilling(data)
      })
      .catch(() => {})
      .finally(() => {
        if (isMounted) setBillingLoading(false)
      })
    return () => { isMounted = false }
  }, [])

  const checkPayment = async () => {
    if (!paymentOrderCode || paymentCheckBusy) return
    setPaymentCheckError('')
    setPaymentCheckBusy(true)
    try {
      const result = await reconcileProPayment(paymentOrderCode)
      setPaymentCheckStatus(result.status)
      if (result.status === 'paid') {
        const nextBilling = await getBillingStatus()
        setBilling(nextBilling)
      }
    } catch (error) {
      const detail = error?.response?.data?.detail
      setPaymentCheckError(typeof detail === 'string' ? detail : detail?.message || 'Chưa kiểm tra được giao dịch VNPay.')
    } finally {
      setPaymentCheckBusy(false)
    }
  }

  useEffect(() => {
    if (paymentResult !== 'pending') return undefined
    let attempts = 0
    const timer = window.setInterval(async () => {
      attempts += 1
      try {
        const status = await getBillingStatus()
        setBilling(status)
        if (status.is_pro || attempts >= 20) window.clearInterval(timer)
      } catch {
        if (attempts >= 20) window.clearInterval(timer)
      }
    }, 3000)
    return () => window.clearInterval(timer)
  }, [paymentResult])

  const handleBuyPro = async () => {
    setCheckoutBusy(true)
    try {
      const returnTo = `${location.pathname}${location.search || `?tab=${activeTab}`}`
      const res = await startProCheckout(returnTo)
      const redirectUrl = res?.checkout_url || res?.payment_url
      if (redirectUrl) {
        window.location.assign(redirectUrl)
      } else {
        notify('Không lấy được link thanh toán VNPay', 'error')
      }
    } catch (err) {
      const detail = err.response?.data?.detail
      notify(typeof detail === 'string' ? detail : detail?.message || 'Lỗi khi kết nối VNPay', 'error')
    } finally {
      setCheckoutBusy(false)
    }
  }

  const isPro = Boolean(billing?.is_pro)

  useEffect(() => {
    if (!billingLoading && billing && !billing.is_pro) {
      setFlashcards([])
      setQuizzes([])
      setAttempts([])
    }
  }, [billing, billingLoading])

  // 1. Tải danh sách lớp học mà sinh viên đã vào
  useEffect(() => {
    let isMounted = true
    setClassesLoading(true)

    getEnrolledClassrooms()
      .then(async (enrolled) => {
        if (!isMounted) return
        const classes = enrolled || []
        setClassrooms(classes)

        if (classes.length === 0) {
          setSelectedClassId('')
          setDocuments([])
          setSelectedDocId('')
          setClassesLoading(false)
          return
        }

        // Tìm lớp thích hợp:
        // - Ưu tiên location.state?.classroomId nếu khớp
        // - Nếu có docId trên URL, tìm xem docId thuộc lớp nào
        let targetClassId = location.state?.classroomId
        let targetDocs = []

        if (targetClassId && classes.some((c) => c.id === targetClassId)) {
          // targetClassId hợp lệ
        } else {
          targetClassId = ''
        }

        if (docId && !targetClassId) {
          for (const c of classes) {
            try {
              const dList = await getClassroomDocuments(c.id)
              if (dList.some((d) => d.id === docId)) {
                targetClassId = c.id
                targetDocs = dList
                break
              }
            } catch {
              /* ignore */
            }
          }
        }

        if (!targetClassId) {
          targetClassId = classes[0].id
        }

        setSelectedClassId(targetClassId)
        setClassesLoading(false)

        // Tải danh sách tài liệu của lớp targetClassId
        setDocsLoading(true)
        try {
          const docs = targetDocs.length > 0 ? targetDocs : await getClassroomDocuments(targetClassId)
          if (!isMounted) return
          setDocuments(docs || [])
          if (docs && docs.length > 0) {
            if (docId && docs.some((d) => d.id === docId)) {
              setSelectedDocId(docId)
            } else {
              setSelectedDocId(docs[0].id)
              navigate(`/student/study/${docs[0].id}?tab=${activeTab}`, { replace: true })
            }
          } else {
            setSelectedDocId('')
            navigate(`/student/study?tab=${activeTab}`, { replace: true })
          }
        } catch (err) {
          console.error('Lỗi khi tải tài liệu của lớp:', err)
          if (isMounted) {
            setDocuments([])
            setSelectedDocId('')
          }
        } finally {
          if (isMounted) setDocsLoading(false)
        }
      })
      .catch((err) => {
        console.error('Lỗi khi tải danh sách lớp học:', err)
        if (isMounted) {
          setClassrooms([])
          setClassesLoading(false)
        }
      })

    return () => {
      isMounted = false
    }
  }, [docId])

  const handleClassChange = async (newClassId) => {
    setSelectedClassId(newClassId)
    if (!newClassId) {
      setDocuments([])
      setSelectedDocId('')
      navigate(`/student/study?tab=${activeTab}`, { replace: true })
      return
    }
    setDocsLoading(true)
    try {
      const docs = await getClassroomDocuments(newClassId)
      setDocuments(docs || [])
      if (docs && docs.length > 0) {
        setSelectedDocId(docs[0].id)
        navigate(`/student/study/${docs[0].id}?tab=${activeTab}`, { replace: true })
      } else {
        setSelectedDocId('')
        navigate(`/student/study?tab=${activeTab}`, { replace: true })
      }
    } catch (err) {
      console.error('Lỗi khi tải tài liệu lớp:', err)
      setDocuments([])
      setSelectedDocId('')
    } finally {
      setDocsLoading(false)
    }
  }

  const handleDocChange = (newDocId) => {
    setSelectedDocId(newDocId)
    if (newDocId) {
      navigate(`/student/study/${newDocId}?tab=${activeTab}`, { replace: true })
    } else {
      navigate(`/student/study?tab=${activeTab}`, { replace: true })
    }
  }

  // 2. Tải flashcards & quizzes theo tài liệu được chọn
  const loadStudyData = async (docIdToLoad) => {
    const targetDocId = docIdToLoad || selectedDocId
    if (!targetDocId) {
      setFlashcards([])
      setQuizzes([])
      return { flashcards: [], quizzes: [] }
    }
    if (!billingLoading && billing && !billing.is_pro) {
      setFlashcards([])
      setQuizzes([])
      return { flashcards: [], quizzes: [] }
    }
    setLoading(true)
    try {
      const [fcData, qzData] = await Promise.all([
        fetchDocumentFlashcards(targetDocId),
        fetchDocumentQuizzes(targetDocId),
      ])
      if (billing && !billing.is_pro) {
        setFlashcards([])
        setQuizzes([])
        return { flashcards: [], quizzes: [] }
      }
      setFlashcards(fcData || [])
      setQuizzes(qzData || [])
      return { flashcards: fcData || [], quizzes: qzData || [] }
    } catch (err) {
      console.error('Lỗi khi tải dữ liệu ôn tập:', err)
      return { flashcards: [], quizzes: [] }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (selectedDocId) {
      loadStudyData(selectedDocId)
    } else {
      setFlashcards([])
      setQuizzes([])
    }
  }, [selectedDocId, billing])

  // 3. Tải lịch sử làm bài nếu chọn tab 'attempts'
  useEffect(() => {
    if (activeTab === 'attempts') {
      if (!billingLoading && billing && !billing.is_pro) {
        setAttempts([])
        return
      }
      fetchMyQuizAttempts().then((data) => setAttempts(data || []))
    }
  }, [activeTab, billing, billingLoading])

  const currentClassroom = classrooms.find((c) => c.id === selectedClassId)

  return (
    <div className="study-container">
      {/* Header bar */}
      <div className="study-header">
        <div>
          <h1 className="study-title">
            <GraduationCapIcon size={28} />
            Góc học tập & Ôn thi
          </h1>
          <p style={{ margin: '6px 0 0', color: '#64748b' }}>
            Học chủ động bằng thẻ Flashcard và tự kiểm tra kiến thức qua bài Quiz trắc nghiệm do AI tạo.
          </p>
        </div>

        {/* Bộ chọn 2 bước: 1. Lớp học đã vào -> 2. Tài liệu cần ôn tập */}
        <div className="study-selectors-bar">
          {/* Bước 1: Chọn lớp học đã tham gia */}
          <div className="study-select-field">
            <label className="study-select-label" htmlFor="study-class-select">
              <BookOpenIcon size={16} /> Lớp học:
            </label>
            <select
              id="study-class-select"
              className="study-select"
              value={selectedClassId}
              onChange={(e) => handleClassChange(e.target.value)}
              disabled={classesLoading || classrooms.length === 0}
            >
              {classesLoading ? (
                <option value="">Đang tải lớp học...</option>
              ) : classrooms.length === 0 ? (
                <option value="">Chưa tham gia lớp học nào</option>
              ) : (
                classrooms.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.code ? `[${c.code}]` : ''} {c.subject ? `(${c.subject})` : ''}
                  </option>
                ))
              )}
            </select>
          </div>

          <div className="study-select-divider" aria-hidden="true" />

          {/* Bước 2: Chọn tài liệu của lớp */}
          <div className="study-select-field">
            <label className="study-select-label" htmlFor="study-doc-select">
              <SparklesIcon size={16} /> Tài liệu ôn tập:
            </label>
            <select
              id="study-doc-select"
              className="study-select"
              value={selectedDocId}
              onChange={(e) => handleDocChange(e.target.value)}
              disabled={docsLoading || !selectedClassId || documents.length === 0}
            >
              {docsLoading ? (
                <option value="">Đang tải tài liệu...</option>
              ) : !selectedClassId ? (
                <option value="">-- Vui lòng chọn lớp trước --</option>
              ) : documents.length === 0 ? (
                <option value="">Lớp này chưa có tài liệu</option>
              ) : (
                documents.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.title || d.name}
                  </option>
                ))
              )}
            </select>
          </div>
        </div>
      </div>

      {/* Banner kết quả thanh toán VNPay giống như bên Sổ tay AI */}
      {paymentResult && (
        <div
          className={
            'study-payment-result ' +
            (paymentResult === 'success' ||
            (paymentResult === 'pending' && (billing?.is_pro || paymentCheckStatus === 'paid'))
              ? 'is-success'
              : '')
          }
        >
          <p role="status">
            {paymentResult === 'success' ||
            (paymentResult === 'pending' && (billing?.is_pro || paymentCheckStatus === 'paid'))
              ? 'Thanh toán thành công. Gói Pro đã được kích hoạt. Bạn có thể sử dụng đầy đủ tính năng Flashcard và Quiz bằng AI!'
              : paymentResult === 'pending'
              ? (paymentCheckStatus === 'pending'
                  ? 'VNPay chưa xác nhận giao dịch. Đơn vẫn được giữ để kiểm tra lại.'
                  : 'Đang kiểm tra trạng thái giao dịch với VNPay...')
              : paymentResult === 'failed'
              ? 'Giao dịch chưa thành công. Bạn vẫn có thể thử lại.'
              : 'Không xác thực được kết quả thanh toán.'}
          </p>
          {paymentResult === 'pending' && paymentOrderCode && !billing?.is_pro && (
            <button
              type="button"
              className="study-payment-check-btn"
              onClick={checkPayment}
              disabled={paymentCheckBusy}
            >
              {paymentCheckBusy ? 'Đang kiểm tra...' : 'Kiểm tra giao dịch với VNPay'}
            </button>
          )}
          {paymentCheckError && (
            <p className="study-payment-error" role="alert">
              {paymentCheckError}
            </p>
          )}
        </div>
      )}

      {/* Banner nâng cấp Pro cho học viên gói Free */}
      {!billingLoading && billing && !billing.is_pro && (
        <div className="study-pro-banner">
          <div className="study-pro-banner-content">
            <span className="study-pro-crown">👑</span>
            <div>
              <strong>Nâng cấp DMRS Pro để mở khóa tính năng Tạo Flashcard & Quiz bằng AI</strong>
              <p>Học viên Pro được tạo thẻ ghi nhớ và sinh đề thi ôn tập trắc nghiệm không giới hạn theo tài liệu.</p>
            </div>
          </div>
          <button
            type="button"
            className="study-pro-upgrade-btn"
            onClick={handleBuyPro}
            disabled={checkoutBusy}
          >
            {checkoutBusy ? 'Đang kết nối...' : 'Nâng cấp Pro · 99.000đ/tháng'}
          </button>
        </div>
      )}

      {/* Tabs navigation */}
      <div className="study-tabs">
        <button
          type="button"
          className={`study-tab-btn ${activeTab === 'flashcards' ? 'is-active' : ''}`}
          onClick={() => handleTabChange('flashcards')}
        >
          <span>🃏 Thẻ Flashcard</span>
          {isPro ? (
            <span className="study-tab-badge">{flashcards.length}</span>
          ) : (
            <span className="study-tab-badge-locked">🔒 Pro</span>
          )}
        </button>

        <button
          type="button"
          className={`study-tab-btn ${activeTab === 'quiz' ? 'is-active' : ''}`}
          onClick={() => handleTabChange('quiz')}
        >
          <span>📝 Luyện thi Quiz</span>
          {isPro ? (
            <span className="study-tab-badge">{quizzes.length}</span>
          ) : (
            <span className="study-tab-badge-locked">🔒 Pro</span>
          )}
        </button>

        <button
          type="button"
          className={`study-tab-btn ${activeTab === 'attempts' ? 'is-active' : ''}`}
          onClick={() => handleTabChange('attempts')}
        >
          <span>📊 Lịch sử làm bài</span>
          {!isPro && <span className="study-tab-badge-locked">🔒 Pro</span>}
        </button>
      </div>

      {/* Nội dung tab */}
      {activeTab === 'flashcards' && (
        classesLoading || docsLoading ? (
          <div className="study-empty">
            <SparklesIcon size={40} style={{ color: '#1a56db' }} />
            <h4 style={{ marginTop: 12 }}>Đang tải dữ liệu học tập...</h4>
            <p>Vui lòng đợi giây lát trong khi hệ thống đồng bộ tài liệu ôn tập của bạn.</p>
          </div>
        ) : classrooms.length === 0 ? (
          <div className="study-empty study-empty--boxed">
            <GraduationCapIcon size={46} style={{ color: '#4f46e5' }} />
            <h4>Bạn chưa tham gia lớp học nào</h4>
            <p>
              Để sử dụng tính năng tạo và ôn luyện bằng Thẻ ghi nhớ Flashcard & Quiz trắc nghiệm AI, bạn cần tham gia vào lớp học có tài liệu do giảng viên chia sẻ.
            </p>
            <button
              type="button"
              className="study-cta-btn"
              onClick={() => navigate('/student/classes')}
            >
              <BookOpenIcon size={18} /> Khám phá & Tham gia lớp học
            </button>
          </div>
        ) : documents.length === 0 ? (
          <div className="study-empty study-empty--boxed">
            <BookOpenIcon size={46} style={{ color: '#94a3b8' }} />
            <h4>Lớp học chưa có tài liệu nào</h4>
            <p>
              Lớp <strong>"{currentClassroom?.name || 'này'}"</strong> hiện chưa được giảng viên tải lên bài giảng hay tài liệu ôn tập. Vui lòng chọn lớp học khác ở phía trên hoặc quay lại sau nhé!
            </p>
          </div>
        ) : !selectedDocId ? (
          <div className="study-empty study-empty--boxed">
            <SparklesIcon size={46} style={{ color: '#1a56db' }} />
            <h4>Vui lòng chọn tài liệu cần làm bài và Flashcard</h4>
            <p>
              Chọn một tài liệu ở mục "Tài liệu ôn tập" phía trên để mở kho thẻ ghi nhớ và tạo Flashcard bằng AI cho tài liệu đó.
            </p>
          </div>
        ) : (
          <FlashcardViewer
            documentId={selectedDocId}
            flashcards={flashcards}
            setFlashcards={setFlashcards}
            onRefresh={loadStudyData}
            isPro={isPro}
            onUpgradePro={handleBuyPro}
            checkoutBusy={checkoutBusy}
          />
        )
      )}

      {activeTab === 'quiz' && (
        classesLoading || docsLoading ? (
          <div className="study-empty">
            <SparklesIcon size={40} style={{ color: '#1a56db' }} />
            <h4 style={{ marginTop: 12 }}>Đang tải đề thi Quiz...</h4>
            <p>Vui lòng đợi giây lát trong khi hệ thống đồng bộ bài tập trắc nghiệm.</p>
          </div>
        ) : classrooms.length === 0 ? (
          <div className="study-empty study-empty--boxed">
            <GraduationCapIcon size={46} style={{ color: '#4f46e5' }} />
            <h4>Bạn chưa tham gia lớp học nào</h4>
            <p>
              Để tự kiểm tra kiến thức qua các bài thi trắc nghiệm Quiz do AI tạo, bạn cần tham gia vào lớp học có tài liệu học tập.
            </p>
            <button
              type="button"
              className="study-cta-btn"
              onClick={() => navigate('/student/classes')}
            >
              <BookOpenIcon size={18} /> Khám phá & Tham gia lớp học
            </button>
          </div>
        ) : documents.length === 0 ? (
          <div className="study-empty study-empty--boxed">
            <BookOpenIcon size={46} style={{ color: '#94a3b8' }} />
            <h4>Lớp học chưa có tài liệu nào</h4>
            <p>
              Lớp <strong>"{currentClassroom?.name || 'này'}"</strong> hiện chưa có tài liệu bài học để sinh đề thi Quiz. Vui lòng chọn lớp học khác ở phía trên nhé!
            </p>
          </div>
        ) : !selectedDocId ? (
          <div className="study-empty study-empty--boxed">
            <SparklesIcon size={46} style={{ color: '#1a56db' }} />
            <h4>Vui lòng chọn tài liệu để tạo Quiz ôn tập</h4>
            <p>
              Chọn một tài liệu ở mục "Tài liệu ôn tập" phía trên để bắt đầu luyện tập hoặc cho AI tự động sinh đề thi trắc nghiệm ôn tập.
            </p>
          </div>
        ) : (
          <QuizPlayer
            documentId={selectedDocId}
            quizzes={quizzes}
            setQuizzes={setQuizzes}
            onRefresh={loadStudyData}
            isPro={isPro}
            onUpgradePro={handleBuyPro}
            checkoutBusy={checkoutBusy}
          />
        )
      )}

      {activeTab === 'attempts' && (
        !isPro ? (
          <div className="study-pro-locked-box">
            <div className="study-pro-locked-icon">🔒</div>
            <h3 className="study-pro-locked-title">Lịch sử làm bài chỉ dành cho DMRS Pro</h3>
            <p className="study-pro-locked-desc">
              Tài khoản của bạn hiện là gói Miễn phí. Lịch sử làm bài thi trắc nghiệm và thống kê điểm số chỉ có thể sử dụng khi nâng cấp gói <strong>DMRS Pro</strong>.
            </p>
            <button
              type="button"
              className="study-pro-upgrade-btn"
              onClick={handleBuyPro}
              disabled={checkoutBusy}
            >
              {checkoutBusy ? 'Đang kết nối...' : '👑 Nâng cấp DMRS Pro để mở khóa · 99.000đ/tháng'}
            </button>
          </div>
        ) : (
          <div className="quiz-card">
            <h3 style={{ marginTop: 0, marginBottom: 16 }}>Lịch sử kết quả làm bài của bạn</h3>
            {attempts.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '30px 0', color: '#64748b' }}>
                Bạn chưa hoàn thành bài thi Quiz nào. Hãy chọn tab "Luyện thi Quiz" để bắt đầu nhé!
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #e2e8f0', color: '#475569' }}>
                      <th style={{ padding: '10px 12px' }}>Thời gian</th>
                      <th style={{ padding: '10px 12px' }}>Điểm số</th>
                      <th style={{ padding: '10px 12px' }}>Đánh giá</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attempts.map((att) => (
                      <tr key={att.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '12px' }}>
                          {formatDate(att.completed_at)}
                        </td>
                        <td style={{ padding: '12px', fontWeight: 700, fontSize: 16, color: att.score >= 5 ? '#059669' : '#dc2626' }}>
                          {att.score} / 10
                        </td>
                        <td style={{ padding: '12px' }}>
                          <span
                            className={`st-badge ${
                              att.score >= 8
                                ? 'st-badge--success'
                                : att.score >= 5
                                ? 'st-badge--info'
                                : 'st-badge--danger'
                            }`}
                          >
                            {att.score >= 8 ? 'Xuất sắc' : att.score >= 5 ? 'Đạt' : 'Cần ôn lại'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )
      )}
    </div>
  )
}
