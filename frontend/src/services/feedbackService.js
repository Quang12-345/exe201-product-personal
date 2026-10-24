// Gửi/đọc feedback câu trả lời AI (Product AI feedback loop).
import api from './api'

// Đánh giá 1 câu trả lời: rating = 'up' | 'down', reason tuỳ chọn.
export async function sendFeedback({ messageId, rating, reason = '' }) {
  const { data } = await api.post('/api/v1/chat/feedback', {
    message_id: messageId,
    rating,
    reason,
  })
  return data // { ok, rating }
}

// Hoàn tác đánh giá hiện tại của user cho 1 câu trả lời.
export async function clearFeedback({ messageId }) {
  const { data } = await api.delete(`/api/v1/chat/feedback/${encodeURIComponent(messageId)}`)
  return data // { ok, rating: null }
}

// Tổng hợp feedback cho dashboard admin.
export async function getFeedbackSummary() {
  const { data } = await api.get('/api/v1/chat/feedback/summary')
  return data // { total, up, down, helpful_rate, recent: [...] }
}

// Báo cáo đánh giá RAG offline gần nhất (AI Evaluation).
export async function getEvalReport() {
  const { data } = await api.get('/api/v1/chat/eval/report')
  return data // { available, summary, generated_at }
}

// Ghi tín hiệu implicit (hành vi) / system (hệ thống). Fire-and-forget.
export function sendSignal({ messageId, kind, name, value }) {
  if (!messageId) return Promise.resolve()
  return api.post('/api/v1/chat/signal', { message_id: messageId, kind, name, value }).catch(() => {})
}

// Tổng hợp tín hiệu implicit + system cho dashboard admin.
export async function getSignalsSummary() {
  const { data } = await api.get('/api/v1/chat/signals/summary')
  return data // { answers_with_system, grounded_rate, avg_confidence, opened_source, copied, saved }
}
