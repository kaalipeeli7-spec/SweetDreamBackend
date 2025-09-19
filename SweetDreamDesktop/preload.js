const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("api", {
  backendUrl: "http://localhost:5000" // ✅ default backend API
});
