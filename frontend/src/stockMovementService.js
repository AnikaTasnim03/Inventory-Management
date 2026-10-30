import { apiRequest } from './apiClient'

export function getStockMovements() { return apiRequest('/stock-movements') }
export function recordStockMovement(movement) {
  return apiRequest('/stock-movements', { method: 'POST', body: JSON.stringify(movement) })
}
