// Danh sách môn học dùng chung (dropdown upload + bộ lọc + học vụ).
// Theo chương trình VinUni — College of Engineering & Computer Science (CECS),
// kèm các môn toán nền tảng và đại cương. Giữ nguyên các tên cũ để dữ liệu khớp.

// Nhóm môn học — dùng để gán icon/màu theo nhóm trong bộ lọc.
export const SUBJECT_GROUPS = [
  {
    key: 'cs',
    label: 'Khoa học Máy tính & Kỹ thuật',
    subjects: [
      'Nhập môn Khoa học Máy tính',
      'Lập trình C',
      'Lập trình Hướng đối tượng',
      'Cấu trúc dữ liệu và Giải thuật',
      'Cơ sở dữ liệu',
      'Hệ điều hành',
      'Kiến trúc Máy tính',
      'Mạng máy tính',
      'Công nghệ phần mềm',
      'Phát triển Web',
      'Phát triển Ứng dụng Di động',
      'Nhập môn Trí tuệ Nhân tạo (INT3401)',
      'Học máy (Machine Learning)',
      'Học sâu (Deep Learning)',
      'Khoa học Dữ liệu',
      'Thị giác Máy tính',
      'Xử lý Ngôn ngữ Tự nhiên',
      'An toàn và Bảo mật Thông tin',
      'Điện toán Đám mây',
      'Tương tác Người - Máy (HCI)',
      'Lý thuyết Tính toán',
    ],
  },
  {
    key: 'math',
    label: 'Toán & nền tảng',
    subjects: [
      'Giải tích',
      'Đại số Tuyến tính',
      'Toán Rời rạc',
      'Xác suất và Thống kê',
      'Phương pháp Số',
    ],
  },
  {
    key: 'general',
    label: 'Đại cương',
    subjects: [
      'Tiếng Anh Học thuật',
      'Tư duy Thiết kế (Design Thinking)',
      'Khởi nghiệp và Đổi mới Sáng tạo',
      'Kinh tế học Đại cương',
      'Kỹ năng Giao tiếp',
      'Môn học khác',
    ],
  },
]

export const SUBJECTS = SUBJECT_GROUPS.flatMap((g) => g.subjects)

// Tra nhóm của một môn học (trả 'other' nếu không khớp).
const SUBJECT_TO_GROUP = Object.fromEntries(
  SUBJECT_GROUPS.flatMap((g) => g.subjects.map((s) => [s, g.key])),
)
export function subjectGroupKey(name) {
  return SUBJECT_TO_GROUP[name] || 'other'
}

export default SUBJECTS
