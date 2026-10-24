import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import {
  BotIcon, FileTextIcon, ThumbsUpIcon, UploadCloudIcon, BarChartIcon,
  CheckCircleIcon, XIcon, SparklesIcon, ArrowRightIcon,
} from './icons.jsx'
import './OnboardingModal.css'

// Màn chào người dùng mới (onboarding) — hiện 1 lần cho mỗi vai trò.
// Mục tiêu Product AI: ACTIVATION — giúp người dùng hiểu cách dùng + ra giá trị ngay
// (3 bước + câu hỏi mẫu bấm-là-hỏi + checklist bắt đầu).
const KEY = (role) => `dmrs_onboarded_${role || 'user'}`

const CFG = {
  student: {
    title: 'Chào mừng đến với Trợ lý Tri thức AI 👋',
    sub: 'Hỏi đáp tài liệu học tập bằng tiếng Việt — câu trả lời luôn kèm trích dẫn nguồn.',
    steps: [
      { icon: BotIcon, title: 'Đặt câu hỏi', desc: 'Vào Chat AI, hỏi về giáo trình, bài giảng hay quy chế bằng tiếng Việt.' },
      { icon: FileTextIcon, title: 'Câu trả lời có nguồn', desc: 'AI trả lời dựa trên tài liệu nhà trường; bấm nguồn để mở đúng tài liệu, đúng trang.' },
      { icon: ThumbsUpIcon, title: 'Đánh giá để cải thiện', desc: 'Bấm 👍/👎 dưới mỗi câu trả lời để giúp AI ngày càng tốt hơn.' },
    ],
    samples: [
      'Tóm tắt nội dung chính của môn Học sâu (Deep Learning)',
      'Điều kiện tốt nghiệp gồm những gì?',
      'Điện toán đám mây (Cloud) là gì?',
    ],
    checklist: ['Đặt câu hỏi đầu tiên', 'Khám phá Kho tài liệu', 'Đánh giá một câu trả lời'],
    chatPath: '/student/chat',
    cta: { label: 'Bắt đầu hỏi', to: '/student/chat' },
  },
  lecturer: {
    title: 'Chào mừng, Giảng viên 👋',
    sub: 'Tải tài liệu lên kho tri thức và hỏi đáp AI có trích dẫn nguồn.',
    steps: [
      { icon: UploadCloudIcon, title: 'Tải tài liệu lên', desc: 'Đưa giáo trình/bài giảng (PDF, DOCX, PPTX) vào kho — hệ thống tự lập chỉ mục.' },
      { icon: BotIcon, title: 'Hỏi đáp AI', desc: 'Hỏi về tài liệu bằng tiếng Việt; câu trả lời kèm trích dẫn, bấm để mở nguồn.' },
      { icon: ThumbsUpIcon, title: 'Đánh giá để cải thiện', desc: 'Bấm 👍/👎 dưới câu trả lời để cải thiện chất lượng AI.' },
    ],
    samples: [
      'Tóm tắt các điểm chính của tài liệu mới nhất tôi đã tải lên',
      'Quy trình phát triển phần mềm gồm những bước nào?',
    ],
    checklist: ['Tải lên tài liệu đầu tiên', 'Hỏi thử AI về tài liệu', 'Đánh giá câu trả lời'],
    chatPath: '/lecturer/chat',
    cta: { label: 'Tải tài liệu lên', to: '/lecturer/documents/upload' },
  },
  admin: {
    title: 'Chào mừng, Quản trị nội bộ 👋',
    sub: 'Khu vực vận hành: cấp tài khoản giảng viên, kho tài liệu dùng chung và theo dõi chất lượng AI. Người dùng sản phẩm chỉ gồm giảng viên và sinh viên.',
    steps: [
      { icon: UploadCloudIcon, title: 'Quản lý tài liệu', desc: 'Tải lên, phân loại và lập chỉ mục tài liệu cho toàn hệ thống.' },
      { icon: FileTextIcon, title: 'Kho dùng chung', desc: 'Mọi tài liệu "school" sẽ là nguồn để AI trả lời cho giảng viên & sinh viên.' },
      { icon: BarChartIcon, title: 'Theo dõi chất lượng', desc: 'Vào Phân tích để xem lưu lượng và phản hồi 👍/👎 của người dùng về AI.' },
    ],
    samples: [],
    checklist: ['Tải lên tài liệu', 'Kiểm tra phân loại', 'Xem feedback ở Phân tích'],
    chatPath: null,
    cta: { label: 'Quản lý tài liệu', to: '/admin/documents' },
  },
}

function OnboardingModal({ role = 'student' }) {
  const navigate = useNavigate()
  const cfg = CFG[role] || CFG.student
  const [open, setOpen] = useState(() => {
    try { return !localStorage.getItem(KEY(role)) } catch { return false }
  })

  if (!open) return null

  const dismiss = () => {
    try { localStorage.setItem(KEY(role), '1') } catch { /* ignore */ }
    setOpen(false)
    // Đóng màn chào → khởi động tour hướng dẫn "từng nút" (nếu trang có).
    window.dispatchEvent(new CustomEvent('dmrs:start-tour'))
  }
  const askSample = (q) => {
    try { sessionStorage.setItem('dmrs_prefill_q', q) } catch { /* ignore */ }
    dismiss()
    if (cfg.chatPath) navigate(cfg.chatPath)
  }
  const start = () => { dismiss(); navigate(cfg.cta.to) }

  return createPortal(
    <div className="ob-backdrop" onClick={dismiss}>
      <div className="ob-modal" onClick={(e) => e.stopPropagation()}>
        <button className="ob-close" onClick={dismiss} aria-label="Đóng"><XIcon size={18} /></button>

        <div className="ob-head">
          <span className="ob-spark"><SparklesIcon size={22} /></span>
          <h2>{cfg.title}</h2>
          <p>{cfg.sub}</p>
        </div>

        <div className="ob-steps">
          {cfg.steps.map((s, i) => {
            const Icon = s.icon
            return (
              <div key={i} className="ob-step">
                <span className="ob-step-no">{i + 1}</span>
                <span className="ob-step-icon"><Icon size={18} /></span>
                <div>
                  <strong>{s.title}</strong>
                  <span>{s.desc}</span>
                </div>
              </div>
            )
          })}
        </div>

        {cfg.samples.length > 0 && (
          <div className="ob-samples">
            <p className="ob-samples-label">Thử ngay một câu hỏi:</p>
            <div className="ob-samples-list">
              {cfg.samples.map((q) => (
                <button key={q} type="button" className="ob-sample" onClick={() => askSample(q)}>
                  {q} <ArrowRightIcon size={14} />
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="ob-checklist">
          {cfg.checklist.map((c) => (
            <span key={c} className="ob-check"><CheckCircleIcon size={15} /> {c}</span>
          ))}
        </div>

        <div className="ob-foot">
          <button className="ob-btn ob-btn--ghost" onClick={dismiss}>Để sau</button>
          <button className="ob-btn ob-btn--primary" onClick={start}>{cfg.cta.label} <ArrowRightIcon size={16} /></button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

export default OnboardingModal
