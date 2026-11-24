import api from './api'

/**
 * Lấy danh sách đánh giá khách hàng công khai kèm điểm trung bình (CSAT) và phân bổ sao.
 */
export async function getPublicReviews() {
  const res = await api.get('/api/v1/reviews/public')
  return res.data
}

/**
 * Người dùng gửi đánh giá / nhận xét về StudyMind.
 * @param {Object} payload
 * @param {number} payload.rating - 1..5 sao
 * @param {string} [payload.title] - Tiêu đề ngắn (tùy chọn)
 * @param {string} payload.comment - Lời nhận xét
 * @param {string} [payload.roleTag] - Tag vai trò / khóa / khoa (tùy chọn)
 * @param {string} [payload.category] - general | rag_ai | study_aid | exam | pricing
 */
export async function submitCustomerReview({
  rating,
  title = '',
  comment,
  roleTag = '',
  category = 'general',
}) {
  const res = await api.post('/api/v1/reviews', {
    rating: Number(rating),
    title: (title || '').trim(),
    comment: (comment || '').trim(),
    role_tag: (roleTag || '').trim(),
    category,
  })
  return res.data
}

/**
 * Admin: Lấy toàn bộ đánh giá kèm phân tích CSAT chi tiết.
 */
export async function getAdminReviews() {
  const res = await api.get('/api/v1/admin/reviews')
  return res.data
}

/**
 * Admin: Bật/tắt trạng thái hiển thị của review trên trang chủ.
 */
export async function togglePublishReview(reviewId) {
  const res = await api.patch(`/api/v1/admin/reviews/${encodeURIComponent(reviewId)}/toggle-publish`)
  return res.data
}

/**
 * Admin: Ghim/bỏ ghim review nổi bật.
 */
export async function toggleFeatureReview(reviewId) {
  const res = await api.patch(`/api/v1/admin/reviews/${encodeURIComponent(reviewId)}/toggle-feature`)
  return res.data
}

/**
 * Admin: Xóa một review.
 */
export async function deleteCustomerReview(reviewId) {
  const res = await api.delete(`/api/v1/admin/reviews/${encodeURIComponent(reviewId)}`)
  return res.data
}
