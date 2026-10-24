// Service thống kê truy vấn: toàn bộ dữ liệu lấy từ database qua /stats/analytics.
import api from '../../../services/api'
import { ENDPOINTS } from '../../../constants'

export async function getAnalytics(range = '30d') {
  const { data } = await api.get(ENDPOINTS.statsAnalytics, { params: { range } })
  return {
    stats: (data.stats || []).map((s) => ({
      key: s.key,
      label: s.label,
      value: s.value,
      icon: s.key === 'queries' ? 'search' : s.key === 'unanswered' ? 'alert' : s.key === 'success_rate' ? 'check' : 'clock',
      delta: s.delta,
      deltaType: s.delta_type,
      note: s.note,
      danger: s.danger,
    })),
    traffic: data.traffic || [],
    byRole: data.by_role || [],
    unanswered: data.unanswered || [],
    topics: data.topics || [],
    unansweredTotal: data.unanswered_total || 0,
  }
}
