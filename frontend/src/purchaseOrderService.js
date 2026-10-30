import { apiRequest } from './apiClient'

export function getPurchaseOrders() { return apiRequest('/purchase-orders') }
export function createPurchaseOrder(order) { return apiRequest('/purchase-orders', { method: 'POST', body: JSON.stringify(order) }) }
export function updatePurchaseOrder(id, order) { return apiRequest(`/purchase-orders/${id}`, { method: 'PUT', body: JSON.stringify(order) }) }
export function updatePurchaseOrderStatus(id, status) {
  return apiRequest(`/purchase-orders/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) })
}
export function receivePurchaseOrder(id, lines, idempotencyKey) {
  return apiRequest(`/purchase-orders/${id}/receive`, {
    method: 'POST',
    body: JSON.stringify({ lines, idempotencyKey }),
  })
}
