import { useRef, useState } from 'react'
import './App.css'

const navigationItems = [
  { id: 'dashboard', label: 'Dashboard', icon: '▦' },
  { id: 'products', label: 'Products', icon: '□' },
  { id: 'stock', label: 'Stock Management', icon: '⇄' },
  { id: 'categories', label: 'Categories', icon: '▧' },
  { id: 'suppliers', label: 'Suppliers', icon: '♧' },
  { id: 'purchase-orders', label: 'Purchase Orders', icon: '▣' },
  { id: 'notifications', label: 'Notifications', icon: '!' },
  { id: 'reports', label: 'Reports & Analytics', icon: '▤' },
  { id: 'settings', label: 'Settings', icon: '⚙' },
]

const initialCategories = [
  { id: 1, name: 'IT Equipment', description: 'Computers, monitors, and other information technology assets.', createdAt: '2026-10-01' },
  { id: 2, name: 'Networking', description: 'Network infrastructure and connectivity equipment.', createdAt: '2026-10-01' },
  { id: 3, name: 'Office Supplies', description: 'Consumable supplies used for daily office work.', createdAt: '2026-10-01' },
  { id: 4, name: 'Furniture', description: 'Furniture and fixtures for workspaces.', createdAt: '2026-10-01' },
  { id: 5, name: 'Accessories', description: 'Cables, peripherals, and supporting equipment.', createdAt: '2026-10-01' },
  { id: 6, name: 'Other', description: 'Other inventory items not covered by the main categories.', createdAt: '2026-10-01' },
]

const initialSuppliers = [
  { id: 1, name: 'Demo Technology Supplier', contactPerson: 'Demo Contact', phone: '+880 1700-000001', email: 'technology@example.com', address: 'Fictional demo address', categories: ['IT Equipment'], notes: 'Fictional supplier for demonstration only.', createdAt: '2026-10-01', updatedAt: '2026-10-01' },
  { id: 2, name: 'Demo Network Supplier', contactPerson: 'Demo Contact', phone: '+880 1700-000002', email: 'network@example.com', address: 'Fictional demo address', categories: ['Networking'], notes: 'Fictional supplier for demonstration only.', createdAt: '2026-10-02', updatedAt: '2026-10-02' },
  { id: 3, name: 'Demo Office Supplier', contactPerson: 'Demo Contact', phone: '+880 1700-000003', email: 'office@example.com', address: 'Fictional demo address', categories: ['Office Supplies'], notes: 'Fictional supplier for demonstration only.', createdAt: '2026-10-03', updatedAt: '2026-10-03' },
  { id: 4, name: 'Demo Furniture Supplier', contactPerson: 'Demo Contact', phone: '+880 1700-000004', email: 'furniture@example.com', address: 'Fictional demo address', categories: ['Furniture'], notes: 'Fictional supplier for demonstration only.', createdAt: '2026-10-04', updatedAt: '2026-10-04' },
  { id: 5, name: 'Demo Telecom Supplier', contactPerson: 'Demo Contact', phone: '+880 1700-000005', email: 'telecom@example.com', address: 'Fictional demo address', categories: ['Accessories'], notes: 'Fictional supplier for demonstration only.', createdAt: '2026-10-05', updatedAt: '2026-10-05' },
]

const conditions = ['New', 'Good', 'Needs attention']
const departments = ['Administration', 'IT', 'Network Operations', 'Monitoring', 'Other']

// Temporary demonstration data. This is not connected to NTMC systems or a database.
const initialProducts = [
  {
    id: 1, name: 'Dell Latitude Laptop', sku: 'IT-LAP-001', category: 'IT Equipment',
    description: 'Business laptop for office and field work.', quantity: 6, price: 85000,
    supplier: 'Demo Technology Supplier', reorderThreshold: 2, condition: 'Good',
    department: 'IT', imageUrl: '/product-images/laptop.svg', createdAt: '2026-10-01', updatedAt: '2026-10-01',
  },
  {
    id: 2, name: 'Managed Network Switch', sku: 'NET-SW-024', category: 'Networking',
    description: 'Managed switch for network demonstration inventory.', quantity: 2, price: 18500,
    supplier: 'Demo Network Supplier', reorderThreshold: 2, condition: 'New',
    department: 'Network Operations', imageUrl: '/product-images/network-switch.svg', createdAt: '2026-10-03', updatedAt: '2026-10-03',
  },
  {
    id: 3, name: 'A4 Copy Paper', sku: 'OFF-PAP-100', category: 'Office Supplies',
    description: 'A4 paper ream for general office use.', quantity: 40, price: 650,
    supplier: 'Demo Office Supplier', reorderThreshold: 10, condition: 'New',
    department: 'Administration', imageUrl: '/product-images/office-paper.svg', createdAt: '2026-10-05', updatedAt: '2026-10-05',
  },
  {
    id: 4, name: 'Ergonomic Office Chair', sku: 'FUR-CHR-008', category: 'Furniture',
    description: 'Adjustable chair for workstation use.', quantity: 0, price: 12500,
    supplier: 'Demo Furniture Supplier', reorderThreshold: 2, condition: 'Good',
    department: 'Administration', imageUrl: '/product-images/office-chair.svg', createdAt: '2026-10-08', updatedAt: '2026-10-08',
  },
  {
    id: 5, name: 'Fiber Optic Patch Cable', sku: 'TEL-FIB-015', category: 'Accessories',
    description: 'Fiber patch cable for telecommunications equipment.', quantity: 3, price: 900,
    supplier: 'Demo Telecom Supplier', reorderThreshold: 5, condition: 'New',
    department: 'Monitoring', imageUrl: '/product-images/fiber-cable.svg', createdAt: '2026-10-10', updatedAt: '2026-10-10',
  },
]

const emptyForm = {
  name: '', sku: '', category: initialCategories[0].name, description: '', quantity: '',
  price: '', supplier: '', reorderThreshold: '', condition: 'New',
  department: departments[0], imageUrl: '',
}

const emptyMovementForm = {
  productId: '',
  type: 'Stock in',
  quantity: '',
  reference: '',
  department: departments[0],
  remarks: '',
}

const emptySupplierForm = {
  name: '', contactPerson: '', phone: '', email: '', address: '', categories: [], notes: '',
}

const emptyPurchaseOrderForm = {
  supplierId: '',
  expectedDelivery: '',
  notes: '',
  lines: [{ productId: '', orderedQuantity: '', unitCost: '' }],
}

const emptyReportFilters = {
  movementStart: '', movementEnd: '', movementProduct: 'all',
  movementCategory: 'all', movementType: 'all', movementReference: '',
  orderStart: '', orderEnd: '', orderSupplier: 'all', orderStatus: 'all',
}

function getStockStatus(product) {
  if (product.quantity === 0) return 'out'
  if (product.quantity <= product.reorderThreshold) return 'low'
  return 'in-stock'
}

function getStockLabel(product) {
  const status = getStockStatus(product)
  return status === 'out' ? 'Out of stock' : status === 'low' ? 'Low stock' : 'In stock'
}

function getSuggestedReorderQuantity(product) {
  return Math.max(1, (Number(product.reorderThreshold) || 0) * 2 - (Number(product.quantity) || 0))
}

function normalizeSku(sku) {
  return normalizeText(sku)
}

function normalizeText(value) {
  return String(value ?? '').trim().toLowerCase()
}

function formatDate(date) {
  const parsedDate = parseDateSafely(date)
  if (!parsedDate) return 'Not specified'
  return parsedDate.toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

function formatCurrency(value) {
  return `৳${Number(value || 0).toLocaleString('en-BD', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function getPurchaseOrderTotal(order) {
  return (order.lines || []).reduce((total, line) => total + (Number(line.orderedQuantity) || 0) * (Number(line.unitCost) || 0), 0)
}

function getNextOrderNumber(orders) {
  const highestNumber = orders.reduce((highest, order) => {
    const match = /^PO-\d{4}-(\d+)$/.exec(order.orderNumber || '')
    return match ? Math.max(highest, Number(match[1])) : highest
  }, 0)
  return `PO-${new Date().getFullYear()}-${String(highestNumber + 1).padStart(4, '0')}`
}

function parseDateSafely(value) {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function isDateOnOrAfter(value, start) {
  const date = parseDateSafely(value)
  if (!start) return true
  if (!date) return false
  return date >= new Date(`${start}T00:00:00`)
}

function isDateOnOrBefore(value, end) {
  const date = parseDateSafely(value)
  if (!end) return true
  if (!date) return false
  return date <= new Date(`${end}T23:59:59.999`)
}

function csvCell(value, numeric = false) {
  const text = String(value ?? '')
  if (!numeric && /^[=+\-@]/.test(text)) return `"'${text.replaceAll('"', '""')}"`
  return `"${text.replaceAll('"', '""')}"`
}

function downloadCsv(filename, headers, rows) {
  const csv = [headers.map((value) => ({ value })), ...rows].map((row) => row.map((cell) => {
    const normalizedCell = typeof cell === 'object' ? cell : { value: cell }
    return csvCell(normalizedCell.value, normalizedCell.numeric)
  }).join(',')).join('\r\n')
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

function App() {
  const [products, setProducts] = useState(initialProducts)
  const [categoryRecords, setCategoryRecords] = useState(initialCategories)
  const [suppliers, setSuppliers] = useState(initialSuppliers)
  const [stockMovements, setStockMovements] = useState([])
  const [activePage, setActivePage] = useState('dashboard')
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [sortBy, setSortBy] = useState('name')
  const [sortDirection, setSortDirection] = useState('asc')
  const [showForm, setShowForm] = useState(false)
  const [editingProduct, setEditingProduct] = useState(null)
  const [selectedProduct, setSelectedProduct] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [errors, setErrors] = useState({})
  const [successMessage, setSuccessMessage] = useState('')
  const [movementForm, setMovementForm] = useState(emptyMovementForm)
  const [movementErrors, setMovementErrors] = useState({})
  const [categorySearch, setCategorySearch] = useState('')
  const [categoryForm, setCategoryForm] = useState({ name: '', description: '' })
  const [editingCategory, setEditingCategory] = useState(null)
  const [categoryErrors, setCategoryErrors] = useState({})
  const [supplierSearch, setSupplierSearch] = useState('')
  const [supplierForm, setSupplierForm] = useState(emptySupplierForm)
  const [editingSupplier, setEditingSupplier] = useState(null)
  const [selectedSupplier, setSelectedSupplier] = useState(null)
  const [supplierErrors, setSupplierErrors] = useState({})
  const [showSupplierForm, setShowSupplierForm] = useState(false)
  const [purchaseOrders, setPurchaseOrders] = useState([])
  const [purchaseOrderSearch, setPurchaseOrderSearch] = useState('')
  const [purchaseOrderStatusFilter, setPurchaseOrderStatusFilter] = useState('all')
  const [purchaseOrderForm, setPurchaseOrderForm] = useState(emptyPurchaseOrderForm)
  const [editingPurchaseOrder, setEditingPurchaseOrder] = useState(null)
  const [selectedPurchaseOrder, setSelectedPurchaseOrder] = useState(null)
  const [purchaseOrderErrors, setPurchaseOrderErrors] = useState({})
  const [showPurchaseOrderForm, setShowPurchaseOrderForm] = useState(false)
  const [receiveForm, setReceiveForm] = useState(null)
  const [receiveErrors, setReceiveErrors] = useState({})
  const [receiveSubmitting, setReceiveSubmitting] = useState(false)
  const receiveSubmissionRef = useRef(null)
  const purchaseOrderSubmitRef = useRef(false)
  const [reportFilters, setReportFilters] = useState(emptyReportFilters)
  const [reorderQuantities, setReorderQuantities] = useState({})
  const [reorderSuppliers, setReorderSuppliers] = useState({})

  const filteredProducts = products
    .filter((product) => {
      const searchText = `${product.name ?? ''} ${product.sku ?? ''}`.toLowerCase()
      const matchesSearch = searchText.includes(normalizeText(search))
      const matchesCategory = categoryFilter === 'all' || product.category === categoryFilter
      const matchesStatus = statusFilter === 'all' || getStockStatus(product) === statusFilter
      return matchesSearch && matchesCategory && matchesStatus
    })
    .sort((first, second) => {
      const firstValue = sortBy === 'name' || sortBy === 'category'
        ? normalizeText(first[sortBy]) : first[sortBy]
      const secondValue = sortBy === 'name' || sortBy === 'category'
        ? normalizeText(second[sortBy]) : second[sortBy]
      const comparison = firstValue > secondValue ? 1 : firstValue < secondValue ? -1 : 0
      return sortDirection === 'asc' ? comparison : -comparison
    })

  const totalUnits = products.reduce((total, product) => total + product.quantity, 0)
  const inventoryValue = products.reduce((total, product) => total + product.quantity * product.price, 0)
  const lowStockProducts = products.filter((product) => getStockStatus(product) === 'low')
  const outOfStockProducts = products.filter((product) => getStockStatus(product) === 'out')
  const categoryOptions = categoryRecords.map((category) => category?.name).filter(Boolean)
  const visibleCategories = categoryRecords.filter((category) =>
    normalizeText(category?.name).includes(normalizeText(categorySearch))
  )
  const visibleSuppliers = suppliers.filter((supplier) =>
    normalizeText(`${supplier.name} ${supplier.contactPerson} ${supplier.email}`).includes(normalizeText(supplierSearch))
  )
  const visiblePurchaseOrders = purchaseOrders.filter((order) => {
    const matchesSearch = normalizeText(`${order.orderNumber} ${order.supplierName}`).includes(normalizeText(purchaseOrderSearch))
    const matchesStatus = purchaseOrderStatusFilter === 'all' || order.status === purchaseOrderStatusFilter
    return matchesSearch && matchesStatus
  })
  const notificationProducts = products.filter((product) => getStockStatus(product) === 'low' || getStockStatus(product) === 'out')
  const awaitingPurchaseOrders = purchaseOrders.filter((order) => order.status === 'Ordered' || order.status === 'Partially Received')
  const productAlertCount = notificationProducts.length
  const outstandingOrderCount = awaitingPurchaseOrders.length

  function handleNavigation(pageId) {
    setActivePage(pageId)
    setIsSidebarOpen(false)
    setSelectedProduct(null)
  }

  function openAddForm() {
    setEditingProduct(null)
    setForm(emptyForm)
    setErrors({})
    setSuccessMessage('')
    setShowForm(true)
    setSelectedProduct(null)
  }

  function openEditForm(product) {
    setEditingProduct(product)
    setForm({
      name: product.name, sku: product.sku, category: product.category,
      description: product.description, quantity: String(product.quantity),
      price: String(product.price), supplier: product.supplier,
      reorderThreshold: String(product.reorderThreshold), condition: product.condition,
      department: product.department, imageUrl: product.imageUrl,
    })
    setErrors({})
    setSuccessMessage('')
    setShowForm(true)
    setSelectedProduct(null)
  }

  function closeForm() {
    setShowForm(false)
    setEditingProduct(null)
    setForm(emptyForm)
    setErrors({})
  }

  function resetCategoryForm() {
    setCategoryForm({ name: '', description: '' })
    setEditingCategory(null)
    setCategoryErrors({})
  }

  function submitCategory(event) {
    event.preventDefault()
    const name = categoryForm.name.trim()
    const duplicate = categoryRecords.some((category) =>
      normalizeText(category?.name) === normalizeText(name) &&
      category.id !== editingCategory?.id
    )
    const nextErrors = {}
    if (!name) nextErrors.name = 'Enter a category name.'
    else if (duplicate) nextErrors.name = 'This category already exists.'
    setCategoryErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    if (editingCategory) {
      setCategoryRecords((current) => current.map((category) =>
        category.id === editingCategory.id ? { ...category, name, description: categoryForm.description.trim() } : category
      ))
      setProducts((current) => current.map((product) =>
        product.category === editingCategory.name ? { ...product, category: name } : product
      ))
      setSuccessMessage(`${name} was updated successfully.`)
    } else {
      setCategoryRecords((current) => [...current, {
        id: Date.now(), name, description: categoryForm.description.trim() || 'No description provided.', createdAt: new Date().toISOString(),
      }])
      setSuccessMessage(`${name} was added successfully.`)
    }
    resetCategoryForm()
  }

  function editCategory(category) {
    setEditingCategory(category)
    setCategoryForm({ name: category.name, description: category.description })
    setCategoryErrors({})
  }

  function deleteCategory(category) {
    const inUse = products.some((product) => product.category === category.name)
    if (inUse) {
      setSuccessMessage(`"${category.name}" cannot be deleted because products are assigned to it.`)
      return
    }
    if (window.confirm(`Delete "${category.name}"? This cannot be undone.`)) {
      setCategoryRecords((current) => current.filter((item) => item.id !== category.id))
      setSuccessMessage(`${category.name} was deleted.`)
    }
  }

  function openSupplierForm(supplier = null) {
    setEditingSupplier(supplier)
    setSupplierForm(supplier ? {
      name: supplier.name,
      contactPerson: supplier.contactPerson,
      phone: supplier.phone,
      email: supplier.email,
      address: supplier.address,
      categories: supplier.categories,
      notes: supplier.notes,
    } : emptySupplierForm)
    setSupplierErrors({})
    setShowSupplierForm(true)
    setSelectedSupplier(null)
  }

  function closeSupplierForm() {
    setShowSupplierForm(false)
    setEditingSupplier(null)
    setSupplierForm(emptySupplierForm)
    setSupplierErrors({})
  }

  function submitSupplier(event) {
    event.preventDefault()
    const name = supplierForm.name.trim()
    const nextErrors = {}
    const duplicate = suppliers.some((supplier) =>
      normalizeText(supplier.name) === normalizeText(name) && supplier.id !== editingSupplier?.id
    )
    if (!name) nextErrors.name = 'Enter a supplier name.'
    else if (duplicate) nextErrors.name = 'This supplier name already exists.'
    if (supplierForm.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(supplierForm.email.trim())) {
      nextErrors.email = 'Enter a valid email address.'
    }
    if (supplierForm.phone.trim() && !/^(?=(?:\D*\d){7,})[+()\d\s-]+$/.test(supplierForm.phone.trim())) {
      nextErrors.phone = 'Enter a valid phone number with at least 7 digits.'
    }
    setSupplierErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    const now = new Date().toISOString()
    const supplierData = {
      name,
      contactPerson: supplierForm.contactPerson.trim(),
      phone: supplierForm.phone.trim(),
      email: supplierForm.email.trim(),
      address: supplierForm.address.trim(),
      categories: supplierForm.categories,
      notes: supplierForm.notes.trim(),
    }
    if (editingSupplier) {
      setSuppliers((current) => current.map((supplier) =>
        supplier.id === editingSupplier.id ? { ...supplier, ...supplierData, updatedAt: now } : supplier
      ))
      if (normalizeText(editingSupplier.name) !== normalizeText(name)) {
        setProducts((current) => current.map((product) =>
          normalizeText(product.supplier) === normalizeText(editingSupplier.name)
            ? { ...product, supplier: name, updatedAt: now }
            : product
        ))
      }
      setSuccessMessage(`${name} was updated successfully.`)
    } else {
      setSuppliers((current) => [...current, { id: Date.now(), ...supplierData, createdAt: now, updatedAt: now }])
      setSuccessMessage(`${name} was added successfully.`)
    }
    closeSupplierForm()
  }

  function deleteSupplier(supplier) {
    const assignedProducts = products.filter((product) =>
      normalizeText(product.supplier) === normalizeText(supplier.name)
    )
    if (assignedProducts.length > 0) {
      setSuccessMessage(`"${supplier.name}" cannot be deleted because it is assigned to ${assignedProducts.length} product${assignedProducts.length === 1 ? '' : 's'}. Reassign those products first.`)
      return
    }
    if (window.confirm(`Delete "${supplier.name}"? This cannot be undone.`)) {
      setSuppliers((current) => current.filter((item) => item.id !== supplier.id))
      setSelectedSupplier(null)
      setSuccessMessage(`${supplier.name} was deleted.`)
    }
  }

  function openPurchaseOrderForm(order = null) {
    setEditingPurchaseOrder(order)
    setPurchaseOrderForm(order ? {
      supplierId: String(order.supplierId),
      expectedDelivery: order.expectedDelivery || '',
      notes: order.notes || '',
      lines: order.lines.map((line) => ({
        productId: String(line.productId),
        orderedQuantity: String(line.orderedQuantity),
        unitCost: String(line.unitCost),
      })),
    } : emptyPurchaseOrderForm)
    setPurchaseOrderErrors({})
    setShowPurchaseOrderForm(true)
    setSelectedPurchaseOrder(null)
  }

  function openPurchaseOrderFromRecommendation(product, quantity, supplierId) {
    setActivePage('purchase-orders')
    setSelectedPurchaseOrder(null)
    setEditingPurchaseOrder(null)
    setPurchaseOrderForm({
      supplierId: supplierId || '',
      expectedDelivery: '',
      notes: `Draft recommendation for ${product.name}. Suggested quantity only; review before placing.`,
      lines: [{ productId: String(product.id), orderedQuantity: String(quantity), unitCost: String(product.price ?? '') }],
    })
    setPurchaseOrderErrors({})
    setShowPurchaseOrderForm(true)
  }

  function closePurchaseOrderForm() {
    setShowPurchaseOrderForm(false)
    setEditingPurchaseOrder(null)
    setPurchaseOrderForm(emptyPurchaseOrderForm)
    setPurchaseOrderErrors({})
  }

  function submitPurchaseOrder(event) {
    event.preventDefault()
    if (purchaseOrderSubmitRef.current) return
    const nextErrors = {}
    if (editingPurchaseOrder && editingPurchaseOrder.status !== 'Draft') {
      setPurchaseOrderErrors({ form: 'Only draft orders can be edited.' })
      return
    }
    const supplier = suppliers.find((item) => item.id === Number(purchaseOrderForm.supplierId))
    if (!supplier) nextErrors.supplierId = 'Select an existing supplier.'
    if (!purchaseOrderForm.lines.length) nextErrors.lines = 'Add at least one product line.'
    const seenProducts = new Set()
    const lineData = purchaseOrderForm.lines.map((line, index) => {
      const product = products.find((item) => item.id === Number(line.productId))
      const quantity = Number(line.orderedQuantity)
      const unitCost = Number(line.unitCost)
      if (!product) nextErrors[`product-${index}`] = 'Select an existing product.'
      if (seenProducts.has(line.productId)) nextErrors[`product-${index}`] = 'Each product may appear only once.'
      seenProducts.add(line.productId)
      if (!Number.isInteger(quantity) || quantity <= 0) nextErrors[`quantity-${index}`] = 'Use a positive whole number.'
      if (!Number.isFinite(unitCost) || unitCost < 0) nextErrors[`cost-${index}`] = 'Use a valid non-negative cost.'
      const previousReceived = editingPurchaseOrder?.lines.find((item) => item.productId === product?.id)?.receivedQuantity || 0
      if (quantity < previousReceived) nextErrors[`quantity-${index}`] = `Quantity cannot be less than ${previousReceived} already received.`
      return product ? {
        productId: product.id,
        productName: product.name,
        sku: product.sku,
        orderedQuantity: quantity,
        unitCost,
        receivedQuantity: editingPurchaseOrder?.lines.find((item) => item.productId === product.id)?.receivedQuantity || 0,
        lineTotal: quantity * unitCost,
      } : null
    })
    setPurchaseOrderErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return
    purchaseOrderSubmitRef.current = true

    const now = new Date().toISOString()
    if (editingPurchaseOrder) {
      setPurchaseOrders((current) => current.map((order) => order.id === editingPurchaseOrder.id
        ? { ...order, supplierId: supplier.id, supplierName: supplier.name, expectedDelivery: purchaseOrderForm.expectedDelivery, notes: purchaseOrderForm.notes.trim(), lines: lineData, updatedAt: now }
        : order))
      setSuccessMessage(`${editingPurchaseOrder.orderNumber} was updated successfully.`)
    } else {
      setPurchaseOrders((current) => [...current, {
        id: Date.now(),
        orderNumber: getNextOrderNumber(current),
        supplierId: supplier.id,
        supplierName: supplier.name,
        orderDate: now,
        expectedDelivery: purchaseOrderForm.expectedDelivery,
        status: 'Draft',
        notes: purchaseOrderForm.notes.trim(),
        lines: lineData,
        receivingHistory: [],
        createdAt: now,
        updatedAt: now,
      }])
      setSuccessMessage('Purchase order was created as a draft.')
    }
    closePurchaseOrderForm()
    purchaseOrderSubmitRef.current = false
  }

  function updatePurchaseOrderStatus(order, nextStatus) {
    if (nextStatus === 'Ordered') {
      if (!window.confirm(`Place ${order.orderNumber}? It will no longer be a draft.`)) return
    }
    if (nextStatus === 'Cancelled') {
      if (order.lines.some((line) => line.receivedQuantity > 0)) {
        setSuccessMessage(`${order.orderNumber} cannot be cancelled because items have already been received.`)
        return
      }
      if (!window.confirm(`Cancel ${order.orderNumber}? This cannot be undone.`)) return
    }
    setPurchaseOrders((current) => current.map((item) =>
      item.id === order.id ? { ...item, status: nextStatus, updatedAt: new Date().toISOString() } : item
    ))
    setSelectedPurchaseOrder((current) => current?.id === order.id ? { ...current, status: nextStatus } : current)
    setSuccessMessage(`${order.orderNumber} is now ${nextStatus}.`)
  }

  function openReceiveForm(order) {
    receiveSubmissionRef.current = null
    setSelectedPurchaseOrder(null)
    setReceiveErrors({})
    setReceiveForm({
      order,
      lines: order.lines.map((line) => ({ productId: line.productId, quantity: '' })),
    })
  }

  function submitReceipt(event) {
    event.preventDefault()
    if (!receiveForm || receiveSubmitting || receiveSubmissionRef.current === receiveForm.order.id) return
    const nextErrors = {}
    const order = purchaseOrders.find((item) => item.id === receiveForm.order.id)
    if (!order || order.status === 'Cancelled' || order.status === 'Received') {
      setReceiveErrors({ form: 'This order is no longer available for receiving.' })
      return
    }
    let hasReceipt = false
    const receiptLines = receiveForm.lines.map((entry, index) => {
      const orderLine = order.lines.find((line) => line.productId === entry.productId)
      const quantity = entry.quantity === '' ? 0 : Number(entry.quantity)
      const outstanding = orderLine ? orderLine.orderedQuantity - orderLine.receivedQuantity : 0
      if (!orderLine) nextErrors[`quantity-${index}`] = 'This order line no longer exists.'
      else if (!Number.isInteger(quantity) || quantity < 0) nextErrors[`quantity-${index}`] = 'Use a non-negative whole number.'
      else if (quantity > outstanding) nextErrors[`quantity-${index}`] = `Only ${outstanding} unit${outstanding === 1 ? '' : 's'} outstanding.`
      if (quantity > 0) hasReceipt = true
      return { orderLine, quantity }
    })
    if (!hasReceipt) nextErrors.form = 'Enter at least one positive quantity to receive.'
    setReceiveErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    receiveSubmissionRef.current = receiveForm.order.id
    setReceiveSubmitting(true)
    const now = new Date().toISOString()
    const validReceipts = receiptLines.filter((entry) => entry.quantity > 0)
    const updatedProducts = products.map((product) => {
      const receipt = validReceipts.find((entry) => entry.orderLine.productId === product.id)
      return receipt ? { ...product, quantity: product.quantity + receipt.quantity, updatedAt: now } : product
    })
    const newMovements = validReceipts.map(({ orderLine, quantity }) => {
      const product = products.find((item) => item.id === orderLine.productId)
      return {
        id: Date.now() + orderLine.productId,
        productId: product.id,
        productName: product.name,
        sku: product.sku,
        type: 'Stock in',
        quantity,
        previousQuantity: product.quantity,
        resultingQuantity: product.quantity + quantity,
        date: now,
        reference: order.orderNumber,
        department: product.department,
        remarks: `Received against ${order.orderNumber}.`,
      }
    })
    const receivedTotal = validReceipts.reduce((total, entry) => total + entry.quantity, 0)
    const updatedOrder = {
      ...order,
      lines: order.lines.map((line) => {
        const receipt = validReceipts.find((entry) => entry.orderLine.productId === line.productId)
        return receipt ? { ...line, receivedQuantity: line.receivedQuantity + receipt.quantity, lineTotal: line.orderedQuantity * line.unitCost } : line
      }),
      updatedAt: now,
      receivingHistory: [...order.receivingHistory, {
        id: Date.now(),
        date: now,
        quantities: validReceipts.map((entry) => ({ productId: entry.orderLine.productId, quantity: entry.quantity })),
        totalQuantity: receivedTotal,
      }],
    }
    updatedOrder.status = updatedOrder.lines.every((line) => line.receivedQuantity >= line.orderedQuantity)
      ? 'Received' : 'Partially Received'
    setProducts(updatedProducts)
    setStockMovements((current) => [...newMovements, ...current])
    setPurchaseOrders((current) => current.map((item) => item.id === order.id ? updatedOrder : item))
    setReceiveForm(null)
    setReceiveErrors({})
    setSelectedPurchaseOrder(updatedOrder)
    setSuccessMessage(`${order.orderNumber} receipt recorded and stock updated.`)
    receiveSubmissionRef.current = null
    setReceiveSubmitting(false)
  }

  function validateForm() {
    const nextErrors = {}
    const trimmedSku = form.sku.trim()
    const duplicateSku = products.some((product) =>
      normalizeSku(product.sku) === normalizeSku(trimmedSku) &&
      product.id !== editingProduct?.id
    )

    if (!form.name.trim()) nextErrors.name = 'Enter a product name.'
    if (!trimmedSku) nextErrors.sku = 'Enter a unique SKU.'
    else if (duplicateSku) nextErrors.sku = 'This SKU is already used by another product.'
    if (!form.category) nextErrors.category = 'Choose a category.'
    if (form.quantity === '' || !Number.isInteger(Number(form.quantity)) || Number(form.quantity) < 0) {
      nextErrors.quantity = 'Use a non-negative whole number.'
    }
    if (form.reorderThreshold === '' || !Number.isInteger(Number(form.reorderThreshold)) || Number(form.reorderThreshold) < 0) {
      nextErrors.reorderThreshold = 'Use a non-negative whole number.'
    }
    if (form.price === '' || !Number.isFinite(Number(form.price)) || Number(form.price) < 0) {
      nextErrors.price = 'Use a valid non-negative price.'
    }
    if (form.imageUrl.trim()) {
      try {
        new URL(form.imageUrl.trim())
      } catch {
        nextErrors.imageUrl = 'Use a complete image URL, including https://.'
      }
    }
    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  function handleSubmit(event) {
    event.preventDefault()
    setSuccessMessage('')
    if (!validateForm()) return

    const now = new Date().toISOString()
    const productData = {
      name: form.name.trim(), sku: form.sku.trim(), category: form.category,
      description: form.description.trim(), quantity: Number(form.quantity),
      price: Number(form.price), supplier: form.supplier.trim() || 'Not specified',
      reorderThreshold: Number(form.reorderThreshold), condition: form.condition,
      department: form.department, imageUrl: form.imageUrl.trim(),
    }

    if (editingProduct) {
      setProducts((current) => current.map((product) =>
        product.id === editingProduct.id
          ? { ...product, ...productData, updatedAt: now }
          : product
      ))
      setSuccessMessage(`${productData.name} was updated successfully.`)
    } else {
      setProducts((current) => [...current, {
        id: Date.now(), ...productData, createdAt: now, updatedAt: now,
      }])
      setSuccessMessage(`${productData.name} was added successfully.`)
    }
    setForm(emptyForm)
    setErrors({})
    setShowForm(false)
    setEditingProduct(null)
  }

  function deleteProduct(product) {
    if (window.confirm(`Delete "${product.name}"? This cannot be undone.`)) {
      setProducts((current) => current.filter((item) => item.id !== product.id))
      setSelectedProduct(null)
      setSuccessMessage(`${product.name} was deleted.`)
    }

  }

  function handleMovementSubmit(event) {
    event.preventDefault()
    const errorsForMovement = {}
    const quantity = Number(movementForm.quantity)
    const product = products.find((item) => item.id === Number(movementForm.productId))

    if (!product) errorsForMovement.productId = 'Select a product.'
    if (movementForm.quantity === '' || !Number.isInteger(quantity) || quantity <= 0) {
      errorsForMovement.quantity = 'Enter a positive whole number.'
    }
    if (product && movementForm.type === 'Stock out' && quantity > product.quantity) {
      errorsForMovement.quantity = `Only ${product.quantity} unit${product.quantity === 1 ? '' : 's'} available.`
    }

    setMovementErrors(errorsForMovement)
    if (Object.keys(errorsForMovement).length > 0) return

    const resultingQuantity = movementForm.type === 'Stock in'
      ? product.quantity + quantity
      : product.quantity - quantity
    const now = new Date().toISOString()
    const movement = {
      id: Date.now(),
      productId: product.id,
      productName: product.name,
      sku: product.sku,
      type: movementForm.type,
      quantity,
      previousQuantity: product.quantity,
      resultingQuantity,
      date: now,
      reference: movementForm.reference.trim() || 'Not specified',
      department: movementForm.department,
      remarks: movementForm.remarks.trim(),
    }

    setProducts((current) => current.map((item) =>
      item.id === product.id ? { ...item, quantity: resultingQuantity, updatedAt: now } : item
    ))
    setStockMovements((current) => [movement, ...current])
    setMovementForm(emptyMovementForm)
    setMovementErrors({})
    setSuccessMessage(`${movementForm.type} recorded for ${product.name}.`)
  }

  function handleSortChange(event) {
    const nextSort = event.target.value
    if (nextSort === sortBy) setSortDirection((direction) => direction === 'asc' ? 'desc' : 'asc')
    else {
      setSortBy(nextSort)
      setSortDirection('asc')
    }
  }

  function clearFilters() {
    setSearch('')
    setCategoryFilter('all')
    setStatusFilter('all')
    setSortBy('name')
    setSortDirection('asc')
  }

  const activeItem = navigationItems.find((item) => item.id === activePage)
  const isDashboard = activePage === 'dashboard'
  const isProducts = activePage === 'products'
  const isPurchaseOrders = activePage === 'purchase-orders'
  const isReports = activePage === 'reports'
  const isNotifications = activePage === 'notifications'

  return (
    <div className="app">
      {isSidebarOpen && <button className="sidebar-backdrop" aria-label="Close navigation" onClick={() => setIsSidebarOpen(false)} />}
      <aside className={`sidebar ${isSidebarOpen ? 'sidebar-open' : ''}`}>
        <div className="brand"><span className="brand-icon">I</span><span>Inventra</span><button className="sidebar-close" aria-label="Close navigation" onClick={() => setIsSidebarOpen(false)}>×</button></div>
        <p className="nav-label">WORKSPACE</p>
        <nav aria-label="Main navigation">
          {navigationItems.map((item) => <button className={`nav-item ${activePage === item.id ? 'active' : ''}`} key={item.id} onClick={() => handleNavigation(item.id)}><span className="nav-icon" aria-hidden="true">{item.icon}</span>{item.label}</button>)}
        </nav>
      </aside>

      <main className="main">
        <header className="topbar">
          <button className="menu-button" aria-label="Open navigation" onClick={() => setIsSidebarOpen(true)}>☰</button>
          <div className="page-heading"><p className="eyebrow">WORKSPACE / {activeItem.label.toUpperCase()}</p><h1>{isDashboard ? 'Inventory Dashboard' : activeItem.label}</h1><p className="subtitle">{isDashboard ? 'Monitor your products and stock levels.' : isProducts ? 'Manage and monitor your current stock.' : activePage === 'stock' ? 'Record stock in, stock out, and review inventory history.' : activePage === 'categories' ? 'Organize products with reusable inventory categories.' : activePage === 'suppliers' ? 'Manage supplier contacts and product assignments.' : isPurchaseOrders ? 'Create orders, track delivery, and receive inventory.' : isReports ? 'Review current inventory, stock activity, and purchasing data.' : isNotifications ? 'Review current stock alerts and create replenishment drafts.' : 'This workspace is planned for a future phase.'}</p></div>
          {isDashboard && <div className="topbar-actions"><button className="secondary-button" onClick={() => handleNavigation('notifications')}>Alerts: {productAlertCount} products · {outstandingOrderCount} orders</button><button className="primary-button" onClick={openAddForm}>+ Add Product</button></div>}
        </header>

        {successMessage && <div className="success-message" role="status">{successMessage}</div>}

        {(isProducts || (isDashboard && showForm)) && <ProductForm categories={categoryOptions} suppliers={suppliers} form={form} setForm={setForm} errors={errors} editingProduct={editingProduct} onSubmit={handleSubmit} onCancel={closeForm} />}

        {isDashboard && <Dashboard products={products} totalUnits={totalUnits} inventoryValue={inventoryValue} lowStockProducts={lowStockProducts} outOfStockProducts={outOfStockProducts} stockMovements={stockMovements} productAlertCount={productAlertCount} outstandingOrderCount={outstandingOrderCount} onProducts={() => handleNavigation('products')} onStock={() => handleNavigation('stock')} onNotifications={() => handleNavigation('notifications')} onView={setSelectedProduct} />}

        {isProducts && (
          <>
            <ProductFilters categories={categoryOptions} search={search} setSearch={setSearch} categoryFilter={categoryFilter} setCategoryFilter={setCategoryFilter} statusFilter={statusFilter} setStatusFilter={setStatusFilter} sortBy={sortBy} sortDirection={sortDirection} onSort={handleSortChange} onClear={clearFilters} />
            {selectedProduct && <ProductDetails product={selectedProduct} onClose={() => setSelectedProduct(null)} onEdit={() => openEditForm(selectedProduct)} onDelete={() => deleteProduct(selectedProduct)} />}
            <ProductTable products={products} filteredProducts={filteredProducts} onView={setSelectedProduct} onEdit={openEditForm} onDelete={deleteProduct} />
          </>
        )}

        {activePage === 'stock' && <StockManagement products={products} movementForm={movementForm} setMovementForm={setMovementForm} errors={movementErrors} onSubmit={handleMovementSubmit} movements={stockMovements} />}
        {activePage === 'categories' && <CategoryManagement categories={visibleCategories} search={categorySearch} setSearch={setCategorySearch} form={categoryForm} setForm={setCategoryForm} errors={categoryErrors} editingCategory={editingCategory} onSubmit={submitCategory} onEdit={editCategory} onDelete={deleteCategory} onCancel={resetCategoryForm} />}
        {activePage === 'suppliers' && <SupplierManagement suppliers={visibleSuppliers} products={products} categories={categoryOptions} search={supplierSearch} setSearch={setSupplierSearch} form={supplierForm} setForm={setSupplierForm} errors={supplierErrors} editingSupplier={editingSupplier} selectedSupplier={selectedSupplier} onSelect={setSelectedSupplier} showForm={showSupplierForm} onAdd={() => openSupplierForm()} onEdit={openSupplierForm} onDelete={deleteSupplier} onSubmit={submitSupplier} onCancel={closeSupplierForm} />}
        {isPurchaseOrders && <PurchaseOrderManagement orders={visiblePurchaseOrders} allOrders={purchaseOrders} products={products} suppliers={suppliers} search={purchaseOrderSearch} setSearch={setPurchaseOrderSearch} statusFilter={purchaseOrderStatusFilter} setStatusFilter={setPurchaseOrderStatusFilter} form={purchaseOrderForm} setForm={setPurchaseOrderForm} errors={purchaseOrderErrors} editingOrder={editingPurchaseOrder} selectedOrder={selectedPurchaseOrder} showForm={showPurchaseOrderForm} receiveForm={receiveForm} setReceiveForm={setReceiveForm} receiveErrors={receiveErrors} receiveSubmitting={receiveSubmitting} onAdd={() => openPurchaseOrderForm()} onEdit={openPurchaseOrderForm} onSelect={setSelectedPurchaseOrder} onSubmit={submitPurchaseOrder} onCancel={closePurchaseOrderForm} onPlace={(order) => updatePurchaseOrderStatus(order, 'Ordered')} onCancelOrder={(order) => updatePurchaseOrderStatus(order, 'Cancelled')} onReceive={openReceiveForm} onReceiveSubmit={submitReceipt} onReceiveCancel={() => { setReceiveForm(null); setReceiveErrors({}) }} />}
        {isReports && <Reports products={products} categories={categoryRecords} suppliers={suppliers} movements={stockMovements} orders={purchaseOrders} filters={reportFilters} setFilters={setReportFilters} />}
        {isNotifications && <NotificationsPage products={notificationProducts} orders={awaitingPurchaseOrders} suppliers={suppliers} reorderQuantities={reorderQuantities} setReorderQuantities={setReorderQuantities} reorderSuppliers={reorderSuppliers} setReorderSuppliers={setReorderSuppliers} onProduct={(product) => { handleNavigation('products'); setSelectedProduct(product) }} onOrder={(order) => { handleNavigation('purchase-orders'); setSelectedPurchaseOrder(order) }} onCreateOrder={openPurchaseOrderFromRecommendation} />}

        {!isDashboard && !isProducts && activePage !== 'stock' && activePage !== 'categories' && activePage !== 'suppliers' && !isPurchaseOrders && !isReports && !isNotifications && <section className="planned-card"><span className="planned-icon">◌</span><h2>{activeItem.label} is planned</h2><p>This navigation item is visible for the future Inventra roadmap. It will become functional in a later implementation phase.</p></section>}
        <footer>Built with React · Demo data only</footer>
      </main>
    </div>
  )
}

function Dashboard({ products, totalUnits, inventoryValue, lowStockProducts, outOfStockProducts, stockMovements, productAlertCount, outstandingOrderCount, onProducts, onStock, onNotifications, onView }) {
  return (
    <>
      {(productAlertCount > 0 || outstandingOrderCount > 0) && <section className="attention-banner"><div><strong>Attention needed</strong><span>{productAlertCount} product alert{productAlertCount === 1 ? '' : 's'} · {outstandingOrderCount} purchase order{outstandingOrderCount === 1 ? '' : 's'} awaiting receipt</span></div><button className="secondary-button" onClick={onNotifications}>Review notifications</button></section>}
      <section className="stats" aria-label="Inventory summary">
        <StatCard icon="▦" color="purple" label="Total Products" value={products.length} detail="Unique products in inventory" />
        <StatCard icon="▤" color="blue" label="Total Units in Stock" value={totalUnits} detail="Across all products" />
        <StatCard icon="!" color="orange" label="Low Stock Items" value={lowStockProducts.length} detail="At or below reorder threshold" />
        <StatCard icon="×" color="red" label="Out of Stock" value={outOfStockProducts.length} detail="Products needing replenishment" />
        <StatCard icon="৳" color="green" label="Inventory Value" value={`৳${inventoryValue.toLocaleString('en-BD')}`} detail="Estimated value at listed prices" />
      </section>
      <section className="dashboard-grid">
        <article className="overview-card"><div className="section-heading"><div><h2>Low-stock products</h2><p>Items at or below their reorder threshold.</p></div><button className="text-button" onClick={onProducts}>View products</button></div>{lowStockProducts.length ? <div className="overview-list">{lowStockProducts.map((product) => <button className="overview-row overview-button" key={product.id} onClick={() => onView(product)}><span className="list-icon orange">!</span><div><strong>{product.name}</strong><small>{product.category}</small></div><span className="quantity-warning">{product.quantity} left</span></button>)}</div> : <EmptyState message="No low-stock products right now." />}</article>
        <article className="overview-card"><div className="section-heading"><div><h2>Recent stock movements</h2><p>Recorded in this browser session.</p></div><button className="text-button" onClick={onStock}>View history</button></div>{stockMovements.length ? <div className="overview-list">{stockMovements.slice(0, 3).map((movement) => <div className="overview-row" key={movement.id}><span className={`list-icon ${movement.type === 'Stock in' ? 'green' : 'blue'}`}>{movement.type === 'Stock in' ? '↓' : '↑'}</span><div><strong>{movement.productName}</strong><small>{formatMovementDate(movement.date)} · {movement.type}</small></div><span className="movement-quantity">{movement.type === 'Stock in' ? '+' : '-'}{movement.quantity}</span></div>)}</div> : <EmptyState message="No stock movements recorded yet." />}</article>
      </section>
      <section className="table-card dashboard-products"><div className="table-heading"><div><h2>Product inventory</h2><p>Manage and monitor your current stock.</p></div><button className="text-button" onClick={onProducts}>View all products</button></div><ProductTable products={products} filteredProducts={products.slice(0, 5)} onView={onView} onEdit={() => {}} onDelete={() => {}} compact /></section>
    </>
  )
}

function NotificationsPage({ products, orders, suppliers, reorderQuantities, setReorderQuantities, reorderSuppliers, setReorderSuppliers, onProduct, onOrder, onCreateOrder }) {
  const [recommendationErrors, setRecommendationErrors] = useState({})
  const getSupplier = (product) => suppliers.find((supplier) => normalizeText(supplier.name) === normalizeText(product.supplier))
  const getQuantity = (product) => reorderQuantities[product.id] ?? getSuggestedReorderQuantity(product)
  const getSupplierId = (product) => reorderSuppliers[product.id] ?? String(getSupplier(product)?.id || '')
  function updateQuantity(product, value) {
    setReorderQuantities((current) => ({ ...current, [product.id]: value }))
    setRecommendationErrors((current) => ({ ...current, [product.id]: '' }))
  }
  function startOrder(product) {
    const quantity = Number(getQuantity(product))
    if (!Number.isInteger(quantity) || quantity <= 0) {
      setRecommendationErrors((current) => ({ ...current, [product.id]: 'Use a positive whole number.' }))
      return
    }
    setRecommendationErrors((current) => ({ ...current, [product.id]: '' }))
    onCreateOrder(product, quantity, getSupplierId(product))
  }
  return <section className="notifications-page">
    <section className="notification-summary"><article className="attention-card red"><strong>{products.filter((product) => getStockStatus(product) === 'out').length}</strong><span>Out-of-stock products</span></article><article className="attention-card orange"><strong>{products.filter((product) => getStockStatus(product) === 'low').length}</strong><span>Low-stock products</span></article><article className="attention-card blue"><strong>{orders.length}</strong><span>Orders awaiting receipt</span></article></section>
    <section className="table-card notification-card"><div className="table-heading"><div><h2>Actionable notifications</h2><p>Alerts are derived from current quantities and purchase-order status. They reset with React state on refresh.</p></div></div><div className="notification-list">
      {products.map((product) => <button className="notification-item" key={`product-${product.id}`} onClick={() => onProduct(product)}><span className={`list-icon ${getStockStatus(product) === 'out' ? 'red' : 'orange'}`}>{getStockStatus(product) === 'out' ? '×' : '!'}</span><span><strong>{product.name}</strong><small>{product.sku} · {getStockLabel(product)} · Current quantity {product.quantity} · Reorder threshold {product.reorderThreshold}</small></span><span className="text-button">View product</span></button>)}
      {orders.map((order) => <button className="notification-item" key={`order-${order.id}`} onClick={() => onOrder(order)}><span className="list-icon blue">⇄</span><span><strong>{order.orderNumber} · {order.supplierName}</strong><small>{order.status} · {order.lines.reduce((sum, line) => sum + Math.max(0, line.orderedQuantity - line.receivedQuantity), 0)} unit(s) outstanding</small></span><span className="text-button">View order</span></button>)}
      {products.length === 0 && orders.length === 0 && <EmptyState message="No stock or purchase-order alerts right now." />}
    </div></section>
    <section className="table-card reorder-card"><div className="table-heading"><div><h2>Reorder recommendations</h2><p>Suggested quantities are a simple planning aid, not a demand forecast. Review before creating a draft.</p></div></div><div className="table-scroll"><table><thead><tr><th>PRODUCT</th><th>SKU</th><th>CATEGORY</th><th>CURRENT</th><th>THRESHOLD</th><th>SUGGESTED QTY</th><th>SUPPLIER</th><th>STATUS</th><th>ACTION</th></tr></thead><tbody>{products.map((product) => { const supplier = getSupplier(product); const supplierId = getSupplierId(product); return <tr key={product.id}><td className="product-name">{product.name}</td><td>{product.sku}</td><td>{product.category}</td><td>{product.quantity}</td><td>{product.reorderThreshold}</td><td><input className="recommendation-input" type="number" min="1" step="1" value={getQuantity(product)} onChange={(event) => updateQuantity(product, event.target.value)} aria-label={`Suggested reorder quantity for ${product.name}`} />{recommendationErrors[product.id] && <span className="field-error">{recommendationErrors[product.id]}</span>}</td><td><select className="recommendation-select" value={supplierId} onChange={(event) => setReorderSuppliers((current) => ({ ...current, [product.id]: event.target.value }))} aria-label={`Supplier for ${product.name}`}><option value="">Select supplier</option>{suppliers.map((option) => <option value={option.id} key={option.id}>{option.name}</option>)}</select>{supplier && <small className="field-helper">Existing: {supplier.name}</small>}</td><td><span className={`status ${getStockStatus(product)}`}>{getStockLabel(product)}</span></td><td><button className="table-action" onClick={() => startOrder(product)} disabled={!supplierId}>Create draft</button></td></tr> })}{products.length === 0 && <tr><td colSpan="9"><EmptyState message="No products need replenishment." /></td></tr>}</tbody></table></div></section>
  </section>
}

function StockManagement({ products, movementForm, setMovementForm, errors, onSubmit, movements }) {
  function updateField(field, value) {
    setMovementForm((current) => ({ ...current, [field]: value }))
  }

  return (
    <section className="stock-page">
      <section className="form-card">
        <div className="section-heading"><div><h2>Record stock movement</h2><p>Use Stock In for received items and Stock Out for issued items.</p></div></div>
        <form onSubmit={onSubmit} noValidate>
          <SelectField id="movement-type" label="Movement type" value={movementForm.type} onChange={(value) => updateField('type', value)} options={['Stock in', 'Stock out']} />
          <label htmlFor="movement-product">Product *<select id="movement-product" value={movementForm.productId} onChange={(event) => updateField('productId', event.target.value)} aria-invalid={Boolean(errors.productId)}><option value="">Select a product</option>{products.map((product) => <option value={product.id} key={product.id}>{product.name} ({product.sku}) · {product.quantity} available</option>)}</select>{errors.productId && <span className="field-error">{errors.productId}</span>}</label>
          <FormField id="movement-quantity" label="Quantity *" type="number" min="1" step="1" value={movementForm.quantity} onChange={(value) => updateField('quantity', value)} error={errors.quantity} placeholder="Enter whole units" />
          <FormField id="movement-reference" label="Reference / request number" value={movementForm.reference} onChange={(value) => updateField('reference', value)} placeholder="Optional reference" />
          <SelectField id="movement-department" label="Department" value={movementForm.department} onChange={(value) => updateField('department', value)} options={departments} />
          <div className="form-wide"><label htmlFor="movement-remarks">Remarks<textarea id="movement-remarks" rows="3" value={movementForm.remarks} onChange={(event) => updateField('remarks', event.target.value)} placeholder="Optional notes about this movement" /></label></div>
          <div className="form-actions"><button type="submit" className="primary-button">Record {movementForm.type}</button></div>
        </form>
      </section>
      <MovementHistory movements={movements} />
    </section>
  )
}

function CategoryManagement({ categories, search, setSearch, form, setForm, errors, editingCategory, onSubmit, onEdit, onDelete, onCancel }) {
  return (
    <section className="category-page">
      <section className="form-card category-form-card">
        <div className="section-heading"><div><h2>{editingCategory ? 'Edit category' : 'Add category'}</h2><p>Keep category names clear and reusable across products.</p></div></div>
        <form onSubmit={onSubmit} noValidate>
          <FormField id="category-name" label="Category name *" value={form.name} onChange={(value) => setForm((current) => ({ ...current, name: value }))} error={errors.name} placeholder="e.g. IT Equipment" />
          <div className="form-wide"><label htmlFor="category-description">Description<textarea id="category-description" rows="3" value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} placeholder="Briefly describe this category" /></label></div>
          <div className="form-actions"><button type="button" className="secondary-button" onClick={onCancel}>Clear</button><button type="submit" className="primary-button">{editingCategory ? 'Update Category' : 'Save Category'}</button></div>
        </form>
      </section>
      <section className="table-card category-list-card">
        <div className="table-heading"><div><h2>Inventory categories</h2><p>{categories.length} categor{categories.length === 1 ? 'y' : 'ies'} available for products.</p></div><input className="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search categories..." aria-label="Search categories" /></div>
        <div className="table-scroll"><table><thead><tr><th>ID</th><th>NAME</th><th>DESCRIPTION</th><th>CREATED</th><th>ACTION</th></tr></thead><tbody>{categories.map((category) => <tr key={category.id}><td>{category.id}</td><td className="product-name">{category.name}</td><td className="category-description">{category.description}</td><td>{formatDate(category.createdAt)}</td><td><div className="table-actions"><button className="table-action" onClick={() => onEdit(category)}>Edit</button><button className="delete-button" onClick={() => onDelete(category)}>Delete</button></div></td></tr>)}{categories.length === 0 && <tr><td colSpan="5"><EmptyState message="No categories match your search." /></td></tr>}</tbody></table></div>
      </section>
    </section>
  )
}

function MovementHistory({ movements }) {
  return <section className="table-card movement-history"><div className="table-heading"><div><h2>Stock movement history</h2><p>Only successfully recorded movements appear here. Data is temporary and resets on refresh.</p></div></div><div className="table-scroll"><table><thead><tr><th>DATE / TIME</th><th>PRODUCT</th><th>SKU</th><th>TYPE</th><th>QUANTITY</th><th>PREVIOUS</th><th>RESULTING</th><th>REFERENCE / DEPARTMENT</th><th>REMARKS</th></tr></thead><tbody>{movements.map((movement) => <tr key={movement.id}><td>{formatMovementDate(movement.date)}</td><td className="product-name">{movement.productName}</td><td>{movement.sku}</td><td><span className={`movement-badge ${movement.type === 'Stock in' ? 'movement-in' : 'movement-out'}`}>{movement.type}</span></td><td>{movement.quantity}</td><td>{movement.previousQuantity}</td><td>{movement.resultingQuantity}</td><td>{movement.reference} · {movement.department}</td><td>{movement.remarks || '—'}</td></tr>)}{movements.length === 0 && <tr><td colSpan="9"><EmptyState message="No stock movements recorded yet." /></td></tr>}</tbody></table></div></section>
}

function formatMovementDate(date) {
  const parsedDate = parseDateSafely(date)
  return parsedDate ? parsedDate.toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : 'Unknown date'
}

function StatCard({ icon, color, label, value, detail }) {
  return <article className="stat-card"><span className={`stat-icon ${color}`}>{icon}</span><p>{label}</p><h2>{value}</h2><small>{detail}</small></article>
}

function EmptyState({ message }) {
  return <div className="empty-state"><span>✓</span><p>{message}</p></div>
}

function Reports({ products, categories, suppliers, movements, orders, filters, setFilters }) {
  const categoryNames = categories.map((category) => category?.name).filter(Boolean)
  const safeProducts = products.filter(Boolean)
  const safeMovements = movements.filter(Boolean)
  const safeOrders = orders.filter(Boolean)
  const getMovementProduct = (movement) => safeProducts.find((product) => product.id === movement.productId || product.sku === movement.sku)
  const filteredMovements = safeMovements.filter((movement) => {
    const product = getMovementProduct(movement)
    return isDateOnOrAfter(movement.date, filters.movementStart)
      && isDateOnOrBefore(movement.date, filters.movementEnd)
      && (filters.movementProduct === 'all' || String(movement.productId) === filters.movementProduct)
      && (filters.movementCategory === 'all' || product?.category === filters.movementCategory)
      && (filters.movementType === 'all' || movement.type === filters.movementType)
      && normalizeText(movement.reference).includes(normalizeText(filters.movementReference))
  })
  const filteredOrders = safeOrders.filter((order) =>
    isDateOnOrAfter(order.orderDate, filters.orderStart)
    && isDateOnOrBefore(order.orderDate, filters.orderEnd)
    && (filters.orderSupplier === 'all' || String(order.supplierId) === filters.orderSupplier)
    && (filters.orderStatus === 'all' || order.status === filters.orderStatus)
  )
  const totalUnits = safeProducts.reduce((sum, product) => sum + (Number(product.quantity) || 0), 0)
  const inventoryValue = safeProducts.reduce((sum, product) => sum + (Number(product.quantity) || 0) * (Number(product.price) || 0), 0)
  const lowStockCount = safeProducts.filter((product) => getStockStatus(product) === 'low').length
  const outOfStockCount = safeProducts.filter((product) => getStockStatus(product) === 'out').length
  const categorySummary = categoryNames.map((name) => {
    const categoryProducts = safeProducts.filter((product) => product.category === name)
    return { name, products: categoryProducts.length, units: categoryProducts.reduce((sum, product) => sum + (Number(product.quantity) || 0), 0), value: categoryProducts.reduce((sum, product) => sum + (Number(product.quantity) || 0) * (Number(product.price) || 0), 0) }
  }).filter((summary) => summary.products > 0)
  const conditionSummary = [...new Set(safeProducts.map((product) => product.condition).filter(Boolean))].map((condition) => ({
    condition, count: safeProducts.filter((product) => product.condition === condition).length,
  }))
  const movementCounts = ['Stock in', 'Stock out'].map((type) => ({ type, count: filteredMovements.filter((movement) => movement.type === type).length }))
  const orderStatuses = ['Draft', 'Ordered', 'Partially Received', 'Received', 'Cancelled']
  const orderSummary = orderStatuses.map((status) => {
    const statusOrders = filteredOrders.filter((order) => order.status === status)
    return { status, count: statusOrders.length, total: statusOrders.reduce((sum, order) => sum + getPurchaseOrderTotal(order), 0) }
  })
  const supplierSummary = suppliers.map((supplier) => {
    const supplierOrders = filteredOrders.filter((order) => order.supplierId === supplier.id)
    return { name: supplier.name, count: supplierOrders.length, total: supplierOrders.reduce((sum, order) => sum + getPurchaseOrderTotal(order), 0) }
  }).filter((summary) => summary.count > 0)
  const outstandingOrders = filteredOrders.filter((order) => order.status === 'Ordered' || order.status === 'Partially Received').length
  const maxCategoryUnits = Math.max(...categorySummary.map((summary) => summary.units), 1)
  const maxMovementCount = Math.max(...movementCounts.map((summary) => summary.count), 1)
  const maxOrderCount = Math.max(...orderSummary.map((summary) => summary.count), 1)

  function updateFilter(field, value) {
    setFilters((current) => ({ ...current, [field]: value }))
  }
  function clearReportFilters() {
    setFilters(emptyReportFilters)
  }
  function exportInventory() {
    downloadCsv('inventra-inventory-report.csv', ['Product', 'SKU', 'Category', 'Quantity', 'Unit price (BDT)', 'Estimated value (BDT)', 'Status'], safeProducts.map((product) => [
      { value: product.name }, { value: product.sku }, { value: product.category }, { value: product.quantity, numeric: true }, { value: product.price, numeric: true }, { value: (product.quantity || 0) * (product.price || 0), numeric: true }, { value: getStockLabel(product) },
    ]))
  }
  function exportMovements() {
    downloadCsv('inventra-stock-movements-report.csv', ['Date', 'Product', 'SKU', 'Type', 'Quantity', 'Previous quantity', 'Resulting quantity', 'Reference', 'Department', 'Remarks'], filteredMovements.map((movement) => [
      { value: formatMovementDate(movement.date) }, { value: movement.productName }, { value: movement.sku }, { value: movement.type }, { value: movement.quantity, numeric: true }, { value: movement.previousQuantity, numeric: true }, { value: movement.resultingQuantity, numeric: true }, { value: movement.reference }, { value: movement.department }, { value: movement.remarks },
    ]))
  }
  function exportOrders() {
    downloadCsv('inventra-purchase-orders-report.csv', ['Order number', 'Supplier', 'Order date', 'Expected delivery', 'Status', 'Total (BDT)'], filteredOrders.map((order) => [
      { value: order.orderNumber }, { value: order.supplierName }, { value: formatDate(order.orderDate) }, { value: order.expectedDelivery ? formatDate(order.expectedDelivery) : '' }, { value: order.status }, { value: getPurchaseOrderTotal(order), numeric: true },
    ]))
  }
  return <section className="reports-page">
    <div className="report-actions"><button className="secondary-button" onClick={() => window.print()}>Print reports</button><button className="primary-button" onClick={exportInventory}>Export inventory CSV</button></div>
    <section className="stats report-stats" aria-label="Inventory report summary">
      <StatCard icon="▦" color="purple" label="Distinct Products" value={safeProducts.length} detail="Current product records" />
      <StatCard icon="▤" color="blue" label="Units in Stock" value={totalUnits} detail="Current quantities" />
      <StatCard icon="৳" color="green" label="Estimated Inventory Value" value={formatCurrency(inventoryValue)} detail="Quantity × listed price" />
      <StatCard icon="!" color="orange" label="Low Stock" value={lowStockCount} detail="At reorder threshold" />
      <StatCard icon="×" color="red" label="Out of Stock" value={outOfStockCount} detail="Quantity is zero" />
    </section>
    <section className="report-grid">
      <article className="table-card report-card"><div className="table-heading"><div><h2>Stock by category</h2><p>Current quantities and estimated value.</p></div></div>{categorySummary.length ? <div className="report-bars">{categorySummary.map((summary) => <div className="report-bar-group" key={summary.name}><div><strong>{summary.name}</strong><small>{summary.units} units · {formatCurrency(summary.value)}</small></div><div className="bar-track"><span style={{ width: `${summary.units / maxCategoryUnits * 100}%` }} /></div></div>)}</div> : <EmptyState message="No category data is available." />}</article>
      <article className="table-card report-card"><div className="table-heading"><div><h2>Product conditions</h2><p>Summary of the current product records.</p></div></div>{conditionSummary.length ? <div className="condition-list">{conditionSummary.map((summary) => <div className="condition-row" key={summary.condition}><span>{summary.condition}</span><strong>{summary.count}</strong></div>)}</div> : <EmptyState message="No condition data is available." />}</article>
    </section>
    <section className="table-card report-card"><div className="table-heading"><div><h2>Stock movement report</h2><p>Actual movement history only. Data resets on refresh.</p></div><button className="secondary-button" onClick={exportMovements}>Export filtered CSV</button></div>
      <div className="report-filters"><label>Start date<input type="date" value={filters.movementStart} onChange={(event) => updateFilter('movementStart', event.target.value)} /></label><label>End date<input type="date" value={filters.movementEnd} onChange={(event) => updateFilter('movementEnd', event.target.value)} /></label><label>Product<select value={filters.movementProduct} onChange={(event) => updateFilter('movementProduct', event.target.value)}><option value="all">All products</option>{safeProducts.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}</select></label><label>Category<select value={filters.movementCategory} onChange={(event) => updateFilter('movementCategory', event.target.value)}><option value="all">All categories</option>{categoryNames.map((name) => <option key={name}>{name}</option>)}</select></label><label>Type<select value={filters.movementType} onChange={(event) => updateFilter('movementType', event.target.value)}><option value="all">All types</option><option>Stock in</option><option>Stock out</option></select></label><label>Reference<input value={filters.movementReference} onChange={(event) => updateFilter('movementReference', event.target.value)} placeholder="Search reference" /></label><button className="secondary-button" onClick={clearReportFilters}>Clear filters</button></div>
      <ReportTable className="movement-report-table" headers={['DATE / TIME', 'PRODUCT', 'SKU', 'TYPE', 'QUANTITY', 'PREVIOUS', 'RESULTING', 'REFERENCE', 'DEPARTMENT', 'REMARKS']} rows={filteredMovements.map((movement) => [formatMovementDate(movement.date), movement.productName, movement.sku, movement.type, movement.quantity, movement.previousQuantity, movement.resultingQuantity, movement.reference || 'Not specified', movement.department || 'Not specified', movement.remarks || '—'])} emptyMessage="No stock movements match the selected filters." />
    </section>
    <section className="table-card report-card"><div className="table-heading"><div><h2>Purchasing report</h2><p>Order values are not payment or accounting figures. Draft and cancelled orders are not completed purchases.</p></div><button className="secondary-button" onClick={exportOrders}>Export filtered CSV</button></div>
      <div className="report-filters"><label>Order date from<input type="date" value={filters.orderStart} onChange={(event) => updateFilter('orderStart', event.target.value)} /></label><label>Order date to<input type="date" value={filters.orderEnd} onChange={(event) => updateFilter('orderEnd', event.target.value)} /></label><label>Supplier<select value={filters.orderSupplier} onChange={(event) => updateFilter('orderSupplier', event.target.value)}><option value="all">All suppliers</option>{suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</select></label><label>Status<select value={filters.orderStatus} onChange={(event) => updateFilter('orderStatus', event.target.value)}><option value="all">All statuses</option>{orderStatuses.map((status) => <option key={status}>{status}</option>)}</select></label><button className="secondary-button" onClick={clearReportFilters}>Clear filters</button></div>
      <section className="report-order-summary">{orderSummary.map((summary) => <div className="condition-row" key={summary.status}><span>{summary.status}: {summary.count}</span><strong>{formatCurrency(summary.total)}</strong></div>)}<div className="condition-row"><span>Outstanding orders</span><strong>{outstandingOrders}</strong></div></section>
      <ReportTable headers={['ORDER NUMBER', 'SUPPLIER', 'ORDER DATE', 'EXPECTED', 'STATUS', 'TOTAL']} rows={filteredOrders.map((order) => [order.orderNumber, order.supplierName, formatDate(order.orderDate), order.expectedDelivery ? formatDate(order.expectedDelivery) : 'Not specified', order.status, formatCurrency(getPurchaseOrderTotal(order))])} emptyMessage="No purchase orders match the selected filters." />
    </section>
    <section className="report-grid"><article className="table-card report-card"><div className="table-heading"><div><h2>Movement types</h2><p>Counts for the filtered movement report.</p></div></div>{filteredMovements.length ? <div className="report-bars">{movementCounts.map((summary) => <div className="report-bar-group" key={summary.type}><div><strong>{summary.type}</strong><small>{summary.count} movement(s)</small></div><div className="bar-track"><span style={{ width: `${summary.count / maxMovementCount * 100}%` }} /></div></div>)}</div> : <EmptyState message="No movement chart is shown without transactions." />}</article><article className="table-card report-card"><div className="table-heading"><div><h2>Purchase order status</h2><p>Order count by current status.</p></div></div>{filteredOrders.length ? <div className="report-bars">{orderSummary.map((summary) => <div className="report-bar-group" key={summary.status}><div><strong>{summary.status}</strong><small>{summary.count} order(s)</small></div><div className="bar-track"><span style={{ width: `${summary.count / maxOrderCount * 100}%` }} /></div></div>)}</div> : <EmptyState message="No order chart is shown without purchase orders." />}</article></section>
    <section className="table-card report-card supplier-report"><div className="table-heading"><div><h2>Supplier order summary</h2><p>Order counts and order-value totals by supplier.</p></div></div><ReportTable headers={['SUPPLIER', 'ORDERS', 'ORDER VALUE']} rows={supplierSummary.map((summary) => [summary.name, summary.count, formatCurrency(summary.total)])} emptyMessage="No supplier order data is available." /></section>
  </section>
}

function ReportTable({ headers, rows, emptyMessage, className = '' }) {
  return <div className={`table-scroll ${className}`}><table><thead><tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={index}>{row.map((cell, cellIndex) => <td className={cellIndex === 0 ? 'product-name' : ''} key={cellIndex}>{cell}</td>)}</tr>)}{rows.length === 0 && <tr><td colSpan={headers.length}><EmptyState message={emptyMessage} /></td></tr>}</tbody></table></div>
}

function PurchaseOrderManagement({ orders, allOrders, products, suppliers, search, setSearch, statusFilter, setStatusFilter, form, setForm, errors, editingOrder, selectedOrder, showForm, receiveForm, setReceiveForm, receiveErrors, receiveSubmitting, onAdd, onEdit, onSelect, onSubmit, onCancel, onPlace, onCancelOrder, onReceive, onReceiveSubmit, onReceiveCancel }) {
  const draftCount = allOrders.filter((order) => order.status === 'Draft').length
  const awaitingCount = allOrders.filter((order) => order.status === 'Ordered' || order.status === 'Partially Received').length
  const receivedCount = allOrders.filter((order) => order.status === 'Received').length
  return (
    <section className="purchase-order-page">
      <section className="po-summary">
        <StatCard icon="▣" color="purple" label="Total Orders" value={allOrders.length} detail="All purchase orders" />
        <StatCard icon="◌" color="orange" label="Draft Orders" value={draftCount} detail="Ready to be placed" />
        <StatCard icon="⇄" color="blue" label="Awaiting Receipt" value={awaitingCount} detail="Ordered or partially received" />
        <StatCard icon="✓" color="green" label="Fully Received" value={receivedCount} detail="All quantities received" />
      </section>
      {showForm && <PurchaseOrderForm products={products} suppliers={suppliers} form={form} setForm={setForm} errors={errors} editingOrder={editingOrder} onSubmit={onSubmit} onCancel={onCancel} />}
      {receiveForm && <ReceiveItemsForm receiveForm={receiveForm} setReceiveForm={setReceiveForm} errors={receiveErrors} submitting={receiveSubmitting} onSubmit={onReceiveSubmit} onCancel={onReceiveCancel} />}
      {selectedOrder && <PurchaseOrderDetails order={selectedOrder} onClose={() => onSelect(null)} onEdit={() => onEdit(selectedOrder)} onPlace={() => onPlace(selectedOrder)} onCancelOrder={() => onCancelOrder(selectedOrder)} onReceive={() => onReceive(selectedOrder)} />}
      <section className="table-card purchase-order-list-card">
        <div className="table-heading"><div><h2>Purchase orders</h2><p>Temporary demonstration records reset on refresh.</p></div><div className="po-heading-actions"><input className="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search order or supplier..." aria-label="Search purchase orders" /><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label="Filter purchase orders by status"><option value="all">All statuses</option>{['Draft', 'Ordered', 'Partially Received', 'Received', 'Cancelled'].map((status) => <option key={status}>{status}</option>)}</select><button className="primary-button" onClick={onAdd}>+ New Order</button></div></div>
        <div className="table-scroll"><table><thead><tr><th>ORDER NUMBER</th><th>SUPPLIER</th><th>ORDER DATE</th><th>EXPECTED</th><th>TOTAL</th><th>STATUS</th><th>ACTION</th></tr></thead><tbody>{orders.map((order) => <tr key={order.id}><td className="product-name">{order.orderNumber}</td><td className="long-cell">{order.supplierName}</td><td>{formatDate(order.orderDate)}</td><td>{order.expectedDelivery ? formatDate(order.expectedDelivery) : 'Not specified'}</td><td>{formatCurrency(getPurchaseOrderTotal(order))}</td><td><span className={`po-status po-${normalizeText(order.status).replaceAll(' ', '-')}`}>{order.status}</span></td><td><div className="table-actions"><button className="table-action" onClick={() => onSelect(order)}>View</button>{order.status === 'Draft' && <><button className="table-action" onClick={() => onEdit(order)}>Edit</button><button className="table-action" onClick={() => onPlace(order)}>Place</button><button className="delete-button" onClick={() => onCancelOrder(order)}>Cancel</button></>}{(order.status === 'Ordered' || order.status === 'Partially Received') && <button className="table-action" onClick={() => onReceive(order)}>Receive</button>}</div></td></tr>)}{orders.length === 0 && <tr><td colSpan="7"><EmptyState message="No purchase orders match your search or status filter." /></td></tr>}</tbody></table></div>
      </section>
    </section>
  )
}

function PurchaseOrderForm({ products, suppliers, form, setForm, errors, editingOrder, onSubmit, onCancel }) {
  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
  }
  function updateLine(index, field, value) {
    setForm((current) => ({ ...current, lines: current.lines.map((line, lineIndex) => lineIndex === index ? { ...line, [field]: value } : line) }))
  }
  function addLine() {
    setForm((current) => ({ ...current, lines: [...current.lines, { productId: '', orderedQuantity: '', unitCost: '' }] }))
  }
  function removeLine(index) {
    setForm((current) => ({ ...current, lines: current.lines.filter((_, lineIndex) => lineIndex !== index) }))
  }
  const total = form.lines.reduce((sum, line) => sum + (Number(line.orderedQuantity) || 0) * (Number(line.unitCost) || 0), 0)
  return <section className="form-card purchase-order-form-card"><div className="section-heading"><div><h2>{editingOrder ? `Edit ${editingOrder.orderNumber}` : 'Create purchase order'}</h2><p>{editingOrder ? 'Only draft orders can be edited.' : 'New orders start as drafts. No stock changes occur until receiving.'}</p></div></div>{errors.form && <p className="field-error form-message">{errors.form}</p>}<form onSubmit={onSubmit} noValidate>
    <label htmlFor="po-supplier">Supplier *<select id="po-supplier" value={form.supplierId} onChange={(event) => updateField('supplierId', event.target.value)} aria-invalid={Boolean(errors.supplierId)}><option value="">Select a supplier</option>{suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</select>{errors.supplierId && <span className="field-error">{errors.supplierId}</span>}{suppliers.length === 0 && <span className="field-helper">Add a supplier before creating an order.</span>}</label>
    <label htmlFor="po-expected">Expected delivery date<input id="po-expected" type="date" value={form.expectedDelivery} onChange={(event) => updateField('expectedDelivery', event.target.value)} /></label>
    <div className="form-wide po-lines"><h3>Order lines</h3>{form.lines.map((line, index) => <div className="po-line" key={`${index}-${line.productId}`}><label htmlFor={`po-product-${index}`}>Product *<select id={`po-product-${index}`} value={line.productId} onChange={(event) => updateLine(index, 'productId', event.target.value)} aria-invalid={Boolean(errors[`product-${index}`])}><option value="">Select a product</option>{products.map((product) => <option key={product.id} value={product.id}>{product.name} ({product.sku})</option>)}</select>{errors[`product-${index}`] && <span className="field-error">{errors[`product-${index}`]}</span>}</label><FormField id={`po-quantity-${index}`} label="Ordered quantity *" type="number" min="1" step="1" value={line.orderedQuantity} onChange={(value) => updateLine(index, 'orderedQuantity', value)} error={errors[`quantity-${index}`]} placeholder="0" /><FormField id={`po-cost-${index}`} label="Unit cost (৳) *" type="number" min="0" step="0.01" value={line.unitCost} onChange={(value) => updateLine(index, 'unitCost', value)} error={errors[`cost-${index}`]} placeholder="0.00" />{form.lines.length > 1 && <button type="button" className="delete-button po-remove-line" onClick={() => removeLine(index)}>Remove</button>}</div>)}<button type="button" className="secondary-button" onClick={addLine}>+ Add line</button><strong className="po-form-total">Order total: {formatCurrency(total)}</strong></div>
    <div className="form-wide"><label htmlFor="po-notes">Notes<textarea id="po-notes" rows="3" value={form.notes} onChange={(event) => updateField('notes', event.target.value)} placeholder="Optional order notes" /></label></div>
    <div className="form-actions"><button type="button" className="secondary-button" onClick={onCancel}>Cancel</button><button type="submit" className="primary-button">{editingOrder ? 'Update Order' : 'Save Draft'}</button></div>
  </form></section>
}

function ReceiveItemsForm({ receiveForm, setReceiveForm, errors, submitting, onSubmit, onCancel }) {
  function updateQuantity(index, value) {
    setReceiveForm((current) => ({ ...current, lines: current.lines.map((line, lineIndex) => lineIndex === index ? { ...line, quantity: value } : line) }))
  }
  return <section className="form-card receive-form-card"><div className="section-heading"><div><h2>Receive items · {receiveForm.order.orderNumber}</h2><p>Enter only the quantities received in this delivery. Stock updates once on successful submission.</p></div></div>{errors.form && <p className="field-error form-message">{errors.form}</p>}<form onSubmit={onSubmit} noValidate><div className="form-wide"><div className="receive-lines">{receiveForm.order.lines.map((line, index) => { const outstanding = line.orderedQuantity - line.receivedQuantity; return <div className="receive-line" key={line.productId}><div><strong>{line.productName}</strong><small>{line.sku} · Ordered {line.orderedQuantity} · Received {line.receivedQuantity} · Outstanding {outstanding}</small></div><FormField id={`receive-${index}`} label="Newly received" type="number" min="0" step="1" value={receiveForm.lines[index].quantity} onChange={(value) => updateQuantity(index, value)} error={errors[`quantity-${index}`]} placeholder="0" /></div> })}</div></div><div className="form-actions"><button type="button" className="secondary-button" onClick={onCancel}>Cancel</button><button type="submit" className="primary-button" disabled={submitting}>{submitting ? 'Recording...' : 'Record Receipt'}</button></div></form></section>
}

function PurchaseOrderDetails({ order, onClose, onEdit, onPlace, onCancelOrder, onReceive }) {
  return <section className="details-card purchase-order-details"><div className="details-header"><div><p className="eyebrow">PURCHASE ORDER DETAILS</p><h2>{order.orderNumber}</h2><span className={`po-status po-${normalizeText(order.status).replaceAll(' ', '-')}`}>{order.status}</span></div><button className="close-button" aria-label="Close purchase order details" onClick={onClose}>×</button></div><p className="po-detail-meta">Supplier: <strong>{order.supplierName}</strong> · Ordered {formatDate(order.orderDate)} · Expected {order.expectedDelivery ? formatDate(order.expectedDelivery) : 'Not specified'}</p><div className="table-scroll"><table><thead><tr><th>PRODUCT</th><th>SKU</th><th>ORDERED</th><th>RECEIVED</th><th>OUTSTANDING</th><th>UNIT COST</th><th>LINE TOTAL</th></tr></thead><tbody>{order.lines.map((line) => <tr key={line.productId}><td className="product-name">{line.productName}</td><td>{line.sku}</td><td>{line.orderedQuantity}</td><td>{line.receivedQuantity}</td><td>{line.orderedQuantity - line.receivedQuantity}</td><td>{formatCurrency(line.unitCost)}</td><td>{formatCurrency(line.lineTotal)}</td></tr>)}</tbody></table></div><p className="po-total">Order total: <strong>{formatCurrency(getPurchaseOrderTotal(order))}</strong></p><p className="details-description">{order.notes || 'No notes provided.'}</p>{order.receivingHistory.length > 0 && <div className="po-history"><strong>Receiving history</strong>{order.receivingHistory.map((receipt) => <small key={receipt.id}>{formatMovementDate(receipt.date)} · {receipt.totalQuantity} unit(s) received</small>)}</div>}<div className="details-actions">{order.status === 'Draft' && <><button className="secondary-button" onClick={onCancelOrder}>Cancel order</button><button className="secondary-button" onClick={onEdit}>Edit order</button><button className="primary-button" onClick={onPlace}>Place order</button></>}{(order.status === 'Ordered' || order.status === 'Partially Received') && <button className="primary-button" onClick={onReceive}>Receive items</button>}</div></section>
}

function SupplierManagement({ suppliers, products, categories, search, setSearch, form, setForm, errors, editingSupplier, selectedSupplier, onSelect, showForm, onAdd, onEdit, onDelete, onSubmit, onCancel }) {
  const selectedProductCount = selectedSupplier
    ? products.filter((product) => normalizeText(product.supplier) === normalizeText(selectedSupplier.name)).length
    : 0
  return (
    <section className="supplier-page">
      {showForm && <SupplierForm categories={categories} form={form} setForm={setForm} errors={errors} editingSupplier={editingSupplier} onSubmit={onSubmit} onCancel={onCancel} />}
      {selectedSupplier && <SupplierDetails supplier={selectedSupplier} productCount={selectedProductCount} onClose={() => onSelect(null)} onEdit={() => onEdit(selectedSupplier)} onDelete={() => onDelete(selectedSupplier)} />}
      <section className="table-card supplier-list-card">
        <div className="table-heading"><div><h2>Supplier directory</h2><p>{suppliers.length} supplier{suppliers.length === 1 ? '' : 's'} available for inventory.</p></div><div className="supplier-heading-actions"><input className="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search suppliers..." aria-label="Search suppliers" /><button className="primary-button" onClick={onAdd}>+ Add Supplier</button></div></div>
        <div className="table-scroll"><table><thead><tr><th>SUPPLIER</th><th>CONTACT PERSON</th><th>PHONE</th><th>EMAIL</th><th>CATEGORIES</th><th>ACTION</th></tr></thead><tbody>{suppliers.map((supplier) => <tr key={supplier.id}><td className="product-name">{supplier.name}</td><td>{supplier.contactPerson || 'Not specified'}</td><td>{supplier.phone || 'Not specified'}</td><td className="long-cell">{supplier.email || 'Not specified'}</td><td className="category-description">{supplier.categories.length ? supplier.categories.join(', ') : 'Not specified'}</td><td><div className="table-actions"><button className="table-action" onClick={() => onSelect(supplier)}>View</button><button className="table-action" onClick={() => onEdit(supplier)}>Edit</button><button className="delete-button" onClick={() => onDelete(supplier)}>Delete</button></div></td></tr>)}{suppliers.length === 0 && <tr><td colSpan="6"><EmptyState message="No suppliers match your search." /></td></tr>}</tbody></table></div>
      </section>
    </section>
  )
}

function SupplierForm({ categories, form, setForm, errors, editingSupplier, onSubmit, onCancel }) {
  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
  }
  function toggleCategory(category) {
    const nextCategories = form.categories.includes(category)
      ? form.categories.filter((item) => item !== category)
      : [...form.categories, category]
    updateField('categories', nextCategories)
  }
  return <section className="form-card supplier-form-card"><div className="section-heading"><div><h2>{editingSupplier ? 'Edit supplier' : 'Add supplier'}</h2><p>Supplier records are fictional demonstration data and reset on refresh.</p></div></div><form onSubmit={onSubmit} noValidate>
    <FormField id="supplier-name" label="Supplier name *" value={form.name} onChange={(value) => updateField('name', value)} error={errors.name} placeholder="e.g. Demo Technology Supplier" />
    <FormField id="supplier-contact" label="Contact person" value={form.contactPerson} onChange={(value) => updateField('contactPerson', value)} placeholder="Optional contact person" />
    <FormField id="supplier-phone" label="Phone number" value={form.phone} onChange={(value) => updateField('phone', value)} error={errors.phone} placeholder="Optional phone number" />
    <FormField id="supplier-email" label="Email address" type="email" value={form.email} onChange={(value) => updateField('email', value)} error={errors.email} placeholder="Optional email address" />
    <div className="form-wide"><label htmlFor="supplier-address">Address<textarea id="supplier-address" rows="2" value={form.address} onChange={(event) => updateField('address', event.target.value)} placeholder="Optional address" /></label></div>
    <fieldset className="category-picker form-wide"><legend>Supplied categories</legend><div className="category-checkboxes">{categories.map((category) => <label key={category} className="checkbox-label"><input type="checkbox" checked={form.categories.includes(category)} onChange={() => toggleCategory(category)} />{category}</label>)}</div></fieldset>
    <div className="form-wide"><label htmlFor="supplier-notes">Notes<textarea id="supplier-notes" rows="3" value={form.notes} onChange={(event) => updateField('notes', event.target.value)} placeholder="Optional notes" /></label></div>
    <div className="form-actions"><button type="button" className="secondary-button" onClick={onCancel}>Cancel</button><button type="submit" className="primary-button">{editingSupplier ? 'Update Supplier' : 'Save Supplier'}</button></div>
  </form></section>
}

function SupplierDetails({ supplier, productCount, onClose, onEdit, onDelete }) {
  return <section className="details-card"><div className="details-header"><div><p className="eyebrow">SUPPLIER DETAILS</p><h2>{supplier.name}</h2></div><button className="close-button" aria-label="Close supplier details" onClick={onClose}>×</button></div><div className="details-grid supplier-details-grid"><DetailItem label="Contact person" value={supplier.contactPerson || 'Not specified'} /><DetailItem label="Phone" value={supplier.phone || 'Not specified'} /><DetailItem label="Email" value={supplier.email || 'Not specified'} /><DetailItem label="Categories" value={supplier.categories.length ? supplier.categories.join(', ') : 'Not specified'} /><DetailItem label="Created" value={formatDate(supplier.createdAt)} /><DetailItem label="Updated" value={formatDate(supplier.updatedAt)} /><DetailItem label="Assigned products" value={productCount} /><DetailItem label="Address" value={supplier.address || 'Not specified'} /></div><p className="details-description">{supplier.notes || 'No notes provided.'}</p><div className="details-actions"><button className="secondary-button" onClick={onDelete}>Delete supplier</button><button className="primary-button" onClick={onEdit}>Edit supplier</button></div></section>
}

function ProductFilters({ categories, search, setSearch, categoryFilter, setCategoryFilter, statusFilter, setStatusFilter, sortBy, sortDirection, onSort, onClear }) {
  const hasFilters = search || categoryFilter !== 'all' || statusFilter !== 'all' || sortBy !== 'name' || sortDirection !== 'asc'
  return <section className="filters-card"><div className="filter-field search-field"><label htmlFor="product-search">Search products</label><input id="product-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by name or SKU..." /></div><div className="filter-field"><label htmlFor="category-filter">Category</label><select id="category-filter" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}><option value="all">All categories</option>{categories.map((category) => <option key={category}>{category}</option>)}</select></div><div className="filter-field"><label htmlFor="status-filter">Stock status</label><select id="status-filter" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="all">All statuses</option><option value="in-stock">In stock</option><option value="low">Low stock</option><option value="out">Out of stock</option></select></div><div className="filter-field"><label htmlFor="sort-products">Sort by</label><select id="sort-products" value={sortBy} onChange={onSort}><option value="name">Name ({sortDirection === 'asc' ? 'A-Z' : 'Z-A'})</option><option value="quantity">Quantity ({sortDirection === 'asc' ? 'low-high' : 'high-low'})</option><option value="price">Unit price ({sortDirection === 'asc' ? 'low-high' : 'high-low'})</option><option value="category">Category ({sortDirection === 'asc' ? 'A-Z' : 'Z-A'})</option></select></div>{hasFilters && <button className="secondary-button clear-button" onClick={onClear}>Clear filters</button>}</section>
}

function ProductForm({ categories, suppliers, form, setForm, errors, editingProduct, onSubmit, onCancel }) {
  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
  }
  return <section className="form-card"><div className="section-heading"><div><h2>{editingProduct ? 'Edit product' : 'Add a new product'}</h2><p>Fields marked with * are required.</p></div></div><form onSubmit={onSubmit} noValidate>
    <FormField id="name" label="Product name *" value={form.name} onChange={(value) => updateField('name', value)} error={errors.name} placeholder="e.g. Monitor" />
    <FormField id="sku" label="SKU (Unique Product Code) *" helper="Enter a unique code, for example IT-LAP-001. Each product must have a different SKU." value={form.sku} onChange={(value) => updateField('sku', value)} error={errors.sku} placeholder="e.g. IT-MON-001" />
    <FormField id="quantity" label="Quantity *" type="number" min="0" step="1" value={form.quantity} onChange={(value) => updateField('quantity', value)} error={errors.quantity} placeholder="0" />
    <FormField id="reorderThreshold" label="Reorder threshold *" type="number" min="0" step="1" value={form.reorderThreshold} onChange={(value) => updateField('reorderThreshold', value)} error={errors.reorderThreshold} placeholder="e.g. 5" />
    <FormField id="price" label="Unit price (৳) *" type="number" min="0" step="0.01" value={form.price} onChange={(value) => updateField('price', value)} error={errors.price} placeholder="0.00" />
    <label htmlFor="supplier">Supplier<select id="supplier" value={form.supplier} onChange={(event) => updateField('supplier', event.target.value)}><option value="">No supplier selected</option>{form.supplier && !suppliers.some((supplier) => supplier.name === form.supplier) && <option value={form.supplier}>{form.supplier} (existing value)</option>}{suppliers.map((supplier) => <option value={supplier.name} key={supplier.id}>{supplier.name}</option>)}</select>{suppliers.length === 0 && <span className="field-helper">Add a supplier from the Suppliers page before assigning one to a product.</span>}</label>
    <SelectField id="category" label="Category *" value={form.category} onChange={(value) => updateField('category', value)} options={categories} error={errors.category} />
    <SelectField id="condition" label="Condition" value={form.condition} onChange={(value) => updateField('condition', value)} options={conditions} />
    <SelectField id="department" label="Assigned department" value={form.department} onChange={(value) => updateField('department', value)} options={departments} />
    <FormField id="imageUrl" label="Image URL (optional)" value={form.imageUrl} onChange={(value) => updateField('imageUrl', value)} error={errors.imageUrl} placeholder="https://example.com/image.jpg" />
    <div className="form-wide"><label htmlFor="description">Description<textarea id="description" rows="3" value={form.description} onChange={(event) => updateField('description', event.target.value)} placeholder="Brief description of this item" /></label></div>
    {form.imageUrl.trim() && <div className="form-wide"><ImagePreview src={form.imageUrl} alt="Product preview" /></div>}
    <div className="form-actions"><button type="button" className="secondary-button" onClick={onCancel}>Cancel</button><button type="submit" className="primary-button">{editingProduct ? 'Update Product' : 'Save Product'}</button></div>
  </form></section>
}

function FormField({ id, label, helper, value, onChange, error, type = 'text', ...props }) {
  const describedBy = [helper && `${id}-helper`, error && `${id}-error`].filter(Boolean).join(' ') || undefined
  return <label htmlFor={id}>{label}<input id={id} type={type} value={value} onChange={(event) => onChange(event.target.value)} aria-invalid={Boolean(error)} aria-describedby={describedBy} {...props} />{helper && <span className="field-helper" id={`${id}-helper`}>{helper}</span>}{error && <span className="field-error" id={`${id}-error`}>{error}</span>}</label>
}

function SelectField({ id, label, value, onChange, options, error }) {
  return <label htmlFor={id}>{label}<select id={id} value={value} onChange={(event) => onChange(event.target.value)} aria-invalid={Boolean(error)}>{options.map((option) => <option key={option}>{option}</option>)}</select>{error && <span className="field-error">{error}</span>}</label>
}

function ProductDetails({ product, onClose, onEdit, onDelete }) {
  return <section className="details-card"><div className="details-header"><div><p className="eyebrow">PRODUCT DETAILS</p><h2>{product.name}</h2></div><button className="close-button" aria-label="Close product details" onClick={onClose}>×</button></div><div className="details-content"><ImagePreview src={product.imageUrl} alt={product.name} large /><div className="details-grid"><DetailItem label="SKU" value={product.sku} /><DetailItem label="Category" value={product.category} /><DetailItem label="Quantity" value={product.quantity} /><DetailItem label="Unit price" value={`৳${product.price.toLocaleString('en-BD')}`} /><DetailItem label="Supplier" value={product.supplier} /><DetailItem label="Reorder threshold" value={product.reorderThreshold} /><DetailItem label="Condition" value={product.condition} /><DetailItem label="Department" value={product.department} /><DetailItem label="Created" value={formatDate(product.createdAt)} /><DetailItem label="Updated" value={formatDate(product.updatedAt)} /></div></div><p className="details-description">{product.description || 'No description provided.'}</p><div className="details-actions"><button className="secondary-button" onClick={onDelete}>Delete product</button><button className="primary-button" onClick={onEdit}>Edit product</button></div></section>
}

function DetailItem({ label, value }) {
  return <div><small>{label}</small><strong>{value}</strong></div>
}

function ImagePreview({ src, alt, large = false }) {
  const [failedSource, setFailedSource] = useState('')
  const failed = src && failedSource === src
  if (!src || failed) return <div className={`image-placeholder ${large ? 'large' : ''}`} role="img" aria-label="No product image available">No image</div>
  return <img className={`product-image ${large ? 'large' : ''}`} src={src} alt={alt} onError={() => setFailedSource(src)} />
}

function ProductTable({ products, filteredProducts, onView, onEdit, onDelete, compact = false }) {
  return <section className={`table-card ${compact ? 'dashboard-products' : ''}`}>{!compact && <div className="table-heading"><div><h2>Product Inventory</h2><p>Showing {filteredProducts.length} of {products.length} products.</p></div></div>}<div className="table-scroll"><table><thead><tr><th>PRODUCT</th><th>SKU</th><th>CATEGORY</th><th>SUPPLIER</th><th>QUANTITY</th><th>UNIT PRICE</th><th>STATUS</th><th>ACTION</th></tr></thead><tbody>{filteredProducts.map((product) => <tr key={product.id}><td><button className="product-cell" onClick={() => onView(product)}><ImagePreview src={product.imageUrl} alt="" /><span className="product-name">{product.name}</span></button></td><td>{product.sku}</td><td>{product.category}</td><td className="long-cell">{product.supplier || 'Not specified'}</td><td>{product.quantity}</td><td>৳{product.price.toLocaleString('en-BD')}</td><td><span className={`status ${getStockStatus(product)}`}>{getStockLabel(product)}</span></td><td><div className="table-actions"><button className="table-action" onClick={() => onView(product)}>View</button>{!compact && <><button className="table-action" onClick={() => onEdit(product)}>Edit</button><button className="delete-button" onClick={() => onDelete(product)}>Delete</button></>}</div></td></tr>)}{filteredProducts.length === 0 && <tr><td colSpan="8"><EmptyState message="No products match your search or filters." /></td></tr>}</tbody></table></div>{!compact && <div className="table-footer">Use View to inspect details or Edit to update a product.</div>}</section>
}

export default App
