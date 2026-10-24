// Gợi ý tiêu đề + mô tả bằng AI cho form tải lên (dùng chung admin & giảng viên).
import api from './api'
import { ENDPOINTS } from '../constants'

// Gợi ý từ tệp đã chọn. Trả về { title, description } (có thể rỗng nếu AI không suy ra được).
export async function suggestMetadataFromFile(file) {
  const formData = new FormData()
  formData.append('file', file)
  const { data } = await api.post(`${ENDPOINTS.documents}/suggest-metadata`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 60000,
  })
  return { title: data?.title || '', description: data?.description || '' }
}

// Gợi ý từ liên kết (URL).
export async function suggestMetadataFromLink(url) {
  const formData = new FormData()
  formData.append('url', url)
  const { data } = await api.post(`${ENDPOINTS.documents}/suggest-metadata`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 60000,
  })
  return { title: data?.title || '', description: data?.description || '' }
}
