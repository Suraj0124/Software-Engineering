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

// Flash messages middleware
app.use((req, res, next) => {
    res.locals.flash = req.session.flash || null;
    delete req.session.flash;
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
        req.session.flash = { type: 'success', message: '👋 Welcome back, ' + user.name + '!' };
        res.redirect('/');
    });
});

// Logout
app.get("/logout", function(req, res) {
    const name = req.session.user ? req.session.user.name : '';
    req.session.destroy(() => {
        res.redirect('/login');
    });
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
        req.session.flash = { type: 'success', message: '🎉 Welcome, ' + name + '! Account created successfully. Please login.' };
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
        req.session.flash = { type: 'success', message: '✅ Password updated successfully! Please login.' };
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
        req.session.flash = { type: 'success', message: '🔑 Welcome Admin, ' + user.name + '!' };
        res.redirect('/admin/dashboard');
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

// ADMIN DASHBOARD
app.get("/admin/dashboard", requireLogin, requireAdmin, function(req, res) {
    const usersSql = 'SELECT COUNT(*) AS total FROM users';
    const lessonsSql = 'SELECT COUNT(*) AS total FROM lessons';
    const categoriesSql = 'SELECT COUNT(*) AS total FROM categories';
    const recentUsersSql = 'SELECT * FROM users ORDER BY created_at DESC LIMIT 5';
    const topRatedSql = `SELECT lessons.title, AVG(ratings.rating) AS avg_rating, COUNT(ratings.id) AS total_ratings 
                         FROM lessons 
                         LEFT JOIN ratings ON lessons.id = ratings.lesson_id 
                         GROUP BY lessons.id 
                         ORDER BY avg_rating DESC LIMIT 5`;

    db.query(usersSql).then(usersCount => {
        db.query(lessonsSql).then(lessonsCount => {
            db.query(categoriesSql).then(categoriesCount => {
                db.query(recentUsersSql).then(recentUsers => {
                    db.query(topRatedSql).then(topRated => {
                        res.render("adminDashboard", {
                            totalUsers: usersCount[0].total,
                            totalLessons: lessonsCount[0].total,
                            totalCategories: categoriesCount[0].total,
                            recentUsers: recentUsers,
                            topRated: topRated
                        });
                    });
                });
            });
        });
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

// EDIT USER PROFILE
app.post("/users/:id/edit", requireLogin, requireAdmin, function(req, res) {
    const userId = req.params.id;
    const { name, skill_level } = req.body;
    const sql = 'UPDATE users SET name = ?, skill_level = ? WHERE id = ?';
    db.query(sql, [name, skill_level, userId]).then(results => {
        req.session.flash = { type: 'success', message: '✅ Profile updated successfully!' };
        res.redirect('/users/' + userId);
    });
});

// 3. LESSONS LISTING PAGE
app.get("/lessons", requireLogin, function(req, res) {
    const sql = `SELECT lessons.*, categories.name AS category_name,
           AVG(ratings.rating) AS avg_rating, COUNT(ratings.id) AS rating_count
           FROM lessons 
           JOIN categories ON lessons.category_id = categories.id
           LEFT JOIN ratings ON lessons.id = ratings.lesson_id
           GROUP BY lessons.id`;
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

app.post("/lessons/:id/notes", requireLogin, function(req, res) {
    const lessonId = req.params.id;
    const userId = req.session.user.id;
    const noteText = req.body.note_text ? req.body.note_text.trim().slice(0, 1000) : '';
    if (!noteText) {
        return res.redirect('/lessons/' + lessonId);
    }
    const sql = `
        INSERT INTO user_notes (user_id, lesson_id, note_text)
        VALUES (?, ?, ?)
        ON DUPLICATE KEY UPDATE note_text = VALUES(note_text), updated_at = NOW()`;
    db.query(sql, [userId, lessonId, noteText]).then(() => {
        req.session.flash = { type: 'success', message: '📝 Note saved!' };
        res.redirect('/lessons/' + lessonId);
    }).catch(err => {
        console.error('Note save error:', err);
        res.redirect('/lessons/' + lessonId);
    });
});

// 5. CATEGORIES PAGE
app.get("/categories", requireLogin, function(req, res) {
    const sql = `SELECT categories.*, COUNT(lessons.id) AS lesson_count 
                 FROM categories 
                 LEFT JOIN lessons ON categories.id = lessons.category_id 
                 GROUP BY categories.id`;
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
        req.session.flash = { type: 'success', message: '⭐ Thanks for rating this lesson!' };
        res.redirect('/lessons/' + lessonId);
    });
});

// MY PROFILE PAGE - for logged in user
app.get("/my-profile", requireLogin, function(req, res) {
    const userId = req.session.user.id;
    const userSql = 'SELECT * FROM users WHERE id = ?';
    const progressSql = `
        SELECT lessons.title, progress.completed, progress.completed_at 
        FROM progress 
        JOIN lessons ON progress.lesson_id = lessons.id 
        WHERE progress.user_id = ?`;
    
    db.query(userSql, [userId]).then(userResults => {
        db.query(progressSql, [userId]).then(progressResults => {
            res.render("myProfile", { 
                user: userResults[0], 
                progress: progressResults 
            });
        });
    });
});
// ── CHAT ROUTES ──
app.get("/chat/messages", requireLogin, function(req, res) {
    const sql = `SELECT chat_messages.*, users.name AS username FROM chat_messages JOIN users ON chat_messages.user_id = users.id ORDER BY chat_messages.created_at DESC LIMIT 50`;
    db.query(sql).then(results => {
        res.json(results.reverse());
    }).catch(() => res.json([]));
});

app.post("/chat/send", requireLogin, function(req, res) {
    const userId = req.session.user.id;
    const username = req.session.user.name;
    const message = req.body.message ? req.body.message.trim().slice(0, 300) : '';
    if (!message) return res.json({ success: false });
    db.query('INSERT INTO chat_messages (user_id, username, message) VALUES (?, ?, ?)', [userId, username, message]).then(() => {
        res.json({ success: true });
    }).catch(err => {
        console.error(err);
        res.json({ success: false });
    });
});

// ── LIVE ROUTES ──
app.get("/live", requireLogin, function(req, res) {
    const userId = req.session.user.id;
    const activeSql = `SELECT users.name, TIMESTAMPDIFF(MINUTE, MAX(ps.last_active), NOW()) AS minutes_ago FROM practice_sessions ps JOIN users ON ps.user_id = users.id WHERE ps.last_active >= DATE_SUB(NOW(), INTERVAL 10 MINUTE) AND ps.user_id != ? GROUP BY ps.user_id, users.name ORDER BY minutes_ago ASC LIMIT 10`;
    const liveSql = `SELECT * FROM live_sessions WHERE is_live = 1 ORDER BY created_at DESC LIMIT 1`;
    const pastSql = `SELECT * FROM live_sessions WHERE is_live = 0 ORDER BY created_at DESC LIMIT 5`;
    const todayPracticeSql = `SELECT COUNT(*) AS total FROM practice_sessions WHERE DATE(last_active) = CURDATE()`;
    const todayCompletionsSql = `SELECT COUNT(*) AS total FROM lesson_completions WHERE DATE(completed_at) = CURDATE()`;
    const totalUsersSql = `SELECT COUNT(*) AS total FROM users`;
    db.query(activeSql, [userId]).then(activePracticers => {
        db.query(liveSql).then(liveResults => {
            db.query(pastSql).then(pastSessions => {
                db.query(todayPracticeSql).then(todayPractice => {
                    db.query(todayCompletionsSql).then(todayCompletions => {
                        db.query(totalUsersSql).then(totalUsers => {
                            res.render("live", {
                                activePracticers: activePracticers,
                                liveSession: liveResults[0] || null,
                                pastSessions: pastSessions,
                                todayPractice: todayPractice[0].total,
                                todayCompletions: todayCompletions[0].total,
                                totalUsers: totalUsers[0].total
                            });
                        });
                    });
                });
            });
        });
    });
});

app.get("/live/active-count", requireLogin, function(req, res) {
    const sql = `SELECT COUNT(DISTINCT user_id) AS count FROM practice_sessions WHERE last_active >= DATE_SUB(NOW(), INTERVAL 10 MINUTE)`;
    db.query(sql).then(results => {
        res.json({ count: results[0].count });
    }).catch(() => res.json({ count: 0 }));
});

app.get("/live/create", requireLogin, requireAdmin, function(req, res) {
    const sql = `SELECT * FROM live_sessions WHERE is_live = 1 ORDER BY created_at DESC LIMIT 1`;
    db.query(sql).then(results => {
        res.render("liveCreate", { currentLive: results[0] || null });
    });
});

app.post("/live/create", requireLogin, requireAdmin, function(req, res) {
    const { title, stream_url, description, is_live } = req.body;
    const userId = req.session.user.id;
    db.query(`UPDATE live_sessions SET is_live = 0 WHERE is_live = 1`).then(() => {
        return db.query(`INSERT INTO live_sessions (title, stream_url, description, is_live, created_by) VALUES (?, ?, ?, ?, ?)`, [title, stream_url || null, description || null, is_live == '1' ? 1 : 0, userId]);
    }).then(() => {
        req.session.flash = { type: 'success', message: is_live == '1' ? '🔴 You are now LIVE!' : '📅 Session saved!' };
        res.redirect('/live');
    }).catch(err => {
        console.error('Live session error:', err);
        res.redirect('/live/create');
    });
});

app.post("/live/:id/end", requireLogin, requireAdmin, function(req, res) {
    const sessionId = req.params.id;
    db.query(`UPDATE live_sessions SET is_live = 0 WHERE id = ?`, [sessionId]).then(() => {
        req.session.flash = { type: 'success', message: '⏹ Live session ended.' };
        res.redirect('/live');
    });
});

// 404 PAGE
app.use(function(req, res) {
    res.status(404).render("404");
});

// Start server on port 3000
app.listen(3000, function(){
    console.log(`Server running at http://127.0.0.1:3000/`);
});