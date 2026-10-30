import { apiRequest } from './apiClient'

function normalizeProduct(product) {
  return { ...product, imageUrl: product.imageUrl ?? product.image_url ?? '' }
}

export async function getProducts() {
  const products = await apiRequest('/products', { cache: 'no-store' })
  return products.map(normalizeProduct)
}

export async function createProduct(product) {
  const savedProduct = await apiRequest('/products', { method: 'POST', body: JSON.stringify(product) })
  return normalizeProduct(savedProduct)
}

export async function updateProduct(id, product) {
  const savedProduct = await apiRequest(`/products/${id}`, { method: 'PUT', body: JSON.stringify(product) })
  return normalizeProduct(savedProduct)
}

export function deleteProduct(id) { return apiRequest(`/products/${id}`, { method: 'DELETE' }) }
