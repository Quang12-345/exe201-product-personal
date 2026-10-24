// Các hàm tiện ích thuần (không phụ thuộc React).

// Định dạng ngày giờ theo locale Việt Nam và múi giờ máy người dùng.
// Nếu chuỗi thời gian chưa có thông tin múi giờ (chuẩn UTC từ backend), tự động gắn 'Z'
// để JavaScript chuyển đổi chính xác sang giờ địa phương trên máy tính của người dùng.
export function formatDate(date) {
  if (!date) return ''
  try {
    let str = String(date).trim()
    if (!str.endsWith('Z') && !/[+-]\d{2}:?\d{2}$/.test(str)) {
      str = str.replace(' ', 'T') + 'Z'
    }
    const d = new Date(str)
    return isNaN(d.getTime()) ? String(date) : d.toLocaleString('vi-VN')
  } catch {
    return String(date)
  }
}

// Cắt chuỗi quá dài và thêm dấu "...".
export function truncate(text, max = 100) {
  if (text.length <= max) return text
  return text.slice(0, max) + '…'
}
