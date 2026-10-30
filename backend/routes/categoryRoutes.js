const express = require("express");
const supabase = require("../config/supabase");

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("categories")
      .select("id, name, description, created_at")
      .order("id", { ascending: true });

    if (error) {
      console.error("Failed to retrieve categories:", error.message);
      return res.status(500).json({
        message: "Failed to retrieve categories.",
      });
    }

    return res.status(200).json(data);
  } catch (error) {
    console.error("Unexpected error retrieving categories:", error.message);
    return res.status(500).json({
      message: "An unexpected error occurred.",
    });
  }
});

router.post("/", async (req, res) => {
  try {
    const { name, description } = req.body;

    if (typeof name !== "string" || !name.trim()) {
      return res.status(400).json({
        message: "Category name is required.",
      });
    }

    const trimmedName = name.trim();
    const trimmedDescription =
      typeof description === "string" ? description.trim() : "";

    const { data, error } = await supabase
      .from("categories")
      .insert({
        name: trimmedName,
        description: trimmedDescription,
      })
      .select("id, name, description, created_at")
      .single();

    if (error) {
      if (error.code === "23505") {
        return res.status(409).json({
          message: "A category with this name already exists.",
        });
      }

      console.error("Failed to create category:", error.message);
      return res.status(500).json({
        message: "Failed to create category.",
      });
    }

    return res.status(201).json(data);
  } catch (error) {
    console.error("Unexpected error creating category:", error.message);
    return res.status(500).json({
      message: "An unexpected error occurred.",
    });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { name, description } = req.body;

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        message: "Category ID must be a positive integer.",
      });
    }

    if (typeof name !== "string" || !name.trim()) {
      return res.status(400).json({
        message: "Category name is required.",
      });
    }

    const { data, error } = await supabase
      .from("categories")
      .update({
        name: name.trim(),
        description: typeof description === "string" ? description.trim() : "",
      })
      .eq("id", id)
      .select("id, name, description, created_at")
      .single();

    if (error) {
      if (error.code === "23505") {
        return res.status(409).json({
          message: "A category with this name already exists.",
        });
      }

      if (error.code === "PGRST116") {
        return res.status(404).json({
          message: "Category not found.",
        });
      }

      console.error("Failed to update category:", error.message);
      return res.status(500).json({
        message: "Failed to update category.",
      });
    }

    return res.status(200).json(data);
  } catch (error) {
    console.error("Unexpected error updating category:", error.message);
    return res.status(500).json({
      message: "An unexpected error occurred.",
    });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        message: "Category ID must be a positive integer.",
      });
    }

    const { data, error } = await supabase
      .from("categories")
      .delete()
      .eq("id", id)
      .select("id, name, description, created_at")
      .single();

    if (error) {
      if (error.code === "23503") {
        return res.status(409).json({
          message: "This category cannot be deleted while it is in use by products.",
        });
      }

      if (error.code === "PGRST116") {
        return res.status(404).json({
          message: "Category not found.",
        });
      }

      console.error("Failed to delete category:", error.message);
      return res.status(500).json({
        message: "Failed to delete category.",
      });
    }

    return res.status(200).json(data);
  } catch (error) {
    console.error("Unexpected error deleting category:", error.message);
    return res.status(500).json({
      message: "An unexpected error occurred.",
    });
  }
});

module.exports = router;
