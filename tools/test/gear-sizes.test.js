'use strict';

// Gear sizes (utils/gear-sizes.js): absent is not empty, a saved list is
// shown as saved, and a save writes clean rows.
const path = require('path');
const { REPO, counter } = require('./_paths');
const G = require(path.join(REPO, 'utils', 'gear-sizes.js'));
const T = counter(), check = T.check;

T.head('never asked');
let g = G.gearSizesFor({ crew_id: 'nobody' });
check('shown the default items, in order', g.rows.map(r => r.item), G.DEFAULT_ITEMS);
check('with no sizes', g.rows.every(r => r.size === '' && r.note === ''), true);
check('flagged as not yet saved', g.seeded, true);
check('no member at all is the same', G.gearSizesFor(null).rows.length, G.DEFAULT_ITEMS.length);
check('the defaults are fresh objects each time',
  G.gearSizesFor({}).rows[0] !== G.gearSizesFor({}).rows[0], true);

T.head('once saved, the stored list wins');
g = G.gearSizesFor({ gear_sizes: [{ item: 'Boots', size: '11' }] });
check('exactly what was saved — no defaults added', g.rows, [{ item: 'Boots', size: '11', note: '' }]);
check('not flagged as seeded', g.seeded, false);
check('removing every row is kept, not re-defaulted', G.gearSizesFor({ gear_sizes: [] }).rows, []);

T.head('what a save writes');
check('a row without an item is dropped', G.cleanGearSizes([{ item: '  ', size: 'L' }, { item: 'Hat' }]),
  [{ item: 'Hat', size: '', note: '' }]);
check('whitespace collapsed and trimmed', G.cleanGearSizes([{ item: ' Rain  Gear ', size: ' XL ', note: ' Grundens\n bib ' }]),
  [{ item: 'Rain Gear', size: 'XL', note: 'Grundens bib' }]);
check('two rows for one item are both kept (two glove models)',
  G.cleanGearSizes([{ item: 'Gloves', size: 'L', note: '620' }, { item: 'Gloves', size: 'XL', note: '451' }]).length, 2);
check('lengths are capped', G.cleanGearSizes([{ item: 'x'.repeat(99) }])[0].item.length, G.LIMITS.item);
check('non-arrays save as empty', G.cleanGearSizes(undefined), []);
const saved = [{ item: 'Trousers', size: 'C50', note: 'Fristads 100293 FAS · waist x length 32x32 · 2026 order' }];
check('a clean list is a fixed point', G.cleanGearSizes(saved), saved);

process.exit(T.done() ? 0 : 1);
