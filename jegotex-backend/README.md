# JEGOTEX Backend API

> Node.js + Express + MySQL backend for the JEGOTEX Dress Store E-Commerce App

---

## 📁 Folder Structure

```
jegotex-backend/
├── src/
│   ├── index.js              ← Entry point
│   ├── config/
│   │   ├── db.js             ← MySQL connection pool
│   │   └── schema.sql        ← Run once to create all tables
│   ├── routes/
│   │   └── index.js          ← All API routes
│   ├── controllers/
│   │   ├── authController.js
│   │   ├── productController.js
│   │   ├── cartController.js
│   │   └── orderController.js
│   └── middleware/
│       ├── auth.js           ← JWT protect + adminOnly
│       └── upload.js         ← Multer image upload
├── uploads/                  ← Uploaded product images stored here
├── .env.example              ← Copy to .env and fill in your values
└── package.json
```

---

## 🚀 Setup

```bash
# 1. Install dependencies
npm install

# 2. Copy env file and fill in your MySQL credentials
cp .env.example .env

# 3. Create the database (run schema.sql in MySQL)
mysql -u root -p < src/config/schema.sql

# 4. Start the server
npm run dev       # development (auto-reload)
npm start         # production
```

---

## 📡 API Reference

### 🔐 Auth

| Method | Endpoint              | Description     | Auth |
|--------|-----------------------|-----------------|------|
| POST   | /api/auth/register    | Register user   | No   |
| POST   | /api/auth/login       | Login user      | No   |

**Register body:**
```json
{ "name": "Ravi", "email": "ravi@example.com", "password": "123456" }
```

**Login body:**
```json
{ "email": "ravi@example.com", "password": "123456" }
```

---

### 👗 Products

| Method | Endpoint                                      | Description           | Auth       |
|--------|-----------------------------------------------|-----------------------|------------|
| GET    | /api/products                                 | List all products     | No         |
| GET    | /api/products?category=Women                  | Filter by category    | No         |
| GET    | /api/products/:id                             | Get one product       | No         |
| POST   | /api/products                                 | Create product        | Admin only |
| PUT    | /api/products/:id                             | Update product        | Admin only |
| DELETE | /api/products/:id                             | Delete product        | Admin only |
| PUT    | /api/products/:id/variants/:variantId/stock   | Update variant stock  | Admin only |

**Create Product** (multipart/form-data):
```
name         = "Floral Summer Dress"
mrp          = 1599
selling_price= 1299
category     = "Women"
short_description = "Lightweight floral dress"
variants     = [{"size":"S","color":"Red","stock":5},{"size":"M","color":"Red","stock":2}]
attributes   = {"fabric":"Cotton","fit":"Regular","pattern":"Floral"}
images       = [file1.jpg, file2.jpg]   ← multipart files
```

---

### 🛒 Cart

| Method | Endpoint       | Description       | Auth     |
|--------|----------------|-------------------|----------|
| GET    | /api/cart      | View my cart      | Customer |
| POST   | /api/cart      | Add item to cart  | Customer |
| PUT    | /api/cart/:id  | Update quantity   | Customer |
| DELETE | /api/cart/:id  | Remove item       | Customer |

**Add to cart body:**
```json
{ "variant_id": "var_abc123", "quantity": 1 }
```

---

### 📦 Orders

| Method | Endpoint                         | Description          | Auth       |
|--------|----------------------------------|----------------------|------------|
| POST   | /api/orders                      | Place order          | Customer   |
| GET    | /api/orders                      | My order history     | Customer   |
| GET    | /api/orders/:id                  | Get one order        | Customer   |
| GET    | /api/admin/orders                | All orders           | Admin only |
| PUT    | /api/admin/orders/:id/status     | Update order status  | Admin only |

**Place Order body:**
```json
{ "address": "123, Gandhi Street, Coimbatore, TN 641001" }
```

**Update Order Status body:**
```json
{ "status": "shipped" }
```
Valid statuses: `placed` → `confirmed` → `shipped` → `delivered` / `cancelled`

---

## 🔑 Authentication

All protected routes need this header:
```
Authorization: Bearer <token>
```
Token is returned from `/api/auth/login` or `/api/auth/register`.

---

## 🛠️ Tech Stack

- **Node.js** + **Express** — server framework
- **MySQL2** — database
- **JWT** — authentication tokens
- **bcryptjs** — password hashing
- **Multer** — image uploads
- **UUID** — unique IDs matching your DB design
