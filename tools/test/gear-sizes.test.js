'use strict';

// Gear sizes (utils/gear-sizes.js): absent is not empty, a saved list is
// shown as saved, and the 2021 order seeds only the people it names.
const path = require('path');
const { REPO, counter } = require('./_paths');
const G = require(path.join(REPO, 'utils', 'gear-sizes.js'));
const T = counter(), check = T.check;

const TAYLOR = '2fb9eb13-d02c-40f4-ab5d-a8077402a99f';
const SAM_P  = 'bb092596-1f7d-46f3-83d2-ea024a13287e';

T.head('never asked');
let g = G.gearSizesFor({ crew_id: 'nobody' });
check('shown the default items, in order', g.rows.map(r => r.item), G.DEFAULT_ITEMS);
check('with no sizes', g.rows.every(r => r.size === '' && r.note === ''), true);
check('flagged as not yet saved, with no source', [g.seeded, g.source], [true, null]);
check('a member with no crew_id is the same', G.gearSizesFor({}).rows.length, G.DEFAULT_ITEMS.length);
check('and so is no member at all', G.gearSizesFor(null).seeded, true);

T.head('seeded from the order history');
g = G.gearSizesFor({ crew_id: TAYLOR });
const by = item => g.rows.find(r => r.item === item);
check('names its source', g.source, G.HISTORY_SOURCE);
check('trousers are waist x length', by('Trousers').size, '32x32');
check('the European size rides in the note', /EU 50$/.test(by('Trousers').note), true);
check('jacket and shirt', [by('Jacket').size, by('Shirt').size], ['M', 'M']);
check('gloves and boots stay open — they were never ordered per person', [by('Gloves').size, by('Boots').size], ['', '']);
check('history lands in the default rows, not after them', g.rows.length, G.DEFAULT_ITEMS.length);
check('a sweatshirt size may differ from the shirt', G.gearSizesFor({ crew_id: SAM_P }).rows.find(r => r.item === 'Sweatshirt').size, 'S');
check('eight people in the 2021 order', Object.keys(G.ORDER_HISTORY).length, 8);

T.head('once saved, the stored list wins');
g = G.gearSizesFor({ crew_id: TAYLOR, gear_sizes: [{ item: 'Boots', size: '11' }] });
check('exactly what was saved — no history, no defaults', g.rows, [{ item: 'Boots', size: '11', note: '' }]);
check('not flagged as seeded', [g.seeded, g.source], [false, null]);
g = G.gearSizesFor({ crew_id: TAYLOR, gear_sizes: [] });
check('removing every row is kept, not re-seeded', g.rows, []);

T.head('what a save writes');
check('a row without an item is dropped', G.cleanGearSizes([{ item: '  ', size: 'L' }, { item: 'Hat' }]),
  [{ item: 'Hat', size: '', note: '' }]);
check('whitespace collapsed and trimmed', G.cleanGearSizes([{ item: ' Rain  Gear ', size: ' XL ', note: ' Grundens\n bib ' }]),
  [{ item: 'Rain Gear', size: 'XL', note: 'Grundens bib' }]);
check('two rows for one item are both kept (two glove models)',
  G.cleanGearSizes([{ item: 'Gloves', size: 'L', note: '620' }, { item: 'Gloves', size: 'XL', note: '451' }]).length, 2);
check('lengths are capped', G.cleanGearSizes([{ item: 'x'.repeat(99) }])[0].item.length, G.LIMITS.item);
check('non-arrays save as empty', G.cleanGearSizes(undefined), []);
check('clean of the seeded rows is a fixed point',
  G.cleanGearSizes(G.gearSizesFor({ crew_id: TAYLOR }).rows), G.gearSizesFor({ crew_id: TAYLOR }).rows);

process.exit(T.done() ? 0 : 1);
