import api from '../../../services/api'
import { ENDPOINTS } from '../../../constants'

export async function getStudentExams(subject, classroomId) {
  const params = {}
  if (subject && subject !== 'all') params.subject = subject
  if (classroomId) params.classroom_id = classroomId
  const { data } = await api.get(ENDPOINTS.exams, { params })
  return data
}

export async function getExamsByClassroom(classroomId) {
  const { data } = await api.get(ENDPOINTS.exams, { params: { classroom_id: classroomId } })
  return data
}

export function formatExamDate(iso) {
  if (!iso) return 'Chưa xếp lịch'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return 'Chưa xếp lịch'
  const pad = (n) => String(n).padStart(2, '0')
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}
