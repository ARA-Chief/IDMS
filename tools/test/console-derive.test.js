// Does the Console's derive produce rows the Console's SQL can actually insert?
//
// The whole lane is renderer JS talking to a prepared statement in main.js, and
// the way that breaks is a column the INSERT names and the row object does not
// carry (better-sqlite3 throws "Missing named parameter"). This runs the real
// derive over the real 14,487-item catalogue and checks every row against the
// column list parsed out of main.js, without needing Electron.
const fs = require('fs');
const vm = require('vm');
const { REPO, REDUCER, findCatalogue, findConsole, counter, skip } = require('./_paths');

const IDMS = REPO;
const CON = findConsole();
if (!CON) skip('no IDMS-Console checkout found. Pass --console <path>.');
const CAT = findCatalogue();
if (!CAT) {
  skip('no catalogue.json found. Build one with ' +
       'tools/build-procurement-catalogue.py, or pass --catalogue <path>.');
}

// This suite asserts conditions rather than comparing values, so it wraps the
// shared counter rather than using its two-argument compare.
const T = counter();
function check(label, cond, detail) {
  if (cond) { T.ok++; console.log('  ok   ' + label); }
  else { T.bad++; console.log('  FAIL ' + label + (detail ? '\n       ' + detail : '')); }
}

// The Console runs `script-src 'self'`, so an inline handler attribute is
// inert: the screen renders and nothing responds. Cheap to check here,
// expensive to discover by hand.
console.log('\ncontent security policy');
const screenSrc = fs.readFileSync(CON + '/src/renderer/js/procurement.js', 'utf8');
const inlineRe = new RegExp('\\son(?:click|input|change|focus|submit|keydown)\\s*=\\s*"', 'g');
const inline = screenSrc.match(inlineRe) || [];
check('no inline event handlers in the screen', inline.length === 0,
      inline.length ? inline.length + ' found — the CSP makes every one of them dead' : '');
const appCsp = fs.readFileSync(CON + '/src/renderer/index.html', 'utf8')
  .includes("script-src 'self'");
check('the app still forbids inline script (so the rule above still matters)', appCsp);
const harness = fs.readFileSync(CON + '/src/renderer/_procurement-harness.html', 'utf8');
check('the harness enforces the same policy', harness.includes("script-src 'self'"));
check('and carries no inline script of its own',
      !/<script>[^<]/.test(harness));

// ── the reducer, loaded as the renderer would ────────────────────────────────
const sandbox = { window: {}, module: undefined, console };
sandbox.self = sandbox;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(CON + '/src/renderer/js/procurement-reduce.js', 'utf8'), sandbox);
const R = sandbox.window.procurementReduce;

console.log('\nreducer mirror');
check('the Console copy exposes the same surface',
  R && typeof R.reduce === 'function' && typeof R.hydrateCatalogue === 'function'
    && typeof R.effective === 'function' && typeof R.isLow === 'function');
check('byte-identical with the IDMS canonical copy',
  fs.readFileSync(IDMS + '/utils/procurement-reduce.js').equals(
    fs.readFileSync(CON + '/src/renderer/js/procurement-reduce.js')));

// ── the column lists the SQL actually names ──────────────────────────────────
const main = fs.readFileSync(CON + '/src/main/main.js', 'utf8');
function insertCols(table) {
  const re = new RegExp('INSERT(?: OR REPLACE)? INTO ' + table + '\\s*\\(([^)]*)\\)', 'm');
  const m = main.match(re);
  if (!m) return null;
  return m[1].split(',').map(s => s.trim()).filter(Boolean);
}
const cols = {
  procurement_items: insertCols('procurement_items'),
  procurement_movements: insertCols('procurement_movements'),
  procurement_requisitions: insertCols('procurement_requisitions'),
  procurement_pos: insertCols('procurement_pos')
};
console.log('\ncolumn lists parsed from main.js');
Object.keys(cols).forEach(t => check(t + ' INSERT found', !!cols[t]));

// ── run the real derive body ─────────────────────────────────────────────────
// sync-procurement.js is renderer code with Graph and IPC dependencies, so the
// mapping half is exercised directly with the same inputs it would see.
const doc = JSON.parse(fs.readFileSync(CAT, 'utf8'));
const catalogue = R.hydrateCatalogue(doc);

function ev(type, payload, ts) {
  return { _fn: ts.replace(/[:.\-]/g, ''), event_id: 'e' + Math.random(), event_type: type,
           actor: 'wostara', timestamp: ts, payload };
}
const after = '2099-01-01T00:00:00.000Z';
const sample = Object.keys(catalogue.items).find(k => {
  const i = catalogue.items[k];
  return i.in_stock > 5 && i.location_id;
});

const events = [
  ev('item_policy_set', { item_id: sample, min_qty: 99, sfi_code: '360.001' }, after),
  ev('item_change_proposed', { item_id: sample, proposal_id: 'p1',
      fields: { name: 'Something else' }, reason: 'shelf label' }, after),
  ev('stock_movement', { movement_id: 'm1', item_id: sample, kind: 'issue', qty: 2,
      location_id: catalogue.items[sample].location_id }, after),
  ev('item_created', { item_id: 'local-1', name: 'Bought ashore', unit: 'ea' }, after),
  ev('stock_movement', { movement_id: 'm2', item_id: 'local-1', kind: 'receipt', qty: 4,
      location_id: 'LOC-0203' }, after),
  ev('requisition_created', { req_id: 'r1', department: 'Engine Room',
      lines: [{ line_id: 'l1', item_id: sample, qty: 3, unit: 'ea' }] }, after),
  ev('requisition_submitted', { req_id: 'r1' }, after),
  ev('requisition_decided', { req_id: 'r1', decision: 'approved',
      line_decisions: { l1: { decision: 'approved', qty_approved: 3 } } }, after),
  ev('po_created', { po_id: 'p1', po_number: 'PO-9', supplier_id: 'acme',
      lines: [{ line_id: 'pl1', item_id: sample, qty_ordered: 3, unit: 'ea',
                req_id: 'r1', req_line_id: 'l1' }] }, after),
  ev('po_sent', { po_id: 'p1' }, after)
];

const state = R.reduce(events, catalogue);

// This mirrors deriveProcurementFromEvents in sync-procurement.js. If that file
// changes, this has to change with it — which is the point: the test fails loudly
// rather than the app failing quietly at an INSERT.
const items = [], movements = [];
for (const id in state.items) {
  const it = state.items[id];
  const policy = it.policy || {};
  const minEff = R.effective(it, 'min_qty');
  const maxEff = R.effective(it, 'max_qty');
  items.push({
    item_id: it.item_id, source: it.source || 'local', name: it.name || it.item_id,
    unit: it.unit || null, part_number: it.part_number || null,
    sfi_code: R.effective(it, 'sfi_code') || null,
    item_type: it.item_type || null, item_category: it.item_category || null,
    location_id: it.default_location_id || null,
    deck: (catalogue.locations[it.default_location_id]
           && catalogue.locations[it.default_location_id].deck) || null,
    on_hand: Number(it.on_hand) || 0, stock_unknown: it.stock_unknown ? 1 : 0,
    on_order: Number(it.on_order) || 0, on_order_tm: Number(it.on_order_tm) || 0,
    requested: Number(it.requested) || 0,
    min_qty: (minEff === null || minEff === undefined || minEff === '') ? null : Number(minEff),
    max_qty: (maxEff === null || maxEff === undefined || maxEff === '') ? null : Number(maxEff),
    min_source: (policy.min_qty !== undefined && policy.min_qty !== null) ? 'idms'
               : ((it.min_qty === null || it.min_qty === undefined) ? null : 'tm'),
    is_low: R.isLow(it) ? 1 : 0, critical: it.critical ? 1 : 0, blocked: it.blocked ? 1 : 0,
    archived: it.archived ? 1 : 0,
    supplier: (it.suppliers && it.suppliers[0] && it.suppliers[0].supplier_id) || null,
    last_known_price: (it.last_known_price === 0 || it.last_known_price) ? Number(it.last_known_price) : null,
    currency: it.currency || null,
    consumption_json: JSON.stringify(it.consumption || {}),
    by_location_json: JSON.stringify(it.by_location || {}),
    policy_json: JSON.stringify(policy),
    proposals_json: JSON.stringify(it.proposals || []),
    movement_count: (it.movements || []).length,
    superseded_count: Number(it.superseded_movements) || 0,
    last_movement_at: it.last_movement_at || null, last_count_at: it.last_count_at || null
  });
  (it.movements || []).forEach(m => movements.push({
    movement_id: m.movement_id, item_id: it.item_id, kind: m.kind,
    qty: Number(m.qty) || 0, delta: Number(m.delta) || 0,
    location_id: m.location_id || null, to_location_id: m.to_location_id || null,
    counted_qty: (m.counted_qty === 0 || m.counted_qty) ? Number(m.counted_qty) : null,
    book_qty: (m.book_qty === 0 || m.book_qty) ? Number(m.book_qty) : null,
    variance: (m.variance === 0 || m.variance) ? Number(m.variance) : null,
    superseded: m.superseded ? 1 : 0, po_id: m.po_id || null, po_line_id: m.po_line_id || null,
    task_id: m.task_id || null, equipment_code: m.equipment_code || null,
    unit_cost: (m.unit_cost === 0 || m.unit_cost) ? Number(m.unit_cost) : null,
    currency: m.currency || null, reason: m.reason || null, note: m.note || null,
    actor: m.actor || null, timestamp: m.timestamp || null
  }));
}
const requisitions = Object.keys(state.requisitions).map(id => {
  const r = state.requisitions[id];
  return { req_id: r.req_id, status: r.status, department: r.department || null,
    need_by: r.need_by || null, priority: r.priority || null,
    justification: r.justification || null, requested_by: r.requested_by || null,
    created_at: r.created_at || null, submitted_at: r.submitted_at || null,
    decided_at: r.decided_at || null, decided_by: r.decided_by || null,
    decision_comment: r.decision_comment || null,
    line_count: (r.lines || []).length, lines_json: JSON.stringify(r.lines || []) };
});
const pos = Object.keys(state.purchase_orders).map(id => {
  const p = state.purchase_orders[id];
  return { po_id: p.po_id, po_number: p.po_number || null, supplier_id: p.supplier_id || null,
    currency: p.currency || null, expected_date: p.expected_date || null,
    notes: p.notes || null, status: p.status, created_at: p.created_at || null,
    created_by: p.created_by || null, sent_at: p.sent_at || null, sent_by: p.sent_by || null,
    line_count: (p.lines || []).length,
    open_lines: (p.lines || []).filter(l => !l.cancelled && (l.outstanding_qty || 0) > 0).length,
    lines_json: JSON.stringify(p.lines || []) };
});

console.log('\nderived shape');
check('every catalogue item becomes a row', items.length === doc.counts.items + 1,
      `${items.length} rows vs ${doc.counts.items} catalogue + 1 local`);
check('movements derived', movements.length >= 2);
check('requisitions derived', requisitions.length === 1);
check('purchase orders derived', pos.length === 1);

// ── the actual contract: rows satisfy the INSERT ─────────────────────────────
console.log('\nrows satisfy the prepared statements');
function verify(table, rows) {
  const want = cols[table].filter(c => c !== 'ingested_at');   // added by main.js
  const sampleRow = rows[0];
  const missing = want.filter(c => !(c in sampleRow));
  const extra = Object.keys(sampleRow).filter(k => !want.includes(k));
  check(table + ': every named column is supplied', missing.length === 0,
        missing.length ? 'missing: ' + missing.join(', ') : '');
  check(table + ': no column supplied that the INSERT ignores', extra.length === 0,
        extra.length ? 'extra: ' + extra.join(', ') : '');
  // better-sqlite3 refuses undefined outright, and objects/arrays too.
  let badVal = null;
  for (const r of rows) {
    for (const k of Object.keys(r)) {
      const v = r[k];
      if (v === undefined) { badVal = `${k} is undefined`; break; }
      if (v !== null && typeof v === 'object') { badVal = `${k} is an object`; break; }
      if (typeof v === 'boolean') { badVal = `${k} is a boolean (SQLite takes 0/1)`; break; }
      if (typeof v === 'number' && !isFinite(v)) { badVal = `${k} is ${v}`; break; }
    }
    if (badVal) break;
  }
  check(table + ': every value is bindable', badVal === null, badVal || '');
}
Object.keys(cols).forEach(t => verify(t, { procurement_items: items,
  procurement_movements: movements, procurement_requisitions: requisitions,
  procurement_pos: pos }[t]));

console.log('\nthe overlay and proposals survive the round trip');
const row = items.find(i => i.item_id === sample);
check('policy minimum reaches the row', row.min_qty === 99);
check('and is marked as IDMS rather than TM', row.min_source === 'idms');
check('the mirrored name is untouched', row.name === catalogue.items[sample].name);
check('the proposal is carried as JSON', JSON.parse(row.proposals_json).length === 1);
check('the SFI code added here reaches the row', row.sfi_code === '360.001');
check('low stock is computed, not stored raw', row.is_low === 1);
const local = items.find(i => i.item_id === 'local-1');
check('a local item is marked local', local.source === 'local' && local.on_hand === 4);

console.log('\nSQL filters the screen depends on');
check('is_low is an integer column the index can use', typeof row.is_low === 'number');
check('proposals_json is never null (the filter tests != [])',
      items.every(i => typeof i.proposals_json === 'string'));

process.exit(T.done() ? 0 : 1);
