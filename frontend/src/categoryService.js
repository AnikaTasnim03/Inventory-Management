import { apiRequest } from './apiClient'

export function getCategories() {
  return apiRequest('/categories')
}

export function createCategory(category) {
  return apiRequest('/categories', { method: 'POST', body: JSON.stringify(category) })
}

export function updateCategory(id, category) {
  return apiRequest(`/categories/${id}`, { method: 'PUT', body: JSON.stringify(category) })
}

export function deleteCategory(id) {
  return apiRequest(`/categories/${id}`, { method: 'DELETE' })
}
