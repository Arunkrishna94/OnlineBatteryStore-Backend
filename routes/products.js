const express = require("express");
const router = express.Router();
const { Pool } = require("pg");
const { authenticateUser, authorizeAdmin } = require("../middleware/authMiddleware");

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

// ✅ Public Route - Get all products
router.get("/products", async (req, res) => {
    try {
        const products = await pool.query("SELECT * FROM products");
        res.json(products.rows);
    } catch (error) {
        console.error("Error fetching products:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// ✅ Public Route - Get product by ID
router.get("/products/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const product = await pool.query("SELECT * FROM products WHERE id = $1", [id]);
        if (product.rows.length === 0) {
            return res.status(404).json({ error: "Product not found" });
        }
        res.json(product.rows[0]);
    } catch (error) {
        console.error("Error fetching product:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// ✅ Protected Route - Create a new product (Admins only)
router.post("/products", authenticateUser, authorizeAdmin, async (req, res) => {
    try {
        const { name, description, price, stock } = req.body;
        if (!name || !price || stock === undefined) {
            return res.status(400).json({ error: "Name, price, and stock are required" });
        }
        const newProduct = await pool.query(
            "INSERT INTO products (name, description, price, stock) VALUES ($1, $2, $3, $4) RETURNING *",
            [name, description, price, stock]
        );
        res.status(201).json(newProduct.rows[0]);
    } catch (error) {
        console.error("Error adding product:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// ✅ Protected Route - Update a product (Admins only)
router.put("/products/:id", authenticateUser, authorizeAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description, price, stock } = req.body;
        const updatedProduct = await pool.query(
            "UPDATE products SET name = $1, description = $2, price = $3, stock = $4 WHERE id = $5 RETURNING *",
            [name, description, price, stock, id]
        );
        if (updatedProduct.rows.length === 0) {
            return res.status(404).json({ error: "Product not found" });
        }
        res.json(updatedProduct.rows[0]);
    } catch (error) {
        console.error("Error updating product:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// ✅ Protected Route - Delete a product (Admins only)
router.delete("/products/:id", authenticateUser, authorizeAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const deletedProduct = await pool.query("DELETE FROM products WHERE id = $1 RETURNING *", [id]);
        if (deletedProduct.rows.length === 0) {
            return res.status(404).json({ error: "Product not found" });
        }
        res.json({ message: "Product deleted successfully" });
    } catch (error) {
        console.error("Error deleting product:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

module.exports = router;
