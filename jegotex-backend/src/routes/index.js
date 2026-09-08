const express = require("express");
const router = express.Router();

const { register, login } = require("../controllers/authController");
const {
  getProducts, getProduct, createProduct, updateProduct, deleteProduct, updateStock, productImage
} = require("../controllers/productController");
const { getCart, addToCart, updateCart, removeFromCart } = require("../controllers/cartController");
const { placeOrder, getMyOrders, getOrder, updateOrderStatus, getAllOrders } = require("../controllers/orderController");
const { protect, adminOnly } = require("../middleware/auth");
const upload = require("../middleware/upload");
const { createLearn, getLearn } = require("../controllers/learnController");

// ─── AUTH ────────────────────────────────────
router.post("/auth/register", register);
router.post("/auth/login", login);

// ─── PRODUCTS ────────────────────────────────
router.get("/products", getProducts);                          // Public
router.get("/products/:id", getProduct);                      // Public
router.post("/createproducts", protect, adminOnly, upload.array("images", 5), createProduct); // Admin
router.put("/products/:id", protect, adminOnly, updateProduct);     // Admin
router.delete("/products/:id", protect, adminOnly, deleteProduct);  // Admin
router.put("/products/:id/variants/:variantId/stock", protect, adminOnly, updateStock); // Admin
router.get("/api/productImage", productImage);                // Public


// ─── CART ────────────────────────────────────
router.get("/cart", protect, getCart);
router.post("/cart", protect, addToCart);
router.put("/cart/:id", protect, updateCart);
router.delete("/cart/:id", protect, removeFromCart);

// ─── ORDERS ──────────────────────────────────
router.post("/orders", protect, placeOrder);
router.get("/orders", protect, getMyOrders);
router.get("/orders/:id", protect, getOrder);

// ─── ADMIN ───────────────────────────────────
router.get("/admin/orders", protect, adminOnly, getAllOrders);
router.put("/admin/orders/:id/status", protect, adminOnly, updateOrderStatus);

/// LEARN ───────────────────────────────────
router.post("/learn", createLearn);
router.get("/learn", getLearn);

module.exports = router;
