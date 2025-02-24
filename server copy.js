require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const passport = require("passport");

const app = express();
app.use(cors());
app.use(express.json());

// PostgreSQL Connection
const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

// Secret key for JWT
const SECRET_KEY = process.env.JWT_SECRET || "root";

// 1️⃣ Create User (Register)
app.post("/users", async (req, res) => {
    try {
        const { name, email, password } = req.body;

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const newUser = await pool.query(
            "INSERT INTO users (name, email, password) VALUES ($1, $2, $3) RETURNING *",
            [name, email, hashedPassword]
        );

        res.json(newUser.rows[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Error creating user" });
    }
});

// 2️⃣ Get All Users
app.get("/users", async (req, res) => {
    try {
        const users = await pool.query("SELECT id, name, email, created_at FROM users");
        res.json(users.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Error fetching users" });
    }
});

// 3️⃣ Get Single User
app.get("/users/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const user = await pool.query("SELECT id, name, email, created_at FROM users WHERE id = $1", [id]);

        if (user.rows.length === 0) {
            return res.status(404).json({ error: "User not found" });
        }
        res.json(user.rows[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Error fetching user" });
    }
});

// 4️⃣ Update User
app.put("/users/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const { name, email } = req.body;

        const updatedUser = await pool.query(
            "UPDATE users SET name = $1, email = $2 WHERE id = $3 RETURNING *",
            [name, email, id]
        );

        res.json(updatedUser.rows[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Error updating user" });
    }
});

// 5️⃣ Delete User
app.delete("/users/:id", async (req, res) => {
    try {
        const { id } = req.params;
        await pool.query("DELETE FROM users WHERE id = $1", [id]);

        res.json({ message: "User deleted successfully" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Error deleting user" });
    }
});

// 6️⃣ Login User (JWT Authentication)
app.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body;

        // Check if user exists
        const user = await pool.query("SELECT * FROM users WHERE email = $1", [email]);

        if (user.rows.length === 0) {
            return res.status(401).json({ error: "Invalid credentials" });
        }

        // Compare password with the hashed password in the DB
        const isMatch = await bcrypt.compare(password, user.rows[0].password);

        if (!isMatch) {
            return res.status(401).json({ error: "Invalid credentials" });
        }

        // Generate JWT
        const token = jwt.sign(
            { id: user.rows[0].id, email: user.rows[0].email }, // Payload
            SECRET_KEY, // Secret key
            { expiresIn: "1h" } // Expiration time
        );

        res.json({ token });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Error logging in" });
    }
});

// Middleware to verify JWT Token
function verifyToken(req, res, next) {
    const token = req.headers["authorization"];

    if (!token) return res.status(403).json({ error: "Token required" });

    jwt.verify(token.split(" ")[1], SECRET_KEY, (err, decoded) => {
        if (err) return res.status(401).json({ error: "Invalid token" });
        req.user = decoded; // Attach user info to request
        next();
    });
}

// 7️⃣ Protected Route (only accessible with a valid JWT)
app.get("/profile", verifyToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const user = await pool.query("SELECT id, name, email FROM users WHERE id = $1", [userId]);

        if (user.rows.length === 0) {
            return res.status(404).json({ error: "User not found" });
        }

        res.json(user.rows[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Error fetching user profile" });
    }
});

pool.connect()
    .then(() => console.log("✅ Connected to PostgreSQL from server.js"))
    .catch((err) => {
        console.error("❌ Database connection error:", err.message);
        process.exit(1);
    });

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
