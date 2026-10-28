// Service xác thực dùng chung cho mọi vai trò (admin / lecturer / student).
// Đã nối Back-end thật: POST /api/v1/auth/login → { token, user }.
import api from '../../../services/api'
import { AUTH_STORAGE_KEY, ENDPOINTS } from '../../../constants'

const STORAGE_KEY = AUTH_STORAGE_KEY

// Trang chủ mặc định theo vai trò — dùng để điều hướng sau đăng nhập.
export const HOME_BY_ROLE = { admin: '/admin', student: '/student', lecturer: '/lecturer' }

// Tài khoản demo (đăng nhập bằng email, mật khẩu seed qua scripts/seed_demo.py):
//   admin@ai20k.vn / admin123 · lecturer@ai20k.vn / lecturer123 · student@ai20k.vn / student123

function messageFromError(error, fallback) {
  const detail = error?.response?.data?.detail
  return typeof detail === 'string' ? detail : fallback
}

// Gọi API login với timeout dài (60s) để chịu được "cold start" của server (Render
// free ngủ sau 15' → request đầu mất 30-60s). Trả về response axios.
function postLogin(username, password) {
  return api.post(ENDPOINTS.login, { username, password }, { timeout: 60000 })
}

export async function login({ username, password }) {
  let data
  try {
    ;({ data } = await postLogin(username, password))
  } catch (error) {
    // Sai tài khoản/mật khẩu (401) → báo ngay, KHÔNG thử lại.
    if (error?.response?.status === 401) {
      throw new Error(messageFromError(error, 'Sai tài khoản hoặc mật khẩu'))
    }
    if (error?.response?.status === 403) {
      throw new Error(messageFromError(error, 'Tài khoản không được phép đăng nhập'))
    }
    // Lỗi mạng/timeout/server khởi động nguội → tự THỬ LẠI 1 lần (khỏi phải bấm 2 lần).
    try {
      ;({ data } = await postLogin(username, password))
    } catch (retryError) {
      if (retryError?.response?.status === 401) {
        throw new Error(messageFromError(retryError, 'Sai tài khoản hoặc mật khẩu'))
      }
      if (retryError?.response?.status === 403) {
        throw new Error(messageFromError(retryError, 'Tài khoản không được phép đăng nhập'))
      }
      throw new Error('Máy chủ đang khởi động hoặc mạng chậm. Vui lòng thử lại sau giây lát.')
    }
  }
  // BE trả { token, token_type, user }. Nếu thiếu → thường do VITE_API_URL trỏ sai
  // (request đập vào chính frontend và nhận về index.html), báo lỗi rõ ràng.
  if (!data || typeof data !== 'object' || !data.token || !data.user) {
    throw new Error(
      'Phản hồi đăng nhập không hợp lệ từ máy chủ. Kiểm tra VITE_API_URL có trỏ đúng URL backend không.',
    )
  }
  const session = { token: data.token, user: data.user }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
  return session
}

// Đăng nhập bằng Gmail: gửi ID token (credential) của Google cho backend xác minh.
export async function gmailLogin(credential) {
  let data
  try {
    try {
      const parts = credential.split('.')
      if (parts.length === 3) {
        const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')))
        console.log('[Google Auth] Token Payload:', {
          email: payload.email,
          aud: payload.aud,
          iss: payload.iss,
          name: payload.name,
        })
      }
    } catch {
      // ignore parse error
    }

    ;({ data } = await api.post(ENDPOINTS.gmailLogin, { credential }, { timeout: 60000 }))
  } catch (error) {
    const detail = error?.response?.data?.detail
    const targetUrl = ENDPOINTS.gmailLogin
    console.error('[Google Auth] Chi tiết lỗi từ Backend:', {
      targetUrl,
      status: error?.response?.status,
      detail,
      rawError: error,
    })
    throw new Error(messageFromError(error, 'Đăng nhập bằng Google thất bại'))
  }
  // Backend trả { access_token, user } (chấp nhận cả token cho chắc).
  const token = data?.access_token || data?.token
  if (!token || !data?.user) {
    throw new Error('Phản hồi đăng nhập Google không hợp lệ từ máy chủ.')
  }
  const session = { token, user: data.user }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
  return session
}

// export async function registerAccount({ email, password, name }) {
//   try {
//     const { data } = await api.post(ENDPOINTS.register, { email, password, name }, { timeout: 60000 })
//     return data
//   } catch (error) {
//     throw new Error(messageFromError(error, 'Không đăng ký được tài khoản, vui lòng thử lại'))
//   }
// }

// export async function verifyRegisterOtp(email, otpCode) {
//   try {
//     const { data } = await api.post(ENDPOINTS.registerVerify, { email, otp_code: otpCode })
//     return data
//   } catch (error) {
//     throw new Error(messageFromError(error, 'Mã OTP không hợp lệ'))
//   }
// }

// export async function resendRegisterOtp(email) {
//   try {
//     const { data } = await api.post(ENDPOINTS.registerResendOtp, { email })
//     return data
//   } catch (error) {
//     throw new Error(messageFromError(error, 'Không gửi lại được mã OTP'))
//   }
// }

export function logout() {
  localStorage.removeItem(STORAGE_KEY)
}

export function saveSession(session) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
}

export function getStoredSession() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

// Bước 1: gửi OTP về email đã đăng ký.
export async function requestPasswordReset(email) {
  try {
    const { data } = await api.post(ENDPOINTS.forgotPassword, { email })
    return data
  } catch (error) {
    throw new Error(messageFromError(error, 'Không gửi được yêu cầu, vui lòng thử lại'))
  }
}

// Bước 2: xác minh mã OTP (6 số).
export async function verifyOtp(email, otpCode) {
  try {
    const { data } = await api.post(ENDPOINTS.verifyOtp, { email, otp_code: otpCode })
    return data
  } catch (error) {
    throw new Error(messageFromError(error, 'Mã OTP không hợp lệ'))
  }
}

// Bước 3: đặt lại mật khẩu mới (kèm OTP đã xác minh).
export async function resetPassword(email, otpCode, newPassword) {
  try {
    const { data } = await api.post(ENDPOINTS.resetPassword, {
      email,
      otp_code: otpCode,
      new_password: newPassword,
    })
    return data
  } catch (error) {
    throw new Error(messageFromError(error, 'Không đặt lại được mật khẩu, vui lòng thử lại'))
  }
}

export async function updateUserPassword(userId, password) {
  try {
    const { data } = await api.put(`${ENDPOINTS.users}/${userId}`, { password })
    return data
  } catch (error) {
    throw new Error(messageFromError(error, 'Không cập nhật được mật khẩu, vui lòng thử lại'))
  }
}
