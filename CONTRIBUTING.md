# Contributing

GroundLink AI is organized so contributors can work in feature areas without broad cross-cutting edits.

## Workflow for a five-person team

Suggested ownership areas:

1. Messaging and local message storage: `frontend/src/features/messaging/`, `frontend/src/services/localDb.js`, `backend/src/sockets/`.
2. QR joining and group lifecycle: `frontend/src/features/qr-joining/`, `frontend/src/features/group-management/`, `backend/src/routes/groups.js`.
3. QR attendance: `frontend/src/features/qr-attendance/`.
4. Voice and offline directions: `frontend/src/features/voice-messages/`, `frontend/src/features/offline-directions/`.
5. SOS, admin, and integration: `frontend/src/features/emergency-sos/`, `frontend/src/features/admin-dashboard/`, shared app shell/docs.

Create focused branches such as `feature/qr-attendance`, keep changes within the owned module where possible, and open a review before merging. Coordinate edits to shared routing, app shell, global styles, and backend persistence with the team.

## Local setup

Use Node.js 18+ and npm. Run `npm install`, then `npm run dev`. See the README for LAN setup and production commands.

## Conventions

- Keep feature-specific UI and logic inside that feature's folder.
- Put cross-feature transport and persistence code in `services/` or backend services.
- Avoid external APIs, hosted databases, external fonts, and CDNs. The host server is the local source of truth.
- Keep API and socket payloads small, validated, and documented when they change.
- Do not label a placeholder as complete functionality.
- Never commit `.env`, local JSON data, or `node_modules`.

## Before opening a change

Run `npm run build` and manually exercise the affected flow in at least two browser sessions when it uses real-time events. Document known limitations in the PR description.
