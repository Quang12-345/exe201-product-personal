// Quản lý lịch thi (theo môn) — gọi backend thật.
import api from '../../../services/api'
import { ENDPOINTS } from '../../../constants'

import { SUBJECTS } from '../../../constants/subjects'

export function getSubjects() { return SUBJECTS }

// Định dạng ISO datetime → "HH:mm dd/MM/yyyy" cho hiển thị.
export function formatExamDate(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' })
}

export async function getExams(subject) {
  const params = subject && subject !== 'all' ? { subject } : {}
  const { data } = await api.get(ENDPOINTS.exams, { params })
  return data || []
}

export async function createExam(payload) {
  const { data } = await api.post(ENDPOINTS.exams, payload)
  return data
}

export async function updateExam(id, payload) {
  const { data } = await api.put(`${ENDPOINTS.exams}/${id}`, payload)
  return data
}

export async function deleteExam(id) {
  await api.delete(`${ENDPOINTS.exams}/${id}`)
  return { id }
}

export async function getRecentSubmissions(limit = 10) {
  const { data } = await api.get(ENDPOINTS.recentSubmissions, { params: { limit } })
  return data || []
}

