import axios from 'axios'
import { API_URL, AUTH_STORAGE_KEY } from '../constants'

// Một axios instance dùng chung cho toàn app.
// Mọi service khác import instance này thay vì gọi axios trực tiếp.
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    Pragma: 'no-cache',
    Expires: '0',
  },
  timeout: 30000,
})

// Đọc token đã lưu khi đăng nhập (session: { token, user }).
function getStoredToken() {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY)
    return raw ? JSON.parse(raw)?.token ?? null : null
  } catch {
    return null
  }
}

// Request interceptor: tự gắn JWT vào mọi request nếu đã đăng nhập.
api.interceptors.request.use((config) => {
  const token = getStoredToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Response interceptor: xử lý lỗi tập trung. 401 → xóa phiên + đưa về login.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem(AUTH_STORAGE_KEY)
      if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
        window.location.assign('/login')
      }
    }
    return Promise.reject(error)
  }
)

export default api
