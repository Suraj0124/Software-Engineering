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

// Create a route for root - /
app.get("/", function(req, res) {
    res.render("index");
});

// Create a route for testing the db
app.get("/db_test", function(req, res) {
    sql = 'select * from test_table';
    db.query(sql).then(results => {
        console.log(results);
        res.send(results)
    });
});

// Create a route for /goodbye
app.get("/goodbye", function(req, res) {
    res.send("Goodbye world!");
});

// Create a dynamic route for /hello/<name>
app.get("/hello/:name", function(req, res) {
    console.log(req.params);
    res.send("Hello " + req.params.name);
});

// =======================================
// SPRINT 3 ROUTES
// =======================================

// 1. USERS LIST PAGE - shows all users
app.get("/users", function(req, res) {
    sql = 'SELECT * FROM users';
    db.query(sql).then(results => {
        res.render("users", { users: results });
    });
});

// 2. USER PROFILE PAGE - shows a single user
app.get("/users/:id", function(req, res) {
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

// 3. LESSONS LISTING PAGE - shows all lessons
app.get("/lessons", function(req, res) {
    sql = `SELECT lessons.*, categories.name AS category_name 
           FROM lessons 
           JOIN categories ON lessons.category_id = categories.id`;
    db.query(sql).then(results => {
        res.render("lessons", { lessons: results });
    });
});

// 4. LESSON DETAIL PAGE - shows a single lesson
app.get("/lessons/:id", function(req, res) {
    const lessonId = req.params.id;
    sql = `SELECT lessons.*, categories.name AS category_name 
           FROM lessons 
           JOIN categories ON lessons.category_id = categories.id
           WHERE lessons.id = ?`;
    db.query(sql, [lessonId]).then(results => {
        res.render("lessonDetail", { lesson: results[0] });
    });
});

// 5. CATEGORIES PAGE - shows all categories
app.get("/categories", function(req, res) {
    sql = 'SELECT * FROM categories';
    db.query(sql).then(results => {
        res.render("categories", { categories: results });
    });
});

// 6. LESSONS BY CATEGORY
app.get("/categories/:id", function(req, res) {
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

// Start server on port 3000
app.listen(3000,function(){
    console.log(`Server running at http://127.0.0.1:3000/`);
});