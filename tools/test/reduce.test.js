// Synthetic replay of the §42 stream. Exercises the full loop plus the edges
// that the spec claims are handled: out-of-order arrival, partial and over
// receipt, no-PO receipt, transfer, count variance, negative stock, partial
// approval, and on_order suppressing a low-stock flag.
const { REDUCER, findCatalogue, findConsole, counter, skip } = require('./_paths');
var R = require(REDUCER);
var T = counter(), check = T.check;

var n = 0;
var E = [];
function push(type, payload, ts, actor) {
  n++;
  E.push({
    schema_version: 1,
    event_id: 'e' + n,
    event_type: type,
    actor: actor || 'wostara',
    timestamp: ts || '2026-07-0' + (1 + (n % 9)) + 'T08:00:00.000Z',
    _fn: String(1000 + n),          // filename = replay order
    payload: payload
  });
}


// ── items ───────────────────────────────────────────────────────────────────
push('item_created', { item_id: 'i-seal', name: 'Shaft seal 90mm', unit: 'ea', min_qty: 4, max_qty: 10, part_number: 'SS-90', sfi_code: '360.001' });
push('item_created', { item_id: 'i-oil', name: 'Delo 400 15W-40', unit: 'L', min_qty: 200 });
push('item_created', { item_id: 'i-rag', name: 'Shop rags', unit: 'ea' });

// ── requisition, partially approved ─────────────────────────────────────────
push('requisition_created', { req_id: 'r1', department: 'engine', priority: 'normal', lines: [
  { line_id: 'rl1', item_id: 'i-seal', qty: 6, unit: 'ea' },
  { line_id: 'rl2', item_id: 'i-oil', qty: 400, unit: 'L' },
  { line_id: 'rl3', description: 'Impeller puller, 3-jaw', qty: 1 }
]});
push('requisition_submitted', { req_id: 'r1' });
push('requisition_decided', { req_id: 'r1', decision: 'approved', line_decisions: {
  rl1: { decision: 'approved', qty_approved: 6 },
  rl2: { decision: 'approved', qty_approved: 200 },     // approved less than asked
  rl3: { decision: 'rejected' }
}, comment: 'Puller can wait for the yard.' }, null, 'tploch');

// ── PO covering the approved lines, sent ────────────────────────────────────
push('po_created', { po_id: 'p1', po_number: 'PO-1041', supplier_id: 'acme', currency: 'USD',
  expected_date: '2026-08-01T00:00:00.000Z', lines: [
    { line_id: 'pl1', item_id: 'i-seal', qty_ordered: 6, unit: 'ea', unit_price: 88, req_id: 'r1', req_line_id: 'rl1' },
    { line_id: 'pl2', item_id: 'i-oil', qty_ordered: 200, unit: 'L', unit_price: 4.2, req_id: 'r1', req_line_id: 'rl2' }
  ]}, null, 'tploch');
push('po_sent', { po_id: 'p1', sent_via: 'email' }, null, 'tploch');

// ── receipts: partial on seals, over on oil ─────────────────────────────────
push('stock_movement', { movement_id: 'm1', item_id: 'i-seal', kind: 'receipt', qty: 4, location_id: 'eng-store', po_id: 'p1', po_line_id: 'pl1', unit_cost: 88 });
push('stock_movement', { movement_id: 'm2', item_id: 'i-oil', kind: 'receipt', qty: 210, location_id: 'eng-store', po_id: 'p1', po_line_id: 'pl2' });

// ── a no-PO receipt, then issue, transfer, count ────────────────────────────
push('stock_movement', { movement_id: 'm3', item_id: 'i-rag', kind: 'receipt', qty: 50, location_id: 'eng-store' });
push('stock_movement', { movement_id: 'm4', item_id: 'i-rag', kind: 'transfer', qty: 20, location_id: 'eng-store', to_location_id: 'workshop' });
push('stock_movement', { movement_id: 'm5', item_id: 'i-rag', kind: 'issue', qty: 25, location_id: 'workshop', equipment_code: '360.001' });
push('stock_movement', { movement_id: 'm6', item_id: 'i-rag', kind: 'count', counted_qty: 28, location_id: 'eng-store' });
push('stock_movement', { movement_id: 'm7', item_id: 'i-seal', kind: 'adjustment', qty: 1, direction: 'decrease', location_id: 'eng-store', reason: 'damaged in fitting' });

var st = R.reduce(E);
console.log('\n— derived state —');
var seal = st.items['i-seal'], oil = st.items['i-oil'], rag = st.items['i-rag'];

console.log('\nitems');
check('seal on_hand (4 received − 1 damaged)', seal.on_hand, 3);
check('seal on_order (6 ordered − 4 received)', seal.on_order, 2);
check('seal not low: 3 on hand + 2 on order = 5 >= min 4', R.isLow(seal), false);
check('oil on_hand (over-receipt recorded as received)', oil.on_hand, 210);
check('oil on_order (line complete, owes nothing)', oil.on_order, 0);
check('rag on_hand after transfer/issue/count', rag.on_hand, 28 + (20 - 25));
check('rag by_location eng-store (count set it)', rag.by_location['eng-store'], 28);
check('rag by_location workshop (20 in, 25 out)', rag.by_location['workshop'], -5);

console.log('\ncount variance');
var cnt = rag.movements.filter(function (m) { return m.kind === 'count'; })[0];
check('count book_qty was 30 (50 in − 20 transferred out)', cnt.book_qty, 30);
check('count variance −2', cnt.variance, -2);

console.log('\npurchase order');
var p1 = st.purchase_orders['p1'];
check('po status partial', p1.status, 'partial');
check('seal line partial', p1.lines[0].status, 'partial');
check('seal line outstanding 2', p1.lines[0].outstanding_qty, 2);
check('oil line over', p1.lines[1].status, 'over');
check('oil line outstanding 0', p1.lines[1].outstanding_qty, 0);

console.log('\nrequisition');
var r1 = st.requisitions['r1'];
check('req status ordered (all approved lines covered)', r1.status, 'ordered');
check('rl2 qty_approved 200 vs qty 400', [r1.lines[1].qty_approved, r1.lines[1].qty], [200, 400]);
check('rl3 rejected', r1.lines[2].decision, 'rejected');
check('rl1 ordered_qty 6, received_qty 4', [r1.lines[0].ordered_qty, r1.lines[0].received_qty], [6, 4]);

console.log('\nexceptions');
var ex = R.exceptions(st, { now: '2026-09-05T00:00:00.000Z', stale_days: 14 });
var kinds = ex.map(function (e) { return e.kind; }).sort();
check('negative stock + over receipt + overdue order raised', kinds,
      ['negative_stock', 'over_receipt', 'overdue_order']);
check('negative stock is high severity and first', ex[0].kind, 'negative_stock');

// ── out-of-order arrival: movement before its item_created ──────────────────
console.log('\nout-of-order replay');
var E2 = [
  { event_id: 'x2', event_type: 'stock_movement', actor: 'a', timestamp: '2026-09-05T00:00:01Z', _fn: '0001',
    payload: { movement_id: 'mx', item_id: 'i-late', kind: 'receipt', qty: 7, location_id: 'eng-store' } },
  { event_id: 'x1', event_type: 'item_created', actor: 'a', timestamp: '2026-09-05T00:00:09Z', _fn: '0002',
    payload: { item_id: 'i-late', name: 'Late item', unit: 'ea' } }
];
var st2 = R.reduce(E2);
check('movement sorted ahead of its create still lands', st2.items['i-late'].on_hand, 7);
check('and the item kept its name', st2.items['i-late'].name, 'Late item');

// ── low stock only when nothing is on order ─────────────────────────────────
console.log('\nlow-stock rule');
var E3 = [
  { event_id: 'y1', event_type: 'item_created', actor: 'a', timestamp: '2026-09-01T00:00:00Z', _fn: '01',
    payload: { item_id: 'i-z', name: 'Z', unit: 'ea', min_qty: 10 } }
];
var lowState = R.reduce(E3);
check('0 on hand, min 10 → low', R.isLow(lowState.items['i-z']), true);
check('suggested qty falls back to the shortfall', R.suggestedOrderQty(lowState.items['i-z']), 10);

// ── decimal hygiene ─────────────────────────────────────────────────────────
console.log('\ndecimals');
var E4 = [
  { event_id: 'd0', event_type: 'item_created', actor: 'a', timestamp: '2026-09-01T00:00:00Z', _fn: '01',
    payload: { item_id: 'i-d', name: 'D', unit: 'L' } },
  { event_id: 'd1', event_type: 'stock_movement', actor: 'a', timestamp: '2026-09-01T00:00:01Z', _fn: '02',
    payload: { movement_id: 'd1', item_id: 'i-d', kind: 'receipt', qty: 0.1, location_id: 'x' } },
  { event_id: 'd2', event_type: 'stock_movement', actor: 'a', timestamp: '2026-09-01T00:00:02Z', _fn: '03',
    payload: { movement_id: 'd2', item_id: 'i-d', kind: 'receipt', qty: 0.2, location_id: 'x' } }
];
check('0.1 + 0.2 === 0.3', R.reduce(E4).items['i-d'].on_hand, 0.3);

// ── negative/garbage qty cannot invert a movement ───────────────────────────
var E5 = [
  { event_id: 'g0', event_type: 'item_created', actor: 'a', timestamp: '2026-09-01T00:00:00Z', _fn: '01',
    payload: { item_id: 'i-g', name: 'G', unit: 'ea' } },
  { event_id: 'g1', event_type: 'stock_movement', actor: 'a', timestamp: '2026-09-01T00:00:01Z', _fn: '02',
    payload: { movement_id: 'g1', item_id: 'i-g', kind: 'receipt', qty: -5, location_id: 'x' } }
];
check('a negative receipt qty is a magnitude, not an issue', R.reduce(E5).items['i-g'].on_hand, 5);

process.exit(T.done() ? 0 : 1);
