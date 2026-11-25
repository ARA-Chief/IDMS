'use strict';

// Receive against TM Master's open order lines (§42.9a) — utils/receive-lines.js,
// and the reducer's contract that a receipt carrying tm_* fields is an ordinary
// receipt (the fields pass through; nothing in procurement-reduce.js reads them).
//
// Synthetic first, so it proves what it proves on any machine; then the real
// published open-order-lines.json if it is beside the catalogue.

const fs = require('fs');
const path = require('path');
const { REPO, REDUCER, findCatalogue, counter } = require('./_paths');
const RL = require(path.join(REPO, 'utils', 'receive-lines.js'));
const R = require(REDUCER);
const T = counter(), check = T.check;

// ── fixtures ────────────────────────────────────────────────────────────────
function line(no, name, extra) {
  return Object.assign({ line_no: no, item_name: name, on_order: 10, received: 0, outstanding: 10,
    uom: 'PCE', makers_part_no: '', suppliers_ref: '', unit_price: 1, component: '', description: '',
    item_id: null, match: 'none' }, extra || {});
}
const DOC = {
  schema_version: 1, pulled_at: '2026-11-25T16:08:11.494Z',
  orders: [
    { order_no: 'ARA-2-M-2026', supplier: 'Newer Co', order_type: 'PurchaseOrder', approved: '10/12/2026', status: 'On Order',
      lines: [
        line(1, 'Filter, oil', { item_id: 'ITM-1', match: 'name', outstanding: 4, on_order: 4, makers_part_no: 'P-55' }),
        line(2, 'Freight - Pre Pay and Add', { component: 'Freight/Shipping Transportation' }),
        line(3, 'Tax', { item_id: 'ITM-TAX', match: 'name' })
      ] },
    { order_no: 'ARA-1-M-2026', supplier: 'Older Co', order_type: 'PurchaseOrder', approved: '9/2/2026', status: 'Partly received',
      lines: [
        line(7, 'Filter, oil', { item_id: 'ITM-1', match: 'name', on_order: 6, received: 3, outstanding: 3, suppliers_ref: 'SR-9' }),
        line(8, 'SCREW.. Slotted 10-24', { match: 'ambiguous', candidates: ['ITM-7', 'ITM-8'], outstanding: 20 }),
        line(9, 'Wire Rope, IWRC, 3/4"x90\'', { outstanding: 1, on_order: 1 }),
        line(10, 'Done line', { item_id: 'ITM-2', match: 'name', outstanding: 0, received: 10 }),
        line(11, '497-250049-INV - 1/28/26', { outstanding: 1 })
      ] },
    { order_no: 'ARA-9-S-2026', supplier: 'Svc', order_type: 'ServiceOrder', approved: '8/1/2026',
      lines: [ line(1, 'Filter, oil', { item_id: 'ITM-1', match: 'name' }) ] }
  ]
};

function rcpt(order, lineNo, qty, extra) {
  return Object.assign({ event_id: 'e' + Math.random(), event_type: 'stock_movement', actor: 'wd',
    timestamp: '2026-11-25T10:00:00Z',
    payload: { movement_id: 'm' + Math.random(), item_id: 'ITM-1', kind: 'receipt', qty: qty,
               location_id: 'L1', tm_order_no: order, tm_order_line_no: lineNo, tm_item_name: 'Filter, oil' } },
    extra || {});
}

// ── non-goods ───────────────────────────────────────────────────────────────
T.head('what is not a thing to put on a shelf');
check('Tax is not goods (even though it is a catalogue item)', RL.isNonGoods({ item_name: 'Tax' }), true);
check('Freight - Pre Pay and Add', RL.isNonGoods({ item_name: 'Freight - Pre Pay and Add' }), true);
check('Import duty, any case', RL.isNonGoods({ item_name: 'import duty' }), true);
check('Surcharge', RL.isNonGoods({ item_name: 'Surcharge' }), true);
check('an invoice pasted in as a line', RL.isNonGoods({ item_name: '497-250049-INV - 1/28/26' }), true);
check('a freight component', RL.isNonGoods({ item_name: 'Trucking to Pier 90', component: 'Freight/Shipping Transportation' }), true);
check('a wire rope is goods', RL.isNonGoods({ item_name: 'Wire Rope, IWRC, 3/4"x90\'', component: 'Wire Ropes (WR) & Accessories' }), false);
check('"Taxi seat" is not Tax', RL.isNonGoods({ item_name: 'Taxi seat' }), false);

T.head('dates');
check('US month/day', RL.approvedIso('9/2/2026'), '2026-09-02');
check('two-digit both', RL.approvedIso('10/12/2026'), '2026-10-12');
check('nothing', RL.approvedIso(''), '');

// ── build ───────────────────────────────────────────────────────────────────
T.head('build');
let b = RL.build(DOC, []);
check('service orders, done lines, tax, freight and invoices are left out',
  b.lines.map(l => l.key).sort(), ['ARA-1-M-2026#7', 'ARA-1-M-2026#8', 'ARA-1-M-2026#9', 'ARA-2-M-2026#1']);
const filt = b.byGroup['item:ITM-1'];
check('one group per item, across orders', filt.lines.length, 2);
check('oldest order first (by approved, not by order no text)', filt.lines.map(l => l.order_no), ['ARA-1-M-2026', 'ARA-2-M-2026']);
check('group still to come', filt.to_come, 7);
check('ambiguous lines are their own group, with candidates', b.byGroup['ambiguous:screw.. slotted 10-24'].candidates, ['ITM-7', 'ITM-8']);
check('no-item lines group by name', !!b.byGroup['none:wire rope, iwrc, 3/4"x90\''], true);

T.head('still to come = outstanding − IDMS receipts against that TM line');
const evs = [
  rcpt('ARA-1-M-2026', 7, 2),
  rcpt('ARA-1-M-2026', 7, 5, { _pending: true }),          // over-receipt, still in the outbox
  rcpt('ARA-2-M-2026', 1, 1),
  { event_id: 'x', event_type: 'tm_order_line_received', actor: 'wd', timestamp: '2026-11-25T11:00:00Z',
    payload: { tm_order_no: 'ARA-1-M-2026', tm_order_line_no: 9, qty: 1, tm_item_name: 'Wire Rope' } },
  // these must not count:
  { event_id: 'y', event_type: 'stock_movement', payload: { item_id: 'ITM-1', kind: 'receipt', qty: 50, location_id: 'L1' } },
  { event_id: 'z', event_type: 'stock_movement', payload: { item_id: 'ITM-1', kind: 'issue', qty: 1, location_id: 'L1',
    tm_order_no: 'ARA-2-M-2026', tm_order_line_no: 1 } }
];
b = RL.build(DOC, evs);
check('line 7: 3 outstanding − 7 received = 0, never negative', b.byKey['ARA-1-M-2026#7'].to_come, 0);
check('line 7 records 7 in, 5 of them pending', [b.byKey['ARA-1-M-2026#7'].recorded, b.byKey['ARA-1-M-2026#7'].pending], [7, 5]);
check('pending receipt rows are marked', b.byKey['ARA-1-M-2026#7'].receipts.map(r => r.pending), [false, true]);
check('order 2 line 1: 4 − 1 = 3 (an issue with tm fields does not count)', b.byKey['ARA-2-M-2026#1'].to_come, 3);
check('a no-stock line receipt counts too', b.byKey['ARA-1-M-2026#9'].to_come, 0);
check('a receipt with no tm fields counts against no line', b.byKey['ARA-2-M-2026#1'].recorded, 1);
check('line keyed by order no + line no as numbers or strings alike',
  RL.recorded([rcpt('ARA-1-M-2026', '7', 1)])['ARA-1-M-2026#7'].qty, 1);

// ── search ──────────────────────────────────────────────────────────────────
T.head('search');
b = RL.build(DOC, []);
const names = q => RL.search(b, q).map(g => g.key);
check('by name', names('filter'), ['item:ITM-1']);
check('by maker\'s part no', names('p-55'), ['item:ITM-1']);
check('by supplier\'s ref', names('sr-9'), ['item:ITM-1']);
check('by order no', names('ARA-2-M').length, 1);
check('words ANDed', names('filter screw'), []);
check('the page can add the register\'s own name', RL.search(b, 'cartridge',
  { extraHay: g => g.item_id === 'ITM-1' ? 'Oil filter cartridge' : '' }).map(g => g.key), ['item:ITM-1']);
check('blank finds nothing', names('  '), []);

// ── allocate / move ─────────────────────────────────────────────────────────
T.head('one quantity, oldest line first');
const L = [{ to_come: 3 }, { to_come: 4 }, { to_come: 2 }];
check('fills the oldest first', RL.allocate(L, 5), { alloc: [3, 2, 0], over: 0 });
check('exactly everything', RL.allocate(L, 9), { alloc: [3, 4, 2], over: 0 });
check('more than everything: the rest on the newest line, called out', RL.allocate(L, 12), { alloc: [3, 4, 5], over: 3 });
check('overBy agrees', RL.overBy(L, [3, 4, 5]), 3);
check('nothing', RL.allocate(L, 0), { alloc: [0, 0, 0], over: 0 });
check('a fully received line is skipped', RL.allocate([{ to_come: 0 }, { to_come: 2 }], 2), { alloc: [0, 2], over: 0 });
check('decimals stay clean', RL.allocate([{ to_come: 0.1 }, { to_come: 0.2 }], 0.3).alloc, [0.1, 0.2]);

T.head('a tap moves one unit, total unchanged');
let a = RL.moveOne(L, [3, 2, 0], 2, +1);
check('+ on line 3 takes from the newest other line holding some', a, [3, 1, 1]);
a = RL.moveOne(L, [3, 2, 0], 0, -1);
check('− on line 1 gives to the oldest line with room', a, [2, 3, 0]);
a = RL.moveOne(L, [3, 4, 2], 0, -1);
check('− with every line full gives to the newest other line', a, [2, 4, 3]);
check('total is kept', a.reduce((x, y) => x + y, 0), 9);
check('nothing to take from: unchanged (the page then changes the total)', RL.moveOne(L, [0, 0, 0], 1, +1), [0, 0, 0]);
check('one line: unchanged', RL.moveOne([{ to_come: 3 }], [2], 0, +1), [2]);

// ── the reducer's contract ──────────────────────────────────────────────────
T.head('procurement-reduce.js passes the tm_* fields through untouched');
const base = [
  { event_id: 'c1', event_type: 'item_created', actor: 'wd', timestamp: '2026-11-25T09:00:00Z',
    payload: { item_id: 'ITM-1', name: 'Filter, oil', unit: 'ea', default_location_id: 'L1' } }
];
const plain = R.reduce(base.concat([
  { event_id: 'r1', event_type: 'stock_movement', actor: 'wd', timestamp: '2026-11-25T10:00:00Z',
    payload: { movement_id: 'm1', item_id: 'ITM-1', kind: 'receipt', qty: 3, location_id: 'L1' } }
]), null);
const withTm = R.reduce(base.concat([
  { event_id: 'r1', event_type: 'stock_movement', actor: 'wd', timestamp: '2026-11-25T10:00:00Z',
    payload: { movement_id: 'm1', item_id: 'ITM-1', kind: 'receipt', qty: 3, location_id: 'L1',
               tm_order_no: 'ARA-1-M-2026', tm_order_line_no: 7, tm_item_name: 'Filter, oil' } },
  { event_id: 'n1', event_type: 'tm_order_line_received', actor: 'wd', timestamp: '2026-11-25T10:01:00Z',
    payload: { tm_order_no: 'ARA-1-M-2026', tm_order_line_no: 9, qty: 1 } }
]), null);
check('a receipt with tm fields puts the same stock on the same shelf', withTm.items['ITM-1'].by_location, plain.items['ITM-1'].by_location);
check('on hand the same', withTm.items['ITM-1'].on_hand, 3);
check('same movement row', withTm.items['ITM-1'].movements, plain.items['ITM-1'].movements);
check('tm_order_line_received is ignored by the reducer: no orders, no new items',
  [Object.keys(withTm.purchase_orders).length, Object.keys(withTm.items)], [0, ['ITM-1']]);
check('the same exceptions either way',
  R.exceptions(withTm, {}).map(x => x.kind), R.exceptions(plain, {}).map(x => x.kind));

// ── the real file ───────────────────────────────────────────────────────────
const CAT = findCatalogue();
const OL = CAT && path.join(path.dirname(CAT), 'open-order-lines.json');
if (!OL || !fs.existsSync(OL)) {
  T.note('no open-order-lines.json beside the catalogue — the real-file checks are skipped');
} else {
  T.head('the published open-order-lines.json');
  const doc = JSON.parse(fs.readFileSync(OL, 'utf8'));
  const t0 = Date.now();
  const real = RL.build(doc, []);
  T.note(real.lines.length + ' receivable lines in ' + real.groups.length + ' groups, built in ' + (Date.now() - t0) + ' ms');
  const svc = {};
  doc.orders.forEach(o => { if (o.order_type === 'ServiceOrder') svc[o.order_no] = true; });
  check('no service-order line is offered', real.lines.filter(l => svc[l.order_no]).length, 0);
  check('no Tax / freight line is offered', real.lines.filter(l => /^(tax|freight)/i.test(l.item_name)).length, 0);
  check('every line still has something to come', real.lines.every(l => l.outstanding > 0), true);
  check('every ambiguous line carries candidates to choose from',
    real.lines.filter(l => l.match === 'ambiguous').every(l => l.candidates.length > 1), true);
  check('each group\'s lines are oldest-approved first', real.groups.every(g => g.lines.every((l, i, xs) =>
    !i || (xs[i - 1].approved_iso || '9999') <= (l.approved_iso || '9999'))), true);
  check('keys are unique', Object.keys(real.byKey).length, real.lines.length);
}

// ── once TM has it, it is not taken off twice ───────────────────────────────
// A phone receipt records what TM showed. When a later snapshot shows TM's
// received risen by it, the snapshot's outstanding already counts it.
{
  const snap = (pulledAt, received) => ({ schema_version: 1, pulled_at: pulledAt, orders: [
    { order_no: 'ARA-7', supplier: 'S', order_type: 'PurchaseOrder', approved: '10/1/2026', status: 'On Order',
      lines: [line(1, 'Gasket', { item_id: 'ITM-7', match: 'name', on_order: 10, received, outstanding: 10 - received })] }] });
  const rcv = { event_id: 'r1', event_type: 'stock_movement', timestamp: '2026-11-25T18:00:00Z', actor: 'wm',
    payload: { kind: 'receipt', item_id: 'ITM-7', qty: 4, tm_order_no: 'ARA-7', tm_order_line_no: 1, tm_received_seen: 0 } };
  const before = RL.build(snap('2026-11-25T16:00:00Z', 0), [rcv]).byKey['ARA-7#1'];
  check('before TM has it: 10 - 4 still to come', before.to_come, 6);
  check('and it is owed to TM', before.owed_to_tm, 4);
  const tmHasIt = RL.build(snap('2026-11-26T08:00:00Z', 4), [rcv]).byKey['ARA-7#1'];
  check('after TM received it and the lines were pulled again: still 6, not 2', tmHasIt.to_come, 6);
  check('and nothing is owed to TM', tmHasIt.owed_to_tm, 0);
  check('the receipt reads as in TM', tmHasIt.receipts[0].state, 'in_tm');
  const direct = RL.build(snap('2026-11-26T08:00:00Z', 9), [rcv]).byKey['ARA-7#1'];
  check('someone received 5 more in TM directly: 1 still to come', direct.to_come, 1);
}

process.exit(T.done() ? 0 : 1);
