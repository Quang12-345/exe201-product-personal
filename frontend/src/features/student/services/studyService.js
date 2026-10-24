import api from '../../../services/api'
import { ENDPOINTS } from '../../../constants'

export async function fetchAvailableDocuments() {
  try {
    const { data } = await api.get(ENDPOINTS.documents + '/available')
    return data || []
  } catch (err) {
    console.error('Lỗi lấy danh sách tài liệu:', err)
    return []
  }
}

export async function fetchDocumentFlashcards(documentId) {
  const { data } = await api.get(`/api/v1/documents/${documentId}/flashcards`, {
    params: { _t: Date.now() },
  })
  return data || []
}

export async function generateFlashcards(documentId, count = 10) {
  const { data } = await api.post(`/api/v1/documents/${documentId}/flashcards/generate`, { count })
  return data || []
}

export async function createFlashcard(documentId, { front_text, back_text }) {
  const { data } = await api.post(`/api/v1/documents/${documentId}/flashcards`, { front_text, back_text })
  return data
}

export async function deleteFlashcard(flashcardId) {
  const { data } = await api.delete(`/api/v1/flashcards/${flashcardId}`)
  return data
}

export async function fetchDocumentQuizzes(documentId) {
  const { data } = await api.get(`/api/v1/documents/${documentId}/quizzes`, {
    params: { _t: Date.now() },
  })
  return data || []
}

export async function fetchQuiz(quizId, includeAnswers = false) {
  const { data } = await api.get(`/api/v1/quizzes/${quizId}`, {
    params: { include_answers: includeAnswers, _t: Date.now() },
  })
  return data
}

export async function generateQuiz(documentId, { title, num_questions = 5 }) {
  const { data } = await api.post(`/api/v1/documents/${documentId}/quizzes/generate`, {
    title,
    num_questions,
  })
  return data
}

export async function deleteQuiz(quizId) {
  const { data } = await api.delete(`/api/v1/quizzes/${quizId}`)
  return data
}

export async function submitQuiz(quizId, answers) {
  const { data } = await api.post(`/api/v1/quizzes/${quizId}/submit`, { answers })
  return data
}

export async function fetchQuizAttempts(quizId) {
  const { data } = await api.get(`/api/v1/quizzes/${quizId}/attempts`)
  return data || []
}

export async function fetchMyQuizAttempts() {
  const { data } = await api.get(ENDPOINTS.myQuizAttempts)
  return data || []
}
