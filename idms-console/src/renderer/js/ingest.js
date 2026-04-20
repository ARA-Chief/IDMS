'use strict';

const DEPT_KEYS = ['factory', 'engine', 'deck'];
const POLL_INTERVAL_MS = 2 * 60 * 1000; // 2 minutes

var _pollTimer     = null;
var _lastPollTime  = null;
var _pollCountdown = null;

// ── Start polling ─────────────────────────────────────────────────────────────
function startIngestionPoller() {
  stopIngestionPoller();
  pollNow();
  _pollTimer = setInterval(pollNow, POLL_INTERVAL_MS);
  startCountdown();
}

function stopIngestionPoller() {
  if (_pollTimer) { clearInterval(_pollTimer); _pollTimer = null; }
  if (_pollCountdown) { clearInterval(_pollCountdown); _pollCountdown = null; }
}

function startCountdown() {
  if (_pollCountdown) clearInterval(_pollCountdown);
  _pollCountdown = setInterval(updateCountdownDisplay, 1000);
}

function updateCountdownDisplay() {
  if (!_lastPollTime) return;
  const elapsed = Date.now() - _lastPollTime;
  const remaining = Math.max(0, POLL_INTERVAL_MS - elapsed);
  const secs = Math.floor(remaining / 1000);
  const mins = Math.floor(secs / 60);
  const s    = secs % 60;
  const el   = document.getElementById('ingest-next');
  if (el) el.textContent = 'next in ' + mins + 'm ' + String(s).padStart(2,'0') + 's';
}

// ── Poll ──────────────────────────────────────────────────────────────────────
async function pollNow() {
  _lastPollTime = Date.now();
  const todayStr = toDateStr(new Date());
  updateIngestStatusBadge('syncing');

  let totalFiles = 0;
  let errors = 0;

  for (const deptKey of DEPT_KEYS) {
    try {
      const files = await listLogFilesForDate(deptKey, todayStr);
      for (const file of files) {
        try {
          const payload = await loadLogFile(deptKey, file.name);
          if (!payload) continue;
          payload.filePath = ONEDRIVE_BASE + '/data/' + deptKey + '/logs/' + file.name;
          const result = await window.idms.db.ingestLogFile(payload);
          if (!result.ok) errors++;
          totalFiles++;
        } catch (e) {
          console.warn('[Ingest] File error:', file.name, e);
          errors++;
        }
      }
    } catch (e) {
      console.warn('[Ingest] Dept error:', deptKey, e);
      errors++;
    }
  }

  updateIngestStatusBadge(errors > 0 ? 'warn' : 'ok');
  if (typeof onIngestComplete === 'function') onIngestComplete(todayStr);
}

// ── Full historical ingest (run once on first launch) ─────────────────────────
async function runFullIngest() {
  for (const deptKey of DEPT_KEYS) {
    try {
      const files = await listAllLogFiles(deptKey);
      for (const file of files) {
        if (!file.name.endsWith('.json')) continue;
        try {
          const payload = await loadLogFile(deptKey, file.name);
          if (!payload) continue;
          payload.filePath = ONEDRIVE_BASE + '/data/' + deptKey + '/logs/' + file.name;
          await window.idms.db.ingestLogFile(payload);
        } catch (e) {
          console.warn('[FullIngest] File error:', file.name, e);
        }
      }
    } catch (e) {
      console.warn('[FullIngest] Dept error:', deptKey, e);
    }
  }
}

// ── Status badge ──────────────────────────────────────────────────────────────
function updateIngestStatusBadge(state) {
  const el = document.getElementById('badge-onedrive');
  if (!el) return;
  el.className = 'tb-badge';
  if (state === 'ok') {
    el.className += ' badge-ok';
    el.textContent = 'OneDrive connected';
  } else if (state === 'syncing') {
    el.className += ' badge-warn';
    el.textContent = 'Syncing…';
  } else {
    el.className += ' badge-warn';
    el.textContent = 'OneDrive — sync warning';
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function toDateStr(d) {
  return d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0');
}

function fmtSeconds(s) {
  if (!s) return '—';
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return h + 'h ' + m + 'm';
  return m + 'm ' + String(s % 60).padStart(2, '0') + 's';
}
