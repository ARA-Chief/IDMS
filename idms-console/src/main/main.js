'use strict';

const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const Store = require('electron-store');

const store = new Store();
const isDev = process.argv.includes('--dev');

let mainWindow = null;

// ── DB (initialised after app ready) ─────────────────────────────────────────
let db = null;

function initDb() {
  const Database = require('better-sqlite3');
  const dbPath = path.join(app.getPath('userData'), 'idms.db');
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS log_files (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      username     TEXT    NOT NULL,
      department   TEXT    NOT NULL,
      date         TEXT    NOT NULL,
      file_path    TEXT    NOT NULL UNIQUE,
      ingested_at  TEXT    NOT NULL,
      event_count  INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS events (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      source_file      TEXT    NOT NULL,
      event_id         TEXT    NOT NULL,
      vessel           TEXT,
      department       TEXT    NOT NULL,
      username         TEXT    NOT NULL,
      display_name     TEXT,
      equipment        TEXT    NOT NULL,
      category         TEXT    NOT NULL,
      start_time       TEXT,
      end_time         TEXT,
      duration_seconds INTEGER,
      duration_label   TEXT,
      notes            TEXT,
      is_active        INTEGER NOT NULL DEFAULT 0,
      UNIQUE(source_file, event_id)
    );

    CREATE TABLE IF NOT EXISTS ingest_log (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp   TEXT NOT NULL,
      file_path   TEXT NOT NULL,
      status      TEXT NOT NULL,
      message     TEXT
    );
  `);

  console.log('[DB] Initialised at', dbPath);
}

// ── Window ────────────────────────────────────────────────────────────────────
function createWindow() {
  mainWindow = new BrowserWindow({
    width:          1280,
    height:         800,
    minWidth:       960,
    minHeight:      600,
    titleBarStyle:  'hiddenInset',
    backgroundColor: '#0f0f0f',
    webPreferences: {
      preload:          path.join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration:  false
    }
  });

  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

  if (isDev) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }

  mainWindow.on('closed', () => { mainWindow = null; });
}

// ── App lifecycle ─────────────────────────────────────────────────────────────
app.whenReady().then(() => {
  initDb();
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// ── IPC handlers ──────────────────────────────────────────────────────────────

// Persist/retrieve auth tokens and config cache
ipcMain.handle('store:get', (_e, key) => store.get(key));
ipcMain.handle('store:set', (_e, key, value) => { store.set(key, value); });
ipcMain.handle('store:delete', (_e, key) => { store.delete(key); });

// Ingest a parsed log file payload from the renderer
ipcMain.handle('db:ingestLogFile', (_e, payload) => {
  return ingestLogFile(payload);
});

// Query — recent events for overview screen
ipcMain.handle('db:getRecentEvents', (_e, { limit = 20 } = {}) => {
  return db.prepare(`
    SELECT * FROM events
    WHERE is_active = 0
    ORDER BY end_time DESC
    LIMIT ?
  `).all(limit);
});

// Query — today's ingestion status per user
ipcMain.handle('db:getIngestionStatus', (_e, { date }) => {
  return db.prepare(`
    SELECT username, department, date, file_path, ingested_at, event_count
    FROM log_files
    WHERE date = ?
    ORDER BY department, username
  `).all(date);
});

// Query — summary stats for a given date
ipcMain.handle('db:getDaySummary', (_e, { date }) => {
  const total = db.prepare(
    `SELECT COUNT(*) as count FROM events WHERE end_time LIKE ? AND is_active = 0`
  ).get(date + '%');

  const downtime = db.prepare(
    `SELECT SUM(duration_seconds) as total FROM events WHERE end_time LIKE ? AND is_active = 0`
  ).get(date + '%');

  const active = db.prepare(
    `SELECT COUNT(*) as count, GROUP_CONCAT(username) as users FROM events WHERE is_active = 1`
  ).get();

  const lastIngest = db.prepare(
    `SELECT MAX(ingested_at) as ts FROM log_files WHERE date = ?`
  ).get(date);

  return {
    eventCount:       total?.count       ?? 0,
    downtimeSeconds:  downtime?.total    ?? 0,
    activeCount:      active?.count      ?? 0,
    activeUsers:      active?.users      ?? '',
    lastIngestedAt:   lastIngest?.ts     ?? null
  };
});

// Open external links in the system browser
ipcMain.on('shell:openExternal', (_e, url) => {
  shell.openExternal(url);
});

// ── Ingestion logic ───────────────────────────────────────────────────────────
function ingestLogFile(payload) {
  const {
    filePath, vessel, department, username, display_name,
    date, generated, active = [], resolved = []
  } = payload;

  const now = new Date().toISOString();

  const upsertFile = db.prepare(`
    INSERT INTO log_files (username, department, date, file_path, ingested_at, event_count)
    VALUES (@username, @department, @date, @file_path, @ingested_at, @event_count)
    ON CONFLICT(file_path) DO UPDATE SET
      ingested_at  = excluded.ingested_at,
      event_count  = excluded.event_count
  `);

  const upsertEvent = db.prepare(`
    INSERT INTO events (
      source_file, event_id, vessel, department, username, display_name,
      equipment, category, start_time, end_time,
      duration_seconds, duration_label, notes, is_active
    ) VALUES (
      @source_file, @event_id, @vessel, @department, @username, @display_name,
      @equipment, @category, @start_time, @end_time,
      @duration_seconds, @duration_label, @notes, @is_active
    )
    ON CONFLICT(source_file, event_id) DO UPDATE SET
      end_time         = excluded.end_time,
      duration_seconds = excluded.duration_seconds,
      duration_label   = excluded.duration_label,
      notes            = excluded.notes,
      is_active        = excluded.is_active
  `);

  const logIngest = db.prepare(`
    INSERT INTO ingest_log (timestamp, file_path, status, message)
    VALUES (?, ?, ?, ?)
  `);

  const run = db.transaction(() => {
    // Clear stale active events for this user (they may have resolved)
    db.prepare(`DELETE FROM events WHERE source_file = ? AND is_active = 1`)
      .run(filePath);

    const allEvents = [
      ...active.map(e => ({ ...e, is_active: 1 })),
      ...resolved.map(e => ({ ...e, is_active: 0 }))
    ];

    for (const e of allEvents) {
      // Accept both camelCase (legacy) and snake_case (new schema)
      upsertEvent.run({
        source_file:      filePath,
        event_id:         String(e.id),
        vessel:           vessel ?? '',
        department,
        username,
        display_name:     display_name ?? e.displayName ?? '',
        equipment:        e.equipment,
        category:         e.category,
        start_time:       e.start_time   ?? e.startTime  ?? null,
        end_time:         e.end_time     ?? e.endTime    ?? null,
        duration_seconds: e.duration_seconds ?? e.duration ?? null,
        duration_label:   e.duration_label   ?? e.durationLabel ?? null,
        notes:            e.notes ?? '',
        is_active:        e.is_active
      });
    }

    upsertFile.run({
      username,
      department,
      date,
      file_path:   filePath,
      ingested_at: now,
      event_count: allEvents.length
    });

    logIngest.run(now, filePath, 'ok', `Ingested ${allEvents.length} events`);
  });

  try {
    run();
    return { ok: true };
  } catch (err) {
    console.error('[DB] Ingest error:', err);
    logIngest.run(now, filePath, 'error', err.message);
    return { ok: false, error: err.message };
  }
}
