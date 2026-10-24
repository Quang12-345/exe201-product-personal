// Câu trả lời đã lưu (bookmark cá nhân) — lưu localStorage, bền theo trình duyệt.
const KEY = 'dmrs_saved_answers'

function load() {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function persist(list) {
  localStorage.setItem(KEY, JSON.stringify(list))
}

export function getSaved() {
  return load()
}

export function getSavedById(id) {
  return load().find((x) => x.id === id) || null
}

// Lưu 1 câu trả lời. Trả về item đã lưu (hoặc item trùng nếu đã lưu cùng nội dung).
export function saveAnswer({ title, content, tag = 'Chat AI' }) {
  const list = load()
  const text = (content || '').trim()
  const existing = list.find((x) => x.content === text)
  if (existing) return existing
  const item = {
    id: 's' + Date.now(),
    title: (title || 'Câu trả lời').trim().slice(0, 120),
    snippet: text.replace(/\s+/g, ' ').slice(0, 160),
    content: text,
    tag,
    date: new Date().toLocaleDateString('vi-VN'),
  }
  persist([item, ...list])
  return item
}

export function removeSaved(id) {
  const list = load().filter((x) => x.id !== id)
  persist(list)
  return list
}
