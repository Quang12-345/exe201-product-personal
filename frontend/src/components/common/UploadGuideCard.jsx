import { InfoIcon, CheckCircleIcon } from './icons.jsx'
import './UploadGuideCard.css'

// Thẻ "Hướng dẫn tải lên" (nền xanh gradient) — dùng chung trang Tải lên.
const DEFAULT_TIPS = [
  'Hỗ trợ PDF, DOCX, PPTX (tối đa 50MB) và video (tối đa 500MB).',
  'Đặt tiêu đề rõ ràng để dễ tìm kiếm.',
  'Chọn đúng môn học để trợ lý AI trả lời chính xác hơn.',
  'Tài liệu (PDF/DOCX/PPTX) được lập chỉ mục cho AI; video/liên kết chỉ lưu để xem.',
]

const DEFAULT_NOTE =
  'Tài liệu PDF/DOCX/PPTX sẽ được trợ lý AI đọc và trả lời dựa trên nội dung. Video và liên kết hiện chỉ được lưu để xem, AI chưa đọc được nội dung bên trong.'

function UploadGuideCard({ title = 'Hướng dẫn tải lên', tips = DEFAULT_TIPS, note = DEFAULT_NOTE }) {
  return (
    <div className="ug-card">
      <h3 className="ug-title"><InfoIcon size={20} /> {title}</h3>
      <ul className="ug-list">
        {tips.map((t) => (
          <li key={t}>
            <CheckCircleIcon size={18} />
            <span>{t}</span>
          </li>
        ))}
      </ul>
      {note ? (
        <p className="ug-note"><InfoIcon size={15} /> <span>{note}</span></p>
      ) : null}
    </div>
  )
}

export default UploadGuideCard
