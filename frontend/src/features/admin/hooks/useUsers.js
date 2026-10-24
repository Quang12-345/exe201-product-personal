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
      setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, ...updated } : u)))
      notify('Đã cắt quyền Pro thành công. Người dùng chuyển về gói Free.')
      return updated
    } catch (err) {
      const detail = err?.response?.data?.detail
      notify(typeof detail === 'string' ? detail : 'Cắt quyền Pro thất bại. Vui lòng thử lại.', 'error')
      throw err
    }
  }

  const grantPro = async (id) => {
    try {
      const updated = await userService.grantPro(id)
      setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, ...updated } : u)))
      notify('Đã cấp quyền Pro (30 ngày) thành công.')
      return updated
    } catch (err) {
      const detail = err?.response?.data?.detail
      notify(typeof detail === 'string' ? detail : 'Cấp quyền Pro thất bại. Vui lòng thử lại.', 'error')
      throw err
    }
  }

  return { users, setUsers, loading, reload: load, removeUser, revokePro, grantPro }
}
