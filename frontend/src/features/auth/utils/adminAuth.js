// Quản lý các tiền tố / hậu tố và quy tắc xác thực tài khoản Quản trị viên (Admin)

// Danh sách các đuôi email được cấp phép cho Quản trị viên
export const ALLOWED_ADMIN_SUFFIXES = [
  '@ai20k.vn',
  '@admin.studymind.vn',
  '@studymind.edu.vn',
]

/**
 * Kiểm tra tính hợp lệ của tài khoản / email Quản trị viên
 * @param {string} identifier Tên tài khoản hoặc email
 * @returns {{ valid: boolean, message: string }} Kết quả kiểm tra kèm thông báo
 */
export function checkAdminSuffix(identifier) {
  if (!identifier) {
    return { valid: false, message: 'Vui lòng nhập tài khoản hoặc email quản trị viên.' }
  }
  const s = identifier.trim().toLowerCase()
  if (s === 'admin') {
    return { valid: true, message: 'Tài khoản root admin hệ thống hợp lệ.' }
  }
  if (!s.includes('@')) {
    return {
      valid: false,
      message: 'Tài khoản email phải có ký tự @ và đuôi hợp lệ.',
    }
  }
  const matched = ALLOWED_ADMIN_SUFFIXES.find((domain) => s.endsWith(domain.toLowerCase()))
  if (matched) {
    return { valid: true, message: `Đuôi email quản trị viên hợp lệ (${matched})` }
  }
  return {
    valid: false,
    message: `Đuôi email không được phép. Yêu cầu: ${ALLOWED_ADMIN_SUFFIXES.join(', ')}`,
  }
}
