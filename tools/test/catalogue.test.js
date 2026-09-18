// The catalogue path (§42.14): TM Master baseline + the vessel's own movements.
// Runs against the REAL catalogue built from the vault, not a synthetic one.
var fs = require('fs');
const { REDUCER, findCatalogue, findConsole, counter, skip } = require('./_paths');
var R = require(REDUCER);
var T = counter(), check = T.check;

var CAT = findCatalogue();
if (!CAT) {
  skip('no catalogue.json found. Build one with ' +
       'tools/build-procurement-catalogue.py, or pass --catalogue <path>.');
}


var t0 = Date.now();
var doc = JSON.parse(fs.readFileSync(CAT, 'utf8'));
var cat = R.hydrateCatalogue(doc);
var tHydrate = Date.now() - t0;

console.log('\nhydrate');
check('items hydrated', Object.keys(cat.items).length, doc.counts.items);
check('locations hydrated', Object.keys(cat.locations).length, doc.counts.locations);
console.log('  ..   hydrate took ' + tHydrate + ' ms');

// The maker and the maker's own type number are NOT in catalogue.json. They sit
// in catalogue-detail.json, a separate 2 MB file, and hydrate reads it when it
// is handed one — which is what the Console does for the four narrowing boxes on
// an order line (its docs/procurement-registry.md §14.5a). This is the case the
// column-presence check in console-derive.test.js cannot make: that check passes
// on four nulls, and four nulls is exactly what the drift looked like.
console.log('\nthe maker, which lives in the detail file');
var DETAIL = require('path').join(require('path').dirname(CAT), 'catalogue-detail.json');
if (!fs.existsSync(DETAIL)) {
  T.note('no catalogue-detail.json beside the catalogue — the maker is not checked');
} else {
  var detail = JSON.parse(fs.readFileSync(DETAIL, 'utf8'));
  var withDetail = R.hydrateCatalogue(doc, detail);
  var makers = Object.keys(withDetail.items)
    .filter(function (k) { return withDetail.items[k].maker; });
  check('hydrating without it leaves the maker null, rather than refusing the catalogue',
        Object.keys(cat.items).every(function (k) { return cat.items[k].maker === null; }), true);
  check('hydrating with it puts makers on the items', makers.length > 0, true);
  // The detail file is keyed by the BARE integer id, not by ITM-#####, so the
  // lookup has to happen while the raw row is still in hand. Get that wrong and
  // every maker is null — which reads as "TM never recorded one" and is silent.
  var one = withDetail.items[makers[0]];
  var bare = String(one.item_id).replace(/^ITM-0*/, '');
  check('and it is the maker the detail file holds for that id',
        one.maker, (detail.items[bare] || detail.items[Number(bare)] || {}).maker);
  T.note(makers.length + ' of ' + Object.keys(withDetail.items).length +
         ' items carry a maker; the rest are items TM never recorded one for');
}

console.log('\ndictionary decoding');
var withType = Object.keys(cat.items).filter(function (k) { return cat.items[k].item_type; });
check('item_type decoded to a string, not an index',
      typeof cat.items[withType[0]].item_type, 'string');
var uoms = {};
Object.keys(cat.items).forEach(function (k) { if (cat.items[k].unit) uoms[cat.items[k].unit] = 1; });
// 138 distinct units of measure, and 'Each' / 'EA' / 'PCE' / 'pcs' are all in
// there meaning the same thing. That is TM Master's vocabulary and this module
// displays it as written rather than quietly normalising somebody else's data.
check('units decode to text, not indices',
      Object.keys(uoms).every(function (u) { return typeof u === 'string' && u.length > 0; }), true);
console.log('  ..   ' + Object.keys(uoms).length + ' distinct units of measure in the export');

console.log('\nlocation tree');
var locs = cat.locations;
var roots = Object.keys(locs).filter(function (k) { return !locs[k].parent_id; });
check('every non-root parent resolves',
      Object.keys(locs).filter(function (k) {
        return locs[k].parent_id && !locs[locs[k].parent_id];
      }).length, 0);
console.log('  ..   ' + roots.length + ' decks/areas at top level');

console.log('\nbaseline replay (no events)');
var t1 = Date.now();
var st = R.reduce([], cat);
var tReduce = Date.now() - t1;
check('every catalogue item is in the register', Object.keys(st.items).length, doc.counts.items);
console.log('  ..   reduce of ' + doc.counts.items + ' items took ' + tReduce + ' ms');

var unknown = Object.keys(st.items).filter(function (k) { return st.items[k].stock_unknown; });
check('blank stock is unknown, not zero', unknown.length, doc.counts.blank_stock);
check('an unknown-stock item never reads as low',
      unknown.some(function (k) { return R.isLow(st.items[k]); }), false);

var neg = Object.keys(st.items).filter(function (k) { return st.items[k].on_hand < 0; });
check('negative stock carried through from TM Master', neg.length, doc.counts.negative_stock);

var onOrder = Object.keys(st.items).filter(function (k) { return st.items[k].on_order > 0; });
check("TM Master's outstanding orders seed on_order", onOrder.length, doc.counts.on_order);

var low = Object.keys(st.items).filter(function (k) { return R.isLow(st.items[k]); });
console.log('  ..   ' + low.length + ' items below minimum at baseline');

console.log('\nmovements layer on top of the baseline');
var sample = Object.keys(st.items).filter(function (k) {
  var i = st.items[k];
  return !i.stock_unknown && i.on_hand > 5 && i.default_location_id;
})[0];
var base = st.items[sample];
console.log('  ..   using ' + sample + ' — ' + base.name + ' (' + base.on_hand + ' ' + base.unit + ')');

function ev(type, payload, ts) {
  return { schema_version: 1, event_id: 'x' + Math.random(), event_type: type,
           actor: 'wostara', timestamp: ts, _fn: ts.replace(/[:.\-]/g, ''), payload: payload };
}
var after = '2099-01-01T00:00:00.000Z';
var before = '2000-01-01T00:00:00.000Z';

var st2 = R.reduce([
  ev('stock_movement', { movement_id: 'a1', item_id: sample, kind: 'issue',
                         qty: 2, location_id: base.default_location_id }, after)
], cat);
check('an issue after the baseline reduces on hand',
      st2.items[sample].on_hand, Math.round((base.on_hand - 2) * 1e6) / 1e6);

var st3 = R.reduce([
  ev('stock_movement', { movement_id: 'b1', item_id: sample, kind: 'issue',
                         qty: 2, location_id: base.default_location_id }, before)
], cat);
check('a movement at or before the baseline moves nothing', st3.items[sample].on_hand, base.on_hand);
check('but it is still visible in the ledger, marked',
      [st3.items[sample].movements.length, st3.items[sample].movements[0].superseded], [1, true]);
check('and counted', st3.items[sample].superseded_movements, 1);

console.log('\nIDMS policy overlay');
var noMin = Object.keys(st.items).filter(function (k) {
  var i = st.items[k];
  return !i.stock_unknown && !i.min_qty && i.on_hand === 0;
})[0];
var st4 = R.reduce([
  ev('item_policy_set', { item_id: noMin, min_qty: 5, sfi_code: '360.001' }, after)
], cat);
check('a minimum set in IDMS applies', R.effective(st4.items[noMin], 'min_qty'), 5);
check('and makes the item read as low', R.isLow(st4.items[noMin]), true);
check('TM Master itself is untouched', st4.items[noMin].min_qty, st.items[noMin].min_qty);
check('an SFI code can be added over the mirror', R.effective(st4.items[noMin], 'sfi_code'), '360.001');

var st5 = R.reduce([
  ev('item_policy_set', { item_id: noMin, min_qty: 5 }, after),
  ev('item_policy_set', { item_id: noMin, min_qty: null }, after)
], cat);
check('clearing the policy falls back to TM Master',
      R.effective(st5.items[noMin], 'min_qty'), st.items[noMin].min_qty);

console.log('\nproposals are recorded, never applied');
var st6 = R.reduce([
  ev('item_change_proposed', { item_id: sample, fields: { name: 'Something else' },
                               reason: 'Label on the shelf says otherwise' }, after)
], cat);
check('the mirrored name is unchanged', st6.items[sample].name, base.name);
check('the proposal is carried on the item', st6.items[sample].proposals.length, 1);
check('with who asked and why',
      [st6.items[sample].proposals[0].actor, st6.items[sample].proposals[0].reason],
      ['wostara', 'Label on the shelf says otherwise']);

var st7 = R.reduce([
  ev('item_created', { item_id: sample, name: 'Hijacked', unit: 'ea' }, after)
], cat);
check('a stale local create cannot rewrite a mirrored item', st7.items[sample].name, base.name);

console.log('\nlocal items still work alongside the mirror');
var st8 = R.reduce([
  ev('item_created', { item_id: 'local-1', name: 'Something bought ashore', unit: 'ea', min_qty: 2 }, after),
  ev('stock_movement', { movement_id: 'c1', item_id: 'local-1', kind: 'receipt',
                         qty: 3, location_id: 'LOC-0203' }, after)
], cat);
check('a local item is created', st8.items['local-1'].source, 'local');
check('and its stock is recorded', st8.items['local-1'].on_hand, 3);
check('the mirror is unaffected', Object.keys(st8.items).length, doc.counts.items + 1);

console.log('\nexceptions across the whole register');
var t2 = Date.now();
var ex = R.exceptions(st, { now: '2026-09-05T00:00:00.000Z', stale_days: 14,
                            locName: function (id) { return (cat.locations[id] || {}).path || id; } });
console.log('  ..   ' + ex.length + ' exceptions in ' + (Date.now() - t2) + ' ms');
var kinds = {};
ex.forEach(function (e) { kinds[e.kind] = (kinds[e.kind] || 0) + 1; });
console.log('  ..   ' + JSON.stringify(kinds));
check('negative stock is raised for every TM negative', kinds.negative_stock, doc.counts.negative_stock);
check('the most severe sorts first', ex[0].severity, 'high');

process.exit(T.done() ? 0 : 1);
