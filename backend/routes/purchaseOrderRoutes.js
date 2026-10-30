const express = require("express");
const supabase = require("../config/supabase");

const router = express.Router();
const orderSelect = "id, supplier_id, order_date, expected_date, status, total_amount, notes, created_at";
const itemSelect = "id, purchase_order_id, product_id, quantity, unit_cost, received_quantity, created_at, updated_at, products(id, name, sku)";

function parseId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function mapStatus(status, lines) {
  if (status === "Pending") return "Draft";
  if (status === "Received") return "Received";
  if (status === "Cancelled") return "Cancelled";
  const received = lines.reduce((sum, line) => sum + Number(line.receivedQuantity || 0), 0);
  const ordered = lines.reduce((sum, line) => sum + Number(line.orderedQuantity || 0), 0);
  return received > 0 && received < ordered ? "Partially Received" : "Ordered";
}

function mapOrder(order, items = []) {
  const lines = items.map((item) => ({
    id: item.id,
    productId: item.product_id,
    productName: item.products?.name || "",
    sku: item.products?.sku || "",
    orderedQuantity: item.quantity,
    unitCost: Number(item.unit_cost),
    receivedQuantity: item.received_quantity,
    lineTotal: Number(item.quantity) * Number(item.unit_cost),
  }));
  const orderDate = order.order_date || order.created_at;
  return {
    id: order.id,
    orderNumber: `PO-${new Date(orderDate).getFullYear()}-${String(order.id).padStart(4, "0")}`,
    supplierId: order.supplier_id,
    supplierName: order.suppliers?.name || "",
    orderDate,
    expectedDelivery: order.expected_date || "",
    status: mapStatus(order.status, lines),
    notes: order.notes || "",
    lines,
    receivingHistory: [],
    createdAt: order.created_at,
    updatedAt: order.updated_at || order.created_at,
  };
}

function validateOrder(body) {
  const errors = {};
  const supplierId = parseId(body.supplierId);
  if (!supplierId) errors.supplierId = "Select an existing supplier.";
  if (!Array.isArray(body.lines) || body.lines.length === 0) errors.lines = "Add at least one product line.";
  const seen = new Set();
  if (Array.isArray(body.lines)) {
    body.lines.forEach((line, index) => {
      const productId = parseId(line.productId);
      const quantity = Number(line.orderedQuantity);
      const unitCost = Number(line.unitCost);
      if (!productId) errors[`product-${index}`] = "Select an existing product.";
      if (seen.has(productId)) errors[`product-${index}`] = "Each product may appear only once.";
      seen.add(productId);
      if (!Number.isInteger(quantity) || quantity <= 0) errors[`quantity-${index}`] = "Use a positive whole number.";
      if (!Number.isFinite(unitCost) || unitCost < 0) errors[`cost-${index}`] = "Use a valid non-negative cost.";
    });
  }
  return errors;
}

async function getOrder(id) {
  const [{ data: order, error: orderError }, { data: items, error: itemError }, { data: receipts, error: receiptError }] = await Promise.all([
    supabase.from("purchase_orders").select(`${orderSelect}, suppliers(name)`).eq("id", id).maybeSingle(),
    supabase.from("purchase_order_items").select(itemSelect).eq("purchase_order_id", id).order("id", { ascending: true }),
    supabase.from("purchase_order_receipts").select("id, received_at, quantities").eq("purchase_order_id", id).order("received_at", { ascending: true }),
  ]);
  if (orderError) throw orderError;
  if (itemError) throw itemError;
  if (receiptError && !["42P01", "PGRST205"].includes(receiptError.code)) throw receiptError;
  const mapped = order ? mapOrder(order, items || []) : null;
  if (mapped) {
    mapped.receivingHistory = (receipts || []).map((receipt) => ({
      id: receipt.id,
      date: receipt.received_at,
      quantities: receipt.quantities || [],
      totalQuantity: (receipt.quantities || []).reduce((sum, line) => sum + Number(line.quantity || 0), 0),
    }));
  }
  return mapped;
}

async function insertItems(orderId, lines) {
  const { data: products, error: productError } = await supabase.from("products").select("id").in("id", lines.map((line) => parseId(line.productId)));
  if (productError) throw productError;
  if (!products || products.length !== lines.length) {
    const error = new Error("One or more selected products do not exist.");
    error.status = 400;
    throw error;
  }
  const { error } = await supabase.from("purchase_order_items").insert(lines.map((line) => ({
    purchase_order_id: orderId,
    product_id: parseId(line.productId),
    quantity: Number(line.orderedQuantity),
    unit_cost: Number(line.unitCost),
    received_quantity: 0,
  })));
  if (error) throw error;
}

router.get("/", async (req, res) => {
  try {
    const { data, error } = await supabase.from("purchase_orders").select(`${orderSelect}, suppliers(name)`).order("id", { ascending: true });
    if (error) throw error;
    const orders = await Promise.all((data || []).map((order) => getOrder(order.id)));
    return res.json(orders.filter(Boolean));
  } catch (error) {
    console.error("Failed to retrieve purchase orders:", error.message);
    return res.status(500).json({ message: "Failed to retrieve purchase orders." });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "Purchase order ID must be a positive integer." });
    const order = await getOrder(id);
    if (!order) return res.status(404).json({ message: "Purchase order not found." });
    return res.json(order);
  } catch (error) {
    console.error("Failed to retrieve purchase order:", error.message);
    return res.status(500).json({ message: "Failed to retrieve purchase order." });
  }
});

router.post("/", async (req, res) => {
  try {
    const errors = validateOrder(req.body || {});
    if (Object.keys(errors).length) return res.status(400).json({ message: "Invalid purchase order.", errors });
    const lines = req.body.lines;
    const total = lines.reduce((sum, line) => sum + Number(line.orderedQuantity) * Number(line.unitCost), 0);
    const { data: order, error } = await supabase.from("purchase_orders").insert({
      supplier_id: parseId(req.body.supplierId),
      order_date: req.body.orderDate || new Date().toISOString(),
      expected_date: req.body.expectedDelivery || null,
      status: "Pending",
      total_amount: total,
      notes: typeof req.body.notes === "string" ? req.body.notes.trim() : "",
    }).select(`${orderSelect}, suppliers(name)`).single();
    if (error) throw error;
    try {
      await insertItems(order.id, lines);
    } catch (itemError) {
      await supabase.from("purchase_orders").delete().eq("id", order.id);
      throw itemError;
    }
    return res.status(201).json(await getOrder(order.id));
  } catch (error) {
    console.error("Failed to create purchase order:", error.message);
    if (error.code === "23503") return res.status(400).json({ message: "The supplier or product does not exist." });
    return res.status(error.status || 500).json({ message: error.message || "Failed to create purchase order." });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "Purchase order ID must be a positive integer." });
    const errors = validateOrder(req.body || {});
    if (Object.keys(errors).length) return res.status(400).json({ message: "Invalid purchase order.", errors });
    const existing = await getOrder(id);
    if (!existing) return res.status(404).json({ message: "Purchase order not found." });
    if (existing.status !== "Draft") return res.status(409).json({ message: "Only draft purchase orders can be edited." });
    const receivedByProduct = new Map(existing.lines.map((line) => [line.productId, line.receivedQuantity]));
    for (const line of req.body.lines) {
      if (Number(line.orderedQuantity) < Number(receivedByProduct.get(parseId(line.productId)) || 0)) {
        return res.status(400).json({ message: "An ordered quantity cannot be less than its received quantity." });
      }
    }
    const total = req.body.lines.reduce((sum, line) => sum + Number(line.orderedQuantity) * Number(line.unitCost), 0);
    const { error: updateError } = await supabase.from("purchase_orders").update({
      supplier_id: parseId(req.body.supplierId),
      expected_date: req.body.expectedDelivery || null,
      total_amount: total,
      notes: typeof req.body.notes === "string" ? req.body.notes.trim() : "",
    }).eq("id", id);
    if (updateError) throw updateError;
    const { error: deleteError } = await supabase.from("purchase_order_items").delete().eq("purchase_order_id", id);
    if (deleteError) throw deleteError;
    try {
      await insertItems(id, req.body.lines.map((line) => ({
        ...line,
        receivedQuantity: receivedByProduct.get(parseId(line.productId)) || 0,
      })));
    } catch (itemError) {
      throw itemError;
    }
    return res.json(await getOrder(id));
  } catch (error) {
    console.error("Failed to update purchase order:", error.message);
    if (error.code === "23503") return res.status(400).json({ message: "The supplier or product does not exist." });
    return res.status(error.status || 500).json({ message: error.message || "Failed to update purchase order." });
  }
});

router.patch("/:id/status", async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "Purchase order ID must be a positive integer." });
    const statusMap = { Draft: "Pending", Ordered: "Ordered", Cancelled: "Cancelled" };
    const status = statusMap[req.body?.status];
    if (!status) return res.status(400).json({ message: "Unsupported purchase order status." });
    const existing = await getOrder(id);
    if (!existing) return res.status(404).json({ message: "Purchase order not found." });
    if (existing.status === "Received" || existing.status === "Cancelled") {
      return res.status(409).json({ message: "This purchase order can no longer change status." });
    }
    if (status === "Pending" && existing.status !== "Draft") {
      return res.status(409).json({ message: "Only draft purchase orders can return to draft." });
    }
    if (status === "Ordered" && existing.status !== "Draft") {
      return res.status(409).json({ message: "Only draft purchase orders can be placed." });
    }
    if (status === "Cancelled" && existing.lines.some((line) => line.receivedQuantity > 0)) {
      return res.status(409).json({ message: "A purchase order cannot be cancelled after receiving has started." });
    }
    const { error } = await supabase.from("purchase_orders").update({ status }).eq("id", id);
    if (error) throw error;
    return res.json(await getOrder(id));
  } catch (error) {
    console.error("Failed to update purchase order status:", error.message);
    return res.status(error.status || 500).json({ message: error.message || "Failed to update purchase order status." });
  }
});

router.post("/:id/receive", async (req, res) => {
  const id = parseId(req.params.id);
  const receipts = req.body?.lines;
  const idempotencyKey = typeof req.body?.idempotencyKey === "string" ? req.body.idempotencyKey.trim() : "";
  if (!id) return res.status(400).json({ message: "Purchase order ID must be a positive integer." });
  if (!Array.isArray(receipts) || receipts.length === 0) return res.status(400).json({ message: "At least one receipt line is required." });
  if (!idempotencyKey) return res.status(400).json({ message: "A receipt request identifier is required." });
  for (const line of receipts) {
    if (!parseId(line.itemId) || !Number.isInteger(Number(line.quantity)) || Number(line.quantity) <= 0) {
      return res.status(400).json({ message: "Receipt lines require valid item IDs and positive whole-number quantities." });
    }
  }
  try {
    const { data, error } = await supabase.rpc("receive_purchase_order", {
      p_purchase_order_id: id,
      p_receipts: receipts.map((line) => ({ item_id: parseId(line.itemId), quantity: Number(line.quantity) })),
      p_idempotency_key: idempotencyKey,
    });
    if (error) {
      if (error.code === "42883") return res.status(503).json({ message: "Receiving requires the atomic database migration to be executed first." });
      if (["22023", "22003"].includes(error.code)) return res.status(400).json({ message: error.message });
      if (error.code === "P0002") return res.status(404).json({ message: error.message });
      throw error;
    }
    if (data?.duplicate) return res.status(200).json(await getOrder(id));
    return res.json(await getOrder(id));
  } catch (error) {
    console.error("Failed to receive purchase order:", error.message);
    return res.status(500).json({ message: "Failed to receive purchase order." });
  }
});

module.exports = router;
