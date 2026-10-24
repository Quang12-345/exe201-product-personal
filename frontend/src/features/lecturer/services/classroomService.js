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

// 1. Lấy danh sách lớp học của giảng viên
export async function getClassrooms() {
  const { data } = await api.get(ENDPOINTS.classrooms)
  return data || []
}

// 2. Tạo lớp học mới
export async function createClassroom({ name, code, subject, description }) {
  const payload = {
    name: name.trim(),
    code: code ? code.trim() : null,
    subject: subject ? subject.trim() : null,
    description: description ? description.trim() : null,
  }
  const { data } = await api.post(ENDPOINTS.classrooms, payload)
  return data
}

// 3. Lấy thông tin chi tiết một lớp học
export async function getClassroom(id) {
  const { data } = await api.get(`${ENDPOINTS.classrooms}/${id}`)
  return data
}

// 4. Cập nhật lớp học
export async function updateClassroom(id, { name, code, subject, description }) {
  const payload = {
    name: name?.trim(),
    code: code ? code.trim() : null,
    subject: subject ? subject.trim() : null,
    description: description ? description.trim() : null,
  }
  const { data } = await api.put(`${ENDPOINTS.classrooms}/${id}`, payload)
  return data
}

// 5. Xóa lớp học
export async function deleteClassroom(id) {
  const { data } = await api.delete(`${ENDPOINTS.classrooms}/${id}`)
  return data
}

// 6. Lấy danh sách tài liệu CHỈ THUỘC LỚP HỌC NÀY (cô lập 100%)
export async function getClassroomDocuments(classroomId) {
  const { data } = await api.get(`${ENDPOINTS.classrooms}/${classroomId}/documents`)
  return (data || [])
    .slice()
    .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
    .map(toDocumentView)
}

// 7. Tải tài liệu trực tiếp vào lớp học (cô lập tuyệt đối cho lớp)
export async function uploadClassroomDocument(classroomId, { file, title, description }) {
  const formData = new FormData()
  formData.append('file', file)
  if (title) formData.append('title', title)
  if (description) formData.append('description', description)

  const { data } = await api.post(
    `${ENDPOINTS.classrooms}/${classroomId}/documents/upload`,
    formData,
    {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 180000,
    }
  )
  return {
    ...data,
    document: data.document ? toDocumentView(data.document) : null,
  }
}

// 8. Lấy danh sách sinh viên trong lớp học
export async function getClassroomStudents(classroomId) {
  const { data } = await api.get(`${ENDPOINTS.classrooms}/${classroomId}/students`)
  return data || []
}

// 9. Thêm sinh viên vào lớp học
export async function addStudentToClassroom(classroomId, { student_code, full_name, email, note }) {
  const payload = {
    student_code: student_code.trim(),
    full_name: full_name.trim(),
    email: email ? email.trim() : null,
    note: note ? note.trim() : null,
  }
  const { data } = await api.post(`${ENDPOINTS.classrooms}/${classroomId}/students`, payload)
  return data
}

// 10. Xóa sinh viên khỏi lớp học
export async function removeStudentFromClassroom(classroomId, studentId) {
  const { data } = await api.delete(`${ENDPOINTS.classrooms}/${classroomId}/students/${studentId}`)
  return data
}
