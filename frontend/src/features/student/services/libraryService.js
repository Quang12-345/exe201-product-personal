// Service Kho tài liệu (phía sinh viên).
// Tổng số + tài liệu mới nhất lấy realtime từ backend; danh mục lĩnh vực giữ tĩnh.
import api from '../../../services/api'
import { ENDPOINTS } from '../../../constants'

const delay = (ms = 300) => new Promise((r) => setTimeout(r, ms))

const FIELDS = [
  {
    id: 'cntt',
    name: 'Công nghệ Thông tin',
    icon: 'laptop',
    color: '#1a56db',
    count: '4.5k',
    desc: 'Kho tài liệu về Phát triển phần mềm, AI, Network và Bảo mật.',
    popular: ['Cấu trúc dữ liệu và Giải thuật (Nâng cao)', 'Học máy ứng dụng trong phân tích dữ liệu'],
  },
  {
    id: 'kinhte',
    name: 'Kinh tế & Quản trị',
    icon: 'building',
    color: '#d97706',
    count: '3.2k',
    desc: 'Tài chính, Marketing, Quản trị nhân sự và Kinh tế vĩ mô.',
    popular: ['Chiến lược Marketing 4.0 trong kỷ nguyên số', 'Quản trị chuỗi cung ứng toàn cầu'],
  },
  {
    id: 'ngonngu',
    name: 'Ngôn ngữ & Văn hóa',
    icon: 'globe',
    color: '#10b981',
    count: '2.8k',
    desc: 'Anh văn chuyên ngành, Biên phiên dịch và Văn hóa học.',
    popular: ['Lý thuyết Biên dịch nâng cao', 'Văn hóa các nước ASEAN'],
  },
  {
    id: 'thietke',
    name: 'Thiết kế Đồ họa',
    icon: 'palette',
    color: '#dc2626',
    count: '1.5k',
    desc: 'UI/UX, Đồ họa 2D/3D, Typography và Tư duy thẩm mỹ.',
    popular: ['Nguyên lý thị giác trong Design', 'Nghiên cứu hành vi người dùng UI/UX'],
  },
]

const MOST_VIEWED = [
  { id: 'mv1', tag: 'NGHIÊN CỨU KHOA HỌC', icon: 'trending', title: 'Ứng dụng AI trong chẩn đoán y tế', desc: 'Phân tích thực trạng và tiềm năng phát triển tại Việt Nam...', views: '1,2k lượt xem' },
  { id: 'mv2', tag: 'GIÁO TRÌNH', icon: 'star', title: 'Toán rời rạc và ứng dụng CNTT', desc: 'Kiến thức nền tảng bắt buộc cho sinh viên năm 2...', views: '850 lượt xem' },
  { id: 'mv3', tag: 'SLIDE BÀI GIẢNG', icon: 'sparkles', title: 'Phát triển phần mềm hướng đối tượng', desc: 'Tổng hợp các mẫu Design Pattern thông dụng nhất...', views: '640 lượt xem' },
]

// Lấy danh sách tài liệu khả dụng thật từ backend (lọc theo quyền của sinh viên).
// Sắp xếp mới nhất lên đầu để hiển thị/lọc nhất quán.
async function fetchAvailable() {
  try {
    const { data } = await api.get(ENDPOINTS.documents + '/available')
    return sortByNewest(data || [])
  } catch {
    return []
  }
}

// Sắp xếp theo ngày tạo giảm dần (mới nhất trước). Bản ghi thiếu ngày xếp cuối.
function sortByNewest(docs) {
  return [...docs].sort((a, b) => {
    const ta = a.created_at ? new Date(a.created_at).getTime() : 0
    const tb = b.created_at ? new Date(b.created_at).getTime() : 0
    return tb - ta
  })
}

export async function getLibrarySummary() {
  const docs = await fetchAvailable()
  return { total: docs.length.toLocaleString('vi-VN'), weeklyViews: '—' }
}

export async function getLibraryDocuments() {
  return (await fetchAvailable()).map(toStudentDocument)
}

export async function getFields() {
  await delay()
  return [...FIELDS]
}
export async function getField(id) {
  await delay()
  return FIELDS.find((f) => f.id === id) || FIELDS[0]
}
export async function getFieldDocuments() {
  // Chỉ trả về tài liệu thật (nhìn thấy theo quyền của sinh viên).
  const docs = await fetchAvailable()
  return docs.map((d) => ({
    id: d.id,
    name: d.title || d.file_name,
    author: d.uploaded_by_name || d.subject || 'Tài liệu nhà trường',
    date: d.created_at ? new Date(d.created_at).toLocaleDateString('vi-VN') : '',
    createdAt: d.created_at || '',
    type: (d.file_type || '').toUpperCase(),
    kind: d.kind || 'file',
    url: d.url || '',
    classroomId: d.classroom_id || null,
    classroomName: d.classroom_name || null,
  }))
}
export async function getMostViewed() {
  await delay()
  return [...MOST_VIEWED]
}
export async function getLatestDocuments() {
  const docs = await fetchAvailable()
  return docs.slice(0, 6).map((d) => ({
    id: d.id,
    name: d.title || d.file_name,
    field: d.subject || 'Tài liệu nhà trường',
    date: d.created_at ? new Date(d.created_at).toLocaleDateString('vi-VN') : '',
    type: (d.file_type || '').toUpperCase(),
    kind: d.kind || 'file',
    url: d.url || '',
    classroomId: d.classroom_id || null,
    classroomName: d.classroom_name || null,
  }))
}

// Map status backend → trạng thái AI dùng cho bộ lọc (đồng bộ với admin/giảng viên).
function aiStatusOf(status) {
  if (status === 'ready') return 'indexed'
  if (typeof status === 'string' && status.startsWith('failed')) return 'error'
  return 'pending'
}

function toStudentDocument(d) {
  return {
    id: d.id,
    name: d.title || d.file_name,
    field: d.subject || 'Tài liệu nhà trường',
    subject: d.subject || 'Tài liệu nhà trường',
    category: d.category || 'syllabus',
    author: d.uploaded_by_name || 'DMRS',
    date: d.created_at ? new Date(d.created_at).toLocaleDateString('vi-VN') : '',
    createdAt: d.created_at || '',
    type: (d.file_type || '').toUpperCase(),
    aiStatus: aiStatusOf(d.status),
    kind: d.kind || 'file',
    url: d.url || '',
    isNew: Boolean(d.is_new),
    classroomId: d.classroom_id || null,
    classroomName: d.classroom_name || null,
  }
}

export async function getSubjectDocumentGroups() {
  const docs = await fetchAvailable()
  const groups = new Map()

  docs.forEach((raw) => {
    const doc = toStudentDocument(raw)
    if (doc.category === 'regulation') return
    const subject = doc.subject
    if (!groups.has(subject)) {
      groups.set(subject, { subject, docs: [], latestAt: 0 })
    }
    const group = groups.get(subject)
    const time = doc.createdAt ? new Date(doc.createdAt).getTime() : 0
    group.docs.push(doc)
    group.latestAt = Math.max(group.latestAt, time)
  })

  return [...groups.values()]
    .map((group) => ({
      ...group,
      docs: group.docs.sort((a, b) => {
        const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0
        const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0
        return tb - ta
      }),
    }))
    .sort((a, b) => b.latestAt - a.latestAt)
}

export async function getRegulationDocuments() {
  const docs = await fetchAvailable()
  return docs
    .map(toStudentDocument)
    .filter((doc) => doc.category === 'regulation')
}

export async function markDocumentViewed(id) {
  if (!id) return
  await api.post(`${ENDPOINTS.documents}/${id}/viewed`)
}
