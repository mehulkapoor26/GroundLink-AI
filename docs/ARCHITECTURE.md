# Architecture

## Runtime shape

```text
Browser (React + Vite) ── same-origin API / Socket.IO ── Express + Socket.IO host
        │                                                   │
        └── IndexedDB message cache                         └── backend/src/data/store.json
```

The host machine serves as the local coordinator. In development, Vite binds to `0.0.0.0:5173` and proxies `/api` and `/socket.io` to Express on port 8000. In production, Express serves `backend/dist` and the APIs from port 8000. The browser uses relative API URLs and a same-origin Socket.IO connection, so LAN clients do not need a hardcoded host address in code.

## Backend modules

- `config/`: host and port configuration.
- `routes/`: HTTP health, groups, message history, and group SOS endpoints.
- `sockets/`: group joins, presence, message broadcasts, and group SOS updates.
- `services/storage.js`: serialized JSON read/write operations to avoid concurrent write races in the initial single-host store.
- `utils/`: ID helpers.

The in-memory presence map is transient. Groups and messages are written to the local JSON file. The JSON store is an initial persistence adapter and should be replaced behind the service interface before production scale or multi-process use.

## Frontend modules

- `app/`: dashboard composition and feature navigation.
- `components/`: shared brand, navigation, modal, and card UI.
- `features/`: independently owned UI per major feature.
- `services/`: same-origin API, Socket.IO, and IndexedDB access.
- `utils/`: feature metadata and shared helpers.
- `styles/`: local CSS only; no font or runtime CDN dependency.

## Realtime contract

- Client emits `group:join` with `{ code, name }`; server acknowledges `{ ok, group, member }` and broadcasts `members:update`.
- Client emits `message:send` with `{ text, clientId }`; server validates, persists, then broadcasts `message:new` and acknowledges success.
- SOS clients fetch group history from `/api/emergency-sos/:code`. They emit `sos:create`, `sos:acknowledge`, or `sos:resolve`; the server persists each update before broadcasting `sos:created` or `sos:updated` to the group room.
- Socket disconnect removes the member from the transient presence list.

## Offline boundary

This app requires a reachable host on the same local network. It does not use cloud services or external APIs. A disconnected browser can read its IndexedDB message cache, but this foundation does not queue or synchronize messages created while disconnected. QR invite URLs resolve only while the local host is reachable.
