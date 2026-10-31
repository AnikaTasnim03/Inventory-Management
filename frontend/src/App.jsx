import { useEffect, useEffectEvent, useMemo, useRef, useState } from 'react'
import './App.css'
import InventraLogo from './InventraLogo.jsx'
import { createCategory, deleteCategory as deleteCategoryFromApi, getCategories, updateCategory } from './categoryService'
import { createProduct, deleteProduct as deleteProductFromApi, getProducts, updateProduct } from './productService'
import { createSupplier, deleteSupplier as deleteSupplierFromApi, getSuppliers, updateSupplier } from './supplierService'
import { createPurchaseOrder, getPurchaseOrders, receivePurchaseOrder, updatePurchaseOrder, updatePurchaseOrderStatus as updatePurchaseOrderStatusFromApi } from './purchaseOrderService'
import { createStockMovementIdempotencyKey, getStockMovements, recordStockMovement } from './stockMovementService'
import {
  buildSourceNotifications,
  createPurchaseOrderActivity,
  deleteNotification,
  markAllNotificationsRead,
  markNotificationRead,
  mergeNotificationState,
  persistNotificationActivity,
  readNotificationState,
  writeNotificationState,
} from './notificationsService'
import {
  buildMovementTimeSeries,
  buildProductMovementSummary,
  calculateInventoryMetrics,
  calculateMovementTotals,
  calculatePurchaseOrderAnalytics,
  getProductInventoryValue,
  getReportDateRange,
  getReportStockStatus,
  getValidProductQuantity,
  isWithinReportDateRange,
} from './reportAnalytics'
import { defaultAppSettings, readAppSettings, writeAppSettings } from './settingsService'
const navigationItems = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'products', label: 'Products' },
  { id: 'stock', label: 'Stock Management' },
  { id: 'categories', label: 'Categories' },
  { id: 'suppliers', label: 'Suppliers' },
  { id: 'purchase-orders', label: 'Purchase Orders' },
  { id: 'notifications', label: 'Notifications' },
  { id: 'reports', label: 'Reports & Analytics' },
  { id: 'settings', label: 'Settings' },
]

function NavigationIcon({ name }) {
  const iconShapes = {
    home: <><path d="m3.5 10 8.5-7 8.5 7v10.5h-6v-6h-5v6h-6V10Z" /><path d="M2.5 10.5 12 2.8l9.5 7.7" /></>,
    dashboard: <><rect x="3.5" y="3.5" width="7" height="7" rx="1.5" /><rect x="13.5" y="3.5" width="7" height="7" rx="1.5" /><rect x="3.5" y="13.5" width="7" height="7" rx="1.5" /><rect x="13.5" y="13.5" width="7" height="7" rx="1.5" /></>,
    products: <><path d="m12 3 8.5 4.5v9L12 21l-8.5-4.5v-9L12 3Z" /><path d="m3.8 7.7 8.2 4.5 8.2-4.5M12 12.2V21" /></>,
    stock: <><path d="M7 7h12l-3-3M17 17H5l3 3" /><path d="M19 7a7 7 0 0 1 1 9M5 17a7 7 0 0 1-1-9" /></>,
    categories: <><path d="M4 5.5h7v7H4zM13 5.5h7v7h-7zM4 14.5h7v5H4zM13 14.5h7v5h-7z" /></>,
    suppliers: <><circle cx="9" cy="8" r="3.2" /><path d="M3.5 20v-1.6a5.5 5.5 0 0 1 11 0V20h-11ZM16 5.2a3.1 3.1 0 0 1 0 5.9M17.5 14a4.7 4.7 0 0 1 3 4.4V20h-3" /></>,
    'purchase-orders': <><path d="M6 3.5h8l4 4V20H6z" /><path d="M14 3.5v4h4M9 12h6M9 15.5h6M9 9h1" /></>,
    notifications: <><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9ZM10 21h4" /></>,
    reports: <><path d="M4 20V11M10 20V5M16 20v-8M22 20H2" /></>,
    settings: <><path d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z" /><path d="m19.4 15 .1.1 1.2.9-1.4 2.4-1.4-.6a7.8 7.8 0 0 1-1.5.9l-.2 1.5h-2.8l-.2-1.5a7.8 7.8 0 0 1-1.5-.9l-1.4.6-1.4-2.4 1.2-.9a7 7 0 0 1 0-1.8l-1.2-.9 1.4-2.4 1.4.6a7.8 7.8 0 0 1 1.5-.9l.2-1.5h2.8l.2 1.5a7.8 7.8 0 0 1 1.5.9l1.4-.6 1.4 2.4-1.2.9a7 7 0 0 1 0 1.8Z" /></>,
  }

  return (
    <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {iconShapes[name]}
    </svg>
  )
}

const initialCategories = [
  { id: 1, name: 'IT Equipment', description: 'Computers, monitors, and other information technology assets.', createdAt: '2026-10-01' },
  { id: 2, name: 'Networking', description: 'Network infrastructure and connectivity equipment.', createdAt: '2026-10-01' },
  { id: 3, name: 'Office Supplies', description: 'Consumable supplies used for daily office work.', createdAt: '2026-10-01' },
  { id: 4, name: 'Furniture', description: 'Furniture and fixtures for workspaces.', createdAt: '2026-10-01' },
  { id: 5, name: 'Accessories', description: 'Cables, peripherals, and supporting equipment.', createdAt: '2026-10-01' },
  { id: 6, name: 'Other', description: 'Other inventory items not covered by the main categories.', createdAt: '2026-10-01' },
]

const conditions = ['New', 'Good', 'Needs attention']
const departments = ['Administration', 'IT', 'Network Operations', 'Monitoring', 'Other']

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
  dateRange: 'last-30-days', customStart: '', customEnd: '',
  movementProduct: 'all', movementCategory: 'all', movementType: 'all',
  movementReference: '', orderSupplier: 'all', orderStatus: 'all',
}

function getInitialWorkspacePage() {
  const requestedPage = new URLSearchParams(window.location.search).get('workspace')
  if (navigationItems.some((item) => item.id === requestedPage)) return requestedPage
  if (getSupplierRoute()) return 'suppliers'
  if (getProductRoute()) return 'products'
  return 'dashboard'
}

function getStockStatus(product) {
  const quantity = parseNonNegativeInteger(product.quantity)
  if (quantity === null) return 'unknown'
  if (quantity === 0) return 'out'
  const reorderLevel = parseNonNegativeInteger(product.reorderThreshold)
    ?? parseNonNegativeInteger(product.reorder_level)
  if (reorderLevel === null) return 'unknown'
  return quantity <= reorderLevel ? 'low' : 'in-stock'
}

function filterProducts(products, { searchText = '', category = 'all', supplier = 'all' } = {}) {
  const normalizedSearch = normalizeText(searchText)
  return products.filter((product) => {
    const matchesSearch = normalizeText(`${product.name ?? ''} ${product.sku ?? ''}`).includes(normalizedSearch)
    const matchesCategory = category === 'all' || product.category === category
    const matchesSupplier = supplier === 'all' || normalizeText(product.supplier) === normalizeText(supplier)
    return matchesSearch && matchesCategory && matchesSupplier
  })
}

function parseNonNegativeInteger(value) {
  if (typeof value === 'string' && !value.trim()) return null
  if (typeof value !== 'number' && typeof value !== 'string') return null
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null
}

function getStockLabel(product) {
  const status = getStockStatus(product)
  return status === 'out' ? 'Out of stock' : status === 'low' ? 'Low stock' : status === 'unknown' ? 'Unknown stock' : 'In stock'
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

function parseDateSafely(value) {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
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

function getSupplierRoute(pathname = window.location.pathname) {
  const match = pathname.match(/^\/suppliers\/(\d+)(\/edit)?\/?$/)
  return match ? { id: Number(match[1]), mode: match[2] ? 'edit' : 'view' } : null
}
function getProductRoute(pathname = window.location.pathname) {
  const match = pathname.match(/^\/products\/(\d+)(\/edit)?\/?$/)
  return match
    ? { id: Number(match[1]), mode: match[2] ? 'edit' : 'view' }
    : null
}
function InventoryApp({ onGoHome, onSignOut, user, onUpdateProfile, authError, workspaceRequest }) {
  const [products, setProducts] = useState([])
  const [productsLoading, setProductsLoading] = useState(true)
  const [productLoadError, setProductLoadError] = useState('')
  const [dashboardLoading, setDashboardLoading] = useState(true)
  const [dashboardDataError, setDashboardDataError] = useState('')
  const [reportsLoading, setReportsLoading] = useState(true)
  const [reportsDataError, setReportsDataError] = useState('')
  const productRefreshVersionRef = useRef(0)
  const dashboardRefreshVersionRef = useRef(0)
  const dashboardRefreshPromiseRef = useRef(null)
  const [categoryRecords, setCategoryRecords] = useState(initialCategories)
  const [categoryLoadError, setCategoryLoadError] = useState('')
  const [suppliers, setSuppliers] = useState([])
  const [suppliersLoading, setSuppliersLoading] = useState(true)
  const [supplierLoadError, setSupplierLoadError] = useState('')
  const [stockMovements, setStockMovements] = useState([])
 const [activePage, setActivePage] = useState(getInitialWorkspacePage)
const [productRoute, setProductRoute] = useState(() => getProductRoute())
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [supplierFilter, setSupplierFilter] = useState('all')
  const [sortBy, setSortBy] = useState('name')
  const [sortDirection, setSortDirection] = useState('asc')
  const [showForm, setShowForm] = useState(false)
  const [editingProduct, setEditingProduct] = useState(null)
  const [selectedProduct, setSelectedProduct] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [errors, setErrors] = useState({})
  const [successMessage, setSuccessMessage] = useState('')
  const [notificationStorageError, setNotificationStorageError] = useState('')
  const [productSaveWarning, setProductSaveWarning] = useState('')
  const [productSubmitting, setProductSubmitting] = useState(false)
  const [movementForm, setMovementForm] = useState(emptyMovementForm)
  const [movementErrors, setMovementErrors] = useState({})
  const [movementSubmitting, setMovementSubmitting] = useState(false)
  const [movementRefreshWarning, setMovementRefreshWarning] = useState('')
  const movementSubmitRef = useRef(false)
  const pendingMovementRef = useRef(null)
  const [categorySearch, setCategorySearch] = useState('')
  const [categoryForm, setCategoryForm] = useState({ name: '', description: '' })
  const [editingCategory, setEditingCategory] = useState(null)
  const [categoryErrors, setCategoryErrors] = useState({})
  const categoryFormRef = useRef(null)
  const [supplierSearch, setSupplierSearch] = useState('')
  const [supplierForm, setSupplierForm] = useState(emptySupplierForm)
  const [editingSupplier, setEditingSupplier] = useState(null)
  const [selectedSupplier, setSelectedSupplier] = useState(null)
  const supplierFormRef = useRef(null)
  const supplierDetailsRef = useRef(null)
  const [supplierRoute, setSupplierRoute] = useState(() => getSupplierRoute())
  const [supplierErrors, setSupplierErrors] = useState({})
  const [showSupplierForm, setShowSupplierForm] = useState(false)
  const [initialSettings] = useState(() => {
    try {
      return { value: readAppSettings(user.id), error: '' }
    } catch (error) {
      return {
        value: structuredClone(defaultAppSettings),
        error: error instanceof Error ? error.message : 'Unable to load saved settings.',
      }
    }
  })
  const [settings, setSettings] = useState(initialSettings.value)
  const [settingsStorageError, setSettingsStorageError] = useState(initialSettings.error)
  const [purchaseOrders, setPurchaseOrders] = useState([])
  const [purchaseOrderSearch, setPurchaseOrderSearch] = useState('')
  const [purchaseOrderStatusFilter, setPurchaseOrderStatusFilter] = useState('all')
  const [purchaseOrderForm, setPurchaseOrderForm] = useState(emptyPurchaseOrderForm)
  const [editingPurchaseOrder, setEditingPurchaseOrder] = useState(null)
  const [selectedPurchaseOrder, setSelectedPurchaseOrder] = useState(null)
  const purchaseOrderFormRef = useRef(null)
  const purchaseOrderDetailsRef = useRef(null)
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
  const categorySubmitRef = useRef(false)
  const categoryDeleteRef = useRef(null)
  const productSubmitRef = useRef(false)
  const productDeleteRef = useRef(null)
  const supplierSubmitRef = useRef(false)
  const supplierDeleteRef = useRef(null)

  function recordPurchaseOrderActivity(order, type, message) {
    try {
      persistNotificationActivity(createPurchaseOrderActivity({ order, type, message }))
      setNotificationStorageError('')
    } catch (error) {
      console.error('Purchase order saved, but its notification could not be stored:', error)
      setNotificationStorageError(error instanceof Error ? error.message : 'Unable to save the purchase-order notification in this browser.')
    }
  }
  useEffect(() => {
  function handlePopState() {
    const nextSupplierRoute = getSupplierRoute()
    const nextProductRoute = getProductRoute()

    setSupplierRoute(nextSupplierRoute)
    setProductRoute(nextProductRoute)

    if (nextSupplierRoute) {
      setActivePage('suppliers')
    } else if (nextProductRoute) {
      setActivePage('products')
    }
  }

  window.addEventListener('popstate', handlePopState)
  return () => window.removeEventListener('popstate', handlePopState)
}, [])

  useEffect(() => {
    if (!supplierRoute) return
    const supplier = suppliers.find((item) => Number(item.id) === supplierRoute.id)
    if (!supplier) return
    const timer = window.setTimeout(() => {
      if (supplierRoute.mode === 'edit') {
        setSelectedSupplier(null)
        setEditingSupplier(supplier)
        setSupplierForm({
          name: supplier.name,
          contactPerson: supplier.contactPerson,
          phone: supplier.phone,
          email: supplier.email,
          address: supplier.address,
          categories: supplier.categories,
          notes: supplier.notes,
        })
        setSupplierErrors({})
        setShowSupplierForm(true)
      } else {
        setShowSupplierForm(false)
        setEditingSupplier(null)
        setSelectedSupplier(supplier)
      }
    }, 0)
    return () => window.clearTimeout(timer)
  }, [supplierRoute, suppliers])

  useEffect(() => {
    if (activePage === 'categories' && editingCategory) {
      categoryFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [activePage, editingCategory])

  useEffect(() => {
    if (activePage !== 'suppliers') return
    const target = showSupplierForm
      ? supplierFormRef.current
      : selectedSupplier
        ? supplierDetailsRef.current
        : null
    target?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [activePage, selectedSupplier, showSupplierForm])

  useEffect(() => {
    if (activePage !== 'purchase-orders') return
    const target = showPurchaseOrderForm
      ? purchaseOrderFormRef.current
      : selectedPurchaseOrder
        ? purchaseOrderDetailsRef.current
        : null
    target?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [activePage, selectedPurchaseOrder, showPurchaseOrderForm])

  useEffect(() => {
  if (!productRoute) return

  const product = products.find(
    (item) => Number(item.id) === productRoute.id
  )

  if (!product) return

  if (productRoute.mode === 'edit') {
    setSelectedProduct(null)
    openEditForm(product)
  } else {
    setShowForm(false)
    setEditingProduct(null)
    setSelectedProduct(product)
  }
}, [productRoute, products])
  useEffect(() => {
    let cancelled = false
    const productRequestVersion = productRefreshVersionRef.current
    const dashboardRequestVersion = dashboardRefreshVersionRef.current
    Promise.allSettled([getCategories(), getProducts(), getSuppliers(), getPurchaseOrders(), getStockMovements()])
      .then((results) => {
        if (cancelled) return
        const [categoriesResult, productsResult, suppliersResult, ordersResult, movementsResult] = results
        if (categoriesResult.status === 'fulfilled') {
          setCategoryRecords(categoriesResult.value.map((category) => ({ ...category, createdAt: category.created_at ?? category.createdAt })))
        }
        if (productRequestVersion === productRefreshVersionRef.current) {
          if (productsResult.status === 'fulfilled') {
            setProducts(productsResult.value)
            setProductLoadError('')
          } else {
            setProductLoadError(productsResult.reason instanceof Error
              ? productsResult.reason.message
              : 'Unable to load products from the backend.')
          }
        }
        setProductsLoading(false)
        setReportsLoading(false)
        if (dashboardRequestVersion === dashboardRefreshVersionRef.current) {
          setDashboardLoading(false)
        }
        if (suppliersResult.status === 'fulfilled') {
          setSuppliers(suppliersResult.value)
          setSupplierLoadError('')
        } else {
          setSuppliers([])
          setSupplierLoadError(suppliersResult.reason instanceof Error
            ? suppliersResult.reason.message
            : 'Unable to load suppliers from the backend.')
        }
        setSuppliersLoading(false)
        if (dashboardRequestVersion === dashboardRefreshVersionRef.current) {
          if (ordersResult.status === 'fulfilled') setPurchaseOrders(ordersResult.value)
          if (movementsResult.status === 'fulfilled') setStockMovements(movementsResult.value)
          const dashboardSourceResults = [
            ['products', productsResult],
            ['purchase orders', ordersResult],
            ['stock movements', movementsResult],
          ].filter(([, result]) => result.status === 'rejected')
          setDashboardDataError(dashboardSourceResults.length
            ? `Unable to load ${dashboardSourceResults.map(([name]) => name).join(', ')} from the backend. Retry the dashboard refresh after checking the connection.`
            : '')
        }
        const failedSources = results.filter((result) => result.status === 'rejected')
        const reportSourceResults = [
          ['products', productsResult],
          ['purchase orders', ordersResult],
          ['stock movements', movementsResult],
        ].filter(([, result]) => result.status === 'rejected')
        setReportsDataError(reportSourceResults.length
          ? `Unable to load ${reportSourceResults.map(([name]) => name).join(', ')} from the backend. Refresh after checking the backend connection.`
          : '')
        setCategoryLoadError(failedSources.length
          ? 'Some inventory data could not be loaded from Supabase. Check the backend connection before relying on displayed values.'
          : '')
      })
    return () => { cancelled = true }
  }, [])

  async function refreshProducts() {
    const requestVersion = ++productRefreshVersionRef.current
    try {
      const latestProducts = await getProducts()
      if (requestVersion === productRefreshVersionRef.current) {
        setProducts(latestProducts)
        setProductLoadError('')
      }
      return true
    } catch (error) {
      if (requestVersion === productRefreshVersionRef.current) {
        setProductLoadError(error instanceof Error ? error.message : 'Unable to refresh products from the backend.')
      }
      console.error('Failed to refresh products:', error)
      return false
    }
  }

  function refreshDashboardData() {
    if (dashboardRefreshPromiseRef.current) return dashboardRefreshPromiseRef.current
    setDashboardLoading(true)
    setDashboardDataError('')
    const requestVersion = ++dashboardRefreshVersionRef.current
    productRefreshVersionRef.current += 1
    const request = Promise.allSettled([getProducts(), getPurchaseOrders(), getStockMovements()])
      .then((results) => {
        if (requestVersion !== dashboardRefreshVersionRef.current) return false
        const [productsResult, ordersResult, movementsResult] = results
        if (productsResult.status === 'fulfilled') {
          setProducts(productsResult.value)
          setProductLoadError('')
        } else {
          setProductLoadError(productsResult.reason instanceof Error ? productsResult.reason.message : 'Unable to load products.')
        }
        if (ordersResult.status === 'fulfilled') setPurchaseOrders(ordersResult.value)
        if (movementsResult.status === 'fulfilled') setStockMovements(movementsResult.value)
        const failedSources = [
          ['products', productsResult],
          ['purchase orders', ordersResult],
          ['stock movements', movementsResult],
        ].filter(([, result]) => result.status === 'rejected')
        setDashboardDataError(failedSources.length
          ? `Unable to refresh ${failedSources.map(([name]) => name).join(', ')}. Successfully refreshed records remain visible; try again after checking the backend connection.`
          : '')
        return failedSources.length === 0
      })
      .finally(() => {
        if (requestVersion === dashboardRefreshVersionRef.current) {
          setDashboardLoading(false)
          dashboardRefreshPromiseRef.current = null
        }
      })
    dashboardRefreshPromiseRef.current = request
    return request
  }

  async function refreshReportData() {
    setReportsLoading(true)
    setReportsDataError('')
    const productRequestVersion = ++productRefreshVersionRef.current
    const results = await Promise.allSettled([getProducts(), getPurchaseOrders(), getStockMovements()])
    const [productsResult, ordersResult, movementsResult] = results
    if (productsResult.status === 'fulfilled' && productRequestVersion === productRefreshVersionRef.current) {
      setProducts(productsResult.value)
      setProductLoadError('')
    } else if (productsResult.status === 'rejected') {
      setProductLoadError(productsResult.reason instanceof Error ? productsResult.reason.message : 'Unable to refresh products.')
    }
    if (ordersResult.status === 'fulfilled') setPurchaseOrders(ordersResult.value)
    if (movementsResult.status === 'fulfilled') setStockMovements(movementsResult.value)
    setReportsLoading(false)
    const failedSources = [
      ['products', productsResult],
      ['purchase orders', ordersResult],
      ['stock movements', movementsResult],
    ].filter(([, result]) => result.status === 'rejected')
    if (failedSources.length) {
      const message = `Unable to refresh ${failedSources.map(([name]) => name).join(', ')}. Successfully refreshed sources are shown; retry to update all reports.`
      setReportsDataError(message)
      throw new Error(message)
    }
    setReportsDataError('')
    return true
  }

  const filteredProducts = filterProducts(products, {
    searchText: search,
    category: categoryFilter,
    supplier: supplierFilter,
  })
    .sort((first, second) => {
      const firstValue = sortBy === 'name' || sortBy === 'category'
        ? normalizeText(first[sortBy]) : first[sortBy]
      const secondValue = sortBy === 'name' || sortBy === 'category'
        ? normalizeText(second[sortBy]) : second[sortBy]
      const comparison = firstValue > secondValue ? 1 : firstValue < secondValue ? -1 : 0
      return sortDirection === 'asc' ? comparison : -comparison
    })

  const categoryOptions = categoryRecords.map((category) => category?.name).filter(Boolean)
  const productSupplierOptions = [...new Set(products
    .map((product) => product.supplier)
    .filter((supplier) => typeof supplier === 'string' && supplier.trim()))]
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
    if (pageId !== 'suppliers' && supplierRoute) clearSupplierRoute()
    if (pageId === 'dashboard') void refreshDashboardData()
    else if (pageId === 'products' || pageId === 'stock') void refreshProducts()
    setActivePage(pageId)
    setIsSidebarOpen(false)
    setSelectedProduct(null)
  }

  const navigateToRequestedWorkspace = useEffectEvent((pageId) => handleNavigation(pageId))
  useEffect(() => {
    if (workspaceRequest?.page) navigateToRequestedWorkspace(workspaceRequest.page)
  }, [workspaceRequest])

  function navigateSupplierRoute(supplierId, mode) {
    const path = mode === 'edit' ? `/suppliers/${supplierId}/edit` : `/suppliers/${supplierId}`
    window.history.pushState({}, '', path)
    setSupplierRoute({ id: Number(supplierId), mode })
    setActivePage('suppliers')
    setIsSidebarOpen(false)
  }

  function clearSupplierRoute() {
    if (getSupplierRoute()) window.history.pushState({}, '', '/')
    setSupplierRoute(null)
  }
    function navigateProductRoute(productId, mode) {
    const path = mode === 'edit'
      ? `/products/${productId}/edit`
      : `/products/${productId}`

    window.history.pushState({}, '', path)
    setProductRoute({ id: Number(productId), mode })
    setActivePage('products')
    setIsSidebarOpen(false)
  }

  function clearProductRoute() {
    if (getProductRoute()) window.history.pushState({}, '', '/')
    setProductRoute(null)
    setSelectedProduct(null)
    setShowForm(false)
    setEditingProduct(null)
  }

  function openAddForm() {
    setEditingProduct(null)
    setForm({
      ...emptyForm,
      reorderThreshold: String(settings.inventory.defaultReorderThreshold),
      department: settings.inventory.defaultDepartment,
    })
    setErrors({})
    setSuccessMessage('')
    setProductSaveWarning('')
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
    setProductSaveWarning('')
    setShowForm(true)
    setSelectedProduct(null)
  }

  function closeForm() {
  if (getProductRoute()) {
    clearProductRoute()
  } else {
    setShowForm(false)
    setEditingProduct(null)
    setForm(emptyForm)
    setErrors({})
  }
}

  function resetCategoryForm() {
    setCategoryForm({ name: '', description: '' })
    setEditingCategory(null)
    setCategoryErrors({})
  }

  async function submitCategory(event) {
    event.preventDefault()
    if (categorySubmitRef.current) return
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

    categorySubmitRef.current = true
    if (editingCategory) {
      try {
        const updatedCategory = await updateCategory(editingCategory.id, {
          name,
          description: categoryForm.description.trim(),
        })
        const mappedCategory = {
          ...updatedCategory,
          createdAt: updatedCategory.created_at ?? updatedCategory.createdAt,
        }
        setCategoryRecords((current) => current.map((category) =>
          category.id === editingCategory.id ? mappedCategory : category
        ))
        setProducts((current) => current.map((product) =>
          product.category === editingCategory.name ? { ...product, category: name } : product
        ))
        setSuccessMessage(`${name} was updated successfully.`)
      } catch (error) {
        console.error('Failed to update category:', error)
        setCategoryErrors({
          name: `Unable to update category: ${error instanceof Error ? error.message : 'Please try again.'}`,
        })
        return
      } finally {
        categorySubmitRef.current = false
      }
    } else {
      try {
        const createdCategory = await createCategory({
          name,
          description: categoryForm.description.trim(),
        })
        setCategoryRecords((current) => [...current, {
          ...createdCategory,
          createdAt: createdCategory.created_at ?? createdCategory.createdAt,
        }])
      } catch (error) {
        console.error('Failed to create category:', error)
        setCategoryErrors({
          name: `Unable to add category: ${error instanceof Error ? error.message : 'Please try again.'}`,
        })
        return
      } finally {
        categorySubmitRef.current = false
      }
      setSuccessMessage(`${name} was added successfully.`)
    }
    resetCategoryForm()
  }

  function editCategory(category) {
    setEditingCategory(category)
    setCategoryForm({ name: category.name, description: category.description })
    setCategoryErrors({})
  }

  async function deleteCategory(category) {
    if (!window.confirm(`Delete "${category.name}"? This cannot be undone.`)) return
    if (categoryDeleteRef.current === category.id) return
    categoryDeleteRef.current = category.id
    try {
      await deleteCategoryFromApi(category.id)
      setCategoryRecords((current) => current.filter((item) => item.id !== category.id))
      setSuccessMessage(`${category.name} was deleted.`)
    } catch (error) {
      console.error('Failed to delete category:', error)
      setSuccessMessage(error instanceof Error ? error.message : 'Unable to delete category. Please try again.')
    } finally {
      categoryDeleteRef.current = null
    }
  }

  function openSupplierForm(supplier = null) {
    if (!supplier && supplierRoute) clearSupplierRoute()
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

  function saveSettings(nextSettings) {
    writeAppSettings(user.id, nextSettings)
    setSettings(nextSettings)
    setSettingsStorageError('')
  }

  function closeSupplierForm() {
    clearSupplierRoute()
    setShowSupplierForm(false)
    setEditingSupplier(null)
    setSupplierForm(emptySupplierForm)
    setSupplierErrors({})
  }

  async function submitSupplier(event) {
    event.preventDefault()
    if (supplierSubmitRef.current) return
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

    const supplierData = {
      name,
      contactPerson: supplierForm.contactPerson.trim(),
      phone: supplierForm.phone.trim(),
      email: supplierForm.email.trim(),
      address: supplierForm.address.trim(),
      categories: supplierForm.categories,
      notes: supplierForm.notes.trim(),
    }
    supplierSubmitRef.current = true
    try {
      const savedSupplier = editingSupplier
        ? await updateSupplier(editingSupplier.id, supplierData)
        : await createSupplier(supplierData)
      setSuppliers((current) => editingSupplier
        ? current.map((supplier) => supplier.id === editingSupplier.id ? savedSupplier : supplier)
        : [...current, savedSupplier])
      setSuccessMessage(`${name} was ${editingSupplier ? 'updated' : 'added'} successfully.`)
      closeSupplierForm()
    } catch (error) {
      console.error('Failed to save supplier:', error)
      setSupplierErrors({ name: error instanceof Error ? error.message : 'Unable to save supplier.' })
    } finally {
      supplierSubmitRef.current = false
    }
  }

  async function deleteSupplier(supplier) {
    if (!window.confirm(`Delete "${supplier.name}"? This cannot be undone.`) || supplierDeleteRef.current === supplier.id) return
    supplierDeleteRef.current = supplier.id
    try {
      await deleteSupplierFromApi(supplier.id)
      setSuppliers((current) => current.filter((item) => item.id !== supplier.id))
      clearSupplierRoute()
      setSelectedSupplier(null)
      setSuccessMessage(`${supplier.name} was deleted.`)
    } catch (error) {
      console.error('Failed to delete supplier:', error)
      setSuccessMessage(error instanceof Error ? error.message : 'Unable to delete supplier.')
    } finally {
      supplierDeleteRef.current = null
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

  function openPurchaseOrderDetails(order) {
    setShowPurchaseOrderForm(false)
    setEditingPurchaseOrder(null)
    setSelectedPurchaseOrder(order)
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

  async function submitPurchaseOrder(event) {
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

    try {
      const request = {
        supplierId: supplier.id,
        expectedDelivery: purchaseOrderForm.expectedDelivery,
        notes: purchaseOrderForm.notes.trim(),
        lines: lineData,
      }
      const savedOrder = editingPurchaseOrder
        ? await updatePurchaseOrder(editingPurchaseOrder.id, request)
        : await createPurchaseOrder(request)
      setPurchaseOrders((current) => editingPurchaseOrder
        ? current.map((order) => order.id === editingPurchaseOrder.id ? savedOrder : order)
        : [...current, savedOrder])
      if (editingPurchaseOrder) recordPurchaseOrderActivity(savedOrder, 'purchase-order-updated', `${savedOrder.orderNumber} was updated.`)
      setSuccessMessage(editingPurchaseOrder ? `${savedOrder.orderNumber} was updated successfully.` : 'Purchase order was created as a draft.')
      closePurchaseOrderForm()
    } catch (error) {
      console.error('Failed to save purchase order:', error)
      setPurchaseOrderErrors({ form: error instanceof Error ? error.message : 'Unable to save purchase order.' })
    } finally {
      purchaseOrderSubmitRef.current = false
    }
  }

  async function updatePurchaseOrderStatus(order, nextStatus) {
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
    try {
      const savedOrder = await updatePurchaseOrderStatusFromApi(order.id, nextStatus)
      setPurchaseOrders((current) => current.map((item) => item.id === order.id ? savedOrder : item))
      setSelectedPurchaseOrder((current) => current?.id === order.id ? savedOrder : current)
      recordPurchaseOrderActivity(
        savedOrder,
        savedOrder.status === 'Cancelled' ? 'purchase-order-cancelled' : 'purchase-order-updated',
        savedOrder.status === 'Cancelled'
          ? `${savedOrder.orderNumber} was cancelled.`
          : `${savedOrder.orderNumber} was placed.`
      )
      setSuccessMessage(`${order.orderNumber} is now ${savedOrder.status}.`)
    } catch (error) {
      console.error('Failed to update purchase order status:', error)
      setSuccessMessage(error instanceof Error ? error.message : 'Unable to update purchase order status.')
    }
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

  async function submitReceipt(event) {
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
    const validReceipts = receiptLines.filter((entry) => entry.quantity > 0)
    try {
      const savedOrder = await receivePurchaseOrder(order.id, validReceipts.map(({ orderLine, quantity }) => ({
        itemId: order.lines.find((line) => line.productId === orderLine.productId)?.id || orderLine.id,
        quantity,
      })), `${order.id}-${Date.now()}-${Math.random().toString(36).slice(2)}`)
      const [updatedProducts, updatedMovements] = await Promise.all([getProducts(), getStockMovements()])
      setProducts(updatedProducts)
      setStockMovements(updatedMovements)
      setPurchaseOrders((current) => current.map((item) => item.id === order.id ? savedOrder : item))
      setReceiveForm(null)
      setReceiveErrors({})
      setSelectedPurchaseOrder(savedOrder)
      setSuccessMessage(`${order.orderNumber} receipt recorded and stock updated.`)
    } catch (error) {
      console.error('Failed to receive purchase order:', error)
      setReceiveErrors({ form: error instanceof Error ? error.message : 'Unable to receive purchase order.' })
    } finally {
      receiveSubmissionRef.current = null
      setReceiveSubmitting(false)
    }
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
    if (form.quantity === '' || !Number.isSafeInteger(Number(form.quantity)) || Number(form.quantity) < 0 || Number(form.quantity) > 2147483647) {
      nextErrors.quantity = 'Use a non-negative whole number within the supported range.'
    }
    if (form.reorderThreshold === '' || !Number.isSafeInteger(Number(form.reorderThreshold)) || Number(form.reorderThreshold) < 0 || Number(form.reorderThreshold) > 2147483647) {
      nextErrors.reorderThreshold = 'Use a non-negative whole number within the supported range.'
    }
    if (form.price === '' || !Number.isFinite(Number(form.price)) || Number(form.price) < 0 || (!editingProduct && Number(form.price) === 0)) {
      nextErrors.price = editingProduct ? 'Use a valid non-negative price.' : 'Enter a unit price greater than zero.'
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

  async function handleSubmit(event) {
    event.preventDefault()
    if (productSubmitRef.current) return
    setSuccessMessage('')
    if (!validateForm()) return
    const initialQuantity = Number(form.quantity)
    const productData = {
      name: form.name.trim(), sku: form.sku.trim(), category: form.category,
      description: form.description.trim(), quantity: editingProduct ? initialQuantity : 0,
      price: Number(form.price), supplier: form.supplier.trim() || 'Not specified',
      reorderThreshold: Number(form.reorderThreshold), condition: form.condition,
      department: form.department, imageUrl: form.imageUrl.trim(),
    }

    productSubmitRef.current = true
    setProductSubmitting(true)
    try {
      const savedProduct = editingProduct
        ? await updateProduct(editingProduct.id, productData)
        : await createProduct(productData)
      const productRefreshVersion = ++productRefreshVersionRef.current
      setProducts((current) => editingProduct
        ? current.map((product) => product.id === editingProduct.id ? savedProduct : product)
        : [...current, savedProduct])

      if (!editingProduct && initialQuantity > 0) {
        try {
          await recordStockMovement({
            productId: savedProduct.id,
            type: 'Stock in',
            quantity: initialQuantity,
            reference: 'Initial inventory',
            department: form.department,
            remarks: 'Opening stock recorded when product was created.',
            idempotencyKey: createStockMovementIdempotencyKey(),
          })
          setSuccessMessage(`${productData.name} was added and its ${initialQuantity} initial unit(s) were recorded as stock in.`)
        } catch (error) {
          console.error('Product was created, but its initial stock could not be recorded:', error)
          setProductSaveWarning(`Product "${productData.name}" was created, but the initial ${initialQuantity} unit(s) could not be confirmed as stock in. Check its current quantity and movement history before retrying. ${error instanceof Error ? error.message : ''}`.trim())
          setSuccessMessage(`${productData.name} was added; initial stock was not confirmed.`)
        }
      } else {
        setSuccessMessage(`${productData.name} was ${editingProduct ? 'updated' : 'added'} successfully.`)
      }

      try {
        const refreshedProducts = await getProducts()
        if (productRefreshVersion === productRefreshVersionRef.current) {
          setProducts(refreshedProducts)
          setProductLoadError('')
        }
      } catch (error) {
        console.error('Product was saved, but the product list could not be refreshed:', error)
        setProductSaveWarning((current) => [
          current,
          `The product was saved, but the Products list could not be refreshed. ${error instanceof Error ? error.message : 'Refresh the page to reload products.'}`,
        ].filter(Boolean).join(' '))
      }
      setForm(emptyForm)
      setErrors({})
      setShowForm(false)
      setEditingProduct(null)
      if (getProductRoute()) clearProductRoute()
    } catch (error) {
      console.error('Failed to save product:', error)
      setErrors({ form: error instanceof Error ? error.message : 'Unable to save product.' })
    } finally {
      productSubmitRef.current = false
      setProductSubmitting(false)
    }
  }

  async function deleteProduct(product) {
    if (!window.confirm(`Delete "${product.name}"? This cannot be undone.`) || productDeleteRef.current === product.id) return
    productDeleteRef.current = product.id
    try {
      await deleteProductFromApi(product.id)
      setProducts((current) => current.filter((item) => item.id !== product.id))
      await refreshProducts()
      setSelectedProduct(null)
      setSuccessMessage(`${product.name} was deleted.`)
    } catch (error) {
      console.error('Failed to delete product:', error)
      setSuccessMessage(error instanceof Error ? error.message : 'Unable to delete product.')
    } finally {
      productDeleteRef.current = null
    }
  }

  async function handleMovementSubmit(event) {
    event.preventDefault()
    if (movementSubmitRef.current) return
    const errorsForMovement = {}
    const quantity = Number(movementForm.quantity)
    const product = products.find((item) => item.id === Number(movementForm.productId))

    if (!product) errorsForMovement.productId = 'Select a product.'
    if (movementForm.quantity === '' || !Number.isSafeInteger(quantity) || quantity <= 0 || quantity > 2147483647) {
      errorsForMovement.quantity = 'Enter a positive whole number.'
    } else if (movementForm.type === 'Stock out' && product && quantity > product.quantity) {
      errorsForMovement.quantity = `Only ${product.quantity} unit${product.quantity === 1 ? '' : 's'} available.`
    }
    setMovementErrors(errorsForMovement)
    if (Object.keys(errorsForMovement).length > 0) return

    const request = {
      productId: product.id,
      type: movementForm.type,
      quantity,
      reference: movementForm.reference.trim(),
      department: movementForm.department,
      remarks: movementForm.remarks.trim(),
    }
    const fingerprint = JSON.stringify(request)
    movementSubmitRef.current = true
    setMovementSubmitting(true)
    setMovementRefreshWarning('')
    setSuccessMessage('')
    try {
      if (pendingMovementRef.current?.fingerprint !== fingerprint) {
        pendingMovementRef.current = {
          fingerprint,
          idempotencyKey: createStockMovementIdempotencyKey(),
        }
      }
      const result = await recordStockMovement({
        ...request,
        idempotencyKey: pendingMovementRef.current.idempotencyKey,
      })
      pendingMovementRef.current = null
      if (Number.isInteger(result.resultingQuantity)) {
        setProducts((current) => current.map((item) => item.id === product.id
          ? { ...item, quantity: result.resultingQuantity }
          : item))
      }
      setMovementForm(emptyMovementForm)
      setMovementErrors({})
      const balanceMessage = Number.isInteger(result.previousQuantity) && Number.isInteger(result.resultingQuantity)
        ? ` Stock changed from ${result.previousQuantity} to ${result.resultingQuantity}.`
        : ''
      setSuccessMessage(`${movementForm.type} recorded for ${product.name}.${balanceMessage}`)

      const [productsResult, movementsResult] = await Promise.allSettled([refreshProducts(), getStockMovements()])
      if (movementsResult.status === 'fulfilled') setStockMovements(movementsResult.value)
      if (productsResult.status === 'rejected' || !productsResult.value || movementsResult.status === 'rejected') {
        console.error('Stock movement was recorded, but inventory refresh failed:', {
          productsError: productsResult.status === 'rejected' ? productsResult.reason : productsResult.value ? null : 'Product refresh failed.',
          movementsError: movementsResult.status === 'rejected' ? movementsResult.reason : null,
        })
        setMovementRefreshWarning('The stock movement was recorded, but inventory or movement history could not be fully refreshed. Refresh the page before relying on the displayed values.')
      }
      return result
    } catch (error) {
      console.error('Failed to record stock movement:', error)
      setMovementErrors({ form: error instanceof Error ? error.message : 'Unable to record stock movement.' })
    } finally {
      movementSubmitRef.current = false
      setMovementSubmitting(false)
    }
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
    setSupplierFilter('all')
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
        <div className="brand"><InventraLogo className="brand-mark-app" /><span>Inventra</span><button className="sidebar-close" aria-label="Close navigation" onClick={() => setIsSidebarOpen(false)}>×</button></div>
        <div className="sidebar-navigation">
          <nav className="sidebar-home" aria-label="Public navigation">
            <button className="nav-item home-nav-item" onClick={onGoHome}><NavigationIcon name="home" /><span>Home</span></button>
          </nav>
          <p className="nav-label">WORKSPACE</p>
          <nav className="workspace-navigation" aria-label="Workspace navigation">
            {navigationItems.map((item) => <button className={`nav-item ${activePage === item.id ? 'active' : ''}`} key={item.id} onClick={() => handleNavigation(item.id)}><NavigationIcon name={item.id} /><span>{item.label}</span></button>)}
          </nav>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <button className="menu-button" aria-label="Open navigation" onClick={() => setIsSidebarOpen(true)}>☰</button>
          <div className="page-heading"><p className="eyebrow">WORKSPACE / {activeItem.label.toUpperCase()}</p><h1>{isDashboard ? 'Inventory Dashboard' : activeItem.label}</h1><p className="subtitle">{isDashboard ? 'Monitor your products and stock levels.' : isProducts ? 'Manage and monitor your current stock.' : activePage === 'stock' ? 'Record stock in, stock out, and review inventory history.' : activePage === 'categories' ? 'Organize products with reusable inventory categories.' : activePage === 'suppliers' ? 'Manage supplier contacts and product assignments.' : activePage === 'settings' ? 'Manage your account profile and workspace preferences.' : isPurchaseOrders ? 'Create orders, track delivery, and receive inventory.' : isReports ? 'Review current inventory, stock activity, and purchasing data.' : isNotifications ? 'Review current stock alerts and create replenishment drafts.' : 'This workspace is planned for a future phase.'}</p></div>
          <div className="topbar-actions">{isDashboard && <><button className="secondary-button" onClick={() => handleNavigation('notifications')}>Alerts: {productAlertCount} products · {outstandingOrderCount} orders</button><button className="primary-button" onClick={openAddForm}>+ Add Product</button></>}{isProducts && !productRoute && <button className="primary-button" onClick={openAddForm}>+ Add Product</button>}<button className="secondary-button signout-button" onClick={onSignOut}>Sign out</button></div>
        </header>

        {authError && <div className="error-message" role="alert">{authError}</div>}
        {successMessage && <div className="success-message" role="status">{successMessage}</div>}
        {productSaveWarning && <div className="error-message" role="alert">{productSaveWarning}</div>}
        {movementRefreshWarning && <div className="error-message" role="alert">{movementRefreshWarning}</div>}
        {!isDashboard && categoryLoadError && <div className="error-message" role="alert">{categoryLoadError}</div>}
        {!isDashboard && productLoadError && <div className="error-message" role="alert">Products could not be loaded: {productLoadError}</div>}
        {!isDashboard && productsLoading && <div className="loading-message" role="status">Loading products from the backend…</div>}

       {showForm && (isDashboard || isProducts) && (
  <ProductForm
    categories={categoryOptions}
    suppliers={suppliers}
    form={form}
    setForm={setForm}
    errors={errors}
    editingProduct={editingProduct}
    submitting={productSubmitting}
    onSubmit={handleSubmit}
    onCancel={closeForm}
  />
)}

        {isDashboard && <Dashboard
          products={products}
          movements={stockMovements}
          orders={purchaseOrders}
          loading={dashboardLoading}
          error={dashboardDataError}
          onRefresh={refreshDashboardData}
          onProducts={() => handleNavigation('products')}
          onStock={() => handleNavigation('stock')}
          onPurchaseOrders={() => handleNavigation('purchase-orders')}
          onCategories={() => handleNavigation('categories')}
          onSuppliers={() => handleNavigation('suppliers')}
          onReports={() => handleNavigation('reports')}
          onNotifications={() => handleNavigation('notifications')}
          onViewProduct={(product) => navigateProductRoute(product.id, 'view')}
        />}

        {isProducts && (
          <>
          {!productRoute && (
          <ProductFilters categories={categoryOptions} suppliers={productSupplierOptions} search={search} setSearch={setSearch} categoryFilter={categoryFilter} setCategoryFilter={setCategoryFilter} supplierFilter={supplierFilter} setSupplierFilter={setSupplierFilter} sortBy={sortBy} sortDirection={sortDirection} onSort={handleSortChange} onClear={clearFilters} />
          )}

           {productRoute?.mode === 'view' && selectedProduct && (
  <ProductDetails
    product={selectedProduct}
    onClose={clearProductRoute}
    onEdit={() => navigateProductRoute(selectedProduct.id, 'edit')}
    onDelete={() => deleteProduct(selectedProduct)}
  />
)}
            {!productRoute && (
  <ProductTable
    products={products}
    filteredProducts={filteredProducts}
    onView={(product) => navigateProductRoute(product.id, 'view')}
    onEdit={(product) => navigateProductRoute(product.id, 'edit')}
    onDelete={deleteProduct}
  />
)}
          </>
        )}

        {activePage === 'stock' && <StockManagement products={products} movementForm={movementForm} setMovementForm={setMovementForm} errors={movementErrors} submitting={movementSubmitting} onSubmit={handleMovementSubmit} movements={stockMovements} />}
        {activePage === 'categories' && <CategoryManagement categories={visibleCategories} search={categorySearch} setSearch={setCategorySearch} form={categoryForm} setForm={setCategoryForm} errors={categoryErrors} editingCategory={editingCategory} formRef={categoryFormRef} onSubmit={submitCategory} onEdit={editCategory} onDelete={deleteCategory} onCancel={resetCategoryForm} />}
        {activePage === 'suppliers' && <SupplierManagement suppliers={visibleSuppliers} products={products} categories={categoryOptions} search={supplierSearch} setSearch={setSupplierSearch} errors={supplierErrors} loading={suppliersLoading} loadError={supplierLoadError} form={supplierForm} setForm={setSupplierForm} editingSupplier={editingSupplier} selectedSupplier={selectedSupplier} formRef={supplierFormRef} detailsRef={supplierDetailsRef} onSelect={(supplier) => supplier ? navigateSupplierRoute(supplier.id, 'view') : clearSupplierRoute()} showForm={showSupplierForm} onAdd={() => openSupplierForm()} onEdit={(supplier) => navigateSupplierRoute(supplier.id, 'edit')} onDelete={deleteSupplier} onSubmit={submitSupplier} onCancel={closeSupplierForm} />}
        {activePage === 'settings' && <SettingsPage user={user} settings={settings} storageError={settingsStorageError} onSaveSettings={saveSettings} onUpdateProfile={onUpdateProfile} />}
        {isPurchaseOrders && <PurchaseOrderManagement orders={visiblePurchaseOrders} allOrders={purchaseOrders} products={products} suppliers={suppliers} search={purchaseOrderSearch} setSearch={setPurchaseOrderSearch} statusFilter={purchaseOrderStatusFilter} setStatusFilter={setPurchaseOrderStatusFilter} form={purchaseOrderForm} setForm={setPurchaseOrderForm} errors={purchaseOrderErrors} editingOrder={editingPurchaseOrder} selectedOrder={selectedPurchaseOrder} showForm={showPurchaseOrderForm} formRef={purchaseOrderFormRef} detailsRef={purchaseOrderDetailsRef} receiveForm={receiveForm} setReceiveForm={setReceiveForm} receiveErrors={receiveErrors} receiveSubmitting={receiveSubmitting} onAdd={() => openPurchaseOrderForm()} onEdit={openPurchaseOrderForm} onSelect={(order) => order ? openPurchaseOrderDetails(order) : setSelectedPurchaseOrder(null)} onSubmit={submitPurchaseOrder} onCancel={closePurchaseOrderForm} onPlace={(order) => updatePurchaseOrderStatus(order, 'Ordered')} onCancelOrder={(order) => updatePurchaseOrderStatus(order, 'Cancelled')} onReceive={openReceiveForm} onReceiveSubmit={submitReceipt} onReceiveCancel={() => { setReceiveForm(null); setReceiveErrors({}) }} />}
        {isReports && <Reports
          products={products}
          categories={categoryRecords}
          suppliers={suppliers}
          movements={stockMovements}
          orders={purchaseOrders}
          filters={reportFilters}
          setFilters={setReportFilters}
          loading={reportsLoading}
          dataError={reportsDataError}
          onRefresh={refreshReportData}
        />}
        {isNotifications && <NotificationsPage
          products={notificationProducts}
          allProducts={products}
          orders={purchaseOrders}
          movements={stockMovements}
          suppliers={suppliers}
          notificationPreferences={settings.notifications}
          reorderQuantities={reorderQuantities}
          setReorderQuantities={setReorderQuantities}
          reorderSuppliers={reorderSuppliers}
          setReorderSuppliers={setReorderSuppliers}
          storageError={notificationStorageError}
          onClearStorageError={() => setNotificationStorageError('')}
          onProduct={(product) => navigateProductRoute(product.id, 'view')}
          onOrder={(order) => { handleNavigation('purchase-orders'); setSelectedPurchaseOrder(order) }}
          onStockMovement={(notification) => {
            handleNavigation('stock')
            if (notification.destination?.productId) {
              setMovementForm((current) => ({ ...current, productId: String(notification.destination.productId) }))
            }
          }}
          onCreateOrder={openPurchaseOrderFromRecommendation}
        />}

        {!isDashboard && !isProducts && activePage !== 'stock' && activePage !== 'categories' && activePage !== 'suppliers' && activePage !== 'settings' && !isPurchaseOrders && !isReports && !isNotifications && <section className="planned-card"><span className="planned-icon">◌</span><h2>{activeItem.label} is planned</h2><p>This navigation item is visible for the future Inventra roadmap. It will become functional in a later implementation phase.</p></section>}
        <footer>Built with React · Demo data only</footer>
      </main>
    </div>
  )
}

export default InventoryApp

function SettingsPage({ user, settings, storageError, onSaveSettings, onUpdateProfile }) {
  const [fullName, setFullName] = useState(user.user_metadata?.full_name || '')
  const [profileError, setProfileError] = useState('')
  const [profileMessage, setProfileMessage] = useState('')
  const [profileSaving, setProfileSaving] = useState(false)
  const [draftSettings, setDraftSettings] = useState(settings)
  const [settingsError, setSettingsError] = useState('')
  const [settingsMessage, setSettingsMessage] = useState('')

  async function submitProfile(event) {
    event.preventDefault()
    const name = fullName.trim()
    if (!name) {
      setProfileError('Enter a display name.')
      return
    }
    if (name.length > 80) {
      setProfileError('Display name must be 80 characters or fewer.')
      return
    }
    setProfileSaving(true)
    setProfileError('')
    setProfileMessage('')
    try {
      const updatedUser = await onUpdateProfile(name)
      setFullName(updatedUser.user_metadata?.full_name || name)
      setProfileMessage('Profile name updated in your Supabase Auth account.')
    } catch (error) {
      setProfileError(error instanceof Error ? error.message : 'Unable to update your profile.')
    } finally {
      setProfileSaving(false)
    }
  }

  function updateNotificationPreference(preference, enabled) {
    setDraftSettings((current) => ({
      ...current,
      notifications: { ...current.notifications, [preference]: enabled },
    }))
    setSettingsError('')
    setSettingsMessage('')
  }

  function submitPreferences(event) {
    event.preventDefault()
    const threshold = draftSettings.inventory.defaultReorderThreshold
    if (!Number.isSafeInteger(threshold) || threshold < 0 || threshold > 2147483647) {
      setSettingsError('Enter a whole-number reorder threshold between 0 and 2,147,483,647.')
      return
    }
    try {
      onSaveSettings(draftSettings)
      setSettingsError('')
      setSettingsMessage('Preferences saved in this browser for this account.')
    } catch (error) {
      setSettingsError(error instanceof Error ? error.message : 'Unable to save these preferences.')
      setSettingsMessage('')
    }
  }

  return <section className="settings-page">
    <section className="table-card settings-card">
      <div className="section-heading"><div><h2>Account profile</h2><p>Your display name is saved to your Supabase Auth profile. Email remains hidden in the workspace.</p></div></div>
      <form className="settings-profile-form" onSubmit={submitProfile} noValidate>
        <label htmlFor="settings-full-name">Display name<input id="settings-full-name" value={fullName} onChange={(event) => setFullName(event.target.value)} maxLength="80" autoComplete="name" /></label>
        {profileError && <p className="field-error form-wide" role="alert">{profileError}</p>}
        {profileMessage && <p className="settings-saved form-wide" role="status">{profileMessage}</p>}
        <div className="form-actions"><button className="primary-button" type="submit" disabled={profileSaving}>{profileSaving ? 'Saving…' : 'Save profile'}</button></div>
      </form>
    </section>

    <form className="table-card settings-card settings-preferences" onSubmit={submitPreferences}>
      <div className="section-heading"><div><h2>Notification preferences</h2><p>Choose which event types appear in the in-app Notifications page. These preferences are saved only in this browser.</p></div></div>
      <div className="settings-options">
        <label className="settings-option"><input type="checkbox" checked={draftSettings.notifications.lowStock} onChange={(event) => updateNotificationPreference('lowStock', event.target.checked)} /><span><strong>Low-stock alerts</strong><small>Show products at or below their reorder threshold.</small></span></label>
        <label className="settings-option"><input type="checkbox" checked={draftSettings.notifications.outOfStock} onChange={(event) => updateNotificationPreference('outOfStock', event.target.checked)} /><span><strong>Out-of-stock alerts</strong><small>Show products with no available quantity.</small></span></label>
        <label className="settings-option"><input type="checkbox" checked={draftSettings.notifications.stockMovements} onChange={(event) => updateNotificationPreference('stockMovements', event.target.checked)} /><span><strong>Stock movement activity</strong><small>Show recorded stock-in and stock-out events.</small></span></label>
        <label className="settings-option"><input type="checkbox" checked={draftSettings.notifications.purchaseOrders} onChange={(event) => updateNotificationPreference('purchaseOrders', event.target.checked)} /><span><strong>Purchase-order activity</strong><small>Show order creation, updates, and receiving events.</small></span></label>
      </div>
      <div className="settings-inventory">
        <h3>Inventory defaults</h3>
        <p>These browser-only defaults are used when starting a new product form. Existing products are not changed.</p>
        <label htmlFor="settings-reorder-threshold">Default reorder threshold<input id="settings-reorder-threshold" type="number" min="0" max="2147483647" step="1" value={draftSettings.inventory.defaultReorderThreshold} onChange={(event) => {
          const value = event.target.value
          setDraftSettings((current) => ({
            ...current,
            inventory: { ...current.inventory, defaultReorderThreshold: value === '' ? '' : Number(value) },
          }))
          setSettingsError('')
          setSettingsMessage('')
        }} /></label>
        <label htmlFor="settings-default-department">Default department<select id="settings-default-department" value={draftSettings.inventory.defaultDepartment} onChange={(event) => {
          setDraftSettings((current) => ({
            ...current,
            inventory: { ...current.inventory, defaultDepartment: event.target.value },
          }))
          setSettingsMessage('')
        }}>{departments.map((department) => <option key={department}>{department}</option>)}</select></label>
      </div>
      {(storageError || settingsError) && <p className="field-error form-wide" role="alert">{settingsError || storageError}</p>}
      {settingsMessage && <p className="settings-saved form-wide" role="status">{settingsMessage}</p>}
      <div className="form-actions"><button className="primary-button" type="submit">Save browser preferences</button></div>
    </form>
  </section>
}

function Dashboard({
  products,
  movements,
  orders,
  loading,
  error,
  onRefresh,
  onProducts,
  onStock,
  onPurchaseOrders,
  onCategories,
  onSuppliers,
  onReports,
  onNotifications,
  onViewProduct,
}) {
  const inventory = calculateInventoryMetrics(products)
  const stockCounts = {
    inStock: products.filter((product) => getReportStockStatus(product) === 'in-stock').length,
    low: inventory.lowStockCount,
    out: inventory.outOfStockCount,
    unknown: products.filter((product) => getReportStockStatus(product) === 'unknown').length,
  }
  const orderAnalytics = calculatePurchaseOrderAnalytics(orders)
  const dateRange = getReportDateRange('last-7-days', '', '')
  const sortedMovements = [...movements]
    .sort((first, second) => {
      const firstDate = parseDateSafely(first.date)?.getTime() ?? 0
      const secondDate = parseDateSafely(second.date)?.getTime() ?? 0
      return secondDate - firstDate
    })
  const recentMovementRecords = sortedMovements.slice(0, 5)
  const recentMovements = sortedMovements
    .filter((movement) => isWithinReportDateRange(movement.date, dateRange))
  const movementTrend = buildMovementTimeSeries(recentMovements, dateRange)
  const recentOrders = [...orders]
    .sort((first, second) => {
      const firstDate = parseDateSafely(first.orderDate || first.createdAt)?.getTime() ?? 0
      const secondDate = parseDateSafely(second.orderDate || second.createdAt)?.getTime() ?? 0
      return secondDate - firstDate
    })
    .slice(0, 5)
  const alerts = products
    .filter((product) => ['low', 'out'].includes(getReportStockStatus(product)))
    .sort((first, second) => {
      const firstStatus = getReportStockStatus(first) === 'out' ? 0 : 1
      const secondStatus = getReportStockStatus(second) === 'out' ? 0 : 1
      return firstStatus - secondStatus
        || (getValidProductQuantity(first) ?? 0) - (getValidProductQuantity(second) ?? 0)
    })
    .slice(0, 6)
  const statusLabels = ['Draft', 'Ordered', 'Partially Received', 'Received', 'Cancelled']
  const maxOrderCount = Math.max(...statusLabels.map((status) => orderAnalytics.statusCounts[status]), 1)
  const initialEmptyLoading = loading && products.length === 0 && movements.length === 0 && orders.length === 0

  return <section className="dashboard-page">
    <section className="dashboard-navigation" aria-labelledby="dashboard-navigation-heading">
      <div className="dashboard-section-heading">
        <div>
          <h2 id="dashboard-navigation-heading">Quick Navigation</h2>
          <p>Open an inventory workspace or jump to the overview below.</p>
        </div>
      </div>
      <DashboardNavigationTiles
        onProducts={onProducts}
        onStock={onStock}
        onPurchaseOrders={onPurchaseOrders}
        onCategories={onCategories}
        onSuppliers={onSuppliers}
        onNotifications={onNotifications}
        onReports={onReports}
      />
    </section>

    <section className="dashboard-analytics" id="dashboard-inventory-overview" aria-labelledby="dashboard-analytics-heading">
      <div className="dashboard-section-heading dashboard-analytics-heading">
        <div>
          <h2 id="dashboard-analytics-heading">Inventory Analytics</h2>
          <p>Current inventory and recent activity from your records.</p>
        </div>
        <button className="secondary-button" type="button" onClick={onRefresh} disabled={loading}>
          {loading ? 'Updating…' : 'Refresh dashboard'}
        </button>
      </div>
      {loading && <div className="dashboard-state loading" role="status">{initialEmptyLoading ? 'Loading dashboard data…' : 'Updating dashboard data…'}</div>}
      {error && <div className="dashboard-state error" role="alert"><span>{error}</span><button className="secondary-button" type="button" onClick={onRefresh} disabled={loading}>Retry</button></div>}

      {initialEmptyLoading ? null : <>
      {(stockCounts.low + stockCounts.out > 0 || orderAnalytics.statusCounts.Ordered + orderAnalytics.statusCounts['Partially Received'] > 0) && (
        <section className="attention-banner">
          <div><strong>Attention needed</strong><span>{stockCounts.low + stockCounts.out} product(s) need replenishment · {orderAnalytics.statusCounts.Ordered + orderAnalytics.statusCounts['Partially Received']} purchase order(s) awaiting receipt</span></div>
          <button className="secondary-button" type="button" onClick={onNotifications}>Review notifications</button>
        </section>
      )}
      <section className="stats dashboard-stats" aria-label="Inventory and purchasing KPIs">
        <StatCard icon="▦" color="purple" label="Total Products" value={inventory.productCount.toLocaleString()} detail="Current product records" />
        <StatCard icon="▤" color="blue" label="Total Stock Quantity" value={inventory.totalQuantity.toLocaleString()} detail="Sum of valid current quantities" />
        <StatCard icon="৳" color="green" label="Total Inventory Value" value={formatCurrency(inventory.totalValue)} detail="Current quantity × unit price" />
        <StatCard icon="!" color="orange" label="Low Stock Items" value={inventory.lowStockCount.toLocaleString()} detail="Above zero, at/below reorder level" />
        <StatCard icon="×" color="red" label="Out of Stock" value={inventory.outOfStockCount.toLocaleString()} detail="Current quantity is zero" />
        <StatCard icon="▣" color="purple" label="Pending Purchase Orders" value={orderAnalytics.statusCounts.Draft.toLocaleString()} detail="Database Pending displayed as Draft" />
      </section>

      <section className="dashboard-grid dashboard-chart-grid">
        <article className="table-card dashboard-panel">
          <div className="table-heading"><div><h2>Stock overview</h2><p>Current product counts by validated stock status.</p></div><button className="text-button" type="button" onClick={onNotifications}>View alerts</button></div>
          <StockDistributionChart counts={stockCounts} />
        </article>
        <article className="table-card dashboard-panel">
          <div className="table-heading"><div><h2>Stock movement trend</h2><p>Stock IN and OUT quantities · last 7 days</p></div><button className="text-button" type="button" onClick={onStock}>Stock history</button></div>
          {recentMovements.length ? <MovementChart buckets={movementTrend.buckets} /> : <EmptyState message="No stock movements recorded in the last 7 days." />}
        </article>
        <article className="table-card dashboard-panel">
          <div className="table-heading"><div><h2>Purchase order status</h2><p>Current status distribution</p></div><button className="text-button" type="button" onClick={onPurchaseOrders}>View orders</button></div>
          {orders.length ? <div className="dashboard-status-chart">{statusLabels.map((status) => (
            <div className="dashboard-status-row" key={status}>
              <span>{status}</span><div className="bar-track"><span style={{ width: `${orderAnalytics.statusCounts[status] / maxOrderCount * 100}%` }} /></div><strong>{orderAnalytics.statusCounts[status]}</strong>
            </div>
          ))}</div> : <EmptyState message="No purchase orders have been recorded." />}
        </article>
      </section>

      <section className="dashboard-grid dashboard-detail-grid">
        <article className="table-card dashboard-panel">
          <div className="table-heading"><div><h2>Inventory alerts</h2><p>Products at or below their reorder level.</p></div><button className="text-button" type="button" onClick={onNotifications}>All alerts</button></div>
          <div className="overview-list">
            {alerts.map((product) => {
              const isOut = getReportStockStatus(product) === 'out'
              return <button className="overview-row overview-button" type="button" key={product.id} onClick={() => onViewProduct(product)}>
                <span className={`list-icon ${isOut ? 'red' : 'orange'}`}>{isOut ? '×' : '!'}</span>
                <span className="dashboard-row-copy"><strong>{product.name}</strong><small>{product.sku || 'No SKU'} · reorder level {product.reorderThreshold ?? product.reorder_level ?? '—'}</small></span>
                <span className={isOut ? 'dashboard-alert-label out' : 'dashboard-alert-label low'}>{isOut ? 'Out of stock' : `${getValidProductQuantity(product)} left`}</span>
              </button>
            })}
            {!alerts.length && <EmptyState message="No low-stock or out-of-stock products." />}
          </div>
        </article>
        <article className="table-card dashboard-panel">
          <div className="table-heading"><div><h2>Recent stock movements</h2><p>Latest persisted stock activity.</p></div><button className="text-button" type="button" onClick={onStock}>View stock history</button></div>
          <div className="overview-list">
            {recentMovementRecords.map((movement) => (
              <div className="overview-row" key={movement.id}>
                <span className={`list-icon ${movement.type === 'Stock in' ? 'green' : movement.type === 'Stock out' ? 'blue' : 'purple'}`}>{movement.type === 'Stock in' ? '↓' : movement.type === 'Stock out' ? '↑' : '↔'}</span>
                <span className="dashboard-row-copy"><strong>{movement.productName || 'Unknown product'}</strong><small>{movement.type} · {formatMovementDate(movement.date)}{movement.remarks ? ` · ${movement.remarks}` : ''}</small></span>
                <span className="movement-quantity">{Number.isSafeInteger(Number(movement.quantity)) ? movement.quantity : '—'}</span>
              </div>
            ))}
            {!recentMovementRecords.length && <EmptyState message="No stock movements recorded yet." />}
          </div>
        </article>
      </section>

      <section className="table-card dashboard-panel dashboard-orders">
        <div className="table-heading"><div><h2>Recent purchase orders</h2><p>Latest orders with values calculated from their order lines.</p></div><button className="text-button" type="button" onClick={onPurchaseOrders}>View all purchase orders</button></div>
        <div className="table-scroll"><table><thead><tr><th>ORDER</th><th>SUPPLIER</th><th>ORDER DATE</th><th>TOTAL AMOUNT</th><th>STATUS</th></tr></thead><tbody>
          {recentOrders.map((order) => <tr key={order.id}>
            <td className="product-name">{order.orderNumber || `PO-${order.id}`}</td>
            <td>{order.supplierName || 'Unknown supplier'}</td>
            <td>{formatDate(order.orderDate || order.createdAt)}</td>
            <td>{formatCurrency(getPurchaseOrderTotal(order))}</td>
            <td><span className={`po-status po-${normalizeText(order.status === 'Pending' ? 'Draft' : order.status).replaceAll(' ', '-')}`}>{order.status === 'Pending' ? 'Draft' : order.status}</span></td>
          </tr>)}
          {!recentOrders.length && <tr><td colSpan="5"><EmptyState message="No purchase orders have been recorded yet." /></td></tr>}
        </tbody></table></div>
      </section>
      </>}
    </section>
  </section>
}

function DashboardNavigationTiles({
  onProducts,
  onStock,
  onPurchaseOrders,
  onCategories,
  onSuppliers,
  onNotifications,
  onReports,
}) {
  const tiles = [
    { label: 'Products', icon: '▦', color: 'purple', onClick: onProducts },
    { label: 'Stock Management', icon: '⇄', color: 'blue', onClick: onStock },
    { label: 'Purchase Orders', icon: '▣', color: 'orange', onClick: onPurchaseOrders },
    { label: 'Categories', icon: '▧', color: 'teal', onClick: onCategories },
    { label: 'Suppliers', icon: '♧', color: 'green', onClick: onSuppliers },
    { label: 'Notifications', icon: '!', color: 'red', onClick: onNotifications },
    { label: 'Reports & Analytics', icon: '▤', color: 'indigo', onClick: onReports },
    { label: 'Inventory Overview', icon: '◫', color: 'navy', onClick: () => {
      document.getElementById('dashboard-inventory-overview')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    } },
  ]

  return <div className="dashboard-navigation-tiles">
    {tiles.map((tile) => (
      <button className="dashboard-navigation-tile" type="button" key={tile.label} onClick={tile.onClick}>
        <span className={`dashboard-navigation-icon ${tile.color}`} aria-hidden="true">{tile.icon}</span>
        <span className="dashboard-navigation-label">{tile.label}</span>
      </button>
    ))}
  </div>
}

function StockDistributionChart({ counts }) {
  const validCount = counts.inStock + counts.low + counts.out
  const segments = [
    { label: 'In stock', count: counts.inStock, color: '#1c9a70' },
    { label: 'Low stock', count: counts.low, color: '#d98225' },
    { label: 'Out of stock', count: counts.out, color: '#d04444' },
  ]
  return <div className="stock-distribution">
    {validCount
      ? <div className="stock-distribution-bar" role="img" aria-label={`${counts.inStock} in stock, ${counts.low} low stock, ${counts.out} out of stock`}>
        {segments.map((segment) => {
          const width = segment.count / validCount * 100
          const element = <span key={segment.label} title={`${segment.label}: ${segment.count}`} style={{ width: `${width}%`, backgroundColor: segment.color }} />
          return element
        })}
      </div>
      : <EmptyState message="No products have valid quantity and reorder-level data." />}
    <div className="stock-distribution-legend">
      {segments.map((segment) => <div key={segment.label}><span><i style={{ backgroundColor: segment.color }} />{segment.label}</span><strong>{segment.count}</strong></div>)}
      {counts.unknown > 0 && <div><span><i className="stock-unknown-legend" />Unknown data</span><strong>{counts.unknown}</strong></div>}
    </div>
    <p className="stock-distribution-note">{validCount.toLocaleString()} of {validCount + counts.unknown} products classified</p>
  </div>
}

function NotificationsPage({
  products,
  allProducts,
  orders,
  movements,
  suppliers,
  notificationPreferences,
  reorderQuantities,
  setReorderQuantities,
  reorderSuppliers,
  setReorderSuppliers,
  storageError,
  onClearStorageError,
  onProduct,
  onOrder,
  onStockMovement,
  onCreateOrder,
}) {
  const [recommendationErrors, setRecommendationErrors] = useState({})
  const [initialNotificationStore] = useState(() => {
    try {
      return { state: readNotificationState(), error: '' }
    } catch (error) {
      return {
        state: { notifications: [], deletedIds: [] },
        error: error instanceof Error ? error.message : 'Unable to load saved notification preferences.',
      }
    }
  })
  const [notificationState, setNotificationState] = useState(initialNotificationStore.state)
  const [filter, setFilter] = useState('all')
  const [localStorageError, setLocalStorageError] = useState(initialNotificationStore.error)
  const getSupplier = (product) => suppliers.find((supplier) => normalizeText(supplier.name) === normalizeText(product.supplier))
  const getQuantity = (product) => reorderQuantities[product.id] ?? getSuggestedReorderQuantity(product)
  const getSupplierId = (product) => reorderSuppliers[product.id] ?? String(getSupplier(product)?.id || '')
  const sourceNotifications = useMemo(
    () => buildSourceNotifications({ products: allProducts, movements, orders }),
    [allProducts, movements, orders]
  )
  const mergedNotificationState = mergeNotificationState(notificationState, sourceNotifications)
  const notifications = mergedNotificationState.notifications
    .filter((notification) => !mergedNotificationState.deletedIds.includes(notification.id))
    .filter((notification) => {
      if (notification.type === 'low-stock') return notificationPreferences.lowStock
      if (notification.type === 'out-of-stock') return notificationPreferences.outOfStock
      if (notification.type === 'stock-received' || notification.type === 'stock-issued') return notificationPreferences.stockMovements
      if (notification.type.startsWith('purchase-order-')) return notificationPreferences.purchaseOrders
      return true
    })
    .sort((first, second) => {
      const firstDate = Date.parse(first.timestamp || '')
      const secondDate = Date.parse(second.timestamp || '')
      return (Number.isNaN(secondDate) ? 0 : secondDate) - (Number.isNaN(firstDate) ? 0 : firstDate)
    })
  const unreadCount = notifications.filter((notification) => !notification.read).length
  const stockAlertCount = notifications.filter((notification) => (
    notification.type === 'low-stock' || notification.type === 'out-of-stock'
  )).length
  const visibleNotifications = notifications.filter((notification) => (
    filter === 'all' || (filter === 'unread' ? !notification.read : notification.read)
  ))

  useEffect(() => {
    function handleStorageError(event) {
      setLocalStorageError(event.detail)
    }
    window.addEventListener('inventra-notification-storage-error', handleStorageError)
    return () => window.removeEventListener('inventra-notification-storage-error', handleStorageError)
  }, [])

  useEffect(() => {
    if (localStorageError) return
    try {
      const nextState = mergeNotificationState(notificationState, sourceNotifications)
      if (JSON.stringify(nextState) === JSON.stringify(notificationState)) return
      writeNotificationState(nextState)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to save notification history in this browser.'
      window.dispatchEvent(new CustomEvent('inventra-notification-storage-error', { detail: message }))
    }
  }, [localStorageError, notificationState, sourceNotifications])

  function saveState(nextState) {
    setNotificationState(nextState)
    try {
      writeNotificationState(nextState)
      setLocalStorageError('')
      onClearStorageError()
    } catch (error) {
      setLocalStorageError(error instanceof Error ? error.message : 'Unable to save notification preferences in this browser.')
    }
  }

  function markRead(notificationId) {
    saveState(markNotificationRead(mergedNotificationState, notificationId))
  }

  function markAllRead() {
    saveState(markAllNotificationsRead(mergedNotificationState))
  }

  function removeNotification(notificationId) {
    saveState(deleteNotification(mergedNotificationState, notificationId))
  }

  function openNotification(notification) {
    markRead(notification.id)
    const destination = notification.destination
    if (!destination) return
    if (destination.kind === 'product') {
      const product = allProducts.find((item) => Number(item.id) === Number(destination.id))
      if (product) onProduct(product)
    } else if (destination.kind === 'order') {
      const order = orders.find((item) => Number(item.id) === Number(destination.id))
      if (order) onOrder(order)
    } else if (destination.kind === 'stock') {
      onStockMovement(notification)
    }
  }

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
    <header className="notifications-heading">
      <div><h2>Inventory notifications</h2><p>Stock activity and purchase-order events from the current inventory data.</p></div>
      <span className="notification-count">{notifications.length} notification{notifications.length === 1 ? '' : 's'}</span>
    </header>
    {(storageError || localStorageError) && <p className="notification-storage-error" role="alert">{storageError || localStorageError}</p>}
    <section className="notification-summary">
      <article className="attention-card blue"><strong>{notifications.length}</strong><span>Total notifications</span></article>
      <article className="attention-card orange"><strong>{unreadCount}</strong><span>Unread</span></article>
      <article className="attention-card red"><strong>{stockAlertCount}</strong><span>Stock alerts</span></article>
    </section>
    <section className="table-card notification-card">
      <div className="table-heading notification-controls">
        <div><h2>Recent activity</h2><p>Read status and dismissed notifications are saved in this browser.</p></div>
        <button className="secondary-button" type="button" onClick={markAllRead} disabled={unreadCount === 0}>Mark All as Read</button>
      </div>
      <div className="notification-filters" aria-label="Filter notifications">
        {['all', 'unread', 'read'].map((option) => (
          <button
            type="button"
            className={`notification-filter${filter === option ? ' active' : ''}`}
            aria-pressed={filter === option}
            key={option}
            onClick={() => setFilter(option)}
          >
            {option === 'all' ? 'All' : option === 'unread' ? 'Unread' : 'Read'}
          </button>
        ))}
      </div>
      <div className="notification-list" aria-live="polite">
        {visibleNotifications.map((notification) => (
          <article className={`notification-entry${notification.read ? ' read' : ' unread'}`} key={notification.id}>
            <span className={`notification-type-icon ${notification.type}`} aria-hidden="true">
              {notification.icon}
            </span>
            <button className="notification-open" type="button" onClick={() => openNotification(notification)}>
              <span className="notification-title">{notification.title}{!notification.read && <span className="unread-dot" aria-label="Unread" />}</span>
              <span className="notification-message">{notification.message}</span>
              <time dateTime={notification.timestamp || undefined}>{notification.timestamp ? formatNotificationDate(notification.timestamp) : 'Date unavailable'}</time>
            </button>
            <div className="notification-actions">
              {!notification.read && <button className="notification-action" type="button" onClick={() => markRead(notification.id)} aria-label={`Mark as read: ${notification.title}`}>Mark read</button>}
              <button className="notification-delete" type="button" onClick={() => removeNotification(notification.id)} aria-label={`Delete notification: ${notification.title}`} title="Delete notification">×</button>
            </div>
          </article>
        ))}
        {visibleNotifications.length === 0 && (
          <EmptyState message={notifications.length === 0 ? 'There are no inventory notifications yet.' : `No ${filter} notifications.`} />
        )}
      </div>
    </section>
    <section className="table-card reorder-card"><div className="table-heading"><div><h2>Reorder recommendations</h2><p>Suggested quantities are a simple planning aid, not a demand forecast. Review before creating a draft.</p></div></div><div className="table-scroll"><table><thead><tr><th>PRODUCT</th><th>SKU</th><th>CATEGORY</th><th>CURRENT</th><th>THRESHOLD</th><th>SUGGESTED QTY</th><th>SUPPLIER</th><th>STATUS</th><th>ACTION</th></tr></thead><tbody>{products.map((product) => { const supplier = getSupplier(product); const supplierId = getSupplierId(product); return <tr key={product.id}><td className="product-name">{product.name}</td><td>{product.sku}</td><td>{product.category}</td><td>{product.quantity}</td><td>{product.reorderThreshold}</td><td><input className="recommendation-input" type="number" min="1" step="1" value={getQuantity(product)} onChange={(event) => updateQuantity(product, event.target.value)} aria-label={`Suggested reorder quantity for ${product.name}`} />{recommendationErrors[product.id] && <span className="field-error">{recommendationErrors[product.id]}</span>}</td><td><select className="recommendation-select" value={supplierId} onChange={(event) => setReorderSuppliers((current) => ({ ...current, [product.id]: event.target.value }))} aria-label={`Supplier for ${product.name}`}><option value="">Select supplier</option>{suppliers.map((option) => <option value={option.id} key={option.id}>{option.name}</option>)}</select>{supplier && <small className="field-helper">Existing: {supplier.name}</small>}</td><td><span className={`status ${getStockStatus(product)}`}>{getStockLabel(product)}</span></td><td><button className="table-action" type="button" onClick={() => startOrder(product)} disabled={!supplierId}>Create draft</button></td></tr> })}{products.length === 0 && <tr><td colSpan="9"><EmptyState message="No products need replenishment." /></td></tr>}</tbody></table></div></section>
  </section>
}

function StockManagement({ products, movementForm, setMovementForm, errors, submitting, onSubmit, movements }) {
  const [productSearch, setProductSearch] = useState('')
  const visibleProducts = filterProducts(products, { searchText: productSearch })
  const normalizedProductSearch = normalizeText(productSearch)

  function updateField(field, value) {
    setMovementForm((current) => ({ ...current, [field]: value }))
  }

  function updateProductSearch(value) {
    setProductSearch(value)
    const selectedProduct = products.find((product) => product.id === Number(movementForm.productId))
    if (selectedProduct && !normalizeText(`${selectedProduct.name ?? ''} ${selectedProduct.sku ?? ''}`).includes(normalizeText(value))) {
      updateField('productId', '')
    }
  }

  return (
    <section className="stock-page">
      <section className="form-card">
        <div className="section-heading"><div><h2>Record stock movement</h2><p>Use Stock In for received items and Stock Out for issued items.</p></div></div>
        {errors.form && <p className="field-error" role="alert">{errors.form}</p>}
        <form onSubmit={onSubmit} noValidate>
          <SelectField id="movement-type" label="Movement type" value={movementForm.type} onChange={(value) => updateField('type', value)} options={['Stock in', 'Stock out']} />
          <label htmlFor="movement-product">Product *<select id="movement-product" value={movementForm.productId} onChange={(event) => updateField('productId', event.target.value)} aria-invalid={Boolean(errors.productId)}><option value="">{visibleProducts.length === 0 && normalizedProductSearch ? 'No matching products' : 'Select a product'}</option>{visibleProducts.map((product) => <option value={product.id} key={product.id}>{product.name} ({product.sku}) · {product.quantity} available</option>)}</select>{errors.productId && <span className="field-error">{errors.productId}</span>}</label>
          <FormField id="movement-quantity" label="Quantity *" type="number" min="1" step="1" value={movementForm.quantity} onChange={(value) => updateField('quantity', value)} error={errors.quantity} placeholder="Enter whole units" />
          <FormField id="movement-reference" label="Reference / request number" value={movementForm.reference} onChange={(value) => updateField('reference', value)} placeholder="Optional reference" />
          <SelectField id="movement-department" label="Department" value={movementForm.department} onChange={(value) => updateField('department', value)} options={departments} />
          <div className="form-wide"><label htmlFor="movement-remarks">Remarks<textarea id="movement-remarks" rows="3" value={movementForm.remarks} onChange={(event) => updateField('remarks', event.target.value)} placeholder="Optional notes about this movement" /></label></div>
          <div className="form-actions"><button type="submit" className="primary-button" disabled={submitting}>{submitting ? 'Recording...' : `Record ${movementForm.type}`}</button></div>
        </form>
      </section>
      <section className="stock-product-tools" aria-label="Filter stock movement products">
        <div className="stock-product-picker">
          <label htmlFor="stock-product-search">Search products</label>
          <div className="stock-product-search-control">
            <input id="stock-product-search" className="search" value={productSearch} onChange={(event) => updateProductSearch(event.target.value)} placeholder="Search by name or SKU..." />
            {productSearch && <button className="stock-search-clear" type="button" aria-label="Clear product search" onClick={() => updateProductSearch('')}>×</button>}
          </div>
        </div>
        {visibleProducts.length === 0 && <p className="field-helper stock-product-empty" role="status">{normalizedProductSearch ? `No products match "${productSearch.trim()}".` : 'No products are available.'}</p>}
      </section>
      <MovementHistory movements={movements} />
    </section>
  )
}

function CategoryManagement({ categories, search, setSearch, form, setForm, errors, editingCategory, formRef, onSubmit, onEdit, onDelete, onCancel }) {
  return (
    <section className="category-page">
      <section className="form-card category-form-card" ref={formRef}>
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
  return <section className="table-card movement-history"><div className="table-heading"><div><h2>Stock movement history</h2><p>Persisted movements from the inventory database. Historical balances are shown only when provided by the database.</p></div></div><div className="table-scroll"><table><thead><tr><th>DATE / TIME</th><th>PRODUCT</th><th>SKU</th><th>TYPE</th><th>QUANTITY</th><th>PREVIOUS</th><th>RESULTING</th><th>REFERENCE / DEPARTMENT</th><th>REMARKS</th></tr></thead><tbody>{movements.map((movement) => <tr key={movement.id}><td>{formatMovementDate(movement.date)}</td><td className="product-name">{movement.productName}</td><td>{movement.sku}</td><td><span className={`movement-badge ${movement.type === 'Stock in' ? 'movement-in' : 'movement-out'}`}>{movement.type}</span></td><td>{movement.quantity}</td><td>{movement.previousQuantity ?? '—'}</td><td>{movement.resultingQuantity ?? '—'}</td><td>{movement.reference} · {movement.department}</td><td>{movement.remarks || '—'}</td></tr>)}{movements.length === 0 && <tr><td colSpan="9"><EmptyState message="No stock movements recorded yet." /></td></tr>}</tbody></table></div></section>
}

function formatMovementDate(date) {
  const parsedDate = parseDateSafely(date)
  return parsedDate ? parsedDate.toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : 'Unknown date'
}

function formatNotificationDate(date) {
  const parsedDate = parseDateSafely(date)
  return parsedDate ? parsedDate.toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : 'Date unavailable'
}

function StatCard({ icon, color, label, value, detail }) {
  return <article className="stat-card"><span className={`stat-icon ${color}`}>{icon}</span><p>{label}</p><h2>{value}</h2><small>{detail}</small></article>
}

function EmptyState({ message }) {
  return <div className="empty-state"><span>✓</span><p>{message}</p></div>
}

function Reports({ products, categories, suppliers, movements, orders, filters, setFilters, loading, dataError, onRefresh }) {
  const [refreshing, setRefreshing] = useState(false)
  const [refreshError, setRefreshError] = useState('')
  const safeProducts = products.filter(Boolean)
  const safeMovements = movements.filter(Boolean)
  const safeOrders = orders.filter(Boolean)
  const categoryNames = categories.map((category) => category?.name).filter(Boolean)
  const dateRange = getReportDateRange(filters.dateRange, filters.customStart, filters.customEnd)
  const inventory = calculateInventoryMetrics(safeProducts)
  const dateMovements = safeMovements.filter((movement) => isWithinReportDateRange(movement.date, dateRange))
  const productById = new Map(safeProducts.map((product) => [String(product.id), product]))
  const filteredMovements = dateMovements.filter((movement) => {
    const product = productById.get(String(movement.productId))
    return (filters.movementProduct === 'all' || String(movement.productId) === filters.movementProduct)
      && (filters.movementCategory === 'all' || product?.category === filters.movementCategory)
      && (filters.movementType === 'all' || movement.type === filters.movementType)
      && normalizeText(movement.reference).includes(normalizeText(filters.movementReference))
  })
  const dateOrders = safeOrders.filter((order) => isWithinReportDateRange(order.orderDate || order.createdAt, dateRange))
  const filteredOrders = dateOrders.filter((order) => (
    (filters.orderSupplier === 'all' || String(order.supplierId) === filters.orderSupplier)
    && (filters.orderStatus === 'all' || order.status === filters.orderStatus)
  ))
  const movementTotals = calculateMovementTotals(filteredMovements)
  movementTotals.net = movementTotals.stockIn - movementTotals.stockOut
  const movementSeries = buildMovementTimeSeries(filteredMovements, dateRange)
  const productMovementSummary = buildProductMovementSummary(filteredMovements, safeProducts)
  const purchaseOrders = calculatePurchaseOrderAnalytics(filteredOrders)
  const lowStockProducts = safeProducts.filter((product) => getReportStockStatus(product) === 'low')
  const outOfStockProducts = safeProducts.filter((product) => getReportStockStatus(product) === 'out')
  const requiringReorder = safeProducts
    .filter((product) => ['low', 'out'].includes(getReportStockStatus(product)))
    .sort((first, second) => (getValidProductQuantity(first) ?? 0) - (getValidProductQuantity(second) ?? 0))
  const highestValueProducts = [...safeProducts]
    .filter((product) => getProductInventoryValue(product) !== null)
    .sort((first, second) => getProductInventoryValue(second) - getProductInventoryValue(first))
    .slice(0, 10)
  const highestQuantityProducts = [...safeProducts]
    .filter((product) => getValidProductQuantity(product) !== null)
    .sort((first, second) => getValidProductQuantity(second) - getValidProductQuantity(first))
    .slice(0, 10)
  const recentlyMovedProducts = [...productMovementSummary]
    .sort((first, second) => new Date(second.latestMovement || 0) - new Date(first.latestMovement || 0))
    .slice(0, 10)
  const orderStatuses = ['Draft', 'Ordered', 'Partially Received', 'Received', 'Cancelled']
  const maxOrderCount = Math.max(...orderStatuses.map((status) => purchaseOrders.statusCounts[status]), 1)
  const rangeLabel = dateRange.valid ? `${dateRange.start} – ${dateRange.end}` : 'Choose a valid custom date range'

  function updateFilter(field, value) {
    setFilters((current) => ({ ...current, [field]: value }))
  }

  function clearReportFilters() {
    setFilters(emptyReportFilters)
  }

  async function refreshReports() {
    setRefreshing(true)
    setRefreshError('')
    try {
      await onRefresh()
    } catch (error) {
      setRefreshError(error instanceof Error ? error.message : 'Unable to refresh reports.')
    } finally {
      setRefreshing(false)
    }
  }

  function exportInventory() {
    downloadCsv(
      'inventra-inventory-report.csv',
      ['Product', 'SKU', 'Category', 'Quantity', 'Reorder level', 'Unit price (BDT)', 'Estimated value (BDT)', 'Status'],
      safeProducts.map((product) => [
        { value: product.name }, { value: product.sku }, { value: product.category },
        { value: getValidProductQuantity(product), numeric: true },
        { value: product.reorderThreshold ?? product.reorder_level, numeric: true },
        { value: product.price, numeric: true },
        { value: getProductInventoryValue(product), numeric: true },
        { value: getStockLabel(product) },
      ])
    )
  }

  function exportMovements() {
    downloadCsv(
      'inventra-stock-movements-report.csv',
      ['Date', 'Product', 'SKU', 'Type', 'Quantity', 'Previous quantity', 'Resulting quantity', 'Reference', 'Department', 'Remarks'],
      filteredMovements.map((movement) => [
        { value: formatMovementDate(movement.date) }, { value: movement.productName }, { value: movement.sku },
        { value: movement.type }, { value: movement.quantity, numeric: true },
        { value: movement.previousQuantity, numeric: true }, { value: movement.resultingQuantity, numeric: true },
        { value: movement.reference }, { value: movement.department }, { value: movement.remarks },
      ])
    )
  }

  function exportOrders() {
    downloadCsv(
      'inventra-purchase-orders-report.csv',
      ['Order number', 'Supplier', 'Order date', 'Status', 'Ordered quantity', 'Received quantity', 'Outstanding quantity', 'Total order value (BDT)', 'Non-cancelled order value (BDT)'],
      filteredOrders.map((order) => {
        const summary = calculatePurchaseOrderAnalytics([order])
        return [
          { value: order.orderNumber }, { value: order.supplierName }, { value: formatDate(order.orderDate) },
          { value: order.status }, { value: summary.orderedQuantity, numeric: true },
          { value: summary.receivedQuantity, numeric: true }, { value: summary.outstandingQuantity, numeric: true },
          { value: summary.orderValue, numeric: true },
          { value: summary.nonCancelledOrderValue, numeric: true },
        ]
      })
    )
  }

  function productRows(list, valueGetter) {
    return list.map((product) => [
      product.name, product.sku || '—', getValidProductQuantity(product) ?? '—',
      product.reorderThreshold ?? product.reorder_level ?? '—',
      valueGetter ? valueGetter(product) : getStockLabel(product),
    ])
  }

  return <section className="reports-page">
    <header className="reports-header">
      <div><p>Inventory balances are current snapshots. Movement and purchase-order activity follows the selected date range.</p></div>
      <div className="report-actions">
        <button className="secondary-button" type="button" onClick={() => window.print()}>Print reports</button>
        <button className="secondary-button" type="button" onClick={refreshReports} disabled={loading || refreshing}>{refreshing || loading ? 'Refreshing…' : 'Refresh reports'}</button>
        <button className="primary-button" type="button" onClick={exportInventory}>Export inventory CSV</button>
      </div>
    </header>
    {loading && <div className="reports-loading" role="status">Loading report data from the backend…</div>}
    {(dataError || refreshError) && <div className="error-message report-error" role="alert">{refreshError || dataError}</div>}
    <section className="table-card report-card report-range-card">
      <div className="report-range-controls">
        <label>Date range
          <select value={filters.dateRange} onChange={(event) => updateFilter('dateRange', event.target.value)}>
            <option value="today">Today</option>
            <option value="last-7-days">Last 7 Days</option>
            <option value="last-30-days">Last 30 Days</option>
            <option value="this-month">This Month</option>
            <option value="this-year">This Year</option>
            <option value="custom">Custom Range</option>
          </select>
        </label>
        {filters.dateRange === 'custom' && <>
          <label>From<input type="date" value={filters.customStart} max={filters.customEnd || undefined} onChange={(event) => updateFilter('customStart', event.target.value)} /></label>
          <label>To<input type="date" value={filters.customEnd} min={filters.customStart || undefined} onChange={(event) => updateFilter('customEnd', event.target.value)} /></label>
        </>}
        <span className="report-range-caption">Activity dates: {rangeLabel}</span>
      </div>
      {filters.dateRange === 'custom' && !dateRange.valid && <p className="report-range-error" role="status">Select a start and end date; the start must not be after the end.</p>}
    </section>

    <section className="stats report-stats" aria-label="Current inventory summary">
      <StatCard icon="▦" color="purple" label="Total Products" value={inventory.productCount} detail="Current product records" />
      <StatCard icon="▤" color="blue" label="Total Inventory Quantity" value={inventory.totalQuantity.toLocaleString()} detail="Valid current quantities" />
      <StatCard icon="৳" color="green" label="Inventory Value" value={formatCurrency(inventory.totalValue)} detail="Quantity × unit price" />
      <StatCard icon="!" color="orange" label="Low Stock Products" value={inventory.lowStockCount} detail="Above zero, at/below reorder level" />
      <StatCard icon="×" color="red" label="Out of Stock Products" value={inventory.outOfStockCount} detail="Quantity exactly zero" />
      <StatCard icon="↻" color="purple" label="Requiring Reorder" value={inventory.reorderCount} detail="Low stock plus out of stock" />
    </section>

    <section className="table-card report-card">
      <div className="table-heading"><div><h2>Stock movement analytics</h2><p>Transaction quantities are movements during {rangeLabel}; they are not current product balances.</p></div><button className="secondary-button" type="button" onClick={exportMovements}>Export filtered CSV</button></div>
      <section className="stats report-substats" aria-label="Stock movement totals">
        <StatCard icon="↓" color="green" label="Stock In Quantity" value={movementTotals.stockIn.toLocaleString()} detail="Units received in selected range" />
        <StatCard icon="↑" color="blue" label="Stock Out Quantity" value={movementTotals.stockOut.toLocaleString()} detail="Units issued in selected range" />
        <StatCard icon="±" color="purple" label="Net Stock Movement" value={movementTotals.net.toLocaleString()} detail="Stock in minus stock out" />
      </section>
      <div className="report-filters">
        <label>Product<select value={filters.movementProduct} onChange={(event) => updateFilter('movementProduct', event.target.value)}><option value="all">All products</option>{safeProducts.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}</select></label>
        <label>Category<select value={filters.movementCategory} onChange={(event) => updateFilter('movementCategory', event.target.value)}><option value="all">All categories</option>{categoryNames.map((name) => <option key={name}>{name}</option>)}</select></label>
        <label>Movement type<select value={filters.movementType} onChange={(event) => updateFilter('movementType', event.target.value)}><option value="all">All types</option><option>Stock in</option><option>Stock out</option></select></label>
        <label>Reference<input value={filters.movementReference} onChange={(event) => updateFilter('movementReference', event.target.value)} placeholder="Search reference" /></label>
      </div>
      <div className="report-chart-wrap">
        <div className="report-section-heading"><h3>Stock in vs stock out over time</h3><span>Grouped by {movementSeries.interval}</span></div>
        {filteredMovements.length && movementSeries.buckets.length
          ? <MovementChart buckets={movementSeries.buckets} />
          : <EmptyState message="No stock movements match this date range and filter selection." />}
      </div>
      <div className="report-section-heading report-table-heading"><h3>Recent stock movements</h3><span>{filteredMovements.length} movement record(s)</span></div>
      <ReportTable
        className="movement-report-table"
        headers={['DATE / TIME', 'PRODUCT', 'SKU', 'TYPE', 'MOVED QTY', 'PREVIOUS BALANCE', 'RESULTING BALANCE', 'REFERENCE']}
        rows={[...filteredMovements].sort((first, second) => new Date(second.date) - new Date(first.date)).slice(0, 10).map((movement) => [
          formatMovementDate(movement.date), movement.productName || 'Unknown product', movement.sku || '—',
          movement.type, movement.quantity,
          movement.previousQuantity ?? 'Not recorded', movement.resultingQuantity ?? 'Not recorded',
          movement.reference || 'Not specified',
        ])}
        emptyMessage="No stock movements match the selected range."
      />
      <div className="report-section-heading report-table-heading"><h3>Product-wise movement summary</h3><button className="secondary-button" type="button" onClick={() => downloadCsv(
        'inventra-product-movement-summary.csv',
        ['Product', 'SKU', 'Stock in quantity', 'Stock out quantity', 'Net movement', 'Latest movement'],
        productMovementSummary.map((row) => [row.name, row.sku, row.stockIn, row.stockOut, row.net, formatMovementDate(row.latestMovement)])
      )}>Export summary CSV</button></div>
      <ReportTable
        headers={['PRODUCT', 'SKU', 'STOCK IN', 'STOCK OUT', 'NET MOVEMENT', 'LATEST MOVEMENT']}
        rows={productMovementSummary.map((row) => [row.name, row.sku, row.stockIn, row.stockOut, row.net, formatMovementDate(row.latestMovement)])}
        emptyMessage="No product movement totals are available for this range."
      />
    </section>

    <section className="table-card report-card">
      <div className="table-heading"><div><h2>Purchase order analytics</h2><p>Order values use item quantity × unit cost. Cancelled orders are excluded from value, received, and outstanding quantity totals.</p></div><button className="secondary-button" type="button" onClick={exportOrders}>Export filtered CSV</button></div>
      <section className="stats report-substats report-po-stats" aria-label="Purchase order totals">
        <StatCard icon="▣" color="purple" label="Total Purchase Orders" value={purchaseOrders.count} detail="Selected range and filters" />
        <StatCard icon="◌" color="orange" label="Draft" value={purchaseOrders.statusCounts.Draft} detail="Database Pending maps to Draft" />
        <StatCard icon="→" color="blue" label="Ordered" value={purchaseOrders.statusCounts.Ordered} detail="Placed and awaiting receipts" />
        <StatCard icon="◷" color="orange" label="Partially Received" value={purchaseOrders.statusCounts['Partially Received']} detail="Some items still outstanding" />
        <StatCard icon="✓" color="green" label="Fully Received" value={purchaseOrders.statusCounts.Received} detail="All ordered quantities received" />
        <StatCard icon="×" color="red" label="Cancelled" value={purchaseOrders.statusCounts.Cancelled} detail="Included in status count only" />
        <StatCard icon="৳" color="green" label="Total PO Value" value={formatCurrency(purchaseOrders.orderValue)} detail="All orders in the selected range" />
        <StatCard icon="৳" color="green" label="Non-cancelled PO Value" value={formatCurrency(purchaseOrders.nonCancelledOrderValue)} detail="Excludes cancelled orders" />
        <StatCard icon="▤" color="blue" label="Ordered / Received Qty" value={`${purchaseOrders.orderedQuantity.toLocaleString()} / ${purchaseOrders.receivedQuantity.toLocaleString()}`} detail="Non-cancelled order lines" />
        <StatCard icon="…" color="orange" label="Outstanding Quantity" value={purchaseOrders.outstandingQuantity.toLocaleString()} detail="Ordered minus received; non-cancelled" />
      </section>
      <div className="report-filters">
        <label>Supplier<select value={filters.orderSupplier} onChange={(event) => updateFilter('orderSupplier', event.target.value)}><option value="all">All suppliers</option>{suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</select></label>
        <label>Status<select value={filters.orderStatus} onChange={(event) => updateFilter('orderStatus', event.target.value)}><option value="all">All statuses</option>{orderStatuses.map((status) => <option key={status}>{status}</option>)}</select></label>
        <button className="secondary-button" type="button" onClick={clearReportFilters}>Reset all report filters</button>
      </div>
      <div className="report-grid report-chart-grid">
        <article className="report-chart-wrap">
          <div className="report-section-heading"><h3>Purchase order status distribution</h3><span>Current status in selected range</span></div>
          {purchaseOrders.count
            ? <div className="report-bars">{orderStatuses.map((status) => <div className="report-bar-group" key={status}><div><strong>{status}</strong><small>{purchaseOrders.statusCounts[status]} order(s)</small></div><div className="bar-track"><span style={{ width: `${purchaseOrders.statusCounts[status] / maxOrderCount * 100}%` }} /></div></div>)}</div>
            : <EmptyState message="No purchase orders match this range and filter selection." />}
        </article>
        <article className="report-chart-wrap">
          <div className="report-section-heading"><h3>Supplier-wise purchase orders</h3><span>Order line values; cancelled excluded from value</span></div>
          <ReportTable
            headers={['SUPPLIER', 'ORDERS', 'CANCELLED', 'TOTAL PO VALUE', 'ACTIVE PO VALUE', 'ORDERED QTY', 'RECEIVED QTY', 'OUTSTANDING']}
            rows={purchaseOrders.suppliers.map((supplier) => [
              supplier.name, supplier.orderCount, supplier.cancelledCount, formatCurrency(supplier.orderValue), formatCurrency(supplier.nonCancelledOrderValue),
              supplier.orderedQuantity, supplier.receivedQuantity, supplier.outstandingQuantity,
            ])}
            emptyMessage="No supplier purchase-order data is available."
          />
        </article>
      </div>
      <ReportTable
        headers={['ORDER NUMBER', 'SUPPLIER', 'ORDER DATE', 'STATUS', 'ORDERED QTY', 'RECEIVED QTY', 'OUTSTANDING', 'ORDER VALUE']}
        rows={filteredOrders.map((order) => {
          const summary = calculatePurchaseOrderAnalytics([order])
          return [
            order.orderNumber, order.supplierName, formatDate(order.orderDate), order.status,
            summary.orderedQuantity, summary.receivedQuantity, summary.outstandingQuantity, formatCurrency(summary.orderValue),
          ]
        })}
        emptyMessage="No purchase orders match the selected range and filters."
      />
    </section>

    <section className="report-grid report-insights-grid">
      <ProductInsightTable
        title="Low-stock products"
        description="Quantity is above zero and at or below reorder level."
        valueHeading="STATUS"
        rows={productRows(lowStockProducts)}
        emptyMessage="No products are currently low on stock."
        exportName="inventra-low-stock-products.csv"
      />
      <ProductInsightTable
        title="Out-of-stock products"
        description="Current quantity is exactly zero."
        valueHeading="STATUS"
        rows={productRows(outOfStockProducts)}
        emptyMessage="No products are currently out of stock."
        exportName="inventra-out-of-stock-products.csv"
      />
      <ProductInsightTable
        title="Products requiring reorder"
        description={`${requiringReorder.length} low or out-of-stock product(s).`}
        valueHeading="STATUS"
        rows={productRows(requiringReorder)}
        emptyMessage="No products currently require reorder."
        exportName="inventra-products-requiring-reorder.csv"
      />
      <ProductInsightTable
        title="Highest-value inventory"
        description="Current quantity multiplied by listed unit price."
        valueHeading="INVENTORY VALUE"
        rows={productRows(highestValueProducts, (product) => formatCurrency(getProductInventoryValue(product)))}
        emptyMessage="No products have valid quantity and unit-price data."
        exportName="inventra-highest-value-products.csv"
      />
      <ProductInsightTable
        title="Highest stock quantities"
        description="Largest current product balances."
        valueHeading="STATUS"
        rows={productRows(highestQuantityProducts)}
        emptyMessage="No valid product quantities are available."
        exportName="inventra-highest-stock-quantities.csv"
        exportName="inventra-highest-quantity-products.csv"
      />
      <article className="table-card report-card">
        <div className="table-heading"><div><h2>Products with recent movement</h2><p>Movement totals in the selected date range.</p></div><button className="secondary-button" type="button" onClick={() => downloadCsv(
          'inventra-products-with-recent-movement.csv',
          ['Product', 'SKU', 'Current quantity', 'Reorder level', 'Stock in', 'Stock out', 'Net movement', 'Latest movement'],
          recentlyMovedProducts.map((row) => {
            const product = productById.get(row.id)
            return [row.name, row.sku, getValidProductQuantity(product || {}) ?? '', product?.reorderThreshold ?? '', row.stockIn, row.stockOut, row.net, formatMovementDate(row.latestMovement)]
          })
        )}>Export CSV</button></div>
        <ReportTable
          headers={['PRODUCT', 'SKU', 'CURRENT QTY', 'REORDER LEVEL', 'STOCK IN', 'STOCK OUT', 'NET', 'LATEST']}
          rows={recentlyMovedProducts.map((row) => {
            const product = productById.get(row.id)
            return [
              row.name, row.sku, getValidProductQuantity(product || {}) ?? '—',
              product?.reorderThreshold ?? product?.reorder_level ?? '—',
              row.stockIn, row.stockOut, row.net, formatMovementDate(row.latestMovement),
            ]
          })}
          emptyMessage="No products have movement in this date range."
        />
      </article>
    </section>
  </section>
}

function ProductInsightTable({ title, description, valueHeading, rows, emptyMessage, exportName = '' }) {
  function exportRows() {
    if (!exportName) return
    downloadCsv(exportName, ['Product', 'SKU', 'Current quantity', 'Reorder level', valueHeading], rows)
  }
  return <article className="table-card report-card">
    <div className="table-heading">
      <div><h2>{title}</h2><p>{description}</p></div>
      {exportName && <button className="secondary-button" type="button" onClick={exportRows}>Export CSV</button>}
    </div>
    <ReportTable
      headers={['PRODUCT', 'SKU', 'CURRENT QTY', 'REORDER LEVEL', valueHeading]}
      rows={rows}
      emptyMessage={emptyMessage}
    />
  </article>
}

function MovementChart({ buckets }) {
  const width = 900
  const height = 280
  const left = 44
  const right = 18
  const top = 18
  const bottom = 42
  const chartWidth = width - left - right
  const chartHeight = height - top - bottom
  const maximum = Math.max(...buckets.flatMap((bucket) => [bucket.stockIn, bucket.stockOut]), 1)
  const pointX = (index) => buckets.length === 1
    ? left + chartWidth / 2
    : left + index * chartWidth / (buckets.length - 1)
  const pointY = (value) => top + chartHeight - (value / maximum) * chartHeight
  const stockInPoints = buckets.map((bucket, index) => `${pointX(index)},${pointY(bucket.stockIn)}`).join(' ')
  const stockOutPoints = buckets.map((bucket, index) => `${pointX(index)},${pointY(bucket.stockOut)}`).join(' ')
  const labelStep = Math.max(1, Math.ceil(buckets.length / 7))
  return <div className="movement-chart-scroll">
    <svg className="movement-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Stock-in and stock-out quantity over time">
      {[0, 0.25, 0.5, 0.75, 1].map((fraction) => {
        const y = top + chartHeight * fraction
        return <g key={fraction}><line x1={left} x2={width - right} y1={y} y2={y} className="chart-grid-line" /><text x={left - 8} y={y + 4} textAnchor="end" className="chart-axis-label">{Math.round(maximum * (1 - fraction))}</text></g>
      })}
      <polyline points={stockInPoints} className="movement-line stock-in-line" />
      <polyline points={stockOutPoints} className="movement-line stock-out-line" />
      {buckets.map((bucket, index) => <g key={bucket.key}>
        <circle cx={pointX(index)} cy={pointY(bucket.stockIn)} r="3.5" className="movement-point stock-in-point"><title>{`${bucket.label}: ${bucket.stockIn} units in`}</title></circle>
        <circle cx={pointX(index)} cy={pointY(bucket.stockOut)} r="3.5" className="movement-point stock-out-point"><title>{`${bucket.label}: ${bucket.stockOut} units out`}</title></circle>
        {(index % labelStep === 0 || index === buckets.length - 1) && <text x={pointX(index)} y={height - 13} textAnchor="middle" className="chart-axis-label">{bucket.label}</text>}
      </g>)}
    </svg>
    <div className="movement-chart-legend"><span><i className="stock-in-legend" />Stock in</span><span><i className="stock-out-legend" />Stock out</span></div>
  </div>
}

function ReportTable({ headers, rows, emptyMessage, className = '' }) {
  return <div className={`table-scroll ${className}`}><table><thead><tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={index}>{row.map((cell, cellIndex) => <td className={cellIndex === 0 ? 'product-name' : ''} key={cellIndex}>{cell}</td>)}</tr>)}{rows.length === 0 && <tr><td colSpan={headers.length}><EmptyState message={emptyMessage} /></td></tr>}</tbody></table></div>
}

function PurchaseOrderManagement({ orders, allOrders, products, suppliers, search, setSearch, statusFilter, setStatusFilter, form, setForm, errors, editingOrder, selectedOrder, showForm, formRef, detailsRef, receiveForm, setReceiveForm, receiveErrors, receiveSubmitting, onAdd, onEdit, onSelect, onSubmit, onCancel, onPlace, onCancelOrder, onReceive, onReceiveSubmit, onReceiveCancel }) {
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
      {showForm && <PurchaseOrderForm products={products} suppliers={suppliers} form={form} setForm={setForm} errors={errors} editingOrder={editingOrder} formRef={formRef} onSubmit={onSubmit} onCancel={onCancel} />}
      {receiveForm && <ReceiveItemsForm receiveForm={receiveForm} setReceiveForm={setReceiveForm} errors={receiveErrors} submitting={receiveSubmitting} onSubmit={onReceiveSubmit} onCancel={onReceiveCancel} />}
      {selectedOrder && <PurchaseOrderDetails order={selectedOrder} detailsRef={detailsRef} onClose={() => onSelect(null)} onEdit={() => onEdit(selectedOrder)} onPlace={() => onPlace(selectedOrder)} onCancelOrder={() => onCancelOrder(selectedOrder)} onReceive={() => onReceive(selectedOrder)} />}
      <section className="table-card purchase-order-list-card">
        <div className="table-heading"><div><h2>Purchase orders</h2><p>Temporary demonstration records reset on refresh.</p></div><div className="po-heading-actions"><input className="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search order or supplier..." aria-label="Search purchase orders" /><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label="Filter purchase orders by status"><option value="all">All statuses</option>{['Draft', 'Ordered', 'Partially Received', 'Received', 'Cancelled'].map((status) => <option key={status}>{status}</option>)}</select><button className="primary-button" onClick={onAdd}>+ New Order</button></div></div>
        <div className="table-scroll"><table><thead><tr><th>ORDER NUMBER</th><th>SUPPLIER</th><th>ORDER DATE</th><th>EXPECTED</th><th>TOTAL</th><th>STATUS</th><th>ACTION</th></tr></thead><tbody>{orders.map((order) => <tr key={order.id}><td className="product-name">{order.orderNumber}</td><td className="long-cell">{order.supplierName}</td><td>{formatDate(order.orderDate)}</td><td>{order.expectedDelivery ? formatDate(order.expectedDelivery) : 'Not specified'}</td><td>{formatCurrency(getPurchaseOrderTotal(order))}</td><td><span className={`po-status po-${normalizeText(order.status).replaceAll(' ', '-')}`}>{order.status}</span></td><td><div className="table-actions"><button className="table-action" onClick={() => onSelect(order)}>View</button>{order.status === 'Draft' && <><button className="table-action" onClick={() => onEdit(order)}>Edit</button><button className="table-action" onClick={() => onPlace(order)}>Place</button><button className="delete-button" onClick={() => onCancelOrder(order)}>Cancel</button></>}{(order.status === 'Ordered' || order.status === 'Partially Received') && <button className="table-action" onClick={() => onReceive(order)}>Receive</button>}</div></td></tr>)}{orders.length === 0 && <tr><td colSpan="7"><EmptyState message="No purchase orders match your search or status filter." /></td></tr>}</tbody></table></div>
      </section>
    </section>
  )
}

function PurchaseOrderForm({ products, suppliers, form, setForm, errors, editingOrder, formRef, onSubmit, onCancel }) {
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
  return <section className="form-card purchase-order-form-card" ref={formRef}><div className="section-heading"><div><h2>{editingOrder ? `Edit ${editingOrder.orderNumber}` : 'Create purchase order'}</h2><p>{editingOrder ? 'Only draft orders can be edited.' : 'New orders start as drafts. No stock changes occur until receiving.'}</p></div></div>{errors.form && <p className="field-error form-message">{errors.form}</p>}<form onSubmit={onSubmit} noValidate>
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

function PurchaseOrderDetails({ order, detailsRef, onClose, onEdit, onPlace, onCancelOrder, onReceive }) {
  return <section className="details-card purchase-order-details" ref={detailsRef}><div className="details-header"><div><p className="eyebrow">PURCHASE ORDER DETAILS</p><h2>{order.orderNumber}</h2><span className={`po-status po-${normalizeText(order.status).replaceAll(' ', '-')}`}>{order.status}</span></div><button className="close-button" aria-label="Close purchase order details" onClick={onClose}>×</button></div><p className="po-detail-meta">Supplier: <strong>{order.supplierName}</strong> · Ordered {formatDate(order.orderDate)} · Expected {order.expectedDelivery ? formatDate(order.expectedDelivery) : 'Not specified'}</p><div className="table-scroll"><table><thead><tr><th>PRODUCT</th><th>SKU</th><th>ORDERED</th><th>RECEIVED</th><th>OUTSTANDING</th><th>UNIT COST</th><th>LINE TOTAL</th></tr></thead><tbody>{order.lines.map((line) => <tr key={line.productId}><td className="product-name">{line.productName}</td><td>{line.sku}</td><td>{line.orderedQuantity}</td><td>{line.receivedQuantity}</td><td>{line.orderedQuantity - line.receivedQuantity}</td><td>{formatCurrency(line.unitCost)}</td><td>{formatCurrency(line.lineTotal)}</td></tr>)}</tbody></table></div><p className="po-total">Order total: <strong>{formatCurrency(getPurchaseOrderTotal(order))}</strong></p><p className="details-description">{order.notes || 'No notes provided.'}</p>{order.receivingHistory.length > 0 && <div className="po-history"><strong>Receiving history</strong>{order.receivingHistory.map((receipt) => <small key={receipt.id}>{formatMovementDate(receipt.date)} · {receipt.totalQuantity} unit(s) received</small>)}</div>}<div className="details-actions">{order.status === 'Draft' && <><button className="secondary-button" onClick={onCancelOrder}>Cancel order</button><button className="secondary-button" onClick={onEdit}>Edit order</button><button className="primary-button" onClick={onPlace}>Place order</button></>}{(order.status === 'Ordered' || order.status === 'Partially Received') && <button className="primary-button" onClick={onReceive}>Receive items</button>}</div></section>
}

function SupplierManagement({ suppliers, products, categories, search, setSearch, form, setForm, errors, loading, loadError, editingSupplier, selectedSupplier, formRef, detailsRef, onSelect, showForm, onAdd, onEdit, onDelete, onSubmit, onCancel }) {
  const selectedProductCount = selectedSupplier
    ? products.filter((product) => normalizeText(product.supplier) === normalizeText(selectedSupplier.name)).length
    : 0
  return (
    <section className="supplier-page">
      {showForm && <SupplierForm categories={categories} form={form} setForm={setForm} errors={errors} editingSupplier={editingSupplier} formRef={formRef} onSubmit={onSubmit} onCancel={onCancel} />}
      {selectedSupplier && <SupplierDetails supplier={selectedSupplier} productCount={selectedProductCount} detailsRef={detailsRef} onClose={() => onSelect(null)} onEdit={() => onEdit(selectedSupplier)} onDelete={() => onDelete(selectedSupplier)} />}
      <section className="table-card supplier-list-card">
        <div className="table-heading"><div><h2>Supplier directory</h2><p>{suppliers.length} supplier{suppliers.length === 1 ? '' : 's'} available for inventory.</p></div><div className="supplier-heading-actions"><input className="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search suppliers..." aria-label="Search suppliers" /><button className="primary-button" onClick={onAdd}>+ Add Supplier</button></div></div>
        {loadError && <p className="field-error supplier-load-error" role="alert">Unable to load suppliers: {loadError}</p>}
        <div className="table-scroll"><table><thead><tr><th>SUPPLIER</th><th>CONTACT PERSON</th><th>PHONE</th><th>EMAIL</th><th>CATEGORIES</th><th>ACTION</th></tr></thead><tbody>{suppliers.map((supplier) => <tr key={supplier.id}><td className="product-name">{supplier.name}</td><td>{supplier.contactPerson || 'Not specified'}</td><td>{supplier.phone || 'Not specified'}</td><td className="long-cell">{supplier.email || 'Not specified'}</td><td className="category-description">{supplier.categories.length ? supplier.categories.join(', ') : 'Not specified'}</td><td><div className="table-actions"><button className="table-action" type="button" onClick={() => onSelect(supplier)}>View</button><button className="table-action" type="button" onClick={() => onEdit(supplier)}>Edit</button><button className="delete-button" type="button" onClick={() => onDelete(supplier)}>Delete</button></div></td></tr>)}{loading && suppliers.length === 0 && <tr><td colSpan="6"><p className="field-helper" role="status">Loading suppliers…</p></td></tr>}{!loading && suppliers.length === 0 && <tr><td colSpan="6"><EmptyState message={search.trim() ? 'No suppliers match your search.' : 'No suppliers are available.'} /></td></tr>}</tbody></table></div>
      </section>
    </section>
  )
}

function SupplierForm({ categories, form, setForm, errors, editingSupplier, formRef, onSubmit, onCancel }) {
  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
  }
  function toggleCategory(category) {
    const nextCategories = form.categories.includes(category)
      ? form.categories.filter((item) => item !== category)
      : [...form.categories, category]
    updateField('categories', nextCategories)
  }
  return <section className="form-card supplier-form-card" ref={formRef}><div className="section-heading"><div><h2>{editingSupplier ? 'Edit supplier' : 'Add supplier'}</h2><p>Supplier records are fictional demonstration data and reset on refresh.</p></div></div><form onSubmit={onSubmit} noValidate>
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

function SupplierDetails({ supplier, productCount, detailsRef, onClose, onEdit, onDelete }) {
  return <section className="details-card supplier-details" ref={detailsRef}><div className="details-header"><div><p className="eyebrow">SUPPLIER DETAILS</p><h2>{supplier.name}</h2></div><button className="close-button" aria-label="Close supplier details" onClick={onClose}>×</button></div><div className="details-grid supplier-details-grid"><DetailItem label="Contact person" value={supplier.contactPerson || 'Not specified'} /><DetailItem label="Phone" value={supplier.phone || 'Not specified'} /><DetailItem label="Email" value={supplier.email || 'Not specified'} /><DetailItem label="Categories" value={supplier.categories.length ? supplier.categories.join(', ') : 'Not specified'} /><DetailItem label="Created" value={formatDate(supplier.createdAt)} /><DetailItem label="Updated" value={formatDate(supplier.updatedAt)} /><DetailItem label="Assigned products" value={productCount} /><DetailItem label="Address" value={supplier.address || 'Not specified'} /><DetailItem label="Notes" value={supplier.notes || 'No notes provided.'} /></div><div className="details-actions"><button className="secondary-button" onClick={onDelete}>Delete supplier</button><button className="primary-button" onClick={onEdit}>Edit supplier</button></div></section>
}

function ProductFilters({ categories, suppliers, search, setSearch, categoryFilter, setCategoryFilter, supplierFilter, setSupplierFilter, sortBy, sortDirection, onSort, onClear }) {
  return (
    <section className="filters-card">
      <div className="filter-field search-field"><label htmlFor="product-search">Search products</label><input id="product-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by name or SKU..." /></div>
      <div className="filter-field"><label htmlFor="category-filter">Category</label><select id="category-filter" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}><option value="all">All categories</option>{categories.map((category) => <option key={category}>{category}</option>)}</select></div>
      <div className="filter-field"><label htmlFor="supplier-filter">Supplier</label><select id="supplier-filter" value={supplierFilter} onChange={(event) => setSupplierFilter(event.target.value)}><option value="all">All suppliers</option>{suppliers.map((supplier) => <option key={supplier} value={supplier}>{supplier}</option>)}</select></div>
      <div className="filter-field"><label htmlFor="sort-products">Sort by</label><select id="sort-products" value={sortBy} onChange={onSort}><option value="name">Name ({sortDirection === 'asc' ? 'A-Z' : 'Z-A'})</option><option value="quantity">Quantity ({sortDirection === 'asc' ? 'low-high' : 'high-low'})</option><option value="price">Unit price ({sortDirection === 'asc' ? 'low-high' : 'high-low'})</option><option value="category">Category ({sortDirection === 'asc' ? 'A-Z' : 'Z-A'})</option></select></div>
      <button
        className="clear-filter-button"
        type="button"
        aria-label="Clear Filter"
        title="Clear Filter"
        onClick={onClear}
      >
        ×
      </button>
    </section>
  )
}

function ProductForm({ categories, suppliers, form, setForm, errors, editingProduct, submitting, onSubmit, onCancel }) {
  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
  }
  return <section className="form-card"><div className="section-heading"><div><h2>{editingProduct ? 'Edit product' : 'Add a new product'}</h2><p>Fields marked with * are required.</p></div></div><form onSubmit={onSubmit} noValidate>
    <FormField id="name" label="Product name *" value={form.name} onChange={(value) => updateField('name', value)} error={errors.name} placeholder="e.g. Monitor" />
    <FormField id="sku" label="SKU (Unique Product Code) *" helper="Enter a unique code, for example IT-LAP-001. Each product must have a different SKU." value={form.sku} onChange={(value) => updateField('sku', value)} error={errors.sku} placeholder="e.g. IT-MON-001" />
    <FormField id="quantity" label={editingProduct ? 'Quantity *' : 'Initial quantity *'} type="number" min="0" step="1" value={form.quantity} onChange={(value) => updateField('quantity', value)} error={errors.quantity} placeholder="0" />
    <FormField id="reorderThreshold" label="Reorder threshold *" type="number" min="0" step="1" value={form.reorderThreshold} onChange={(value) => updateField('reorderThreshold', value)} error={errors.reorderThreshold} placeholder="e.g. 5" />
    <FormField id="price" label="Unit price (৳) *" type="number" min={editingProduct ? '0' : '0.01'} step="0.01" value={form.price} onChange={(value) => updateField('price', value)} error={errors.price} placeholder="0.00" />
    <label htmlFor="supplier">Supplier<select id="supplier" value={form.supplier} onChange={(event) => updateField('supplier', event.target.value)}><option value="">No supplier selected</option>{form.supplier && !suppliers.some((supplier) => supplier.name === form.supplier) && <option value={form.supplier}>{form.supplier} (existing value)</option>}{suppliers.map((supplier) => <option value={supplier.name} key={supplier.id}>{supplier.name}</option>)}</select>{suppliers.length === 0 && <span className="field-helper">Add a supplier from the Suppliers page before assigning one to a product.</span>}</label>
    <SelectField id="category" label="Category *" value={form.category} onChange={(value) => updateField('category', value)} options={categories} error={errors.category} />
    <SelectField id="condition" label="Condition" value={form.condition} onChange={(value) => updateField('condition', value)} options={conditions} />
    <SelectField id="department" label="Assigned department" value={form.department} onChange={(value) => updateField('department', value)} options={departments} />
    <FormField id="imageUrl" label="Image URL (optional)" value={form.imageUrl} onChange={(value) => updateField('imageUrl', value)} error={errors.imageUrl} placeholder="https://example.com/image.jpg" />
    <div className="form-wide"><label htmlFor="description">Description<textarea id="description" rows="3" value={form.description} onChange={(event) => updateField('description', event.target.value)} placeholder="Brief description of this item" /></label></div>
    {form.imageUrl.trim() && <div className="form-wide"><ImagePreview src={form.imageUrl} alt="Product preview" /></div>}
    <div className="form-actions"><button type="button" className="secondary-button" onClick={onCancel} disabled={submitting}>Cancel</button><button type="submit" className="primary-button" disabled={submitting}>{submitting ? 'Saving...' : editingProduct ? 'Update Product' : 'Save Product'}</button></div>
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
  return <section className={`table-card ${compact ? 'dashboard-products' : ''}`}>{!compact && <div className="table-heading"><div><h2>Product Inventory</h2><p>Showing {filteredProducts.length} of {products.length} products.</p></div></div>}<div className="table-scroll"><table><thead><tr><th>PRODUCT</th><th>IMAGE</th><th>SKU</th><th>CATEGORY</th><th>SUPPLIER</th><th>QUANTITY</th><th>UNIT PRICE</th><th>STATUS</th><th>ACTION</th></tr></thead><tbody>{filteredProducts.map((product) => <tr key={product.id}><td><button className="product-cell" onClick={() => onView(product)}><span className="product-name">{product.name}</span></button></td><td><ImagePreview src={product.imageUrl} alt={`${product.name} product`} /></td><td>{product.sku}</td><td>{product.category}</td><td className="long-cell">{product.supplier || 'Not specified'}</td><td>{product.quantity}</td><td>৳{product.price.toLocaleString('en-BD')}</td><td><span className={`status ${getStockStatus(product)}`}>{getStockLabel(product)}</span></td><td><div className="table-actions"><button className="table-action" onClick={() => onView(product)}>View</button>{!compact && <><button className="table-action" onClick={() => onEdit(product)}>Edit</button><button className="delete-button" onClick={() => onDelete(product)}>Delete</button></>}</div></td></tr>)}{filteredProducts.length === 0 && <tr><td colSpan="9"><EmptyState message="No products match your search or filters." /></td></tr>}</tbody></table></div>{!compact && <div className="table-footer">Use View to inspect product details or Edit to update a product.</div>}</section>
}
