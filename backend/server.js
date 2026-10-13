
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

// Upload directory
const uploadsDir = path.join(__dirname, "uploads");
fs.mkdirSync(uploadsDir, { recursive: true });

// File storage configuration
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadsDir);
    },

    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, crypto.randomUUID() + ext);
    }
});

// Allowed file MIME types
const allowedMimeTypes = new Set([
    // Images
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",

    // Audio
    "audio/mpeg",
    "audio/mp3",
    "audio/wav",
    "audio/x-wav",
    "audio/mp4",
    "audio/x-m4a",
    "audio/aac",
    "audio/ogg",
    "audio/webm",
    "audio/flac",
    "audio/3gpp",

    // Video
    "video/mp4",
    "video/webm",
    "video/quicktime",
    "video/x-msvideo",
    "video/x-matroska",
    "video/3gpp",
    "video/ogg",

    // Documents
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/plain",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
]);

// Upload limits: 50 MB per file, maximum 8 files total
const upload = multer({
    storage,

    limits: {
        fileSize: 50 * 1024 * 1024,
        files: 8
    },

    fileFilter: (req, file, cb) => {
        if (!allowedMimeTypes.has(file.mimetype)) {
            return cb(
                new Error(
                    "Unsupported file type: " + file.originalname
                )
            );
        }

        cb(null, true);
    }
});

// Accepted file fields
const uploadEvidence = upload.fields([
    { name: "image", maxCount: 1 },
    { name: "audio", maxCount: 1 },
    { name: "video", maxCount: 1 },
    { name: "documents", maxCount: 5 }
]);

// Middleware
app.use(express.json({ limit: "100kb" }));
app.use(express.urlencoded({ extended: true }));

app.use(express.static(path.join(__dirname, "..")));
app.use("/uploads", express.static(uploadsDir));

// MySQL connection
const db = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
});

db.connect((error) => {
    if (error) {
        console.error("MySQL connection failed:", error.message);
        process.exit(1);
    }

    console.log("MySQL connected successfully!");
    console.log("Connected database:", process.env.DB_NAME);
});

// Helper: remove uploaded files after a failed submission
function deleteUploadedFiles(files) {
    Object.values(files || {}).flat().forEach((file) => {
        fs.unlink(file.path, (error) => {
            if (error) {
                console.error(
                    "File cleanup failed:",
                    error.message
                );
            }
        });
    });
}

// Track complaint
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

        return res.json(results[0]);
    });
});

// Submit complaint with image, audio, video and documents
app.post("/submit-complaint", uploadEvidence, (req, res) => {
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

    const files = req.files || {};

    // Uploaded file paths
    const imagePath = files.image?.[0]
        ? `/uploads/${files.image[0].filename}`
        : null;

    const audioPath = files.audio?.[0]
        ? `/uploads/${files.audio[0].filename}`
        : null;

    const videoPath = files.video?.[0]
        ? `/uploads/${files.video[0].filename}`
        : null;

    const documentPaths = (files.documents || []).map(
        (file) => `/uploads/${file.filename}`
    );

    // Validate required fields
    if (
        !name?.trim() ||
        !email?.trim() ||
        !phone?.trim() ||
        !category ||
        !title?.trim() ||
        !description?.trim() ||
        !["true", "on", "1"].includes(String(terms))
    ) {
        deleteUploadedFiles(files);

        return res.status(400).json({
            message: "Complete the required fields and accept the terms."
        });
    }

    // Insert complaint and evidence paths into MySQL
    const sql = `
        INSERT INTO complaints (
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
            preferred_date,
            preferred_time,
            website,
            satisfaction,
            preferred_color,
            updates,
            terms,
            image_path,
            audio_path,
            video_path,
            documents_path
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        imagePath,
        audioPath,
        videoPath,
        documentPaths.length > 0
            ? JSON.stringify(documentPaths)
            : null
    ];

    db.query(sql, values, (error, result) => {
        if (error) {
            console.error("Database error:", error.message);
            deleteUploadedFiles(files);

            return res.status(500).json({
                message: "Could not save the complaint. Please check the server and database."
            });
        }

        console.log("Complaint saved. ID:", result.insertId);

        console.log("Uploaded evidence:", {
            imagePath,
            audioPath,
            videoPath,
            documentPaths
        });

        return res.status(201).json({
            message: "Complaint submitted successfully!",
            complaintId: result.insertId,
            imagePath,
            audioPath,
            videoPath,
            documentPaths
        });
    });
});

// Handle file upload and server errors
app.use((error, req, res, next) => {
    if (res.headersSent) {
        return next(error);
    }

    if (error instanceof multer.MulterError) {
        if (error.code === "LIMIT_FILE_SIZE") {
            return res.status(400).json({
                message: "Each file must not exceed 50 MB."
            });
        }

        if (
            error.code === "LIMIT_FILE_COUNT" ||
            error.code === "LIMIT_UNEXPECTED_FILE"
        ) {
            return res.status(400).json({
                message: "Too many files or an invalid upload field. Maximum: 1 image, 1 audio, 1 video and 5 documents."
            });
        }

        return res.status(400).json({
            message: "File upload failed: " + error.message
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

// Start server
const server = app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});

// Graceful shutdown
process.on("SIGINT", () => {
    server.close(() => {
        db.end(() => {
            console.log("MySQL connection closed.");
            process.exit(0);
        });
    });
});
