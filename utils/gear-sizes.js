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
//   { item: 'Trousers', size: 'C50',
//     note: 'Fristads 100293 FAS · waist x length 32x32 · 2026 order' }
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
    'Sweatshirt', 'Coveralls', 'Rain Gear', 'Hat'
  ];

  // Offered in the size box; anything else can be typed.
  var SIZE_SUGGESTIONS = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', 'Liners'];

  var LIMITS = { item: 40, size: 24, note: 120 };

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
  // rows are the blank defaults.
  function gearSizesFor(member) {
    var m = member || {};
    if (Array.isArray(m.gear_sizes)) {
      return { rows: cleanGearSizes(m.gear_sizes), seeded: false };
    }
    var rows = DEFAULT_ITEMS.map(function (item) { return { item: item, size: '', note: '' }; });
    return { rows: rows, seeded: true };
  }

  var api = {
    DEFAULT_ITEMS: DEFAULT_ITEMS,
    SIZE_SUGGESTIONS: SIZE_SUGGESTIONS,
    LIMITS: LIMITS,
    cleanGearSizes: cleanGearSizes,
    gearSizesFor: gearSizesFor
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.gearSizes = api;
})(typeof window !== 'undefined' ? window : this);
