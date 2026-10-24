// Service phụ trợ Chat AI cho sinh viên: CHỈ còn dữ liệu hiển thị (tin nhắn chào
// mẫu + FAQ). Luồng GỬI/NHẬN chat đã được HỢP NHẤT dùng chung cho student và
// lecturer:
//   hooks/useChatConversations.js → services/chatStream.js (sendChatStream)
//   → render bằng components/common/ChatMessage.jsx (có hộp "Nguồn trích dẫn").
// KHÔNG còn hàm gửi chat riêng theo vai trò (trước đây student streaming + chèn
// nguồn vào text, lecturer non-streaming + không nguồn) để hai bên không lệch nhau.

// Hội thoại khởi tạo (tin nhắn mẫu trong ảnh thiết kế).
export function getInitialMessages() {
  return [
    {
      id: 'm1',
      from: 'ai',
      time: '10:30 AM',
      text: 'Chào Nguyễn Văn A! Tôi là trợ lý AI của hệ thống DMRS. Tôi có thể giúp bạn tìm kiếm tài liệu học tập, quy định đào tạo hoặc giải đáp các thắc mắc về hệ thống. Bạn cần hỗ trợ gì hôm nay?',
      canSave: true,
    },
    {
      id: 'm2',
      from: 'user',
      time: '10:32 AM',
      text: 'Cho mình hỏi về quy định đăng ký học phần bổ sung của học kỳ này.',
    },
    {
      id: 'm3',
      from: 'ai',
      time: '10:33 AM',
      text: 'Dựa trên tài liệu "Quy chế Đào tạo 2024", đây là các mốc thời gian quan trọng bạn cần lưu ý:',
      table: {
        head: ['Giai đoạn', 'Thời gian', 'Trạng thái'],
        rows: [
          ['Đăng ký đợt 1', '15/08 - 20/08', { label: 'Thành công', variant: 'success' }],
          ['Điều chỉnh đợt cuối', '01/09 - 05/09', { label: 'Chờ xử lý', variant: 'warning' }],
        ],
      },
      after: 'Bạn có muốn tôi gửi file đính kèm chi tiết về quy trình này không?',
      actions: ['Tải quy trình (PDF)', 'Xem hướng dẫn video'],
      canSave: true,
    },
  ]
}

export function getFaqs() {
  return [
    'Cách tính điểm trung bình tích lũy?',
    'Thủ tục xin cấp lại thẻ sinh viên',
    'Quy định về chuẩn đầu ra ngoại ngữ',
    'Làm sao để đăng ký học phần bổ sung?',
    'Khi nào có lịch thi cuối kỳ?',
    'Cách xem và tải tài liệu môn học?',
    'Quy trình xin hoãn thi hoặc thi lại?',
    'Điều kiện xét học bổng theo học kỳ là gì?',
    'Cách kiểm tra học phí còn nợ?',
    'Quên mật khẩu tài khoản sinh viên thì làm gì?',
    'Cách liên hệ phòng đào tạo khi cần hỗ trợ?',
  ]
}
