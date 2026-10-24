// Lấy nội dung tài liệu để xem trong popup (không tải xuống). Dùng chung cho mọi quyền.
import api from './api'
import { ENDPOINTS } from '../constants'

// Tải bytes bản gốc (kèm JWT) để render/xem trong popup.
export async function fetchDocBlob(id) {
  const { data, headers } = await api.get(`${ENDPOINTS.documents}/${id}/view`, {
    responseType: 'blob',
  })
  const type = headers?.['content-type'] || 'application/octet-stream'
  return new Blob([data], { type })
}

// PDF/video: tạo Blob URL để nhúng vào <iframe>/<video>.
export async function fetchDocBlobUrl(id) {
  const blob = await fetchDocBlob(id)
  return URL.createObjectURL(blob)
}

// DOCX/PPTX: lấy nội dung văn bản đã trích xuất để hiển thị.
export async function fetchDocText(id) {
  const { data } = await api.get(`${ENDPOINTS.documents}/${id}/text`)
  return data // { file_type, file_name, text }
}

// Lấy metadata tài liệu theo id (để mở DocumentViewerModal từ citation trong chat).
// Dùng /documents/available — lọc theo quyền của user hiện tại nên hợp mọi vai trò.
export async function getDocumentForViewer(id) {
  if (!id) return null
  const { data } = await api.get(`${ENDPOINTS.documents}/available`)
  const raw = (data || []).find((d) => d.id === id)
  if (!raw) return null
  return {
    id: raw.id,
    name: raw.title || raw.file_name,
    type: (raw.file_type || '').toUpperCase(),
    kind: raw.kind || 'file',
    url: raw.url || '',
  }
}
