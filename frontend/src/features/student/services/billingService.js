import api from '../../../services/api'
import { ENDPOINTS } from '../../../constants'

export async function getBillingStatus() {
  const { data } = await api.get(ENDPOINTS.billingMe)
  return data
}

export async function startProCheckout(returnTo) {
  const payload = { plan_code: 'pro_monthly' }
  if (returnTo) payload.return_to = returnTo
  const { data } = await api.post(ENDPOINTS.vnpayCheckout, payload)
  return data
}

export async function reconcileProPayment(orderCode) {
  const { data } = await api.post(`${ENDPOINTS.vnpayReconcile}${encodeURIComponent(orderCode)}`)
  return data
}