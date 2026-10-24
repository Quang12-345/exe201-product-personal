import test from 'node:test'
import assert from 'node:assert/strict'
import {
  ALLOWED_ADMIN_SUFFIXES,
  checkAdminSuffix,
} from '../utils/adminAuth.js'

test('Admin Auth: ALLOWED_ADMIN_SUFFIXES chứa các domain quản trị hợp lệ', () => {
  assert.ok(Array.isArray(ALLOWED_ADMIN_SUFFIXES))
  assert.ok(ALLOWED_ADMIN_SUFFIXES.includes('@ai20k.vn'))
  assert.ok(ALLOWED_ADMIN_SUFFIXES.includes('@admin.studymind.vn'))
  assert.ok(ALLOWED_ADMIN_SUFFIXES.includes('@studymind.edu.vn'))
})

test('Admin Auth: checkAdminSuffix chấp nhận tài khoản root admin', () => {
  const result = checkAdminSuffix('admin')
  assert.equal(result.valid, true)
  assert.ok(result.message.includes('hợp lệ'))
})

test('Admin Auth: checkAdminSuffix chấp nhận email với đuôi được cấp phép', () => {
  const r1 = checkAdminSuffix('admin@ai20k.vn')
  assert.equal(r1.valid, true)

  const r2 = checkAdminSuffix('super.admin@admin.studymind.vn')
  assert.equal(r2.valid, true)

  const r3 = checkAdminSuffix('MANAGER@STUDYMIND.EDU.VN')
  assert.equal(r3.valid, true)
})

test('Admin Auth: checkAdminSuffix từ chối email với đuôi không được cấp phép', () => {
  const r1 = checkAdminSuffix('user@gmail.com')
  assert.equal(r1.valid, false)
  assert.ok(r1.message.includes('không được phép'))

  const r2 = checkAdminSuffix('student@fpt.edu.vn')
  assert.equal(r2.valid, false)

  const r3 = checkAdminSuffix('lecturer@yahoo.com')
  assert.equal(r3.valid, false)
})

test('Admin Auth: checkAdminSuffix xử lý chuỗi rỗng hoặc định dạng không hợp lệ', () => {
  const rEmpty = checkAdminSuffix('')
  assert.equal(rEmpty.valid, false)

  const rNoAt = checkAdminSuffix('invalid_user_string')
  assert.equal(rNoAt.valid, false)
})
