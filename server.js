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

// SQLite (better-sqlite3) init
const db = new Database("sweetdream.db");

// ✅ Ensure tables exist
db.prepare(
  "CREATE TABLE IF NOT EXISTS events (id INTEGER PRIMARY KEY AUTOINCREMENT, type TEXT, data TEXT, timestamp DATETIME DEFAULT CURRENT_TIMESTAMP)"
).run();

db.prepare(
  "CREATE TABLE IF NOT EXISTS commands (id INTEGER PRIMARY KEY AUTOINCREMENT, commandId TEXT, commandType TEXT, payload TEXT, status TEXT, createdAt DATETIME DEFAULT CURRENT_TIMESTAMP, deliveredAt DATETIME)"
).run();

console.log("✅ SQLite (better-sqlite3) initialized");

// Firebase init
try {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SA);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
  console.log("✅ Firebase Admin initialized");
} catch (err) {
  console.error("⚠️ Firebase init failed:", err.message);
}

// ================== EVENTS ==================
app.post("/events", (req, res) => {
  try {
    const { type, data } = req.body;
    db.prepare("INSERT INTO events (type, data) VALUES (?, ?)").run(
      type,
      JSON.stringify(data)
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get("/events", (req, res) => {
  try {
    const rows = db
      .prepare("SELECT * FROM events ORDER BY id DESC LIMIT 50")
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
      .prepare("SELECT * FROM commands WHERE status = 'pending'")
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

// ================== AUDIO UPLOAD ==================
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

// ================== CAMERA UPLOAD ==================
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
  const files = fs.readdirSync(dir).map((f) => ({
    name: f,
    url: `/download/camera/${f}`,
  }));
  res.json(files);
});

app.get("/download/camera/:filename", (req, res) => {
  const filePath = path.join(__dirname, "uploads", "camera", req.params.filename);
  if (!fs.existsSync(filePath))
    return res.status(404).json({ success: false, error: "File not found" });
  res.download(filePath);
});

// ================== START SERVER ==================
app.listen(PORT, () => {
  console.log(`🚀 SweetDream Backend running at http://localhost:${PORT}`);
});
