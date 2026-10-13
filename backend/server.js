require("dotenv").config({
    path: require("path").join(__dirname, "..", ".env")
});

const express = require("express");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const mysql = require("mysql2");
const multer = require("multer");

const app = express();
app.disable("x-powered-by");

const PORT = process.env.PORT || 3000;

const uploadsDir = path.join(__dirname, "uploads");
fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, crypto.randomUUID() + ext);
    }
});

const upload = multer({
    storage,
    limits: {
        fileSize: 5 * 1024 * 1024
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = [
            "image/jpeg",
            "image/png",
            "image/gif",
            "image/webp"
        ];

        if (!allowedTypes.includes(file.mimetype)) {
            return cb(new Error("Only JPG, PNG, GIF, and WEBP images are allowed."));
        }

        cb(null, true);
    }
});

app.use(express.json({ limit: "100kb" }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "..")));
app.use("/uploads", express.static(uploadsDir));

const db = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
});

db.connect((error) => {
    if (error) {
        console.error("MySQL connection failed:", error.message);
        console.error("Server cannot save or track complaints.");
        process.exit(1);
    }

    console.log("MySQL connected successfully!");
    console.log("Connected database:", process.env.DB_NAME);
});

    console.log("MySQL connected successfully!");


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

app.post("/submit-complaint", upload.single("image"), (req, res) => {
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

    const imagePath = req.file
        ? `/uploads/${req.file.filename}`
        : null;

    console.log(
        "Uploaded image:",
        req.file ? req.file.filename : "No image uploaded"
    );

    if (
        !name?.trim() ||
        !email?.trim() ||
        !phone?.trim() ||
        !category ||
        !title?.trim() ||
        !description?.trim() ||
        !["true", "on", "1"].includes(String(terms))
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
            satisfaction, preferred_color, updates, terms,
            image_path
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        satisfaction !== undefined &&
        satisfaction !== "" &&
        Number.isFinite(Number(satisfaction))
            ? Number(satisfaction)
            : null,
        color || null,
        ["true", "on", "1"].includes(String(updates)) ? 1 : 0,
        1,
        imagePath
    ];

    db.query(sql, values, (error, result) => {
        if (error) {
            console.error("Database error:", error.message);

            if (req.file) {
                fs.unlink(req.file.path, (unlinkError) => {
                    if (unlinkError) {
                        console.error("Uploaded file cleanup failed:", unlinkError.message);
                    }
                });
            }

            return res.status(500).json({
                message: "Could not save the complaint. Please try again."
            });
        }

        console.log("Complaint saved. ID:", result.insertId);
        console.log("Image path saved:", imagePath);

        return res.status(201).json({
            message: "Complaint submitted successfully!",
            complaintId: result.insertId,
            imagePath
        });
    });
});

app.use((error, req, res, next) => {
    if (error instanceof multer.MulterError) {
        if (error.code === "LIMIT_FILE_SIZE") {
            return res.status(400).json({
                message: "Image size must not exceed 5 MB."
            });
        }

        return res.status(400).json({
            message: "Image upload failed: " + error.message
        });
    }

    if (error) {
        console.error("Request error:", error.message);

        return res.status(400).json({
            message: error.message || "Unable to process your request."
        });
    }

    next();
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