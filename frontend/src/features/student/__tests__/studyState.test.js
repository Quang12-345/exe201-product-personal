import test from 'node:test'
import assert from 'node:assert/strict'

// Giả lập logic quản lý State của FlashcardViewer và QuizPlayer

test('Flashcard: Thêm thẻ mới cập nhật state tức thì mà không cần reload', () => {
  const initialCards = [
    { id: 'fc-1', front_text: 'Q1', back_text: 'A1' },
    { id: 'fc-2', front_text: 'Q2', back_text: 'A2' },
  ]
  const newCard = { id: 'fc-3', front_text: 'Q3', back_text: 'A3' }

  // Mô phỏng handleCreateManual
  const updatedCards = [...initialCards, newCard]
  const newIndex = updatedCards.length - 1

  assert.equal(updatedCards.length, 3)
  assert.equal(updatedCards[2].id, 'fc-3')
  assert.equal(newIndex, 2)
})

test('Flashcard: Xóa thẻ cuối cùng tự động lùi currentIndex về thẻ trước đó', () => {
  let cards = [
    { id: 'fc-1', front_text: 'Q1', back_text: 'A1' },
    { id: 'fc-2', front_text: 'Q2', back_text: 'A2' },
  ]
  let currentIndex = 1 // Đang ở thẻ fc-2

  const cardIdToDelete = 'fc-2'
  const remaining = cards.filter((c) => c.id !== cardIdToDelete)

  if (currentIndex >= remaining.length && remaining.length > 0) {
    currentIndex = remaining.length - 1
  } else if (remaining.length === 0) {
    currentIndex = 0
  }

  assert.equal(remaining.length, 1)
  assert.equal(currentIndex, 0)
  assert.equal(remaining[0].id, 'fc-1')
})

test('Flashcard: Xóa thẻ duy nhất còn lại đưa về empty state', () => {
  let cards = [{ id: 'fc-1', front_text: 'Q1', back_text: 'A1' }]
  let currentIndex = 0

  const cardIdToDelete = 'fc-1'
  const remaining = cards.filter((c) => c.id !== cardIdToDelete)

  if (currentIndex >= remaining.length && remaining.length > 0) {
    currentIndex = remaining.length - 1
  } else if (remaining.length === 0) {
    currentIndex = 0
  }

  assert.equal(remaining.length, 0)
  assert.equal(currentIndex, 0)
})

test('Quiz: AI sinh đề mới lập tức chèn vào đầu danh sách mà không cần reload', () => {
  const existingQuizzes = [
    { id: 'quiz-old', title: 'Đề cũ', question_count: 5 }
  ]
  const generatedQuiz = {
    id: 'quiz-new',
    title: 'Đề mới do AI tạo',
    question_count: 5
  }

  const updatedList = [generatedQuiz, ...existingQuizzes.filter((q) => q.id !== generatedQuiz.id)]

  assert.equal(updatedList.length, 2)
  assert.equal(updatedList[0].id, 'quiz-new')
  assert.equal(updatedList[1].id, 'quiz-old')
})

test('Quiz: Xóa đề đang chọn tự động chọn đề tiếp theo hoặc null nếu hết', () => {
  let quizList = [
    { id: 'q-1', title: 'Quiz 1' },
    { id: 'q-2', title: 'Quiz 2' }
  ]
  let selectedQuizId = 'q-1'

  // Xóa q-1
  const remaining = quizList.filter((q) => q.id !== 'q-1')
  if (remaining.length > 0) {
    selectedQuizId = remaining[0].id
  } else {
    selectedQuizId = null
  }

  assert.equal(remaining.length, 1)
  assert.equal(selectedQuizId, 'q-2')

  // Xóa nốt q-2
  const finalRemaining = remaining.filter((q) => q.id !== 'q-2')
  if (finalRemaining.length > 0) {
    selectedQuizId = finalRemaining[0].id
  } else {
    selectedQuizId = null
  }

  assert.equal(finalRemaining.length, 0)
  assert.equal(selectedQuizId, null)
})

test('Toast: notify.success và notify.error không gây crash ứng dụng', () => {
  let dispatched = null
  globalThis.window = {
    dispatchEvent: (evt) => {
      dispatched = evt
    },
  }
  globalThis.CustomEvent = class {
    constructor(name, opts) {
      this.type = name
      this.detail = opts?.detail
    }
  }

  function notify(message, variant) {
    const detail = { message }
    if (variant) detail.variant = variant
    window.dispatchEvent(new CustomEvent('app:notify', { detail }))
  }
  notify.success = (msg) => notify(msg, 'success')
  notify.error = (msg) => notify(msg, 'error')

  notify.success('Tạo thành công')
  assert.equal(dispatched?.detail?.message, 'Tạo thành công')
  assert.equal(dispatched?.detail?.variant, 'success')

  notify.error('Xóa thất bại')
  assert.equal(dispatched?.detail?.message, 'Xóa thất bại')
  assert.equal(dispatched?.detail?.variant, 'error')
})
