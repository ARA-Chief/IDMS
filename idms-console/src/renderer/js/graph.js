'use strict';

const ONEDRIVE_BASE = 'Documents/IDMS';

function graphUrl(path) {
  const encoded = encodeURIComponent(path).replace(/%2F/g, '/');
  return 'https://graph.microsoft.com/v1.0/me/drive/root:/' + encoded;
}

async function graphGet(path) {
  await refreshGraphToken();
  const resp = await fetch(graphUrl(path) + ':/content', {
    headers: { Authorization: 'Bearer ' + graphToken }
  });
  if (resp.status === 404) return null;
  if (!resp.ok) throw new Error('Graph GET failed: ' + resp.status + ' — ' + path);
  return resp.json();
}

async function graphListFolder(folderPath) {
  await refreshGraphToken();
  const resp = await fetch(graphUrl(folderPath) + ':/children?$select=name,lastModifiedDateTime,size', {
    headers: { Authorization: 'Bearer ' + graphToken }
  });
  if (resp.status === 404) return [];
  if (!resp.ok) throw new Error('Graph LIST failed: ' + resp.status + ' — ' + folderPath);
  const data = await resp.json();
  return data.value || [];
}

// ── Config loaders ────────────────────────────────────────────────────────────

async function loadUserConfig() {
  return graphGet(ONEDRIVE_BASE + '/config/userconfig.json');
}

async function loadConsoleConfig() {
  return graphGet(ONEDRIVE_BASE + '/config/consoleconfig.json');
}

async function loadDeptConfig(deptKey) {
  return graphGet(ONEDRIVE_BASE + '/config/' + deptKey + 'config.json');
}

async function loadDeptShell(deptKey) {
  return graphGet(ONEDRIVE_BASE + '/config/shells/' + deptKey + 'shell.json');
}

// ── Log file loader ───────────────────────────────────────────────────────────
// Returns parsed JSON or null. Accepts both filename patterns:
//   report-{username}-{date}.json  (current)
//   report-{date}-{username}.json  (legacy)

async function loadLogFile(deptKey, filename) {
  const path = ONEDRIVE_BASE + '/data/' + deptKey + '/logs/' + filename;
  return graphGet(path);
}

// ── List all log files for a department on a given date ───────────────────────
async function listLogFilesForDate(deptKey, dateStr) {
  const folder = ONEDRIVE_BASE + '/data/' + deptKey + '/logs';
  const files = await graphListFolder(folder);
  return files.filter(f => f.name.includes(dateStr) && f.name.endsWith('.json'));
}

// ── List ALL log files for a department (for initial full ingest) ─────────────
async function listAllLogFiles(deptKey) {
  const folder = ONEDRIVE_BASE + '/data/' + deptKey + '/logs';
  return graphListFolder(folder);
}
