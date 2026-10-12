require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });

const express = require("express");
const path = require("path");
const mysql = require("mysql2");

const app = express();
app.disable("x-powered-by");
const PORT = 3000;

app.use(express.json({ limit: "100kb" }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "..")));

const db = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
});

db.connect((error) => {
    if (error) {
        console.error("MySQL connection failed:", error.message);
        return;
    }

    console.log("MySQL connected successfully!");
});

app.get("/track-complaint/:id", (req, res) => {
    const id = Number(req.params.id);

    if (!Number.isSafeInteger(id) || id < 1) {
        return res.status(400).json({
            message: "Enter a valid Complaint ID."
        });
    }

    const sql = "SELECT * FROM complaints WHERE id = ?";

    db.query(sql, [id], (error, results) => {
        if (error) {
            console.error("Tracking error:", error.message);

            return res.status(500).json({
                message: "Unable to retrieve complaint details."
            });
        }

        if (results.length === 0) {
            return res.status(404).json({
                message: "Complaint not found. Check the Complaint ID."
            });
        }

        res.json(results[0]);
    });
});

app.post("/submit-complaint", (req, res) => {
    console.log("POST /submit-complaint received");
    const {
        name,
        email,
        phone,
        customer_id,
        category,
        service,
        title,
        description,
        priority,
        address,
        city,
        state,
        pincode,
        date,
        time,
        website,
        satisfaction,
        color,
        updates,
        terms
    } = req.body;

    if (
        !name?.trim() ||
        !email?.trim() ||
        !phone?.trim() ||
        !category ||
        !title?.trim() ||
        !description?.trim() ||
        terms !== true
    ) {
        return res.status(400).json({
            message: "Complete the required fields and accept the terms."
        });
    }

    const sql = `
        INSERT INTO complaints (
            name, email, phone, customer_id,
            category, service, title, description,
            priority, address, city, state, pincode,
            preferred_date, preferred_time, website,
            satisfaction, preferred_color, updates, terms
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const values = [
        name.trim(),
        email.trim(),
        phone.trim(),
        customer_id?.trim() || null,
        category,
        service || null,
        title.trim(),
        description.trim(),
        priority || "medium",
        address?.trim() || null,
        city?.trim() || null,
        state || null,
        pincode?.trim() || null,
        date || null,
        time || null,
        website?.trim() || null,
        Number.isFinite(Number(satisfaction))
            ? Number(satisfaction)
            : null,
        color || null,
        updates === true ? 1 : 0,
        1
    ];

    db.query(sql, values, (error, result) => {
        if (error) {
            console.error("Database error:", error.message);

            return res.status(500).json({
                message: "Could not save the complaint. Please try again."
            });
        }

        console.log("Complaint saved. ID:", result.insertId);

        res.status(201).json({
            message: "Complaint submitted successfully!",
            complaintId: result.insertId
        });
    });
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});

process.on("SIGINT", () => {
    db.end(() => {
        console.log("MySQL connection closed.");
        process.exit(0);
    });
});