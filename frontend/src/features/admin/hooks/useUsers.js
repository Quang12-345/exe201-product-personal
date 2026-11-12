import { useState, useEffect, useCallback } from 'react'
import * as userService from '../services/userService'
import { notify } from '../../../components/common/toast.jsx'

// Logic danh sách + CRUD người dùng.
export function useUsers() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setUsers(await userService.getUsers())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const removeUser = async (id) => {
    try {
      await userService.deleteUser(id)
      setUsers((prev) => prev.filter((u) => u.id !== id))
      notify('Xóa người dùng thành công.')
    } catch {
      notify('Xóa người dùng thất bại. Vui lòng thử lại.', 'error')
    }
  }

  const revokePro = async (id) => {
    try {
      const updated = await userService.revokePro(id)
      const freshList = await userService.getUsers().catch(() => null)
      if (freshList) {
        setUsers(freshList)
      } else {
        setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, ...updated } : u)))
      }
      const verified = freshList?.find((u) => u.id === id) || updated
      if (verified?.isPro) {
        notify(
          'Máy chủ chưa áp dụng cắt gói (trạng thái vẫn là Đã mua gói). Vui lòng kiểm tra / khởi động lại backend mới nhất.',
          'error',
        )
        return verified
      }
      notify(
        verified?.isLecturer
          ? 'Đã cắt Gói Giảng viên thành công. Tài khoản chuyển về Free (5 lớp).'
          : 'Đã cắt quyền Pro thành công. Người dùng chuyển về gói Free.',
      )
      return verified
    } catch (err) {
      const detail = err?.response?.data?.detail
      notify(typeof detail === 'string' ? detail : 'Cắt gói dịch vụ thất bại. Vui lòng thử lại.', 'error')
      throw err
    }
  }

  const grantPro = async (id) => {
    try {
      const updated = await userService.grantPro(id)
      const freshList = await userService.getUsers().catch(() => null)
      if (freshList) {
        setUsers(freshList)
      } else {
        setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, ...updated } : u)))
      }
      const verified = freshList?.find((u) => u.id === id) || updated
      if (!verified?.isPro) {
        notify(
          'Máy chủ chưa kích hoạt được gói (trạng thái vẫn là Free). Vui lòng kiểm tra lại backend.',
          'error',
        )
        return verified
      }
      notify(
        verified?.isLecturer
          ? 'Đã cấp Gói Giảng viên (30 ngày) thành công.'
          : 'Đã cấp quyền Pro (30 ngày) thành công.',
      )
      return verified
    } catch (err) {
      const detail = err?.response?.data?.detail
      notify(typeof detail === 'string' ? detail : 'Cấp gói dịch vụ thất bại. Vui lòng thử lại.', 'error')
      throw err
    }
  }

  return { users, setUsers, loading, reload: load, removeUser, revokePro, grantPro }
}
