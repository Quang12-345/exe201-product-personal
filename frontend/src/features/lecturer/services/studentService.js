// Quản lý sinh viên (danh sách phẳng theo môn) — gọi backend thật.
import api from '../../../services/api'
import { ENDPOINTS } from '../../../constants'

import { SUBJECTS } from '../../../constants/subjects'

export function getSubjects() { return SUBJECTS }

export async function getStudents(subject) {
  const params = subject && subject !== 'all' ? { subject } : {}
  const { data } = await api.get(ENDPOINTS.students, { params })
  return data || []
}

export async function createStudent(payload) {
  const { data } = await api.post(ENDPOINTS.students, payload)
  return data
}

export async function updateStudent(id, payload) {
  const { data } = await api.put(`${ENDPOINTS.students}/${id}`, payload)
  return data
}

export async function deleteStudent(id) {
  await api.delete(`${ENDPOINTS.students}/${id}`)
  return { id }
}
