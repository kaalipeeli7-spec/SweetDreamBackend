// renderer.js
async function loadEvents() {
  const eventsEl = document.getElementById('events');
  eventsEl.innerHTML = 'Loading events...';

  try {
    const res = await fetch('https://dd4be9d54949.ngrok-free.app/events', {
      headers: {
        "ngrok-skip-browser-warning": "true"
      }
    });
    if (!res.ok) throw new Error(`Network error: ${res.status}`);
    const events = await res.json();

    if (!events || events.length === 0) {
      eventsEl.innerHTML = '<i>No events yet</i>';
      return;
    }

    eventsEl.innerHTML = events.map(e => {
      const time = new Date(e.timestamp || Date.now()).toLocaleString();
      const data = typeof e.data === 'string' ? e.data : JSON.stringify(e.data);
      return `
        <div class="event">
          <strong>${escapeHtml(e.type)}</strong>
          <small>${time}</small>
          <div>${escapeHtml(data)}</div>
        </div>
      `;
    }).join('');
  } catch (err) {
    eventsEl.innerHTML = `<div style="color:red">⚠️ Error loading events: ${err.message}</div>`;
  }
}

function escapeHtml(unsafe) {
  if (!unsafe) return '';
  return unsafe
    .toString()
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

setInterval(loadEvents, 5000);
window.onload = loadEvents;
