const jwt = require("jsonwebtoken");

const SECRET_KEY = process.env.JWT_SECRET || "root";

// Middleware: Authenticate User
const authenticateUser = (req, res, next) => {
    const authHeader = req.headers["authorization"];
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(403).json({ error: "Token required. Please log in." });
    }

    const token = authHeader.split(" ")[1];
    jwt.verify(token, SECRET_KEY, (err, decoded) => {
        if (err) return res.status(401).json({ error: "Invalid or expired token." });
        req.user = decoded;
        next();
    });
};

// Middleware: Authorize Admin
const authorizeAdmin = (req, res, next) => {
    if (!req.user || req.user.role !== "admin") {
        return res.status(403).json({ error: "Admin access required." });
    }
    next();
};

module.exports = { authenticateUser, authorizeAdmin };
