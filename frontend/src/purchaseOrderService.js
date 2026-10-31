import { apiRequest } from './apiClient'

export function getPurchaseOrders() { return apiRequest('/purchase-orders') }
export function createPurchaseOrder(order) { return apiRequest('/purchase-orders', { method: 'POST', body: JSON.stringify(order) }) }
export function updatePurchaseOrder(id, order) { return apiRequest(`/purchase-orders/${id}`, { method: 'PUT', body: JSON.stringify(order) }) }
export function updatePurchaseOrderStatus(id, status) {
  return apiRequest(`/purchase-orders/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) })
}
export function createPurchaseOrderReceiptIdempotencyKey() {
  const cryptoApi = globalThis.crypto
  if (typeof cryptoApi?.randomUUID === 'function') return cryptoApi.randomUUID()
  if (typeof cryptoApi?.getRandomValues !== 'function') {
    throw new Error('Secure randomness is unavailable. Use a secure browser context to receive stock.')
  }

  const bytes = cryptoApi.getRandomValues(new Uint8Array(16))
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

export function receivePurchaseOrder(id, lines, idempotencyKey) {
  return apiRequest(`/purchase-orders/${id}/receive`, {
    method: 'POST',
    body: JSON.stringify({ lines, idempotencyKey }),
  })
}
