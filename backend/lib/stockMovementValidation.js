const MOVEMENT_TYPES = new Set(["IN", "OUT", "ADJUSTMENT", "RECEIPT"]);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const AUDIT_SEARCH_PATTERN = /^[\p{L}\p{N} _.-]{1,100}$/u;
const MAX_QUANTITY = 2147483647;

function normalizeMovementType(value) {
  const normalized = typeof value === "string" ? value.trim().toUpperCase() : "";
  if (normalized === "STOCK IN") return "IN";
  if (normalized === "STOCK OUT") return "OUT";
  return normalized;
}

function validateOptionalText(value, field, maxLength) {
  if (value === undefined || value === null) return { value: null };
  if (typeof value !== "string") return { error: `${field} must be text.` };
  const normalized = value.trim();
  if (normalized.length > maxLength) return { error: `${field} must be ${maxLength} characters or fewer.` };
  return { value: normalized || null };
}

function validateStockMovementBody(body = {}) {
  const productId = Number(body.productId);
  const movementType = normalizeMovementType(body.type);
  const quantity = Number(body.quantity);
  if (!Number.isSafeInteger(productId) || productId <= 0) {
    return { error: "Product ID must be a positive integer." };
  }
  if (!["IN", "OUT", "ADJUSTMENT"].includes(movementType)) {
    return { error: "Movement type must be Stock in, Stock out, or Adjustment." };
  }
  if (
    !Number.isSafeInteger(quantity)
    || quantity === 0
    || Math.abs(quantity) > MAX_QUANTITY
    || (movementType !== "ADJUSTMENT" && quantity < 0)
  ) {
    return {
      error: movementType === "ADJUSTMENT"
        ? "Adjustment must be a non-zero whole-number change within the supported range."
        : "Movement quantity must be a positive whole number within the supported range.",
    };
  }
  const idempotencyKey = typeof body.idempotencyKey === "string" ? body.idempotencyKey.trim() : "";
  if (!idempotencyKey) return { error: "An idempotency key is required." };
  if (idempotencyKey.length > 200) return { error: "Idempotency key must be 200 characters or fewer." };

  const reference = validateOptionalText(body.reference, "Reference", 200);
  const department = validateOptionalText(body.department, "Department", 100);
  const remarks = validateOptionalText(body.remarks, "Remarks", 2000);
  const invalidField = [reference, department, remarks].find((field) => field.error);
  if (invalidField) return { error: invalidField.error };
  if (movementType === "ADJUSTMENT" && !remarks.value) {
    return { error: "A reason is required for stock adjustments." };
  }

  return {
    value: {
      productId,
      movementType,
      quantity,
      idempotencyKey,
      reference: reference.value,
      department: department.value,
      remarks: remarks.value,
    },
  };
}

function isValidDate(value) {
  if (typeof value !== "string" || !DATE_PATTERN.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function parseAuditFilters(query = {}) {
  const rawLimit = query.limit === undefined ? "50" : String(query.limit);
  const rawOffset = query.offset === undefined ? "0" : String(query.offset);
  if (!/^\d+$/.test(rawLimit) || Number(rawLimit) < 1 || Number(rawLimit) > 100) {
    return { error: "Limit must be an integer from 1 to 100." };
  }
  if (!/^\d+$/.test(rawOffset) || Number(rawOffset) > 1000000) {
    return { error: "Offset must be a non-negative integer no greater than 1000000." };
  }

  const filters = {
    limit: Number(rawLimit),
    offset: Number(rawOffset),
    productId: null,
    movementType: null,
    userId: null,
    search: null,
    from: null,
    to: null,
  };
  if (query.productId !== undefined && query.productId !== "") {
    const productId = Number(query.productId);
    if (!Number.isSafeInteger(productId) || productId <= 0) {
      return { error: "Product ID filter must be a positive integer." };
    }
    filters.productId = productId;
  }
  if (query.movementType !== undefined && query.movementType !== "") {
    const movementType = String(query.movementType).trim().toUpperCase();
    if (!MOVEMENT_TYPES.has(movementType)) return { error: "Movement type filter is not supported." };
    filters.movementType = movementType;
  }
  if (query.userId !== undefined && query.userId !== "") {
    const userId = String(query.userId).trim();
    if (!UUID_PATTERN.test(userId)) return { error: "User ID filter must be a valid UUID." };
    filters.userId = userId;
  }
  if (query.search !== undefined && query.search !== "") {
    const search = String(query.search).trim();
    if (search && !AUDIT_SEARCH_PATTERN.test(search)) {
      return { error: "Search must be 1-100 letters, numbers, spaces, periods, underscores, or hyphens." };
    }
    filters.search = search || null;
  }
  for (const field of ["from", "to"]) {
    if (query[field] !== undefined && query[field] !== "") {
      if (!isValidDate(String(query[field]))) return { error: `${field} must be a valid date in YYYY-MM-DD format.` };
      filters[field] = String(query[field]);
    }
  }
  if (filters.from && filters.to && filters.from > filters.to) {
    return { error: "Start date must not be after end date." };
  }
  return { value: filters };
}

module.exports = { parseAuditFilters, validateStockMovementBody };
