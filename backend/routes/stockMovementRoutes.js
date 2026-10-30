const express = require("express");
const supabase = require("../config/supabase");

const router = express.Router();

function parseId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function mapMovement(row) {
  return {
    id: row.id,
    productId: row.product_id,
    productName: row.products?.name || "",
    sku: row.products?.sku || "",
    type: row.movement_type === "IN" ? "Stock in" : row.movement_type === "OUT" ? "Stock out" : "Adjustment",
    quantity: row.quantity,
    date: row.created_at,
    previousQuantity: row.previous_quantity,
    resultingQuantity: row.resulting_quantity,
    reference: row.reference || "Not specified",
    department: row.department || "Not specified",
    remarks: row.remarks || "",
  };
}

router.get("/", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("stock_movements")
      .select("id, product_id, movement_type, quantity, created_at, products(name, sku)")
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
  if (!Number.isInteger(quantity) || quantity <= 0) return res.status(400).json({ message: "Movement quantity must be a positive whole number." });
  if (!["IN", "OUT"].includes(movementType)) return res.status(400).json({ message: "Movement type must be IN or OUT until adjustment semantics are added to the database function." });
  const idempotencyKey = typeof req.body.idempotencyKey === "string" && req.body.idempotencyKey.trim() ? req.body.idempotencyKey.trim() : null;
  try {
    const { data, error } = await supabase.rpc("record_stock_movement", {
      p_product_id: productId,
      p_movement_type: movementType,
      p_quantity: quantity,
      p_reference: null,
      p_department: null,
      p_remarks: null,
      p_idempotency_key: idempotencyKey,
    });
    if (error) {
      if (error.code === "42883") return res.status(503).json({ message: "Stock operations require the atomic database migration to be executed first." });
      if (error.code === "22003" || error.code === "22023") return res.status(400).json({ message: error.message });
      if (error.code === "P0002") return res.status(404).json({ message: error.message });
      throw error;
    }
    if (data?.duplicate) return res.status(200).json(data);
    return res.status(201).json(data);
  } catch (error) {
    console.error("Failed to record stock movement:", error.message);
    return res.status(500).json({ message: "Failed to record stock movement." });
  }
});

module.exports = router;
