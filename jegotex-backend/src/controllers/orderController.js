const { v4: uuidv4 } = require("uuid");
const db = require("../config/db");

// POST /api/orders  (place order from cart)
const placeOrder = async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const { address } = req.body;
    if (!address)
      return res.status(400).json({ success: false, message: "Delivery address required" });

    // Get cart items
    const [cartItems] = await conn.query(
      `SELECT c.quantity, pv.variant_id, pv.product_id, pv.stock,
              pv.override_selling_price, p.selling_price
       FROM cart c
       JOIN product_variants pv ON c.variant_id = pv.variant_id
       JOIN products p ON pv.product_id = p.id
       WHERE c.user_id = ?`,
      [req.user.id]
    );

    if (cartItems.length === 0)
      return res.status(400).json({ success: false, message: "Cart is empty" });

    // Check stock & calculate total
    let total = 0;
    for (const item of cartItems) {
      if (item.stock < item.quantity)
        return res.status(400).json({ success: false, message: "Some items are out of stock" });
      const price = item.override_selling_price || item.selling_price;
      total += price * item.quantity;
    }

    const orderId = "ord_" + uuidv4().slice(0, 8);
    await conn.query(
      "INSERT INTO orders (id, user_id, total_amount, address) VALUES (?, ?, ?, ?)",
      [orderId, req.user.id, total, address]
    );

    for (const item of cartItems) {
      const price = item.override_selling_price || item.selling_price;
      await conn.query(
        "INSERT INTO order_items (order_id, variant_id, product_id, quantity, price) VALUES (?, ?, ?, ?, ?)",
        [orderId, item.variant_id, item.product_id, item.quantity, price]
      );
      // Reduce stock
      await conn.query(
        "UPDATE product_variants SET stock = stock - ? WHERE variant_id = ?",
        [item.quantity, item.variant_id]
      );
    }

    // Clear cart
    await conn.query("DELETE FROM cart WHERE user_id = ?", [req.user.id]);

    await conn.commit();
    res.status(201).json({ success: true, message: "Order placed!", orderId, total });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ success: false, message: err.message });
  } finally {
    conn.release();
  }
};

// GET /api/orders  (my orders)
const getMyOrders = async (req, res) => {
  try {
    const [orders] = await db.query(
      "SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC",
      [req.user.id]
    );

    for (const order of orders) {
      const [items] = await db.query(
        `SELECT oi.*, p.name, pv.size, pv.color,
                (SELECT image_url FROM product_images WHERE product_id = oi.product_id LIMIT 1) AS image
         FROM order_items oi
         JOIN products p ON oi.product_id = p.id
         JOIN product_variants pv ON oi.variant_id = pv.variant_id
         WHERE oi.order_id = ?`,
        [order.id]
      );
      order.items = items;
    }

    res.json({ success: true, data: orders });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/orders/:id
const getOrder = async (req, res) => {
  try {
    const [orders] = await db.query(
      "SELECT * FROM orders WHERE id = ? AND user_id = ?",
      [req.params.id, req.user.id]
    );
    if (orders.length === 0)
      return res.status(404).json({ success: false, message: "Order not found" });

    const [items] = await db.query(
      `SELECT oi.*, p.name, pv.size, pv.color
       FROM order_items oi
       JOIN products p ON oi.product_id = p.id
       JOIN product_variants pv ON oi.variant_id = pv.variant_id
       WHERE oi.order_id = ?`,
      [req.params.id]
    );
    orders[0].items = items;
    res.json({ success: true, data: orders[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// PUT /api/orders/:id/status  (Admin only)
const updateOrderStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ["placed", "confirmed", "shipped", "delivered", "cancelled"];
    if (!validStatuses.includes(status))
      return res.status(400).json({ success: false, message: "Invalid status" });

    await db.query("UPDATE orders SET status = ? WHERE id = ?", [status, req.params.id]);
    res.json({ success: true, message: "Order status updated" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/admin/orders  (Admin only - all orders)
const getAllOrders = async (req, res) => {
  try {
    const [orders] = await db.query(
      `SELECT o.*, u.name AS customer_name, u.email
       FROM orders o JOIN users u ON o.user_id = u.id
       ORDER BY o.created_at DESC`
    );
    res.json({ success: true, count: orders.length, data: orders });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { placeOrder, getMyOrders, getOrder, updateOrderStatus, getAllOrders };
