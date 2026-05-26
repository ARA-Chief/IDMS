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
  // For each round item of type `group`, which section_id within that group
  // the user currently has selected. Child items only render once a section
  // is picked. Persisted in drafts so resume restores the same view.
  groupSel:     {},   // parent_item_id → section_id
  // Per-item comment thread captured during this round entry. Each entry is
  // {text, author, timestamp}. Persisted in the draft and shipped inline on
  // every item entry of the submitted roundslog (§22 — see schema doc).
  // Console reviewers append to the same array after submission.
  comments:     {},   // item_id → [{text, author, timestamp}]
  aggNew:       null, // entries[] from most recent aggregate file
  aggOld:       null, // entries[] from second-most-recent aggregate file
  // Wider history window used by group-child rows. Group children only have
  // history where the same parent picked the same section, so their synthetic
  // keys may be absent from the two newest aggregates; we scan up to ~6 back
  // to find their Prev-1/Prev-2 hits.
  aggList:      [],   // newest-first array of aggregate objects
  roundNum:     1,
  scheduledTime: '00:00',
  vessel:       '',
  submitting:   false,
  freshCursor:  false,
  isTablet:     false,
  touchStartX:  0,
  touchStartY:  0,
  sourceScreen: null,  // screen to return to on exit
  // Tracks the last subfield (lat/lon deg/min, sounding ft/in/cm, tk-percent cap)
  // the user tapped, so the in-app keypad can route input correctly even when
  // tapping a keypad button steals focus from the input (Android Chrome
  // behaviour — iOS Safari does not steal focus, which is why this bug was
  // invisible on iPad/iPhone but broke entry on Android phones).
  activeSubfield: null,  // { iid, cls, idx }  (cls = CSS class to match within the row)
  // Two-stage SEC'D arming. First press of SEC'D arms the button (turns it red,
  // no side effects). Second press while still on the same item performs the
  // actual SEC'D. Cursor movement to a different item or any other keypad
  // action disarms. Prevents accidental securing of components.
  secdArmed: null,  // item_id the SEC'D button is currently armed for, or null
};

// ── Graph API helpers ─────────────────────────────────────────────────────────

function reGraphUrl(path) {
  return 'https://graph.microsoft.com/v1.0/me/drive/root:/' +
         encodeURIComponent(path).replace(/%2F/g, '/') + ':/content';
}

function reGraphChildrenUrl(path, query) {
  return 'https://graph.microsoft.com/v1.0/me/drive/root:/' +
         encodeURIComponent(path).replace(/%2F/g, '/') + ':/children' +
         (query ? '?' + query : '');
}

async function reRefreshToken() {
  if (graphToken) return graphToken;
  if (!msalInstance || !msalAccount) throw new Error('Not signed in');
  const r = await msalInstance.acquireTokenSilent({ scopes: MSAL_SCOPES, account: msalAccount });
  graphToken = r.accessToken;
  return graphToken;
}

// Sync-pill gauge. beginNetworkOp/endNetworkOp live in index.html; guard so
// roundsentry.js stays loadable in isolated tests where they're absent.
const reNetBegin = () => { if (typeof beginNetworkOp === 'function') beginNetworkOp(); };
const reNetEnd   = ok => { if (typeof endNetworkOp === 'function') endNetworkOp(ok); };

async function reGet(path) {
  await reRefreshToken();
  reNetBegin();
  try {
    const resp = await fetch(reGraphUrl(path), {
      headers: { 'Authorization': 'Bearer ' + graphToken },
      cache: 'no-store'
    });
    if (resp.status === 404) { reNetEnd(true); return null; }
    if (!resp.ok) throw new Error('GET failed: ' + resp.status);
    const json = await resp.json();
    reNetEnd(true);
    return json;
  } catch (err) {
    reNetEnd(false);
    throw err;
  }
}

async function rePut(path, data) {
  await reRefreshToken();
  reNetBegin();
  try {
    const resp = await fetch(reGraphUrl(path), {
      method: 'PUT',
      headers: { 'Authorization': 'Bearer ' + graphToken, 'Content-Type': 'application/json' },
      body: JSON.stringify(data, null, 2)
    });
    if (!resp.ok) throw new Error('Save failed: ' + resp.status);
    reNetEnd(true);
  } catch (err) {
    reNetEnd(false);
    throw err;
  }
}

// `query` is an optional raw query string (e.g. '$orderby=name desc&$top=20').
// Graph paginates /children with @odata.nextLink; this follows the chain until
// exhausted so callers see the full listing rather than only page 1. Callers
// that only need the newest N files should pass $orderby + $top so the server
// trims the result before paginating.
async function reListChildren(path, query) {
  await reRefreshToken();
  reNetBegin();
  let url = reGraphChildrenUrl(path, query);
  const out = [];
  try {
    while (url) {
      const resp = await fetch(url, {
        headers: { 'Authorization': 'Bearer ' + graphToken },
        cache: 'no-store'
      });
      if (!resp.ok) { reNetEnd(false); return out; }
      const json = await resp.json();
      if (Array.isArray(json.value)) out.push(...json.value);
      url = json['@odata.nextLink'] || null;
    }
    reNetEnd(true);
    return out;
  } catch (err) {
    reNetEnd(false);
    throw err;
  }
}

// ── Draft persistence (offline data-loss mitigation) ─────────────────────────
// Persist in-progress rounds-entry state to localStorage so an accidental tab
// close, browser crash, or failed submit does not destroy what the user typed.
// Keyed by username + department + date + round number; one draft per round
// per day. Cleared on successful submit. Restored with user confirmation on
// re-entry so a stale draft never silently overwrites a fresh round.

function reDraftKey() {
  const u = (currentUser && currentUser.username) || '_unknown';
  const d = (typeof currentDepartment === 'string' ? currentDepartment : '') || '_';
  return 'idms_re_draft_' + u + '_' + d + '_' + reToday() + '_r' + RE.roundNum;
}

function reSaveDraft() {
  try {
    if (!RE.config || !RE.navItems || !RE.navItems.length) return;
    // Skip saving if there's nothing meaningful to save (no values, no secd flags).
    const hasValues = Object.keys(RE.values || {}).some(k => {
      const v = RE.values[k];
      return v !== null && v !== undefined && v !== '';
    });
    const hasSecd = Object.keys(RE.secd || {}).some(k => RE.secd[k]);
    const hasGroup = Object.keys(RE.groupSel || {}).length > 0;
    const hasCmt = Object.keys(RE.comments || {}).some(k =>
      Array.isArray(RE.comments[k]) && RE.comments[k].length > 0);
    if (!hasValues && !hasSecd && !hasGroup && !hasCmt) return;
    const payload = {
      saved_at:     new Date().toISOString(),
      round_number: RE.roundNum,
      scheduled:    RE.scheduledTime,
      values:       RE.values,
      secd:         RE.secd,
      groupSel:     RE.groupSel,
      comments:     RE.comments,
      cursorIdx:    RE.cursorIdx,
    };
    localStorage.setItem(reDraftKey(), JSON.stringify(payload));
  } catch (e) { /* QuotaExceeded or storage blocked — non-fatal. */ }
}

function reLoadDraft() {
  try {
    const raw = localStorage.getItem(reDraftKey());
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) { return null; }
}

function reClearDraft() {
  try { localStorage.removeItem(reDraftKey()); } catch (e) {}
}

let _reAutosaveTimer = null;
function reArmAutosave() {
  if (_reAutosaveTimer) return;
  _reAutosaveTimer = setInterval(reSaveDraft, 3000);
}
function reDisarmAutosave() {
  if (_reAutosaveTimer) { clearInterval(_reAutosaveTimer); _reAutosaveTimer = null; }
}

// Save on tab hide / page unload — the moments most likely to lose data.
window.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') reSaveDraft();
});
window.addEventListener('pagehide', reSaveDraft);
window.addEventListener('beforeunload', reSaveDraft);

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

  function itemPasses(item) {
    if (item.active_rounds && !item.active_rounds.includes(roundNum)) return false;
    if (item.active_days   && !item.active_days.includes(dow))        return false;
    return true;
  }

  for (const section of (config.sections || [])) {
    const sk = section.dept_key || null;
    // A section with no dept_key is shared (visible everywhere).
    // A section with a dept_key only renders when it matches the active hub.
    if (sk !== null && activeKey !== null && sk !== activeKey) continue;

    // Group section items by their immediately-preceding heading. Items that
    // appear before any heading live in an implicit "ungrouped" bucket so they
    // still render. This grouping is the SOURCE-ORDER one — we cannot infer a
    // heading's group from post-filter neighbours, because filtering can leave
    // an empty heading adjacent to items that actually belong to a later
    // heading. (That was the bug: e.g. "Midnight readings lat/lon" surviving
    // on round 2 because the next surviving data item happened to belong to
    // the heading after it.)
    const groups = [];
    let current  = { heading: null, items: [] };
    groups.push(current);
    for (const item of (section.items || [])) {
      if (item.type === 'heading') {
        current = { heading: item, items: [] };
        groups.push(current);
      } else {
        current.items.push(item);
      }
    }

    // Keep a group only if at least one of its data items survives the
    // round/day filter. Empty groups (including their heading) are dropped.
    let sectionHasItem = false;
    const sectionFlat = [];
    for (const g of groups) {
      const kept = g.items.filter(itemPasses);
      if (!kept.length) continue;
      if (g.heading) sectionFlat.push({ section, item: g.heading });
      for (const it of kept) {
        sectionFlat.push({ section, item: it });
        sectionHasItem = true;
      }
    }

    if (!sectionHasItem) continue;
    for (const r of sectionFlat) flat.push(r);
  }
  return flat;
}

// Expand `group` items in the filtered flat list. For each group-type round
// item, if the user has selected a section (RE.groupSel[parentId] = section_id),
// the items inside that section are inserted directly after the parent row.
//
// Child item_ids are namespaced as "parentId:childId" so:
//   1. Multiple group references can reuse the same group without ID clashes
//      in the round log and aggregate.
//   2. Aggregate history lookups for a child only match prior rounds where the
//      same parent item picked the same section — Stage 3 history scoping is
//      automatic.
//
// Each synthetic child carries `_parent*` fields used by submit/draft/history.
function reExpandGroups(baseFlat, config) {
  const groupsById = {};
  for (const g of (config.groups || [])) groupsById[g.group_id] = g;

  const out = [];
  for (const entry of baseFlat) {
    out.push(entry);
    if (entry.item.type !== 'group') continue;

    const group = groupsById[entry.item.group_id];
    if (!group) continue;
    const selSectionId = RE.groupSel[entry.item.item_id];
    if (!selSectionId) continue;
    const section = (group.sections || []).find(s => s.section_id === selSectionId);
    if (!section) continue;

    for (const childItem of (section.items || [])) {
      // Defence-in-depth: groups never contain groups (Console blocks it), but
      // if a legacy/edited config has a nested group, skip it rather than
      // recursing.
      if (childItem.type === 'group') continue;
      const synthIid = entry.item.item_id + ':' + childItem.item_id;
      out.push({
        section: entry.section,
        item: Object.assign({}, childItem, {
          item_id:         synthIid,
          _parentItemId:   entry.item.item_id,
          _parentGroupId:  group.group_id,
          _parentSectionId: section.section_id,
          _baseItemId:     childItem.item_id,
          // Child items inside a group inherit the parent's round/day filter,
          // so omit their own (which the schema requires anyway).
          active_rounds:   undefined,
          active_days:     undefined
        })
      });
    }
  }
  return out;
}

// Build RE.flatItems + RE.navItems from current config + groupSel. Called at
// entry and again whenever the user changes a group's section selection.
function reBuildItems() {
  if (!RE.config) return;
  const base = reFilterItems(RE.config, RE.roundNum, reLocalDow());
  RE.flatItems = reExpandGroups(base, RE.config);
  RE.navItems  = RE.flatItems.filter(r => r.item.type !== 'heading');
}

// ── Aggregate value lookup ────────────────────────────────────────────────────

// History lookup for a group-child row. Walks RE.aggList newest-first, returns
// up to the 2 most-recent display_values for the given synthetic key. Returns
// [Prev-1, Prev-2] with '—' filling any missing slot.
//
// Because the synthetic key encodes parent_item_id + child_item_id, a match
// implicitly means "same parent item picked the same section that contained
// this child" — Stage 3 scoping is automatic.
function reChildAggValues(synthIid) {
  const hits = [];
  for (const agg of (RE.aggList || [])) {
    let v;
    if (agg.items && typeof agg.items === 'object') {
      v = agg.items[synthIid]?.display_value;
    } else if (Array.isArray(agg.entries)) {
      v = agg.entries.find(x => x.item_id === synthIid)?.display_value;
    }
    if (v !== null && v !== undefined) {
      hits.push(String(v));
      if (hits.length === 2) break;
    }
  }
  return [hits[0] ?? '—', hits[1] ?? '—'];
}

// Accepts the v2 aggregate shape ({ items: { [itemId]: { display_value } } })
// as well as the legacy v1 shape (entries: [{ item_id, display_value }, …]).
function reAggValue(agg, itemId) {
  if (!agg) return '—';
  let v;
  if (agg.items && typeof agg.items === 'object') {
    v = agg.items[itemId]?.display_value;
  } else if (Array.isArray(agg.entries)) {
    v = agg.entries.find(x => x.item_id === itemId)?.display_value;
  } else if (Array.isArray(agg)) {
    v = agg.find(x => x.item_id === itemId)?.display_value;
  }
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
    // Ask Graph for newest-by-name first and cap the response so we don't pull
    // the entire year folder. The filename pattern embeds scheduled time as
    // YYYY-MM-DD-HHMM, so lexical desc == chronological desc.
    const items = await reListChildren(folder, '$orderby=name%20desc&$top=20');
    const names = items
      .filter(f => /^rounds-\d{4}-\d{2}-\d{2}-\d{4}\.json$/.test(f.name))
      .map(f => f.name);

    if (!names.length) return;

    // Show the two most-recently-scheduled round aggregates, regardless of
    // round_number. Filenames embed the scheduled time as HHMM, so a reverse
    // lexical sort of the year folder gives newest-scheduled first.
    //
    // We also fetch a wider window (up to 6 aggregates) to support group-child
    // history scoping: a child row only has history in rounds where the same
    // parent item picked the same section, so its synthetic key may be absent
    // from the two newest aggregates. The wider list is scanned per-child in
    // reChildAggValues. Plain (non-group) items continue to use aggNew/aggOld
    // directly so unchanged behaviour is preserved.
    const WINDOW = Math.min(names.length, 6);
    const windowNames = names.slice(0, WINDOW);
    const fetched = await Promise.all(
      windowNames.map(n => reGet(folder + '/' + n).catch(() => null))
    );
    RE.aggList = fetched.filter(a => a);
    RE.aggNew  = RE.aggList[0] || null;
    RE.aggOld  = RE.aggList[1] || null;
  } catch (_) {
    // Non-blocking — history columns remain —
  }
}

// ── Entry point ───────────────────────────────────────────────────────────────

// `opts` accepts:
//   { forceRound: <number> }  — pin to a specific round_number, bypassing the
//     time-of-day inference. Used by the Purser → Scale Calibration entry
//     point to always land on Factory round 4 regardless of when the user
//     opens the screen. If the schedule has no round_times entry for the
//     forced round, the header shows "—:—" but submission still tags the
//     payload with the forced round_number so the aggregator lines up.
async function initRoundsEntry(sourceScreen, opts) {
  const el = document.getElementById('screen-roundsentry');
  if (!el) return;
  RE.sourceScreen = sourceScreen || null;
  RE.forceRound   = (opts && typeof opts.forceRound === 'number') ? opts.forceRound : null;

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

  if (RE.forceRound != null) {
    // Caller pinned a specific round (e.g. Purser → Scale Calibration → r4).
    const rt = ((cfg.schedule && cfg.schedule.round_times) || [])
      .find(t => t && t.round === RE.forceRound);
    RE.roundNum      = RE.forceRound;
    RE.scheduledTime = (rt && rt.time) || '—:—';
  } else {
    const inferred = reInferRound(cfg.schedule || {});
    RE.roundNum       = inferred.round;
    RE.scheduledTime  = inferred.scheduled_time;
  }

  RE.groupSel = {};
  reBuildItems();

  if (!RE.navItems.length) {
    const dept   = (typeof currentDepartment !== 'undefined' && currentDepartment) || 'this department';
    const target = RE.sourceScreen || 'screen-home';
    el.innerHTML = '';
    alert('No rounds are configured for ' + dept + ' at this time.');
    if (typeof showScreen === 'function') showScreen(target);
    return;
  }

  RE.cursorIdx       = 0;
  RE.values          = {};
  RE.secd            = {};
  RE.comments        = {};
  RE.activeSubfield  = null;
  reInstallSubfieldTracking();

  // Pre-populate text items as empty (they're always submittable blank).
  // No-op for group children at this point since no section is selected yet;
  // reBuildItems() runs again after groupSel changes to pick them up.
  for (const { item } of RE.navItems) {
    if (item.type === 'text') RE.values[item.item_id] = '';
  }

  // Restore a draft if one exists for this user/dept/date/round.
  const draft = reLoadDraft();
  if (draft && draft.values) {
    const savedAt = draft.saved_at ? new Date(draft.saved_at) : null;
    const stamp   = savedAt ? rePad2(savedAt.getHours()) + ':' + rePad2(savedAt.getMinutes()) : '?';
    const resume  = window.confirm(
      'Resume saved draft for Round ' + draft.round_number +
      ' (autosaved ' + stamp + ')?\n\nOK = resume   Cancel = discard and start fresh.'
    );
    if (resume) {
      RE.values    = Object.assign(RE.values, draft.values);
      RE.secd      = draft.secd || {};
      RE.groupSel  = draft.groupSel || {};
      RE.comments  = draft.comments || {};
      RE.cursorIdx = (typeof draft.cursorIdx === 'number') ? draft.cursorIdx : 0;
      // Rebuild with the restored group selections so child rows appear.
      reBuildItems();
    } else {
      reClearDraft();
    }
  }

  reRenderScreen();
  reBindGestures();
  reArmAutosave();
  window.addEventListener('resize', reOnResize);
  reExpandFrame();

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
  const sidePanel = RE.isTablet
    ? `<div class="re-side-panel">${reHeaderHTML()}${reKeypadHTML()}</div>`
    : reKeypadHTML();

  el.innerHTML = `
    ${reStylesHTML()}
    <div class="re-root ${reEsc(tabClass)}" id="re-root">
      ${RE.isTablet ? '' : reHeaderHTML()}
      <div class="re-main">
        ${reColHeadersHTML()}
        <div class="re-grid-scroll" id="re-grid-scroll">
          ${reAllRowsHTML()}
        </div>
        <div class="re-submit-bar">
          <button class="re-submit-btn" id="re-submit-btn" onclick="reHandleSubmit()">Submit Rounds</button>
        </div>
      </div>
      ${sidePanel}
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
      ${RE.isTablet ? `<button class="re-switch-sides-btn" onclick="reToggleKpSide()" title="Switch keypad side">&#8644; Switch Sides</button>` : ''}
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
  // Insert a section-title row each time the section changes, so users can see
  // the section name (e.g. "Engine Room") above its headings + items.
  let lastSection = null;
  const out = [];
  for (const r of RE.flatItems) {
    if (r.section !== lastSection) {
      lastSection = r.section;
      const label = r.section?.label;
      if (label) out.push(reSectionTitleHTML(label));
    }
    if (r.item.type === 'heading') {
      out.push(reHeadingRowHTML(r));
    } else if (r.item.type === 'latlon') {
      out.push(reLatLonRowHTML(r, RE.navItems.indexOf(r)));
    } else if (r.item.type === 'tk_sounding' || r.item.type === 'sounding') {
      out.push(reSoundingRowHTML(r, RE.navItems.indexOf(r)));
    } else if (r.item.type === 'group') {
      out.push(reGroupParentRowHTML(r, RE.navItems.indexOf(r)));
    } else {
      out.push(reDataRowHTML(r, RE.navItems.indexOf(r)));
    }
  }
  return out.join('');
}

// Group parent row: shows the item label and a section-picker dropdown. The
// child items appear as normal rows immediately below — they were inserted by
// reExpandGroups so reAllRowsHTML walks straight through them.
function reGroupParentRowHTML(r, ni) {
  const active   = ni === RE.cursorIdx;
  const iid      = r.item.item_id;
  const group    = (RE.config.groups || []).find(g => g.group_id === r.item.group_id);
  const selected = RE.groupSel[iid] || '';

  // Sections already picked by *other* group items referencing the same group
  // in this round are hidden from this dropdown — prevents accidental double-
  // selection (which would produce duplicate synthetic item_ids and contaminate
  // history for the second occurrence). The user's own current selection is
  // always kept visible so the dropdown still shows what they picked. As soon
  // as a peer dropdown is cleared back to "—", the section reappears here.
  const taken = new Set();
  for (const peer of RE.flatItems) {
    if (peer.item.type !== 'group') continue;
    if (peer.item.item_id === iid) continue;
    if (peer.item.group_id !== r.item.group_id) continue;
    const peerSel = RE.groupSel[peer.item.item_id];
    if (peerSel) taken.add(peerSel);
  }

  // Sections marked offline in the Console group editor are hidden from the
  // user-facing dropdown. They stay in the config so prior history isn't lost.
  const sections = ((group && group.sections) || [])
    .filter(s => !s.offline)
    .filter(s => s.section_id === selected || !taken.has(s.section_id));

  let opts = '<option value="">— select —</option>';
  opts += sections.map(s =>
    `<option value="${reEsc(s.section_id)}"${selected === s.section_id ? ' selected' : ''}>${reEsc(s.label || '(unnamed)')}</option>`
  ).join('');

  // If the referenced group has been deleted or the selection points at a
  // section that no longer exists, surface that so the user can choose a real
  // one rather than the dropdown silently snapping back.
  let warn = '';
  if (!group) {
    warn = ' <span class="re-group-warn" style="color:var(--danger,#c00);font-size:11px">group missing</span>';
  } else if (selected && !sections.some(s => s.section_id === selected)) {
    warn = ' <span class="re-group-warn" style="color:var(--danger,#c00);font-size:11px">section missing</span>';
  }

  return `
    <div class="re-row re-data-row re-group-row${active ? ' re-active-row' : ''}"
         id="re-row-${ni}" data-ni="${ni}">
      <div class="re-col-label re-label-cmt" onclick="event.stopPropagation(); reOpenCommentsModal('${reEsc(iid)}')">${reEsc(r.item.label)}${warn}${reCommentBadgeHTML(iid)}</div>
      <div class="re-col-hist">—</div>
      <div class="re-col-hist">—</div>
      <div class="re-col-entry re-entry-cell">
        <select class="re-custom-sel re-group-sel"
                onchange="reSetGroupSection('${reEsc(iid)}', this.value)">
          ${opts}
        </select>
      </div>
    </div>`;
}

// Small clickable badge appended to every item label. Shows the comment count
// when any exist; a quiet "+" affordance otherwise. Tapping it (or the label
// text itself) opens the comments modal for that item. stopPropagation keeps
// the row-click cursor handler from firing on top of the modal open.
function reCommentBadgeHTML(iid) {
  const n = (RE.comments[iid] || []).length;
  const cls = n > 0 ? 're-cmt-badge re-cmt-has' : 're-cmt-badge';
  const text = n > 0 ? String(n) : '+';
  return ` <span class="${cls}" data-cmt-iid="${reEsc(iid)}"
    onclick="event.stopPropagation(); reOpenCommentsModal('${reEsc(iid)}')"
    title="Comments">${text}</span>`;
}

function reSectionTitleHTML(label) {
  return `<div class="re-row re-section-row"><span class="re-section-text">${reEsc(label)}</span></div>`;
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

  // Group children: scan the wider aggregate window for prior rounds that had
  // this exact synthetic key (i.e. same parent item + same section selected).
  // Plain items keep the cheap two-aggregate lookup.
  let h1, h2;
  if (secd) {
    h1 = '—'; h2 = '—';
  } else if (r.item._parentItemId) {
    const hist = reChildAggValues(iid);
    h2 = hist[0]; // newest match → Prev-1 (right column)
    h1 = hist[1]; // next-newest → Prev-2 (left column)
  } else {
    h1 = reAggValue(RE.aggOld, iid);
    h2 = reAggValue(RE.aggNew, iid);
  }

  return `
    <div class="re-row re-data-row${active ? ' re-active-row' : ''}${done ? ' re-done' : ''}"
         id="re-row-${ni}" data-ni="${ni}">
      <div class="re-col-label re-label-cmt" onclick="event.stopPropagation(); reOpenCommentsModal('${reEsc(iid)}')">${reEsc(r.item.label)}${reCommentBadgeHTML(iid)}</div>
      <div class="re-col-hist">${reEsc(h1)}</div>
      <div class="re-col-hist">${reEsc(h2)}</div>
      ${reEntryCellHTML(r, ni, active, secd, val)}
    </div>`;
}

function reLatLonRowHTML(r, ni) {
  const active = ni === RE.cursorIdx;
  const iid    = r.item.item_id;
  const done   = reItemComplete(r.item, iid);
  const val    = RE.values[iid] || '';
  const parts  = val.split('|');
  const latDeg = parts[0] || '';
  const latMin = parts[1] || '';
  const latHemi= parts[2] || 'N';
  const lonDeg = parts[3] || '';
  const lonMin = parts[4] || '';
  const lonHemi= parts[5] || 'W';

  return `
    <div class="re-row re-latlon-row${active ? ' re-active-row' : ''}${done ? ' re-done' : ''}"
         id="re-row-${ni}" data-ni="${ni}" data-iid-latlon="${reEsc(iid)}">
      <div class="re-latlon-label re-label-cmt" onclick="event.stopPropagation(); reOpenCommentsModal('${reEsc(iid)}')">${reEsc(r.item.label)}${reCommentBadgeHTML(iid)}</div>
      <div class="re-latlon-inputs">
        <div class="re-latlon-pair">
          <span class="re-latlon-tag">LAT</span>
          <input class="re-latlon-deg" type="text" inputmode="none"
                 placeholder="DD" value="${reEsc(latDeg)}" oninput="reLatLonUpdate('${reEsc(iid)}')">
          <span class="re-latlon-sep">°</span>
          <input class="re-latlon-min" type="text" inputmode="none"
                 placeholder="MM.mmm" value="${reEsc(latMin)}" oninput="reLatLonUpdate('${reEsc(iid)}')">
          <span class="re-latlon-sep">'</span>
          <select class="re-latlon-hemi" onchange="reLatLonUpdate('${reEsc(iid)}')">
            <option value="N" ${latHemi === 'N' ? 'selected' : ''}>N</option>
            <option value="S" ${latHemi === 'S' ? 'selected' : ''}>S</option>
          </select>
        </div>
        <div class="re-latlon-pair">
          <span class="re-latlon-tag">LON</span>
          <input class="re-latlon-deg" type="text" inputmode="none"
                 placeholder="DDD" value="${reEsc(lonDeg)}" oninput="reLatLonUpdate('${reEsc(iid)}')">
          <span class="re-latlon-sep">°</span>
          <input class="re-latlon-min" type="text" inputmode="none"
                 placeholder="MM.mmm" value="${reEsc(lonMin)}" oninput="reLatLonUpdate('${reEsc(iid)}')">
          <span class="re-latlon-sep">'</span>
          <select class="re-latlon-hemi" onchange="reLatLonUpdate('${reEsc(iid)}')">
            <option value="E" ${lonHemi === 'E' ? 'selected' : ''}>E</option>
            <option value="W" ${lonHemi === 'W' ? 'selected' : ''}>W</option>
          </select>
        </div>
      </div>
    </div>`;
}

function reSoundingRowHTML(r, ni) {
  const active = ni === RE.cursorIdx;
  const iid    = r.item.item_id;
  const done   = reItemComplete(r.item, iid);
  const val    = RE.values[iid] ?? '';
  const meas   = r.item.sounding_measurement || 'standard';

  let inputsHTML;
  if (meas === 'metric') {
    inputsHTML = `
      <div class="re-snd-pair">
        <input class="re-snd-cm re-snd-input" type="text" inputmode="none"
               placeholder="0.0" value="${reEsc(val)}"
               oninput="reSetSounding(${ni},this.value,'cm')">
        <span class="re-snd-unit">CM</span>
      </div>`;
  } else {
    const [ftPart, inPart] = String(val || '').split('|');
    inputsHTML = `
      <div class="re-snd-pair">
        <input class="re-snd-ft re-snd-input" type="text" inputmode="none"
               placeholder="0" value="${reEsc(ftPart || '')}"
               oninput="reSetSounding(${ni},this.value,'ft')">
        <span class="re-snd-unit">'</span>
        <input class="re-snd-in re-snd-input" type="text" inputmode="none"
               placeholder="0.0" value="${reEsc(inPart || '')}"
               oninput="reSetSounding(${ni},this.value,'in')">
        <span class="re-snd-unit">"</span>
      </div>`;
  }

  return `
    <div class="re-row re-snd-row${active ? ' re-active-row' : ''}${done ? ' re-done' : ''}"
         id="re-row-${ni}" data-ni="${ni}">
      <div class="re-snd-label re-label-cmt" onclick="event.stopPropagation(); reOpenCommentsModal('${reEsc(iid)}')">${reEsc(r.item.label)}${reCommentBadgeHTML(iid)}</div>
      <div class="re-snd-inputs">${inputsHTML}</div>
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
if (type === 'tk_percent') {
    // Operator types USG directly. The fill % is calculated and shown read-only
    // so they can sanity-check the entry, but cannot type into it (prevents
    // typos that get multiplied into nonsense values via the old pct → usg path).
    const cap     = Number(r.item.tk_percent_capacity) || 0;
    const usgVal  = val === '' || val == null ? '' : Number(val);
    const pctVal  = (usgVal !== '' && cap > 0) ? Math.round((usgVal / cap) * 1000) / 10 : '';
    return `<div class="re-col-entry re-entry-cell${ac}">
      <input class="re-text-inp re-tkp-cap" type="text" inputmode="none"
        value="${reEsc(usgVal === '' ? '' : String(usgVal))}"
        oninput="reSetTkPercent(${ni},this.value,'cap')"
        onkeydown="reTextKd(event,${ni})" style="width:68px">
      <span class="re-unit">USG</span>
      <span class="re-tkp-pct-display re-unit" id="re-tkp-pct-${reEsc(iid)}" style="min-width:54px;display:inline-block;text-align:right">${pctVal === '' ? '—' : pctVal + '%'}</span>
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
  if (item.type === 'group')    return !!RE.groupSel[iid];
  if (item.type === 'latlon') {
    if (!v) return false;
    const p = v.split('|');
    return p.length === 6 && p[0] !== '' && p[1] !== '' && p[3] !== '' && p[4] !== '';
  }
  return v !== '' && v !== null && v !== undefined;
}

// Group section selection: confirm + discard any values already entered for
// the previously-selected section, then re-expand and re-render so the new
// section's child items appear.
function reSetGroupSection(parentIid, sectionId) {
  const prev = RE.groupSel[parentIid] || '';
  if (prev === sectionId) return;

  // If any child values from the previous section are present, confirm before
  // wiping them.
  const prefix = parentIid + ':';
  const hasEntries = Object.keys(RE.values).some(k => k.startsWith(prefix) &&
    RE.values[k] !== '' && RE.values[k] !== null && RE.values[k] !== undefined);
  if (prev && hasEntries) {
    const ok = window.confirm('Switching sections will discard values entered for the current selection. Continue?');
    if (!ok) {
      // Snap the <select> back to the previous selection.
      reBuildItems(); reRenderGrid();
      return;
    }
  }

  // Discard child values + SEC'D flags under this parent's namespace.
  for (const k of Object.keys(RE.values)) {
    if (k.startsWith(prefix)) delete RE.values[k];
  }
  for (const k of Object.keys(RE.secd)) {
    if (k.startsWith(prefix)) delete RE.secd[k];
  }

  if (sectionId) RE.groupSel[parentIid] = sectionId;
  else delete RE.groupSel[parentIid];

  reBuildItems();
  // Pre-populate empty text values for the new children.
  for (const { item } of RE.navItems) {
    if (item.type === 'text' && !(item.item_id in RE.values)) RE.values[item.item_id] = '';
  }
  // Cursor may now point past the end if children were removed; clamp it.
  if (RE.cursorIdx >= RE.navItems.length) RE.cursorIdx = Math.max(0, RE.navItems.length - 1);

  reRenderGrid();
  reSaveDraft();
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
  if (ni !== prev) {
    RE.freshCursor = true;
    // Moving to a new line item always disarms SEC'D — this is the primary
    // safety reset the feature was designed around.
    if (RE.secdArmed !== null) reSetSecdArmed(null);
  }
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
  if (kp) kp.classList.toggle('re-kp-hidden',
    type === 'custom' || type === 'text');

  // Focus native inputs — only when moving to a different row, so taps on
  // sub-fields within the already-active row (e.g. lat/lon minutes) aren't
  // hijacked back to the first sub-field.
  if (newRow && ni !== prev) {
    if (type === 'text')     { const inp = newRow.querySelector('.re-text-inp'); if (inp) inp.focus(); }
    if (type === 'custom')   { const sel = newRow.querySelector('.re-custom-sel'); if (sel) sel.focus(); }
    if (type === 'latlon')   { const inp = newRow.querySelector('.re-latlon-deg'); if (inp) inp.focus(); }
    if (type === 'tk_sounding' || type === 'sounding') {
      const inp = newRow.querySelector('.re-snd-ft, .re-snd-cm, .re-snd-input');
      if (inp) inp.focus();
    }
    if (type === 'tk_percent') {
      const inp = newRow.querySelector('.re-tkp-cap');
      if (inp) inp.focus();
    }
  }

  reScrollToActive();
}

function reNavUp()   { if (RE.cursorIdx > 0) reCursorTo(RE.cursorIdx - 1); }
function reNavDown() { if (RE.cursorIdx < RE.navItems.length - 1) reCursorTo(RE.cursorIdx + 1); }

// ── Keypad ────────────────────────────────────────────────────────────────────

function reKeypadHTML() {
  const type   = RE.navItems[RE.cursorIdx]?.item?.type;
  const hidden = (type === 'custom' || type === 'text') ? ' re-kp-hidden' : '';
  const toggle = '';
  return `
    <div class="re-keypad${hidden}" id="re-keypad">
      ${toggle}
      <div class="re-kp-grid">
        <button class="re-kp-btn re-kp-fn re-kp-bs" onclick="reKpBs()">&#8592;</button>
        <button class="re-kp-btn re-kp-fn"  onclick="reKpMinus()" title="Toggle negative">&#8722;</button>
        <button class="re-kp-btn re-kp-nav" onclick="reNavUp()">&#9650;</button>

        <button class="re-kp-btn" onclick="reKpKey('7')">7</button>
        <button class="re-kp-btn" onclick="reKpKey('8')">8</button>
        <button class="re-kp-btn" onclick="reKpKey('9')">9</button>
        <button class="re-kp-btn re-kp-nav" onclick="reNavDown()">&#9660;</button>

        <button class="re-kp-btn" onclick="reKpKey('4')">4</button>
        <button class="re-kp-btn" onclick="reKpKey('5')">5</button>
        <button class="re-kp-btn" onclick="reKpKey('6')">6</button>
        <button class="re-kp-btn re-kp-secd" id="re-kp-secd-btn" onclick="reSecD()">SEC&apos;D</button>

        <button class="re-kp-btn" onclick="reKpKey('1')">1</button>
        <button class="re-kp-btn" onclick="reKpKey('2')">2</button>
        <button class="re-kp-btn" onclick="reKpKey('3')">3</button>
        <button class="re-kp-btn re-kp-enter" onclick="reKpEnter()">enter</button>

        <button class="re-kp-btn" onclick="reKpKey('0')">0</button>
        <button class="re-kp-btn re-kp-fn" onclick="reKpDot()">dcml</button>
        <div></div>
      </div>
    </div>`;
}

// ── Keypad actions ────────────────────────────────────────────────────────────

// Selectors for the subfield input types the in-app keypad drives.
const RE_SUBFIELD_SEL = '.re-latlon-deg, .re-latlon-min, .re-snd-input, .re-tkp-cap';

// Returns the active per-subfield input the keypad should route into.
//
// Originally this read `document.activeElement` directly, which works on iOS
// Safari (tapping a <button> does not steal focus) but fails on Android Chrome
// (tapping a button DOES move focus to it, so activeElement is no longer the
// input by the time the keypad handler runs).
//
// We now prefer the explicitly tracked RE.activeSubfield (updated on the last
// tap/focus of a subfield input, via delegated listeners installed in
// `reInstallSubfieldTracking`). We re-resolve it by row id + class + index so a
// re-render of the grid doesn't invalidate the reference.
function reActiveSubfieldInput() {
  // Only honour a tracked subfield if it belongs to the item the cursor is
  // currently on. Otherwise keypad input after moving from a lat/lon (or
  // sounding / tk_percent) row to a plain numeric row gets misrouted back into
  // the stale subfield — visible on rounds that include the Midnight Readings
  // lat/lon item, where every numeric entry below it silently fails to accept
  // input.
  const currentIid = RE.navItems[RE.cursorIdx]?.item?.item_id;
  const tracked = RE.activeSubfield;
  if (tracked && tracked.iid === currentIid) {
    const row = document.querySelector('[data-iid-latlon="' + cssEsc(tracked.iid) + '"]') ||
                document.getElementById('re-row-' + reCursorIdxForIid(tracked.iid));
    if (row) {
      const matches = row.querySelectorAll(tracked.cls);
      const el = matches[tracked.idx];
      if (el && el.tagName === 'INPUT') return el;
    }
  }
  // Desktop / iOS fallback — also gated to the current cursor row so a
  // lingering focus on a previous row's subfield can't hijack input either.
  const el = document.activeElement;
  if (!el || el.tagName !== 'INPUT') return null;
  if (!el.matches(RE_SUBFIELD_SEL)) return null;
  const ownerRow = el.closest('[id^="re-row-"]');
  if (ownerRow && ownerRow.id !== 're-row-' + RE.cursorIdx) return null;
  return el;
}

function cssEsc(s) {
  return String(s).replace(/(["\\\]])/g, '\\$1');
}

// Best-effort: find the cursor index whose item matches a given iid.
function reCursorIdxForIid(iid) {
  for (let i = 0; i < RE.navItems.length; i++) {
    if (RE.navItems[i].item.item_id === iid) return i;
  }
  return -1;
}

// One-time setup: track which subfield input the user last interacted with,
// and prevent keypad buttons from stealing focus on platforms (Android Chrome,
// most desktop browsers) where button taps move focus away from inputs.
let _reSubfieldTrackingInstalled = false;
function reInstallSubfieldTracking() {
  if (_reSubfieldTrackingInstalled) return;
  _reSubfieldTrackingInstalled = true;

  function record(target) {
    if (!target || !target.matches || !target.matches(RE_SUBFIELD_SEL)) return;
    // Find owning row and the index of this input among same-class siblings in the row.
    const row = target.closest('[id^="re-row-"]');
    if (!row) return;
    const nav = RE.navItems[parseInt(row.dataset.ni, 10)];
    if (!nav) return;
    // Pick the most specific class actually used to render this input.
    const cls = ['.re-latlon-deg', '.re-latlon-min', '.re-snd-ft', '.re-snd-in',
                 '.re-snd-cm', '.re-snd-input', '.re-tkp-cap']
                .find(c => target.matches(c));
    if (!cls) return;
    const siblings = row.querySelectorAll(cls);
    const idx = Array.prototype.indexOf.call(siblings, target);
    RE.activeSubfield = { iid: nav.item.item_id, cls, idx: idx < 0 ? 0 : idx };
  }

  // `focus` doesn't bubble — use capture phase.
  document.addEventListener('focus', e => record(e.target), true);
  document.addEventListener('click', e => record(e.target));
  document.addEventListener('touchstart', e => {
    if (e.touches && e.touches[0]) record(e.target);
  }, { passive: true });

  // Prevent keypad buttons from stealing focus from the subfield input on
  // desktop (mouse). We deliberately do NOT call preventDefault on touchstart
  // here: doing so suppresses the synthesised `click` event on touch devices,
  // which made the keypad unresponsive on both phone and tablet. For touch,
  // focus theft is harmless because reActiveSubfieldInput() reads the tracked
  // RE.activeSubfield first and re-resolves the input by row + class + index.
  document.addEventListener('mousedown', e => {
    const btn = e.target.closest && e.target.closest('.re-kp-btn');
    if (btn && e.cancelable) e.preventDefault();
  }, { passive: false });
}

// Mutate a subfield input's value and fire `input` so the existing per-row
// handler (reLatLonUpdate / reSetSounding / reSetTkPercent) updates RE.values.
function reSubfieldApply(input, newVal) {
  input.value = newVal;
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

function reKpKey(k) {
  const nav = RE.navItems[RE.cursorIdx];
  if (!nav) return;
  if (RE.secdArmed !== null) reSetSecdArmed(null);
  const iid  = nav.item.item_id;
  const type = nav.item.type;
  if (RE.secd[iid]) { reUnsecD(iid); RE.freshCursor = true; reRenderGrid(); }
  if (type === 'checkbox') { reToggleCheckbox(RE.cursorIdx); return; }
  const sub = reActiveSubfieldInput();
  if (sub) { reSubfieldApply(sub, (sub.value || '') + k); return; }
  if (RE.freshCursor) { RE.freshCursor = false; RE.values[iid] = k; }
  else                { RE.values[iid] = (RE.values[iid] || '') + k; }
  reUpdateNum(iid);
}

function reKpBs() {
  const nav = RE.navItems[RE.cursorIdx];
  if (!nav) return;
  if (RE.secdArmed !== null) reSetSecdArmed(null);
  const iid  = nav.item.item_id;
  const type = nav.item.type;
  if (RE.secd[iid]) { reUnsecD(iid); reRenderGrid(); return; }
  if (type === 'checkbox') { reToggleCheckbox(RE.cursorIdx); return; }
  const sub = reActiveSubfieldInput();
  if (sub) { reSubfieldApply(sub, (sub.value || '').slice(0, -1)); return; }
  if (RE.freshCursor) { RE.freshCursor = false; RE.values[iid] = ''; }
  else                { RE.values[iid] = (RE.values[iid] || '').slice(0, -1); }
  reUpdateNum(iid);
}

// Toggle a leading minus sign on the current entry. Tap once to mark as negative,
// tap again to clear. We toggle the sign rather than appending so the entry stays
// well-formed regardless of where the cursor is.
function reKpMinus() {
  const nav = RE.navItems[RE.cursorIdx];
  if (!nav) return;
  if (RE.secdArmed !== null) reSetSecdArmed(null);
  const iid  = nav.item.item_id;
  const type = nav.item.type;
  if (RE.secd[iid]) { reUnsecD(iid); RE.freshCursor = true; reRenderGrid(); }
  if (type === 'checkbox') { reToggleCheckbox(RE.cursorIdx); return; }
  // Subfield inputs (lat/lon, soundings, tank %) never accept negatives —
  // hemisphere is set by N/S/E/W selects, and depths/volumes are unsigned.
  if (reActiveSubfieldInput()) return;
  RE.freshCursor = false;
  const v = RE.values[iid] || '';
  RE.values[iid] = v.startsWith('-') ? v.slice(1) : '-' + v;
  reUpdateNum(iid);
}

function reKpDot() {
  const nav = RE.navItems[RE.cursorIdx];
  if (!nav) return;
  if (RE.secdArmed !== null) reSetSecdArmed(null);
  const iid = nav.item.item_id;
  if (RE.secd[iid]) { reUnsecD(iid); RE.freshCursor = true; reRenderGrid(); }
  if (nav.item.type === 'checkbox') { reToggleCheckbox(RE.cursorIdx); return; }
  const sub = reActiveSubfieldInput();
  if (sub) {
    const sv = sub.value || '';
    if (sv.includes('.')) return;
    reSubfieldApply(sub, sv + '.');
    return;
  }
  if (RE.freshCursor) { RE.freshCursor = false; RE.values[iid] = '.'; reUpdateNum(iid); return; }
  const v = RE.values[iid] || '';
  if (v.includes('.')) return;
  RE.values[iid] = v + '.';
  reUpdateNum(iid);
}

function reKpEnter() {
  const nav = RE.navItems[RE.cursorIdx];
  if (!nav) return;
  if (RE.secdArmed !== null) reSetSecdArmed(null);
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

// tk_percent entry — operator types USG directly; the % display updates live.
// The `field` parameter is retained for backwards compatibility with cached PWA
// installs but is ignored: only the USG input is editable now.
function reSetTkPercent(ni, val, field) {
  const nav = RE.navItems[ni];
  if (!nav) return;
  const iid = nav.item.item_id;
  const cap = Number(nav.item.tk_percent_capacity) || 0;
  const usg = (val === '' || val == null) ? '' : Number(val);
  RE.values[iid] = usg === '' ? '' : String(Math.round(usg * 10) / 10);

  // Live-update the read-only % display next to the USG input
  const row = document.getElementById('re-row-' + ni);
  if (row) {
    const pctEl = row.querySelector('.re-tkp-pct-display');
    if (pctEl) {
      const pct = (usg === '' || cap <= 0)
        ? '—'
        : (Math.round((usg / cap) * 1000) / 10) + '%';
      pctEl.textContent = pct;
    }
    row.classList.toggle('re-done', reItemComplete(nav.item, iid));
  }
}

// Sounding entry — value is 'ft|in' for standard, plain number for metric (CM).
// We merge per-field updates back into the pipe-separated string so reItemComplete
// can apply its existing non-empty check.
function reSetSounding(ni, val, field) {
  const nav = RE.navItems[ni];
  if (!nav) return;
  const iid  = nav.item.item_id;
  const meas = nav.item.sounding_measurement || 'standard';
  if (meas === 'metric') {
    RE.values[iid] = val;
  } else {
    const cur = String(RE.values[iid] || '').split('|');
    const ft  = field === 'ft' ? val : (cur[0] || '');
    const inc = field === 'in' ? val : (cur[1] || '');
    RE.values[iid] = (ft === '' && inc === '') ? '' : `${ft}|${inc}`;
  }
  const row = document.getElementById('re-row-' + ni);
  if (row) row.classList.toggle('re-done', reItemComplete(nav.item, iid));
}

function reLatLonUpdate(iid) {
  const row = document.querySelector(`[data-iid-latlon="${iid}"]`);
  if (!row) return;
  const inputs = row.querySelectorAll('.re-latlon-deg, .re-latlon-min, .re-latlon-hemi');
  const vals   = Array.from(inputs).map(i => i.value || '');
  RE.values[iid] = vals.join('|');
  const ni  = RE.navItems.findIndex(r => r.item.item_id === iid);
  const r2  = document.getElementById('re-row-' + ni);
  if (r2 && ni >= 0) r2.classList.toggle('re-done', reItemComplete(RE.navItems[ni].item, iid));
}

// ── SEC'D ─────────────────────────────────────────────────────────────────────

// Shared helper: resolve the heading-group range for a given item_id.
// Returns { secFlat, rangeStart, rangeEnd } so callers can iterate the group.
function reSecDRange(iid) {
  const ni  = RE.navItems.findIndex(r => r.item.item_id === iid);
  const nav = RE.navItems[ni];
  if (!nav) return null;

  const secFlat   = RE.flatItems.filter(r => r.section === nav.section);
  const activePos = secFlat.indexOf(nav);

  let headingEnd = -1;
  for (let i = activePos - 1; i >= 0; i--) {
    if (secFlat[i].item.type === 'heading') { headingEnd = i; break; }
  }
  const rangeStart = headingEnd + 1;
  let rangeEnd = secFlat.length;
  for (let i = rangeStart; i < secFlat.length; i++) {
    if (i > activePos && secFlat[i].item.type === 'heading') { rangeEnd = i; break; }
  }
  return { secFlat, rangeStart, rangeEnd };
}

// Clear SEC'D for the entire heading group that contains iid.
// All items in the group have their secd flag and value reset to blank.
function reUnsecD(iid) {
  const range = reSecDRange(iid);
  if (!range) return;
  const { secFlat, rangeStart, rangeEnd } = range;
  for (let i = rangeStart; i < rangeEnd; i++) {
    const { item } = secFlat[i];
    if (item.type !== 'heading') {
      RE.secd[item.item_id]   = false;
      RE.values[item.item_id] = null;
    }
  }
}

// Update the SEC'D keypad button's visual armed state.
function reSetSecdArmed(iid) {
  RE.secdArmed = iid || null;
  const btn = document.getElementById('re-kp-secd-btn');
  if (btn) btn.classList.toggle('re-kp-secd-armed', !!RE.secdArmed);
}

function reSecD() {
  const nav = RE.navItems[RE.cursorIdx];
  if (!nav) return;

  const iid = nav.item.item_id;

  // Two-stage arming: first press arms (red, no effect); second press on the
  // same item performs the SEC'D. Confirms the user really meant it.
  if (RE.secdArmed !== iid) {
    reSetSecdArmed(iid);
    return;
  }
  reSetSecdArmed(null);

  const range = reSecDRange(iid);
  if (!range) return;
  const { secFlat, rangeStart, rangeEnd } = range;

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
    if (item.type === 'add_oil') return false;
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
      <h3 class="re-modal-title">${n} item${n !== 1 ? 's' : ''} not yet checked.</h3>
      <p class="re-modal-body">Submit anyway?</p>
      <div class="re-modal-actions">
        <button class="re-modal-btn re-modal-secondary" onclick="reCloseModal()">Cancel</button>
        <button class="re-modal-btn re-modal-primary" onclick="reCloseModal();reShowRoundsSubmitConfirm()">OK</button>
      </div>`);
    return;
  }
  reShowRoundsSubmitConfirm();
}

function reShowRoundsSubmitConfirm() {
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
      // Group parent items record the section the user picked as their value.
      // Group child items carry parent_item_id + parent_section_id so the
      // aggregator and history lookup can scope to the right context.
      let value;
      if (item.type === 'group') {
        value = RE.groupSel[iid] || null;
      } else {
        value = secd ? null : (RE.values[iid] ?? null);
      }
      entries.push({
        section_id:           section.section_id,
        section_label:        section.label,
        item_id:              iid,
        item_label:           item.label,
        item_type:            item.type,
        unit:                 item.unit                 ?? null,
        asset_code:           item.asset_code           ?? null,
        add_oil_tank_id:      item.add_oil_tank_id      ?? null,
        sounding_tank_id:     item.sounding_tank_id     ?? null,
        sounding_measurement: item.sounding_measurement ?? null,
        tk_percent_tank_id:   item.tk_percent_tank_id   ?? null,
        tk_percent_capacity:  item.tk_percent_capacity  ?? null,
        // Group linkage (omitted for plain items, present on group parents
        // and on synthetic group-child entries).
        group_id:             item.type === 'group' ? (item.group_id ?? null) : (item._parentGroupId ?? undefined),
        parent_item_id:       item._parentItemId    ?? undefined,
        parent_section_id:    item._parentSectionId ?? undefined,
        base_item_id:         item._baseItemId      ?? undefined,
        value,
        secd,
        // §22 — per-item comment thread. Append-only across PWA submit and
        // Console reviewer edits. Empty array (not omitted) so downstream
        // consumers can rely on the field being present.
        comments:             Array.isArray(RE.comments[iid]) ? RE.comments[iid] : []
      });
    }

    const payload = {
      schema_version: 2,
      vessel:         RE.vessel,
      username,
      // Use the shared crew-display helper (handles nickname formatting) so
      // the rounds log carries the same display name shown elsewhere in the
      // UI. Falls back to currentUser.name, then username, if not available.
      display_name:   (typeof getDisplayFullName === 'function' ? getDisplayFullName(currentUser) : '')
                      || currentUser.name
                      || username,
      round_number:   RE.roundNum,
      scheduled_time: RE.scheduledTime,
      submitted:      now.toISOString(),
      date:           dateStr,
      entries
    };

    const year = now.getFullYear();
    const path = ONEDRIVE_BASE + '/data/rounds/logs/' + username +
                 '/' + year + '/roundslog-' + username + '-' + dateStr + '-' + hhmm + '.json';
    await rePut(path, payload);

    // Submit confirmed by OneDrive — safe to drop the local draft.
    reClearDraft();

    RE.submitting = false;
    reExit();
  } catch (err) {
    RE.submitting = false;
    if (btn) { btn.textContent = 'Submit Rounds'; btn.disabled = false; }
    // Force-save the draft immediately so the "preserved" claim is true even
    // if the user closes the tab right after seeing this modal.
    reSaveDraft();
    reShowModal(`
      <h3 class="re-modal-title re-danger-text">Submit failed</h3>
      <p class="re-modal-body">${reEsc(err.message)}<br><br>Your entries are saved on this device and will be offered for resume next time you open rounds. You can retry now, or close the app and retry later.</p>
      <div class="re-modal-actions">
        <button class="re-modal-btn re-modal-secondary" onclick="reCloseModal()">Close</button>
        <button class="re-modal-btn re-modal-primary" onclick="reCloseModal();reHandleSubmit()">Retry</button>
      </div>`);
  }
}

// ── Comments ──────────────────────────────────────────────────────────────────

function reItemLabelById(iid) {
  const row = (RE.flatItems || []).find(r => r.item && r.item.item_id === iid);
  return row ? row.item.label : iid;
}

function reFmtCommentStamp(iso) {
  try {
    const d = new Date(iso);
    const yyyy = d.getFullYear();
    const mm = rePad2(d.getMonth() + 1);
    const dd = rePad2(d.getDate());
    const hh = rePad2(d.getHours());
    const mi = rePad2(d.getMinutes());
    return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
  } catch (e) { return iso || ''; }
}

// Pending photos staged in the open comments modal. Reset on every open so
// switching between items doesn't carry uncommitted files over. Kept off RE
// so it doesn't leak into the draft serialization.
let _RE_CMT_PENDING_PHOTOS = [];

function reAttachmentsHTML(atts) {
  if (!Array.isArray(atts) || !atts.length) return '';
  return `<div class="re-cmt-attachments">${atts.map(a => `
    <img class="re-cmt-thumb"
         data-thumb-path="${reEsc(a.thumbnail_path || a.path || '')}"
         data-full-path="${reEsc(a.path || '')}"
         alt="">
  `).join('')}</div>`;
}

function reCommentsModalHTML(iid) {
  const list = RE.comments[iid] || [];
  const label = reItemLabelById(iid);
  const rows = list.length
    ? list.map(c => {
        const author = reEsc(c.author || 'unknown');
        const when = reEsc(reFmtCommentStamp(c.timestamp));
        const text = reEsc(c.text || '');
        return `<div class="re-cmt-entry">
          ${text ? `<div class="re-cmt-text">${text}</div>` : ''}
          ${reAttachmentsHTML(c.attachments)}
          <div class="re-cmt-meta">— ${author}, ${when}</div>
        </div>`;
      }).join('')
    : '<div class="re-cmt-empty">No comments yet.</div>';
  // Reset pending state every time the modal renders. Staged photos do not
  // survive a re-render or close; this is intentional — the user has not
  // committed them yet, and silently carrying them over to a different item
  // would be a worse failure than asking them to re-pick.
  _RE_CMT_PENDING_PHOTOS = [];
  return `
    <h3 class="re-modal-title">Comments — ${reEsc(label)}</h3>
    <div class="re-cmt-list" id="re-cmt-list">${rows}</div>
    <textarea id="re-cmt-input" class="re-cmt-input" rows="3"
              placeholder="Add a comment…"></textarea>
    <div class="re-cmt-photo-row">
      <label class="re-cmt-photo-btn" for="re-cmt-file">
        <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
          <rect x="1.5" y="3" width="13" height="10" rx="1.5"/>
          <circle cx="5.5" cy="6.5" r="1.2"/>
          <path d="M2 12l3.5-3.5 3 3 2-2 3.5 3.5"/>
        </svg>
        Add photo
      </label>
      <input id="re-cmt-file" type="file" accept="image/*" multiple
             style="display:none" onchange="reHandleCommentFiles(event)">
    </div>
    <div class="re-cmt-photo-preview" id="re-cmt-photo-preview"></div>
    <div class="re-cmt-err" id="re-cmt-err" style="display:none"></div>
    <div class="re-modal-actions">
      <button class="re-modal-btn re-modal-secondary" onclick="reCloseModal()">Cancel</button>
      <button class="re-modal-btn re-modal-primary" id="re-cmt-add-btn"
              onclick="reSubmitCommentFromModal('${reEsc(iid)}')">OK</button>
    </div>`;
}

function reOpenCommentsModal(iid) {
  reShowModal(reCommentsModalHTML(iid));
  // Focus textarea after render
  setTimeout(() => {
    const ta = document.getElementById('re-cmt-input');
    if (ta) ta.focus();
    // Stream thumbnails for any existing attachments into the list.
    reLoadCommentThumbnails(document.getElementById('re-cmt-list'));
  }, 0);
}

function reHandleCommentFiles(ev) {
  const input = ev && ev.target;
  if (!input || !input.files) return;
  for (const f of Array.from(input.files)) {
    if (f.type && f.type.indexOf('image/') === 0) _RE_CMT_PENDING_PHOTOS.push(f);
  }
  input.value = ''; // allow re-picking the same file
  reRenderPhotoPreview();
}

function reRenderPhotoPreview() {
  const el = document.getElementById('re-cmt-photo-preview');
  if (!el) return;
  if (!_RE_CMT_PENDING_PHOTOS.length) { el.innerHTML = ''; return; }
  el.innerHTML = _RE_CMT_PENDING_PHOTOS.map((f, i) => `
    <div class="re-cmt-pp">
      <img src="${URL.createObjectURL(f)}" alt="">
      <button type="button" class="re-cmt-pp-x"
              onclick="reRemovePendingPhoto(${i})" title="Remove">×</button>
    </div>`).join('');
}

function reRemovePendingPhoto(idx) {
  if (idx < 0 || idx >= _RE_CMT_PENDING_PHOTOS.length) return;
  _RE_CMT_PENDING_PHOTOS.splice(idx, 1);
  reRenderPhotoPreview();
}

async function reSubmitCommentFromModal(iid) {
  const ta    = document.getElementById('re-cmt-input');
  const btn   = document.getElementById('re-cmt-add-btn');
  const errEl = document.getElementById('re-cmt-err');
  if (!ta) return;
  const text = (ta.value || '').trim();
  const photos = _RE_CMT_PENDING_PHOTOS.slice(0, 5); // cap matches Tasks
  // Photo-only comments are allowed; text-only is allowed; nothing at all
  // is treated as a Cancel.
  if (!text && !photos.length) { reCloseModal(); return; }

  if (errEl) { errEl.style.display = 'none'; errEl.textContent = ''; }
  if (btn) {
    btn.disabled = true;
    btn.textContent = photos.length ? 'Uploading…' : 'Saving…';
  }

  let attachments = [];
  try {
    if (photos.length) {
      attachments = await reUploadCommentPhotos(iid, photos);
    }
  } catch (e) {
    if (btn) { btn.disabled = false; btn.textContent = 'OK'; }
    if (errEl) {
      errEl.textContent = 'Photo upload failed: ' + (e && e.message ? e.message : e);
      errEl.style.display = 'block';
    }
    // Keep the modal open so the user can retry — text + staged photos
    // remain intact (we haven't touched _RE_CMT_PENDING_PHOTOS or the
    // textarea here).
    return;
  }

  if (!Array.isArray(RE.comments[iid])) RE.comments[iid] = [];
  const newComment = {
    text:      text || '',
    author:    (currentUser && currentUser.username) || '_unknown',
    timestamp: new Date().toISOString()
  };
  if (attachments.length) newComment.attachments = attachments;
  RE.comments[iid].push(newComment);
  reSaveDraft();
  // Re-open the modal so the new comment is visible; also re-render the grid
  // so the badge count updates.
  reRenderGrid();
  reOpenCommentsModal(iid);
}

// Upload each staged photo using the existing erTaskUploadImage helper
// (resize 1080x1024 full + 240x180 thumb, JPEG, PUT to
// data/assets/pictures/{itemId}/). Returns the attachment metadata array
// ready to attach to the comment object. Throws on any failure so the
// caller can keep the modal open for retry.
async function reUploadCommentPhotos(itemId, files) {
  if (typeof erTaskUploadImage !== 'function') {
    throw new Error('Image upload helper unavailable');
  }
  // Upload sequentially so the user sees deterministic progress and so any
  // failure aborts cleanly without leaving half-uploaded pairs (full
  // succeeded, thumb failed) for the *next* photo in the batch.
  const out = [];
  for (const f of files) {
    const att = await erTaskUploadImage(itemId, f);
    out.push(att);
  }
  return out;
}

// Walk the comments list and stream each attachment thumbnail into its
// <img> by fetching the OneDrive blob with the active Graph token. Failure
// to load one image hides that thumbnail rather than breaking the modal.
async function reLoadCommentThumbnails(rootEl) {
  if (!rootEl || typeof graphToken === 'undefined' || !graphToken) return;
  const imgs = rootEl.querySelectorAll('img[data-thumb-path]:not([data-loaded])');
  for (const img of imgs) {
    const relPath = img.getAttribute('data-thumb-path');
    if (!relPath) continue;
    img.setAttribute('data-loaded', '1');
    try {
      const url  = 'https://graph.microsoft.com/v1.0/me/drive/root:/' +
                   encodeURIComponent('Documents/IDMS/' + relPath).replace(/%2F/g, '/') +
                   ':/content';
      const resp = await fetch(url, { headers: { 'Authorization': 'Bearer ' + graphToken } });
      if (!resp.ok) { img.style.display = 'none'; continue; }
      const blob = await resp.blob();
      img.src = URL.createObjectURL(blob);
      img.style.opacity = '1';
    } catch (e) {
      img.style.display = 'none';
    }
  }
  // Wire taps to open the full-size lightbox.
  rootEl.querySelectorAll('img[data-full-path]:not([data-clickwired])').forEach(img => {
    img.setAttribute('data-clickwired', '1');
    img.addEventListener('click', () => {
      const p = img.getAttribute('data-full-path');
      if (p) reOpenLightbox(p);
    });
  });
}

// Minimal fullscreen viewer for a single attachment. Tap anywhere to close.
function reOpenLightbox(relPath) {
  if (!relPath) return;
  const overlay = document.createElement('div');
  overlay.className = 're-cmt-lightbox';
  overlay.innerHTML = `
    <div class="re-cmt-lightbox-inner">
      <img id="re-cmt-lb-img" alt="">
      <div id="re-cmt-lb-spin" class="re-cmt-lightbox-spin">Loading…</div>
    </div>`;
  document.body.appendChild(overlay);
  const cleanup = () => {
    const im = overlay.querySelector('#re-cmt-lb-img');
    if (im && im.src && im.src.indexOf('blob:') === 0) URL.revokeObjectURL(im.src);
    overlay.remove();
  };
  overlay.addEventListener('click', cleanup);
  (async () => {
    try {
      const url  = 'https://graph.microsoft.com/v1.0/me/drive/root:/' +
                   encodeURIComponent('Documents/IDMS/' + relPath).replace(/%2F/g, '/') +
                   ':/content';
      const resp = await fetch(url, { headers: { 'Authorization': 'Bearer ' + graphToken } });
      if (!resp.ok) throw new Error(String(resp.status));
      const blob = await resp.blob();
      const img  = overlay.querySelector('#re-cmt-lb-img');
      const spin = overlay.querySelector('#re-cmt-lb-spin');
      img.onload = () => { img.style.opacity = '1'; if (spin) spin.remove(); };
      img.src = URL.createObjectURL(blob);
    } catch (e) {
      const spin = overlay.querySelector('#re-cmt-lb-spin');
      if (spin) spin.textContent = 'Failed to load image.';
    }
  })();
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

function reExpandFrame() {
  if (window.innerWidth < 768) return;

  // Inject override styles once
  if (!document.getElementById('re-expand-style')) {
    const s = document.createElement('style');
    s.id = 're-expand-style';
    s.textContent = [
      'body.re-rounds-expanded { display: block !important; background: var(--bg-0) !important; }',
      'body.re-rounds-expanded .phone-frame {',
      '  width: 100vw !important; height: 100vh !important; height: 100dvh !important;',
      '  border-radius: 0 !important; border: none !important;',
      '  box-shadow: none !important; position: fixed !important; inset: 0 !important;',
      '}',
    ].join('\n');
    document.head.appendChild(s);
  }
  document.body.classList.add('re-rounds-expanded');

  // Also try browser fullscreen (requires a user gesture; silently ignored if unavailable)
  const root = document.documentElement;
  const req  = root.requestFullscreen || root.webkitRequestFullscreen || root.mozRequestFullScreen || root.msRequestFullscreen;
  const already = document.fullscreenElement || document.webkitFullscreenElement;
  if (req && !already) req.call(root).catch(() => {});
}

function reCollapseFrame() {
  document.body.classList.remove('re-rounds-expanded');
  const active = document.fullscreenElement || document.webkitFullscreenElement;
  if (!active) return;
  const exit = document.exitFullscreen || document.webkitExitFullscreen || document.mozCancelFullScreen || document.msExitFullscreen;
  if (exit) exit.call(document).catch(() => {});
}

function reOnResize() {
  const was = RE.isTablet;
  RE.isTablet = window.innerWidth >= 768;
  if (was !== RE.isTablet) {
    reRenderScreen();
    if (RE.isTablet) reExpandFrame();
    else reCollapseFrame();
  }
}

function reExit() {
  reCollapseFrame();
  reUnbindGestures();
  reDisarmAutosave();
  // One last save in case the user is exiting with unsubmitted values.
  reSaveDraft();
  window.removeEventListener('resize', reOnResize);
  // Use the explicit source screen set by the caller, falling back to
  // department inference so direct calls without a sourceScreen still work.
  let target = RE.sourceScreen;
  if (!target) {
    const dept = (typeof currentDepartment === 'string' ? currentDepartment : '').trim().toLowerCase();
    target = 'screen-home';
    if (dept.indexOf('engine') !== -1 && document.getElementById('screen-engine-home')) {
      target = 'screen-engine-home';
    } else if (dept.indexOf('deck') !== -1 && document.getElementById('screen-deck-home')) {
      target = 'screen-deck-home';
    }
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
  // Prevent swipe-back navigation: horizontal swipe starting within 40px of either edge.
  // Widened from 20px after observed real-world data-loss incidents during rounds entry.
  // A global guard in index.html also covers this, but keeping a rounds-scoped one means
  // the protection still works if the global guard is ever bypassed.
  if (Math.abs(dx) > Math.abs(dy) &&
      (RE.touchStartX < 40 || RE.touchStartX > window.innerWidth - 40)) {
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
.re-section-row  { grid-template-columns: 1fr; background: var(--re-bg1); min-height: 40px; border-bottom: 1px solid var(--re-border); }
.re-section-text { font-size: 14px; font-weight: 700; letter-spacing: 0.04em; color: var(--re-text); padding: 0 6px; }
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

/* Comment badge + clickable label */
.re-label-cmt { cursor: pointer; }
.re-cmt-badge {
  display: inline-flex; align-items: center; justify-content: center;
  min-width: 18px; height: 18px; padding: 0 5px; margin-left: 6px;
  font-size: 11px; font-weight: 700; line-height: 1;
  border-radius: 9px; color: var(--re-muted);
  border: 1px solid var(--re-border); background: transparent;
  vertical-align: middle;
}
.re-cmt-badge.re-cmt-has { color: var(--re-bg0); background: var(--re-accent); border-color: var(--re-accent); }
.re-cmt-list { max-height: 240px; overflow-y: auto; margin: 8px 0; }
.re-cmt-entry { padding: 6px 4px; border-bottom: 1px solid var(--re-border); }
.re-cmt-entry:last-child { border-bottom: none; }
.re-cmt-text { font-size: 13px; color: var(--re-text); white-space: pre-wrap; }
.re-cmt-meta { font-size: 11px; color: var(--re-muted); margin-top: 2px; }
.re-cmt-empty { font-size: 12px; color: var(--re-muted); padding: 8px 4px; font-style: italic; }
.re-cmt-input {
  width: 100%; box-sizing: border-box; resize: vertical;
  background: var(--re-bg0); color: var(--re-text);
  border: 1px solid var(--re-border); border-radius: 4px;
  padding: 6px 8px; font-size: 13px; font-family: inherit; margin-top: 4px;
}

/* Per-comment attachments grid (existing comments) */
.re-cmt-attachments {
  display: flex; flex-wrap: wrap; gap: 5px;
  margin: 4px 0 0;
}
.re-cmt-thumb {
  width: 72px; height: 54px; object-fit: cover; border-radius: 4px;
  background: var(--re-bg0);
  opacity: 0; transition: opacity 0.2s;
  cursor: zoom-in;
}

/* "Add photo" picker row + preview tiles (new comment) */
.re-cmt-photo-row {
  display: flex; align-items: center; margin-top: 6px;
}
.re-cmt-photo-btn {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 6px 10px;
  background: transparent; color: var(--re-text2);
  border: 1px solid var(--re-border); border-radius: 4px;
  font-size: 12px; cursor: pointer;
  user-select: none;
  -webkit-user-select: none;
  -webkit-tap-highlight-color: transparent;
}
.re-cmt-photo-btn:active { background: var(--re-bg0); }
.re-cmt-photo-preview {
  display: flex; flex-wrap: wrap; gap: 5px; margin-top: 6px;
}
.re-cmt-pp { position: relative; width: 60px; height: 46px; }
.re-cmt-pp img {
  width: 60px; height: 46px; object-fit: cover; border-radius: 3px;
  background: var(--re-bg0);
}
.re-cmt-pp-x {
  position: absolute; top: -5px; right: -5px;
  background: rgba(239, 68, 68, 0.92); color: #fff;
  border: none; border-radius: 50%;
  width: 16px; height: 16px; font-size: 10px; line-height: 1;
  cursor: pointer; padding: 0;
  display: flex; align-items: center; justify-content: center;
  -webkit-tap-highlight-color: transparent;
}
.re-cmt-err {
  font-size: 12px; color: #c53030; margin-top: 6px;
}

/* Fullscreen lightbox for opening a comment attachment */
.re-cmt-lightbox {
  position: fixed; inset: 0; z-index: 99999;
  background: rgba(0,0,0,0.92);
  display: flex; align-items: center; justify-content: center;
  cursor: zoom-out;
  -webkit-tap-highlight-color: transparent;
}
.re-cmt-lightbox-inner { position: relative; max-width: 96vw; max-height: 96vh; }
.re-cmt-lightbox-inner img {
  max-width: 96vw; max-height: 96vh; border-radius: 4px;
  opacity: 0; transition: opacity 0.2s;
}
.re-cmt-lightbox-spin {
  color: #fff; font-size: 13px; padding: 24px; text-align: center;
}

/* Lat/Lon row */
.re-latlon-row {
  display: flex; flex-direction: column; padding: 8px 6px; gap: 6px; min-height: 80px;
}
.re-latlon-label {
  font-size: 12px; font-weight: 600; color: var(--re-text2);
  text-transform: uppercase; letter-spacing: 0.05em;
}
.re-latlon-row.re-done .re-latlon-label { color: var(--re-done-text); }
.re-latlon-inputs { display: flex; flex-direction: column; gap: 5px; }
.re-latlon-pair {
  display: flex; align-items: center; gap: 4px;
}
.re-latlon-tag {
  font-size: 10px; font-weight: 700; color: var(--re-muted);
  letter-spacing: 0.06em; width: 28px; flex-shrink: 0;
}
.re-latlon-sep { font-size: 13px; color: var(--re-muted); flex-shrink: 0; }
.re-latlon-deg {
  width: 52px; background: var(--re-bg2); border: 1px solid var(--re-border);
  border-radius: 6px; color: var(--re-text); font-size: 14px; font-family: monospace;
  padding: 5px 6px; text-align: center; -moz-appearance: textfield;
}
.re-latlon-min {
  width: 76px; background: var(--re-bg2); border: 1px solid var(--re-border);
  border-radius: 6px; color: var(--re-text); font-size: 14px; font-family: monospace;
  padding: 5px 6px; text-align: center; -moz-appearance: textfield;
}
.re-latlon-hemi {
  width: 50px; background: var(--re-bg2); border: 1px solid var(--re-border);
  border-radius: 6px; color: var(--re-text); font-size: 14px;
  padding: 5px 4px; text-align: center; cursor: pointer;
}
.re-latlon-deg::-webkit-inner-spin-button,
.re-latlon-deg::-webkit-outer-spin-button,
.re-latlon-min::-webkit-inner-spin-button,
.re-latlon-min::-webkit-outer-spin-button { -webkit-appearance: none; }
.re-latlon-deg:focus, .re-latlon-min:focus, .re-latlon-hemi:focus {
  outline: none; border-color: var(--re-accent);
}

/* Sounding row */
.re-snd-row {
  display: flex; flex-direction: column; padding: 8px 6px; gap: 6px; min-height: 80px;
}
.re-snd-label {
  font-size: 12px; font-weight: 600; color: var(--re-text2);
  text-transform: uppercase; letter-spacing: 0.05em;
}
.re-snd-row.re-done .re-snd-label { color: var(--re-done-text); }
.re-snd-inputs { display: flex; flex-direction: column; gap: 5px; }
.re-snd-pair { display: flex; align-items: center; gap: 6px; }
.re-snd-unit {
  font-size: 12px; font-weight: 700; color: var(--re-muted);
  letter-spacing: 0.04em; flex-shrink: 0;
}
.re-snd-input {
  background: var(--re-bg2); border: 1px solid var(--re-border);
  border-radius: 6px; color: var(--re-text); font-size: 14px; font-family: monospace;
  padding: 5px 6px; text-align: center; -moz-appearance: textfield;
}
.re-snd-ft { width: 64px; }
.re-snd-in { width: 72px; }
.re-snd-cm { width: 96px; }
.re-snd-input::-webkit-inner-spin-button,
.re-snd-input::-webkit-outer-spin-button { -webkit-appearance: none; }
.re-snd-input:focus { outline: none; border-color: var(--re-accent); }

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
  color: var(--re-text); font-size: 18px; font-weight: 500; padding: 28px 0;
  cursor: pointer; text-align: center; user-select: none; -webkit-user-select: none;
}
.re-kp-btn:active  { filter: brightness(0.8); }
.re-kp-fn          { font-size: 16px; color: var(--re-text2); }
.re-kp-nav         { font-size: 14px; color: var(--re-accent); }
.re-kp-bs          { grid-column: span 2; }
.re-kp-enter       { background: var(--re-accent); color: var(--re-bg0); grid-row: span 2; font-size: 13px; }
.re-kp-secd        { font-size: 11px; font-weight: 700; color: var(--re-muted); background: var(--re-bg1); letter-spacing: 0.04em; }
/* Armed state — first tap of SEC'D arms (red, no side effect); second tap on
   the same item performs the SEC'D. Cursor movement or any other keypad
   action disarms. Safety guard against accidental securing of components. */
.re-kp-secd.re-kp-secd-armed { background: var(--re-danger); color: #fff; }
.re-kp-side-toggle { display: none; }
.re-switch-sides-btn {
  flex-shrink: 0; background: var(--re-bg2); border: 1px solid var(--re-border);
  border-radius: 8px; color: var(--re-text2); font-size: 13px; font-weight: 500;
  padding: 6px 10px; cursor: pointer; white-space: nowrap;
}
.re-switch-sides-btn:active { filter: brightness(0.8); }

/* Tablet layout — header + keypad in right side panel */
@media (min-width: 768px) {
  .re-kp-right, .re-kp-left { flex-direction: row; }

  .re-side-panel {
    display: flex; flex-direction: column;
    width: 520px; flex-shrink: 0;
    border-left: 2px solid var(--re-border);
  }
  .re-kp-left .re-side-panel {
    order: -1;
    border-left: none;
    border-right: 2px solid var(--re-border);
  }

  /* Header inside the side panel */
  .re-side-panel .re-header {
    flex-shrink: 0;
    border-bottom: 1px solid var(--re-border);
  }

  /* Keypad fills remaining side-panel height */
  .re-side-panel .re-keypad {
    flex: 1; border-top: none;
    padding: 12px 8px;
    display: flex; flex-direction: column; justify-content: center;
  }

  /* Tablet font-size bump — grid rows only */
  .re-col-headers > div    { font-size: 12px; }
  .re-heading-text         { font-size: 12px; }
  .re-section-text         { font-size: 16px; }
  .re-col-label            { font-size: 15px; }
  .re-col-hist             { font-size: 14px; }
  .re-num                  { font-size: 17px; }
  .re-unit                 { font-size: 12px; }
  .re-text-inp             { font-size: 15px; }
  .re-custom-sel           { font-size: 13px; }
  .re-secd-cell            { font-size: 12px; }
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
