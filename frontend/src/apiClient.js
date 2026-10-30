const API_BASE_URL = import.meta.env.VITE_API_URL

export async function apiRequest(path, options = {}) {
  if (!API_BASE_URL) throw new Error('The backend API URL is not configured.')
  const headers = new Headers(options.headers || {})
  headers.set('Content-Type', 'application/json')

  const response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers })
  const body = response.status === 204 ? null : await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(body?.message || `Request failed with status ${response.status}.`)
  return body
}
