# Writin Node Auth Server

Use this folder as the Razor/cPanel Node.js application root. Existing `mybook` deployment paths below match the current configuration; documentation branding does not rename those directories.

Recommended cPanel fields:

- Node.js version: `18.x` or newer
- Application mode: `Production`
- Application root: `/home/celztxeo/mybook-live/server`
- Application URL: `mohsinali.in/api`
- Application startup file: `server.js`

Environment variables:

```bash
NODE_ENV=production
GOOGLE_CLIENT_ID=your-google-oauth-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-oauth-client-secret
AUTH_COOKIE_SECRET=replace-with-at-least-32-random-characters
APP_ORIGIN=https://mohsinali.in
GOOGLE_REDIRECT_URI=https://mohsinali.in/api/auth/google/callback
# Shared only by the auth API and collaboration service. Use the same random secret in both.
COLLAB_TOKEN_SECRET=replace-with-another-random-secret-at-least-32-characters
# Persistent directory on the collaboration host; do not use an ephemeral container filesystem.
COLLAB_DATA_DIR=/home/celztxeo/mybook-live/collaboration-data
COLLAB_PORT=1234
COLLAB_HOST=127.0.0.1
COLLAB_ALLOWED_ORIGINS=https://mohsinali.in
```

Frontend build variables:

```bash
VITE_GOOGLE_AUTH_MODE=server
VITE_AUTH_API_BASE=/api/auth
VITE_AUTH_API_EXTENSION=
VITE_GOOGLE_CLIENT_ID=your-google-oauth-client-id.apps.googleusercontent.com
VITE_COLLABORATION_URL=wss://mohsinali.in/collab
```

## Self-hosted document sync

The editor uses Yjs with local IndexedDB persistence and this self-hosted Hocuspocus WebSocket service when `VITE_COLLABORATION_URL` is set and server authentication is enabled. The WebSocket service accepts only signed short-lived tokens issued by the auth API, and each room is scoped to the signed-in email plus document ID. It stores Yjs binary updates in `COLLAB_DATA_DIR`; keep that directory on persistent storage and include it in backups.

Run the auth API with `npm start` and the sync process with `npm run start:collaboration` from this directory. Configure the reverse proxy to forward `wss://<app-host>/collab` to `127.0.0.1:<COLLAB_PORT>` with WebSocket upgrades enabled. The proxy must preserve the browser `Origin` header. Configure the same `COLLAB_TOKEN_SECRET` in the auth and sync processes, and set `COLLAB_ALLOWED_ORIGINS` to the exact frontend origin(s). Do not enable the frontend URL until both services and persistent storage are configured.

Local development can run the sync process separately with a persistent temporary data directory, `COLLAB_TOKEN_SECRET` (32+ characters), `COLLAB_PORT=1234`, and `COLLAB_ALLOWED_ORIGINS=http://localhost:5173`; set `VITE_COLLABORATION_URL=ws://localhost:1234` in the local frontend environment. The frontend must use `VITE_GOOGLE_AUTH_MODE=server` because the browser-auth mode does not have the signed server session required by the sync service.
