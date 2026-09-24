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
check('with no sizes in either system',
  g.rows.every(r => r.size_us === '' && r.size_eu === '' && r.note === ''), true);
check('flagged as not yet saved', g.seeded, true);
check('no member at all is the same', G.gearSizesFor(null).rows.length, G.DEFAULT_ITEMS.length);
check('the defaults are fresh objects each time',
  G.gearSizesFor({}).rows[0] !== G.gearSizesFor({}).rows[0], true);

T.head('once saved, the stored list wins');
g = G.gearSizesFor({ gear_sizes: [{ item: 'Boots', size_us: '11', size_eu: '' }] });
check('exactly what was saved — no defaults added', g.rows,
  [{ item: 'Boots', size_us: '11', size_eu: '', note: '' }]);
check('not flagged as seeded', g.seeded, false);
check('removing every row is kept, not re-defaulted', G.gearSizesFor({ gear_sizes: [] }).rows, []);

T.head('what a save writes');
check('a row without an item is dropped', G.cleanGearSizes([{ item: '  ', size: 'L' }, { item: 'Hat' }]),
  [{ item: 'Hat', size_us: '', size_eu: '', note: '' }]);
check('whitespace collapsed and trimmed',
  G.cleanGearSizes([{ item: ' Rain  Gear ', size_us: ' XL ', note: ' Grundens\n bib ' }]),
  [{ item: 'Rain Gear', size_us: 'XL', size_eu: '', note: 'Grundens bib' }]);
check('two rows for one item are both kept (two glove models)',
  G.cleanGearSizes([{ item: 'Gloves', size_us: 'L', note: '620' },
                    { item: 'Gloves', size_us: 'XL', note: '451' }]).length, 2);
check('lengths are capped', G.cleanGearSizes([{ item: 'x'.repeat(99) }])[0].item.length, G.LIMITS.item);
check('non-arrays save as empty', G.cleanGearSizes(undefined), []);
const saved = [{ item: 'Trousers', size_us: '32x32', size_eu: 'C50',
                note: 'Fristads 100293 FAS · 2026 order' }];
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

T.head('a size written before the two columns existed');
check('a Fristads size is European', G.splitLegacySize('C50'), { size_us: '', size_eu: 'C50' });
check('and so is the short-leg run', G.splitLegacySize('D96'), { size_us: '', size_eu: 'D96' });
check('a bare number that big is European too — the older forms wrote them that way',
  G.splitLegacySize('56'), { size_us: '', size_eu: '56' });
check('a boot size is not', G.splitLegacySize('11'), { size_us: '11', size_eu: '' });
check('nor is a letter', G.splitLegacySize('XL'), { size_us: 'XL', size_eu: '' });
check('nor a waist by length', G.splitLegacySize('32x32'), { size_us: '32x32', size_eu: '' });
check('nothing stays nothing', G.splitLegacySize(''), { size_us: '', size_eu: '' });
check('a record still in the one-column shape is read, not dropped',
  G.cleanGearSizes([{ item: 'Trousers', size: 'C50' }]),
  [{ item: 'Trousers', size_us: '', size_eu: 'C50', note: '' }]);

T.head('which size an article is ordered in');
const both = { size_us: 'XL', size_eu: 'C56' };
check('a Fristads article takes the European one',
  G.sizeForProduct(both, '100293 288 FAS 100% Cotton Trousers'), 'C56');
check('a Carhartt article takes the American one',
  G.sizeForProduct(both, 'CARHARTT DUCK UNLINED BIB OVERALLS ART. NO: 102776'), 'XL');
check('and so does the Wenaas bib, which the form lists as XL/2XL',
  G.sizeForProduct(both, 'Wenaas Model 722 10 Bib and Brace'), 'XL');
check('an article nobody has said takes whichever is there, European first',
  G.sizeForProduct(both, 'DE LUXE COVERALL ART. NO: 0-89870-125'), 'C56');
check('a Fristads article for somebody with only an American size still answers',
  G.sizeForProduct({ size_us: 'L', size_eu: '' }, '109322 4857 KC 100% Cotton Jacket'), 'L');
check('nothing recorded is nothing, not undefined',
  G.sizeForProduct({ size_us: '', size_eu: '' }, '109322 4857 KC 100% Cotton Jacket'), '');
check('and no row at all is empty too', G.sizeForProduct(null, '109322 4857 KC'), '');

T.head('the garment a gear order asks about');
const member = { gear_sizes: [
  { item: 'Trousers', size_us: '32x32', size_eu: 'C50', note: '' },
  { item: 'Jacket', size_us: 'L', size_eu: '', note: '' }
] };
check('finds the row by garment', G.rowForItem(member, 'Jacket').size_us, 'L');
check('ignoring case, because the box is typed into', G.rowForItem(member, 'trousers').size_eu, 'C50');
check('a garment they have no row for is null', G.rowForItem(member, 'Boots'), null);
check('and so is asking for nothing', G.rowForItem(member, ''), null);

T.head('the sizes a box offers');
check('an article with its own list gives that list',
  G.sizesFor('Wenaas Model 722 10 Bib and Brace'), ['XL', '2XL']);
check('a European article takes the Fristads run',
  G.sizesFor('100293 288 FAS 100% Cotton Trousers', 'EU'), G.SIZE_SUGGESTIONS_EU);
check('an American one takes the letters', G.sizesFor('', 'US'), G.SIZE_SUGGESTIONS);

T.head('two rows for one garment');
const twoJackets = { crew_id: 'x', gear_sizes: [
  { item: 'Jacket', size_us: 'M', size_eu: '', note: 'the cotton one' },
  { item: 'Jacket', size_us: 'L', size_eu: '', note: 'the FR one' }
] };
check('both survive a save', G.gearSizesFor(twoJackets).rows.map(r => r.size_us), ['M', 'L']);
check('and a gear order asking for a jacket takes the first',
  G.rowForItem(twoJackets, 'Jacket').size_us, 'M');

process.exit(T.done() ? 0 : 1);
