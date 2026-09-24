'use strict';

// Notes are read from every year's folder, not only this one (§41.3).
//
// Events live in `data/notes/events/<year>/`. The notes page read only the
// current year, so on 1 January every note still open from December vanished
// from the phone and the IDMS Notes window while the Console — which reads every
// year (sync-notes.js) — kept it. Worse, an edit made in January to a December
// note was dropped by the reducer, because the note it belonged to had never
// been loaded. Nothing threw: the list was just shorter after midnight.
//
// This runs the page's own ntSyncNow against a fake OneDrive holding a note
// created in 2026 and edited in 2027, and checks the phone ends up with the
// note as the Console would. The hub's alert reader (index.html ntaLoadEvents)
// had the same bug and is checked on the same fixture.

const fs = require('fs');
const vm = require('vm');
const path = require('path');
const { REPO, counter } = require('./_paths');

const T = counter(), check = T.check;

// ── A drive with two year folders ─────────────────────────────────────────────
const ev = (id, type, ts, payload) => ({
  schema_version: 1, event_id: id, event_type: type, actor: 'wostara', timestamp: ts, payload
});
const FILES = {
  '2026': {
    '20261230T090000000Z-e1.json': ev('e1', 'note_created', '2026-12-30T09:00:00.000Z', {
      note_id: 'note-dec', title: 'Check the stern tube seal', body: '',
      scope: { level: 'department', department: 'engine' }
    })
  },
  '2027': {
    '20270102T080000000Z-e2.json': ev('e2', 'note_edited', '2027-01-02T08:00:00.000Z', {
      note_id: 'note-dec', patch: { title: 'Check the stern tube seal — leaking' }
    }),
    '20270102T090000000Z-e3.json': ev('e3', 'note_created', '2027-01-02T09:00:00.000Z', {
      note_id: 'note-jan', title: 'New year note', body: '',
      scope: { level: 'department', department: 'engine' }
    })
  }
};
const reply = (status, body) => ({ status, ok: status >= 200 && status < 300,
                                   json: async () => body });

// Answers a Graph URL the way the drive would: the events folder lists its year
// folders (and one stray file, which must not be read as a year), each year
// lists its files, and a file's :/content is the event.
function graph(url) {
  const p = decodeURIComponent(url.replace(/^https:\/\/graph\.microsoft\.com\/v1\.0\/me\/drive\/root:\//, ''));
  let m;
  if ((m = /data\/notes\/events:\/children/.exec(p))) {
    return reply(200, { value: [
      { name: '2026', folder: { childCount: 1 } },
      { name: '2027', folder: { childCount: 2 } },
      { name: 'README.txt' }
    ] });
  }
  if ((m = /data\/notes\/events\/(\d{4}):\/children/.exec(p))) {
    return reply(200, { value: Object.keys(FILES[m[1]] || {}).map(name => ({ name })) });
  }
  if ((m = /data\/notes\/events\/(\d{4})\/([^:]+?)(:\/content)?$/.exec(p))) {
    const f = (FILES[m[1]] || {})[m[2]];
    return f ? reply(200, f) : reply(404, null);
  }
  return reply(404, null);
}

// ── notes.html ────────────────────────────────────────────────────────────────
T.head('the notes page reads every year folder');
{
  const page = fs.readFileSync(path.join(REPO, 'notes.html'), 'utf8');
  const open = page.indexOf('<script>', page.lastIndexOf('</head>'));
  const src  = page.slice(page.indexOf('>', open) + 1, page.lastIndexOf('</script>'))
                   .replace(/^ntInit\(\);\s*$/m, '');
  const noop = () => {};
  const el = () => ({ innerHTML: '', textContent: '', style: {}, dataset: {},
                      classList: { add: noop, remove: noop, contains: () => false },
                      addEventListener: noop, appendChild: noop, focus: noop });
  const store = {};
  const sandbox = {
    console, setTimeout, clearTimeout, setInterval, clearInterval,
    fetch: () => Promise.reject(new Error('no network in tests')),
    localStorage: { getItem: k => (k in store ? store[k] : null),
                    setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } },
    navigator: { onLine: true, serviceWorker: { register: () => Promise.reject(new Error('none')) } },
    location: { href: 'https://example.invalid/notes.html', search: '', hash: '' },
    document: { getElementById: el, querySelector: () => null, querySelectorAll: () => [],
                addEventListener: noop, createElement: el, body: el(), title: '' }
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  new vm.Script(fs.readFileSync(path.join(REPO, 'utils', 'notes-reduce.js'), 'utf8'),
                { filename: 'notes-reduce.js' }).runInContext(sandbox);
  new vm.Script(src, { filename: 'notes.html' }).runInContext(sandbox);

  // The network and the screen, and nothing else, are replaced.
  vm.runInContext(`
    ntFetch = async function (url) { return __graph(url); };
    ntGetJson = async function (p) {
      var r = __graph('https://graph.microsoft.com/v1.0/me/drive/root:/' + encodeURIComponent(p) + ':/content');
      return r.ok ? r.json() : null;
    };
    ntRenderAll = function () {};
    ntSetPill = function () {};
  `, Object.assign(sandbox, { __graph: graph }));

  const run = async () => {
    await sandbox.ntSyncNow();
    const notes = sandbox.NT.notes || {};
    const get = id => (notes instanceof Map ? notes.get(id) : notes[id]);
    const dec = get('note-dec');
    check('a note created last year is loaded', !!dec, true);
    check("and this year's edit to it is applied", dec && dec.title, 'Check the stern tube seal — leaking');
    check("this year's own note is loaded too", !!get('note-jan'), true);
    check('every event, in timestamp order across the years',
      sandbox.NT.events.map(e => e.event_id), ['e1', 'e2', 'e3']);
    check('a stray file in the events folder is not taken for a year',
      sandbox.NT.events.length, 3);
    check('the cache is one key for every year, not the current year',
      Object.keys(store), ['nt_events_cache_all']);

    // A second sync fetches nothing it already holds.
    let fetched = 0;
    sandbox.__graph = url => { if (/:\/content/.test(url)) fetched++; return graph(url); };
    await sandbox.ntSyncNow();
    check('a second sync downloads nothing it already has', fetched, 0);
  };
  module.exports.notesPage = run();
}

// ── index.html's alert reader ─────────────────────────────────────────────────
T.head("the hub's alert reader reads every year folder too");
{
  const html = fs.readFileSync(path.join(REPO, 'index.html'), 'utf8');
  const a = html.indexOf('async function ntaLoadEvents()');
  const b = html.indexOf('\nfunction ntaComputeAlerts()');
  check('ntaLoadEvents is where it was left', a !== -1 && b > a, true);
  if (a !== -1 && b > a) {
    // From the cache key down: the one-key cache line when it is there, else the
    // per-year key both versions carry — so an old page fails on what it does,
    // not on how this file cut it out.
    const k1 = html.lastIndexOf('var NTA_CACHE_KEY', a);
    const start = k1 !== -1 ? k1 : html.lastIndexOf('function ntaCacheKey', a);
    const block = html.slice(start, b);
    const store = {};
    const ctx = {
      NTA: { events: [], loadedNames: {} },
      graphToken: 't',
      refreshToken: async () => {},
      localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } },
      fetch: async url => graph(url),
      JSON, console
    };
    vm.createContext(ctx);
    vm.runInContext(block, ctx);
    module.exports.hub = vm.runInContext('ntaLoadEvents()', ctx).then(() => {
      check('the hub holds last year\'s note and this year\'s events',
        ctx.NTA.events.map(e => e.event_id), ['e1', 'e2', 'e3']);
      check('and shares the one cache key with the notes page', Object.keys(store), ['nt_events_cache_all']);
    });
  }
}

Promise.all([module.exports.notesPage, module.exports.hub].filter(Boolean))
  .catch(e => { check('ran without throwing', false); T.note(String(e && e.stack || e)); })
  .then(() => process.exit(T.done() ? 0 : 1));
