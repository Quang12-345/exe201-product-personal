import { useState, useEffect, useRef, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useChatConversations } from '../../../hooks/useChatConversations.js'
import { getFaqs } from '../services/chatService'
import { saveAnswer } from '../services/savedService'
import { getBillingStatus, reconcileProPayment, startProCheckout } from '../services/billingService'
import { getEnrolledClassrooms, getClassroomDocuments } from '../services/classroomService'
import ConversationList from '../components/ConversationList.jsx'
import ShareModal from '../components/ShareModal.jsx'
import DocumentViewerModal from '../../../components/common/DocumentViewerModal.jsx'
import TypingIndicator from '../../../components/common/TypingIndicator.jsx'
import ChatMessage from '../../../components/common/ChatMessage.jsx'
import SuggestedQuestions from '../../../components/common/SuggestedQuestions.jsx'
import {
  BotIcon,
  HistoryIcon,
  MoreVerticalIcon,
  PaperclipIcon,
  MicIcon,
  SendIcon,
  HelpIcon,
  FileTextIcon,
  UploadIcon,
  ChevronDownIcon,
  PanelRightIcon,
  XIcon,
  EyeIcon,
  SparklesIcon,
  BookOpenIcon,
  PlusIcon,
} from '../../../components/common/icons.jsx'
import { comingSoon } from '../../../components/common/comingSoon.jsx'

function greeting() {
  return {
    id: 'g' + Date.now(),
    from: 'ai',
    text: 'Xin chào! Tôi là trợ lý AI của hệ thống. Tôi có thể giúp bạn tra cứu tài liệu học tập và quy định đào tạo. Bạn cần hỗ trợ gì hôm nay?',
  }
}

function ChatPage() {
  const conv = useChatConversations({ greeting, openLatestOnMount: false })
  const [input, setInput] = useState('')
  const [listOpen, setListOpen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [renamingActive, setRenamingActive] = useState(false)
  const [deletingActive, setDeletingActive] = useState(false)
  const [asideOpen, setAsideOpen] = useState(true)
  const [faqOpen, setFaqOpen] = useState(true)
  const [showAllFaqs, setShowAllFaqs] = useState(false)
  const [classrooms, setClassrooms] = useState([])
  const [loadingClasses, setLoadingClasses] = useState(true)
  const [expandedClassIds, setExpandedClassIds] = useState(() => new Set())
  const [classDocs, setClassDocs] = useState({})
  const [loadingDocsClassId, setLoadingDocsClassId] = useState(null)
  const [selectedDoc, setSelectedDoc] = useState(null)
  const [viewingDoc, setViewingDoc] = useState(null)
  const inputRef = useRef(null)
  const [savedIds, setSavedIds] = useState(() => new Set())
  const [billing, setBilling] = useState(null)
  const [checkoutBusy, setCheckoutBusy] = useState(false)
  const [billingError, setBillingError] = useState('')
  const [paymentCheckBusy, setPaymentCheckBusy] = useState(false)
  const [paymentCheckStatus, setPaymentCheckStatus] = useState('')
  const [paymentCheckError, setPaymentCheckError] = useState('')
  const faqs = getFaqs()
  const primaryFaqs = faqs.slice(0, 3)
  const extraFaqs = faqs.slice(3)
  const hasExtraFaqs = extraFaqs.length > 0
  const bottomRef = useRef(null)

  useEffect(() => {
    try {
      const q = sessionStorage.getItem('dmrs_prefill_q')
      if (q) {
        setInput(q)
        sessionStorage.removeItem('dmrs_prefill_q')
      }
    } catch {
      /* ignore */
    }
  }, [])

  // Đóng/mở danh sách tài liệu của một lớp học
  const toggleClass = useCallback(async (classroomId) => {
    setExpandedClassIds((prev) => {
      const next = new Set(prev)
      if (next.has(classroomId)) {
        next.delete(classroomId)
      } else {
        next.add(classroomId)
      }
      return next
    })

    // Tải danh sách tài liệu nếu lớp đó chưa được tải
    if (!classDocs[classroomId]) {
      setLoadingDocsClassId(classroomId)
      try {
        const docs = await getClassroomDocuments(classroomId)
        setClassDocs((prev) => ({ ...prev, [classroomId]: docs || [] }))
      } catch {
        setClassDocs((prev) => ({ ...prev, [classroomId]: [] }))
      } finally {
        setLoadingDocsClassId(null)
      }
    }
  }, [classDocs])

  // Tải danh sách các lớp học của sinh viên
  useEffect(() => {
    let active = true
    const docIdParam = new URLSearchParams(window.location.search).get('docId')

    setLoadingClasses(true)
    getEnrolledClassrooms()
      .then(async (classes) => {
        if (!active) return
        setClassrooms(classes || [])
        setLoadingClasses(false)

        if (!classes || classes.length === 0) return

        // Mở sẵn lớp đầu tiên và tải tài liệu của lớp đó
        const firstClass = classes[0]
        if (firstClass) {
          setExpandedClassIds(new Set([firstClass.id]))
          setLoadingDocsClassId(firstClass.id)
          try {
            const docs = await getClassroomDocuments(firstClass.id)
            if (active) {
              setClassDocs((prev) => ({ ...prev, [firstClass.id]: docs || [] }))
              if (docIdParam) {
                const found = (docs || []).find((d) => d.id === docIdParam)
                if (found) {
                  setSelectedDoc({ ...found, classroomName: firstClass.name })
                }
              }
            }
          } catch {
            /* ignore */
          } finally {
            if (active) setLoadingDocsClassId(null)
          }
        }
      })
      .catch(() => {
        if (active) {
          setClassrooms([])
          setLoadingClasses(false)
        }
      })

    return () => {
      active = false
    }
  }, [])

  const messages = conv.active?.messages || []
  const hasSavedConversation = conv.activeId && conv.activeId !== '__new__'

  useEffect(() => {
    let active = true
    getBillingStatus()
      .then((status) => { if (active) setBilling(status) })
      .catch(() => {})
    return () => { active = false }
  }, [conv.sending, messages.length])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages, conv.sending])

  const handleSave = (aiMsg) => {
    const idx = messages.findIndex((m) => m.id === aiMsg.id)
    const userQ = [...messages.slice(0, idx)].reverse().find((m) => m.from === 'user')
    saveAnswer({ title: userQ?.text || conv.active?.title, content: aiMsg.text })
    setSavedIds((prev) => new Set(prev).add(aiMsg.id))
  }

  const formatTokens = (num) => {
    if (num === null || num === undefined) return '0'
    return Number(num).toLocaleString('vi-VN')
  }
  const tokenLimit = Number(billing?.daily_limit)
  const tokenUsagePercent = billing?.daily_limit == null
    ? null
    : tokenLimit <= 0
      ? 100
      : Math.min(100, Math.max(0, ((Number(billing?.used_today) || 0) / tokenLimit) * 100))

  const handleSelectDoc = (doc) => {
    if (selectedDoc?.id === doc.id) {
      inputRef.current?.focus()
      return
    }
    setSelectedDoc(doc)
    setTimeout(() => {
      inputRef.current?.focus()
    }, 50)
  }

  const handleAskDocPrompt = (promptText) => {
    if (!promptText || conv.sending || !canAsk) return
    conv.send(promptText)
  }

  const submit = (e) => {
    e.preventDefault()
    const trimmed = input.trim()
    if (!trimmed) return
    if (billing && billing.daily_limit != null && billing.remaining_today <= 0) return

    let textToSend = trimmed
    if (selectedDoc) {
      const titleLower = selectedDoc.title.toLowerCase()
      if (!textToSend.toLowerCase().includes(titleLower)) {
        textToSend = `Dựa vào tài liệu "${selectedDoc.title}", hãy cho tôi biết: ${textToSend}`
      }
    }
    conv.send(textToSend)
    setInput('')
  }

  const buyPro = async () => {
    setBillingError('')
    setCheckoutBusy(true)
    try {
      const checkout = await startProCheckout('/student/chat')
      const redirectUrl = checkout?.checkout_url || checkout?.payment_url
      if (redirectUrl) {
        window.location.assign(redirectUrl)
      } else {
        setBillingError('Không nhận được đường dẫn thanh toán từ VNPay.')
      }
    } catch (error) {
      const detail = error?.response?.data?.detail
      setBillingError(typeof detail === 'string' ? detail : detail?.message || 'Không thể tạo thanh toán VNPay. Vui lòng thử lại.')
    } finally {
      setCheckoutBusy(false)
    }
  }

  const paymentResult = new URLSearchParams(window.location.search).get('payment')
  const paymentOrderCode = new URLSearchParams(window.location.search).get('order_code') || billing?.pending_order_code
  const canAsk = !billing || billing.daily_limit == null || billing.remaining_today > 0

  const checkPayment = async () => {
    if (!paymentOrderCode || paymentCheckBusy) return
    setPaymentCheckError('')
    setPaymentCheckBusy(true)
    try {
      const result = await reconcileProPayment(paymentOrderCode)
      setPaymentCheckStatus(result.status)
      if (result.status === 'paid') setBilling(await getBillingStatus())
    } catch (error) {
      const detail = error?.response?.data?.detail
      setPaymentCheckError(typeof detail === 'string' ? detail : detail?.message || 'Chưa kiểm tra được giao dịch VNPay.')
    } finally {
      setPaymentCheckBusy(false)
    }
  }

  useEffect(() => {
    if (paymentResult === 'success') {
      getBillingStatus().then(setBilling).catch(() => {})
    }
  }, [paymentResult])

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

  const submitActiveRename = (title) => {
    const nextTitle = title.trim()
    if (hasSavedConversation && nextTitle) conv.rename(conv.activeId, nextTitle)
    setRenamingActive(false)
  }

  const confirmActiveDelete = () => {
    if (hasSavedConversation) conv.remove(conv.activeId)
    setDeletingActive(false)
  }

  return (
    <div className={'st-chat-layout' + (asideOpen ? '' : ' is-aside-collapsed')}>
      <ConversationList
        list={conv.list}
        activeId={conv.activeId}
        open={listOpen}
        onSelect={(id) => { conv.select(id); setListOpen(false) }}
        onNew={() => { conv.createNew(); setListOpen(false); setSelectedDoc(null) }}
        onRename={conv.rename}
        onDelete={conv.remove}
        onClose={() => setListOpen(false)}
      />
      {listOpen && <div className="st-overlay" onClick={() => setListOpen(false)} />}

      <section className="st-chat-panel">
        <header className="st-chat-head">
          <div className="st-chat-head-left">
            <button className="st-icon-btn st-history-toggle" onClick={() => setListOpen(true)} aria-label="Lịch sử">
              <HistoryIcon size={18} />
            </button>
            <span className="st-assistant-icon"><BotIcon size={18} /></span>
            <div>
              <strong>{conv.active?.title || 'DMRS Assistant'}</strong>
              <span className="st-online">● Sẵn sàng hỗ trợ</span>
            </div>
          </div>
          <div className="st-chat-head-actions">
            <button
              className={'st-icon-btn st-aside-toggle' + (asideOpen ? ' is-active' : '')}
              onClick={() => setAsideOpen((o) => !o)}
              aria-label={asideOpen ? 'Thu gọn bảng bên' : 'Hiện bảng bên'}
              title={asideOpen ? 'Thu gọn bảng bên' : 'Hiện bảng bên'}
            >
              <PanelRightIcon size={18} />
            </button>
            <button className="st-share-btn" onClick={() => setShareOpen(true)} disabled={!hasSavedConversation}>
              <UploadIcon size={16} /> Chia sẻ
            </button>
            <div className="st-more-wrap">
              <button className="st-icon-btn" onClick={() => setMoreOpen((o) => !o)} aria-label="Thêm">
                <MoreVerticalIcon size={18} />
              </button>
              {moreOpen && (
                <>
                  <div className="st-menu-backdrop" onClick={() => setMoreOpen(false)} />
                  <div className="st-more-menu">
                    <button onClick={() => { setMoreOpen(false); setShareOpen(true) }} disabled={!hasSavedConversation}>Chia sẻ cuộc trò chuyện</button>
                    <button onClick={() => { setMoreOpen(false); setRenamingActive(true) }} disabled={!hasSavedConversation}>Đổi tên</button>
                    <button className="st-danger" onClick={() => { setMoreOpen(false); setDeletingActive(true) }} disabled={!hasSavedConversation}>Xóa</button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        <div className="st-billing-bar" aria-live="polite">
          <div className="st-billing-main">
            <strong>{billing?.is_pro ? 'DMRS Pro' : 'Gói miễn phí'}</strong>
            {billing ? (
              <div
                className="st-usage-meter"
                role="img"
                aria-label={tokenUsagePercent === null
                  ? 'Không giới hạn tokens'
                  : `Đã dùng ${formatTokens(billing.used_today)} trên ${formatTokens(billing.daily_limit)} tokens hôm nay, reset lúc 00:00`}
                title={tokenUsagePercent === null
                  ? 'Không giới hạn tokens'
                  : `Đã dùng ${formatTokens(billing.used_today)} / ${formatTokens(billing.daily_limit)} tokens hôm nay · reset lúc 00:00`}
              >
                <span className="st-usage-ring" aria-hidden="true">
                  <svg viewBox="0 0 40 40">
                    <circle className="st-usage-ring-track" cx="20" cy="20" r="16" pathLength="100" />
                    {tokenUsagePercent !== null && (
                      <circle
                        className="st-usage-ring-progress"
                        cx="20"
                        cy="20"
                        r="16"
                        pathLength="100"
                        strokeDasharray="100 100"
                        strokeDashoffset={100 - tokenUsagePercent}
                      />
                    )}
                  </svg>
                  <span className={tokenUsagePercent === null ? 'is-unlimited' : undefined}>
                    {tokenUsagePercent === null ? '∞' : `${Math.round(tokenUsagePercent)}%`}
                  </span>
                </span>
                <span className="st-usage-copy">
                  <span className="st-usage-title">{tokenUsagePercent === null ? 'Không giới hạn' : 'Mức dùng hôm nay'}</span>
                  <span className="st-usage-caption">
                    {billing.is_pro && billing.expires_at
                      ? `Hiệu lực đến ${new Date(billing.expires_at).toLocaleDateString('vi-VN')}`
                      : 'Tự đặt lại lúc 00:00'}
                  </span>
                </span>
              </div>
            ) : (
              <span className="st-usage-loading">Đang tải hạn mức...</span>
            )}
          </div>
          {!billing?.is_pro && (
            <button type="button" onClick={buyPro} disabled={checkoutBusy}>
              {checkoutBusy ? 'Đang kết nối...' : 'Nâng cấp Pro · 99.000đ/tháng'}
            </button>
          )}
        </div>
        {billingError && <p className="st-billing-error" role="alert">{billingError}</p>}
        {paymentResult && (
          <div className={'st-payment-result ' + (paymentResult === 'success' || (paymentResult === 'pending' && (billing?.is_pro || paymentCheckStatus === 'paid')) ? 'is-success' : '')}>
            <p role="status">
              {paymentResult === 'success' || (paymentResult === 'pending' && (billing?.is_pro || paymentCheckStatus === 'paid')) ? 'Thanh toán thành công. Gói Pro đã được kích hoạt.' : paymentResult === 'pending' ? (paymentCheckStatus === 'pending' ? 'VNPay chưa xác nhận giao dịch. Đơn vẫn được giữ để kiểm tra lại.' : 'Đang kiểm tra trạng thái giao dịch với VNPay.') : paymentResult === 'failed' ? 'Giao dịch chưa thành công. Bạn vẫn có thể thử lại.' : 'Không xác thực được kết quả thanh toán.'}
            </p>
            {paymentResult === 'pending' && paymentOrderCode && !billing?.is_pro && (
              <button type="button" className="st-payment-check" onClick={checkPayment} disabled={paymentCheckBusy}>
                {paymentCheckBusy ? 'Đang kiểm tra...' : 'Kiểm tra giao dịch với VNPay'}
              </button>
            )}
            {paymentCheckError && <p role="alert">{paymentCheckError}</p>}
          </div>
        )}

        <div className="st-chat-center">
          <div className="st-chat-body">
            {messages
              .filter((m) => !(m.from === 'ai' && !m.text))
              .map((m) => (
                <ChatMessage
                  key={m.id}
                  msg={m}
                  onSave={m.from === 'ai' && !String(m.id).startsWith('g') ? handleSave : undefined}
                  saved={savedIds.has(m.id)}
                />
              ))}
            {messages.every((m) => String(m.id).startsWith('g')) && !conv.sending && (
              <SuggestedQuestions questions={primaryFaqs} onPick={(q) => conv.send(q)} disabled={conv.sending || !canAsk} />
            )}
            {conv.sending && <TypingIndicator label="DMRS Assistant đang trả lời" />}
            <div ref={bottomRef} />
          </div>

          {selectedDoc && (
            <div className="st-selected-doc-wrap">
              <div className="st-selected-doc-header">
                <div className="st-selected-doc-title">
                  <span className="st-selected-doc-tag">Đang hỏi về</span>
                  <FileTextIcon size={15} />
                  <strong>{selectedDoc.title}</strong>
                  {selectedDoc.classroomName && (
                    <span style={{ fontSize: 12, color: '#2563eb', fontWeight: 700, marginLeft: 6 }}>
                      (Lớp: {selectedDoc.classroomName})
                    </span>
                  )}
                </div>
                <div className="st-selected-doc-actions">
                  <button
                    type="button"
                    className="st-selected-doc-preview-btn"
                    onClick={() => setViewingDoc({ ...selectedDoc, name: selectedDoc.title })}
                    title="Xem trước nội dung tài liệu"
                  >
                    <EyeIcon size={13} /> Xem trước
                  </button>
                  <button
                    type="button"
                    className="st-selected-doc-clear"
                    onClick={() => setSelectedDoc(null)}
                    title="Bỏ chọn tài liệu này"
                    aria-label="Bỏ chọn"
                  >
                    <XIcon size={14} />
                  </button>
                </div>
              </div>
              <div className="st-selected-doc-prompts">
                <span className="st-selected-doc-prompt-label">Gợi ý hỏi nhanh:</span>
                <button
                  type="button"
                  className="st-selected-doc-chip"
                  disabled={conv.sending || !canAsk}
                  onClick={() => handleAskDocPrompt(`Tóm tắt nội dung chính và các điểm quan trọng của tài liệu "${selectedDoc.title}"`)}
                >
                  <SparklesIcon size={13} /> Tóm tắt tài liệu
                </button>
                <button
                  type="button"
                  className="st-selected-doc-chip"
                  disabled={conv.sending || !canAsk}
                  onClick={() => handleAskDocPrompt(`Liệt kê các kiến thức cốt lõi và lưu ý quan trọng trong tài liệu "${selectedDoc.title}"`)}
                >
                  💡 Điểm cốt lõi
                </button>
                <button
                  type="button"
                  className="st-selected-doc-chip"
                  disabled={conv.sending || !canAsk}
                  onClick={() => handleAskDocPrompt(`Dựa vào tài liệu "${selectedDoc.title}", hãy tạo 3 câu hỏi trắc nghiệm kèm đáp án để tôi ôn tập.`)}
                >
                  📝 Tạo câu hỏi ôn tập
                </button>
              </div>
            </div>
          )}

          <form className="st-chat-input" data-tour="chat-input" onSubmit={submit}>
            <button type="button" className="st-icon-btn" aria-label="Đính kèm" onClick={() => comingSoon('Đính kèm tệp đang được phát triển')}><PaperclipIcon size={18} /></button>
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={canAsk ? (selectedDoc ? `Đặt câu hỏi về "${selectedDoc.title}"...` : 'Nhập câu hỏi của bạn tại đây...') : 'Bạn đã dùng hết hạn mức tokens hôm nay'}
              disabled={!canAsk}
            />
            <button type="button" className="st-icon-btn" aria-label="Ghi âm" onClick={() => comingSoon('Ghi âm giọng nói đang được phát triển')}><MicIcon size={18} /></button>
            <button type="submit" className="st-send-btn" aria-label="Gửi" disabled={conv.sending || !canAsk || !input.trim()}><SendIcon size={18} /></button>
          </form>
          <p className="st-chat-note">AI có thể đưa ra câu trả lời không chính xác. Hãy kiểm tra các thông tin quan trọng.</p>
        </div>
      </section>

      {asideOpen && (
        <aside className="st-chat-aside">
          <div className="st-card">
            <button className="st-faq-head" onClick={() => setFaqOpen((o) => !o)}>
              <span className="st-card-title"><HelpIcon size={18} /> Câu hỏi thường gặp</span>
              <ChevronDownIcon size={18} className={'st-faq-chevron' + (faqOpen ? ' is-open' : '')} />
            </button>
            {faqOpen && (
              <>
                <div className="st-faq-list">
                  {primaryFaqs.map((q) => <button key={q} className="st-faq-item" disabled={!canAsk || conv.sending} onClick={() => conv.send(q)}>{q}</button>)}
                </div>
                {hasExtraFaqs && (
                  <>
                    <div className={'st-faq-extra' + (showAllFaqs ? ' is-open' : '')}>
                      <div className="st-faq-extra-inner">
                        {extraFaqs.map((q) => <button key={q} className="st-faq-item" disabled={!canAsk || conv.sending} onClick={() => conv.send(q)}>{q}</button>)}
                      </div>
                    </div>
                    <button className="st-link st-faq-toggle" onClick={() => setShowAllFaqs((v) => !v)}>
                      {showAllFaqs ? 'Rút gọn' : 'Xem thêm'}
                    </button>
                  </>
                )}
              </>
            )}
          </div>

          <div className="st-card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="st-card-title-row">
              <h3 className="st-card-title" style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
                <BookOpenIcon size={18} /> Lớp học của tôi
              </h3>
              <span className="st-card-hint">Chọn tài liệu để hỏi AI</span>
            </div>

            {loadingClasses ? (
              <div style={{ padding: '16px 0', textAlign: 'center', color: '#64748b', fontSize: 13 }}>
                Đang tải danh sách lớp học...
              </div>
            ) : classrooms.length === 0 ? (
              <div
                style={{
                  backgroundColor: '#f8fafc',
                  border: '1.5px dashed #cbd5e1',
                  borderRadius: 10,
                  padding: '16px 14px',
                  textAlign: 'center',
                }}
              >
                <p style={{ margin: '0 0 10px 0', fontSize: 13, color: '#64748b' }}>
                  Bạn chưa tham gia lớp học nào.
                </p>
                <Link
                  to="/student/classes"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    backgroundColor: '#3b66f5',
                    color: '#ffffff',
                    padding: '6px 12px',
                    borderRadius: 8,
                    fontSize: 12.5,
                    fontWeight: 700,
                    textDecoration: 'none',
                  }}
                >
                  <PlusIcon size={14} /> Vào chọn lớp học
                </Link>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 2 }}>
                {classrooms.map((c) => {
                  const isExpanded = expandedClassIds.has(c.id)
                  const docs = classDocs[c.id]
                  const isLoadingDocs = loadingDocsClassId === c.id

                  return (
                    <div
                      key={c.id}
                      style={{
                        border: isExpanded ? '1.5px solid #2563eb' : '1px solid #e2e8f0',
                        borderRadius: 10,
                        backgroundColor: '#ffffff',
                        overflow: 'hidden',
                        transition: 'border-color 0.15s ease',
                      }}
                    >
                      {/* Tiêu đề lớp học: Bấm vào để Mở/Đóng danh sách tài liệu */}
                      <button
                        type="button"
                        onClick={() => toggleClass(c.id)}
                        style={{
                          width: '100%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 8,
                          padding: '10px 12px',
                          background: isExpanded ? '#eff6ff' : '#f8fafc',
                          border: 'none',
                          cursor: 'pointer',
                          textAlign: 'left',
                          fontFamily: 'inherit',
                          transition: 'background 0.12s ease',
                        }}
                      >
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                            <span
                              style={{
                                fontFamily: 'monospace',
                                fontWeight: 800,
                                fontSize: 10.5,
                                backgroundColor: '#ffffff',
                                border: '1px solid #cbd5e1',
                                borderRadius: 4,
                                padding: '1px 5px',
                                color: '#1e293b',
                              }}
                            >
                              {c.code}
                            </span>
                            {c.subject && (
                              <span
                                style={{
                                  fontSize: 11,
                                  fontWeight: 750,
                                  color: '#2563eb',
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                }}
                              >
                                {c.subject}
                              </span>
                            )}
                          </div>
                          <div
                            style={{
                              fontSize: 13,
                              fontWeight: 750,
                              color: isExpanded ? '#1d4ed8' : '#0f172a',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                            title={c.name}
                          >
                            {c.name}
                          </div>
                          {c.lecturer_name && (
                            <div style={{ fontSize: 11, color: '#64748b', marginTop: 1 }}>
                              GV: {c.lecturer_name}
                            </div>
                          )}
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 700,
                              padding: '2px 7px',
                              borderRadius: 6,
                              backgroundColor: isExpanded ? '#dbeafe' : '#e2e8f0',
                              color: isExpanded ? '#1d4ed8' : '#475569',
                            }}
                          >
                            {c.document_count ?? (docs ? docs.length : 0)} TL
                          </span>
                          <ChevronDownIcon
                            size={16}
                            style={{
                              transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                              transition: 'transform 0.2s ease',
                              color: isExpanded ? '#2563eb' : '#64748b',
                            }}
                          />
                        </div>
                      </button>

                      {/* Danh sách tài liệu thuộc lớp học này khi mở ra */}
                      {isExpanded && (
                        <div
                          style={{
                            padding: '8px 10px 10px',
                            backgroundColor: '#ffffff',
                            borderTop: '1px solid #e2e8f0',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 6,
                          }}
                        >
                          {isLoadingDocs ? (
                            <div style={{ padding: '10px 0', textAlign: 'center', fontSize: 12, color: '#64748b' }}>
                              Đang tải tài liệu của lớp...
                            </div>
                          ) : !docs || docs.length === 0 ? (
                            <div style={{ padding: '8px 4px', fontSize: 12, color: '#94a3b8', fontStyle: 'italic', textAlign: 'center' }}>
                              Lớp này chưa có tài liệu nào.
                            </div>
                          ) : (
                            docs.map((d) => {
                              const isSelected = selectedDoc?.id === d.id
                              return (
                                <div
                                  key={d.id}
                                  className={'st-doc-item' + (isSelected ? ' is-selected' : '')}
                                  onClick={() => handleSelectDoc({ ...d, classroomName: c.name })}
                                  role="button"
                                  tabIndex={0}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                      handleSelectDoc({ ...d, classroomName: c.name })
                                    }
                                  }}
                                  title={`Bấm để chọn hỏi về tài liệu: ${d.name || d.title}`}
                                  style={{
                                    padding: '8px 10px',
                                  }}
                                >
                                  <span className="st-file-icon" style={{ width: 28, height: 28 }}>
                                    <FileTextIcon size={16} />
                                  </span>

                                  <div className="st-doc-meta" style={{ minWidth: 0 }}>
                                    <strong style={{ fontSize: 12.5, lineHeight: 1.3 }}>
                                      {d.name || d.title}
                                    </strong>
                                    <span className="st-muted" style={{ fontSize: 10.5 }}>
                                      {d.type || 'Tài liệu'} {d.uploadedAt ? `· ${d.uploadedAt}` : ''}
                                    </span>
                                  </div>

                                  <div className="st-doc-item-actions">
                                    <button
                                      type="button"
                                      className="st-doc-item-eye"
                                      title="Xem trước tài liệu"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        setViewingDoc({ ...d, name: d.name || d.title })
                                      }}
                                    >
                                      <EyeIcon size={13} />
                                    </button>
                                    <span
                                      className="st-doc-action-tag"
                                      style={{
                                        fontSize: 10.5,
                                        padding: '2px 6px',
                                      }}
                                    >
                                      {isSelected ? '✓ Đang chọn' : 'Chọn hỏi'}
                                    </span>
                                  </div>
                                </div>
                              )
                            })
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </aside>
      )}

      {shareOpen && conv.active && (
        <ShareModal conversation={conv.active} onClose={() => setShareOpen(false)} />
      )}
      {renamingActive && (
        <RenameConversationModal
          initial={conv.active?.title || ''}
          onSubmit={submitActiveRename}
          onClose={() => setRenamingActive(false)}
        />
      )}
      {deletingActive && (
        <DeleteConversationModal
          title={conv.active?.title || 'cuộc trò chuyện này'}
          onConfirm={confirmActiveDelete}
          onClose={() => setDeletingActive(false)}
        />
      )}
      {viewingDoc && (
        <DocumentViewerModal
          doc={viewingDoc}
          onClose={() => setViewingDoc(null)}
        />
      )}
    </div>
  )
}

function RenameConversationModal({ initial, onSubmit, onClose }) {
  const [value, setValue] = useState(initial)
  const inputRef = useRef(null)

  useEffect(() => {
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [])

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const submit = (e) => {
    e.preventDefault()
    onSubmit(value)
  }

  return (
    <div className="st-modal-backdrop" onClick={onClose}>
      <form className="st-modal st-modal--sm" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <div className="st-modal-head">
          <h3>Đổi tên cuộc trò chuyện</h3>
          <button type="button" className="st-icon-btn" onClick={onClose} aria-label="Đóng"><XIcon size={18} /></button>
        </div>
        <input
          ref={inputRef}
          className="st-rename-input"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Tên cuộc trò chuyện"
          maxLength={120}
        />
        <div className="st-modal-actions">
          <button type="button" className="st-btn st-btn--ghost" onClick={onClose}>Hủy</button>
          <button type="submit" className="st-btn st-btn--primary" disabled={!value.trim()}>Lưu</button>
        </div>
      </form>
    </div>
  )
}

function DeleteConversationModal({ title, onConfirm, onClose }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="st-modal-backdrop" onClick={onClose}>
      <div className="st-modal st-modal--sm" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="st-active-delete-title">
        <div className="st-modal-head">
          <h3 id="st-active-delete-title">Xóa cuộc trò chuyện</h3>
          <button type="button" className="st-icon-btn" onClick={onClose} aria-label="Đóng"><XIcon size={18} /></button>
        </div>
        <p className="st-modal-desc">Bạn có chắc muốn xóa "{title}"? Hành động này không thể hoàn tác.</p>
        <div className="st-modal-actions">
          <button type="button" className="st-btn st-btn--ghost" onClick={onClose}>Hủy</button>
          <button type="button" className="st-btn st-btn--danger" onClick={onConfirm}>Xóa</button>
        </div>
      </div>
    </div>
  )
}

export default ChatPage
