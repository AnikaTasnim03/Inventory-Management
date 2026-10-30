import { apiRequest } from './apiClient'

function normalizeSupplier(supplier) {
  return {
    ...supplier,
    categories: Array.isArray(supplier?.categories)
      ? supplier.categories.filter((category) => typeof category === 'string')
      : [],
  }
}

export async function getSuppliers() {
  const suppliers = await apiRequest('/suppliers')
  return Array.isArray(suppliers) ? suppliers.map(normalizeSupplier) : []
}

export async function createSupplier(supplier) {
  const savedSupplier = await apiRequest('/suppliers', { method: 'POST', body: JSON.stringify(supplier) })
  return normalizeSupplier(savedSupplier)
}

export async function updateSupplier(id, supplier) {
  const savedSupplier = await apiRequest(`/suppliers/${id}`, { method: 'PUT', body: JSON.stringify(supplier) })
  return normalizeSupplier(savedSupplier)
}

export function deleteSupplier(id) { return apiRequest(`/suppliers/${id}`, { method: 'DELETE' }) }
