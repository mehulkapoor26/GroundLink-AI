import { io } from "socket.io-client";

// Keep Socket.IO same-origin so HTTPS clients connect to Vite, which proxies
// both polling and WebSocket traffic to the plain-HTTP backend.
export const socket = io(window.location.origin, {
  autoConnect: false,
  path: "/socket.io/",
  // Start with polling and upgrade when the WebSocket proxy is available.
  transports: ["polling", "websocket"],
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 800,
});
