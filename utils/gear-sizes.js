'use strict';
// ── Gear sizes: what each crew member wears ──────────────────────────────────
// CANONICAL COPY. Mirrored byte-identical at
//   IDMS-Console/src/renderer/js/gear-sizes.js
// Same convention as utils/oil-attach.js: change it here, then copy, then
// `node tools/test/run.js` (the console suite compares the two).
//
// The phone's My Profile and the Console's Crew List edit the same field,
// `crewconfig.crew[].gear_sizes`, an ordered list of rows:
//
//   { item: 'Trousers', size_us: '32x32', size_eu: 'C50',
//     note: 'Fristads 100293 FAS · 2026 order' }
//
// One row per garment, and the size in BOTH systems, because the ship buys in
// both: Fristads trousers are ordered as C50 or D96 and the same legs are
// 32x32 on any American label; a Carhartt bib is XL either way. Neither column
// can be derived from the other — 32x32 is C50 on one cut and C52 on another —
// so both are recorded and whichever the order form asks for is the one that
// gets used.
//
// Rows are free text on purpose. A glove is M/L/XL, a boot is 11, and a
// Fristads waist is C50 — no single vocabulary fits, so the lists below are
// suggestions, never a gate.
//
// ABSENT IS NOT EMPTY. A member with no `gear_sizes` key has never been
// asked and is shown the default rows, blank. A member whose `gear_sizes` is
// [] removed every row on purpose, and that is what they see.
//
// The engine room's sizes were filled into crewconfig from the gear order
// forms by IDMS-Console/tools/gear-sizes (newest order per item; see
// IDMS-Console/docs/gear-sizes.md). Nothing here seeds anyone.

(function (root) {
  // The rows a member starts with. Order is display order.
  var DEFAULT_ITEMS = [
    'Gloves', 'Boots', 'Trousers', 'Jacket', 'Shirt',
    'Hoodie', 'Coveralls', 'Bib Overalls', 'Rain Gear', 'Hat'
  ];

  // Offered in the two size boxes; anything else can be typed. The European
  // list is the Fristads run the ship's own orders use, C46 to C64 and the D
  // (short-leg) sizes beside them.
  var SIZE_SUGGESTIONS = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', 'Liners'];
  var SIZE_SUGGESTIONS_EU = ['C44', 'C46', 'C48', 'C50', 'C52', 'C54', 'C56', 'C58', 'C60',
                             'D88', 'D92', 'D96', 'D100', 'D104'];

  var LIMITS = { item: 40, size: 24, note: 120, product: 80 };

  // ── The catalogue: what can actually be ordered ────────────────────────────
  //
  // Read off "Araho - ENG - 2027 WW Order Form.xlsx", the engineers' annual
  // workwear form: one sheet per garment, and `product` is that sheet's own
  // Item string — the wording the form validates against, so an order written
  // here reads the way the form does.
  //
  // `item` files each product under one of DEFAULT_ITEMS, and that is what
  // makes the two screens agree: the Crew List holds one size per garment, and
  // a gear order picks the garment and then which of its products to buy —
  // "Jacket" offers the three jackets and no trousers, and the size comes off
  // that person's Jacket row.
  //
  // `maker` is not on the 2027 form for every line — it names Fristads, Wenaas
  // and Carhartt only. The rest is read off the article numbers and range
  // names as the earlier orders wrote them (Craftsman and Green Craftsman are
  // Fristads ranges; the 2018-2021 orders name Fristads for 100293 and
  // 109322). Two are left blank rather than guessed: nothing the ship holds
  // says who makes the De Luxe coverall or the FR zip-in jacket. Correct one
  // here and both screens follow.
  //
  // `sizes_in` is which column of the Crew List a product is ordered from:
  // Fristads runs in European sizes (C50, D96), Carhartt and the Wenaas bib in
  // American ones. The De Luxe coverall is left unset — nothing says which, and
  // an unset product takes whichever size that person has.
  //
  // `sizes` is only where the form carries its own list. Everything else takes
  // SIZE_SUGGESTIONS, because a Fristads trouser size is C50 or D96 and no
  // short list covers those.
  var GEAR_CATALOGUE = [
    { item: 'Trousers',     product: '100293 288 FAS 100% Cotton Trousers',
      maker: 'Fristads', article: '100293 288 FAS', sizes_in: 'EU' },
    { item: 'Trousers',     product: "100281 Women's Creaftsman Trousers 253K FAS",
      maker: 'Fristads', article: '100281 253K FAS', women: true, sizes_in: 'EU' },
    { item: 'Trousers',     product: "301223 Women's Green Craftsman Stretch Trousers 2901 GWM",
      maker: 'Fristads', article: '301223 2901 GWM', women: true, sizes_in: 'EU' },
    { item: 'Jacket',       product: '109322 4857 KC 100% Cotton Jacket',
      maker: 'Fristads', article: '109322 4857 KC', sizes_in: 'EU' },
    { item: 'Jacket',       product: "129529 - Women's Jacket 4556 STFP",
      maker: 'Fristads', article: '129529 4556 STFP', women: true, sizes_in: 'EU' },
    { item: 'Jacket',       product: "MEN'S MIDWEIGHT FR ZIP-IN JACKET JEL2",
      maker: null,       article: 'JEL2', sizes_in: 'US' },
    { item: 'Bib Overalls', product: 'Fristads 100812-896 Bib Overalls',
      maker: 'Fristads', article: '100812-896', sizes_in: 'EU' },
    { item: 'Bib Overalls', product: 'Wenaas Model 722 10 Bib and Brace',
      maker: 'Wenaas',   article: '722 10', sizes: ['XL', '2XL'], sizes_in: 'US' },
    { item: 'Bib Overalls', product: "GREEN CRAFTSMAN BIB'N'BRACE 41 GS25 ART. NO: 300978",
      maker: 'Fristads', article: '300978', sizes_in: 'EU' },
    { item: 'Bib Overalls', product: 'CARHARTT DUCK UNLINED BIB OVERALLS ART. NO: 102776',
      maker: 'Carhartt', article: '102776', sizes_in: 'US' },
    { item: 'Coveralls',    product: 'DE LUXE COVERALL ART. NO: 0-89870-125',
      maker: null,       article: '0-89870-125' }
  ];

  // The products filed under one garment, for the box that offers them.
  function catalogueFor(item) {
    var want = String(item == null ? '' : item).trim().toLowerCase();
    if (!want) return [];
    return GEAR_CATALOGUE.filter(function (p) { return p.item.toLowerCase() === want; });
  }

  // A product string back to its catalogue entry, so a row that names one
  // carries the maker and the article number without storing either twice.
  function catalogueProduct(product) {
    var want = String(product == null ? '' : product).trim().toLowerCase();
    if (!want) return null;
    for (var i = 0; i < GEAR_CATALOGUE.length; i++) {
      if (GEAR_CATALOGUE[i].product.toLowerCase() === want) return GEAR_CATALOGUE[i];
    }
    return null;
  }

  // The sizes to offer for a product: its own list where the order form
  // carries one, otherwise the general run for that system.
  function sizesFor(product, system) {
    var p = catalogueProduct(product);
    if (p && p.sizes) return p.sizes;
    return String(system).toUpperCase() === 'EU' ? SIZE_SUGGESTIONS_EU : SIZE_SUGGESTIONS;
  }

  // Which column a product is ordered in — `sizes_in` on the catalogue entry.
  // Unknown means take whichever the person has, preferring European, since
  // the two garments with no maker are both European cuts.
  function sizeForProduct(row, product) {
    var p = catalogueProduct(product);
    var us = String((row && row.size_us) || '').trim();
    var eu = String((row && row.size_eu) || '').trim();
    var want = p && p.sizes_in;
    if (want === 'US') return us || eu;
    if (want === 'EU') return eu || us;
    return eu || us;
  }

  function clip(v, n) {
    var s = (v == null ? '' : String(v)).replace(/\s+/g, ' ').trim();
    return s.length > n ? s.slice(0, n) : s;
  }

  // A size written before the two columns existed. The ship's own records make
  // this unambiguous: a Fristads size is C50, D96 or a bare 46-64, and nothing
  // else on the list is a number that big — a boot is 11 and a glove is XL.
  function splitLegacySize(size) {
    var s = String(size == null ? '' : size).trim();
    if (!s) return { size_us: '', size_eu: '' };
    if (/^[CD]\d{2,3}$/i.test(s)) return { size_us: '', size_eu: s.toUpperCase() };
    if (/^\d{2,3}$/.test(s) && Number(s) >= 40) return { size_us: '', size_eu: s };
    return { size_us: s, size_eu: '' };
  }

  // What a save writes. A row needs an item; both sizes and the note may be
  // blank (a blank Boots row is how "boot size still wanted" is recorded).
  function cleanGearSizes(rows) {
    if (!Array.isArray(rows)) return [];
    var out = [];
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i] || {};
      var item = clip(r.item, LIMITS.item);
      if (!item) continue;
      // `size` is the one-column shape this replaced; a record still carrying
      // it is read, not dropped, and is rewritten the first time it is saved.
      var legacy = (r.size_us == null && r.size_eu == null) ? splitLegacySize(r.size)
                                                           : { size_us: r.size_us, size_eu: r.size_eu };
      out.push({ item: item,
                 size_us: clip(legacy.size_us, LIMITS.size),
                 size_eu: clip(legacy.size_eu, LIMITS.size),
                 note: clip(r.note, LIMITS.note) });
    }
    return out;
  }

  // What a screen shows. `seeded` is true when nothing is stored yet and the
  // rows are the blank defaults.
  function gearSizesFor(member) {
    var m = member || {};
    if (Array.isArray(m.gear_sizes)) {
      return { rows: cleanGearSizes(m.gear_sizes), seeded: false };
    }
    var rows = DEFAULT_ITEMS.map(function (item) {
      return { item: item, size_us: '', size_eu: '', note: '' };
    });
    return { rows: rows, seeded: true };
  }

  // The row a garment's size lives on, for a gear order asking about it.
  function rowForItem(member, item) {
    var want = String(item == null ? '' : item).trim().toLowerCase();
    if (!want) return null;
    var rows = gearSizesFor(member).rows;
    for (var i = 0; i < rows.length; i++) {
      if (rows[i].item.toLowerCase() === want) return rows[i];
    }
    return null;
  }

  var api = {
    DEFAULT_ITEMS: DEFAULT_ITEMS,
    SIZE_SUGGESTIONS: SIZE_SUGGESTIONS,
    SIZE_SUGGESTIONS_EU: SIZE_SUGGESTIONS_EU,
    LIMITS: LIMITS,
    GEAR_CATALOGUE: GEAR_CATALOGUE,
    catalogueFor: catalogueFor,
    catalogueProduct: catalogueProduct,
    sizesFor: sizesFor,
    sizeForProduct: sizeForProduct,
    splitLegacySize: splitLegacySize,
    rowForItem: rowForItem,
    cleanGearSizes: cleanGearSizes,
    gearSizesFor: gearSizesFor
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.gearSizes = api;
})(typeof window !== 'undefined' ? window : this);
