# GroundLink AI

GroundLink AI is an offline-first coordination foundation for devices connected to the same local Wi-Fi network or mobile hotspot. The host device runs the Node server; other devices open the host's local IPv4 address in a browser. Internet access is not required after dependencies have been installed.

## What works today

- Create a local group and join it with a unique invite code.
- Generate a QR code containing the same-origin group invite URL.
- Send and receive real-time group messages over Socket.IO.
- See current group members and connection status.
- Persist groups and messages in local JSON on the host, with a browser IndexedDB message cache.
- Navigate placeholder modules for attendance, voice notes, venue navigation, SOS, and administration.

The placeholder modules are not implemented features. JSON persistence is intended for a single host and early development; it is not a multi-host database or a backup system.

## Requirements

- Node.js 18 or newer and npm.
- A Wi-Fi router or hotspot that allows clients to communicate with one another.

## Run in development

```sh
npm install
npm run dev
```

Vite serves the interface on port 5173 and proxies API and Socket.IO traffic to Express on port 8000. Open `http://localhost:5173` on the host computer.

## Run the production build

```sh
npm run build
npm start
```

Express serves the built frontend and API on port 8000. Open `http://localhost:8000` on the host computer.

## Local network test

1. Connect the host computer and phones/laptops to the same Wi-Fi or hotspot.
2. Find the host's local IPv4 address (`ipconfig` on Windows; `ipconfig getifaddr en0` on many macOS Wi-Fi setups, or inspect Network settings).
3. Start with `npm run dev` and open `http://HOST_IPV4:5173` from another device. For the built server, use `http://HOST_IPV4:8000`.
4. Allow Node through the host firewall for private/local networks if prompted.
5. Create a group on one device. Join from another using the displayed code or scan/copy the invite URL.
6. Send messages from both clients and verify online members update as clients connect or disconnect.

If your phone cannot reach the page, check that the hotspot permits client-to-client traffic and that devices are on the same subnet. A browser page over plain local HTTP is suitable for this foundation; browser APIs that require a secure context may need HTTPS later.

## Health check

```sh
curl http://localhost:8000/api/health
```

## Environment

Copy `.env.example` to `.env` to override the defaults. The service binds to `0.0.0.0` and uses port `8000` by default.

## GitHub initialization

```sh
git init
git add .
git commit -m "Build GroundLink AI foundation"
git branch -M main
git remote add origin https://github.com/YOUR_ORG/groundlink-ai.git
git push -u origin main
```

## Team workflow

Read [CONTRIBUTING.md](CONTRIBUTING.md) and [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) before taking a feature. Each feature has its own frontend module and should keep service/API changes small and coordinated.
