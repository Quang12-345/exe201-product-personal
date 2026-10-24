// Service thông báo (dùng chung mọi vai trò). HIỆN TẠI: mock.
// Khi có BE: thay bằng GET /notifications, PATCH /notifications/read.

let _items = [
  { id: 'n1', title: 'Claude Cowork Ultimate Course (Beginner to Expert)', type: 'uploaded', time: '12 tháng 5 lúc 16:18', read: false },
  { id: 'n2', title: 'CLAUDE SKILLS: Thay Cả Phòng Marketing — Tự Research, Tạo Content, Ảnh và Báo Cáo', type: 'uploaded', time: '12 tháng 5 lúc 16:08', read: false },
  { id: 'n3', title: 'Học Claude AI: Cá Nhân Hóa và Quản Trị Dữ Liệu Trong Công Việc | Claude AI Thực Chiến', type: 'uploaded', time: '12 tháng 5 lúc 16:08', read: false },
  { id: 'n4', title: 'Hướng dẫn Claude AI Từ A–Z | Chat, Cowork, Code Cho Người Mới Bắt Đầu', type: 'uploaded', time: '11 tháng 5 lúc 09:30', read: true },
]

export function getNotifications() {
  return _items.map((n) => ({ ...n }))
}

export function markAllRead() {
  _items = _items.map((n) => ({ ...n, read: true }))
  return getNotifications()
}

// Nhãn theo loại thông báo.
export const TYPE_LABEL = { uploaded: 'Đã tải lên', processed: 'Đã xử lý', shared: 'Đã chia sẻ' }
