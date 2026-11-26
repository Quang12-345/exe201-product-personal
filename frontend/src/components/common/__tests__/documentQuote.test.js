import assert from 'node:assert/strict'
import test from 'node:test'

import { findQuoteRange } from '../documentQuote.js'

test('finds an exact quote despite whitespace and Unicode normalization differences', () => {
  const text = 'NỘI DUNG:\nGiá trị hàng hóa được quyết định bởi lao động xã hội.'
  const quote = 'Giá trị hàng hóa được quyết định bởi lao động xã hội.'
  const range = findQuoteRange(text, quote)

  assert.ok(range)
  assert.equal(text.slice(range.start, range.end), text.slice(text.indexOf('Giá'), text.length))
})

test('does not highlight a short repeated prefix when the full quote is missing', () => {
  const prefix = 'Giá trị hàng hóa được quyết định bởi lao động xã hội cần thiết'
  const text = `${prefix} trong điều kiện sản xuất bình thường. ${prefix} ở một đoạn khác.`

  assert.equal(findQuoteRange(text, `${prefix} trong bối cảnh hoàn toàn khác.`), null)
})

test('uses a long unique excerpt when only part of the quote occurs', () => {
  const excerpt = 'Một khẳng định đặc trưng trong tài liệu về giá trị hàng hóa và lao động xã hội cần thiết, được dùng làm căn cứ để so sánh nhiều hình thức sản xuất khác nhau.'
  const text = `Phần mở đầu. ${excerpt} Phần kết luận.`
  const quote = `${excerpt} nội dung bị cắt khác với tài liệu gốc.`
  const range = findQuoteRange(text, quote)

  assert.ok(range)
  const matched = text.slice(range.start, range.end)
  assert.ok(matched.length >= 100)
  assert.ok(excerpt.startsWith(matched))
})
