const { v4: uuidv4 } = require("uuid");
const db = require("../config/db");

// Helper: build full product object from DB
const buildProduct = async (product) => {
  const [images] = await db.query(
    "SELECT image_url FROM product_images WHERE product_id = ?",
    [product.product_id]
  );

  const [variants] = await db.query(
    "SELECT * FROM product_variants WHERE product_id = ?",
    [product.product_id]
  );

  const [attributes] = await db.query(
    "SELECT attribute_key, attribute_value FROM product_attributes WHERE product_id = ?",
    [product.product_id]
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
//This is calling getProducts(), not getProduct().
const getProducts = async (req, res) => {
  try {
    const { tbo_id, status = "active" } = req.query;

    if (!tbo_id) {
      return res.status(400).json({
        success: false,
        message: "tbo_id is required"
      });
    }

    const [products] = await db.query(
      `SELECT *
       FROM products
       WHERE tbo_id = ?
       AND status = ?
       ORDER BY created_at DESC`,
      [tbo_id, status]
    );

    const result = await Promise.all(
      products.map(buildProduct)
    );

    res.json({
      success: true,
      count: result.length,
      data: result
    });

  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message
    });
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
      product_id,
      tbo_id,
      product_tittle,
      brand = "JEGOTEX",
      discount_percentage = 0,
      mrp,
      selling_price,
      gender,
      product_types,
      product_sizes,
      currency = "INR",
      stock_status = "In Stock",
      status = "active",
      short_description,
      long_description,
      variants = [],
      attributes = {}
    } = req.body;

    // Required fields
    if (!tbo_id || !product_tittle || !mrp || !selling_price) {
      return res.status(400).json({
        success: false,
        message: "tbo_id, product_tittle, mrp and selling_price are required"
      });
    }

    // Create product ID
   // const product_id = "prod_" + uuidv4().slice(0, 8);

    // Insert product
    await conn.query(
      `INSERT INTO products (
        product_id,
        tbo_id,
        product_tittle,
        short_description,
        long_description,
        brand,
        discount_percentage,
        mrp,
        selling_price,
        gender,
        product_types,
        product_sizes,
        currency,
        stock_status,
        status
      )
      VALUES ( ?,?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        product_id,
        tbo_id,
        product_tittle,
        short_description || null,
        long_description || null,
        brand,
        discount_percentage,
        mrp,
        selling_price,
        gender || null,
        product_types || null,
        product_sizes || null,
        currency,
        stock_status,
        status
      ]
    );

    // Images
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const url = `/uploads/${file.filename}`;

        await conn.query(
          `INSERT INTO product_images
           (product_id, image_url)
           VALUES (?, ?)`,
          [product_id, url]
        );
      }
    }

    // Variants
    const parsedVariants =
      typeof variants === "string"
        ? JSON.parse(variants)
        : variants;

    for (const v of parsedVariants) {
      const variant_id = "var_" + uuidv4().slice(0, 8);

      await conn.query(
        `INSERT INTO product_variants
        (
          variant_id,
          product_id,
          size,
          color,
          stock,
          override_mrp,
          override_selling_price
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          variant_id,
          product_id,
          v.size || null,
          v.color || null,
          v.stock || 0,
          v.override_mrp || null,
          v.override_selling_price || null
        ]
      );
    }

    // Attributes
    const parsedAttrs =
      typeof attributes === "string"
        ? JSON.parse(attributes)
        : attributes;

    for (const [key, value] of Object.entries(parsedAttrs)) {
      await conn.query(
        `INSERT INTO product_attributes
        (product_id, attribute_key, attribute_value)
        VALUES (?, ?, ?)`,
        [product_id, key, value]
      );
    }

    await conn.commit();

    // Get newly created product
    const [rows] = await db.query(
      `SELECT *
       FROM products
       WHERE product_id = ?`,
      [product_id]
    );

    const product = await buildProduct(rows[0]);

    res.status(201).json({
      success: true,
      data: product
    });

  } catch (err) {
    await conn.rollback();

    res.status(500).json({
      success: false,
      message: err.message
    });

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

///product image

const productImage = async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await db.query("SELECT * FROM products WHERE id = ?", [id]);
    if (rows.length === 0)
      return res.status(404).json({ success: false, message: "Product not found" });

    res.json({ success: true, data: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { getProducts, getProduct, createProduct, updateProduct, deleteProduct, updateStock, productImage};
