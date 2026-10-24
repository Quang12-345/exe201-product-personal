// Service quản lý tài liệu (Kho tài liệu) — gọi backend thật.
// Admin thấy toàn bộ tài liệu kèm chủ sở hữu (giảng viên) và phân loại.
import api from '../../../services/api'
import { ENDPOINTS } from '../../../constants'

import { SUBJECTS } from '../../../constants/subjects'
const FILE_TYPES = ['PDF', 'DOCX', 'PPTX', 'LINK', 'YOUTUBE']

// Phân loại tài liệu (đồng bộ với backend: regulation | syllabus).
export const CATEGORIES = [
  { value: 'regulation', label: 'Quy định / Quy chế' },
  { value: 'syllabus', label: 'Giáo trình môn học' },
]
const CATEGORY_LABEL = Object.fromEntries(CATEGORIES.map((c) => [c.value, c.label]))

export function getSubjects() { return SUBJECTS }
export function getFileTypes() { return FILE_TYPES }
export function categoryLabel(value) { return CATEGORY_LABEL[value] || 'Khác' }

function aiStatusOf(status) {
  if (status === 'ready') return 'indexed'
  if (typeof status === 'string' && status.startsWith('failed')) return 'error'
  return 'pending'
}

function formatDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('vi-VN')
}

function toView(doc) {
  return {
    id: doc.id,
    name: doc.title || doc.file_name,
    title: doc.title,
    size: '—',
    subject: doc.subject || '—',
    type: (doc.file_type || '').toUpperCase(),
    scope: doc.scope,
    category: doc.category,
    categoryLabel: categoryLabel(doc.category),
    description: doc.description || '',
    kind: doc.kind || 'file',
    url: doc.url || '',
    ownerId: doc.uploaded_by || '',
    owner: doc.uploaded_by_name || '—',
    uploadedAt: formatDate(doc.created_at),
    createdAt: doc.created_at || '',
    aiStatus: aiStatusOf(doc.status),
    status: doc.status,
    totalChunks: doc.total_chunks,
    totalPages: doc.total_pages,
  }
}

export async function getDocuments() {
  const { data } = await api.get(ENDPOINTS.documentsMine)
  return (data || [])
    .slice()
    .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
    .map(toView)
}

export async function getDocument(id) {
  const docs = await getDocuments()
  return docs.find((d) => d.id === id) || null
}

// Tải lên 1 tệp thật + ingest. `file` là File từ <input type="file">.
export async function uploadDocument({ file, subject, category, title, description }) {
  const formData = new FormData()
  formData.append('file', file)
  if (subject) formData.append('subject', subject)
  if (category) formData.append('category', category)
  if (title) formData.append('title', title)
  if (description) formData.append('description', description)
  const { data } = await api.post(ENDPOINTS.documentsUpload, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 180000,
  })
  return { ...data, document: toView(data.document) }
}

// Đăng ký 1 tài liệu dạng liên kết (URL).
export async function submitLink({ url, category, subject, title, description }) {
  // timeout dài: link YouTube cần thời gian lấy transcript + embed.
  const { data } = await api.post(ENDPOINTS.documentsLink, { url, category, subject, title, description }, { timeout: 120000 })
  return toView(data)
}

export async function deleteDocument(id) {
  await api.delete(`${ENDPOINTS.documents}/${id}`)
  return { id }
}

// Lấy URL tải xuống tạm thời cho bản gốc (lưu trên R2).
export async function updateDocument(id, data) {
  const payload = {}
  if (data.title != null) payload.title = data.title
  if (data.category != null) payload.category = data.category
  if (data.subject != null) payload.subject = data.subject
  const { data: updated } = await api.put(`${ENDPOINTS.documents}/${id}`, payload)
  return toView(updated)
}

export async function getDownloadUrl(id) {
  const { data } = await api.get(`${ENDPOINTS.documents}/${id}/download`)
  return data.url
}
