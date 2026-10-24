// Nội dung tour hướng dẫn cho khu Giảng viên.
// LECTURER_OVERVIEW: tour tổng quan tự chạy 1 lần. LECTURER_TOURS: map theo trang,
// mở lại bằng nút "?" trên topbar.

export const LECTURER_OVERVIEW = [
  { selector: '[data-tour="/lecturer/documents"]', title: 'Kho tài liệu', desc: 'Quản lý và xem các tài liệu giảng dạy của bạn.' },
  { selector: '[data-tour="upload"]', title: 'Tải tài liệu lên', desc: 'Đưa giáo trình/bài giảng (PDF, DOCX, PPTX) vào kho, hệ thống tự lập chỉ mục cho AI.' },
  { selector: '[data-tour="/lecturer/chat"]', title: 'Chat AI', desc: 'Hoi dap voi AI ve tai lieu, cau tra loi kem trich dan nguon.' },
  { selector: '.dmrs-topbar-right', title: 'Tiện ích', desc: 'Đổi giao diện sáng/tối, thông báo, và bấm "?" để mở lại hướng dẫn cho từng trang.' },
]

export const LECTURER_TOURS = {
  '/lecturer': [
    { selector: '[data-tour="/lecturer"]', title: 'Bảng điều khiển', desc: 'Tổng quan số liệu về tài liệu và hoạt động của bạn.' },
    { selector: '.dmrs-stat-grid', title: 'Số liệu nhanh', desc: 'Các thẻ thống kê cập nhật theo thời gian thực.' },
  ],
  '/lecturer/documents': [
    { selector: '[data-tour="/lecturer/documents"]', title: 'Kho tài liệu', desc: 'Nơi quản lý toàn bộ tài liệu giảng dạy bạn đã tải lên.' },
    { selector: '.dmrs-doc-card', title: 'Xem & quản lý', desc: 'Bấm một tài liệu để xem; di chuột để sửa hoặc xóa.' },
  ],
  '/lecturer/documents/upload': [
    { selector: '.dmrs-upload-tabs', title: 'Chọn cách thêm', desc: 'Tải tệp từ máy hoặc dán liên kết (URL/YouTube).' },
    { selector: '.dmrs-dropzone', title: 'Kéo thả tệp', desc: 'Kéo thả hoặc nhấp để chọn PDF, Word, PowerPoint, Text, Video.' },
    { selector: '.ug-card', title: 'Mẹo tải lên', desc: 'Xem các lưu ý để tài liệu được lập chỉ mục tốt nhất cho AI.' },
  ],
  '/lecturer/chat': [
    { selector: '[data-tour="/lecturer/chat"]', title: 'Chat AI', desc: 'Hỏi đáp với AI dựa trên tài liệu của nhà trường và tài liệu bạn tải lên.' },
    { selector: '.lec-chat-input', title: 'Đặt câu hỏi', desc: 'Gõ câu hỏi rồi gửi. Trả lời kèm trích dẫn nguồn để kiểm chứng.' },
    { selector: '.lec-new-chat', title: 'Cuộc trò chuyện mới', desc: 'Bắt đầu hội thoại mới; lịch sử nằm ở cột bên, đổi tên/xóa khi cần.' },
  ],
  '/lecturer/settings': [
    { selector: '[data-tour="/lecturer/settings"]', title: 'Cài đặt', desc: 'Quản lý thông tin cá nhân và bảo mật tài khoản.' },
    { selector: '#lec-set-profile', title: 'Thông tin cá nhân', desc: 'Xem thông tin họ tên, email và số điện thoại.' },
  ],
}
