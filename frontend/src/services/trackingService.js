import api from './api.js'

const VISITOR_STORAGE_KEY = 'sm_visitor_id'

/**
 * Lấy hoặc tạo mới mã định danh khách ẩn danh (persistent visitor UUID).
 */
function getOrCreateVisitorId() {
  try {
    let id = localStorage.getItem(VISITOR_STORAGE_KEY)
    if (!id) {
      id = 'vis_' + Math.random().toString(36).substring(2, 12) + Date.now().toString(36)
      localStorage.setItem(VISITOR_STORAGE_KEY, id)
    }
    return id
  } catch {
    return 'vis_anon_' + Date.now()
  }
}

/**
 * Nhận diện loại thiết bị (desktop, mobile, tablet).
 */
function getDeviceType() {
  const ua = (navigator.userAgent || '').toLowerCase()
  if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) {
    return 'tablet'
  }
  if (
    /Mobile|Android|iP(hone|od)|IEMobile|BlackBerry|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/.test(
      ua
    ) ||
    window.innerWidth < 768
  ) {
    return 'mobile'
  }
  return 'desktop'
}

/**
 * Ghi nhận một lượt xem trang (Page View) tự động gửi về backend.
 */
export async function recordPageView(path, pageTitle = '') {
  try {
    const visitorId = getOrCreateVisitorId()
    const deviceType = getDeviceType()
    const referrer = document.referrer || null

    await api.post('/api/v1/tracking/visit', {
      path: path || window.location.pathname,
      page_title: pageTitle || document.title || '',
      visitor_id: visitorId,
      device_type: deviceType,
      referrer,
    })
  } catch {
    // Không làm gián đoạn người dùng nếu tracking gặp lỗi mạng
  }
}

/**
 * Lấy báo cáo thống kê lưu lượng truy cập trang web cho Admin.
 */
export async function getWebTrafficStats(range = '14d') {
  const res = await api.get('/api/v1/admin/traffic/stats', {
    params: { range },
  })
  return res.data
}
