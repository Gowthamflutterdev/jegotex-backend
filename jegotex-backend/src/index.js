require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const routes = require("./routes");

const app = express(); // app = your whole backend server

// ─── MIDDLEWARE ───────────────────────────────
app.use(cors()); //Allows frontend like React or mobile app to access backend.
app.use(express.json()); // Reads JSON body.
app.use(express.urlencoded({ extended: true })); // Reads form data.

// Serve uploaded images as static files
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

// ─── ROUTES ───────────────────────────────────
app.use("/api", routes);

// ─── HEALTH CHECK ─────────────────────────────
app.get("/", (req, res) => {
  res.json({ message: "JEGOTEX API is running 🚀", version: "1.0.0" });
});

// ─── 404 HANDLER ──────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, message: "Route not found" });
});

// ─── ERROR HANDLER ────────────────────────────
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, message: err.message || "Server error" });
});

const pool = require("./config/db");

async function testDB() {
  try {
    const connection = await pool.getConnection();
    console.log("✅ MySQL Database Connected");

    connection.release();
  } catch (error) {
    console.error("❌ Database connection failed:", error.message);
  }
}

testDB();


// ─── START ────────────────────────────────────
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`✅ JEGOTEX Server running on http://localhost:${PORT}`);
});
