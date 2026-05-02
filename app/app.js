// Import express.js
const express = require("express");

// Create express app
var app = express();

// Add static files location
app.use(express.static("static"));

// Use pug templates
app.set('view engine', 'pug');
app.set('views', '/src/app/Views');

// Get the functions in the db.js file to use
const db = require('./services/db');

// Session and auth
const session = require('express-session');
const bcrypt = require('bcryptjs');

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(session({
    secret: 'nepali-hami-secret',
    resave: false,
    saveUninitialized: false
}));

// Make session user available in all views
app.use((req, res, next) => {
    res.locals.sessionUser = req.session.user;
    next();
});

// =======================================
// PROTECT ROUTES MIDDLEWARE
// =======================================
function requireLogin(req, res, next) {
    if (req.session.user) {
        next();
    } else {
        res.redirect('/login');
    }
}

function requireAdmin(req, res, next) {
    if (req.session.user && req.session.user.is_admin) {
        next();
    } else {
        res.redirect('/');
    }
}

// =======================================
// AUTH ROUTES (no login required)
// =======================================

// Login page
app.get("/login", function(req, res) {
    if (req.session.user) return res.redirect('/');
    res.render("login", { error: null });
});

// Login form submit
app.post("/login", function(req, res) {
    const { email, password } = req.body;
    const sql = 'SELECT * FROM users WHERE email = ?';
    db.query(sql, [email]).then(results => {
        if (results.length === 0) {
            return res.render("login", { error: "Invalid email or password" });
        }
        const user = results[0];
        const match = bcrypt.compareSync(password, user.password);
        if (!match) {
            return res.render("login", { error: "Invalid email or password" });
        }
        req.session.user = { 
            id: user.id, 
            name: user.name, 
            email: user.email,
            is_admin: user.is_admin 
        };
        res.redirect('/');
    });
});

// Logout
app.get("/logout", function(req, res) {
    req.session.destroy();
    res.redirect('/login');
});

// Register page
app.get("/register", function(req, res) {
    if (req.session.user) return res.redirect('/');
    res.render("register", { error: null });
});

// Register form submit
app.post("/register", function(req, res) {
    const { name, email, password } = req.body;
    const hashedPassword = bcrypt.hashSync(password, 10);
    const sql = 'INSERT INTO users (name, email, password) VALUES (?, ?, ?)';
    db.query(sql, [name, email, hashedPassword]).then(results => {
        res.redirect('/login');
    }).catch(err => {
        res.render("register", { error: "Email already exists" });
    });
});

// Forgot password page
app.get("/forgot", function(req, res) {
    res.render("forgot", { error: null });
});

// Handle reset password
app.post("/forgot", function(req, res) {
    const { email, newPassword } = req.body;
    const hashedPassword = bcrypt.hashSync(newPassword, 10);
    const sql = 'UPDATE users SET password = ? WHERE email = ?';
    db.query(sql, [hashedPassword, email]).then(result => {
        if (result.affectedRows === 0) {
            return res.render("forgot", { error: "Email not found" });
        }
        res.redirect('/login');
    });
});

// Admin login page
app.get("/admin-login", function(req, res) {
    if (req.session.user) return res.redirect('/');
    res.render("adminLogin", { error: null });
});

// Admin login form submit
app.post("/admin-login", function(req, res) {
    const { email, password } = req.body;
    const sql = 'SELECT * FROM users WHERE email = ? AND is_admin = TRUE';
    db.query(sql, [email]).then(results => {
        if (results.length === 0) {
            return res.render("adminLogin", { error: "Invalid admin credentials" });
        }
        const user = results[0];
        const match = bcrypt.compareSync(password, user.password);
        if (!match) {
            return res.render("adminLogin", { error: "Invalid admin credentials" });
        }
        req.session.user = {
            id: user.id,
            name: user.name,
            email: user.email,
            is_admin: user.is_admin
        };
        res.redirect('/users');
    });
});

// =======================================
// PROTECTED ROUTES (login required)
// =======================================

// Home page
app.get("/", requireLogin, function(req, res) {
    res.render("index");
});

// Practice tools page
app.get("/practice", requireLogin, function(req, res) {
    res.render("practice");
});

// DB test
app.get("/db_test", requireLogin, function(req, res) {
    sql = 'select * from test_table';
    db.query(sql).then(results => {
        console.log(results);
        res.send(results)
    });
});

// 1. USERS LIST PAGE - ADMIN ONLY
app.get("/users", requireLogin, requireAdmin, function(req, res) {
    sql = 'SELECT * FROM users';
    db.query(sql).then(results => {
        res.render("users", { users: results });
    });
});

// 2. USER PROFILE PAGE - ADMIN ONLY
app.get("/users/:id", requireLogin, requireAdmin, function(req, res) {
    const userId = req.params.id;
    const userSql = 'SELECT * FROM users WHERE id = ?';
    const progressSql = `
        SELECT lessons.title, progress.completed, progress.completed_at 
        FROM progress 
        JOIN lessons ON progress.lesson_id = lessons.id 
        WHERE progress.user_id = ?`;
    
    db.query(userSql, [userId]).then(userResults => {
        db.query(progressSql, [userId]).then(progressResults => {
            res.render("userProfile", { 
                user: userResults[0], 
                progress: progressResults 
            });
        });
    });
});

// 3. LESSONS LISTING PAGE
app.get("/lessons", requireLogin, function(req, res) {
    sql = `SELECT lessons.*, categories.name AS category_name 
           FROM lessons 
           JOIN categories ON lessons.category_id = categories.id`;
    db.query(sql).then(results => {
        res.render("lessons", { lessons: results });
    });
});

// 4. LESSON DETAIL PAGE
app.get("/lessons/:id", requireLogin, function(req, res) {
    const lessonId = req.params.id;
    const lessonSql = `SELECT lessons.*, categories.name AS category_name 
           FROM lessons 
           JOIN categories ON lessons.category_id = categories.id
           WHERE lessons.id = ?`;
    const ratingSql = `SELECT AVG(rating) AS avg_rating, COUNT(*) AS total_ratings 
                       FROM ratings WHERE lesson_id = ?`;
    const userRatingSql = `SELECT rating FROM ratings WHERE user_id = ? AND lesson_id = ?`;

    db.query(lessonSql, [lessonId]).then(results => {
        db.query(ratingSql, [lessonId]).then(ratingResults => {
            db.query(userRatingSql, [req.session.user.id, lessonId]).then(userRating => {
                res.render("lessonDetail", { 
                    lesson: results[0],
                    avgRating: ratingResults[0].avg_rating ? parseFloat(ratingResults[0].avg_rating).toFixed(1) : null,
                    totalRatings: ratingResults[0].total_ratings,
                    userRating: userRating.length > 0 ? userRating[0].rating : null
                });
            });
        });
    });
});

// 5. CATEGORIES PAGE
app.get("/categories", requireLogin, function(req, res) {
    sql = 'SELECT * FROM categories';
    db.query(sql).then(results => {
        res.render("categories", { categories: results });
    });
});

// 6. LESSONS BY CATEGORY
app.get("/categories/:id", requireLogin, function(req, res) {
    const categoryId = req.params.id;
    const catSql = 'SELECT * FROM categories WHERE id = ?';
    const lessonSql = 'SELECT * FROM lessons WHERE category_id = ?';
    
    db.query(catSql, [categoryId]).then(catResults => {
        db.query(lessonSql, [categoryId]).then(lessonResults => {
            res.render("categories", { 
                category: catResults[0], 
                lessons: lessonResults 
            });
        });
    });
});

// 7. RATE A LESSON
app.post("/lessons/:id/rate", requireLogin, function(req, res) {
    const lessonId = req.params.id;
    const userId = req.session.user.id;
    const rating = req.body.rating;
    const sql = `INSERT INTO ratings (user_id, lesson_id, rating) 
                 VALUES (?, ?, ?) 
                 ON DUPLICATE KEY UPDATE rating = ?`;
    db.query(sql, [userId, lessonId, rating, rating]).then(results => {
        res.redirect('/lessons/' + lessonId);
    });
});

// Start server on port 3000
app.listen(3000, function(){
    console.log(`Server running at http://127.0.0.1:3000/`);
});