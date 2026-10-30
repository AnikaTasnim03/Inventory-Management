const STORAGE_KEY = 'inventra.notifications.v1'

const notificationTypes = {
  lowStock: {
    type: 'low-stock',
    title: 'Low stock',
    icon: '!',
  },
  outOfStock: {
    type: 'out-of-stock',
    title: 'Out of stock',
    icon: '×',
  },
  stockReceived: {
    type: 'stock-received',
    title: 'Stock received',
    icon: '↓',
  },
  stockIssued: {
    type: 'stock-issued',
    title: 'Stock issued',
    icon: '↑',
  },
  purchaseOrderCreated: {
    type: 'purchase-order-created',
    title: 'Purchase order created',
    icon: '▣',
  },
  purchaseOrderUpdated: {
    type: 'purchase-order-updated',
    title: 'Purchase order updated',
    icon: '↻',
  },
  purchaseOrderCancelled: {
    type: 'purchase-order-cancelled',
    title: 'Purchase order cancelled',
    icon: '×',
  },
  purchaseOrderPartial: {
    type: 'purchase-order-partial',
    title: 'Purchase order partially received',
    icon: '◷',
  },
  purchaseOrderReceived: {
    type: 'purchase-order-received',
    title: 'Purchase order received',
    icon: '✓',
  },
}

function isNotificationState(value) {
  return value
    && typeof value === 'object'
    && Array.isArray(value.notifications)
    && Array.isArray(value.deletedIds)
}

export function readNotificationState() {
  const raw = window.localStorage.getItem(STORAGE_KEY)
  if (!raw) return { notifications: [], deletedIds: [] }

  let parsed
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error('Saved notification preferences could not be read. Clear the Inventra notification data in this browser and reload.')
  }
  if (!isNotificationState(parsed)) {
    throw new Error('Saved notification preferences have an unsupported format. Clear the Inventra notification data in this browser and reload.')
  }
  return {
    notifications: parsed.notifications.filter((item) => item && typeof item.id === 'string'),
    deletedIds: parsed.deletedIds.filter((id) => typeof id === 'string'),
  }
}

export function writeNotificationState(state) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

export function persistNotificationActivity(notification) {
  const state = readNotificationState()
  if (state.deletedIds.includes(notification.id)) return
  if (state.notifications.some((item) => item.id === notification.id)) return
  writeNotificationState({
    ...state,
    notifications: [...state.notifications, { ...notification, read: false }],
  })
}

function makeNotification({ id, definition, message, timestamp, destination }) {
  return {
    id,
    type: definition.type,
    icon: definition.icon,
    title: definition.title,
    message,
    timestamp: timestamp || null,
    destination: destination || null,
  }
}

function getTimestamp(value) {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value)) ? value : null
}

function getProductStockStatus(product) {
  const quantityValue = product.quantity
  const reorderValue = product.reorderThreshold ?? product.reorder_level
  if (quantityValue === null || quantityValue === undefined || (typeof quantityValue === 'string' && !quantityValue.trim())) return null
  const quantity = Number(quantityValue)
  const reorderLevel = Number(reorderValue)
  if (!Number.isSafeInteger(quantity) || quantity < 0) return null
  if (quantity === 0) return 'out-of-stock'
  if (reorderValue === null || reorderValue === undefined || (typeof reorderValue === 'string' && !reorderValue.trim())) return null
  if (!Number.isSafeInteger(reorderLevel) || reorderLevel < 0) return null
  return quantity <= reorderLevel ? 'low-stock' : null
}

function buildProductNotifications(products) {
  return products.flatMap((product) => {
    const status = getProductStockStatus(product)
    if (!status) return []
    const isOut = status === 'out-of-stock'
    const definition = isOut ? notificationTypes.outOfStock : notificationTypes.lowStock
    const threshold = product.reorderThreshold ?? product.reorder_level
    return [makeNotification({
      id: `product-stock:${product.id}:${status}`,
      definition,
      message: isOut
        ? `${product.name} (${product.sku || 'No SKU'}) is out of stock.`
        : `${product.name} (${product.sku || 'No SKU'}) has ${product.quantity} unit(s), at or below its reorder level of ${threshold}.`,
      timestamp: getTimestamp(product.updatedAt || product.updated_at || product.createdAt || product.created_at),
      destination: { kind: 'product', id: product.id },
    })]
  })
}

function buildMovementNotifications(movements) {
  return movements.flatMap((movement) => {
    const isReceived = movement.type === 'Stock in'
    if (!isReceived && movement.type !== 'Stock out') return []
    const definition = isReceived ? notificationTypes.stockReceived : notificationTypes.stockIssued
    return [makeNotification({
      id: `stock-movement:${movement.id}`,
      definition,
      message: `${movement.quantity} unit(s) ${isReceived ? 'received for' : 'issued from'} ${movement.productName || `product ${movement.productId}`}${movement.reference && movement.reference !== 'Not specified' ? ` · Reference ${movement.reference}` : ''}.`,
      timestamp: getTimestamp(movement.date),
      destination: { kind: 'stock', id: movement.id, productId: movement.productId },
    })]
  })
}

function buildPurchaseOrderNotifications(orders) {
  return orders.flatMap((order) => {
    const notifications = []
    const orderName = `${order.orderNumber || `PO-${order.id}`} · ${order.supplierName || 'Supplier not specified'}`
    notifications.push(makeNotification({
      id: `purchase-order:${order.id}:created`,
      definition: notificationTypes.purchaseOrderCreated,
      message: `${orderName} was created as a draft.`,
      timestamp: getTimestamp(order.createdAt || order.created_at || order.orderDate),
      destination: { kind: 'order', id: order.id },
    }))

    if (order.status === 'Cancelled') {
      const cancellationTimestamp = order.updatedAt && order.updatedAt !== order.createdAt
        ? order.updatedAt
        : order.updated_at
      notifications.push(makeNotification({
        id: `purchase-order:${order.id}:cancelled`,
        definition: notificationTypes.purchaseOrderCancelled,
        message: `${orderName} is cancelled.`,
        timestamp: getTimestamp(cancellationTimestamp),
        destination: { kind: 'order', id: order.id },
      }))
    }

    const lines = Array.isArray(order.lines) ? order.lines : []
    const receipts = Array.isArray(order.receivingHistory)
      ? [...order.receivingHistory].sort((first, second) => {
        const firstDate = Date.parse(first.date || '')
        const secondDate = Date.parse(second.date || '')
        return (Number.isNaN(firstDate) ? 0 : firstDate) - (Number.isNaN(secondDate) ? 0 : secondDate)
      })
      : []
    const receivedByLine = new Map()
    let receiptNotifications = 0

    for (const receipt of receipts) {
      for (const entry of receipt.quantities || []) {
        const quantity = Number(entry.quantity)
        if (Number.isSafeInteger(quantity) && quantity > 0) {
          const itemId = String(entry.itemId ?? entry.item_id)
          receivedByLine.set(itemId, (receivedByLine.get(itemId) || 0) + quantity)
        }
      }
      const isComplete = lines.length > 0 && lines.every((line) => (
        (receivedByLine.get(String(line.id)) || 0) >= Number(line.orderedQuantity)
      ))
      const type = isComplete ? notificationTypes.purchaseOrderReceived : notificationTypes.purchaseOrderPartial
      notifications.push(makeNotification({
        id: `purchase-order:${order.id}:receipt:${receipt.id}`,
        definition: type,
        message: isComplete
          ? `${orderName} has been fully received (${receipt.totalQuantity || 0} unit(s) in this receipt).`
          : `${orderName} was partially received (${receipt.totalQuantity || 0} unit(s) in this receipt).`,
        timestamp: getTimestamp(receipt.date),
        destination: { kind: 'order', id: order.id },
      }))
      receiptNotifications += 1
    }

    if (receiptNotifications === 0 && order.status === 'Partially Received') {
      notifications.push(makeNotification({
        id: `purchase-order:${order.id}:partially-received`,
        definition: notificationTypes.purchaseOrderPartial,
        message: `${orderName} is partially received; some quantities remain outstanding.`,
        timestamp: null,
        destination: { kind: 'order', id: order.id },
      }))
    } else if (receiptNotifications === 0 && order.status === 'Received') {
      notifications.push(makeNotification({
        id: `purchase-order:${order.id}:received`,
        definition: notificationTypes.purchaseOrderReceived,
        message: `${orderName} is fully received.`,
        timestamp: null,
        destination: { kind: 'order', id: order.id },
      }))
    }
    return notifications
  })
}

export function buildSourceNotifications({ products = [], movements = [], orders = [] }) {
  return [
    ...buildProductNotifications(products),
    ...buildMovementNotifications(movements),
    ...buildPurchaseOrderNotifications(orders),
  ]
}

export function mergeNotificationState(state, sourceNotifications) {
  const deleted = new Set(state.deletedIds)
  const merged = new Map(state.notifications.map((item) => [item.id, item]))
  for (const notification of sourceNotifications) {
    if (deleted.has(notification.id)) continue
    const previous = merged.get(notification.id)
    merged.set(notification.id, {
      ...notification,
      timestamp: notification.timestamp || previous?.timestamp || null,
      read: previous?.read === true,
    })
  }
  return {
    notifications: [...merged.values()],
    deletedIds: [...deleted],
  }
}

export function createPurchaseOrderActivity({ order, type, message }) {
  const definition = type === 'purchase-order-cancelled'
    ? notificationTypes.purchaseOrderCancelled
    : notificationTypes.purchaseOrderUpdated
  const timestamp = new Date().toISOString()
  return makeNotification({
    id: type === 'purchase-order-cancelled'
      ? `purchase-order:${order.id}:cancelled`
      : `purchase-order-activity:${order.id}:${type}:${timestamp}`,
    definition,
    message,
    timestamp,
    destination: { kind: 'order', id: order.id },
  })
}

export function markNotificationRead(state, notificationId) {
  return {
    ...state,
    notifications: state.notifications.map((item) => (
      item.id === notificationId ? { ...item, read: true } : item
    )),
  }
}

export function markAllNotificationsRead(state) {
  return {
    ...state,
    notifications: state.notifications.map((item) => ({ ...item, read: true })),
  }
}

export function deleteNotification(state, notificationId) {
  return {
    notifications: state.notifications.filter((item) => item.id !== notificationId),
    deletedIds: [...new Set([...state.deletedIds, notificationId])],
  }
}
