const db = require("../config/db");

// GET /api/cart
const getCart = async (req, res) => {
  try {
    const [items] = await db.query(
      `SELECT c.id, c.quantity,
              pv.variant_id, pv.size, pv.color, pv.stock,
              pv.override_selling_price,
              p.id AS product_id, p.name, p.selling_price,
              (SELECT image_url FROM product_images WHERE product_id = p.id LIMIT 1) AS image
       FROM cart c
       JOIN product_variants pv ON c.variant_id = pv.variant_id
       JOIN products p ON pv.product_id = p.id
       WHERE c.user_id = ?`,
      [req.user.id]
    );

    const total = items.reduce((sum, item) => {
      const price = item.override_selling_price || item.selling_price;
      return sum + price * item.quantity;
    }, 0);

    res.json({ success: true, data: items, total });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/cart  { variant_id, quantity }
const addToCart = async (req, res) => {
  try {
    const { variant_id, quantity = 1 } = req.body;
    if (!variant_id)
      return res.status(400).json({ success: false, message: "variant_id required" });

    const [variant] = await db.query(
      "SELECT * FROM product_variants WHERE variant_id = ?", [variant_id]
    );
    if (variant.length === 0)
      return res.status(404).json({ success: false, message: "Variant not found" });
    if (variant[0].stock < quantity)
      return res.status(400).json({ success: false, message: "Not enough stock" });

    await db.query(
      `INSERT INTO cart (user_id, variant_id, quantity) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE quantity = quantity + ?`,
      [req.user.id, variant_id, quantity, quantity]
    );

    res.json({ success: true, message: "Added to cart" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// PUT /api/cart/:id  { quantity }
const updateCart = async (req, res) => {
  try {
    const { quantity } = req.body;
    if (!quantity || quantity < 1)
      return res.status(400).json({ success: false, message: "Valid quantity required" });

    await db.query(
      "UPDATE cart SET quantity = ? WHERE id = ? AND user_id = ?",
      [quantity, req.params.id, req.user.id]
    );
    res.json({ success: true, message: "Cart updated" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// DELETE /api/cart/:id
const removeFromCart = async (req, res) => {
  try {
    await db.query("DELETE FROM cart WHERE id = ? AND user_id = ?", [req.params.id, req.user.id]);
    res.json({ success: true, message: "Item removed" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { getCart, addToCart, updateCart, removeFromCart };
