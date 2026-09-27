// ── Engine Room › Motor Hours ────────────────────────────────────────────────
// The "Araho Running Hours - Manual Updates" sheet as a Rounds-style keypad
// screen: one row per machine, the one entry column, and how to read that
// machine's meter under its name. Contract and files: IDMS-Console
// docs/motor-hours.md; every rule about what a reading means is in
// utils/motor-hours-reduce.js, which the Console runs byte for byte.
//
// A save writes two things, in this order:
//   1. an event, data/motor-hours/events/<yyyy>/<iso>-<id>.json, If-None-Match
//      — the durable record; if it fails nothing is saved and the draft stays;
//   2. a merge into data/motor-hours/log-<yyyy>.json, If-Match, one retry —
//      the file every screen reads. A merge that loses a race is not a lost
//      reading: the Console folds the event back in.
// Same shape as the rough log (erWriteRoughLogEntry), and it reuses that
// writer's Graph helpers (erlDriveUrl, erlAuthFetch, erlEnsureFolder, erUuid).

var MH = {
  register: null,       // motorHours.cleanRegister(...)
  latest: {},           // code → { last, prev, count }
  tm: {},               // code → TM counter row
  values: {},           // code → string being typed
  cursor: 0,
  saving: false,
  loaded: false,
  error: null,
  message: null,
  colour: 'dark'
};

var MH_CACHE_KEY = 'fw_mh_cache';

function mhDraftKey() { return 'idms_mh_draft_' + (currentUser.username || 'anon'); }

function mhPath(rel) { return ONEDRIVE_BASE + '/' + rel; }

async function mhGetJson(rel) {
  var resp = await erlAuthFetch(erlDriveUrl(mhPath(rel)) + ':/content', { cache: 'no-store' });
  if (resp.status === 404) return null;
  if (!resp.ok) throw new Error('HTTP ' + resp.status + ' reading ' + rel);
  return resp.json();
}

// ── Open ─────────────────────────────────────────────────────────────────────

function openMotorHours() {
  showScreen('screen-motor-hours');
  mhBindGestures();
  MH.values = mhLoadDraft();
  MH.cursor = 0;
  MH.message = null;
  // Last good copy first, so a phone with no signal still shows the sheet and
  // still takes readings (they wait in the draft until a save goes through).
  var cached = null;
  try { cached = JSON.parse(localStorage.getItem(MH_CACHE_KEY) || 'null'); } catch (_) {}
  mhApply(cached);
  mhRender();
  if (typeof reLoadUserPrefs === 'function') {
    reLoadUserPrefs().then(function (p) { MH.colour = (p && p.colour_mode) || 'dark'; mhRender(); }).catch(function () {});
  }
  mhLoad();
}

async function mhLoad() {
  var year = new Date().getFullYear();
  var P = motorHours.PATHS;
  if (typeof beginNetworkOp === 'function') beginNetworkOp();
  var ok = false;
  try {
    var got = await Promise.all([
      mhGetJson(P.register),
      mhGetJson(P.log(year)),
      mhGetJson(P.log(year - 1)).catch(function () { return null; }),
      mhGetJson(P.tm).catch(function () { return null; })
    ]);
    var snap = { register: got[0], logs: [got[2], got[1]], tm: got[3], at: new Date().toISOString() };
    try { localStorage.setItem(MH_CACHE_KEY, JSON.stringify(snap)); } catch (_) {}
    mhApply(snap);
    MH.error = null;
    ok = true;
  } catch (e) {
    MH.error = MH.loaded ? 'Offline — showing the last copy this phone saw.' : 'Could not load the sheet: ' + (e && e.message);
  } finally {
    if (typeof endNetworkOp === 'function') endNetworkOp(ok);
  }
  mhRender();
}

function mhApply(snap) {
  MH.register = motorHours.cleanRegister(snap && snap.register);
  var readings = motorHours.foldReadings((snap && snap.logs) || [], []);
  MH.latest = motorHours.latestByCode(readings);
  MH.tm = motorHours.tmByCode(snap && snap.tm);
  MH.loaded = !!snap;
}

// ── Draft ────────────────────────────────────────────────────────────────────

function mhLoadDraft() {
  try {
    var d = JSON.parse(localStorage.getItem(mhDraftKey()) || 'null');
    return d && d.values ? d.values : {};
  } catch (_) { return {}; }
}

function mhSaveDraft() {
  try {
    var any = Object.keys(MH.values).some(function (k) { return MH.values[k] !== ''; });
    if (any) localStorage.setItem(mhDraftKey(), JSON.stringify({ values: MH.values, at: new Date().toISOString() }));
    else localStorage.removeItem(mhDraftKey());
  } catch (_) {}
}

// ── Render ───────────────────────────────────────────────────────────────────

function mhEsc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

function mhRows() { return MH.register ? MH.register.rows : []; }

function mhWhen(at) {
  if (!at) return '';
  var d = new Date(at.length === 10 ? at + 'T12:00:00' : at);
  if (isNaN(d)) return '';
  return (d.getMonth() + 1) + '/' + d.getDate() + '/' + String(d.getFullYear()).slice(2);
}

function mhFilled() {
  return mhRows().filter(function (r) { return motorHours.parseHours(MH.values[r.code]) != null; });
}

function mhRowHtml(r, i) {
  // Component Name first, then the SFI code, where and how to read it, and
  // the last figure; the Reading box on the right.
  var cur = motorHours.currentFor(r.code, MH.latest, MH.tm);
  var v = MH.values[r.code] || '';
  var warn = v ? motorHours.checkReading(v, cur) : null;
  var last = cur
    ? 'Last ' + motorHours.fmtHours(cur.hours) + ' h · ' + mhWhen(cur.at) + (cur.source === 'tm' ? ' (TM)' : '')
    : 'No reading yet';
  var warnHtml = !warn ? ''
    : warn.kind === 'lower'
      ? '<div class="mh-warn">Lower than last (' + motorHours.fmtHours(cur.hours) + ') — meter replaced?</div>'
      : '<div class="mh-warn">+' + motorHours.fmtHours(warn.by) + ' h since ' + mhWhen(cur.at) + ' — more than the clock allows</div>';
  return '<div class="mh-row' + (i === MH.cursor ? ' mh-active' : '') + (v ? ' mh-done' : '') + '" onclick="mhCursorTo(' + i + ')" id="mh-row-' + i + '">' +
    '<div class="mh-label">' +
      '<div class="mh-name">' + mhEsc(r.component) + '</div>' +
      '<div class="mh-code">' + mhEsc(r.code) + '</div>' +
      (r.info ? '<div class="mh-info">' + mhEsc(r.info) + '</div>' : '') +
      '<div class="mh-last">' + mhEsc(last) + '</div>' + warnHtml +
    '</div>' +
    '<div class="mh-entry"><span class="mh-num">' + mhEsc(v) + '</span></div>' +
  '</div>';
}

function mhKeypadHtml() {
  return '<div class="mh-keypad"><div class="mh-kp-grid">' +
    '<button class="mh-kp-btn mh-kp-fn mh-kp-bs" onclick="mhKpBs()">&#8592;</button>' +
    '<button class="mh-kp-btn mh-kp-fn" onclick="mhKpClear()">clr</button>' +
    '<button class="mh-kp-btn mh-kp-nav" onclick="mhNav(-1)">&#9650;</button>' +
    '<button class="mh-kp-btn" onclick="mhKp(\'7\')">7</button><button class="mh-kp-btn" onclick="mhKp(\'8\')">8</button><button class="mh-kp-btn" onclick="mhKp(\'9\')">9</button>' +
    '<button class="mh-kp-btn mh-kp-nav" onclick="mhNav(1)">&#9660;</button>' +
    '<button class="mh-kp-btn" onclick="mhKp(\'4\')">4</button><button class="mh-kp-btn" onclick="mhKp(\'5\')">5</button><button class="mh-kp-btn" onclick="mhKp(\'6\')">6</button>' +
    '<button class="mh-kp-btn mh-kp-enter" onclick="mhNav(1)">enter</button>' +
    '<button class="mh-kp-btn" onclick="mhKp(\'1\')">1</button><button class="mh-kp-btn" onclick="mhKp(\'2\')">2</button><button class="mh-kp-btn" onclick="mhKp(\'3\')">3</button>' +
    '<button class="mh-kp-btn" onclick="mhKp(\'0\')">0</button>' +
    '<button class="mh-kp-btn mh-kp-fn" onclick="mhKp(\'.\')">dcml</button>' +
  '</div></div>';
}

function mhRender() {
  var host = document.getElementById('screen-motor-hours');
  if (!host) return;
  host.setAttribute('data-mh-colour', MH.colour === 'light' ? 'light' : 'dark');
  var rows = mhRows();
  var n = mhFilled().length;
  var banner = MH.message ? '<div class="mh-banner mh-banner-ok">' + mhEsc(MH.message) + '</div>'
             : MH.error ? '<div class="mh-banner mh-banner-err">' + mhEsc(MH.error) + '</div>' : '';
  var scrollTop = (document.getElementById('mh-scroll') || {}).scrollTop || 0;
  host.innerHTML =
    '<div class="mh-root">' +
      '<div class="mh-header">' +
        '<button class="back-btn" onclick="mhExit()"><svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M12 4l-6 6 6 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></button>' +
        '<div class="mh-title"><h2>Motor Hours</h2><div class="mh-sub">' + mhEsc(MH.register ? MH.register.title : '') + '</div></div>' +
      '</div>' +
      banner +
      '<div class="mh-main">' +
        '<div class="mh-col-heads"><span>Component</span><span>Reading</span></div>' +
        '<div class="mh-scroll" id="mh-scroll">' +
          (rows.length ? rows.map(mhRowHtml).join('') : '<div class="mh-empty">Loading…</div>') +
          (MH.register && MH.register.footnote ? '<div class="mh-foot">' + mhEsc(MH.register.footnote) + '</div>' : '') +
        '</div>' +
        '<div class="mh-side">' + mhKeypadHtml() +
          '<div class="mh-submit-bar"><button class="mh-submit" id="mh-submit" onclick="mhSave()"' + (n && !MH.saving ? '' : ' disabled') + '>' +
            (MH.saving ? 'Saving…' : n ? 'Save ' + n + ' reading' + (n === 1 ? '' : 's') : 'Nothing entered') + '</button></div>' +
        '</div>' +
      '</div>' +
    '</div>' + mhStyles();
  var sc = document.getElementById('mh-scroll');
  if (sc) sc.scrollTop = scrollTop;
}

function mhRepaintRow(i) {
  var el = document.getElementById('mh-row-' + i);
  var r = mhRows()[i];
  if (!el || !r) return mhRender();
  el.outerHTML = mhRowHtml(r, i);
  var n = mhFilled().length;
  var btn = document.getElementById('mh-submit');
  if (btn) {
    btn.disabled = !n || MH.saving;
    btn.textContent = n ? 'Save ' + n + ' reading' + (n === 1 ? '' : 's') : 'Nothing entered';
  }
}

// ── Keypad ───────────────────────────────────────────────────────────────────

function mhCursorTo(i) {
  var prev = MH.cursor;
  MH.cursor = Math.max(0, Math.min(mhRows().length - 1, i));
  mhRepaintRow(prev);
  mhRepaintRow(MH.cursor);
  var el = document.getElementById('mh-row-' + MH.cursor);
  if (el && el.scrollIntoView) el.scrollIntoView({ block: 'nearest' });
}

function mhNav(d) { mhCursorTo(MH.cursor + d); }

function mhSet(v) {
  var r = mhRows()[MH.cursor];
  if (!r) return;
  MH.values[r.code] = v;
  MH.message = null;
  mhSaveDraft();
  mhRepaintRow(MH.cursor);
}

function mhKp(k) {
  var r = mhRows()[MH.cursor];
  if (!r) return;
  var v = MH.values[r.code] || '';
  if (k === '.' && v.indexOf('.') >= 0) return;
  if (k === '.' && v === '') v = '0';
  if (v.replace('.', '').length >= 9) return;
  mhSet(v + k);
}
function mhKpBs() {
  var r = mhRows()[MH.cursor];
  if (r) mhSet((MH.values[r.code] || '').slice(0, -1));
}
function mhKpClear() { mhSet(''); }

// ── Save ─────────────────────────────────────────────────────────────────────

async function mhAppendEvent(ev) {
  var year = String(ev.timestamp).slice(0, 4);
  var folder = mhPath(motorHours.PATHS.events(year));
  var url = erlDriveUrl(folder + '/' + motorHours.eventFileName(ev)) + ':/content';
  var init = { method: 'PUT', headers: { 'Content-Type': 'application/json', 'If-None-Match': '*' },
               body: JSON.stringify(ev, null, 2) };
  var resp = await erlAuthFetch(url, init);
  if (resp.status === 404) {
    await erlEnsureFolder(folder);
    resp = await erlAuthFetch(url, init);
  }
  // 412 = this exact event already landed (a retry after a lost response).
  if (resp.status !== 412 && !resp.ok) throw new Error('HTTP ' + resp.status);
}

async function mhMergeLog(ev) {
  var year = String(ev.timestamp).slice(0, 4);
  var base = erlDriveUrl(mhPath(motorHours.PATHS.log(year)));
  for (var attempt = 0; attempt < 2; attempt++) {
    var etag = null;
    var meta = await erlAuthFetch(base + '?select=eTag', { cache: 'no-store' });
    if (meta.ok) etag = (await meta.json()).eTag || null;
    else if (meta.status !== 404) return 'failed';
    var doc = null;
    if (etag) {
      var resp = await erlAuthFetch(base + ':/content', { cache: 'no-store' });
      if (!resp.ok) return 'failed';                    // never write what we could not read
      doc = await resp.json();
      if (!doc || !Array.isArray(doc.readings)) return 'failed';
    }
    var next = motorHours.mergeIntoLog(doc, year, ev.payload.readings);
    var headers = { 'Content-Type': 'application/json' };
    if (etag) headers['If-Match'] = etag; else headers['If-None-Match'] = '*';
    var put = await erlAuthFetch(base + ':/content', { method: 'PUT', headers: headers, body: JSON.stringify(next, null, 2) });
    if (put.status === 412) continue;
    return put.ok ? 'ok' : 'failed';
  }
  return 'conflict';
}

async function mhSave() {
  if (MH.saving) return;
  var filled = mhFilled();
  if (!filled.length) return;
  var odd = filled.filter(function (r) {
    return motorHours.checkReading(MH.values[r.code], motorHours.currentFor(r.code, MH.latest, MH.tm));
  });
  if (odd.length && !confirm(odd.length + ' reading' + (odd.length === 1 ? ' looks' : 's look') +
      ' off (flagged in orange):\n\n' + odd.map(function (r) { return r.code + '  ' + r.component + ' — ' + MH.values[r.code]; }).join('\n') +
      '\n\nSave anyway?')) return;
  var ev = motorHours.buildEvent({
    entries: filled.map(function (r) { return { code: r.code, hours: MH.values[r.code] }; }),
    actor: {
      username: currentUser.username,
      display_name: (typeof getDisplayFullName === 'function' ? getDisplayFullName(currentUser) : '') || currentUser.name || currentUser.username
    },
    source: 'pwa',
    eventId: erUuid()
  });
  if (!ev) return;
  MH.saving = true;
  mhRender();
  if (typeof beginNetworkOp === 'function') beginNetworkOp();
  try {
    await mhAppendEvent(ev);
  } catch (e) {
    MH.saving = false;
    if (typeof endNetworkOp === 'function') endNetworkOp(false);
    MH.error = 'Not saved (' + (e && e.message) + '). Your readings are kept on this phone — try again when you have signal.';
    mhRender();
    return;
  }
  var merged = 'failed';
  try { merged = await mhMergeLog(ev); } catch (_) {}
  if (typeof endNetworkOp === 'function') endNetworkOp(true);
  if (merged !== 'ok') console.warn('[MotorHours] year file not updated (' + merged + '); readings are in event ' + ev.event_id);
  MH.saving = false;
  MH.values = {};
  mhSaveDraft();
  MH.error = null;
  MH.message = 'Saved ' + ev.payload.readings.length + ' reading' + (ev.payload.readings.length === 1 ? '' : 's') + '.';
  // Fold our own readings in now; the reload confirms them.
  var readings = [];
  Object.keys(MH.latest).forEach(function (c) { readings.push(MH.latest[c].last); });
  MH.latest = motorHours.latestByCode(motorHours.foldReadings([{ readings: readings }], [ev]));
  mhRender();
  mhLoad();
}

function mhExit() {
  mhSaveDraft();
  mhUnbindGestures();
  showScreen('screen-engine-home');
}

// ── Gestures: the same guards as Rounds (roundsentry.js reOnTouchMove) ──────
// The page-wide guard in index.html already absorbs back navigation and edge
// swipes; these are the screen's own copy, so the protection holds if that is
// ever bypassed — plus the one thing it does not cover: pull-to-refresh at the
// top of the list, which would reload the app out from under the keypad.
var MH_TOUCH = { x: 0, y: 0 };

function mhOnTouchStart(e) {
  MH_TOUCH.x = e.touches[0].clientX;
  MH_TOUCH.y = e.touches[0].clientY;
}

function mhOnTouchMove(e) {
  var dx = e.touches[0].clientX - MH_TOUCH.x;
  var dy = e.touches[0].clientY - MH_TOUCH.y;
  var scroll = document.getElementById('mh-scroll');
  if (scroll && scroll.scrollTop === 0 && dy > 8 && Math.abs(dy) > Math.abs(dx)) {
    if (e.cancelable) e.preventDefault();
    return;
  }
  if (Math.abs(dx) > Math.abs(dy) && (MH_TOUCH.x < 40 || MH_TOUCH.x > window.innerWidth - 40)) {
    if (e.cancelable) e.preventDefault();
  }
}

function mhBindGestures() {
  document.addEventListener('touchstart', mhOnTouchStart, { passive: true });
  document.addEventListener('touchmove',  mhOnTouchMove,  { passive: false });
}

function mhUnbindGestures() {
  document.removeEventListener('touchstart', mhOnTouchStart);
  document.removeEventListener('touchmove',  mhOnTouchMove);
}

// ── Styles (scoped; Rounds' palette so the two screens read as one) ──────────

function mhStyles() {
  return '<style>' +
  '#screen-motor-hours[data-mh-colour="dark"]{--mh-bg0:#0a1628;--mh-bg1:#0f1e38;--mh-bg2:#162440;--mh-text:#e8f0fe;--mh-text2:#7a90b0;--mh-muted:#4a5c78;--mh-border:rgba(255,255,255,0.08);--mh-accent:#00c2ff;--mh-ok:#00ff99;--mh-warn:#ffaa00;--mh-danger:#ff4d4d;--mh-active:rgba(0,194,255,0.09);--mh-kp:#0d1a30;--mh-kp-btn:#162440}' +
  '#screen-motor-hours[data-mh-colour="light"]{--mh-bg0:#f4f7fb;--mh-bg1:#e8edf4;--mh-bg2:#d8e0eb;--mh-text:#1a2233;--mh-text2:#4a5a72;--mh-muted:#8090a8;--mh-border:rgba(0,0,0,0.09);--mh-accent:#0070b8;--mh-ok:#1a7f4b;--mh-warn:#b86000;--mh-danger:#c53030;--mh-active:rgba(0,112,184,0.08);--mh-kp:#e8edf4;--mh-kp-btn:#fff}' +
  '#screen-motor-hours.active{display:flex}' +
  '#screen-motor-hours{background:var(--mh-bg0);color:var(--mh-text);flex-direction:column;height:100%}' +
  '.mh-root{display:flex;flex-direction:column;height:100dvh;background:var(--mh-bg0)}' +
  '.mh-header{display:flex;align-items:center;gap:8px;padding:10px 12px;border-bottom:1px solid var(--mh-border);background:var(--mh-bg1)}' +
  '.mh-header .back-btn{color:var(--mh-text)}' +
  '.mh-title h2{font-size:17px;font-weight:600}.mh-sub{font-size:11px;color:var(--mh-text2)}' +
  '.mh-banner{padding:8px 12px;font-size:13px}.mh-banner-ok{background:rgba(0,200,120,0.12);color:var(--mh-ok)}.mh-banner-err{background:rgba(255,77,77,0.12);color:var(--mh-danger)}' +
  '.mh-main{flex:1;display:flex;flex-direction:column;min-height:0}' +
  '.mh-col-heads{display:grid;grid-template-columns:1fr 104px;padding:6px 12px;font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--mh-muted);border-bottom:1px solid var(--mh-border)}' +
  '.mh-col-heads span:last-child{text-align:right}' +
  '.mh-scroll{flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;overscroll-behavior:contain}' +
  '.mh-row{display:grid;grid-template-columns:1fr 104px;gap:8px;padding:9px 12px;border-bottom:1px solid var(--mh-border);cursor:pointer;min-height:48px}' +
  '.mh-row.mh-active{background:var(--mh-active);box-shadow:inset 3px 0 0 var(--mh-accent)}' +
  '.mh-name{font-size:15px;font-weight:600;line-height:1.3}.mh-code{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:12.5px;color:var(--mh-accent);margin-top:2px}' +
  '.mh-info{font-size:12px;color:var(--mh-text2);margin-top:3px;line-height:1.35}' +
    '.mh-last{font-size:11px;color:var(--mh-muted);margin-top:3px}' +
  '.mh-warn{font-size:11.5px;color:var(--mh-warn);margin-top:3px;font-weight:600}' +
  '.mh-entry{display:flex;align-items:center;justify-content:flex-end;border:1px solid var(--mh-border);border-radius:6px;background:var(--mh-bg1);padding:0 10px;align-self:center;height:40px}' +
  '.mh-active .mh-entry{border-color:var(--mh-accent)}' +
  '.mh-num{font-size:18px;font-variant-numeric:tabular-nums;font-weight:600}.mh-done .mh-num{color:var(--mh-ok)}' +
  '.mh-foot{padding:14px 12px 24px;font-size:11.5px;color:var(--mh-text2);line-height:1.4}' +
  '.mh-empty{padding:24px 12px;color:var(--mh-text2)}' +
  '.mh-keypad{background:var(--mh-kp);border-top:2px solid var(--mh-border);padding:6px 8px 6px}' +
  '.mh-kp-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:6px}' +
  '.mh-kp-btn{background:var(--mh-kp-btn);border:1px solid var(--mh-border);border-radius:8px;color:var(--mh-text);font-size:18px;font-weight:500;padding:16px 0;cursor:pointer;user-select:none;-webkit-user-select:none}' +
  '.mh-kp-btn:active{filter:brightness(.8)}.mh-kp-fn{font-size:15px;color:var(--mh-text2)}.mh-kp-nav{font-size:14px;color:var(--mh-accent)}' +
  '.mh-kp-bs{grid-column:span 2}.mh-kp-enter{background:var(--mh-accent);color:var(--mh-bg0);grid-row:span 2;font-size:13px}' +
  '.mh-submit-bar{padding:8px;background:var(--mh-kp)}' +
  '.mh-submit{width:100%;padding:14px;border-radius:8px;border:none;background:var(--mh-ok);color:#04120b;font-size:15px;font-weight:700}' +
  '.mh-submit:disabled{background:var(--mh-bg2);color:var(--mh-muted)}' +
  '@media (min-width:768px){.mh-main{display:grid;grid-template-columns:1fr 320px;grid-template-rows:auto 1fr}.mh-col-heads{grid-column:1;grid-row:1}.mh-scroll{grid-column:1;grid-row:2}.mh-side{grid-column:2;grid-row:1/3;display:flex;flex-direction:column;justify-content:flex-end;border-left:1px solid var(--mh-border)}.mh-keypad{border-top:none}.mh-kp-btn{padding:24px 0}}' +
  '</style>';
}
