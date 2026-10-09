const express = require("express");
const mysql = require("mysql2");
const path = require("path");

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/", function(req, res) {
    res.sendFile(path.join(__dirname, "..", "index.html"));
});

app.use(express.static(path.join(__dirname, "..")));

const db = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "nikitha1281",
    database: "student_db"
});

db.connect(function(error) {
    if (error) {
        console.log("MySQL connection failed:", error);
    } else {
        console.log("MySQL connected successfully!");
    }
});

app.post("/register", function(req, res) {

    console.log(req.body);

    const {
        name,
        registerNumber,
        email,
        password,
        age,
        dob,
        gender,
        department,
        address,
        mobile
    } = req.body;

    const sql = `
        INSERT INTO students
        (name, register_number, email, password, age, dob, gender, department, address, mobile)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    db.query(
        sql,
        [
            name,
            registerNumber,
            email,
            password,
            age,
            dob,
            gender,
            department,
            address,
            mobile
        ],
        function(error, result) {

            if (error) {
                console.log("Database error:", error);
                res.status(500).send("Registration failed");
            } else {
                console.log("Student registered. ID:", result.insertId);
                res.send("Registration successful");
            }

        }
    );
});

app.listen(3000, function() {
    console.log("Server running at http://localhost:3000");
});