
require("dotenv").config();

const express = require("express");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const mysql = require("mysql2");
const multer = require("multer");

const app = express();
app.disable("x-powered-by");

const PORT = process.env.PORT || 3000;
const ROOT_DIR = path.join(__dirname, "..");
const UPLOAD_DIR = path.join(__dirname, "uploads");

fs.mkdirSync(UPLOAD_DIR, { recursive: true });

app.use(express.json({ limit: "100kb" }));
app.use(express.urlencoded({ extended: true }));

// Serve HTML, CSS and JavaScript.
app.use(express.static(ROOT_DIR));

// Serve uploaded files.
app.use("/uploads", express.static(UPLOAD_DIR));


// ---------------- MYSQL CONNECTION ----------------

const db = mysql.createConnection({
    host: process.env.DB_HOST || "localhost",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || "complaints_db"
});

db.connect((error) => {
    if (error) {
        console.error("MySQL connection failed:", error.message);
        return;
    }

    console.log("MySQL connected successfully!");
});


// ---------------- FILE UPLOAD CONFIGURATION ----------------

const allowedExtensions = new Set([
    ".jpg", ".jpeg", ".png", ".webp",
    ".mp3", ".wav", ".m4a", ".ogg",
    ".mp4", ".webm", ".mov",
    ".pdf", ".doc", ".docx", ".txt"
]);

const allowedMimeTypes = new Set([
    "image/jpeg",
    "image/png",
    "image/webp",
    "audio/mpeg",
    "audio/wav",
    "audio/x-wav",
    "audio/mp4",
    "audio/ogg",
    "audio/webm",
    "video/mp4",
    "video/webm",
    "video/quicktime",
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/plain"
]);

const storage = multer.diskStorage({
    destination: (req, file, callback) => {
        callback(null, UPLOAD_DIR);
    },

    filename: (req, file, callback) => {
        const extension = path.extname(file.originalname).toLowerCase();
        callback(null, crypto.randomUUID() + extension);
    }
});

const upload = multer({
    storage,

    limits: {
        files: 7,
        fileSize: 20 * 1024 * 1024
    },

    fileFilter: (req, file, callback) => {
        const extension = path.extname(file.originalname).toLowerCase();

        if (
            allowedExtensions.has(extension) &&
            allowedMimeTypes.has(file.mimetype)
        ) {
            return callback(null, true);
        }

        callback(new Error(
            "Unsupported file type: " + file.originalname
        ));
    }
}).fields([
    { name: "image", maxCount: 1 },
    { name: "audio", maxCount: 1 },
    { name: "video", maxCount: 1 },
    { name: "documents", maxCount: 4 }
]);


// ---------------- HELPER FUNCTIONS ----------------

function asText(value) {
    return typeof value === "string" ? value.trim() : "";
}

function optionalText(value) {
    return asText(value) || null;
}

function getFilePath(req, fieldName) {
    const file = req.files?.[fieldName]?.[0];

    return file ? "/uploads/" + file.filename : null;
}

function getDocumentPaths(req) {
    return (req.files?.documents || []).map(
        file => "/uploads/" + file.filename
    );
}

function removeUploadedFiles(req) {
    for (const files of Object.values(req.files || {})) {
        for (const file of files) {
            fs.unlink(file.path, (error) => {
                if (error) {
                    console.error(
                        "Could not remove uploaded file:",
                        error.message
                    );
                }
            });
        }
    }
}

function validDate(value) {
    if (!value) return null;

    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return undefined;
    }

    const parsed = new Date(value + "T00:00:00Z");

    if (
        Number.isNaN(parsed.getTime()) ||
        parsed.toISOString().slice(0, 10) !== value
    ) {
        return undefined;
    }

    return value;
}

function validTime(value) {
    if (!value) return null;

    return /^([01]\d|2[0-3]):[0-5]\d$/.test(value)
        ? value
        : undefined;
}

function checkboxValue(value) {
    return ["true", "on", "1"].includes(String(value)) ? 1 : 0;
}


// ---------------- SUBMIT COMPLAINT ----------------

app.post("/submit-complaint", (req, res) => {
    upload(req, res, (uploadError) => {
        if (uploadError) {
            removeUploadedFiles(req);

            console.error("Upload error:", uploadError.message);

            return res.status(400).json({
                message: uploadError.message
            });
        }

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

        const acceptedTerms = checkboxValue(terms) === 1;

        const preferredDate = validDate(date);
        const preferredTime = validTime(time);

        const rating = Number(satisfaction);

        if (
            !asText(name) ||
            asText(name).length > 100 ||
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(asText(email)) ||
            asText(email).length > 150 ||
            !asText(phone) ||
            asText(phone).length > 20 ||
            !asText(category) ||
            asText(category).length > 100 ||
            !asText(title) ||
            asText(title).length > 200 ||
            !asText(description) ||
            !acceptedTerms ||
            preferredDate === undefined ||
            preferredTime === undefined ||
            !Number.isInteger(rating) ||
            rating < 1 ||
            rating > 10
        ) {
            removeUploadedFiles(req);

            return res.status(400).json({
                message:
                    "Please check required fields, date, time, satisfaction rating, and terms."
            });
        }

        const imagePath = getFilePath(req, "image");
        const audioPath = getFilePath(req, "audio");
        const videoPath = getFilePath(req, "video");

        const documentPaths = getDocumentPaths(req);

        // Store multiple document paths as a JSON array.
        const documentPath = documentPaths.length
            ? JSON.stringify(documentPaths)
            : null;

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
                document_path
            )
            VALUES (
                ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
            )
        `;

        const values = [
            asText(name),
            asText(email),
            asText(phone),
            optionalText(customer_id),
            asText(category),
            optionalText(service),
            asText(title),
            asText(description),
            optionalText(priority) || "medium",
            optionalText(address),
            optionalText(city),
            optionalText(state),
            optionalText(pincode),
            preferredDate,
            preferredTime,
            optionalText(website),
            rating,
            optionalText(color),
            checkboxValue(updates),
            1,
            imagePath,
            audioPath,
            videoPath,
            documentPath
        ];

        db.query(sql, values, (error, result) => {
            if (error) {
                console.error("Database error:", error.message);
                removeUploadedFiles(req);

                return res.status(500).json({
                    message:
                        "Could not save complaint. Check your MySQL table columns."
                });
            }

            console.log("Complaint saved. ID:", result.insertId);

            return res.status(201).json({
                message: "Complaint submitted successfully!",
                complaintId: result.insertId
            });
        });
    });
});


// ---------------- TRACK COMPLAINT ----------------

app.get("/track-complaint/:id", (req, res) => {
    const id = Number(req.params.id);

    if (!Number.isSafeInteger(id) || id < 1) {
        return res.status(400).json({
            message: "Enter a valid Complaint ID."
        });
    }

    db.query(
        "SELECT * FROM complaints WHERE id = ?",
        [id],
        (error, results) => {
            if (error) {
                console.error("Tracking error:", error.message);

                return res.status(500).json({
                    message: "Unable to retrieve complaint details."
                });
            }

            if (results.length === 0) {
                return res.status(404).json({
                    message: "Complaint not found."
                });
            }

            return res.json(results[0]);
        }
    );
});


// ---------------- SERVER ERROR HANDLER ----------------

app.use((error, req, res, next) => {
    console.error("Server error:", error.message);

    if (res.headersSent) {
        return next(error);
    }

    return res.status(500).json({
        message: "An unexpected server error occurred."
    });
});


// ---------------- START SERVER ----------------

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});

process.on("SIGINT", () => {
    db.end(() => {
        console.log("MySQL connection closed.");
        process.exit(0);
    });
});


