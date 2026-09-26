'use strict';

// The Rough Log write path.
//
// Until 1.33 every rough-log entry the phone made was a read of
// roughlog-{year}.json, a push, and a blind PUT of the whole file back — and
// when the read failed (an expired token, a dropped link) the "file" it wrote
// back was a new one holding only that entry. The Console did the same from a
// copy it loaded once per session. Between April and August 2026 that lost 219
// entries. Now an entry is an immutable event first, and the year file is only
// ever merged into, under If-Match, by id.
//
// This drives the real erWriteRoughLogEntry and its helpers out of index.html
// against a fake OneDrive that speaks item metadata eTags, content GET/PUT with
// If-Match / If-None-Match, folder create, and — as the real one does — a 404
// for a simple upload into a folder that does not exist.
//
// Run: node tools/test/roughlog-write.test.js  (or the whole suite, tools/test/run.js)

const fs     = require('fs');
const path   = require('path');
const vm     = require('vm');
const assert = require('assert');

const HTML = fs.readFileSync(path.join(__dirname, '..', '..', 'index.html'), 'utf8');

let passed = 0, failed = 0;
async function testAsync(name, fn) {
  try { await fn(); console.log('  ✓ ' + name); passed++; }
  catch (e) { console.log('  ✗ ' + name + '\n      ' + ((e && e.stack) || e)); failed++; }
}

// Pull one function out of the single-file app by name (same approach as
// add-oil.test.js): brace-match from the declaration to its end.
function liftSource(n) {
  const at = HTML.search(new RegExp('(?:async )?function ' + n + '\\s*\\('));
  if (at < 0) throw new Error('could not find function ' + n);
  const i = HTML.indexOf('{', at);
  let depth = 0;
  for (let j = i; j < HTML.length; j++) {
    if (HTML[j] === '{') depth++;
    else if (HTML[j] === '}') { depth--; if (!depth) return HTML.slice(at, j + 1); }
  }
  throw new Error('unbalanced ' + n);
}

const FNS = ['erUuid', 'erlYearOf', 'erlDriveUrl', 'erlEnsureFolder', 'erlAppendEntryEvent',
             'erlMergeIntoYearFile', 'erWriteRoughLogEntry', 'erWriteTaskRoughLogEntry'];
const PREFIX    = 'https://graph.microsoft.com/v1.0/me/drive/root:/';
const YEAR_FILE = 'Documents/IDMS/data/roughlog/roughlog-2026.json';
const EV_DIR    = 'Documents/IDMS/data/roughlog/events/2026';
const VESSEL    = 'Araho';

function setup() {
  const files   = new Map();
  const folders = new Set(['Documents', 'Documents/IDMS', 'Documents/IDMS/data', 'Documents/IDMS/data/roughlog']);
  let n = 0;
  const drive = {
    files, folders, puts: [], failContentGet: null, failPut: null, beforePut: null,
    put(p, o) { files.set(p, { text: JSON.stringify(o), etag: '"e' + (++n) + '"' }); },
    json(p) { const f = files.get(p); return f ? JSON.parse(f.text) : null; },
    list(d) { return [...files.keys()].filter(k => k.startsWith(d + '/') && !k.slice(d.length + 1).includes('/')); }
  };
  const R = (status, body) => ({ status, ok: status >= 200 && status < 300, json: async () => body });

  async function erlAuthFetch(url, init) {
    init = init || {};
    const method = init.method || 'GET';
    const h = init.headers || {};
    let rest = decodeURIComponent(url.slice(PREFIX.length));
    let kind = 'item';
    if (rest.endsWith('?select=eTag'))    { rest = rest.slice(0, -'?select=eTag'.length); kind = 'meta'; }
    else if (rest.endsWith(':/content'))  { rest = rest.slice(0, -':/content'.length);    kind = 'content'; }
    else if (rest.endsWith(':/children')) { rest = rest.slice(0, -':/children'.length);   kind = 'children'; }

    if (kind === 'children') { folders.add(rest + '/' + JSON.parse(init.body).name); return R(201, {}); }
    if (kind === 'item') return R(folders.has(rest) ? 200 : 404, {});
    const f = files.get(rest);
    if (kind === 'meta') return f ? R(200, { eTag: f.etag }) : R(404, {});
    if (method === 'GET') {
      const st = drive.failContentGet && drive.failContentGet(rest);
      if (st) return R(st, {});
      return f ? R(200, JSON.parse(f.text)) : R(404, {});
    }
    if (!folders.has(rest.slice(0, rest.lastIndexOf('/')))) return R(404, {});
    const st = drive.failPut && drive.failPut(rest);
    if (st) return R(st, {});
    if (h['If-Match'] && drive.beforePut) drive.beforePut(rest);
    const cur = files.get(rest);
    if (h['If-None-Match'] === '*' && cur) return R(412, {});
    if (h['If-Match'] && (!cur || cur.etag !== h['If-Match'])) return R(412, {});
    drive.puts.push({ path: rest, headers: h });
    drive.put(rest, JSON.parse(init.body));
    return R(200, {});
  }

  const sb = {
    console: { log() {}, warn() {}, error() {} },
    ONEDRIVE_BASE: 'Documents/IDMS',
    erlAuthFetch,
    crypto: { randomUUID: require('crypto').randomUUID }
  };
  sb.window = sb;
  vm.createContext(sb);
  vm.runInContext(FNS.map(liftSource).join('\n') +
    '\nthis.W = erWriteRoughLogEntry; this.T = erWriteTaskRoughLogEntry;', sb);
  return { sb, drive };
}

let seq = 0;
const entry = x => Object.assign({
  id: 'pwa-' + (++seq), timestamp: '2026-09-26T10:00:' + String(seq).padStart(2, '0') + '.000Z',
  date: '2026-09-26', time_label: '10:00', department: 'engine', source: 'pwa', category: 'Oil Transfer',
  user: 'mkelly', display_name: 'M', body: 'b', equipment_id: null, ref_id: null
}, x || {});
const yearDoc = entries => ({ schema_version: 1, vessel: VESSEL, year: 2026, entries });

(async () => {
  await testAsync('an entry becomes an event, then is merged into the year file under If-Match', async () => {
    const { sb, drive } = setup();
    const first = entry();
    drive.put(YEAR_FILE, yearDoc([first]));
    const e = entry();
    assert.strictEqual(await sb.W(e), 'ok');
    const evs = drive.list(EV_DIR);
    assert.strictEqual(evs.length, 1);
    const ev = drive.json(evs[0]);
    assert.strictEqual(ev.event_type, 'rough_log_entry');
    assert.strictEqual(ev.payload.entry.id, e.id);
    assert.strictEqual(ev.payload.year, 2026);
    assert.deepStrictEqual(drive.json(YEAR_FILE).entries.map(x => x.id), [first.id, e.id]);
    assert.ok(drive.puts.find(p => p.path === YEAR_FILE).headers['If-Match']);
  });

  await testAsync('a failed read of the year file never becomes a one-entry file', async () => {
    // The shape of the April-June loss: the read failed, the fallback was an
    // empty list, and the PUT replaced everything with one entry.
    const { sb, drive } = setup();
    const before = yearDoc([entry(), entry(), entry()]);
    drive.put(YEAR_FILE, before);
    drive.failContentGet = p => (p === YEAR_FILE ? 401 : 0);
    assert.strictEqual(await sb.T(entry()), 'failed');
    assert.deepStrictEqual(drive.json(YEAR_FILE), before);
    assert.strictEqual(drive.list(EV_DIR).length, 1, 'the event still holds the entry');
  });

  await testAsync('a write landing between read and PUT is re-read and kept', async () => {
    const { sb, drive } = setup();
    drive.put(YEAR_FILE, yearDoc([]));
    const theirs = entry({ source: 'system' });
    let once = true;
    drive.beforePut = p => {
      if (p !== YEAR_FILE || !once) return;
      once = false;
      const d = drive.json(p); d.entries.push(theirs); drive.put(p, d);
    };
    const mine = entry();
    assert.strictEqual(await sb.W(mine), 'ok');
    assert.deepStrictEqual(drive.json(YEAR_FILE).entries.map(x => x.id).sort(), [theirs.id, mine.id].sort());
  });

  await testAsync('a year file that moves twice is left alone and reported as a conflict', async () => {
    const { sb, drive } = setup();
    drive.put(YEAR_FILE, yearDoc([]));
    drive.beforePut = p => {
      if (p !== YEAR_FILE) return;
      const d = drive.json(p); d.entries.push(entry({ source: 'system' })); drive.put(p, d);
    };
    const mine = entry();
    assert.strictEqual(await sb.W(mine), 'conflict');
    assert.ok(!drive.json(YEAR_FILE).entries.some(x => x.id === mine.id));
    assert.strictEqual(drive.json(YEAR_FILE).entries.length, 2, 'nobody else lost anything');
    assert.strictEqual(drive.list(EV_DIR).length, 1);
  });

  await testAsync('the first entry of a year makes its events folder and its year file', async () => {
    const { sb, drive } = setup();
    assert.strictEqual(await sb.W(entry()), 'ok');
    assert.ok(drive.folders.has(EV_DIR));
    assert.strictEqual(drive.json(YEAR_FILE).entries.length, 1);
    assert.strictEqual(drive.puts.find(p => p.path === YEAR_FILE).headers['If-None-Match'], '*');
  });

  await testAsync('a failed event write throws and touches nothing else', async () => {
    const { sb, drive } = setup();
    drive.folders.add(EV_DIR);
    drive.put(YEAR_FILE, yearDoc([]));
    drive.failPut = p => (p.startsWith(EV_DIR) ? 403 : 0);
    await assert.rejects(sb.W(entry()));
    assert.strictEqual(drive.json(YEAR_FILE).entries.length, 0);
  });

  await testAsync("the year is the entry's, not the clock's", async () => {
    const { sb, drive } = setup();
    await sb.W(entry({ date: '2025-12-31', timestamp: '2025-12-31T23:59:00.000Z' }));
    assert.strictEqual(drive.list('Documents/IDMS/data/roughlog/events/2025').length, 1);
  });

  await testAsync('only the reader and the merge name the year file', async () => {
    const re = /roughlog-' \+/g;
    const where = [];
    let m;
    while ((m = re.exec(HTML))) {
      const fnStart = HTML.lastIndexOf('function ', m.index);
      where.push(HTML.slice(fnStart + 9, HTML.indexOf('(', fnStart)).trim());
    }
    assert.deepStrictEqual([...new Set(where)].sort(), ['erlGraphUrl', 'erlMergeIntoYearFile']);
  });

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed) process.exitCode = 1;
})();
