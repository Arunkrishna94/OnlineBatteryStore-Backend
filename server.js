require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

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

const SECRET_KEY = process.env.JWT_SECRET || "root";

// Register User
app.post("/auth/register", async (req, res) => {
    try {
        console.log("Received Data:", req.body);
        const { name, email, password, role = "user" } = req.body; // Default role as 'user'
        if (!name || !email || !password) {
            return res.status(400).json({ error: "All fields are required" });
        }

        const existingUser = await pool.query("SELECT id FROM users WHERE email = $1", [email]);
        if (existingUser.rows.length > 0) {
            return res.status(400).json({ error: "Email already registered" });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const newUser = await pool.query(
            "INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, $4) RETURNING id, name, email, role",
            [name, email, hashedPassword, role]
        );

        res.status(201).json(newUser.rows[0]);
    } catch (error) {
        console.error("Error creating user:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// Get All Users
app.get("/users", async (req, res) => {
    try {
        const users = await pool.query("SELECT id, name, email, role, created_at FROM users");
        res.json(users.rows);
    } catch (error) {
        console.error("Error fetching users:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// Get User Role
app.get("/auth/role", verifyToken, async (req, res) => {
    try {
        const user = await pool.query("SELECT role FROM users WHERE id = $1", [req.user.id]);
        if (user.rows.length === 0) {
            return res.status(404).json({ error: "User not found" });
        }
        res.json({ role: user.rows[0].role });
    } catch (error) {
        console.error("Error fetching role:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// Middleware: Verify JWT Token
function verifyToken(req, res, next) {
    const authHeader = req.headers["authorization"];
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(403).json({ error: "Token required" });
    }

    const token = authHeader.split(" ")[1];
    jwt.verify(token, SECRET_KEY, (err, decoded) => {
        if (err) return res.status(401).json({ error: "Invalid token" });
        req.user = decoded;
        next();
    });
}

// Enforce Admin Role Middleware
function verifyAdmin(req, res, next) {
    if (req.user.role !== "admin") {
        return res.status(403).json({ error: "Admin access required" });
    }
    next();
}

// Delete User (Admin Only)
app.delete("/users/:id", verifyToken, verifyAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const deletedUser = await pool.query("DELETE FROM users WHERE id = $1 RETURNING id", [id]);
        if (deletedUser.rows.length === 0) {
            return res.status(404).json({ error: "User not found" });
        }
        res.json({ message: "User deleted successfully" });
    } catch (error) {
        console.error("Error deleting user:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// Login User
app.post("/auth/login", async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ error: "Email and password are required" });
        }

        const user = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
        if (user.rows.length === 0) {
            return res.status(401).json({ error: "Invalid credentials" });
        }

        const isMatch = await bcrypt.compare(password, user.rows[0].password);
        if (!isMatch) {
            return res.status(401).json({ error: "Invalid credentials" });
        }

        const token = jwt.sign(
            { id: user.rows[0].id, email: user.rows[0].email, role: user.rows[0].role },
            SECRET_KEY,
            { expiresIn: "1h" }
        );

        res.json({ token, role: user.rows[0].role });
    } catch (error) {
        console.error("Error logging in:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// Product Routes
const productRoutes = require("./routes/products");
app.use("/api", productRoutes);

// Connect to PostgreSQL
pool.connect()
    .then(() => console.log("✅ Connected to PostgreSQL"))
    .catch((err) => {
        console.error("❌ Database connection error:", err.message);
        process.exit(1);
    });

// Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
