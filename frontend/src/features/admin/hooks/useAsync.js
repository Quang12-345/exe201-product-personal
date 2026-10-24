import { useState, useEffect } from 'react'

// Hook chung: chạy một hàm async khi mount, trả về { data, loading, error }.
// Dùng cho các trang chỉ cần load dữ liệu (Phân loại, Thống kê).
export function useAsync(asyncFn, deps = []) {
  const [state, setState] = useState({ data: null, loading: true, error: null })

  useEffect(() => {
    let alive = true
    setState((s) => ({ ...s, loading: true }))
    asyncFn()
      .then((data) => alive && setState({ data, loading: false, error: null }))
      .catch((error) => alive && setState({ data: null, loading: false, error }))
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  return state
}
