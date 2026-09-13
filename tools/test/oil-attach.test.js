'use strict';

// The three-way oil filter (utils/oil-attach.js) and the multi-SFI policy it
// reads (utils/procurement-reduce.js).
//
// The fixtures are the Araho's own: the lube and waste tanks as vesselconfig
// has them, the item numbers as TM Master has them, the asset codes as
// assets.csv has them, and the history rows as lube_log has them — including
// the 15W40 tank once logged into the Main Engine, which must never become a
// suggestion.
//
// Run: node tools/test/oil-attach.test.js  (or the whole suite, tools/test/run.js)

const assert = require('assert');
const path = require('path');
const R = require(path.join(__dirname, '..', '..', 'utils', 'procurement-reduce.js'));
const A = require(path.join(__dirname, '..', '..', 'utils', 'oil-attach.js'));

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); console.log('  ✓ ' + name); passed++; }
  catch (e) { console.log('  ✗ ' + name + '\n      ' + (e && e.message)); failed++; }
}

// ── Fixtures ────────────────────────────────────────────────────────────────

const TK22 = 'a1b2c3d4-0018-4000-8000-000000000018';   // ME L.O.
const TK24 = 'a1b2c3d4-0019-4000-8000-000000000019';   // Aux L.O.
const TK29 = 'a1b2c3d4-0024-4000-8000-000000000024';   // BT/Winch gear
const TK17 = 'a1b2c3d4-0028-4000-8000-000000000028';   // Dirty oil (waste)
const TK01 = 'a1b2c3d4-0001-4000-8000-000000000001';   // fuel, must never appear

const tanks = [
  { tank_id: TK22, category: 'lube_oil', name: 'Main Engine Lube Oil Tank 22', contents: 'Mobilgard 410 NC', asset_code: '233.075.01' },
  { tank_id: TK24, category: 'lube_oil', name: 'Aux Generator Lube Oil Tank 24', contents: 'Mobil Delvac MX 15w40', asset_code: '233.075.02' },
  { tank_id: TK29, category: 'lube_oil', name: 'BT/Winch Gearbox Oil Tank 29', contents: 'Mobilgear 600 XP 68' },
  { tank_id: TK17, category: 'waste_oil', name: 'Dirty Oil Tank 17', contents: 'Used Oil', asset_code: '233.199.05' },
  { tank_id: TK01, category: 'fuel', name: 'F.O. Tank 1' }
];

const points = [
  { code: '601.001', item_id: 'r-me', label: 'Main Engine', kind: 'add_oil' },
  { code: '651.001', item_id: 'r-dg1', label: 'Diesel Generator No.1', kind: 'add_oil' },
  { code: '651.002', item_id: 'r-dg2', label: 'Diesel Generator No.2', kind: 'add_oil' },
  { code: null, item_id: 'r-headtank', label: 'Winch head tank', kind: 'inspection_tank' }
];

const names = {
  '601.001': 'Main Engine', '601.001.075': 'Main Engine LO System Attached',
  '651.001': 'Diesel Generator No.1', '651.002': 'Diesel Generator No.2',
  '651.001.42': 'Lube Oil System/Attached, Diesel Generator No.1',
  '651.002.42': 'Lube Oil System/Attached, Diesel Generator No.2'
};

function ev(type, payload, ts) {
  return { event_id: 'e' + Math.random().toString(36).slice(2), event_type: type,
           actor: 'wostara', timestamp: ts || '2026-09-12T00:00:00.000Z', payload };
}

const catalogue = {
  baseline_at: '2026-09-01T00:00:00.000Z',
  items: {
    'ITM-10917': { item_id: 'ITM-10917', name: 'Oil, Lubricating, Mobilgard 410 NC, Bulk', unit: 'Gallon', location_id: 'LOC-0001', in_stock: 13258 },
    'ITM-10928': { item_id: 'ITM-10928', name: 'Oil, Lubricating, Mobil Delvac MX 15w40, Bulk', unit: 'Gallon', location_id: 'LOC-0001', in_stock: 0 },
    'ITM-10921': { item_id: 'ITM-10921', name: 'Oil, Gear, Mobilgear 600 XP 68, Drums', unit: 'Gallon', location_id: 'LOC-0001', in_stock: 2013 },
    'ITM-05478': { item_id: 'ITM-05478', name: 'Filter, Lube Oil, Main Engine, P1510', unit: 'Each', location_id: 'LOC-0134', in_stock: 425 },
    'ITM-06437': { item_id: 'ITM-06437', name: 'Lube Oil, DELO 400, 15W-40', unit: 'Gallon', location_id: 'LOC-0200', in_stock: 947 }
  },
  locations: { 'LOC-0001': { location_id: 'LOC-0001', path: 'Below Main Deck' } },
  counts: {}
};

const events = [
  // Mobilgard: the system where its reports are, and the tank where it is kept.
  ev('item_policy_set', { item_id: 'ITM-10917', sfi_code: '601.001.075', sfi_codes: ['601.001.075', '233.075.01'] }),
  // Delvac: both generators and tank 24.
  ev('item_policy_set', { item_id: 'ITM-10928', sfi_codes: ['651.001.42', '651.002.42', '233.075.02'] }),
  // Gear oil in drums: no tank asset code, linked by tank_id instead.
  ev('item_policy_set', { item_id: 'ITM-10921', tank_id: TK29 }),
  // The ME filter is linked to the ME and is not a fluid.
  ev('item_policy_set', { item_id: 'ITM-05478', sfi_code: '601.001' }),
  // Pails of DELO with no tank anywhere: a fluid by flag.
  ev('item_policy_set', { item_id: 'ITM-06437', fluid: true, sfi_codes: ['651.001', '651.002'] })
];

const logs = [
  // Four ME top-ups out of tank 22, legacy rows with no item_id.
  { timestamp: '2026-07-22T20:47:21Z', from_tank_id: TK22, to_tank_id: null, quantity: -30, to_type: 'add_oil', equipment_code: '601.001' },
  { timestamp: '2026-09-04T06:18:17Z', from_tank_id: TK22, to_tank_id: null, quantity: 25, to_type: 'equipment', equipment_code: '601.001' },
  { timestamp: '2026-09-07T17:11:50Z', from_tank_id: TK22, to_tank_id: null, quantity: -30, to_type: 'add_oil', equipment_code: '601.001' },
  { timestamp: '2026-09-04T06:18:13Z', from_tank_id: TK22, to_tank_id: TK17, quantity: 5, to_type: 'tank' },
  // The mistake: 376 USG of 15W40 out of tank 24 "into the Main Engine".
  { timestamp: '2026-07-29T22:34:52Z', from_tank_id: TK24, to_tank_id: null, quantity: -376, to_type: 'add_oil', equipment_code: '601.001' },
  // And the real Delvac history, twice to DG2.
  { timestamp: '2026-08-11T16:50:54Z', from_tank_id: TK24, quantity: -2.3, to_type: 'add_oil', equipment_code: '651.002' },
  { timestamp: '2026-08-12T16:50:54Z', item_id: 'ITM-10928', from_tank_id: TK24, quantity: 3, to_type: 'equipment', equipment_code: '651.002' },
  // A level fix is not a movement.
  { timestamp: '2026-08-20T00:00:00Z', from_tank_id: TK22, quantity: -900, to_type: 'correction' }
];

// Already decoded: reduce() takes the hydrated shape, which is what this is.
const state = R.reduce(events, catalogue);

function model() {
  return A.build({
    tanks, points, logs, items: state.items,
    assetName: c => names[c] || null,
    locName: id => (catalogue.locations[id] && catalogue.locations[id].path) || id
  });
}
const keys = list => list.map(n => n.key || n.item_id);

// ── Reducer: many SFI codes ─────────────────────────────────────────────────

console.log('\nAn item carries more than one SFI code');

test('sfiCodes lists the single code first, then the rest, without repeats', () => {
  assert.deepStrictEqual(R.sfiCodes(state.items['ITM-10917']), ['601.001.075', '233.075.01']);
});

test('a list with no single code still reads', () => {
  assert.deepStrictEqual(R.sfiCodes(state.items['ITM-10928']), ['651.001.42', '651.002.42', '233.075.02']);
});

test('blank and duplicate entries are dropped on the way in', () => {
  const s = R.reduce([ev('item_policy_set', { item_id: 'ITM-10917', sfi_codes: [' 601.001 ', '', null, '601.001'] })], catalogue);
  assert.deepStrictEqual(s.items['ITM-10917'].policy.sfi_codes, ['601.001']);
});

test('an empty list clears the links, the same as null', () => {
  const s = R.reduce(events.concat([ev('item_policy_set', { item_id: 'ITM-10928', sfi_codes: [] }, '2026-09-12T01:00:00.000Z')]), catalogue);
  assert.strictEqual(s.items['ITM-10928'].policy.sfi_codes, undefined);
  assert.deepStrictEqual(R.sfiCodes(s.items['ITM-10928']), []);
});

test('a policy save that does not mention the list leaves it alone', () => {
  const s = R.reduce(events.concat([ev('item_policy_set', { item_id: 'ITM-10917', min_qty: 500 }, '2026-09-12T01:00:00.000Z')]), catalogue);
  assert.deepStrictEqual(R.sfiCodes(s.items['ITM-10917']), ['601.001.075', '233.075.01']);
});

test('an unlinked item has no codes, not null', () => {
  const s = R.reduce([], catalogue);
  assert.deepStrictEqual(R.sfiCodes(s.items['ITM-10917']), []);
});

// ── Attachment ──────────────────────────────────────────────────────────────

console.log('\nWhat is attached to what');

test('codes relate on a dotted boundary only', () => {
  assert.ok(A.codeRelated('601.001', '601.001.075'));
  assert.ok(A.codeRelated('601.001.075', '601.001'));
  assert.ok(!A.codeRelated('601.001', '601.0011'));
  assert.ok(!A.codeRelated('', '601'));
});

test('the oil list is the fluids, and the ME filter is not on it', () => {
  const m = model();
  assert.deepStrictEqual(m.fluids.map(f => f.item_id).sort(), ['ITM-06437', 'ITM-10917', 'ITM-10921', 'ITM-10928']);
});

test('fuel tanks are never in the universe', () => {
  const m = model();
  assert.ok(!m.nodes['tank:' + TK01]);
});

test('a code that is a tank becomes the tank, not a second equipment row', () => {
  const m = model();
  assert.ok(!m.nodes['code:233.075.01']);
  assert.strictEqual(m.nodes['tank:' + TK22].code, '233.075.01');
});

console.log('\nPick the oil first');

test('Mobilgard: To is the Main Engine, its LO system, and the waste tanks — not a generator', () => {
  const o = A.options(model(), { item_id: 'ITM-10917' });
  const to = keys(o.to);
  assert.ok(to.includes('code:601.001'), 'Main Engine missing');
  assert.ok(to.includes('code:601.001.075'), 'ME LO system missing');
  assert.ok(to.includes('tank:' + TK17), 'waste tank missing');
  assert.ok(!to.includes('code:651.001'), 'a generator was offered');
  assert.ok(!to.includes('tank:' + TK24), 'the 15W40 tank was offered');
});

test('Mobilgard: From is tank 22 and the shelf that holds it, not waste tanks', () => {
  const o = A.options(model(), { item_id: 'ITM-10917' });
  const from = keys(o.from);
  assert.ok(from.includes('tank:' + TK22));
  assert.ok(from.includes('loc:LOC-0001'));
  assert.ok(!from.includes('tank:' + TK17));
  assert.ok(!from.includes('tank:' + TK24));
});

test('history suggests tank 22 into the Main Engine', () => {
  const o = A.options(model(), { item_id: 'ITM-10917' });
  assert.strictEqual(o.suggest.from, 'tank:' + TK22);
  assert.strictEqual(o.suggest.to, 'code:601.001');
});

test('the 376 USG mistake is not a suggestion for Delvac', () => {
  const o = A.options(model(), { item_id: 'ITM-10928' });
  assert.strictEqual(o.suggest.to, 'code:651.002');
  assert.ok(!keys(o.to).includes('code:601.001'));
});

test('a drum oil with no history suggests its own tank', () => {
  const o = A.options(model(), { item_id: 'ITM-10921' });
  assert.strictEqual(o.suggest.from, 'tank:' + TK29);
});

test('pails with no tank suggest the shelf', () => {
  const o = A.options(model(), { item_id: 'ITM-06437' });
  assert.strictEqual(o.suggest.from, 'loc:LOC-0200');
});

console.log('\nPick the machine first');

test('Diesel Generator No.1 lists only the oils attached to it', () => {
  const o = A.options(model(), { to: 'code:651.001' });
  assert.deepStrictEqual(keys(o.oils).sort(), ['ITM-06437', 'ITM-10928']);
});

test('and From narrows to where those oils are kept', () => {
  const o = A.options(model(), { to: 'code:651.001' });
  const from = keys(o.from);
  assert.ok(from.includes('tank:' + TK24));
  assert.ok(!from.includes('tank:' + TK22));
});

test('pick tank 22 as From and the oil narrows to Mobilgard', () => {
  const o = A.options(model(), { from: 'tank:' + TK22 });
  assert.deepStrictEqual(keys(o.oils), ['ITM-10917']);
});

test('nothing chosen: every list is whole', () => {
  const m = model();
  const o = A.options(m, {});
  assert.strictEqual(o.oils.length, m.fluids.length);
  assert.ok(keys(o.to).includes('code:651.001') && keys(o.to).includes('code:601.001'));
});

test('the same place is never at both ends', () => {
  const o = A.options(model(), { item_id: 'ITM-10917', from: 'tank:' + TK22 });
  assert.ok(!keys(o.to).includes('tank:' + TK22));
});

console.log('\nOverride Attachment');

test('override on To offers the generator, marked as not attached', () => {
  const o = A.options(model(), { item_id: 'ITM-10917', override: { to: true } });
  const dg = o.to.find(n => n.key === 'code:651.001');
  assert.ok(dg, 'generator not offered under override');
  assert.strictEqual(dg.attached, false);
});

test('override on From offers the waste tanks', () => {
  const o = A.options(model(), { item_id: 'ITM-10917', override: { from: true } });
  assert.ok(keys(o.from).includes('tank:' + TK17));
});

test('override on the oil offers everything, attached or not', () => {
  const o = A.options(model(), { to: 'code:651.001', override: { oil: true } });
  assert.strictEqual(o.oils.length, 4);
  assert.strictEqual(o.oils.find(x => x.item_id === 'ITM-10917').attached, false);
});

test('a code-less rounds point is only reachable by override', () => {
  const m = model();
  assert.ok(!keys(A.options(m, { item_id: 'ITM-10921' }).to).includes('point:r-headtank'));
  assert.ok(keys(A.options(m, { item_id: 'ITM-10921', override: { to: true } }).to).includes('point:r-headtank'));
});

test('a selection made under override stays on the list after override is turned off', () => {
  const o = A.options(model(), { item_id: 'ITM-10917', to: 'code:651.001' });
  assert.ok(keys(o.to).includes('code:651.001'));
});

console.log('\nWhat the row says');

test('an ordinary top-up carries the item and its name, and no override', () => {
  const f = A.entryFields(model(), { item_id: 'ITM-10917', from: 'tank:' + TK22, to: 'code:601.001' });
  assert.deepStrictEqual(f, { item_id: 'ITM-10917', fluid: 'Oil, Lubricating, Mobilgard 410 NC, Bulk' });
});

test('an SOP override says which end was overridden', () => {
  const f = A.entryFields(model(), { item_id: 'ITM-10928', from: 'tank:' + TK24, to: 'code:601.001' });
  assert.deepStrictEqual(f.attachment_override, ['to']);
});

test('oil from a shelf names the shelf', () => {
  const f = A.entryFields(model(), { item_id: 'ITM-06437', from: 'loc:LOC-0200', to: 'code:651.001' });
  assert.strictEqual(f.from_location_id, 'LOC-0200');
  assert.strictEqual(f.attachment_override, undefined);
});

test('a non-fluid item picked by override is flagged as the oil override', () => {
  const f = A.entryFields(model(), { item_id: 'ITM-05478', from: 'other', to: 'code:601.001' });
  assert.deepStrictEqual(f.attachment_override, ['oil']);
});

test('a written-in oil carries its text and no item', () => {
  const f = A.entryFields(model(), { fluid_text: 'Mystery pail', from: 'other', to: 'code:601.001' });
  assert.deepStrictEqual(f, { item_id: null, fluid: 'Mystery pail' });
});

console.log('\nHistory');

test('a legacy row is attributed through the one oil in its tank', () => {
  const p = A.precedent(model(), 'ITM-10917');
  assert.strictEqual(p.to[0].key, 'code:601.001');
  assert.strictEqual(p.to[0].n, 3);
});

test('a level correction is not counted', () => {
  const p = A.precedent(model(), 'ITM-10917');
  const n = p.from.reduce((s, t) => s + t.n, 0);
  assert.strictEqual(n, 4);
});

test('holding To fixed narrows From', () => {
  const p = A.precedent(model(), 'ITM-10917', { to: 'tank:' + TK17 });
  assert.strictEqual(p.from.length, 1);
  assert.strictEqual(p.from[0].n, 1);
});

console.log('\nA link rolls up to its machine, never down (2026-09-13)');

{
  // The Araho's own pair: Rando 46 goes into the HPU, HDZ into the trawl winch
  // motor cooling unit under it, and both have rounds checks.
  const TK28 = 'tk28', TK20 = 'tk20';
  const hpuTanks = [
    { tank_id: TK28, category: 'lube_oil', name: 'Hydraulic Oil Storage Tank 28', asset_code: '233.077.02' },
    { tank_id: TK20, category: 'lube_oil', name: 'Motor Cooling Oil Tank 20', asset_code: '233.199.08' }
  ];
  const hpuPoints = [
    { code: '831.001.01.16', item_id: 'r-mc', label: 'Motor cooling tank', kind: 'inspection_tank' },
    { code: '403.001', item_id: 'r-sg', label: 'Steering hydraulic tank', kind: 'inspection_tank' }
  ];
  const cat2 = { baseline_at: '2026-09-01T00:00:00.000Z', locations: {}, counts: {}, items: {
    'ITM-06433': { item_id: 'ITM-06433', name: 'Rando AW 46, Bulk', unit: 'Gallon', location_id: 'LOC-0001', in_stock: 2869 },
    'ITM-06434': { item_id: 'ITM-06434', name: 'Rando AW 46, Drums', unit: 'Gallon', location_id: 'LOC-0001', in_stock: 2972 },
    'ITM-06436': { item_id: 'ITM-06436', name: 'HDZ 15', unit: 'Gallon', location_id: 'LOC-0300', in_stock: 1046 },
    'ITM-06437': { item_id: 'ITM-06437', name: 'DELO 400', unit: 'DR', location_id: 'LOC-0200', in_stock: 947 }
  }};
  const rando = ['403.007', '831.001.01', '439.047', '233.077.02'];
  const st2 = R.reduce([
    ev('item_policy_set', { item_id: 'ITM-06433', sfi_codes: rando }),
    ev('item_policy_set', { item_id: 'ITM-06434', sfi_codes: rando }),
    ev('item_policy_set', { item_id: 'ITM-06436', sfi_codes: ['831.001.01.16', '233.199.08'] }),
    ev('item_policy_set', { item_id: 'ITM-06437', fluid: true, sfi_codes: ['651.001.42'] })
  ], cat2);
  const m2 = A.build({ tanks: hpuTanks, points: hpuPoints, items: st2.items, logs: [
    { timestamp: '2026-08-05T12:44:40Z', from_tank_id: TK28, quantity: 50, to_type: 'equipment', equipment_code: '831.001.01' }
  ] });

  test('the motor cooling unit offers HDZ and not Rando', () => {
    assert.deepStrictEqual(keys(A.options(m2, { to: 'code:831.001.01.16' }).oils), ['ITM-06436']);
  });

  test('the HPU offers Rando and not HDZ', () => {
    assert.deepStrictEqual(keys(A.options(m2, { to: 'code:831.001.01' }).oils).sort(), ['ITM-06433', 'ITM-06434']);
  });

  test('a link still rolls up to a machine with no point of its own in between', () => {
    assert.ok(A.linkReaches(m2, '601.001.075', '601.001'));
    assert.ok(!A.linkReaches(m2, '601.001', '601.001.075'), 'never down');
  });

  test('the old steering gear check is not attached to the new steering gear code', () => {
    assert.ok(!keys(A.options(m2, { item_id: 'ITM-06433' }).to).includes('code:403.001'));
  });

  test('a tank is matched by its exact code, not its group', () => {
    const m3 = A.build({ tanks: hpuTanks, items: R.reduce([ev('item_policy_set', { item_id: 'ITM-06433', sfi_codes: ['233.077'] })], cat2).items });
    assert.strictEqual(m3.fluids.length, 0);
  });

  test('bulk and drums of one oil share the tank\'s history', () => {
    assert.strictEqual(A.precedent(m2, 'ITM-06433').to[0].key, 'code:831.001.01');
    assert.strictEqual(A.precedent(m2, 'ITM-06434').to[0].key, 'code:831.001.01');
  });

  test('stock is issued only from an item counted in gallons', () => {
    assert.ok(A.issuesStock(st2.items['ITM-06436']));
    assert.ok(A.issuesStock({ unit: 'USG' }));
    assert.ok(!A.issuesStock(st2.items['ITM-06437']), 'DR is drums: 5 USG must not take five drums off');
    assert.ok(!A.issuesStock({ unit: 'PL' }));
    assert.ok(!A.issuesStock(null));
  });
}

console.log('\nThe one writer both surfaces call');

function io(vols) {
  return { get: id => vols[id] || 0, set: (id, v) => { vols[id] = Math.round(v * 10) / 10; return vols[id]; } };
}

test('lube tank to lube tank is ONE row, and both tanks move', () => {
  const data = {}, vols = { [TK22]: 500, [TK24]: 100 };
  const r = A.writeMovement(data, { from: { kind: 'lube_tank', tank_id: TK22 }, to: { kind: 'lube_tank', tank_id: TK24 },
                                    qty: 50, source: 'console', now: 'T' }, io(vols));
  assert.strictEqual(data.lube_log.length, 1, 'the log used to show this transfer twice');
  assert.strictEqual(data.lube_log[0].from_tank_id, TK22);
  assert.strictEqual(data.lube_log[0].to_tank_id, TK24);
  assert.strictEqual(vols[TK22], 450);
  assert.strictEqual(vols[TK24], 150);
  assert.strictEqual(r.destRetained, 150);
});

test('lube tank to waste tank is a row in each lane', () => {
  const data = {}, vols = { [TK22]: 500, [TK17]: 10 };
  A.writeMovement(data, { from: { kind: 'lube_tank', tank_id: TK22 }, to: { kind: 'waste_tank', tank_id: TK17 }, qty: 5 }, io(vols));
  assert.strictEqual(data.lube_log.length, 1);
  assert.strictEqual(data.waste_log.length, 1);
  assert.strictEqual(vols[TK17], 15);
});

test('the oil fields land on every row, and the source says which surface', () => {
  const data = {}, vols = { [TK22]: 500, [TK17]: 10 };
  A.writeMovement(data, { from: { kind: 'lube_tank', tank_id: TK22 }, to: { kind: 'waste_tank', tank_id: TK17 }, qty: 5,
                          oil: { item_id: 'ITM-10917', fluid: 'Mobilgard' }, source: 'console' }, io(vols));
  const rows = data.lube_log.concat(data.waste_log);
  assert.ok(rows.every(e => e.item_id === 'ITM-10917' && e.source === 'console'));
});

test('a shelf into a machine moves no tank and still writes the row', () => {
  const data = {}, vols = { [TK22]: 500 };
  A.writeMovement(data, { from: { kind: 'location' }, to: { kind: 'equipment' }, qty: 5, sourceLabel: 'Stores — Oil Store',
                          machine: { code: '651.001', side: 'to' }, oil: { item_id: 'ITM-06437', from_location_id: 'LOC-0200' } }, io(vols));
  assert.strictEqual(data.lube_log.length, 1);
  assert.strictEqual(data.lube_log[0].from_location_id, 'LOC-0200');
  assert.strictEqual(data.lube_log[0].from_description, 'Stores — Oil Store');
  assert.strictEqual(vols[TK22], 500);
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
