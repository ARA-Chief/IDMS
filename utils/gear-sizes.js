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
//   { item: 'Trousers', product: '100293 288 FAS 100% Cotton Trousers',
//     size: 'C50', note: 'waist x length 32x32 · 2026 order' }
//
// `item` is the garment — one of DEFAULT_ITEMS — and `product` is which one of
// them, from GEAR_CATALOGUE below. Both, because somebody can carry two
// jackets in different sizes: "Jacket" says what it is and the product says
// which, so a gear order asking for a jacket can offer that person's jackets
// and take the size that belongs to the one chosen.
//
// Rows are free text on purpose. A glove is M/L/XL, a boot is 11, trousers
// are waist x length AND a European size, and the warehouse orders gloves by
// model as well as size — no single vocabulary fits, so the lists below are
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
    'Sweatshirt', 'Coveralls', 'Bib Overalls', 'Rain Gear', 'Hat'
  ];

  // Offered in the size box; anything else can be typed.
  var SIZE_SUGGESTIONS = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', 'Liners'];

  var LIMITS = { item: 40, size: 24, note: 120, product: 80 };

  // ── The catalogue: what can actually be ordered ────────────────────────────
  //
  // Read off "Araho - ENG - 2027 WW Order Form.xlsx", the engineers' annual
  // workwear form: one sheet per garment, and `product` is that sheet's own
  // Item string — the wording the form validates against, so an order written
  // here reads the way the form does.
  //
  // `item` files each product under one of DEFAULT_ITEMS, and that is what
  // makes the two screens agree: a size on the Crew List is recorded against a
  // product, and picking "Jacket" on a gear order offers that person's jackets
  // and no trousers.
  //
  // `maker` is not on the 2027 form for every line — it names Fristads, Wenaas
  // and Carhartt only. The rest is read off the article numbers and range
  // names as the earlier orders wrote them (Craftsman and Green Craftsman are
  // Fristads ranges; the 2018-2021 orders name Fristads for 100293 and
  // 109322). Two are left blank rather than guessed: nothing the ship holds
  // says who makes the De Luxe coverall or the FR zip-in jacket. Correct one
  // here and both screens follow.
  //
  // `sizes` is only where the form carries its own list. Everything else takes
  // SIZE_SUGGESTIONS, because a Fristads trouser size is C50 or D96 and no
  // short list covers those.
  var GEAR_CATALOGUE = [
    { item: 'Trousers',     product: '100293 288 FAS 100% Cotton Trousers',
      maker: 'Fristads', article: '100293 288 FAS' },
    { item: 'Trousers',     product: "100281 Women's Creaftsman Trousers 253K FAS",
      maker: 'Fristads', article: '100281 253K FAS', women: true },
    { item: 'Trousers',     product: "301223 Women's Green Craftsman Stretch Trousers 2901 GWM",
      maker: 'Fristads', article: '301223 2901 GWM', women: true },
    { item: 'Jacket',       product: '109322 4857 KC 100% Cotton Jacket',
      maker: 'Fristads', article: '109322 4857 KC' },
    { item: 'Jacket',       product: "129529 - Women's Jacket 4556 STFP",
      maker: 'Fristads', article: '129529 4556 STFP', women: true },
    { item: 'Jacket',       product: "MEN'S MIDWEIGHT FR ZIP-IN JACKET JEL2",
      maker: null,       article: 'JEL2' },
    { item: 'Bib Overalls', product: 'Fristads 100812-896 Bib Overalls',
      maker: 'Fristads', article: '100812-896' },
    { item: 'Bib Overalls', product: 'Wenaas Model 722 10 Bib and Brace',
      maker: 'Wenaas',   article: '722 10', sizes: ['XL', '2XL'] },
    { item: 'Bib Overalls', product: "GREEN CRAFTSMAN BIB'N'BRACE 41 GS25 ART. NO: 300978",
      maker: 'Fristads', article: '300978' },
    { item: 'Bib Overalls', product: 'CARHARTT DUCK UNLINED BIB OVERALLS ART. NO: 102776',
      maker: 'Carhartt', article: '102776' },
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

  // What this row is an order for. `product` is the field; rows written before
  // it carry the thing in their note instead — "Carhartt Rain Defender
  // softshell · 2025 order" — where everything before the first separator is
  // the product and the rest says how old the size is.
  function productOf(row) {
    if (!row) return '';
    var p = String(row.product == null ? '' : row.product).trim();
    if (p) return p;
    return String(row.note == null ? '' : row.note).split('·')[0].trim();
  }

  // The sizes to offer for a row: the product's own list where it has one.
  function sizesFor(row) {
    var p = catalogueProduct(productOf(row));
    return (p && p.sizes) ? p.sizes : SIZE_SUGGESTIONS;
  }

  function clip(v, n) {
    var s = (v == null ? '' : String(v)).replace(/\s+/g, ' ').trim();
    return s.length > n ? s.slice(0, n) : s;
  }

  // What a save writes. A row needs an item; size and note may be blank (a
  // blank Boots row is how "boot size still wanted" is recorded).
  function cleanGearSizes(rows) {
    if (!Array.isArray(rows)) return [];
    var out = [];
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i] || {};
      var item = clip(r.item, LIMITS.item);
      if (!item) continue;
      out.push({ item: item, product: clip(r.product, LIMITS.product),
                 size: clip(r.size, LIMITS.size), note: clip(r.note, LIMITS.note) });
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
      return { item: item, product: '', size: '', note: '' };
    });
    return { rows: rows, seeded: true };
  }

  var api = {
    DEFAULT_ITEMS: DEFAULT_ITEMS,
    SIZE_SUGGESTIONS: SIZE_SUGGESTIONS,
    LIMITS: LIMITS,
    GEAR_CATALOGUE: GEAR_CATALOGUE,
    catalogueFor: catalogueFor,
    catalogueProduct: catalogueProduct,
    productOf: productOf,
    sizesFor: sizesFor,
    cleanGearSizes: cleanGearSizes,
    gearSizesFor: gearSizesFor
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.gearSizes = api;
})(typeof window !== 'undefined' ? window : this);
