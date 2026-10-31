
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const rateLimit = require("express-rate-limit");
require("dotenv").config();
const supabase = require("./config/supabase");
const { requireAuth, requireRole } = require("./middleware/auth");

const categoryRoutes = require("./routes/categoryRoutes");
const productRoutes = require("./routes/productRoutes");
const supplierRoutes = require("./routes/supplierRoutes");
const purchaseOrderRoutes = require("./routes/purchaseOrderRoutes");
const stockMovementRoutes = require("./routes/stockMovementRoutes");

const app = express();
const PORT = process.env.PORT || 5000;
const allowedOrigins = (process.env.CORS_ORIGINS || "").split(",").map((origin) => origin.trim()).filter(Boolean);
if (process.env.NODE_ENV === "production" && allowedOrigins.length === 0) {
  throw new Error("Missing CORS_ORIGINS in production. Configure one or more exact frontend origins.");
}

app.use(cors({
  origin(origin, callback) {
    const isLocalDevelopmentOrigin = process.env.NODE_ENV !== "production"
      && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin || "");
    if (!origin || allowedOrigins.includes(origin) || isLocalDevelopmentOrigin) {
      return callback(null, true);
    }
    return callback(new Error("Origin is not allowed by CORS."));
  },
}));
app.use(express.json({ limit: "100kb" }));
app.use("/api", rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { message: "Too many requests. Please try again later." },
}));
app.use("/api", requireAuth, requireRole("admin", "staff", "viewer"), (req, res, next) => {
  const isWriteRequest = ["POST", "PUT", "PATCH", "DELETE"].includes(req.method);
  if (isWriteRequest && req.userRole === "viewer") {
    return res.status(403).json({ message: "Your Inventra role is read-only. Ask an administrator for edit access." });
  }
  return next();
});

// Category API routes connected to Supabase
app.use("/api/categories", categoryRoutes);
app.use("/api/products", productRoutes);
app.use("/api/suppliers", supplierRoutes);
app.use("/api/purchase-orders", purchaseOrderRoutes);
app.use("/api/stock-movements", stockMovementRoutes);

// Basic API test route
app.get("/", (req, res) => {
  res.json({
    message: "Inventra API is running successfully!",
  });
});

app.use((error, req, res, next) => {
  if (error?.message === "Origin is not allowed by CORS.") {
    return res.status(403).json({ message: "Origin is not allowed." });
  }
  console.error("Unhandled server error:", error.message);
  return res.status(500).json({ message: "An unexpected server error occurred." });
});

// Start the Express server without connecting to MongoDB
app.listen(PORT, () => {
  console.log(`Inventra server is running on port ${PORT}`);
});
