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
//   { item: 'Trousers', size: '34x32', note: 'Fristads 100293 FAS, EU 52' }
//
// Rows are free text on purpose. A glove is M/L/XL, a boot is 11, trousers
// are waist x length AND a European size, and the warehouse orders gloves by
// model as well as size — no single vocabulary fits, so the lists below are
// suggestions, never a gate.
//
// ABSENT IS NOT EMPTY. A member with no `gear_sizes` key has never been
// asked: they are shown the default rows, filled from the order history when
// there is one. A member whose `gear_sizes` is [] removed every row on
// purpose, and that is what they see. So a removed row stays removed, and the
// seed below only ever speaks for someone who has not saved a size yet.
//
// THE SEED IS HERE, NOT IN crewconfig. The Console holds crewconfig in memory
// and writes the whole file back, so sizes written into the live file by a
// script are silently undone by the next Console save. Applied at read time
// instead, the history becomes stored data the first time either app saves
// the member, and needs no write at all until then.

(function (root) {
  // The rows a member starts with. Order is display order.
  var DEFAULT_ITEMS = [
    'Gloves', 'Boots', 'Trousers', 'Jacket', 'Shirt',
    'Sweatshirt', 'Coveralls', 'Rain Gear', 'Hat'
  ];

  // Offered in the size box; anything else can be typed.
  var SIZE_SUGGESTIONS = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', 'Liners'];

  var LIMITS = { item: 40, size: 24, note: 120 };

  // ── Order history ──────────────────────────────────────────────────────────
  // "Gear Order 2021.xlsx" (S:\...\Shipyard\Shipyard 2021\Gear), the engine
  // room's workwear order: eight people by first name only, matched to the
  // roster by name within the Engine department. "Johnny", 1st Assistant, is
  // John MacDonald (1st Engineer) — not John "Jack" Campbell, an Oiler.
  //
  // Read off the sheet, with three calls made:
  //   - Long- and short-sleeve T sizes agree for every person, so one Shirt.
  //   - Taylor's shirt tabs carry a second one-shirt row in S; the M row is
  //     the person's own (four and five shirts against one), the S a spare.
  //   - The jacket tab lists "Sam", Oiler, M: Sam Potchik, the Oiler on every
  //     other tab. "Sam K" is listed separately in L.
  // Gloves and boots were never on it; warehouse request forms order gloves
  // by the case, not by the person.
  var HISTORY_SOURCE = '2021 engine room gear order';
  var FAS   = 'Fristads 100293 FAS trousers, waist x length';
  var SHELL = 'Fristads 4906 GTT Airtech shell jacket';
  var TEE   = 'Hanes Beefy-T';
  var HOOD  = 'Carhartt Rain Defender quarter-zip';
  var CAP   = 'Carhartt 103056 cap';
  function order(trousers, eu, jacket, shirt, sweat) {
    return [
      { item: 'Trousers',   size: trousers,   note: FAS + ', EU ' + eu },
      { item: 'Jacket',     size: jacket,     note: SHELL },
      { item: 'Shirt',      size: shirt,      note: TEE },
      { item: 'Sweatshirt', size: sweat,      note: HOOD },
      { item: 'Hat',        size: 'Snapback', note: CAP }
    ];
  }
  var ORDER_HISTORY = {
    '4f9794de-1f86-4f96-b856-76743a435960': order('34x32', '52',  'XL',  'XL',  '2XL'), // Connor Stevens
    'ebe96985-441f-4904-9bea-650d66743211': order('32x32', '50',  'L',   'L',   'L'),   // Jeff Troberg
    'bbc7c12d-c8e3-483a-9faa-673206a7c92f': order('40x32', '56',  '2XL', '2XL', '2XL'), // John MacDonald
    '5f36b323-7680-40cb-b0d9-4b5d7b78c2a7': order('33x32', '52',  'L',   'L',   'L'),   // Logan Fogg
    '36ae745f-5b6e-4f8a-a2dd-44805e02a52c': order('32x30', 'D92', 'M',   'M',   'M'),   // Rolando Garcia
    '54f43271-926f-4fcb-a35f-4647e49aa04b': order('33x30', '52',  'L',   'L',   'L'),   // Sam Kulikowski
    'bb092596-1f7d-46f3-83d2-ea024a13287e': order('30x30', '46',  'M',   'M',   'S'),   // Sam Potchik
    '2fb9eb13-d02c-40f4-ab5d-a8077402a99f': order('32x32', '50',  'M',   'M',   'L')    // Taylor Ploch
  };

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
      out.push({ item: item, size: clip(r.size, LIMITS.size), note: clip(r.note, LIMITS.note) });
    }
    return out;
  }

  // What a screen shows. `seeded` is true when nothing is stored yet and the
  // rows came from the defaults (and the history, when `source` is set).
  function gearSizesFor(member) {
    var m = member || {};
    if (Array.isArray(m.gear_sizes)) {
      return { rows: cleanGearSizes(m.gear_sizes), seeded: false, source: null };
    }
    var history = (m.crew_id && ORDER_HISTORY[m.crew_id]) || null;
    var rows = DEFAULT_ITEMS.map(function (item) { return { item: item, size: '', note: '' }; });
    if (history) {
      history.forEach(function (h) {
        var hit = null;
        for (var i = 0; i < rows.length; i++) {
          if (rows[i].item.toLowerCase() === h.item.toLowerCase()) { hit = rows[i]; break; }
        }
        if (hit) { hit.size = h.size; hit.note = h.note; }
        else rows.push({ item: h.item, size: h.size, note: h.note });
      });
    }
    return { rows: rows, seeded: true, source: history ? HISTORY_SOURCE : null };
  }

  var api = {
    DEFAULT_ITEMS: DEFAULT_ITEMS,
    SIZE_SUGGESTIONS: SIZE_SUGGESTIONS,
    LIMITS: LIMITS,
    HISTORY_SOURCE: HISTORY_SOURCE,
    ORDER_HISTORY: ORDER_HISTORY,
    cleanGearSizes: cleanGearSizes,
    gearSizesFor: gearSizesFor
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.gearSizes = api;
})(typeof window !== 'undefined' ? window : this);
