function parseNonNegativeInteger(value) {
  if (value === null || value === undefined || (typeof value === 'string' && !value.trim())) return null
  if (typeof value !== 'number' && typeof value !== 'string') return null
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null
}

function parseNonNegativeNumber(value) {
  if (value === null || value === undefined || (typeof value === 'string' && !value.trim())) return null
  if (typeof value !== 'number' && typeof value !== 'string') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null
}

function getLocalDateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function getReportDateRange(range, customStart, customEnd, now = new Date()) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  let start
  const end = getLocalDateKey(today)
  if (range === 'custom') {
    if (!customStart || !customEnd || customStart > customEnd) {
      return { start: null, end: null, valid: false }
    }
    return { start: customStart, end: customEnd, valid: true }
  }
  if (range === 'today') start = today
  else if (range === 'last-7-days') start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6)
  else if (range === 'this-month') start = new Date(today.getFullYear(), today.getMonth(), 1)
  else if (range === 'this-year') start = new Date(today.getFullYear(), 0, 1)
  else start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 29)
  return { start: getLocalDateKey(start), end, valid: true }
}

export function isWithinReportDateRange(value, dateRange) {
  if (!dateRange.valid) return false
  if (!dateRange.start && !dateRange.end) return true
  if (!value) return false
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return false
  const dateKey = getLocalDateKey(date)
  return (!dateRange.start || dateKey >= dateRange.start)
    && (!dateRange.end || dateKey <= dateRange.end)
}

export function getReportStockStatus(product) {
  const quantity = parseNonNegativeInteger(product.quantity)
  if (quantity === null) return 'unknown'
  if (quantity === 0) return 'out'
  const reorderValue = product.reorderThreshold ?? product.reorder_level
  const reorderLevel = parseNonNegativeInteger(reorderValue)
  if (reorderLevel === null) return 'unknown'
  return quantity <= reorderLevel ? 'low' : 'in-stock'
}

export function calculateInventoryMetrics(products) {
  const metrics = {
    productCount: products.length,
    totalQuantity: 0,
    totalValue: 0,
    lowStockCount: 0,
    outOfStockCount: 0,
    reorderCount: 0,
  }
  for (const product of products) {
    const quantity = parseNonNegativeInteger(product.quantity)
    const price = parseNonNegativeNumber(product.price ?? product.unit_price)
    const stockStatus = getReportStockStatus(product)
    if (quantity !== null) metrics.totalQuantity += quantity
    if (quantity !== null && price !== null) metrics.totalValue += quantity * price
    if (stockStatus === 'low') metrics.lowStockCount += 1
    if (stockStatus === 'out') metrics.outOfStockCount += 1
  }
  metrics.reorderCount = metrics.lowStockCount + metrics.outOfStockCount
  return metrics
}

function getMovementType(movement) {
  const type = String(movement.type || movement.movement_type || '').trim().toLowerCase()
  if (type === 'stock in' || type === 'in') return 'in'
  if (type === 'stock out' || type === 'out') return 'out'
  return null
}

export function buildMovementTimeSeries(movements, dateRange) {
  if (!dateRange.valid || !dateRange.start || !dateRange.end) return { interval: 'day', buckets: [] }
  const start = new Date(`${dateRange.start}T00:00:00`)
  const end = new Date(`${dateRange.end}T00:00:00`)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
    return { interval: 'day', buckets: [] }
  }
  const days = Math.floor((end - start) / 86400000) + 1
  const interval = days > 62 ? 'month' : 'day'
  const totals = new Map()
  for (const movement of movements) {
    const date = new Date(movement.date || movement.created_at || '')
    const type = getMovementType(movement)
    const quantity = parseNonNegativeInteger(movement.quantity)
    if (Number.isNaN(date.getTime()) || !type || quantity === null) continue
    const key = interval === 'month'
      ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      : getLocalDateKey(date)
    const bucket = totals.get(key) || { stockIn: 0, stockOut: 0 }
    if (type === 'in') bucket.stockIn += quantity
    else bucket.stockOut += quantity
    totals.set(key, bucket)
  }

  const buckets = []
  if (interval === 'month') {
    const cursor = new Date(start.getFullYear(), start.getMonth(), 1)
    const lastMonth = new Date(end.getFullYear(), end.getMonth(), 1)
    while (cursor <= lastMonth) {
      const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`
      buckets.push({ key, label: cursor.toLocaleDateString('en', { month: 'short', year: '2-digit' }), ...(totals.get(key) || { stockIn: 0, stockOut: 0 }) })
      cursor.setMonth(cursor.getMonth() + 1)
    }
  } else {
    const cursor = new Date(start)
    while (cursor <= end) {
      const key = getLocalDateKey(cursor)
      buckets.push({ key, label: cursor.toLocaleDateString('en', { month: 'short', day: 'numeric' }), ...(totals.get(key) || { stockIn: 0, stockOut: 0 }) })
      cursor.setDate(cursor.getDate() + 1)
    }
  }
  return { interval, buckets }
}

export function calculateMovementTotals(movements) {
  return movements.reduce((totals, movement) => {
    const type = getMovementType(movement)
    const quantity = parseNonNegativeInteger(movement.quantity)
    if (!type || quantity === null) return totals
    if (type === 'in') totals.stockIn += quantity
    else totals.stockOut += quantity
    return totals
  }, { stockIn: 0, stockOut: 0, net: 0 })
}

export function buildProductMovementSummary(movements, products) {
  const productById = new Map(products.map((product) => [String(product.id), product]))
  const summaryById = new Map()
  for (const movement of movements) {
    const type = getMovementType(movement)
    const quantity = parseNonNegativeInteger(movement.quantity)
    if (!type || quantity === null) continue
    const id = String(movement.productId ?? movement.product_id)
    const product = productById.get(id)
    const row = summaryById.get(id) || {
      id,
      name: product?.name || movement.productName || 'Unknown product',
      sku: product?.sku || movement.sku || '—',
      stockIn: 0,
      stockOut: 0,
      latestMovement: null,
    }
    if (type === 'in') row.stockIn += quantity
    else row.stockOut += quantity
    const movementTime = new Date(movement.date || '').getTime()
    if (!Number.isNaN(movementTime) && (!row.latestMovement || movementTime > new Date(row.latestMovement).getTime())) {
      row.latestMovement = movement.date
    }
    summaryById.set(id, row)
  }
  return [...summaryById.values()]
    .map((row) => ({ ...row, net: row.stockIn - row.stockOut }))
    .sort((first, second) => (second.stockIn + second.stockOut) - (first.stockIn + first.stockOut))
}

function getOrderStatus(order) {
  return order.status === 'Pending' ? 'Draft' : order.status
}

function getOrderLines(order) {
  return Array.isArray(order.lines) ? order.lines : []
}

function calculateOrderTotal(order) {
  return getOrderLines(order).reduce((total, line) => {
    const quantity = parseNonNegativeInteger(line.orderedQuantity ?? line.quantity)
    const unitCost = parseNonNegativeNumber(line.unitCost ?? line.unit_cost)
    return quantity === null || unitCost === null ? total : total + quantity * unitCost
  }, 0)
}

export function calculatePurchaseOrderAnalytics(orders) {
  const statuses = ['Draft', 'Ordered', 'Partially Received', 'Received', 'Cancelled']
  const statusCounts = Object.fromEntries(statuses.map((status) => [status, 0]))
  const summary = {
    count: orders.length,
    statusCounts,
    orderValue: 0,
    nonCancelledOrderValue: 0,
    orderedQuantity: 0,
    receivedQuantity: 0,
    outstandingQuantity: 0,
  }
  const suppliers = new Map()
  for (const order of orders) {
    const status = getOrderStatus(order)
    if (Object.hasOwn(statusCounts, status)) statusCounts[status] += 1
    const isCancelled = status === 'Cancelled'
    const orderValue = calculateOrderTotal(order)
    summary.orderValue += orderValue
    if (!isCancelled) summary.nonCancelledOrderValue += orderValue
    const supplierKey = String(order.supplierId ?? order.supplier_id ?? order.supplierName ?? 'unknown')
    const supplier = suppliers.get(supplierKey) || {
      id: supplierKey,
      name: order.supplierName || order.suppliers?.name || 'Unknown supplier',
      orderCount: 0,
      cancelledCount: 0,
      orderValue: 0,
      nonCancelledOrderValue: 0,
      orderedQuantity: 0,
      receivedQuantity: 0,
      outstandingQuantity: 0,
    }
    supplier.orderCount += 1
    supplier.orderValue += orderValue
    if (isCancelled) supplier.cancelledCount += 1
    else {
      supplier.nonCancelledOrderValue += orderValue
      for (const line of getOrderLines(order)) {
        const ordered = parseNonNegativeInteger(line.orderedQuantity ?? line.quantity)
        const received = parseNonNegativeInteger(line.receivedQuantity ?? line.received_quantity ?? 0)
        if (ordered === null || received === null) continue
        supplier.orderedQuantity += ordered
        supplier.receivedQuantity += received
        supplier.outstandingQuantity += Math.max(0, ordered - received)
      }
    }
    suppliers.set(supplierKey, supplier)

    if (!isCancelled) {
      for (const line of getOrderLines(order)) {
        const ordered = parseNonNegativeInteger(line.orderedQuantity ?? line.quantity)
        const received = parseNonNegativeInteger(line.receivedQuantity ?? line.received_quantity ?? 0)
        if (ordered === null || received === null) continue
        summary.orderedQuantity += ordered
        summary.receivedQuantity += received
        summary.outstandingQuantity += Math.max(0, ordered - received)
      }
    }
  }
  summary.suppliers = [...suppliers.values()]
    .sort((first, second) => second.orderValue - first.orderValue)
  return summary
}

export function getProductInventoryValue(product) {
  const quantity = parseNonNegativeInteger(product.quantity)
  const price = parseNonNegativeNumber(product.price ?? product.unit_price)
  return quantity === null || price === null ? null : quantity * price
}

export function getValidProductQuantity(product) {
  return parseNonNegativeInteger(product.quantity)
}
