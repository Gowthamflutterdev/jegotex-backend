const { v4: uuidv4 } = require("uuid");
const db = require("../config/db");

// Helper: build full product object from DB
const buildProduct = async (product) => {
  const [images] = await db.query(
    "SELECT image_url FROM product_images WHERE product_id = ?", [product.id]
  );
  const [variants] = await db.query(
    "SELECT * FROM product_variants WHERE product_id = ?", [product.id]
  );
  const [attributes] = await db.query(
    "SELECT attribute_key, attribute_value FROM product_attributes WHERE product_id = ?",
    [product.id]
  );

  const attrObj = {};
  attributes.forEach(({ attribute_key, attribute_value }) => {
    attrObj[attribute_key] = attribute_value;
  });

  return {
    ...product,
    images: images.map((i) => i.image_url),
    variants,
    attributes: attrObj,
  };
};

// GET /api/products  (with optional ?category=Women&status=active)
const getProducts = async (req, res) => {
  try {
    const { category, status = "active" } = req.query;
    let query = "SELECT * FROM products WHERE status = ?";
    const params = [status];
    if (category) { query += " AND category = ?"; params.push(category); }
    query += " ORDER BY created_at DESC";

    const [products] = await db.query(query, params);
    const result = await Promise.all(products.map(buildProduct));
    res.json({ success: true, count: result.length, data: result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/products/:id
const getProduct = async (req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM products WHERE id = ?", [req.params.id]);
    if (rows.length === 0)
      return res.status(404).json({ success: false, message: "Product not found" });

    const product = await buildProduct(rows[0]);
    res.json({ success: true, data: product });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/products  (Admin only)
// Body: { name, brand, mrp, selling_price, category, short_description, long_description,
//         variants: [{size, color, stock, override_mrp, override_selling_price}],
//         attributes: {fabric, fit, pattern, ...} }
// Files: images (multipart)
const createProduct = async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const {
      name, brand = "JEGOTEX", mrp, selling_price, currency = "INR",
      category, short_description, long_description,
      variants = "[]", attributes = "{}"
    } = req.body;

    if (!name || !mrp || !selling_price || !category)
      return res.status(400).json({ success: false, message: "name, mrp, selling_price, category required" });

    const id = "prod_" + uuidv4().slice(0, 8);

    await conn.query(
      `INSERT INTO products (id, name, brand, mrp, selling_price, currency, category, short_description, long_description)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, name, brand, mrp, selling_price, currency, category, short_description, long_description]
    );

    // Images (uploaded files)
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const url = `/uploads/${file.filename}`;
        await conn.query("INSERT INTO product_images (product_id, image_url) VALUES (?, ?)", [id, url]);
      }
    }

    // Variants
    const parsedVariants = typeof variants === "string" ? JSON.parse(variants) : variants;
    for (const v of parsedVariants) {
      const variant_id = "var_" + uuidv4().slice(0, 8);
      await conn.query(
        `INSERT INTO product_variants (variant_id, product_id, size, color, stock, override_mrp, override_selling_price)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [variant_id, id, v.size, v.color, v.stock || 0, v.override_mrp || null, v.override_selling_price || null]
      );
    }

    // Attributes
    const parsedAttrs = typeof attributes === "string" ? JSON.parse(attributes) : attributes;
    for (const [key, value] of Object.entries(parsedAttrs)) {
      await conn.query(
        "INSERT INTO product_attributes (product_id, attribute_key, attribute_value) VALUES (?, ?, ?)",
        [id, key, value]
      );
    }

    await conn.commit();
    const [rows] = await db.query("SELECT * FROM products WHERE id = ?", [id]);
    const product = await buildProduct(rows[0]);
    res.status(201).json({ success: true, data: product });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ success: false, message: err.message });
  } finally {
    conn.release();
  }
};

// PUT /api/products/:id  (Admin only)
const updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await db.query("SELECT id FROM products WHERE id = ?", [id]);
    if (rows.length === 0)
      return res.status(404).json({ success: false, message: "Product not found" });

    const fields = ["name", "brand", "mrp", "selling_price", "category",
                    "short_description", "long_description", "status"];
    const updates = [];
    const values = [];
    fields.forEach((f) => {
      if (req.body[f] !== undefined) { updates.push(`${f} = ?`); values.push(req.body[f]); }
    });

    if (updates.length > 0) {
      values.push(id);
      await db.query(`UPDATE products SET ${updates.join(", ")} WHERE id = ?`, values);
    }

    const [updated] = await db.query("SELECT * FROM products WHERE id = ?", [id]);
    const product = await buildProduct(updated[0]);
    res.json({ success: true, data: product });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// DELETE /api/products/:id  (Admin only)
const deleteProduct = async (req, res) => {
  try {
    const [rows] = await db.query("SELECT id FROM products WHERE id = ?", [req.params.id]);
    if (rows.length === 0)
      return res.status(404).json({ success: false, message: "Product not found" });

    await db.query("DELETE FROM products WHERE id = ?", [req.params.id]);
    res.json({ success: true, message: "Product deleted" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// PUT /api/products/:id/variants/:variantId/stock  (Admin only)
const updateStock = async (req, res) => {
  try {
    const { variantId } = req.params;
    const { stock } = req.body;
    if (stock === undefined)
      return res.status(400).json({ success: false, message: "stock is required" });

    await db.query("UPDATE product_variants SET stock = ? WHERE variant_id = ?", [stock, variantId]);
    res.json({ success: true, message: "Stock updated" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { getProducts, getProduct, createProduct, updateProduct, deleteProduct, updateStock };
