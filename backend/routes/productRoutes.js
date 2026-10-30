const express = require("express");
const supabase = require("../config/supabase");

const router = express.Router();
const productColumns = "id, name, sku, description, quantity, unit_price, reorder_level, category_id, supplier_id, image_url, created_at, updated_at";
const productColumnsWithoutImage = "id, name, sku, description, quantity, unit_price, reorder_level, category_id, supplier_id, created_at, updated_at";

function isMissingImageColumn(error) {
  return error?.code === "42703" || error?.code === "PGRST204";
}

function mapProduct(product) {
  return {
    ...product,
    price: product.unit_price,
    reorderThreshold: product.reorder_level,
    imageUrl: product.image_url || "",
    condition: product.condition || "New",
    department: product.department || "Administration",
    createdAt: product.created_at,
    updatedAt: product.updated_at,
    category: product.categories?.name ?? product.category ?? "",
    supplier: product.suppliers?.name ?? product.supplier ?? "Not specified",
  };
}

function parseId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function validateProduct(body) {
  const errors = {};
  if (typeof body.name !== "string" || !body.name.trim()) errors.name = "Product name is required.";
  if (typeof body.sku !== "string" || !body.sku.trim()) errors.sku = "SKU is required.";
  if (!Number.isInteger(Number(body.quantity)) || Number(body.quantity) < 0) errors.quantity = "Quantity must be a non-negative whole number.";
  if (!Number.isFinite(Number(body.price)) || Number(body.price) < 0) errors.price = "Price must be a non-negative number.";
  if (!Number.isInteger(Number(body.reorderThreshold)) || Number(body.reorderThreshold) < 0) errors.reorderThreshold = "Reorder threshold must be a non-negative whole number.";
  if (body.imageUrl !== undefined && body.imageUrl !== null && typeof body.imageUrl !== "string") errors.imageUrl = "Image URL must be text.";
  if (typeof body.imageUrl === "string" && body.imageUrl.trim().length > 2048) errors.imageUrl = "Image URL must be 2048 characters or fewer.";
  return errors;
}

function normalizeImageUrl(value) {
  if (typeof value !== "string") return null;
  const imageUrl = value.trim();
  return imageUrl || null;
}

function selectProducts(columns = productColumns) {
  return supabase
    .from("products")
    .select(`${columns}, categories(name), suppliers(name)`)
    .order("id", { ascending: true });
}

async function getProducts() {
  const withImages = await selectProducts();
  if (!withImages.error || !isMissingImageColumn(withImages.error)) return withImages;
  return selectProducts(productColumnsWithoutImage);
}

function insertProduct(payload) {
  return supabase
    .from("products")
    .insert(payload)
    .select(`${productColumns}, categories(name), suppliers(name)`)
    .single();
}

async function insertProductWithoutImageOnMissingColumn(payload) {
  const withImage = await insertProduct(payload);
  if (!withImage.error || !isMissingImageColumn(withImage.error)) return withImage;
  const payloadWithoutImage = { ...payload };
  delete payloadWithoutImage.image_url;
  return supabase
    .from("products")
    .insert(payloadWithoutImage)
    .select(`${productColumnsWithoutImage}, categories(name), suppliers(name)`)
    .single();
}

async function findReferenceIds(body) {
  const references = {};
  if (body.categoryId !== undefined) references.category_id = parseId(body.categoryId);
  if (body.supplierId !== undefined) references.supplier_id = parseId(body.supplierId);
  if (body.category && !references.category_id) {
    const { data, error } = await supabase.from("categories").select("id").ilike("name", body.category.trim()).maybeSingle();
    if (error) throw error;
    if (data) references.category_id = data.id;
  }
  if (body.supplier && !references.supplier_id && body.supplier !== "Not specified") {
    const { data, error } = await supabase.from("suppliers").select("id").ilike("name", body.supplier.trim()).maybeSingle();
    if (error) throw error;
    if (data) references.supplier_id = data.id;
  }
  return references;
}

router.get("/", async (req, res) => {
  try {
    const { data, error } = await getProducts();
    if (error) throw error;
    return res.json((data || []).map(mapProduct));
  } catch (error) {
    console.error("Failed to retrieve products:", error.message);
    return res.status(500).json({ message: "Failed to retrieve products." });
  }
});

router.post("/", async (req, res) => {
  try {
    const errors = validateProduct(req.body || {});
    if (Object.keys(errors).length) return res.status(400).json({ message: "Invalid product.", errors });
    const references = await findReferenceIds(req.body);
    const payload = {
      name: req.body.name.trim(),
      sku: req.body.sku.trim(),
      description: typeof req.body.description === "string" ? req.body.description.trim() : "",
      quantity: Number(req.body.quantity),
      unit_price: Number(req.body.price),
      reorder_level: Number(req.body.reorderThreshold),
      image_url: normalizeImageUrl(req.body.imageUrl),
      ...references,
    };
    const { data, error } = await insertProductWithoutImageOnMissingColumn(payload);
    if (error) {
      if (error.code === "23505") return res.status(409).json({ message: "A product with this SKU already exists." });
      throw error;
    }
    return res.status(201).json(mapProduct(data));
  } catch (error) {
    console.error("Failed to create product:", error.message);
    return res.status(500).json({ message: "Failed to create product." });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "Product ID must be a positive integer." });
    const errors = validateProduct(req.body || {});
    if (Object.keys(errors).length) return res.status(400).json({ message: "Invalid product.", errors });
    const references = await findReferenceIds(req.body);
    const updatePayload = {
      name: req.body.name.trim(),
      sku: req.body.sku.trim(),
      description: typeof req.body.description === "string" ? req.body.description.trim() : "",
      quantity: Number(req.body.quantity),
      unit_price: Number(req.body.price),
      reorder_level: Number(req.body.reorderThreshold),
      image_url: normalizeImageUrl(req.body.imageUrl),
      ...references,
      updated_at: new Date().toISOString(),
    };
    let updateQuery = supabase.from("products").update(updatePayload).eq("id", id).select(`${productColumns}, categories(name), suppliers(name)`).maybeSingle();
    let { data, error } = await updateQuery;
    if (isMissingImageColumn(error)) {
      const updatePayloadWithoutImage = { ...updatePayload };
      delete updatePayloadWithoutImage.image_url;
      ({ data, error } = await supabase.from("products").update(updatePayloadWithoutImage).eq("id", id).select(`${productColumnsWithoutImage}, categories(name), suppliers(name)`).maybeSingle());
    }
    if (error) {
      if (error.code === "23505") return res.status(409).json({ message: "A product with this SKU already exists." });
      throw error;
    }
    if (!data) return res.status(404).json({ message: "Product not found." });
    return res.json(mapProduct(data));
  } catch (error) {
    console.error("Failed to update product:", error.message);
    return res.status(500).json({ message: "Failed to update product." });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "Product ID must be a positive integer." });
    const { data, error } = await supabase.from("products").delete().eq("id", id).select("id").maybeSingle();
    if (error) {
      if (error.code === "23503") return res.status(409).json({ message: "This product cannot be deleted while it is referenced by inventory history or orders." });
      throw error;
    }
    if (!data) return res.status(404).json({ message: "Product not found." });
    return res.status(204).send();
  } catch (error) {
    console.error("Failed to delete product:", error.message);
    return res.status(500).json({ message: "Failed to delete product." });
  }
});

module.exports = router;
