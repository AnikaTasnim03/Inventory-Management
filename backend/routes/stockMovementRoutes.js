const express = require("express");
const supabase = require("../config/supabase");

const router = express.Router();

function parseId(value) {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function parseNote(note) {
  const legacy = {
    reference: "Not specified",
    department: "Not specified",
    remarks: "",
    previousQuantity: null,
    resultingQuantity: null,
  };
  if (typeof note !== "string" || !note.trim()) return legacy;

  try {
    const parsed = JSON.parse(note);
    if (parsed?.format !== "inventra.stock-movement" || parsed?.version !== 1) {
      return { ...legacy, remarks: note };
    }
    return {
      reference: typeof parsed.reference === "string" && parsed.reference ? parsed.reference : legacy.reference,
      department: typeof parsed.department === "string" && parsed.department ? parsed.department : legacy.department,
      remarks: typeof parsed.remarks === "string" ? parsed.remarks : "",
      previousQuantity: Number.isInteger(parsed.previousQuantity) ? parsed.previousQuantity : null,
      resultingQuantity: Number.isInteger(parsed.resultingQuantity) ? parsed.resultingQuantity : null,
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
    type: row.movement_type === "IN" ? "Stock in" : row.movement_type === "OUT" ? "Stock out" : "Adjustment",
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
    productId: result.product_id,
    reference: result.reference,
    department: result.department,
    remarks: result.remarks,
    previousQuantity: result.previous_quantity,
    resultingQuantity: result.resulting_quantity,
  };
}

function optionalText(value, field, maxLength) {
  if (value === undefined || value === null) return { value: null };
  if (typeof value !== "string") return { error: `${field} must be text.` };
  const normalized = value.trim();
  if (normalized.length > maxLength) return { error: `${field} must be ${maxLength} characters or fewer.` };
  return { value: normalized || null };
}

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
  const productId = parseId(req.body?.productId);
  const quantity = Number(req.body?.quantity);
  const movementType = req.body?.type === "Stock in" ? "IN" : req.body?.type === "Stock out" ? "OUT" : req.body?.type;
  if (!productId) return res.status(400).json({ message: "Product ID must be a positive integer." });
  if (!Number.isSafeInteger(quantity) || quantity <= 0 || quantity > 2147483647) return res.status(400).json({ message: "Movement quantity must be a positive whole number within the supported range." });
  if (!["IN", "OUT"].includes(movementType)) return res.status(400).json({ message: "Movement type must be IN or OUT." });
  const idempotencyKey = typeof req.body?.idempotencyKey === "string" ? req.body.idempotencyKey.trim() : "";
  if (!idempotencyKey) return res.status(400).json({ message: "An idempotency key is required." });
  if (idempotencyKey.length > 200) return res.status(400).json({ message: "Idempotency key must be 200 characters or fewer." });

  const reference = optionalText(req.body?.reference, "Reference", 200);
  const department = optionalText(req.body?.department, "Department", 100);
  const remarks = optionalText(req.body?.remarks, "Remarks", 2000);
  const invalidField = [reference, department, remarks].find((field) => field.error);
  if (invalidField) return res.status(400).json({ message: invalidField.error });

  try {
    const { data, error } = await supabase.schema("public").rpc("record_stock_movement", {
      p_product_id: productId,
      p_movement_type: movementType,
      p_quantity: quantity,
      p_reference: reference.value,
      p_department: department.value,
      p_remarks: remarks.value,
      p_idempotency_key: idempotencyKey,
    });
    if (error) {
      if (error.code === "42883" || error.code === "PGRST202") {
        console.error("Stock movement RPC is unavailable:", error.message);
        return res.status(503).json({ message: "Stock movement database function is unavailable. Apply the stock migrations in order and refresh the Supabase API schema cache." });
      }
      if (error.code === "22003") {
        const message = movementType === "OUT"
          ? "Stock-out quantity exceeds available stock."
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
