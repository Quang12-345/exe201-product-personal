// Chat RAG dạng streaming (SSE) dùng chung — có hỗ trợ conversation_id.
// Quan trọng: khi streaming KHÔNG hoạt động (proxy buffer/đứt SSE trên môi trường
// deploy như Render), tự động fallback sang endpoint /chat thường (1 request/response)
// để chatbot LUÔN trả lời được, không bị treo "AI đang trả lời".
import { API_URL, AUTH_STORAGE_KEY, ENDPOINTS } from '../constants'

function storedToken() {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY)
    return raw ? JSON.parse(raw)?.token ?? null : null
  } catch {
    return null
  }
}

function authHeaders(token) {
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

// Fallback không streaming: gọi /chat (trả về toàn bộ câu trả lời 1 lần).
// Dùng khi SSE không khả dụng. Phát nguyên câu trả lời qua onToken rồi onDone.
async function fallbackChat(text, { conversationId, topK, token, onToken, onDone, onError, requestId }) {
  try {
    const res = await fetch(API_URL + ENDPOINTS.chat, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({ message: text, top_k: topK, conversation_id: conversationId, request_id: requestId }),
    })
    if (!res.ok) {
      const errorBody = await res.json().catch(() => ({}))
      const detail = errorBody?.detail
      onError?.(typeof detail === 'string' ? detail : detail?.message || 'Xin lỗi, không kết nối được trợ lý AI. Vui lòng thử lại.')
      return
    }
    const data = await res.json()
    const answer = (data && (data.response ?? data.message)) || ''
    if (answer) onToken?.(answer)
    onDone?.({
      conversationId: data?.conversation_id || conversationId,
      sources: data?.sources || [],
      messageId: data?.message_id || null,
      confidence: data?.confidence != null
        ? { grounded: !!data.grounded, value: data.confidence, level: data.confidence_level || 'thấp', factors: null }
        : null,
    })
  } catch {
    onError?.('Xin lỗi, đã có lỗi khi gọi trợ lý AI. Vui lòng thử lại.')
  }
}

// sendChatStream(text, { conversationId, topK, onToken, onDone, onError })
//  - onToken(token): mỗi token mới
//  - onDone({ conversationId, sources }): khi hoàn tất
//  - onError(message)
export async function sendChatStream(text, handlers = {}) {
  const { conversationId = null, topK = 5, onToken, onDone, onError } = handlers
  const token = storedToken()
  const requestId = globalThis.crypto?.randomUUID?.() || `chat-${Date.now()}-${Math.random().toString(16).slice(2)}`
  const fallbackArgs = { conversationId, topK, token, onToken, onDone, onError, requestId }

  let receivedAny = false // đã nhận được token/sự kiện nào từ stream chưa
  try {
    const res = await fetch(API_URL + ENDPOINTS.chatStream, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({ message: text, top_k: topK, conversation_id: conversationId, request_id: requestId }),
    })
    // Stream không sẵn sàng (lỗi HTTP / không có body) → dùng fallback.
    if (!res.ok || !res.body) {
      if (!res.ok && res.status === 429) {
        const errorBody = await res.json().catch(() => ({}))
        const detail = errorBody?.detail
        onError?.(typeof detail === 'string' ? detail : detail?.message || 'Bạn đã dùng hết lượt hỏi hôm nay.')
        return
      }
      await fallbackChat(text, fallbackArgs)
      return
    }

    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let convId = conversationId
    let sources = []
    let messageId = null
    let confidence = null
    let streamError = null
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const parts = buffer.split('\n\n')
      buffer = parts.pop() ?? ''
      for (const part of parts) {
        const line = part.trim()
        if (!line.startsWith('data:')) continue
        let evt
        try {
          evt = JSON.parse(line.slice(5).trim())
        } catch {
          continue
        }
        receivedAny = true
        if (evt.type === 'token') {
          onToken?.(evt.token)
        } else if (evt.type === 'error') {
          streamError = evt.message || 'Đã có lỗi khi tạo câu trả lời.'
        } else if (evt.type === 'done') {
          if (evt.conversation_id) convId = evt.conversation_id
          if (evt.sources) sources = evt.sources
          if (evt.message_id) messageId = evt.message_id
          if (evt.confidence != null) {
            confidence = {
              grounded: !!evt.grounded,
              value: evt.confidence,
              level: evt.confidence_level || 'thấp',
              factors: evt.confidence_factors || null,
            }
          }
        }
      }
    }

    // Stream kết thúc nhưng KHÔNG nhận được sự kiện nào (proxy nuốt/đứt SSE) → fallback.
    if (!receivedAny) {
      await fallbackChat(text, fallbackArgs)
      return
    }
    if (streamError) onError?.(streamError)
    onDone?.({ conversationId: convId, sources, messageId, confidence })
  } catch {
    // Lỗi mạng/đứt kết nối khi CHƯA nhận được gì → thử fallback không streaming.
    if (!receivedAny) {
      await fallbackChat(text, fallbackArgs)
      return
    }
    onError?.('Xin lỗi, đã có lỗi khi gọi trợ lý AI. Vui lòng thử lại.')
  }
}
