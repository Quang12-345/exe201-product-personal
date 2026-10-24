// Bộ lọc "Loại tệp" dùng chung: gộp tài liệu về các nhóm dễ hiểu cho người dùng.
// PDF · Doc (Word) · Excel · YouTube · Video.
export const DOC_TYPE_FILTERS = [
  { value: 'pdf', label: 'PDF', color: '#dc2626' },
  { value: 'doc', label: 'Doc', color: '#1a56db' },
  { value: 'excel', label: 'Excel', color: '#10b981' },
  { value: 'link', label: 'URL', color: '#14b8a6' },
  { value: 'youtube', label: 'YouTube', color: '#ef4444' },
  { value: 'video', label: 'Video', color: '#7c3aed' },
]

export function isYouTubeUrl(url = '') {
  return /(?:youtube\.com|youtu\.be)/i.test(url)
}

// Phân loại 1 tài liệu về nhóm loại tệp.
// Trả về: 'pdf' | 'doc' | 'excel' | 'youtube' | 'video' | 'slide' | 'link' | 'other'
export function classifyDocType(doc = {}) {
  const t = (doc.type || doc.file_type || '').toUpperCase()
  if (doc.kind === 'youtube' || t === 'YOUTUBE') return 'youtube'
  if (doc.kind === 'link' || t === 'LINK') return isYouTubeUrl(doc.url) ? 'youtube' : 'link'
  if (doc.kind === 'media' || ['MP4', 'WEBM', 'MOV', 'MKV', 'AVI'].includes(t)) return 'video'
  if (t === 'PDF') return 'pdf'
  if (['DOCX', 'DOC'].includes(t)) return 'doc'
  if (['XLSX', 'XLS'].includes(t)) return 'excel'
  if (['PPTX', 'PPT', 'SLIDE'].includes(t)) return 'slide'
  return 'other'
}
