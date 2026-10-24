import api from './api'
import { ENDPOINTS } from '../constants'

// Mỗi nhóm API là một module riêng. Component gọi service, không gọi api trực tiếp.
export async function sendMessage(message) {
  const { data } = await api.post(ENDPOINTS.chat, { message })
  return data
}
