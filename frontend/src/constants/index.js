// Hằng số dùng chung. KHÔNG hard-code URL trong component.
// URL backend (Render) nhúng lúc build qua VITE_API_URL. Bỏ "/" cuối để tránh "//api".
export const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:8000').trim().replace(/\/+$/, '')
if (import.meta.env.PROD && !import.meta.env.VITE_API_URL) {
  console.error('[config] Thiếu VITE_API_URL khi build — FE đang gọi http://localhost:8000.')
}

// Khóa lưu phiên đăng nhập trong localStorage (dùng chung FE).
export const AUTH_STORAGE_KEY = 'dmrs_auth'

// Google OAuth Client ID (đăng nhập bằng Gmail). Nhúng lúc build qua VITE_GOOGLE_CLIENT_ID.
export const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || ''

// Tập trung các endpoint của Back-end / AI tại đây.
// Khớp với FastAPI: prefix /api/v1 cho nghiệp vụ, /health cho health-check.
export const ENDPOINTS = {
  // Auth
    login: '/api/v1/auth/login',
    gmailLogin: '/api/v1/auth/gmail-login',
    register: '/api/v1/auth/register',
    registerVerify: '/api/v1/auth/register/verify',
    registerResendOtp: '/api/v1/auth/register/resend-otp',
    forgotPassword: '/api/v1/auth/forgot-password',
  verifyOtp: '/api/v1/auth/verify-otp',
  resetPassword: '/api/v1/auth/reset-password',
  // Chat RAG
  chat: '/api/v1/chat',
  chatStream: '/api/v1/chat/stream',
  billingMe: '/api/v1/billing/me',
  vnpayCheckout: '/api/v1/payments/vnpay/create',
  vnpayReconcile: '/api/v1/payments/vnpay/reconcile/',
  // Lịch sử hội thoại
  conversations: '/api/v1/conversations',
  // Thống kê realtime
  statsOverview: '/api/v1/stats/overview',
  statsAnalytics: '/api/v1/stats/analytics',
  // Quản trị người dùng
  users: '/api/v1/users',
  createUser: '/api/v1/create-user',
  // Dataset / ingest
  ingest: '/api/v1/datasets/rag-sample/ingest',
  // Tài liệu (giảng viên / quản trị)
  documents: '/api/v1/documents',
  documentsUpload: '/api/v1/documents/upload',
  documentsLink: '/api/v1/documents/link',
  documentsMine: '/api/v1/documents/mine',
  // Học vụ & Lớp học (giảng viên / quản trị)
  classrooms: '/api/v1/classrooms',
  students: '/api/v1/students',
  exams: '/api/v1/exams',
  // Học tập (Flashcard & Quiz)
  myQuizAttempts: '/api/v1/study-aid/my-attempts',
  recentSubmissions: '/api/v1/study-aid/recent-submissions',
  // Hệ thống
  status: '/api/v1/status',
  health: '/health',
}
