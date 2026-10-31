const express = require("express");
const supabase = require("../config/supabase");
const { parseAuditFilters, validateStockMovementBody } = require("../lib/stockMovementValidation");

const router = express.Router();

function parseNote(note) {
  const legacy = {
    reference: "Not specified",
    department: "Not specified",
    remarks: "",
    previousQuantity: null,
    resultingQuantity: null,
    movementType: null,
  };
  if (typeof note !== "string" || !note.trim()) return legacy;

  try {
    const parsed = JSON.parse(note);
    if (parsed?.format !== "inventra.stock-movement" || ![1, 2].includes(parsed?.version)) {
      return { ...legacy, remarks: note };
    }
    return {
      reference: typeof parsed.reference === "string" && parsed.reference ? parsed.reference : legacy.reference,
      department: typeof parsed.department === "string" && parsed.department ? parsed.department : legacy.department,
      remarks: typeof parsed.remarks === "string" ? parsed.remarks : "",
      previousQuantity: Number.isInteger(parsed.previousQuantity) ? parsed.previousQuantity : null,
      resultingQuantity: Number.isInteger(parsed.resultingQuantity) ? parsed.resultingQuantity : null,
      movementType: ["IN", "OUT", "ADJUSTMENT", "RECEIPT"].includes(parsed.movementType)
        ? parsed.movementType
        : null,
    };
  } catch {
    return { ...legacy, remarks: note };
  }
}

function mapMovement(row) {
  const note = parseNote(row.note);
  return {
    id: row.id,
    productId: row.product_id,
    productName: row.products?.name || "",
    sku: row.products?.sku || "",
    type: note.movementType === "ADJUSTMENT"
      ? "Adjustment"
      : row.movement_type === "IN" ? "Stock in" : row.movement_type === "OUT" ? "Stock out" : "Adjustment",
    quantity: row.quantity,
    date: row.created_at,
    ...note,
  };
}

function mapOperationResult(result) {
  if (
    typeof result.duplicate !== "boolean"
    || !Number.isInteger(result.movement_id)
    || !Number.isInteger(result.product_id)
    || !Number.isInteger(result.previous_quantity)
    || !Number.isInteger(result.resulting_quantity)
    || typeof result.reference !== "string"
    || typeof result.department !== "string"
    || typeof result.remarks !== "string"
  ) return null;

  return {
    duplicate: result.duplicate,
    movementId: result.movement_id,
    auditId: Number.isInteger(result.audit_id) ? result.audit_id : null,
    productId: result.product_id,
    reference: result.reference,
    department: result.department,
    remarks: result.remarks,
    previousQuantity: result.previous_quantity,
    resultingQuantity: result.resulting_quantity,
    quantityChanged: Number.isInteger(result.quantity_changed)
      ? result.quantity_changed
      : result.resulting_quantity - result.previous_quantity,
  };
}

function mapAuditRecord(row) {
  return {
    id: row.id,
    productId: row.product_id,
    productName: row.products?.name || "",
    sku: row.products?.sku || "",
    userId: row.actor_user_id || null,
    movementType: row.movement_type,
    quantityChanged: row.quantity_changed,
    previousQuantity: row.previous_quantity,
    newQuantity: row.new_quantity,
    reason: row.reason,
    reference: row.reference || "",
    department: row.department || "",
    purchaseOrderId: row.purchase_order_id,
    receiptId: row.receipt_id,
    stockMovementId: row.stock_movement_id,
    date: row.created_at,
  };
}

router.get("/audit", async (req, res) => {
  const parsed = parseAuditFilters(req.query);
  if (parsed.error) return res.status(400).json({ message: parsed.error });
  const filters = parsed.value;
  try {
    let request = supabase
      .from("inventory_audit_trail")
      .select(
        "id, product_id, actor_user_id, movement_type, quantity_changed, previous_quantity, new_quantity, reason, reference, department, purchase_order_id, receipt_id, stock_movement_id, created_at, products(name, sku)",
        { count: "exact" }
      )
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(filters.offset, filters.offset + filters.limit - 1);
    if (filters.productId) request = request.eq("product_id", filters.productId);
    if (filters.movementType) request = request.eq("movement_type", filters.movementType);
    if (filters.userId) request = request.eq("actor_user_id", filters.userId);
    if (filters.search) {
      request = request.or(
        `reference.ilike.%${filters.search}%,products.name.ilike.%${filters.search}%,products.sku.ilike.%${filters.search}%`
      );
    }
    if (filters.from) request = request.gte("created_at", `${filters.from}T00:00:00.000Z`);
    if (filters.to) {
      const exclusiveEnd = new Date(`${filters.to}T00:00:00.000Z`);
      exclusiveEnd.setUTCDate(exclusiveEnd.getUTCDate() + 1);
      request = request.lt("created_at", exclusiveEnd.toISOString());
    }

    const { data, error, count } = await request;
    if (error) {
      if (["42P01", "PGRST205"].includes(error.code)) {
        return res.status(503).json({
          code: "AUDIT_MIGRATION_REQUIRED",
          message: "Inventory audit history is unavailable. Apply the inventory audit migration and refresh the database schema cache.",
        });
      }
      throw error;
    }
    const total = count || 0;
    return res.json({
      items: (data || []).map(mapAuditRecord),
      pagination: {
        limit: filters.limit,
        offset: filters.offset,
        total,
        hasMore: filters.offset + filters.limit < total,
      },
    });
  } catch (error) {
    console.error("Failed to retrieve inventory audit records:", error.message);
    return res.status(500).json({ message: "Failed to retrieve inventory audit records." });
  }
});

router.get("/", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("stock_movements")
      .select("id, product_id, movement_type, quantity, note, created_at, products(name, sku)")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return res.json((data || []).map(mapMovement));
  } catch (error) {
    console.error("Failed to retrieve stock movements:", error.message);
    return res.status(500).json({ message: "Failed to retrieve stock movements." });
  }
});

router.post("/", async (req, res) => {
  const parsed = validateStockMovementBody(req.body || {});
  if (parsed.error) return res.status(400).json({ message: parsed.error });
  const { productId, movementType, quantity, idempotencyKey, reference, department, remarks } = parsed.value;

  try {
    const { data, error } = await supabase.schema("public").rpc("record_stock_movement", {
      p_product_id: productId,
      p_movement_type: movementType,
      p_quantity: quantity,
      p_reference: reference,
      p_department: department,
      p_remarks: remarks,
      p_idempotency_key: idempotencyKey,
      p_actor_user_id: req.user.id,
    });
    if (error) {
      if (["42883", "PGRST202"].includes(error.code)) {
        console.error("Stock movement RPC is unavailable:", error.message);
        return res.status(503).json({ message: "Stock movement is unavailable. Apply the required stock-operation and audit migrations, then refresh the Supabase API schema cache." });
      }
      if (error.code === "22003") {
        const message = movementType === "OUT" || (movementType === "ADJUSTMENT" && quantity < 0)
          ? "Stock change would reduce inventory below zero."
          : "Resulting stock exceeds the supported quantity range.";
        return res.status(409).json({ message });
      }
      if (error.code === "22023") return res.status(409).json({ message: "Stock movement request conflicts with an existing idempotency key or is invalid." });
      if (error.code === "P0002") return res.status(404).json({ message: "Product was not found." });
      throw error;
    }
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      console.error("Stock operation returned an invalid database response.");
      return res.status(500).json({ message: "Failed to record stock movement." });
    }
    const result = mapOperationResult(data);
    if (!result || result.productId !== productId) {
      console.error("Stock operation returned an invalid database result.");
      return res.status(500).json({ message: "Failed to record stock movement." });
    }
    return res.status(result.duplicate ? 200 : 201).json(result);
  } catch (error) {
    console.error("Failed to record stock movement:", error.message);
    return res.status(500).json({ message: "Failed to record stock movement." });
  }
});

module.exports = router;
