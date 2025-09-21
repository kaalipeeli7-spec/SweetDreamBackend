const express = require("express");
const bodyParser = require("body-parser");
const sqlite3 = require("sqlite3").verbose();
const { v4: uuidv4 } = require("uuid");
const admin = require("firebase-admin");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 3000; // 🔹 Use Render's dynamic port

// ================== INIT ==================
app.use(bodyParser.json());

// SQLite init
const db = new sqlite3.Database("sweetdream.db");
db.serialize(() => {
  db.run(
    "CREATE TABLE IF NOT EXISTS events (id INTEGER PRIMARY KEY AUTOINCREMENT, type TEXT, data TEXT, timestamp DATETIME DEFAULT CURRENT_TIMESTAMP)"
  );
  db.run(
    "CREATE TABLE IF NOT EXISTS commands (id INTEGER PRIMARY KEY AUTOINCREMENT, commandId TEXT, commandType TEXT, payload TEXT, status TEXT, createdAt DATETIME DEFAULT CURRENT_TIMESTAMP, deliveredAt DATETIME)"
  );
});
console.log("✅ SQLite initialized");

// Firebase init
try {
  if (!process.env.FIREBASE_SA) {
    console.warn("⚠️ FIREBASE_SA not set, Firebase Admin will not initialize.");
  } else {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SA);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    console.log("✅ Firebase Admin initialized");
  }
} catch (e) {
  console.error("❌ Firebase init error:", e);
}

// ================== EVENTS ==================
app.post("/events", (req, res) => {
  const { type, data } = req.body;
  db.run(
    "INSERT INTO events (type, data) VALUES (?, ?)",
    [type, JSON.stringify(data)],
    function (err) {
      if (err) return res.status(500).json({ success: false, error: err.message });
      res.json({ success: true });
    }
  );
});

app.get("/events", (req, res) => {
  db.all("SELECT * FROM events ORDER BY id DESC LIMIT 50", [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// ================== COMMANDS ==================
app.post("/commands", (req, res) => {
  const { commandType, payload } = req.body;
  const commandId = uuidv4();
  db.run(
    "INSERT INTO commands (commandId, commandType, payload, status) VALUES (?, ?, ?, ?)",
    [commandId, commandType, JSON.stringify(payload || {}), "pending"],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ commandId, status: "pending" });
    }
  );
});

app.get("/commands/pending", (req, res) => {
  db.all("SELECT * FROM commands WHERE status = 'pending'", [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post("/commands/:id/ack", (req, res) => {
  const { id } = req.params;
  db.run(
    "UPDATE commands SET status = ?, deliveredAt = datetime('now','localtime') WHERE commandId = ?",
    ["delivered", id],
    function (err) {
      if (err) return res.status(500).json({ success: false, error: err.message });
      res.json({ success: true });
    }
  );
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
  if (!req.file) return res.status(400).json({ success: false, error: "No file uploaded" });
  res.json({ success: true, path: req.file.path });
});

app.get("/download/audio/:filename", (req, res) => {
  const filePath = path.join(__dirname, "uploads", "audio", req.params.filename);
  if (!fs.existsSync(filePath)) return res.status(404).json({ success: false, error: "File not found" });
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
  if (!req.file) return res.status(400).json({ success: false, error: "No file uploaded" });
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
  if (!fs.existsSync(filePath)) return res.status(404).json({ success: false, error: "File not found" });
  res.download(filePath);
});

// ================== START SERVER ==================
app.listen(PORT, () => {
  console.log(`🚀 SweetDream Backend running at http://localhost:${PORT}`);
});
