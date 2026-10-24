// Service quản lý người dùng — gọi backend thật (/api/v1/users).
import api from '../../../services/api'
import { ENDPOINTS } from '../../../constants'

// Nhãn hiển thị ↔ tên vai trò ở backend.
const ROLE_LABEL = { admin: 'Vận hành', lecturer: 'Giảng viên', student: 'Sinh viên' }
const ROLE_NAME = { 'Vận hành': 'admin', Admin: 'admin', 'Giảng viên': 'lecturer', 'Sinh viên': 'student' }
const ROLES = ['Giảng viên', 'Sinh viên', 'Vận hành']
// Sản phẩm chỉ có GV + SV. Admin nội bộ không cấp qua UI; sinh viên tự đăng nhập (Gmail).
const ASSIGNABLE_ROLES = ['Giảng viên']

export function getRoles() { return ROLES }
export function getAssignableRoles() { return ASSIGNABLE_ROLES }

function toView(u) {
  const roleName = u.roleName ?? u.role
  const isStudent = roleName === 'student'
  const isPro = Boolean(u.isPro)
  const plan = u.plan || (isPro ? 'pro' : 'free')
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    roleID: u.roleID || '',
    role: ROLE_LABEL[roleName] || roleName || '—',
    rawRole: roleName,
    isStudent,
    isPro,
    plan,
    subscriptionExpiresAt: u.subscriptionExpiresAt ?? null,
    status: u.status,
    phone: u.phone || '',
    documentCount: u.documentCount ?? 0,
    joinedAt: u.joinedAt ?? null,
    level: '',
    dept: '',
  }
}

export async function getUsers() {
  const { data } = await api.get(ENDPOINTS.users)
  return (data || []).map(toView)
}

export async function getUser(id) {
  const { data } = await api.get(`${ENDPOINTS.users}/${id}`)
  return toView(data)
}

export async function createUser(data) {
  const payload = {
    name: data.name,
    email: data.email,
    role: ROLE_NAME[data.role] || 'lecturer',
    password: data.password,
  }
  if (data.phone) payload.phone = data.phone
  const { data: created } = await api.post(ENDPOINTS.createUser, payload)
  return {
    ...toView(created),
    initialPassword: created?.initialPassword,
  }
}

export async function updateUser(id, data) {
  // Chỉ gửi các trường backend chấp nhận (UpdateUserRequest dùng extra=forbid).
  const payload = {}
  if (data.name != null) payload.name = data.name
  if (data.email != null) payload.email = data.email
  if (data.status != null) payload.status = data.status
  if (data.phone != null && data.phone !== '') payload.phone = data.phone
  if (data.role != null) payload.role = ROLE_NAME[data.role] || data.role
  if (data.password) payload.password = data.password
  if (data.plan != null) payload.plan = data.plan
  const { data: updated } = await api.put(`${ENDPOINTS.users}/${id}`, payload)
  return toView(updated)
}

export async function revokePro(id) {
  const { data } = await api.post(`${ENDPOINTS.users}/${id}/revoke-pro`)
  return toView(data)
}

export async function grantPro(id) {
  const { data } = await api.post(`${ENDPOINTS.users}/${id}/grant-pro`)
  return toView(data)
}

export async function deleteUser(id) {
  await api.delete(`${ENDPOINTS.users}/${id}`)
  return { id }
}
