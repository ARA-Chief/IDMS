// Regression: a free-text PO line that is received becomes a real item, and the
// order line must link to it even though the order is already sent.
const { REDUCER, findCatalogue, findConsole, counter, skip } = require('./_paths');
var R = require(REDUCER);
var T = counter(), check = T.check;


var E = [], k = 0;
function p(type, payload) {
  k++;
  E.push({ schema_version: 1, event_id: 'f' + k, event_type: type, actor: 'wostara',
           timestamp: '2026-09-0' + (1 + (k % 9)) + 'T08:00:00.000Z',
           _fn: String(2000 + k), payload: payload });
}

p('po_created', { po_id: 'pf', po_number: 'PO-2', lines: [
  { line_id: 'fl1', description: 'Impeller puller, 3-jaw', qty_ordered: 2, unit: 'ea' } ]});
p('po_sent', { po_id: 'pf' });

// What pcCheckinCommit writes when a free-text line is received:
p('item_created', { item_id: 'i-puller', name: 'Impeller puller, 3-jaw', unit: 'ea' });
p('po_updated', { po_id: 'pf', lines: [
  { line_id: 'fl1', item_id: 'i-puller', description: 'Impeller puller, 3-jaw',
    qty_ordered: 2, unit: 'ea' } ]});
p('stock_movement', { movement_id: 'fm1', item_id: 'i-puller', kind: 'receipt',
                      qty: 1, location_id: 'eng-store', po_id: 'pf', po_line_id: 'fl1' });

var s = R.reduce(E);
console.log('\nfree-text line received against a sent order');
check('the line now points at the created item', s.purchase_orders['pf'].lines[0].item_id, 'i-puller');
check('the receipt landed on the line', s.purchase_orders['pf'].lines[0].received_qty, 1);
check('on_order picks up the remaining 1', s.items['i-puller'].on_order, 1);
check('on_hand is the 1 that arrived', s.items['i-puller'].on_hand, 1);
check('order is partial', s.purchase_orders['pf'].status, 'partial');

console.log('\nquantities on a sent order stay frozen');
p('po_updated', { po_id: 'pf', lines: [
  { line_id: 'fl1', item_id: 'i-puller', qty_ordered: 999, unit: 'ea' } ]});
check('a quantity change on a sent order is ignored',
      R.reduce(E).purchase_orders['pf'].lines[0].qty_ordered, 2);

process.exit(T.done() ? 0 : 1);
