'use strict';

// Add Oil, and what it leaves behind.
//
// The phone's Add Oil moves a tank and writes a rough-log sentence. Until
// 2026-09-11 that was ALL it wrote: the machine the oil went into was named in
// prose and nowhere else, so the Console's oil ledger — which reads
// `equipment_id` / `equipment_code` off the transfer logs — skipped every entry
// the phone ever made. Oil added on deck moved the tank and then vanished.
//
// This drives the real `addOilApplyTankDeltas`, `addOilFormatDestLabel` and
// `erParseAssetsCsv` out of index.html, against the shapes the Araho's own
// config files actually have.
//
// Run: node tools/test/add-oil.test.js  (or the whole suite, tools/test/run.js)

const fs     = require('fs');
const path   = require('path');
const vm     = require('vm');
const assert = require('assert');

const HTML = fs.readFileSync(path.join(__dirname, '..', '..', 'index.html'), 'utf8');

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); console.log('  ✓ ' + name); passed++; }
  catch (e) { console.log('  ✗ ' + name + '\n      ' + (e && e.message)); failed++; }
}
async function testAsync(name, fn) {
  try { await fn(); console.log('  ✓ ' + name); passed++; }
  catch (e) { console.log('  ✗ ' + name + '\n      ' + (e && e.message)); failed++; }
}

// Pull one function out of the single-file app by name. index.html is one
// 12,000-line page and loading the whole of it needs a DOM; the three functions
// under test are self-contained, so they are lifted rather than mocked around.
function lift(names, extra) {
  const sb = Object.assign({ console, fetch: null, Date }, extra || {});
  sb.window = sb;
  vm.createContext(sb);
  names.forEach(n => {
    const re = new RegExp('(?:async )?function ' + n + '\\s*\\(');
    const at = HTML.search(re);
    if (at < 0) throw new Error('could not find function ' + n);
    // Brace-match to the end of the declaration.
    let i = HTML.indexOf('{', at), depth = 0, end = -1;
    for (let j = i; j < HTML.length; j++) {
      if (HTML[j] === '{') depth++;
      else if (HTML[j] === '}') { depth--; if (!depth) { end = j + 1; break; } }
    }
    vm.runInContext(HTML.slice(at, end), sb, { filename: n + '.js' });
  });
  return sb;
}

// ── The label, which is what an engineer actually reads ──────────────────────

console.log('\nWhat the dropdown calls things');
{
  const sb = lift(['addOilFormatDestLabel']);
  sb.ER_ASSETS_CACHE = [
    { code: '601.001', name: 'Main Engine' },
    { code: '651.002', name: 'Diesel Generator No.2' }
  ];
  const f = sb.addOilFormatDestLabel;

  test('an asset the register knows reads as its name and number', () => {
    assert.strictEqual(
      f('601.001', 'Lube oil added - Mobilgard 410 NC', 'MAIN ENGINE', 'add_oil'),
      'Main Engine (601.001)');
  });

  test('an asset it does not know falls back to the rounds label, with the code', () => {
    assert.strictEqual(
      f('362.003.001', 'Lube oil added - Zerol 300', 'REFRIGERATION', 'add_oil'),
      'REFRIGERATION · Lube oil added - Zerol 300 (362.003.001)');
  });

  test('with no label at all, the code stands alone — never a uuid', () => {
    // pushDest used to fall back to it.item_id here, so an add-oil line whose
    // label had not been filled in showed as
    // '47248461-0aeb-478e-a927-fe78ef6ab213' on the phone.
    const out = f('831.021', '', '', 'add_oil');
    assert.strictEqual(out, '831.021');
    assert.ok(!/[0-9a-f]{8}-[0-9a-f]{4}/.test(out), out);
  });

  test('and with neither, it says so', () => {
    assert.strictEqual(f(null, '', '', 'add_oil'), 'Unnamed');
  });

  test('a tank-level inspection keeps its own wording', () => {
    assert.strictEqual(f('403.001', 'Steering hydraulic tank', '', 'inspection_tank'),
      'Steering hydraulic tank');
  });
}

// ── The register itself ──────────────────────────────────────────────────────

console.log('\nReading the asset register');
{
  const sb = lift(['erParseAssetsCsv']);
  test('the real header shape resolves codes to names', () => {
    // config/assets.csv: Code,Unit name,Unit code,Name,SerialNo,… with a BOM.
    const csv = '﻿Code,Unit name,Unit code,Name,SerialNo\r\n'
              + '601.001,Araho,ARA,Main Engine,14-K1-1018\r\n'
              + '651.002,Araho,ARA,Diesel Generator No.2,\r\n';
    const rows = sb.erParseAssetsCsv(csv);
    assert.strictEqual(rows.length, 2);
    assert.strictEqual(rows.find(r => r.code === '601.001').name, 'Main Engine');
  });

  test('"Unit code" is not mistaken for "Code"', () => {
    const csv = 'Code,Unit name,Unit code,Name\r\n601.001,Araho,ARA,Main Engine\r\n';
    assert.strictEqual(sb.erParseAssetsCsv(csv)[0].code, '601.001');
  });
}

// ── What the movement leaves in the log ──────────────────────────────────────

const TANKS_STATE = () => ({
  schema_version: 2,
  tanks: [{ tank_id: 'TK-LO-1', volume: 400 }, { tank_id: 'TK-WO-1', volume: 50 }],
  lube_log: [], waste_log: []
});

function deltaSandbox(state) {
  const saved = { state: state };
  const sb = lift(['addOilApplyTankDeltas'], {
    // The rows are written by the shared module, as they are in the page.
    oilAttach: require(path.join(__dirname, '..', '..', 'utils', 'oil-attach.js')),
    obsRefreshToken: async () => 'tok',
    graphToken: 'tok',
    incinGraphUrl: p => 'https://example/' + p,
    FUELSTATE_PATH: 'fuelstate.json',
    currentUser: { username: 'rdelacruz', name: 'R Dela Cruz' },
    fetch: async (url, init) => {
      if (init && init.method === 'PUT') {
        saved.written = JSON.parse(init.body);
        return { ok: true, status: 200 };
      }
      return { ok: true, json: async () => JSON.parse(JSON.stringify(saved.state)) };
    }
  });
  sb.saved = saved;
  return sb;
}

(async () => {
  console.log('\nWhat a top-up on the phone leaves behind');

  await testAsync('the machine is named on the entry, not just in the sentence', async () => {
    const sb = deltaSandbox(TANKS_STATE());
    await sb.addOilApplyTankDeltas({
      sourceKind: 'lube_tank', sourceTankId: 'TK-LO-1',
      destKind: 'equipment', destTankId: null, qty: 8,
      machine: { code: '601.001', item_id: 'RI-ME', label: 'Main Engine (601.001)', side: 'to' }
    });
    const e = sb.saved.written.lube_log[0];
    assert.strictEqual(e.equipment_code, '601.001');
    assert.strictEqual(e.equipment_id, 'RI-ME');
    assert.strictEqual(e.equipment_label, 'Main Engine (601.001)');
    assert.strictEqual(e.source, 'pwa');
  });

  await testAsync('the quantity is unsigned, the way the Console writes it', async () => {
    const sb = deltaSandbox(TANKS_STATE());
    await sb.addOilApplyTankDeltas({
      sourceKind: 'lube_tank', sourceTankId: 'TK-LO-1',
      destKind: 'equipment', destTankId: null, qty: 8,
      machine: { code: '601.001', item_id: null, label: 'Main Engine', side: 'to' }
    });
    const e = sb.saved.written.lube_log[0];
    assert.strictEqual(e.quantity, 8, 'was -8, which read as -8 USG on Tank Levels & Transfers');
    assert.strictEqual(e.to_type, 'equipment', "was 'add_oil', which the ledger did not know");
  });

  await testAsync('and the tank still moves', async () => {
    const sb = deltaSandbox(TANKS_STATE());
    const r = await sb.addOilApplyTankDeltas({
      sourceKind: 'lube_tank', sourceTankId: 'TK-LO-1',
      destKind: 'equipment', destTankId: null, qty: 8,
      machine: { code: '601.001', item_id: null, label: 'ME', side: 'to' }
    });
    assert.strictEqual(r.sourceRetained, 392);
    assert.strictEqual(sb.saved.written.tanks.find(t => t.tank_id === 'TK-LO-1').volume, 392);
  });

  await testAsync('an oil change names the machine it came OUT of', async () => {
    const sb = deltaSandbox(TANKS_STATE());
    await sb.addOilApplyTankDeltas({
      sourceKind: 'equipment', sourceTankId: null,
      destKind: 'waste_tank', destTankId: 'TK-WO-1', qty: 295,
      machine: { code: '601.001', item_id: 'RI-ME', label: 'Main Engine (601.001)', side: 'from' }
    });
    const w = sb.saved.written.waste_log;
    assert.strictEqual(w.length, 1);
    assert.strictEqual(w[0].equipment_code, '601.001');
    assert.strictEqual(w[0].equipment_side, 'from', 'this is oil leaving the machine, not entering it');
    assert.strictEqual(w[0].quantity, 295);
    assert.strictEqual(sb.saved.written.tanks.find(t => t.tank_id === 'TK-WO-1').volume, 345);
  });

  await testAsync('a plain tank-to-tank move names no machine', async () => {
    const sb = deltaSandbox(TANKS_STATE());
    await sb.addOilApplyTankDeltas({
      sourceKind: 'lube_tank', sourceTankId: 'TK-LO-1',
      destKind: 'waste_tank', destTankId: 'TK-WO-1', qty: 20, machine: null
    });
    const rows = sb.saved.written.lube_log.concat(sb.saved.written.waste_log);
    assert.ok(rows.length >= 1);
    assert.ok(rows.every(e => !e.equipment_code), 'a tank is not a machine');
    assert.ok(rows.every(e => e.quantity > 0), 'and both sides are unsigned');
  });


  await testAsync('a pail into a head tank is recorded even though no tank moves', async () => {
    // An inspection tank has no volume to track and a drum is not a tank, so
    // neither side of this movement has a level to change. It is still oil
    // that went into a machine, and it used to exist only in the rough-log
    // sentence -- prose, which the ledger cannot read.
    const sb = deltaSandbox(TANKS_STATE());
    await sb.addOilApplyTankDeltas({
      sourceKind: 'other', sourceTankId: null,
      destKind: 'inspection_tank', destTankId: null, qty: 2,
      sourceLabel: '5gal pail',
      machine: { code: '403.001', item_id: 'RI-SG', label: 'Steering hydraulic tank', side: 'to' }
    });
    const e = sb.saved.written.lube_log[0];
    assert.ok(e, 'a row was written');
    assert.strictEqual(e.equipment_code, '403.001');
    assert.strictEqual(e.from_tank_id, null);
    assert.strictEqual(e.from_description, '5gal pail');
    assert.strictEqual(e.quantity, 2);
  });

  await testAsync('and nothing is invented where no machine was named', async () => {
    const sb = deltaSandbox(TANKS_STATE());
    await sb.addOilApplyTankDeltas({
      sourceKind: 'other', sourceTankId: null,
      destKind: 'other', destTankId: null, qty: 2, machine: null
    });
    assert.strictEqual((sb.saved.written || TANKS_STATE()).lube_log.length, 0);
  });

  console.log('\nThe oil itself is on the row (2026-09-12)');

  await testAsync('a top-up carries the item it traces to', async () => {
    const sb = deltaSandbox(TANKS_STATE());
    await sb.addOilApplyTankDeltas({
      sourceKind: 'lube_tank', sourceTankId: 'TK-LO-1',
      destKind: 'equipment', destTankId: null, qty: 8,
      machine: { code: '601.001', item_id: 'RI-ME', label: 'Main Engine (601.001)', side: 'to' },
      oil: { item_id: 'ITM-10917', fluid: 'Oil, Lubricating, Mobilgard 410 NC, Bulk' }
    });
    const e = sb.saved.written.lube_log[0];
    assert.strictEqual(e.item_id, 'ITM-10917');
    assert.strictEqual(e.fluid, 'Oil, Lubricating, Mobilgard 410 NC, Bulk');
    assert.strictEqual(e.from_tank_id, 'TK-LO-1');
    assert.strictEqual(e.from_description, undefined, 'a tank source needs no description');
  });

  await testAsync('both rows of a tank-to-tank move carry it, and the override', async () => {
    const sb = deltaSandbox(TANKS_STATE());
    await sb.addOilApplyTankDeltas({
      sourceKind: 'lube_tank', sourceTankId: 'TK-LO-1',
      destKind: 'waste_tank', destTankId: 'TK-WO-1', qty: 20, machine: null,
      oil: { item_id: 'ITM-10928', fluid: 'Delvac', attachment_override: ['from'] }
    });
    const rows = sb.saved.written.lube_log.concat(sb.saved.written.waste_log);
    assert.strictEqual(rows.length, 2);
    assert.ok(rows.every(e => e.item_id === 'ITM-10928'));
    assert.ok(rows.every(e => e.attachment_override && e.attachment_override[0] === 'from'));
  });

  await testAsync('pails off a shelf into a machine name the shelf', async () => {
    const sb = deltaSandbox(TANKS_STATE());
    await sb.addOilApplyTankDeltas({
      sourceKind: 'location', sourceTankId: null,
      destKind: 'equipment', destTankId: null, qty: 5,
      sourceLabel: 'Stores — Below Main Deck',
      machine: { code: '651.001', item_id: 'RI-DG1', label: 'DG1', side: 'to' },
      oil: { item_id: 'ITM-06437', fluid: 'DELO 400', from_location_id: 'LOC-0200' }
    });
    const e = sb.saved.written.lube_log[0];
    assert.strictEqual(e.from_location_id, 'LOC-0200');
    assert.strictEqual(e.from_description, 'Stores — Below Main Deck');
    assert.strictEqual(e.equipment_code, '651.001');
    assert.strictEqual(sb.saved.written.tanks.find(t => t.tank_id === 'TK-LO-1').volume, 400, 'no tank moved');
  });

  await testAsync('drums off a shelf into a tank credit the tank and name the shelf', async () => {
    const sb = deltaSandbox(TANKS_STATE());
    await sb.addOilApplyTankDeltas({
      sourceKind: 'location', sourceTankId: null,
      destKind: 'lube_tank', destTankId: 'TK-LO-1', qty: 55, machine: null,
      sourceLabel: 'Stores — Below Main Deck',
      oil: { item_id: 'ITM-10921', fluid: 'Mobilgear drums', from_location_id: 'LOC-0001' }
    });
    const e = sb.saved.written.lube_log[0];
    assert.strictEqual(e.to_tank_id, 'TK-LO-1');
    assert.strictEqual(e.from_tank_id, null);
    assert.strictEqual(e.from_location_id, 'LOC-0001');
    assert.strictEqual(sb.saved.written.tanks.find(t => t.tank_id === 'TK-LO-1').volume, 455);
  });

  console.log('\n' + (failed ? '✗ ' + failed + ' failed, ' + passed + ' passed'
                              : '✓ all ' + passed + ' passed'));
  process.exit(failed ? 1 : 0);
})();
