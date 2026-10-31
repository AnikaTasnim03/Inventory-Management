import { useEffect, useState } from 'react'
import { getInventoryAudit } from './inventoryAuditService'
import './InventoryAuditPage.css'

const emptyFilters = { productId: '', movementType: '', userId: '', search: '', from: '', to: '' }

function formatAuditDate(value) {
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? 'Unknown date'
    : date.toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })
}

function formatQuantity(value) {
  return value > 0 ? `+${value}` : String(value)
}

export default function InventoryAuditPage({ products }) {
  const [filters, setFilters] = useState(emptyFilters)
  const [appliedFilters, setAppliedFilters] = useState(emptyFilters)
  const [records, setRecords] = useState([])
  const [selectedRecord, setSelectedRecord] = useState(null)
  const [pagination, setPagination] = useState({ limit: 50, offset: 0, total: 0, hasMore: false })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [refreshVersion, setRefreshVersion] = useState(0)

  useEffect(() => {
    let cancelled = false
    getInventoryAudit({
      ...appliedFilters,
      limit: pagination.limit,
      offset: pagination.offset,
    }).then((result) => {
      if (cancelled) return
      setRecords(result.items || [])
      setPagination((current) => ({ ...current, ...(result.pagination || {}) }))
      setSelectedRecord((selected) => selected
        ? (result.items || []).find((record) => record.id === selected.id) || selected
        : null)
    }).catch((requestError) => {
      if (cancelled) return
      setError(requestError instanceof Error ? requestError.message : 'Unable to load inventory audit records.')
      setRecords([])
      setPagination((current) => ({ ...current, total: 0, hasMore: false }))
    }).finally(() => {
      if (!cancelled) setLoading(false)
    })
    return () => { cancelled = true }
  }, [appliedFilters, pagination.limit, pagination.offset, refreshVersion])

  function applyFilters(event) {
    event.preventDefault()
    setLoading(true)
    setError('')
    setSelectedRecord(null)
    setPagination((current) => ({ ...current, offset: 0 }))
    setAppliedFilters({ ...filters })
    setRefreshVersion((value) => value + 1)
  }

  function resetFilters() {
    setLoading(true)
    setError('')
    setFilters(emptyFilters)
    setSelectedRecord(null)
    setPagination((current) => ({ ...current, offset: 0 }))
    setAppliedFilters(emptyFilters)
    setRefreshVersion((value) => value + 1)
  }

  function refreshRecords() {
    setLoading(true)
    setError('')
    setRefreshVersion((value) => value + 1)
  }

  function changePage(offset) {
    setLoading(true)
    setError('')
    setSelectedRecord(null)
    setPagination((current) => ({ ...current, offset }))
  }

  function updateFilter(field, value) {
    setFilters((current) => ({ ...current, [field]: value }))
  }

  const firstRecord = pagination.total === 0 ? 0 : pagination.offset + 1
  const lastRecord = Math.min(pagination.offset + records.length, pagination.total)

  return (
    <section className="inventory-audit-page">
      <header className="inventory-audit-header">
        <div>
          <h2>Inventory audit trail</h2>
          <p>Trace stock changes with their recorded balance, actor, and reason. Records begin after the audit migration; earlier history is not backfilled.</p>
        </div>
        <button className="secondary-button" type="button" onClick={refreshRecords} disabled={loading}>
          {loading ? 'Loading…' : error ? 'Retry' : 'Refresh'}
        </button>
      </header>

      <form className="inventory-audit-filters" onSubmit={applyFilters}>
        <label>Product
          <select value={filters.productId} onChange={(event) => updateFilter('productId', event.target.value)}>
            <option value="">All products</option>
            {products.map((product) => <option value={product.id} key={product.id}>{product.name} ({product.sku || 'No SKU'})</option>)}
          </select>
        </label>
        <label>Movement type
          <select value={filters.movementType} onChange={(event) => updateFilter('movementType', event.target.value)}>
            <option value="">All types</option>
            <option value="IN">Stock in</option>
            <option value="OUT">Stock out</option>
            <option value="ADJUSTMENT">Adjustment</option>
            <option value="RECEIPT">Purchase receipt</option>
          </select>
        </label>
        <label>User ID
          <input value={filters.userId} onChange={(event) => updateFilter('userId', event.target.value)} placeholder="Authenticated user UUID" />
        </label>
        <label>Search
          <input
            value={filters.search}
            onChange={(event) => updateFilter('search', event.target.value)}
            placeholder="Product, SKU, or reference"
            maxLength={100}
          />
        </label>
        <label>From
          <input type="date" value={filters.from} onChange={(event) => updateFilter('from', event.target.value)} />
        </label>
        <label>To
          <input type="date" value={filters.to} onChange={(event) => updateFilter('to', event.target.value)} />
        </label>
        <div className="inventory-audit-filter-actions">
          <button className="primary-button" type="submit">Apply filters</button>
          <button className="secondary-button" type="button" onClick={resetFilters}>Reset</button>
        </div>
      </form>

      {error && (
        <p className="inventory-audit-error" role="alert">
          Audit history is unavailable. {error} Verify the audit migration and database connection.
          Stock Management operations are not affected by this audit-page error.
        </p>
      )}

      {selectedRecord && (
        <section className="inventory-audit-detail" aria-label="Audit record details">
          <div className="inventory-audit-detail-heading">
            <div><h3>Audit record #{selectedRecord.id}</h3><p>{formatAuditDate(selectedRecord.date)}</p></div>
            <button type="button" className="secondary-button" onClick={() => setSelectedRecord(null)}>Close details</button>
          </div>
          <dl>
            <div><dt>Product</dt><dd>{selectedRecord.productName} · {selectedRecord.sku || 'No SKU'} (ID {selectedRecord.productId})</dd></div>
            <div><dt>Movement</dt><dd>{selectedRecord.movementType}</dd></div>
            <div><dt>Balance change</dt><dd>{selectedRecord.previousQuantity} {formatQuantity(selectedRecord.quantityChanged)} {selectedRecord.newQuantity}</dd></div>
            <div><dt>User ID</dt><dd>{selectedRecord.userId || 'Unknown historical actor'}</dd></div>
            <div><dt>Reason</dt><dd>{selectedRecord.reason}</dd></div>
            <div><dt>Reference</dt><dd>{selectedRecord.reference || '—'}</dd></div>
            <div><dt>Department</dt><dd>{selectedRecord.department || '—'}</dd></div>
            <div><dt>Purchase order</dt><dd>{selectedRecord.purchaseOrderId ?? '—'}</dd></div>
            <div><dt>Receipt</dt><dd>{selectedRecord.receiptId ?? '—'}</dd></div>
          </dl>
        </section>
      )}

      <section className="inventory-audit-table-card">
        <div className="inventory-audit-table-heading">
          <h3>Stock changes</h3>
          <span>{loading ? 'Loading records…' : `${firstRecord}–${lastRecord} of ${pagination.total}`}</span>
        </div>
        <div className="inventory-audit-table-scroll">
          <table>
            <thead><tr><th>DATE</th><th>PRODUCT</th><th>MOVEMENT</th><th>PREVIOUS</th><th>CHANGED</th><th>NEW</th><th>USER</th><th>REASON</th><th>REFERENCE</th><th>DETAILS</th></tr></thead>
            <tbody>
              {records.map((record) => (
                <tr key={record.id}>
                  <td>{formatAuditDate(record.date)}</td>
                  <td>{record.productName || 'Deleted product'}<small>{record.sku || '—'}</small></td>
                  <td>{record.movementType}</td>
                  <td>{record.previousQuantity}</td>
                  <td>{formatQuantity(record.quantityChanged)}</td>
                  <td>{record.newQuantity}</td>
                  <td title={record.userId || ''}>{record.userId ? `${record.userId.slice(0, 8)}…` : 'Unknown'}</td>
                  <td>{record.reason}</td>
                  <td>{record.reference || '—'}</td>
                  <td><button className="table-action" type="button" onClick={() => setSelectedRecord(record)}>View</button></td>
                </tr>
              ))}
              {!loading && records.length === 0 && <tr><td colSpan="10">{error ? 'Audit records could not be loaded.' : 'No audit records match these filters.'}</td></tr>}
            </tbody>
          </table>
        </div>
        <footer className="inventory-audit-pagination">
          <span>Page size {pagination.limit}</span>
          <div>
            <button className="secondary-button" type="button" onClick={() => changePage(Math.max(0, pagination.offset - pagination.limit))} disabled={loading || pagination.offset === 0}>Previous</button>
            <button className="secondary-button" type="button" onClick={() => changePage(pagination.offset + pagination.limit)} disabled={loading || !pagination.hasMore}>Next</button>
          </div>
        </footer>
      </section>
    </section>
  )
}
