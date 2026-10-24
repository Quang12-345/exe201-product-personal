// Thống kê realtime cho dashboard (dùng chung cho cả 3 vai trò).
import api from './api'
import { ENDPOINTS } from '../constants'

// Trả về { role, cards: [{key,label,value,note}], recent_documents: [...] }
export async function getStatsOverview() {
  const { data } = await api.get(ENDPOINTS.statsOverview)
  return {
    role: data.role,
    cards: data.cards || [],
    recentDocuments: (data.recent_documents || []).map((d) => ({
      id: d.id,
      title: d.title,
      subject: d.subject,
      category: d.category,
      status: d.status,
      owner: d.owner_name,
      createdAt: d.created_at,
    })),
  }
}
