'use strict';

// Count sessions and the location sheet (§42.7a) — the two things the Stock
// Location screen is built out of, checked against the reducer directly.
//
// The screen itself is two files that must not drift, so the last block here
// pulls the PWA's own render functions out of `procurement.html` and runs them
// over the same reduced state. That is not a screenshot test: it proves the
// phone's sheet is built from `locationSheet` and asks the same question of a
// shelf that the Console's does, which is the property that makes an audit
// signable at all.

const { REDUCER, REPO, counter } = require('./_paths');
const fs = require('fs');
const path = require('path');
const R = require(REDUCER);
const T = counter(), check = T.check;

// ── A tiny ship: two bins under a room under a deck ─────────────────────────
const cat = {
  baseline_at: null,
  locations: {
    'LOC-0001': { location_id: 'LOC-0001', path: 'Maindeck', deck: 'Maindeck', depth: 1, parent_id: null, items_here: 0, items_deep: 4, sublocations: 2 },
    'LOC-0002': { location_id: 'LOC-0002', path: 'Maindeck\\Fwd Shop', deck: 'Maindeck', depth: 2, parent_id: 'LOC-0001', items_here: 1, items_deep: 4, sublocations: 1 },
    'LOC-0003': { location_id: 'LOC-0003', path: 'Maindeck\\Fwd Shop\\SH 5', deck: 'Maindeck', depth: 3, parent_id: 'LOC-0002', items_here: 3, items_deep: 3, sublocations: 0 }
  },
  items: {
    'ITM-00001': { name: 'Gasket', unit: 'ea', location_id: 'LOC-0003', in_stock: 15, consumption: {} },
    'ITM-00002': { name: 'Bolt',   unit: 'ea', location_id: 'LOC-0003', in_stock: 4,  consumption: {} },
    'ITM-00003': { name: 'Seal',   unit: 'ea', location_id: 'LOC-0003', in_stock: null, consumption: {} },
    'ITM-00004': { name: 'Filter', unit: 'ea', location_id: 'LOC-0002', in_stock: 9,  consumption: {} }
  }
};

const ev = (t, ts, payload, actor) =>
  ({ schema_version: 1, event_id: t + ts, event_type: t, timestamp: ts,
     actor: actor || 'wostara', payload });

// ── A spot correction is what it always was ─────────────────────────────────
// The Count button has filed this movement since §42.7. A session must not
// change its shape, or every count taken before this feature stops replaying.
T.head('spot correction — a count with no session');
let st = R.reduce([
  ev('stock_movement', '2026-09-06T10:00:00.000Z',
     { movement_id: 'm1', item_id: 'ITM-00001', kind: 'count', location_id: 'LOC-0003', counted_qty: 12 })
], cat);
check('on_hand becomes what was counted', st.items['ITM-00001'].on_hand, 12);
check('variance explains the correction', st.items['ITM-00001'].movements[0].variance, -3);
check('no session on it', st.items['ITM-00001'].movements[0].session_id, null);
check('but it still verifies the item', st.items['ITM-00001'].last_verified_at, '2026-09-06T10:00:00.000Z');
check('and creates no session', Object.keys(st.count_sessions).length, 0);

// ── A formal sweep ──────────────────────────────────────────────────────────
T.head('audit — one space walked end to end');
const sweep = [
  ev('count_session_opened', '2026-09-06T11:00:00.000Z',
     { session_id: 'S1', location_id: 'LOC-0003', scope: 'here', expected_items: 3 }),
  ev('stock_movement', '2026-09-06T11:05:00.000Z',
     { movement_id: 'm2', item_id: 'ITM-00002', kind: 'count', location_id: 'LOC-0003',
       counted_qty: 6, session_id: 'S1' }),
  ev('count_session_closed', '2026-09-06T11:20:00.000Z',
     { session_id: 'S1', confirmed: ['ITM-00001', 'ITM-00003'], note: 'Walked bow to stern' })
];
st = R.reduce(sweep, cat);
let s1 = st.count_sessions.S1;
check('closed', s1.status, 'closed');
check('on the space it was opened on', s1.location_id, 'LOC-0003');
check('one corrected', s1.items_counted, 1);
check('two confirmed', s1.items_confirmed, 2);
check('three seen', s1.items_seen, 3);
check('one variance', s1.variance_count, 1);
check('net +2', s1.net_delta, 2);
check('full coverage', s1.coverage, 1);
check('the corrected item moved', st.items['ITM-00002'].on_hand, 6);
check('and its movement names the session', st.items['ITM-00002'].movements[0].session_id, 'S1');

// The whole point of the confirmed list: an item nobody touched, that somebody
// nevertheless looked at. No movement can say this, because nothing moved.
check('a confirmed item is unchanged', st.items['ITM-00001'].on_hand, 15);
check('but is marked as seen', st.items['ITM-00001'].last_verified_at, '2026-09-06T11:20:00.000Z');
check('and was never counted', st.items['ITM-00001'].last_count_at, null);

T.head('a count filed before the session that opened it');
// Two phones, two clocks. The session is created in the same pass as
// item_created for exactly this reason.
st = R.reduce([sweep[1], sweep[0], sweep[2]], cat);
check('still attaches to its session', st.count_sessions.S1.items_counted, 1);
check('and the sweep still reads as complete', st.count_sessions.S1.items_seen, 3);

T.head('abandoning a walk does not un-count the shelves');
st = R.reduce([
  sweep[0], sweep[1],
  ev('count_session_abandoned', '2026-09-06T11:30:00.000Z',
     { session_id: 'S1', reason: 'Called to the deck' })
], cat);
check('the session is abandoned', st.count_sessions.S1.status, 'abandoned');
check('the correction stands', st.items['ITM-00002'].on_hand, 6);
check('the space is not recorded as swept', Object.keys(R.lastVerified(st)).length, 0);

T.head('lastVerified — when each space was last swept');
const lv = R.lastVerified(R.reduce(sweep, cat));
check('keyed by location', Object.keys(lv), ['LOC-0003']);
check('carries the variance count', lv['LOC-0003'].variance_count, 1);
check('and who closed it', lv['LOC-0003'].closed_by, 'wostara');

// A later closed session wins; an abandoned one never displaces a closed one.
st = R.reduce(sweep.concat([
  ev('count_session_opened', '2026-09-07T09:00:00.000Z',
     { session_id: 'S2', location_id: 'LOC-0003', scope: 'here', expected_items: 3 }),
  ev('count_session_abandoned', '2026-09-07T09:30:00.000Z', { session_id: 'S2' })
]), cat);
check('an abandoned sweep does not overwrite a good one',
  R.lastVerified(st)['LOC-0003'].session_id, 'S1');

// ── The sheet ───────────────────────────────────────────────────────────────
T.head('the count sheet for a space');
st = R.reduce([], cat);
let sheet = R.locationSheet(st, cat, 'LOC-0003', { scope: 'here' });
check('three items in the bin', sheet.length, 3);
check('alphabetical, the way a shelf is read', sheet.map(r => r.name), ['Bolt', 'Gasket', 'Seal']);
check('book figure is the bin, not the ship', sheet.find(r => r.name === 'Gasket').book_qty, 15);
// 2,181 items in the real export carry no stock figure. Printing 0 on a count
// sheet invites somebody to agree with it.
check('unknown stays unknown', sheet.find(r => r.name === 'Seal').stock_unknown, true);
check('and is not reported as zero stock', sheet.find(r => r.name === 'Seal').book_qty, 0);

sheet = R.locationSheet(st, cat, 'LOC-0002', { scope: 'deep' });
check('deep includes everything under it', sheet.map(r => r.name), ['Bolt', 'Filter', 'Gasket', 'Seal']);
check('shallow does not',
  R.locationSheet(st, cat, 'LOC-0002', { scope: 'here' }).map(r => r.name), ['Filter']);
check('a deck rolls up its whole subtree', R.locationsUnder(cat, 'LOC-0001').length, 3);

T.head('an item whose home is here but whose stock was moved away');
// The most useful line on an audit sheet: a bin the book has emptied is exactly
// where a miscount hides, so it stays on the sheet rather than vanishing.
st = R.reduce([
  ev('stock_movement', '2026-09-06T09:00:00.000Z',
     { movement_id: 'm9', item_id: 'ITM-00001', kind: 'transfer', location_id: 'LOC-0003',
       to_location_id: 'LOC-0002', qty: 15 })
], cat);
sheet = R.locationSheet(st, cat, 'LOC-0003', { scope: 'here' });
const g = sheet.find(r => r.name === 'Gasket');
check('still listed', !!g, true);
check('reading zero', g.book_qty, 0);
check('and saying where it went', g.elsewhere, 15);

T.head('which space a typed count is filed against');
st = R.reduce([], cat);
check('a shallow row names its own space',
  R.locationSheet(st, cat, 'LOC-0003', { scope: 'here' })
   .find(r => r.name === 'Gasket').count_location_id, 'LOC-0003');
sheet = R.locationSheet(st, cat, 'LOC-0002', { scope: 'deep' });
check('a deep row names the bin the stock is in',
  sheet.find(r => r.name === 'Gasket').count_location_id, 'LOC-0003');
check('and a row of this space names this space',
  sheet.find(r => r.name === 'Filter').count_location_id, 'LOC-0002');

// Stock split across two bins inside one deep sheet has no single honest
// answer. Filing that count against either bin would destroy good stock, so
// the sheet offers no count location and the screen offers no box.
st = R.reduce([
  ev('stock_movement', '2026-09-06T08:00:00.000Z',
     { movement_id: 'm8', item_id: 'ITM-00001', kind: 'transfer', location_id: 'LOC-0003',
       to_location_id: 'LOC-0002', qty: 5 })
], cat);
const split = R.locationSheet(st, cat, 'LOC-0002', { scope: 'deep' }).find(r => r.name === 'Gasket');
check('split stock sums across the sheet', split.book_qty, 15);
check('but cannot be counted from it', split.count_location_id, null);
const bin = R.locationSheet(st, cat, 'LOC-0003', { scope: 'here' }).find(r => r.name === 'Gasket');
check('each bin on its own can be', bin.count_location_id, 'LOC-0003');
check('reading only its own share', bin.book_qty, 10);

// ── The PWA renders the same sheet ──────────────────────────────────────────
// procurement.html is one big inline script, so its Stock Location half is
// pulled out by name and run against the same state. This catches the drift
// that matters: the phone building a sheet from anything other than
// `locationSheet`, or asking a different question of the same shelf.
T.head('the PWA renders that sheet, not one of its own');
const html = fs.readFileSync(path.join(REPO, 'procurement.html'), 'utf8');
const start = html.indexOf('// ── View: Stock Location');
const end = html.indexOf('// ── View: Low stock');
check('the Stock Location block is where it was left', start !== -1 && end > start, true);

if (start !== -1 && end > start) {
  const block = html.slice(start, end);
  // Everything the block leans on, stubbed to the smallest thing that is still
  // honest. The reducer is the real one.
  const sandbox = {
    procurementReduce: R,
    PC: { state: R.reduce(sweep, cat), catalogue: cat, loc: null },
    pcLocations: () => sandbox.PC.catalogue.locations,
    pcDecks: () => Object.keys(sandbox.PC.catalogue.locations)
                     .map(k => sandbox.PC.catalogue.locations[k]).filter(l => !l.parent_id),
    pcEsc: s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
                 .replace(/>/g, '&gt;').replace(/"/g, '&quot;'),
    pcFmtQty: n => String(Number(n) || 0),
    pcDate: s => String(s || '').slice(0, 10),
    pcUuid: () => 'uuid',
    pcToast: () => {},
    pcHead: () => {},
    pcRenderAll: () => {},
    pcAppendEvent: async (type, payload) => { sandbox.appended.push({ type, payload }); },
    appended: [],
    pcOpenItem: () => {},
    pcDetailFor: () => ({ maker: 'Blankenship Equipment Belting', makers_type: 'Polycord 8mm' }),
    pcEnsureDetail: async () => ({}),
    localStorage: { getItem: () => '{}', setItem: () => {}, removeItem: () => {} },
    confirm: () => true,
    document: { getElementById: () => ({ set innerHTML(_v) {} }) },
    window: { scrollTo: () => {} },
    setTimeout: setTimeout, clearTimeout: clearTimeout
  };
  const names = Object.keys(sandbox);
  // eslint-disable-next-line no-new-func
  const load = new Function(...names,
    block + '\nreturn { slocSheetHtml, slocSheetBlock, slocViewRoot, slocSession, slocState,'
          + ' slocLabel, slocTrail, slocDetailHtml, slocPick, slocUnplacedCount, slocStart,'
          + ' SLOC_SHEET_CAP, SLOC_UNPLACED };');
  const api = load(...names.map(k => sandbox[k]));

  sandbox.PC.loc = api.slocState();
  sandbox.PC.loc.at = 'LOC-0003';

  const rows = R.locationSheet(sandbox.PC.state, cat, 'LOC-0003', { scope: 'here' });
  const out = api.slocSheetHtml(rows, null);
  check('one row per sheet line', (out.match(/class="ci-line/g) || []).length, rows.length);
  check('every countable row gets a box',
    (out.match(/onchange="slocCount/g) || []).length,
    rows.filter(r => r.count_location_id).length);
  check('the book figure on the row is the bin figure', out.indexOf('>6 ea<') !== -1, true);
  check('the unknown item is not printed as zero stock',
    out.indexOf('never counted') !== -1, true);

  // The last segment, not the whole Windows path — a bin on a phone.
  check('a space is labelled by its bin', api.slocLabel(cat['LOC-0003'] || cat.locations['LOC-0003']), 'SH 5');
  check('and knows its way back up',
    api.slocTrail('LOC-0003').map(l => l.location_id), ['LOC-0001', 'LOC-0002', 'LOC-0003']);

  // ── The item detail, opened under its row ────────────────────────────────
  // The pane exists so somebody who did not stow the part can tell whether the
  // thing in their hand is the thing on the line. What it must always carry is
  // the identification and *every* space the book has any of it in — when a
  // count does not match, the rest of it is usually on another shelf.
  T.head('the item detail under a sheet row');
  const gasketRow = rows.find(r => r.name === 'Gasket');
  const detail = api.slocDetailHtml(gasketRow);
  check('names the maker', detail.indexOf('Blankenship Equipment Belting') !== -1, true);
  check('carries the shipwide figure', detail.indexOf('on hand across the ship') !== -1, true);
  check('lists where the book has it', detail.indexOf('Where the book has it') !== -1, true);
  check('marks the space being walked', detail.indexOf('sloc-where here') !== -1, true);
  check('offers the full card', detail.indexOf('pcOpenItem') !== -1, true);

  // Counting corrects the number on a shelf; moving corrects which shelf. Both
  // are found out the same way — standing in front of it — so the second must
  // not send somebody back to Inventory to search the item out again. The
  // button names the space being walked, because a transfer whose origin the
  // person did not choose is the one they will get wrong.
  check('the pane offers a move out of this space',
    detail.indexOf('slocMove(&quot;ITM-00001&quot;)') !== -1, true);
  check('and names the bin rather than saying "here"',
    detail.indexOf('Move stock from SH 5') !== -1, true);

  // Split stock is the case the detail is most needed for: no count box on the
  // row at all, so the answer to "well, where is it then" has to be here.
  const splitState = R.reduce([
    ev('stock_movement', '2026-09-06T08:00:00.000Z',
       { movement_id: 'ms', item_id: 'ITM-00001', kind: 'transfer', location_id: 'LOC-0003',
         to_location_id: 'LOC-0002', qty: 5 })
  ], cat);
  sandbox.PC.state = splitState;
  sandbox.PC.loc.at = 'LOC-0002';
  const splitRow = R.locationSheet(splitState, cat, 'LOC-0002', { scope: 'deep' })
    .find(r => r.name === 'Gasket');
  check('a split row offers no count box',
    api.slocSheetHtml([splitRow], null).indexOf('onchange="slocCount') === -1, true);
  check('but its detail names both spaces',
    (api.slocDetailHtml(splitRow).match(/class="sloc-where/g) || []).length, 2);

  // What happened to it lately, which is usually the answer when a count does
  // not match the book. Back on the swept shelf, not the split one above.
  sandbox.PC.state = R.reduce(sweep, cat);
  sandbox.PC.loc.at = 'LOC-0003';
  const boltDetail = api.slocDetailHtml(rows.find(r => r.name === 'Bolt'));
  check('the last things that happened to it',
    boltDetail.indexOf('Recent movements') !== -1, true);
  check('a count that moved the book reads as a variance',
    boltDetail.indexOf('(+2)') !== -1, true);
  const sealDetail = api.slocDetailHtml(rows.find(r => r.name === 'Seal'));
  check('an item the export never gave a figure says so, in the detail too',
    sealDetail.indexOf('no stock figure in the export') !== -1, true);

  // The 2,864 items TM never gave an address. They are a door on this screen or
  // they are on no screen about stowage at all.
  check('nothing unplaced in this fixture', api.slocUnplacedCount(), 0);
  sandbox.PC.state = R.reduce([
    ev('item_created', '2026-09-06T07:00:00.000Z',
       { item_id: 'ITM-09999', name: 'Loose bolt', unit: 'ea' })
  ], cat);
  check('an item with no stowage lands there', api.slocUnplacedCount(), 1);
  check('and the space it lands in is named, not left blank',
    api.slocLabel({ location_id: api.SLOC_UNPLACED, path: '' }), 'Unlocalized Stock');

  // Moving stock *out* of Unlocalized Stock is how an item gets a home at all,
  // so the button has to work from a space with no node in the stowage tree —
  // and name it, rather than showing the crew the raw id it is keyed by.
  sandbox.PC.loc.at = api.SLOC_UNPLACED;
  const looseRow = R.locationSheet(sandbox.PC.state, cat, api.SLOC_UNPLACED, { scope: 'here' })
    .find(r => r.item_id === 'ITM-09999');
  check('the unplaced sheet has the loose item on it', !!looseRow, true);
  if (looseRow) {
    const looseDetail = api.slocDetailHtml(looseRow);
    check('a move out of Unlocalized Stock is offered',
      looseDetail.indexOf('slocMove(&quot;ITM-09999&quot;)') !== -1, true);
    check('and the space is named, not shown as its id',
      looseDetail.indexOf('Move stock from Unlocalized Stock') !== -1, true);
    check('the raw id never reaches the crew as text',
      looseDetail.replace(/<[^>]*>/g, ' ').indexOf(api.SLOC_UNPLACED), -1);
  }

  // It is 2,864 items and the obvious place to work through when assigning
  // homes, so it has to be walkable like any other space. It has no node in
  // the stowage tree, and a guard written as "is this a real location" locked
  // it out of the one action the sheet exists for.
  sandbox.PC.loc.at = api.SLOC_UNPLACED;
  sandbox.PC.loc.scope = 'here';
  sandbox.appended.length = 0;
  api.slocStart().catch(() => {});     // the append is made before the first await
  check('an audit can be opened on it', sandbox.appended.length, 1);
  check('and it opens on that space',
    sandbox.appended[0] && sandbox.appended[0].payload.location_id, api.SLOC_UNPLACED);
  check('over the sheet as it stood',
    sandbox.appended[0] && sandbox.appended[0].payload.expected_items, 1);

  // ── A sheet too long to lay out ─────────────────────────────────────────
  // Unlocalized Stock holds 2,864 items and Fwd Shop 583. Laying every one of
  // them out, each carrying a number input, is a phone that stops responding
  // before it draws anything. The cap is visible, and the filter reaches past
  // it — a sheet that silently showed a subset would be signed for stock
  // nobody saw.
  T.head('a sheet too long to lay out');
  const bigCat = {
    baseline_at: null,
    locations: {
      'LOC-0001': { location_id: 'LOC-0001', path: 'Maindeck', deck: 'Maindeck', depth: 1,
                    parent_id: null, items_here: 0, items_deep: 500, sublocations: 1 },
      'LOC-0009': { location_id: 'LOC-0009', path: 'Maindeck\\Fwd Shop', deck: 'Maindeck',
                    depth: 2, parent_id: 'LOC-0001', items_here: 500, items_deep: 500,
                    sublocations: 0 }
    },
    items: {}
  };
  for (let i = 1; i <= 500; i++) {
    bigCat.items['ITM-1' + String(i).padStart(4, '0')] = {
      name: 'Bolt M' + i, unit: 'ea', location_id: 'LOC-0009',
      in_stock: i, makers_part_no: 'PN-' + i, consumption: {}
    };
  }
  sandbox.PC.catalogue = bigCat;
  sandbox.PC.state = R.reduce([], bigCat);
  sandbox.PC.loc = api.slocState();
  sandbox.PC.loc.at = 'LOC-0009';

  const bigRows = R.locationSheet(sandbox.PC.state, bigCat, 'LOC-0009', { scope: 'here' });
  check('the whole shelf is on the sheet', bigRows.length, 500);
  const sheetBlock = api.slocSheetBlock(bigRows, null);
  check('but only the cap is laid out',
    (sheetBlock.match(/class="ci-line/g) || []).length, api.SLOC_SHEET_CAP);
  check('and the sheet says what it is not showing',
    sheetBlock.indexOf('Showing the first ' + api.SLOC_SHEET_CAP + ' of 500') !== -1, true);
  check('a long sheet is given a filter', sheetBlock.indexOf('id="sloc-sq"') !== -1, true);

  sandbox.PC.loc.sheetQ = 'PN-137';
  const filtered = api.slocSheetBlock(bigRows, null);
  check('the filter reaches past the cap',
    (filtered.match(/class="ci-line/g) || []).length, 1);
  check('and says how much of the sheet it kept', filtered.indexOf('1 of 500') !== -1, true);

  sandbox.PC.loc.sheetQ = 'no such part';
  check('a filter matching nothing is not reported as an empty shelf',
    api.slocSheetBlock(bigRows, null).indexOf('Nothing on this sheet matches') !== -1, true);

  sandbox.PC.loc.sheetQ = '';
  check('a shelf you can see the end of is given no filter at all',
    api.slocSheetBlock(bigRows.slice(0, 10), null).indexOf('id="sloc-sq"') === -1, true);
}

// ── The two doors ──────────────────────────────────────────────────────────
// The gate on ?view= was a second, hand-written copy of the view list, and it
// went stale the moment Stock Location was added to VIEWS: the tile opened and
// landed on the register. Both halves are checked, because a tile that opens
// the wrong screen is indistinguishable from a tile that works.
T.head('the hub opens the screen the tile names');
check('the ?view= gate reads VIEWS rather than a list of its own',
  html.indexOf('VIEWS.some(function (x) { return x.id === v; })') !== -1, true);
check('and Stock Location is one of them',
  html.indexOf("{ id: 'location',   label: 'Stock Location' }") !== -1, true);
check('the hub carries a tile for it',
  fs.readFileSync(path.join(REPO, 'index.html'), 'utf8')
    .indexOf("openProcurement('location')") !== -1, true);

process.exit(T.done() ? 0 : 1);
