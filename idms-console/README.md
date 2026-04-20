# IDMS Console

Desktop console for F/V Araho — built with Electron + SQLite.

## Requirements

- Node.js 18 LTS or later
- npm (included with Node)

## First-time setup

```bash
# 1. Install dependencies
npm install

# 2. Rebuild native modules for Electron
npx electron-rebuild

# 3. Launch
npm start
```

## Development

```bash
npm run dev
```

This opens DevTools automatically.

## Project structure

```
idms-console/
  src/
    main/
      main.js          ← Electron main process, SQLite, IPC handlers
    preload/
      preload.js       ← Secure IPC bridge (contextBridge)
    renderer/
      index.html       ← App shell HTML
      css/
        base.css       ← Reset, variables, typography
        layout.css     ← App chrome: titlebar, sidebar, content area
        components.css ← Cards, tables, panels, badges
      js/
        auth.js        ← MSAL authentication
        graph.js       ← Microsoft Graph / OneDrive API calls
        ingest.js      ← OneDrive polling and SQLite ingestion
        overview.js    ← Overview screen rendering
        settings.js    ← Settings screen rendering
        app.js         ← Navigation, startup sequence
  package.json
  README.md
```

## Database

SQLite database is stored at:
- Windows: `%APPDATA%\idms-console\idms.db`

Tables:
- `log_files` — one row per ingested OneDrive file
- `events` — all individual incident records
- `ingest_log` — audit trail of ingest operations

## Authentication note

The current auth flow uses a temporary token-paste mechanism for initial
testing. Full MSAL Electron integration (proper popup/redirect OAuth2 flow)
will be added once initial connectivity is confirmed.

To get a test token:
1. Open the field PWA in a browser
2. Sign in with your Microsoft account
3. Open DevTools → Application → Session Storage
4. Find the key ending in `accesstoken` — copy the `secret` value
5. Paste it into the console sign-in prompt

Tokens expire after ~1 hour.
