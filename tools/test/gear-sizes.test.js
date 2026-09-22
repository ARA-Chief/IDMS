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
check('exactly what was saved — no defaults added', g.rows,
  [{ item: 'Boots', product: '', size: '11', note: '' }]);
check('not flagged as seeded', g.seeded, false);
check('removing every row is kept, not re-defaulted', G.gearSizesFor({ gear_sizes: [] }).rows, []);

T.head('what a save writes');
check('a row without an item is dropped', G.cleanGearSizes([{ item: '  ', size: 'L' }, { item: 'Hat' }]),
  [{ item: 'Hat', product: '', size: '', note: '' }]);
check('whitespace collapsed and trimmed', G.cleanGearSizes([{ item: ' Rain  Gear ', size: ' XL ', note: ' Grundens\n bib ' }]),
  [{ item: 'Rain Gear', product: '', size: 'XL', note: 'Grundens bib' }]);
check('two rows for one item are both kept (two glove models)',
  G.cleanGearSizes([{ item: 'Gloves', size: 'L', note: '620' }, { item: 'Gloves', size: 'XL', note: '451' }]).length, 2);
check('lengths are capped', G.cleanGearSizes([{ item: 'x'.repeat(99) }])[0].item.length, G.LIMITS.item);
check('non-arrays save as empty', G.cleanGearSizes(undefined), []);
const saved = [{ item: 'Trousers', product: '100293 288 FAS 100% Cotton Trousers', size: 'C50',
                note: 'waist x length 32x32 · 2026 order' }];
check('a clean list is a fixed point', G.cleanGearSizes(saved), saved);

T.head('the catalogue — what can actually be ordered');
check('every product is filed under a garment the default list has',
  G.GEAR_CATALOGUE.every(p => G.DEFAULT_ITEMS.includes(p.item)), true);
check('the jackets', G.catalogueFor('Jacket').length, 3);
check('the coverall', G.catalogueFor('Coveralls').map(p => p.product),
  ['DE LUXE COVERALL ART. NO: 0-89870-125']);
check('the bib overalls', G.catalogueFor('Bib Overalls').length, 4);
check('asking by garment ignores case', G.catalogueFor('jacket').length, 3);
check('asking for nothing gets nothing', G.catalogueFor('').length, 0);
check('a product carries its maker and article number',
  [G.catalogueProduct('CARHARTT DUCK UNLINED BIB OVERALLS ART. NO: 102776').maker,
   G.catalogueProduct('CARHARTT DUCK UNLINED BIB OVERALLS ART. NO: 102776').article],
  ['Carhartt', '102776']);
check('one nobody has told us the maker of says so, rather than guessing',
  G.catalogueProduct('DE LUXE COVERALL ART. NO: 0-89870-125').maker, null);
check('a product the form does not carry is not in it', G.catalogueProduct('Boots, steel toe'), null);

T.head('which product a row is for');
check('the field, when it has one',
  G.productOf({ item: 'Jacket', product: '109322 4857 KC 100% Cotton Jacket' }),
  '109322 4857 KC 100% Cotton Jacket');
check('the note, for a row written before the field existed',
  G.productOf({ item: 'Jacket', note: 'Carhartt Rain Defender softshell · 2025 order' }),
  'Carhartt Rain Defender softshell');
check('nothing at all is empty, not undefined', G.productOf({ item: 'Boots' }), '');
check('and no row at all is empty too', G.productOf(null), '');
check('a save keeps the product', G.cleanGearSizes([{ item: 'Jacket', product: '  109322  ' }]),
  [{ item: 'Jacket', product: '109322', size: '', note: '' }]);
check('the product is capped like everything else',
  G.cleanGearSizes([{ item: 'Jacket', product: 'x'.repeat(200) }])[0].product.length, G.LIMITS.product);

T.head('the sizes a row offers');
check('a product with its own list gives that list',
  G.sizesFor({ product: 'Wenaas Model 722 10 Bib and Brace' }), ['XL', '2XL']);
check('anything else takes the general suggestions',
  G.sizesFor({ product: '100293 288 FAS 100% Cotton Trousers' }), G.SIZE_SUGGESTIONS);
check('and so does a row with no product at all', G.sizesFor({ item: 'Boots' }), G.SIZE_SUGGESTIONS);

T.head('two of one garment');
const twoJackets = { crew_id: 'x', gear_sizes: [
  { item: 'Jacket', product: '109322 4857 KC 100% Cotton Jacket', size: 'M', note: '' },
  { item: 'Jacket', product: "MEN'S MIDWEIGHT FR ZIP-IN JACKET JEL2", size: 'L', note: '' }
] };
check('both survive a save, because they are different jackets',
  G.gearSizesFor(twoJackets).rows.map(r => r.size), ['M', 'L']);

process.exit(T.done() ? 0 : 1);
