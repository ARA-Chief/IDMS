'use strict';

// What the screens print, where printing the wrong field is silent.
//
// The reducer is well covered; what is not is the last inch — a view reading a
// raw catalogue field where the rest of the module reads `effective()`. That
// mistake shows no error, breaks no test that checks quantities, and puts a
// number on screen that contradicts the reason the row is there. So this suite
// pulls the PWA's own view functions out of `procurement.html` and reads what
// they render.

const { REPO, REDUCER, counter } = require('./_paths');
const fs = require('fs');
const path = require('path');
const R = require(REDUCER);
const T = counter(), check = T.check;

const cat = {
  baseline_at: null,
  locations: {
    'LOC-0001': { location_id: 'LOC-0001', path: 'Maindeck', deck: 'Maindeck', depth: 1,
                  parent_id: null, items_here: 2, items_deep: 2, sublocations: 0 }
  },
  items: {
    // 13,885 of 14,487 items have no minimum in TM Master. An IDMS overlay is
    // the only minimum most of the register will ever have (§42.14).
    'ITM-00001': { name: 'Gasket', unit: 'ea', location_id: 'LOC-0001', in_stock: 3, consumption: {} },
    // And a few hundred do carry TM's own.
    'ITM-00002': { name: 'Bolt', unit: 'ea', location_id: 'LOC-0001', in_stock: 1,
                   min_qty: 5, consumption: {} }
  }
};

const state = R.reduce([
  { schema_version: 1, event_id: 'e1', event_type: 'item_policy_set',
    timestamp: '2026-09-07T09:00:00.000Z', actor: 'wostara',
    payload: { item_id: 'ITM-00001', min_qty: 20 } }
], cat);

// The fixture has to actually exercise the thing, or the assertion below passes
// for the wrong reason.
T.head('the fixture puts both kinds of minimum on the list');
check('the overlaid item is short', R.isLow(state.items['ITM-00001']), true);
check('and its minimum in force is the overlay', R.effective(state.items['ITM-00001'], 'min_qty'), 20);
check('while TM never gave it one', state.items['ITM-00001'].min_qty == null, true);
check("the other item is short on TM's own minimum", R.isLow(state.items['ITM-00002']), true);
check('which is not an overlay',
  state.items['ITM-00002'].policy && state.items['ITM-00002'].policy.min_qty !== undefined
    && state.items['ITM-00002'].policy.min_qty !== null ? true : false, false);

// ── The Low stock table, rendered by the page's own function ────────────────
T.head('Low stock prints the minimum that put the row there');
const html = fs.readFileSync(path.join(REPO, 'procurement.html'), 'utf8');
const start = html.indexOf('// ── View: Low stock');
const end = html.indexOf('// ── Item picker');
check('the Low stock block is where it was left', start !== -1 && end > start, true);

if (start !== -1 && end > start) {
  let body = '';
  const sandbox = {
    procurementReduce: R,
    PC: { state, catalogue: cat, view: 'low', sel: null },
    pcItemsSorted: () => Object.keys(state.items).map(k => state.items[k])
                           .sort((a, b) => String(a.name).localeCompare(String(b.name))),
    pcEsc: s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
                 .replace(/>/g, '&gt;').replace(/"/g, '&quot;'),
    pcFmtQty: n => String(Number(n) || 0),
    pcHead: () => {},
    pcUuid: () => 'uuid',
    pcRenderAll: () => {},
    pcReqForm: lines => { sandbox.raised = lines; },
    document: { getElementById: () => ({ set innerHTML(v) { body = v; } }) }
  };
  const names = Object.keys(sandbox);
  // eslint-disable-next-line no-new-func
  const load = new Function(...names,
    html.slice(start, end) + '\nreturn { pcViewLow, pcReqFromLow };');
  const api = load(...names.map(k => sandbox[k]));

  api.pcViewLow();
  const rows = body.split('<tr>').slice(2);          // header row first
  check('both short items are listed', rows.length, 2);

  const gasket = rows.find(r => r.indexOf('Gasket') !== -1) || '';
  const bolt = rows.find(r => r.indexOf('Bolt') !== -1) || '';

  // The bug this suite exists for: the column read `item.min_qty`, which TM
  // never set, so the row said the minimum was 0 while `isLow` and the Suggest
  // column were both working from the overlay's 20.
  check('an overlaid minimum is shown, not the empty TM field',
    gasket.indexOf('>20<') !== -1, true);
  check('and is marked as ours', gasket.indexOf('policy-chip') !== -1, true);
  check("TM's own minimum is shown as it stands", bolt.indexOf('>5<') !== -1, true);
  check('and carries no IDMS mark', bolt.indexOf('policy-chip') === -1, true);

  // The suggestion has always read `effective`; it is checked here so the two
  // columns are asserted to agree rather than merely to both exist.
  check('the suggestion agrees with the minimum beside it',
    gasket.indexOf('<b>17</b>') !== -1, true);

  // Raising the requisition from this list must use the same numbers.
  api.pcReqFromLow();
  const line = (sandbox.raised || []).find(l => l.item_id === 'ITM-00001');
  check('and so does the requisition raised from the list', line && line.qty, 17);
}

process.exit(T.done() ? 0 : 1);
