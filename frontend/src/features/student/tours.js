// Nội dung tour hướng dẫn cho khu Sinh viên.
// - STUDENT_OVERVIEW: tour tổng quan, tự chạy 1 lần cho người mới.
// - STUDENT_TOURS: map { [pathname]: bước[] } mở lại bằng nút "?" trên topbar,
//   mỗi trang một tour riêng highlight đúng phần tử của trang đó.

export const STUDENT_OVERVIEW = [
  { selector: '[data-tour="nav-chat"]', title: 'Chat AI', desc: 'Nơi bạn hỏi đáp với trợ lý AI về tài liệu học tập.' },
  { selector: '[data-tour="chat-input"]', title: 'Đặt câu hỏi', desc: 'Gõ câu hỏi tiếng Việt rồi nhấn Enter. Câu trả lời sẽ kèm trích dẫn nguồn, bấm nguồn để mở tài liệu.' },
  { selector: '[data-tour="nav-library"]', title: 'Kho tài liệu', desc: 'Tra cứu và xem tài liệu theo môn học, loại tệp.' },
  { selector: '.st-topbar-right', title: 'Tiện ích', desc: 'Đổi giao diện sáng/tối, xem thông báo, và bấm "?" để mở lại hướng dẫn cho từng trang.' },
]

export const STUDENT_TOURS = {
  '/student/chat': [
    { selector: '[data-tour="nav-chat"]', title: 'Chat AI', desc: 'Trang hỏi đáp với trợ lý AI dựa trên tài liệu của nhà trường.' },
    { selector: '[data-tour="chat-input"]', title: 'Đặt câu hỏi', desc: 'Gõ câu hỏi tiếng Việt rồi nhấn Enter. Trả lời sẽ kèm trích dẫn nguồn, bấm để mở tài liệu gốc.' },
    { selector: '.st-new-chat', title: 'Cuộc trò chuyện mới', desc: 'Bắt đầu hội thoại mới. Lịch sử các cuộc trò chuyện nằm ở cột này, di chuột để đổi tên hoặc xóa.' },
    { selector: '[data-tour="nav-saved"]', title: 'Lưu lại để dùng sau', desc: 'Câu trả lời hữu ích có thể lưu và xem lại trong mục Câu trả lời đã lưu.' },
  ],
  '/student/chat/saved': [
    { selector: '[data-tour="nav-saved"]', title: 'Câu trả lời đã lưu', desc: 'Tất cả câu trả lời bạn đã lưu từ Chat AI được gom về đây.' },
    { selector: '.st-toolbar .st-search', title: 'Tìm nhanh', desc: 'Gõ từ khóa để lọc trong các câu trả lời đã lưu.' },
    { selector: '.st-saved-grid', title: 'Xem & quản lý', desc: 'Bấm một thẻ để xem đầy đủ, hoặc dùng nút xóa để bỏ câu trả lời không cần nữa.' },
  ],
  '/student/library': [
    { selector: '[data-tour="nav-library"]', title: 'Kho tài liệu', desc: 'Toàn bộ tài liệu học tập khả dụng, tra cứu theo môn học và loại tệp.' },
    { selector: '.st-lib-toolbar', title: 'Lọc & tìm kiếm', desc: 'Lọc theo môn học/loại tệp hoặc gõ từ khóa để tìm nhanh tài liệu cần dùng.' },
    { selector: '.st-view-toggle', title: 'Cách hiển thị', desc: 'Chuyển giữa dạng lưới và dạng danh sách tùy sở thích.' },
    { selector: '.st-doc-grid', title: 'Mở tài liệu', desc: 'Bấm vào một tài liệu để xem trực tiếp trên hệ thống.' },
  ],
  '/student/settings': [
    { selector: '[data-tour="nav-settings"]', title: 'Cài đặt', desc: 'Quản lý thông tin cá nhân, bảo mật và thông báo của bạn.' },
    { selector: '.st-settings-nav', title: 'Các mục cài đặt', desc: 'Chuyển giữa Thông tin cá nhân, Bảo mật & mật khẩu, và Thông báo.' },
    { selector: '#st-set-security', title: 'Đổi mật khẩu', desc: 'Cập nhật mật khẩu tài khoản của bạn tại đây.' },
  ],
}
