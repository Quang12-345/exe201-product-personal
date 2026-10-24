// API lịch sử hội thoại Chat AI (dùng chung cho student + lecturer).
import api from './api'
import { ENDPOINTS } from '../constants'

function timeLabel(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const today = new Date()
  const sameDay = d.toDateString() === today.toDateString()
  return sameDay
    ? d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString('vi-VN')
}

function toSummary(c) {
  return {
    id: c.id,
    title: c.title || 'Cuộc trò chuyện mới',
    preview: c.preview || '',
    messageCount: c.message_count || 0,
    updatedAt: timeLabel(c.updated_at),
  }
}

// Backend message {role, content, sources} -> shape FE {from, text, sources}.
export function toUiMessage(m) {
  // Độ tin cậy đã lưu (assess_answer): {grounded, confidence, level, factors} → shape FE.
  const c = m.confidence
  const confidence = c && typeof c === 'object'
    ? { grounded: !!c.grounded, value: c.confidence ?? 0, level: c.level || 'thấp', factors: c.factors || null }
    : null
  return {
    id: m.id,
    from: m.role === 'user' ? 'user' : 'ai',
    text: m.content || '',
    sources: m.sources || [],
    confidence,
    // messageId để gắn feedback; myRating khôi phục 👍/👎 đã bấm (giữ qua reload).
    messageId: m.role === 'user' ? null : m.id,
    myRating: m.my_rating || null,
    time: timeLabel(m.created_at),
    canSave: m.role !== 'user',
  }
}

export async function listConversations() {
  const { data } = await api.get(ENDPOINTS.conversations)
  return (data || []).map(toSummary)
}

export async function getMessages(conversationId) {
  const { data } = await api.get(`${ENDPOINTS.conversations}/${conversationId}/messages`)
  return (data || []).map(toUiMessage)
}

export async function renameConversation(conversationId, title) {
  const { data } = await api.put(`${ENDPOINTS.conversations}/${conversationId}`, { title })
  return toSummary(data)
}

export async function deleteConversation(conversationId) {
  await api.delete(`${ENDPOINTS.conversations}/${conversationId}`)
  return { id: conversationId }
}
