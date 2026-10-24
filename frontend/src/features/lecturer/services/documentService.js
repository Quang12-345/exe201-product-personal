// Service tài liệu của giảng viên — gọi backend thật (/api/v1/documents).
import api from '../../../services/api'
import { ENDPOINTS } from '../../../constants'

// Gợi ý môn học cho form upload (tĩnh, dùng cho dropdown + bộ lọc).
import { SUBJECTS } from '../../../constants/subjects'
// Backend chỉ nhận PDF/DOCX/PPTX — loại tệp suy ra từ phần mở rộng.
const DOC_TYPES = ['PDF', 'DOCX', 'PPTX']
export const CATEGORIES = [
  { value: 'regulation', label: 'Quy định / Quy chế' },
  { value: 'syllabus', label: 'Giáo trình môn học' },
]
const CATEGORY_LABEL = Object.fromEntries(CATEGORIES.map((c) => [c.value, c.label]))

export function getSubjects() { return SUBJECTS }
export function getDocTypes() { return DOC_TYPES }
export function categoryLabel(value) { return CATEGORY_LABEL[value] || 'Khác' }

// Map trạng thái xử lý của backend → trạng thái AI hiển thị trên giao diện.
function aiStatusOf(status) {
  if (status === 'ready') return 'indexed'
  if (typeof status === 'string' && status.startsWith('failed')) return 'error'
  return 'pending'
}

function formatDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('vi-VN')
}

// Chuẩn hóa DocumentResponse (backend) về shape mà các trang FE đang dùng.
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
    classroomId: doc.classroom_id || null,
    classroomName: doc.classroom_name || null,
  }
}

export async function getDocuments() {
  const { data } = await api.get(ENDPOINTS.documentsMine)
  return (data || [])
    .slice()
    .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
    .map(toView)
}

export async function getAvailableDocuments() {
  const { data } = await api.get(`${ENDPOINTS.documents}/available`)
  return (data || [])
    .slice()
    .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
    .map(toView)
}

export async function getDocument(id) {
  const docs = await getDocuments()
  return docs.find((d) => d.id === id) || null
}

// Tải lên 1 tệp thật + ingest. `file` là đối tượng File từ <input type="file">.
export async function uploadDocument({ file, subject, title, description, classroom_id }) {
  const formData = new FormData()
  formData.append('file', file)
  if (subject) formData.append('subject', subject)
  if (title) formData.append('title', title)
  if (description) formData.append('description', description)
  if (classroom_id) formData.append('classroom_id', classroom_id)
  const { data } = await api.post(ENDPOINTS.documentsUpload, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 180000, // ingest (docling + embedding) có thể lâu.
  })
  return { ...data, document: toView(data.document) }
}

// Đăng ký 1 tài liệu dạng liên kết (URL).
export async function submitLink({ url, subject, title, description }) {
  // timeout dài: link YouTube cần thời gian lấy transcript + embed.
  const { data } = await api.post(ENDPOINTS.documentsLink, { url, subject, title, description }, { timeout: 120000 })
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
