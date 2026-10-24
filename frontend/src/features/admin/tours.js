// Nội dung tour hướng dẫn cho khu Admin.
// ADMIN_OVERVIEW: tour tổng quan tự chạy 1 lần. ADMIN_TOURS: map theo trang,
// mở lại bằng nút "?" trên topbar.

export const ADMIN_OVERVIEW = [
  { selector: '[data-tour="/admin/users"]', title: 'Quản lý người dùng', desc: 'Tạo tài khoản giảng viên / admin. Sinh viên tự đăng nhập bằng Gmail.' },
  { selector: '[data-tour="/admin/documents"]', title: 'Kho tài liệu', desc: 'Quản lý tài liệu cho toàn hệ thống — nguồn để AI trả lời.' },
  { selector: '[data-tour="/admin/analytics"]', title: 'Thống kê', desc: 'Xem lưu lượng truy vấn và phản hồi 👍/👎 của người dùng về AI.' },
  { selector: '.dmrs-topbar-right', title: 'Tiện ích', desc: 'Đổi giao diện sáng/tối, thông báo, và bấm "?" để mở lại hướng dẫn cho từng trang.' },
]

export const ADMIN_TOURS = {
  '/admin': [
    { selector: '[data-tour="/admin"]', title: 'Bảng điều khiển', desc: 'Tổng quan toàn hệ thống: người dùng, tài liệu và hoạt động.' },
    { selector: '.dmrs-stat-grid', title: 'Số liệu nhanh', desc: 'Các chỉ số chính của hệ thống, cập nhật theo thời gian thực.' },
    { selector: '.dmrs-table-card', title: 'Hoạt động gần đây', desc: 'Bảng theo dõi các thao tác/tài liệu mới nhất.' },
  ],
  '/admin/users': [
    { selector: '[data-tour="/admin/users"]', title: 'Quản lý người dùng', desc: 'Danh sách toàn bộ tài khoản trong hệ thống.' },
    { selector: '.dmrs-page-head .dmrs-btn--primary', title: 'Thêm người dùng', desc: 'Bấm để cấp tài khoản giảng viên. Sinh viên không cần cấp sẵn.' },
    { selector: '.dmrs-table-card', title: 'Sửa & phân quyền', desc: 'Mỗi dòng cho phép xem, chỉnh sửa hoặc đổi quyền của người dùng.' },
  ],
  '/admin/documents': [
    { selector: '[data-tour="/admin/documents"]', title: 'Kho tài liệu', desc: 'Quản lý tài liệu dùng chung cho toàn hệ thống — nguồn tri thức của AI.' },
    { selector: '.dmrs-doc-card', title: 'Xem & quản lý', desc: 'Bấm một tài liệu để xem; di chuột để sửa hoặc xóa.' },
  ],
  '/admin/analytics': [
    { selector: '[data-tour="/admin/analytics"]', title: 'Thống kê truy vấn', desc: 'Theo dõi mức độ sử dụng và chất lượng phản hồi của AI.' },
    { selector: '.dmrs-stat-grid', title: 'Chỉ số tổng hợp', desc: 'Số truy vấn, tỉ lệ hài lòng và các chỉ số quan trọng khác.' },
    { selector: '.dmrs-content .dmrs-card', title: 'Biểu đồ chi tiết', desc: 'Xem lưu lượng theo thời gian và phân bố theo vai trò người dùng.' },
  ],
  '/admin/ai-quality': [
    { selector: '[data-tour="/admin/ai-quality"]', title: 'Chất lượng AI', desc: 'Đánh giá độ tin cậy câu trả lời và các phản hồi tiêu cực cần cải thiện.' },
    { selector: '.dmrs-content .dmrs-card', title: 'Chỉ số chất lượng', desc: 'Theo dõi điểm tin cậy, câu hỏi bị đánh giá thấp để tinh chỉnh tài liệu.' },
  ],
}
