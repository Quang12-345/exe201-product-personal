import { useState, useCallback } from 'react'
import { sendMessage } from '../services/chatService'

// Custom hook: tách logic gọi API + state ra khỏi component UI.
export function useChat() {
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const send = useCallback(async (text) => {
    setLoading(true)
    setError(null)
    try {
      const reply = await sendMessage(text)
      setMessages((prev) => [...prev, { role: 'user', text }, { role: 'ai', text: reply.message }])
    } catch (err) {
      setError(err)
    } finally {
      setLoading(false)
    }
  }, [])

  return { messages, loading, error, send }
}
