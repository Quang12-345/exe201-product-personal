import api from '../../../services/api'
import { ENDPOINTS } from '../../../constants'

export async function getBillingStatus() {
  const { data } = await api.get(ENDPOINTS.billingMe)
  return data
}

export async function startProCheckout(returnTo, planCode = 'pro_monthly') {
  const payload = {
    plan_code: planCode,
    return_to: returnTo,
    origin: typeof window !== 'undefined' ? window.location.origin : undefined,
  }
  const { data } = await api.post(ENDPOINTS.vnpayCheckout, payload)
  return data
}

export async function startLecturerCheckout(returnTo = '/lecturer/classes') {
  return startProCheckout(returnTo, 'lecturer_monthly')
}

export async function reconcileProPayment(orderCode) {
  const { data } = await api.post(`${ENDPOINTS.vnpayReconcile}${encodeURIComponent(orderCode)}`)
  return data
}

export async function getPaymentReceipt(orderCode) {
  const endpoint = ENDPOINTS.paymentReceipt || '/api/v1/payments/receipt/'
  const { data } = await api.get(`${endpoint}${encodeURIComponent(orderCode)}`)
  return data
}
