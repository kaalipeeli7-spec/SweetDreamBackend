// server.js
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const Database = require('better-sqlite3');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// SQLite DB
const db = new Database('events.db');

// Ensure table exists
db.prepare(`
  CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL,
    data TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`).run();

// ✅ Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

// ✅ Add event (APK → Backend)
app.post('/events', (req, res) => {
  const { type, data } = req.body;

  if (!type) {
    return res.status(400).json({ error: 'Event type is required' });
  }

  const stmt = db.prepare('INSERT INTO events (type, data) VALUES (?, ?)');
  const info = stmt.run(type, data || null);

  res.json({ success: true, eventId: info.lastInsertRowid });
});

// ✅ Get all events
app.get('/events', (req, res) => {
  const stmt = db.prepare('SELECT * FROM events ORDER BY timestamp DESC');
  const events = stmt.all();
  res.json(events);
});

// ✅ Update check endpoint
app.all('/update', (req, res) => {
  // Accept both GET & POST
  if (req.method === 'POST') {
    console.log("📩 Update POST received:", req.body);
    return res.json({
      message: "POST update check successful",
      received: req.body,
      latestVersion: "1.0.0"
    });
  }

  // GET fallback
  res.json({
    message: "GET update check successful",
    latestVersion: "1.0.0"
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Backend running on http://localhost:${PORT}`);
});
