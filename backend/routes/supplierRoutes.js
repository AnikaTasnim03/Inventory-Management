const express = require("express");
const supabase = require("../config/supabase");

const router = express.Router();
const supplierColumns = "id, name, contact_person, phone, email, address, supplied_categories, created_at";
const supplierColumnsWithNotes = `${supplierColumns}, notes`;

function isMissingNotesColumn(error) {
  return error && (error.code === "42703" || error.code === "PGRST204");
}

function normalizeCategories(categories) {
  return Array.isArray(categories)
    ? categories.filter((category) => typeof category === "string").map((category) => category.trim()).filter(Boolean)
    : [];
}

function mapSupplier(supplier) {
  return {
    ...supplier,
    contactPerson: supplier.contact_person,
    createdAt: supplier.created_at,
    updatedAt: supplier.created_at,
    categories: normalizeCategories(supplier.supplied_categories),
    notes: supplier.notes || "",
  };
}

async function selectSupplier(query, cardinality = null) {
  const applyCardinality = (selectedQuery) => {
    if (cardinality === "single") return selectedQuery.single();
    if (cardinality === "maybeSingle") return selectedQuery.maybeSingle();
    return selectedQuery;
  };
  const withNotes = await applyCardinality(query.select(supplierColumnsWithNotes));
  if (!isMissingNotesColumn(withNotes.error)) return withNotes;
  return applyCardinality(query.select(supplierColumns));
}

function parseId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function validateSupplier(body) {
  const errors = {};
  if (typeof body.name !== "string" || !body.name.trim()) errors.name = "Supplier name is required.";
  if (body.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(body.email).trim())) errors.email = "Enter a valid email address.";
  return errors;
}

router.get("/", async (req, res) => {
  try {
    const { data, error } = await selectSupplier(supabase.from("suppliers").select("*").order("id", { ascending: true }));
    if (error) throw error;
    return res.json((data || []).map(mapSupplier));
  } catch (error) {
    console.error("Failed to retrieve suppliers:", error.message);
    return res.status(500).json({ message: "Failed to retrieve suppliers." });
  }
});

router.post("/", async (req, res) => {
  try {
    const errors = validateSupplier(req.body || {});
    if (Object.keys(errors).length) return res.status(400).json({ message: "Invalid supplier.", errors });
    const supplierData = {
      name: req.body.name.trim(),
      contact_person: typeof req.body.contactPerson === "string" ? req.body.contactPerson.trim() : "",
      phone: typeof req.body.phone === "string" ? req.body.phone.trim() : "",
      email: typeof req.body.email === "string" ? req.body.email.trim() : "",
      address: typeof req.body.address === "string" ? req.body.address.trim() : "",
      supplied_categories: normalizeCategories(req.body.categories),
      notes: typeof req.body.notes === "string" ? req.body.notes.trim() : "",
    };
    let result = await selectSupplier(supabase.from("suppliers").insert(supplierData), "single");
    if (isMissingNotesColumn(result.error)) {
      const { notes, ...supplierDataWithoutNotes } = supplierData;
      result = await selectSupplier(supabase.from("suppliers").insert(supplierDataWithoutNotes), "single");
    }
    const { data, error } = result;
    if (error) {
      if (error.code === "23505") return res.status(409).json({ message: "A supplier with this name already exists." });
      throw error;
    }
    return res.status(201).json(mapSupplier(data));
  } catch (error) {
    console.error("Failed to create supplier:", error.message);
    return res.status(500).json({ message: "Failed to create supplier." });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "Supplier ID must be a positive integer." });
    const errors = validateSupplier(req.body || {});
    if (Object.keys(errors).length) return res.status(400).json({ message: "Invalid supplier.", errors });
    const supplierData = {
      name: req.body.name.trim(),
      contact_person: typeof req.body.contactPerson === "string" ? req.body.contactPerson.trim() : "",
      phone: typeof req.body.phone === "string" ? req.body.phone.trim() : "",
      email: typeof req.body.email === "string" ? req.body.email.trim() : "",
      address: typeof req.body.address === "string" ? req.body.address.trim() : "",
      supplied_categories: normalizeCategories(req.body.categories),
      notes: typeof req.body.notes === "string" ? req.body.notes.trim() : "",
    };
    let result = await selectSupplier(supabase.from("suppliers").update(supplierData).eq("id", id), "maybeSingle");
    if (isMissingNotesColumn(result.error)) {
      const { notes, ...supplierDataWithoutNotes } = supplierData;
      result = await selectSupplier(supabase.from("suppliers").update(supplierDataWithoutNotes).eq("id", id), "maybeSingle");
    }
    const { data, error } = result;
    if (error) {
      if (error.code === "23505") return res.status(409).json({ message: "A supplier with this name already exists." });
      throw error;
    }
    if (!data) return res.status(404).json({ message: "Supplier not found." });
    return res.json(mapSupplier(data));
  } catch (error) {
    console.error("Failed to update supplier:", error.message);
    return res.status(500).json({ message: "Failed to update supplier." });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "Supplier ID must be a positive integer." });
    const { data, error } = await supabase.from("suppliers").delete().eq("id", id).select("id").maybeSingle();
    if (error) {
      if (error.code === "23503") return res.status(409).json({ message: "This supplier cannot be deleted while it is assigned to products or orders." });
      throw error;
    }
    if (!data) return res.status(404).json({ message: "Supplier not found." });
    return res.status(204).send();
  } catch (error) {
    console.error("Failed to delete supplier:", error.message);
    return res.status(500).json({ message: "Failed to delete supplier." });
  }
});

module.exports = router;
