'use strict';

// ── Rounds Entry Module ───────────────────────────────────────────────────────
// Field entry UI for conducting and submitting vessel rounds.
// Renders into <div id="screen-roundsentry">.
// Reads: roundsconfig.json, userprefs-{username}.json, aggregate files.
// Writes: roundslog-{username}-{YYYY-MM-DD}-{HHmm}.json  (§22 format)
// ─────────────────────────────────────────────────────────────────────────────

const RE = {
  config:       null,
  prefs:        null,
  flatItems:    [],   // {section, item} for all visible rows including headings
  navItems:     [],   // flatItems filtered to non-heading items only
  cursorIdx:    0,    // index into navItems
  values:       {},   // item_id → string value
  secd:         {},   // item_id → boolean
  aggNew:       null, // entries[] from most recent aggregate file
  aggOld:       null, // entries[] from second-most-recent aggregate file
  roundNum:     1,
  scheduledTime: '00:00',
  vessel:       '',
  submitting:   false,
  isTablet:     false,
  touchStartX:  0,
  touchStartY:  0,
};

// ── Graph API helpers ─────────────────────────────────────────────────────────

function reGraphUrl(path) {
  return 'https://graph.microsoft.com/v1.0/me/drive/root:/' +
         encodeURIComponent(path).replace(/%2F/g, '/') + ':/content';
}

function reGraphChildrenUrl(path) {
  return 'https://graph.microsoft.com/v1.0/me/drive/root:/' +
         encodeURIComponent(path).replace(/%2F/g, '/') + ':/children';
}

async function reRefreshToken() {
  if (graphToken) return graphToken;
  if (!msalInstance || !msalAccount) throw new Error('Not signed in');
  const r = await msalInstance.acquireTokenSilent({ scopes: MSAL_SCOPES, account: msalAccount });
  graphToken = r.accessToken;
  return graphToken;
}

async function reGet(path) {
  await reRefreshToken();
  const resp = await fetch(reGraphUrl(path), {
    headers: { 'Authorization': 'Bearer ' + graphToken }
  });
  if (resp.status === 404) return null;
  if (!resp.ok) throw new Error('GET failed: ' + resp.status);
  return resp.json();
}

async function rePut(path, data) {
  await reRefreshToken();
  const resp = await fetch(reGraphUrl(path), {
    method: 'PUT',
    headers: { 'Authorization': 'Bearer ' + graphToken, 'Content-Type': 'application/json' },
    body: JSON.stringify(data, null, 2)
  });
  if (!resp.ok) throw new Error('Save failed: ' + resp.status);
}

async function reListChildren(path) {
  await reRefreshToken();
  const resp = await fetch(reGraphChildrenUrl(path), {
    headers: { 'Authorization': 'Bearer ' + graphToken }
  });
  if (!resp.ok) return [];
  const json = await resp.json();
  return json.value || [];
}

// ── Small utilities ───────────────────────────────────────────────────────────

function rePad2(n) { return String(n).padStart(2, '0'); }

function reToday() {
  const d = new Date();
  return d.getFullYear() + '-' + rePad2(d.getMonth() + 1) + '-' + rePad2(d.getDate());
}

function reLocalDow() {
  // 1 = Monday … 7 = Sunday
  const d = new Date().getDay();
  return d === 0 ? 7 : d;
}

function reDeptKey(name) {
  return (typeof DEPT_FILE_MAP !== 'undefined' && DEPT_FILE_MAP[name]) ||
         name.toLowerCase().replace(/\s+/g, '');
}

function reEsc(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;')
                        .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Round number inference (§24) ──────────────────────────────────────────────

function reInferRound(schedule) {
  const times = (schedule && schedule.round_times) || [];
  if (!times.length) return { round: 1, scheduled_time: '00:00' };

  const toMins = t => {
    const [h, m] = (t || '00:00').split(':');
    return parseInt(h, 10) * 60 + parseInt(m, 10);
  };

  const now = new Date();
  const nowMins = now.getHours() * 60 + now.getMinutes();

  // Exception: next scheduled round within 1 hour → use it
  let nextRound = null, nextGap = Infinity;
  for (const rt of times) {
    const gap = toMins(rt.time) - nowMins;
    if (gap > 0 && gap < nextGap) { nextGap = gap; nextRound = rt; }
  }
  if (nextRound && nextGap <= 60) return { round: nextRound.round, scheduled_time: nextRound.time };

  // Most recently passed scheduled time
  let lastPassed = null, lastMins = -1;
  for (const rt of times) {
    const m = toMins(rt.time);
    if (m <= nowMins && m > lastMins) { lastMins = m; lastPassed = rt; }
  }
  if (lastPassed) return { round: lastPassed.round, scheduled_time: lastPassed.time };

  // Nothing has passed yet today → use round 1
  return { round: times[0].round, scheduled_time: times[0].time };
}

// ── Item filtering ────────────────────────────────────────────────────────────

function reFilterItems(config, roundNum, dow) {
  // Scope rounds to the department the user is currently inside (the hub they entered through),
  // not the full set of departments they have access to. A crew with both Engine Room and Factory
  // access who entered via Engine Room should only see Engine Room rounds here; switching
  // departments from the user menu re-routes them through the Factory hub for Factory rounds.
  const activeKey = currentDepartment ? reDeptKey(currentDepartment) : null;
  const flat = [];

  for (const section of (config.sections || [])) {
    const sk = section.dept_key || null;
    // A section with no dept_key is shared (visible everywhere).
    // A section with a dept_key only renders when it matches the active hub.
    if (sk !== null && activeKey !== null && sk !== activeKey) continue;

    const visible = [];
    for (const item of (section.items || [])) {
      if (item.type === 'heading') { visible.push(item); continue; }
      if (item.active_rounds && !item.active_rounds.includes(roundNum)) continue;
      if (item.active_days  && !item.active_days.includes(dow))   continue;
      visible.push(item);
    }

    if (!visible.some(i => i.type !== 'heading')) continue;

    // Drop headings that have no data items after them
    for (let i = 0; i < visible.length; i++) {
      if (visible[i].type === 'heading') {
        if (!visible.slice(i + 1).some(x => x.type !== 'heading')) continue;
      }
      flat.push({ section, item: visible[i] });
    }
  }
  return flat;
}

// ── Aggregate value lookup ────────────────────────────────────────────────────

function reAggValue(entries, itemId) {
  if (!entries) return '—';
  const e = entries.find(x => x.item_id === itemId);
  if (!e) return '—';
  const v = e.display_value;
  return (v === null || v === undefined) ? '—' : String(v);
}

// ── OneDrive load / save ──────────────────────────────────────────────────────

async function reLoadRoundsConfig() {
  return reGet(ONEDRIVE_BASE + '/config/roundsconfig.json');
}

async function reLoadUserPrefs() {
  const data = await reGet(
    ONEDRIVE_BASE + '/config/userprefs-' + currentUser.username + '.json'
  ).catch(() => null);
  const r = data && data.rounds;
  return {
    keypad_side: (r && r.keypad_side) || 'right',
    colour_mode: (r && r.colour_mode) || 'dark'
  };
}

function reSaveUserPrefs() {
  if (!RE.prefs) return;
  rePut(ONEDRIVE_BASE + '/config/userprefs-' + currentUser.username + '.json', {
    schema_version: 2,
    username: currentUser.username,
    updated:  new Date().toISOString(),
    rounds:   { keypad_side: RE.prefs.keypad_side, colour_mode: RE.prefs.colour_mode }
  }).catch(() => {});
}

async function reLoadAggregates() {
  try {
    const year = new Date().getFullYear();
    const folder = ONEDRIVE_BASE + '/data/rounds/' + year;
    const items = await reListChildren(folder);
    const names = items
      .filter(f => /^rounds-\d{4}-\d{2}-\d{2}-\d{4}\.json$/.test(f.name))
      .map(f => f.name)
      .sort()
      .reverse();

    const fetchEntries = async name => {
      const d = await reGet(folder + '/' + name).catch(() => null);
      return d ? (d.entries || []) : null;
    };

    if (names.length >= 2) {
      [RE.aggNew, RE.aggOld] = await Promise.all([fetchEntries(names[0]), fetchEntries(names[1])]);
    } else if (names.length === 1) {
      RE.aggNew = await fetchEntries(names[0]);
    }
  } catch (_) {
    // Non-blocking — history columns remain —
  }
}

// ── Entry point ───────────────────────────────────────────────────────────────

async function initRoundsEntry() {
  const el = document.getElementById('screen-roundsentry');
  if (!el) return;

  RE.isTablet = window.innerWidth >= 768;
  el.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--text-secondary);font-size:14px">Loading rounds…</div>';

  let cfg, prefs;
  try {
    [cfg, prefs] = await Promise.all([reLoadRoundsConfig(), reLoadUserPrefs()]);
  } catch (err) {
    el.innerHTML = `<div style="padding:2rem;text-align:center;color:var(--danger)">
      Failed to load rounds configuration.<br><small style="color:var(--text-muted)">${reEsc(err.message)}</small></div>`;
    return;
  }
  if (!cfg) {
    el.innerHTML = '<div style="padding:2rem;text-align:center;color:var(--text-secondary)">No rounds configuration found on OneDrive.</div>';
    return;
  }

  RE.config   = cfg;
  RE.prefs    = prefs;
  RE.vessel   = cfg.vessel || 'F/V Araho';
  RE.submitting = false;

  const inferred = reInferRound(cfg.schedule || {});
  RE.roundNum       = inferred.round;
  RE.scheduledTime  = inferred.scheduled_time;

  RE.flatItems = reFilterItems(cfg, RE.roundNum, reLocalDow());
  RE.navItems  = RE.flatItems.filter(r => r.item.type !== 'heading');
  RE.cursorIdx = 0;
  RE.values    = {};
  RE.secd      = {};

  // Pre-populate text items as empty (they're always submittable blank)
  for (const { item } of RE.navItems) {
    if (item.type === 'text') RE.values[item.item_id] = '';
  }

  reRenderScreen();
  reBindGestures();
  window.addEventListener('resize', reOnResize);

  // Load history non-blocking; refresh grid when done
  reLoadAggregates().then(() => reRenderGrid());
}

// ── Screen render ─────────────────────────────────────────────────────────────

function reRenderScreen() {
  const el = document.getElementById('screen-roundsentry');
  if (!el || !RE.config) return;

  RE.isTablet = window.innerWidth >= 768;
  const tabClass = RE.isTablet
    ? (RE.prefs.keypad_side === 'left' ? 're-kp-left' : 're-kp-right')
    : '';

  el.setAttribute('data-re-colour', RE.prefs.colour_mode === 'light' ? 'light' : 'dark');
  el.innerHTML = `
    ${reStylesHTML()}
    <div class="re-root ${reEsc(tabClass)}" id="re-root">
      ${reHeaderHTML()}
      <div class="re-main">
        ${reColHeadersHTML()}
        <div class="re-grid-scroll" id="re-grid-scroll">
          ${reAllRowsHTML()}
        </div>
        <div class="re-submit-bar">
          <button class="re-submit-btn" id="re-submit-btn" onclick="reHandleSubmit()">Submit Rounds</button>
        </div>
      </div>
      ${reKeypadHTML()}
      <div class="re-modal-overlay" id="re-modal-overlay" style="display:none"></div>
    </div>
  `;

  reScrollToActive();
  reBindEvents();
}

// ── Header ────────────────────────────────────────────────────────────────────

function reHeaderHTML() {
  const dark     = RE.prefs.colour_mode !== 'light';
  const modeIcon = dark ? '&#9788;' : '&#9790;';
  return `
    <div class="re-header">
      <button class="re-back-btn" onclick="reExit()" aria-label="Back">
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <path d="M12 4l-6 6 6 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
      <div class="re-header-center">
        <span class="re-header-title">Rounds</span>
        <span class="re-header-sub">Round ${RE.roundNum}&nbsp;&middot;&nbsp;${reEsc(RE.scheduledTime)}</span>
      </div>
      <button class="re-mode-btn" onclick="reToggleColourMode()" title="${dark ? 'Light mode' : 'Dark mode'}">${modeIcon}</button>
    </div>
  `;
}

// ── Column headers ────────────────────────────────────────────────────────────

function reColHeadersHTML() {
  return `
    <div class="re-col-headers">
      <div class="re-ch-label">Item</div>
      <div class="re-ch-hist">Prev&#8209;2</div>
      <div class="re-ch-hist">Prev&#8209;1</div>
      <div class="re-ch-entry">Entry</div>
    </div>
  `;
}

// ── Rows ──────────────────────────────────────────────────────────────────────

function reAllRowsHTML() {
  return RE.flatItems.map(r => {
    if (r.item.type === 'heading') return reHeadingRowHTML(r);
    const ni = RE.navItems.indexOf(r);
    return reDataRowHTML(r, ni);
  }).join('');
}

function reHeadingRowHTML(r) {
  return `<div class="re-row re-heading-row"><span class="re-heading-text">${reEsc(r.item.label)}</span></div>`;
}

function reDataRowHTML(r, ni) {
  const active = ni === RE.cursorIdx;
  const iid    = r.item.item_id;
  const secd   = RE.secd[iid] || false;
  const val    = RE.values[iid] ?? '';
  const done   = reItemComplete(r.item, iid);

  const h1 = secd ? '—' : reAggValue(RE.aggOld, iid);
  const h2 = secd ? '—' : reAggValue(RE.aggNew, iid);

  return `
    <div class="re-row re-data-row${active ? ' re-active-row' : ''}${done ? ' re-done' : ''}"
         id="re-row-${ni}" data-ni="${ni}">
      <div class="re-col-label">${reEsc(r.item.label)}</div>
      <div class="re-col-hist">${reEsc(h1)}</div>
      <div class="re-col-hist">${reEsc(h2)}</div>
      ${reEntryCellHTML(r, ni, active, secd, val)}
    </div>`;
}

function reEntryCellHTML(r, ni, active, secd, val) {
  const iid  = r.item.item_id;
  const type = r.item.type;
  const ac   = active ? ' re-active-entry' : '';

  if (secd) {
    return `<div class="re-col-entry re-entry-cell re-secd-cell">SEC&apos;D</div>`;
  }
  if (type === 'checkbox') {
    const chk = val === 'true';
    return `<div class="re-col-entry re-entry-cell${ac}">
      <div class="re-checkbox${chk ? ' re-checked' : ''}" onclick="reClickCheckbox(${ni})"></div>
    </div>`;
  }
  if (type === 'custom') {
    const opts = (r.item.custom_options || [])
      .map(o => `<option value="${reEsc(o)}"${val === o ? ' selected' : ''}>${reEsc(o)}</option>`)
      .join('');
    return `<div class="re-col-entry re-entry-cell${ac}">
      <select class="re-custom-sel" onchange="reSetCustom(${ni},this.value)">
        <option value="">—</option>${opts}
      </select>
    </div>`;
  }
  if (type === 'text') {
    return `<div class="re-col-entry re-entry-cell${ac}">
      <input class="re-text-inp" type="text" value="${reEsc(val)}"
        oninput="reSetText(${ni},this.value)"
        onkeydown="reTextKd(event,${ni})">
    </div>`;
  }
  // numeric / add_oil
  const unit = r.item.unit ? `<span class="re-unit">${reEsc(r.item.unit)}</span>` : '';
  return `<div class="re-col-entry re-entry-cell${ac}">
    <span class="re-num" id="re-num-${reEsc(iid)}">${reEsc(val)}</span>${unit}
  </div>`;
}

function reItemComplete(item, iid) {
  if (RE.secd[iid]) return true;
  const v = RE.values[iid];
  if (item.type === 'text')     return true;
  if (item.type === 'checkbox') return v === 'true' || v === 'false';
  if (item.type === 'custom')   return !!v;
  return v !== '' && v !== null && v !== undefined;
}

// ── Grid refresh ──────────────────────────────────────────────────────────────

function reRenderGrid() {
  const el = document.getElementById('re-grid-scroll');
  if (!el) return;
  const scrollTop = el.scrollTop;
  el.innerHTML = reAllRowsHTML();
  el.scrollTop = scrollTop;
  reScrollToActive();
}

function reScrollToActive() {
  const row = document.getElementById('re-row-' + RE.cursorIdx);
  if (row) row.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

// ── Cursor movement ───────────────────────────────────────────────────────────

function reCursorTo(ni) {
  if (ni < 0 || ni >= RE.navItems.length) return;
  const prev = RE.cursorIdx;
  RE.cursorIdx = ni;

  // Remove highlight from previous row
  const oldRow = document.getElementById('re-row-' + prev);
  if (oldRow) {
    oldRow.classList.remove('re-active-row');
    const oc = oldRow.querySelector('.re-entry-cell');
    if (oc) oc.classList.remove('re-active-entry');
  }

  // Add highlight to new row
  const newRow = document.getElementById('re-row-' + ni);
  if (newRow) {
    newRow.classList.add('re-active-row');
    const nc = newRow.querySelector('.re-entry-cell');
    if (nc) nc.classList.add('re-active-entry');
  }

  // Keypad visibility
  const type = RE.navItems[ni]?.item?.type;
  const kp = document.getElementById('re-keypad');
  if (kp) kp.classList.toggle('re-kp-hidden', type === 'custom' || type === 'text');

  // Focus native inputs
  if (newRow) {
    if (type === 'text')   { const inp = newRow.querySelector('.re-text-inp'); if (inp) inp.focus(); }
    if (type === 'custom') { const sel = newRow.querySelector('.re-custom-sel'); if (sel) sel.focus(); }
  }

  reScrollToActive();
}

function reNavUp()   { if (RE.cursorIdx > 0) reCursorTo(RE.cursorIdx - 1); }
function reNavDown() { if (RE.cursorIdx < RE.navItems.length - 1) reCursorTo(RE.cursorIdx + 1); }

// ── Keypad ────────────────────────────────────────────────────────────────────

function reKeypadHTML() {
  const type   = RE.navItems[RE.cursorIdx]?.item?.type;
  const hidden = (type === 'custom' || type === 'text') ? ' re-kp-hidden' : '';
  const toggle = RE.isTablet
    ? `<button class="re-kp-side-toggle" onclick="reToggleKpSide()">${RE.prefs.keypad_side === 'left' ? '&#8594;' : '&#8592;'}</button>`
    : '';
  return `
    <div class="re-keypad${hidden}" id="re-keypad">
      ${toggle}
      <div class="re-kp-grid">
        <button class="re-kp-btn re-kp-fn"   onclick="reKpBs()">&#8592;</button>
        <button class="re-kp-btn re-kp-fn"   onclick="reKpKey('/')">&#247;</button>
        <button class="re-kp-btn re-kp-fn"   onclick="reKpKey('*')">&#215;</button>
        <button class="re-kp-btn re-kp-nav"  onclick="reNavUp()">&#9650;</button>

        <button class="re-kp-btn" onclick="reKpKey('7')">7</button>
        <button class="re-kp-btn" onclick="reKpKey('8')">8</button>
        <button class="re-kp-btn" onclick="reKpKey('9')">9</button>
        <button class="re-kp-btn re-kp-nav"  onclick="reNavDown()">&#9660;</button>

        <button class="re-kp-btn" onclick="reKpKey('4')">4</button>
        <button class="re-kp-btn" onclick="reKpKey('5')">5</button>
        <button class="re-kp-btn" onclick="reKpKey('6')">6</button>
        <button class="re-kp-btn re-kp-secd" onclick="reSecD()">SEC&apos;D</button>

        <button class="re-kp-btn" onclick="reKpKey('1')">1</button>
        <button class="re-kp-btn" onclick="reKpKey('2')">2</button>
        <button class="re-kp-btn" onclick="reKpKey('3')">3</button>
        <div></div>

        <button class="re-kp-btn" onclick="reKpKey('0')">0</button>
        <button class="re-kp-btn re-kp-fn" onclick="reKpDot()">.</button>
        <div></div>
        <button class="re-kp-btn re-kp-enter" onclick="reKpEnter()">&#8629;</button>
      </div>
    </div>`;
}

// ── Keypad actions ────────────────────────────────────────────────────────────

function reKpKey(k) {
  const nav = RE.navItems[RE.cursorIdx];
  if (!nav) return;
  const iid  = nav.item.item_id;
  const type = nav.item.type;
  if (RE.secd[iid]) return;
  if (type === 'checkbox') { reToggleCheckbox(RE.cursorIdx); return; }
  RE.values[iid] = (RE.values[iid] || '') + k;
  reUpdateNum(iid);
}

function reKpBs() {
  const nav = RE.navItems[RE.cursorIdx];
  if (!nav) return;
  const iid  = nav.item.item_id;
  const type = nav.item.type;
  if (RE.secd[iid]) return;
  if (type === 'checkbox') { reToggleCheckbox(RE.cursorIdx); return; }
  RE.values[iid] = (RE.values[iid] || '').slice(0, -1);
  reUpdateNum(iid);
}

function reKpDot() {
  const nav = RE.navItems[RE.cursorIdx];
  if (!nav) return;
  const iid = nav.item.item_id;
  if (RE.secd[iid]) return;
  if (nav.item.type === 'checkbox') { reToggleCheckbox(RE.cursorIdx); return; }
  const v = RE.values[iid] || '';
  if (v.includes('.')) return;
  RE.values[iid] = v + '.';
  reUpdateNum(iid);
}

function reKpEnter() {
  const nav = RE.navItems[RE.cursorIdx];
  if (!nav) return;
  if (nav.item.type === 'checkbox') reToggleCheckbox(RE.cursorIdx);
  reNavDown();
}

function reUpdateNum(iid) {
  const el = document.getElementById('re-num-' + iid);
  if (el) el.textContent = RE.values[iid] || '';
  // Update done class on the row
  const ni  = RE.navItems.findIndex(r => r.item.item_id === iid);
  const row = document.getElementById('re-row-' + ni);
  if (row && ni >= 0) {
    row.classList.toggle('re-done', reItemComplete(RE.navItems[ni].item, iid));
  }
}

// ── Checkbox ──────────────────────────────────────────────────────────────────

function reClickCheckbox(ni) {
  reCursorTo(ni);
  reToggleCheckbox(ni);
}

function reToggleCheckbox(ni) {
  const nav = RE.navItems[ni];
  if (!nav) return;
  const iid = nav.item.item_id;
  if (RE.secd[iid]) return;
  RE.values[iid] = (RE.values[iid] === 'true') ? 'false' : 'true';
  // Update checkbox element and done class in place
  const row = document.getElementById('re-row-' + ni);
  if (row) {
    const box = row.querySelector('.re-checkbox');
    if (box) box.classList.toggle('re-checked', RE.values[iid] === 'true');
    row.classList.toggle('re-done', reItemComplete(nav.item, iid));
  }
}

// ── Custom / Text ─────────────────────────────────────────────────────────────

function reSetCustom(ni, val) {
  reCursorTo(ni);
  const nav = RE.navItems[ni];
  if (!nav) return;
  const iid = nav.item.item_id;
  RE.values[iid] = val;
  const row = document.getElementById('re-row-' + ni);
  if (row) row.classList.toggle('re-done', reItemComplete(nav.item, iid));
}

function reSetText(ni, val) {
  const nav = RE.navItems[ni];
  if (!nav) return;
  RE.values[nav.item.item_id] = val;
}

function reTextKd(e, ni) {
  if (e.key === 'Enter') { e.preventDefault(); reNavDown(); }
}

// ── SEC'D ─────────────────────────────────────────────────────────────────────

function reSecD() {
  const nav = RE.navItems[RE.cursorIdx];
  if (!nav) return;
  const section = nav.section;

  // All flat entries for this section (in order)
  const secFlat = RE.flatItems.filter(r => r.section === section);
  const activePos = secFlat.indexOf(nav);

  // Find the current heading group: nearest heading at or before active position
  let headingEnd = -1; // last index of heading before activePos
  for (let i = activePos - 1; i >= 0; i--) {
    if (secFlat[i].item.type === 'heading') { headingEnd = i; break; }
  }

  // Range: from headingEnd+1 up to (but not including) the next heading after activePos
  const rangeStart = headingEnd + 1;
  let rangeEnd = secFlat.length;
  for (let i = rangeStart; i < secFlat.length; i++) {
    if (i > activePos && secFlat[i].item.type === 'heading') { rangeEnd = i; break; }
  }

  // Mark every non-heading item in range as SEC'D
  for (let i = rangeStart; i < rangeEnd; i++) {
    const { item } = secFlat[i];
    if (item.type !== 'heading') {
      RE.secd[item.item_id]   = true;
      RE.values[item.item_id] = null;
    }
  }

  // Advance cursor past the SEC'D range
  let nextNi = RE.cursorIdx + 1;
  while (nextNi < RE.navItems.length) {
    const candidate    = RE.navItems[nextNi];
    const candidatePos = secFlat.indexOf(candidate);
    // If candidate is outside the range (different section or after range), stop
    if (candidatePos === -1 || candidatePos >= rangeEnd) break;
    nextNi++;
  }

  reRenderGrid();
  RE.cursorIdx = Math.min(nextNi, RE.navItems.length - 1);
  reScrollToActive();

  const kp = document.getElementById('re-keypad');
  if (kp) {
    const t = RE.navItems[RE.cursorIdx]?.item?.type;
    kp.classList.toggle('re-kp-hidden', t === 'custom' || t === 'text');
  }
}

// ── Submit ────────────────────────────────────────────────────────────────────

function reCountIncomplete() {
  return RE.navItems.filter(({ item }) => {
    const iid = item.item_id;
    if (RE.secd[iid]) return false;
    return !reItemComplete(item, iid);
  }).length;
}

function reHandleSubmit() {
  if (RE.submitting) return;
  const n = reCountIncomplete();
  if (n > 0) {
    reShowModal(`
      <p class="re-modal-body">${n} item${n !== 1 ? 's' : ''} not yet checked.</p>
      <div class="re-modal-actions">
        <button class="re-modal-btn re-modal-primary" onclick="reCloseModal()">OK</button>
      </div>`);
    return;
  }
  reShowModal(`
    <h3 class="re-modal-title">Submit rounds?</h3>
    <p class="re-modal-body">Round ${RE.roundNum} &middot; ${reEsc(RE.scheduledTime)}</p>
    <div class="re-modal-actions">
      <button class="re-modal-btn re-modal-secondary" onclick="reCloseModal()">Cancel</button>
      <button class="re-modal-btn re-modal-primary" onclick="reConfirmSubmit()">Submit</button>
    </div>`);
}

async function reConfirmSubmit() {
  reCloseModal();
  if (RE.submitting) return;
  RE.submitting = true;

  const btn = document.getElementById('re-submit-btn');
  if (btn) { btn.textContent = 'Submitting…'; btn.disabled = true; }

  try {
    await reRefreshToken();
    const now      = new Date();
    const dateStr  = reToday();
    const hhmm     = rePad2(now.getUTCHours()) + rePad2(now.getUTCMinutes());
    const username = currentUser.username;

    const entries = [];
    for (const { section, item } of RE.flatItems) {
      if (item.type === 'heading') continue;
      const iid  = item.item_id;
      const secd = RE.secd[iid] || false;
      entries.push({
        section_id:      section.section_id,
        section_label:   section.label,
        item_id:         iid,
        item_label:      item.label,
        item_type:       item.type,
        unit:            item.unit            ?? null,
        asset_code:      item.asset_code      ?? null,
        add_oil_tank_id: item.add_oil_tank_id ?? null,
        value:           secd ? null : (RE.values[iid] ?? null),
        secd
      });
    }

    const payload = {
      schema_version: 2,
      vessel:         RE.vessel,
      username,
      display_name:   currentUser.name || username,
      round_number:   RE.roundNum,
      scheduled_time: RE.scheduledTime,
      submitted:      now.toISOString(),
      date:           dateStr,
      entries
    };

    const path = ONEDRIVE_BASE + '/data/rounds/logs/' + username +
                 '/roundslog-' + username + '-' + dateStr + '-' + hhmm + '.json';
    await rePut(path, payload);

    RE.submitting = false;
    reExit();
  } catch (err) {
    RE.submitting = false;
    if (btn) { btn.textContent = 'Submit Rounds'; btn.disabled = false; }
    reShowModal(`
      <h3 class="re-modal-title re-danger-text">Submit failed</h3>
      <p class="re-modal-body">${reEsc(err.message)}<br><br>Your data is preserved. Please retry.</p>
      <div class="re-modal-actions">
        <button class="re-modal-btn re-modal-secondary" onclick="reCloseModal()">Close</button>
        <button class="re-modal-btn re-modal-primary" onclick="reCloseModal();reHandleSubmit()">Retry</button>
      </div>`);
  }
}

// ── Modal ─────────────────────────────────────────────────────────────────────

function reShowModal(html) {
  const o = document.getElementById('re-modal-overlay');
  if (!o) return;
  o.innerHTML = `<div class="re-modal-card">${html}</div>`;
  o.style.display = 'flex';
}

function reCloseModal() {
  const o = document.getElementById('re-modal-overlay');
  if (o) o.style.display = 'none';
}

// ── Preferences ───────────────────────────────────────────────────────────────

function reToggleColourMode() {
  if (!RE.prefs) return;
  RE.prefs.colour_mode = RE.prefs.colour_mode === 'dark' ? 'light' : 'dark';
  reSaveUserPrefs();
  reRenderScreen();
}

function reToggleKpSide() {
  if (!RE.prefs) return;
  RE.prefs.keypad_side = RE.prefs.keypad_side === 'right' ? 'left' : 'right';
  reSaveUserPrefs();
  reRenderScreen();
}

// ── Resize / exit ─────────────────────────────────────────────────────────────

function reOnResize() {
  const was = RE.isTablet;
  RE.isTablet = window.innerWidth >= 768;
  if (was !== RE.isTablet) reRenderScreen();
}

function reExit() {
  reUnbindGestures();
  window.removeEventListener('resize', reOnResize);
  // Return to the department hub the user came from, not the generic Factory home.
  // Match flexibly because `currentDepartment` can vary in casing / whitespace.
  const dept = (typeof currentDepartment === 'string' ? currentDepartment : '').trim().toLowerCase();
  let target = 'screen-home';
  if (dept.indexOf('engine') !== -1 && document.getElementById('screen-engine-home')) {
    target = 'screen-engine-home';
  } else if (dept.indexOf('deck') !== -1 && document.getElementById('screen-deck-home')) {
    target = 'screen-deck-home';
  }
  showScreen(target);
}

// ── Gestures ──────────────────────────────────────────────────────────────────

function reOnTouchStart(e) {
  RE.touchStartX = e.touches[0].clientX;
  RE.touchStartY = e.touches[0].clientY;
}

function reOnTouchMove(e) {
  const dx = e.touches[0].clientX - RE.touchStartX;
  const dy = e.touches[0].clientY - RE.touchStartY;
  // Prevent pull-to-refresh: downward vertical swipe at top of scroll container
  const scroll = document.getElementById('re-grid-scroll');
  if (scroll && scroll.scrollTop === 0 && dy > 8 && Math.abs(dy) > Math.abs(dx)) {
    e.preventDefault();
    return;
  }
  // Prevent swipe-back navigation: horizontal swipe starting within 20px of either edge
  if (Math.abs(dx) > Math.abs(dy) &&
      (RE.touchStartX < 20 || RE.touchStartX > window.innerWidth - 20)) {
    e.preventDefault();
  }
}

function reBindGestures() {
  document.addEventListener('touchstart', reOnTouchStart, { passive: true });
  document.addEventListener('touchmove',  reOnTouchMove,  { passive: false });
}

function reUnbindGestures() {
  document.removeEventListener('touchstart', reOnTouchStart);
  document.removeEventListener('touchmove',  reOnTouchMove);
}

// ── Event binding ─────────────────────────────────────────────────────────────

function reBindEvents() {
  const scroll = document.getElementById('re-grid-scroll');
  if (!scroll) return;
  scroll.addEventListener('click', e => {
    const row = e.target.closest('[data-ni]');
    if (row) reCursorTo(parseInt(row.dataset.ni, 10));
  });
}

// ── Styles ────────────────────────────────────────────────────────────────────

function reStylesHTML() {
  return `<style id="re-styles">
/* ── Rounds Entry — scoped to #screen-roundsentry ─────────────────────── */

#screen-roundsentry[data-re-colour="dark"] {
  --re-bg0: #0a1628; --re-bg1: #0f1e38; --re-bg2: #162440; --re-bg3: #1e2f4d;
  --re-text: #e8f0fe; --re-text2: #7a90b0; --re-muted: #4a5c78;
  --re-border: rgba(255,255,255,0.08); --re-accent: #00c2ff;
  --re-success: #00ff99; --re-warning: #ffaa00; --re-danger: #ff4d4d;
  --re-active-row: rgba(0,194,255,0.09); --re-active-cell: rgba(0,194,255,0.20);
  --re-heading-bg: rgba(255,255,255,0.03); --re-done-text: #00ff99;
  --re-kp-bg: #0d1a30; --re-kp-btn: #162440;
}
#screen-roundsentry[data-re-colour="light"] {
  --re-bg0: #f4f7fb; --re-bg1: #e8edf4; --re-bg2: #d8e0eb; --re-bg3: #c4cedc;
  --re-text: #1a2233; --re-text2: #4a5a72; --re-muted: #8090a8;
  --re-border: rgba(0,0,0,0.09); --re-accent: #0070b8;
  --re-success: #1a7f4b; --re-warning: #b86000; --re-danger: #c53030;
  --re-active-row: rgba(0,112,184,0.10); --re-active-cell: rgba(0,112,184,0.18);
  --re-heading-bg: rgba(0,0,0,0.04); --re-done-text: #1a7f4b;
  --re-kp-bg: #e0e8f2; --re-kp-btn: #d0d9e8;
}

#screen-roundsentry { overflow: hidden; }

.re-root {
  display: flex; flex-direction: column;
  height: 100%; background: var(--re-bg0); color: var(--re-text);
  overflow: hidden; position: relative;
}

/* Header */
.re-header {
  display: flex; align-items: center; gap: 8px;
  padding: 10px 12px; background: var(--re-bg1);
  border-bottom: 1px solid var(--re-border); flex-shrink: 0;
}
.re-back-btn, .re-mode-btn {
  width: 36px; height: 36px; background: transparent;
  border: 1px solid var(--re-border); border-radius: 6px;
  color: var(--re-text2); cursor: pointer; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center; font-size: 16px;
}
.re-header-center { flex: 1; display: flex; flex-direction: column; align-items: center; }
.re-header-title  { font-size: 15px; font-weight: 600; }
.re-header-sub    { font-size: 11px; color: var(--re-text2); margin-top: 1px; }

/* Main column (grid + submit bar) */
.re-main { flex: 1; display: flex; flex-direction: column; overflow: hidden; min-width: 0; }

/* Column headers */
.re-col-headers {
  display: grid; grid-template-columns: 1fr 56px 56px 80px;
  background: var(--re-bg2); border-bottom: 1px solid var(--re-border);
  flex-shrink: 0; padding: 0 4px;
}
.re-col-headers > div {
  font-size: 10px; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.07em; color: var(--re-muted); padding: 5px 4px; text-align: center;
}
.re-ch-label { text-align: left !important; }

/* Grid scroll area */
.re-grid-scroll { flex: 1; overflow-y: auto; overflow-x: hidden; }

/* Rows */
.re-row {
  display: grid; grid-template-columns: 1fr 56px 56px 80px;
  padding: 0 4px; border-bottom: 1px solid var(--re-border);
  min-height: 48px; align-items: center;
}
.re-heading-row  { grid-template-columns: 1fr; background: var(--re-heading-bg); min-height: 32px; }
.re-heading-text { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.09em; color: var(--re-muted); padding: 0 4px; }
.re-active-row   { background: var(--re-active-row); }
.re-done .re-col-label { color: var(--re-done-text); }

/* Cells */
.re-col-label { font-size: 13px; padding: 4px 4px; line-height: 1.3; }
.re-col-hist  { font-size: 12px; color: var(--re-text2); text-align: center; padding: 0 2px; }
.re-col-entry { display: flex; align-items: center; justify-content: center; height: 100%; padding: 0 4px; }

.re-entry-cell   { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; border-radius: 4px; }
.re-active-entry { background: var(--re-active-cell); }
.re-secd-cell    { font-size: 10px; font-weight: 700; color: var(--re-muted); letter-spacing: 0.05em; }

.re-num       { font-size: 15px; font-weight: 500; font-family: monospace; min-width: 24px; text-align: right; }
.re-unit      { font-size: 10px; color: var(--re-muted); margin-left: 2px; align-self: flex-end; padding-bottom: 2px; }
.re-text-inp  { background: transparent; border: none; outline: none; color: var(--re-text); font-size: 13px; width: 100%; text-align: center; }
.re-custom-sel{ background: transparent; border: none; outline: none; color: var(--re-text); font-size: 11px; width: 100%; cursor: pointer; text-align: center; }
.re-checkbox  {
  width: 24px; height: 24px; border: 2px solid var(--re-border); border-radius: 5px;
  cursor: pointer; display: flex; align-items: center; justify-content: center;
}
.re-checkbox.re-checked { background: var(--re-accent); border-color: var(--re-accent); }
.re-checkbox.re-checked::after { content: '✓'; font-size: 15px; color: var(--re-bg0); font-weight: 700; }

/* Submit bar */
.re-submit-bar { padding: 8px 12px; background: var(--re-bg1); border-top: 1px solid var(--re-border); flex-shrink: 0; }
.re-submit-btn {
  width: 100%; padding: 13px; background: var(--re-accent); color: var(--re-bg0);
  border: none; border-radius: 10px; font-size: 15px; font-weight: 600; cursor: pointer;
}
.re-submit-btn:disabled { opacity: 0.5; cursor: not-allowed; }

/* Keypad — phone: flex child at bottom of .re-root column */
.re-keypad {
  background: var(--re-kp-bg); border-top: 2px solid var(--re-border);
  padding: 6px 8px 10px; flex-shrink: 0; transition: opacity 0.15s;
}
.re-kp-hidden { opacity: 0; pointer-events: none; }
.re-kp-grid {
  display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px;
}
.re-kp-btn {
  background: var(--re-kp-btn); border: 1px solid var(--re-border); border-radius: 8px;
  color: var(--re-text); font-size: 18px; font-weight: 500; padding: 14px 0;
  cursor: pointer; text-align: center; user-select: none; -webkit-user-select: none;
}
.re-kp-btn:active  { filter: brightness(0.8); }
.re-kp-fn          { font-size: 16px; color: var(--re-text2); }
.re-kp-nav         { font-size: 14px; color: var(--re-accent); }
.re-kp-enter       { background: var(--re-accent); color: var(--re-bg0); }
.re-kp-secd        { font-size: 11px; font-weight: 700; color: var(--re-muted); background: var(--re-bg1); letter-spacing: 0.04em; }
.re-kp-side-toggle { display: block; width: 100%; background: transparent; border: none; color: var(--re-text2); font-size: 18px; cursor: pointer; text-align: right; margin-bottom: 4px; padding: 0 4px; }

/* Tablet layout — keypad on right side */
@media (min-width: 768px) {
  .re-kp-right, .re-kp-left {
    flex-direction: row;
  }
  .re-kp-right .re-keypad {
    width: 220px; flex-shrink: 0; border-top: none;
    border-left: 2px solid var(--re-border);
    padding: 12px 8px; display: flex; flex-direction: column; justify-content: center;
  }
  .re-kp-left .re-keypad {
    order: -1; width: 220px; flex-shrink: 0; border-top: none;
    border-right: 2px solid var(--re-border);
    padding: 12px 8px; display: flex; flex-direction: column; justify-content: center;
  }
}

/* Modal */
.re-modal-overlay {
  position: absolute; inset: 0; background: rgba(0,0,0,0.65);
  display: flex; align-items: flex-end; justify-content: center;
  z-index: 200; padding: 16px; padding-bottom: max(16px, env(safe-area-inset-bottom));
}
.re-modal-card {
  background: var(--re-bg1); border: 1px solid var(--re-border);
  border-radius: 16px; padding: 24px; width: 100%; max-width: 400px;
}
.re-modal-title    { font-size: 16px; font-weight: 600; text-align: center; margin-bottom: 8px; }
.re-modal-body     { font-size: 14px; color: var(--re-text2); text-align: center; line-height: 1.5; margin-bottom: 20px; }
.re-modal-actions  { display: flex; gap: 10px; }
.re-modal-btn      { flex: 1; padding: 13px; border: none; border-radius: 10px; font-size: 14px; font-weight: 600; cursor: pointer; }
.re-modal-primary  { background: var(--re-accent); color: var(--re-bg0); }
.re-modal-secondary{ background: var(--re-bg2); color: var(--re-text2); border: 1px solid var(--re-border); }
.re-danger-text    { color: var(--re-danger); }
</style>`;
}
