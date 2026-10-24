// Icon + màu badge cho từng giá trị bộ lọc (Kho tài liệu).
// Dùng chung cho trang lecturer và admin để đồng bộ giao diện.
import {
  AlertCircleIcon,
  BookmarkIcon,
  CheckCircleIcon,
  ClockIcon,
  FileTextIcon,
  FolderIcon,
  GraduationCapIcon,
  LaptopIcon,
  LinkIcon,
  LockIcon,
  ShapesIcon,
  ShieldIcon,
  SparklesIcon,
  UserIcon,
  UsersIcon,
  YouTubeIcon,
} from '../../../components/common/icons.jsx'
import { SUBJECTS, subjectGroupKey } from '../../../constants/subjects'
import { CATEGORIES, getFileTypes } from './documentService'
import { getRoles } from './userService'

// ---- Phân loại ----
const CATEGORY_META = {
  regulation: { icon: ShieldIcon, color: '#8b5cf6' },
  syllabus: { icon: FileTextIcon, color: '#3b82f6' },
}
export const categoryOptions = CATEGORIES.map((c) => ({
  value: c.value,
  label: c.label,
  ...(CATEGORY_META[c.value] || { icon: FolderIcon, color: '#64748b' }),
}))
export const categoryAll = { icon: ShapesIcon, color: '#94a3b8' }

// ---- Môn học (gán theo nhóm) ----
const GROUP_META = {
  cs: { icon: LaptopIcon, color: '#3b82f6' },
  math: { icon: ShapesIcon, color: '#14b8a6' },
  general: { icon: BookmarkIcon, color: '#f59e0b' },
  other: { icon: FolderIcon, color: '#64748b' },
}
export const subjectOptions = SUBJECTS.map((s) => ({
  value: s,
  label: s,
  ...GROUP_META[subjectGroupKey(s)],
}))
export const subjectAll = { icon: GraduationCapIcon, color: '#94a3b8' }
// Icon + màu cho 1 môn bất kỳ (kể cả tên không thuộc danh mục → 'other').
export function subjectMeta(name) {
  return GROUP_META[subjectGroupKey(name)] || GROUP_META.other
}

// ---- Loại tệp ----
const FILE_TYPE_COLOR = {
  PDF: '#ef4444',
  DOCX: '#3b82f6',
  PPTX: '#f97316',
  LINK: '#14b8a6',
  YOUTUBE: '#ef4444',
}
const FILE_TYPE_LABEL = {
  LINK: 'URL',
  YOUTUBE: 'YouTube',
}
const FILE_TYPE_ICON = {
  LINK: LinkIcon,
  YOUTUBE: YouTubeIcon,
}
export const fileTypeOptions = getFileTypes().map((t) => ({
  value: t,
  label: FILE_TYPE_LABEL[t] || t,
  icon: FILE_TYPE_ICON[t] || FileTextIcon,
  color: FILE_TYPE_COLOR[t] || '#64748b',
}))
export const fileTypeAll = { icon: FileTextIcon, color: '#94a3b8' }
// Icon + màu cho 1 loại tệp bất kỳ (gồm cả LINK).
export function fileTypeMeta(type) {
  const t = (type || '').toUpperCase()
  return {
    icon: FILE_TYPE_ICON[t] || FileTextIcon,
    color: FILE_TYPE_COLOR[t] || '#64748b',
    label: FILE_TYPE_LABEL[t] || t,
  }
}

// ---- Trạng thái AI ----
export const aiStatusOptions = [
  { value: 'indexed', label: 'Đã lập chỉ mục', icon: CheckCircleIcon, color: '#22c55e' },
  { value: 'pending', label: 'Chờ xử lý', icon: ClockIcon, color: '#f59e0b' },
  { value: 'error', label: 'Lỗi', icon: AlertCircleIcon, color: '#ef4444' },
]
export const aiStatusAll = { icon: SparklesIcon, color: '#94a3b8' }

// ---- Vai trò người dùng ----
const ROLE_META = {
  'Vận hành': { icon: ShieldIcon, color: '#6366f1' },
  Admin: { icon: ShieldIcon, color: '#6366f1' },
  'Giảng viên': { icon: GraduationCapIcon, color: '#22c55e' },
  'Sinh viên': { icon: UserIcon, color: '#64748b' },
}
export const roleOptions = getRoles().map((r) => ({
  value: r,
  label: r,
  ...(ROLE_META[r] || { icon: UserIcon, color: '#64748b' }),
}))
export const roleAll = { icon: UsersIcon, color: '#94a3b8' }

// ---- Trạng thái người dùng ----
export const userStatusOptions = [
  { value: 'active', label: 'Đang hoạt động', icon: CheckCircleIcon, color: '#22c55e' },
  { value: 'pending', label: 'Chờ xác nhận', icon: ClockIcon, color: '#f59e0b' },
  { value: 'locked', label: 'Bị khóa', icon: LockIcon, color: '#ef4444' },
]
export const userStatusAll = { icon: CheckCircleIcon, color: '#94a3b8' }
