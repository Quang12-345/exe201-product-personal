import api from '../../../services/api'
import { ENDPOINTS } from '../../../constants'

function toSessionUser(user) {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    name: user.name,
    role: user.roleName || user.role,
    phone: user.phone || '',
    status: user.status,
  }
}

export async function getMyProfile() {
  const { data } = await api.get(`${ENDPOINTS.users}/me`)
  return data
}

export async function updateMyProfile(data) {
  const payload = {}
  if (data.name != null) payload.name = data.name
  if (data.email != null) payload.email = data.email
  if (data.phone != null) payload.phone = data.phone
  const { data: updated } = await api.put(`${ENDPOINTS.users}/me`, payload)
  return toSessionUser(updated)
}


// Đổi mật khẩu của chính mình — thao tác DUY NHẤT user thường được tự cập nhật.
// (Thông tin cá nhân khác chỉ quản trị viên sửa được.)
export async function changeMyPassword({ currentPassword, newPassword }) {
  const { data } = await api.put(`${ENDPOINTS.users}/me/password`, {
    current_password: currentPassword,
    new_password: newPassword,
  })
  return data // { ok, message }
}
