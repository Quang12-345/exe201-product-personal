import { useState, useEffect, useCallback, useRef } from 'react'
import { sendChatStream } from '../services/chatStream'
import { sendSignal } from '../services/feedbackService'
import { notify } from '../components/common/toast.jsx'
import {
  listConversations,
  getMessages,
  deleteConversation,
  renameConversation,
} from '../services/conversationsApi'

const NEW = '__new__'

// Hook quản lý hội thoại Chat AI dùng chung (student + lecturer), nối backend thật.
// Hội thoại lưu trong DB; mỗi tin nhắn gửi kèm conversation_id để không bị tách rời.
// Hội thoại mới chỉ được tạo ở backend khi gửi tin nhắn đầu tiên (tự đặt tiêu đề theo câu hỏi).
export function useChatConversations({ greeting, openLatestOnMount = true }) {
  const [list, setList] = useState([])
  const [activeId, setActiveId] = useState(NEW)
  const [messages, setMessages] = useState(() => [greeting()])
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const activeIdRef = useRef(activeId)
  activeIdRef.current = activeId

  const refreshList = useCallback(async () => {
    try {
      return await listConversations()
    } catch {
      return []
    }
  }, [])

  const openConversation = useCallback(async (id) => {
    setActiveId(id)
    setLoading(true)
    try {
      const msgs = await getMessages(id)
      setMessages(msgs.length ? msgs : [greeting()])
    } catch {
      setMessages([greeting()])
    } finally {
      setLoading(false)
    }
  }, [greeting])

  const startNew = useCallback(() => {
    setActiveId(NEW)
    setMessages([greeting()])
    setLoading(false)
  }, [greeting])

  // Nạp danh sách + mở hội thoại gần nhất khi vào trang, trừ khi caller muốn bắt đầu chat mới.
  useEffect(() => {
    let alive = true
    ;(async () => {
      const items = await refreshList()
      if (!alive) return
      setList(items)
      if (items.length && openLatestOnMount) await openConversation(items[0].id)
      else startNew()
    })()
    return () => { alive = false }
  }, [refreshList, openConversation, startNew, openLatestOnMount])

  const patchMessage = (id, updater) =>
    setMessages((prev) => prev.map((m) => (m.id === id ? updater(m) : m)))

  const send = async (text) => {
    const trimmed = (text || '').trim()
    if (!trimmed || sending) return
    const aiId = 'm' + Date.now()
    setMessages((prev) => [
      ...prev,
      { id: 'u' + Date.now(), from: 'user', text: trimmed, time: 'Bây giờ' },
      { id: aiId, from: 'ai', text: '', sources: [], time: 'Bây giờ', canSave: true },
    ])
    setSending(true)
    const convArg = activeIdRef.current === NEW ? null : activeIdRef.current
    await sendChatStream(trimmed, {
      conversationId: convArg,
      onToken: (tok) => patchMessage(aiId, (m) => ({ ...m, text: m.text + tok })),
      onError: (msg) => patchMessage(aiId, (m) => ({ ...m, text: msg, canSave: false })),
      onDone: async ({ conversationId, sources, messageId, confidence }) => {
        if (sources?.length || messageId || confidence) {
          patchMessage(aiId, (m) => ({
            ...m,
            sources: sources?.length ? sources : m.sources,
            messageId,
            confidence: confidence || m.confidence,
          }))
        }
        // Tín hiệu SYSTEM: độ tin cậy do BACKEND tính (đa tín hiệu, đã hiệu chuẩn) để
        // dashboard "Chất lượng AI" khớp với badge hiển thị cho người dùng.
        if (messageId && confidence) {
          sendSignal({ messageId, kind: 'system', name: 'grounded', value: confidence.grounded ? 1 : 0 })
          sendSignal({ messageId, kind: 'system', name: 'confidence', value: Number(confidence.value.toFixed(4)) })
        }
        if (conversationId && conversationId !== activeIdRef.current) {
          setActiveId(conversationId)
        }
        setList(await refreshList())
      },
    })
    setSending(false)
  }

  const select = (id) => { if (id !== activeId) openConversation(id) }

  const createNew = () => startNew()

  const remove = async (id) => {
    try {
      await deleteConversation(id)
      notify('Xóa cuộc trò chuyện thành công.')
    } catch {
      notify('Xóa cuộc trò chuyện thất bại. Vui lòng thử lại.', 'error')
    }
    const items = await refreshList()
    setList(items)
    if (id === activeIdRef.current) {
      if (items.length) await openConversation(items[0].id)
      else startNew()
    }
  }

  const rename = async (id, title) => {
    if (!title) return
    try {
      const updated = await renameConversation(id, title)
      setList((prev) => prev.map((c) => (
        c.id === id
          ? { ...c, ...updated, title: updated.title || title }
          : c
      )))
      notify('Đổi tên cuộc trò chuyện thành công.')
    } catch {
      notify('Đổi tên thất bại. Vui lòng thử lại.', 'error')
    }
  }

  const activeSummary = list.find((c) => c.id === activeId)
  const active = {
    id: activeId,
    title: activeId === NEW ? 'Cuộc trò chuyện mới' : activeSummary?.title || 'Cuộc trò chuyện',
    messages,
  }

  return { list, activeId, active, messages, sending, loading, send, createNew, select, remove, rename }
}
