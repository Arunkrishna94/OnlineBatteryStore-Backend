const express = require("express");
const router = express.Router();
const { Pool } = require("pg");
const { authenticateUser } = require("../middleware/authMiddleware");
// Import authentication middleware

// Add item to cart
router.post("/", authenticateUser, async (req, res) => {
    const { product_id, quantity } = req.body;
    const user_id = req.user.id;  

    try {
        await pool.query(
            "INSERT INTO cart (user_id, product_id, quantity) VALUES ($1, $2, $3)",
            [user_id, product_id, quantity]
        );
        res.json({ message: "Item added to cart" });
    } catch (err) {
        res.status(500).json({ error: "Database error" });
    }
});

module.exports = router;
