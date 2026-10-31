import { apiRequest } from './apiClient'

export function getInventoryAudit(filters = {}) {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(filters)) {
    if (value !== '' && value !== null && value !== undefined) query.set(key, String(value))
  }
  const search = query.toString()
  const suffix = search ? `?${search}` : ''
  return apiRequest(`/stock-movements/audit${suffix}`)
}
