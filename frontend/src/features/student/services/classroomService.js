import api from '../../../services/api'
import { ENDPOINTS } from '../../../constants'

// Format ngày tháng hiển thị
function formatDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('vi-VN')
}

function aiStatusOf(status) {
  if (status === 'ready') return 'indexed'
  if (typeof status === 'string' && status.startsWith('failed')) return 'error'
  return 'pending'
}

export function toDocumentView(doc) {
  return {
    id: doc.id,
    name: doc.title || doc.file_name,
    title: doc.title,
    size: '—',
    subject: doc.subject || '—',
    type: (doc.file_type || '').toUpperCase(),
    scope: doc.scope,
    category: doc.category,
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

// 1. Lấy danh sách TẤT CẢ các lớp học của mọi giảng viên (để sinh viên thấy hết và chọn tham gia)
export async function getAllClassrooms() {
  const { data } = await api.get(ENDPOINTS.classrooms)
  return data || []
}

// 2. Lấy danh sách lớp học mà sinh viên đang tham gia
export async function getEnrolledClassrooms() {
  const { data } = await api.get(`${ENDPOINTS.classrooms}/enrolled`)
  return data || []
}

// 2. Tham gia lớp học bằng mã code
export async function joinClassroom(code) {
  const { data } = await api.post(`${ENDPOINTS.classrooms}/join`, {
    code: code.trim(),
  })
  return data
}

// 3. Rời khỏi lớp học
export async function leaveClassroom(classroomId) {
  const { data } = await api.post(`${ENDPOINTS.classrooms}/${classroomId}/leave`)
  return data
}

// 4. Lấy chi tiết thông tin lớp học
export async function getClassroom(id) {
  const { data } = await api.get(`${ENDPOINTS.classrooms}/${id}`)
  return data
}

// 5. Lấy danh sách tài liệu thuộc lớp học (cô lập 100%)
export async function getClassroomDocuments(classroomId) {
  const { data } = await api.get(`${ENDPOINTS.classrooms}/${classroomId}/documents`)
  return (data || [])
    .slice()
    .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
    .map(toDocumentView)
}

// 6. Lấy URL tải xuống file gốc của tài liệu
export async function getDownloadUrl(id) {
  const { data } = await api.get(`${ENDPOINTS.documents}/${id}/download`)
  return data.url
}
