// Quản lý các cuộc trò chuyện Chat AI (lịch sử) — lưu localStorage.
// HIỆN TẠI: lưu phía client. Khi có BE, thay load/persist bằng api.get/post.

import { getInitialMessages } from './chatService'

const KEY = 'dmrs_conversations'

// Tin nhắn chào mở đầu cho cuộc trò chuyện mới.
function greeting() {
  return [
    {
      id: 'g' + Date.now(),
      from: 'ai',
      time: 'Bây giờ',
      text: 'Xin chào! Tôi là trợ lý AI của hệ thống DMRS. Bạn cần hỗ trợ gì hôm nay?',
      canSave: true,
    },
  ]
}

// Cuộc trò chuyện mẫu ban đầu (dùng lại hội thoại demo).
function seed() {
  const list = [
    {
      id: 'c1',
      title: 'Quy định đăng ký học phần',
      updatedAt: '10:33 AM',
      messages: getInitialMessages(),
    },
    {
      id: 'c2',
      title: 'Điều kiện xét học bổng',
      updatedAt: 'Hôm qua',
      messages: greeting(),
    },
  ]
  persistConversations(list)
  return list
}

export function loadConversations() {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return JSON.parse(raw)
  } catch {
    /* ignore */
  }
  return seed()
}

export function persistConversations(list) {
  localStorage.setItem(KEY, JSON.stringify(list))
}

// Tạo object cuộc trò chuyện mới (chưa lưu).
export function makeConversation() {
  return {
    id: 'c' + Date.now(),
    title: 'Cuộc trò chuyện mới',
    updatedAt: 'Bây giờ',
    messages: greeting(),
  }
}

// Sinh link chia sẻ (mock). Khi có BE sẽ trả token thật từ server.
export function buildShareLink(conversationId) {
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  return `${origin}/student/chat/shared/${conversationId}`
}

// Rút gọn tin nhắn cuối làm preview cho danh sách.
export function previewOf(conversation) {
  const last = conversation.messages[conversation.messages.length - 1]
  if (!last) return ''
  const t = last.text || ''
  return t.length > 60 ? t.slice(0, 60) + '…' : t
}
