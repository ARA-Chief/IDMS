'use strict';

// Searching the stock — Inventory › Stock, on both surfaces (IDMS-SCHEMA §42.7a).
//
// Canonical here, mirrored byte-identical to
// IDMS-Console/src/renderer/js/stock-search.js, and checked by
// tools/test/console-derive.test.js. Edit this copy, then copy the FILE across
// (never retype it — both repos are autocrlf and a hand-made mirror fails the
// byte check).
//
// The Console's Stock screen grew a search that the phone did not have: one box
// that looks through every item on the ship, in the register's own grammar
// (proc-query.js — words ANDed, OR / NOT / brackets, "a phrase", * and ?
// wildcards, maker: pn: supplier: and the rest), and hands back rows a count
// can be typed straight into. The phone could only find a *space* by name and
// filter a sheet by substring. Somebody holding a box with a Parker number on
// it could find it at the desk and not in front of the shelf, which is the one
// place the question is actually asked.
//
// So the parts of that search that decide *what is found* live here, and both
// screens call them — the same rule the sheet itself follows
// (procurementReduce.locationSheet). A search that finds different lines on
// different devices is a search nobody can trust to say "we have none". What
// stays on each screen is only how the answer is laid out: a grid beside a
// tree on the Console, a stacked list on a 375px phone.
//
// UMD, like its neighbours: the Console and the phone load it as a script, and
// the PWA's test suite requires it in Node. It reads procQuery and
// procurementReduce at call time rather than at load, so the order the <script>
// tags happen to be in cannot matter.

(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory(function () { return require('./proc-query.js'); },
                             function () { return require('./procurement-reduce.js'); });
  } else {
    root.stockSearch = factory(function () { return root.procQuery; },
                               function () { return root.procurementReduce; });
  }
}(typeof self !== 'undefined' ? self : this, function (getQuery, getReduce) {

  // ── The two spaces with no node in the stowage tree ────────────────────────
  // The reducer parks addressless stock at 'unassigned' (TM Master calls it
  // Unlocalized Stock) and gathers names carrying *BLOCK* into 'discontinued'.
  // Nothing about either can be read off a location record, so everything that
  // has to name them names them here.
  var UNPLACED = 'unassigned';
  var DISCONTINUED = 'discontinued';

  // A big space is a real space: Fwd Shop holds 583 items and Unlocalized Stock
  // thousands. A sheet is capped and says so, never silently truncated, and the
  // cap is well above any shelf a person actually walks.
  var SHEET_CAP = 400;

  function isReserved(id) { return id === UNPLACED || id === DISCONTINUED; }

  function reservedName(id) {
    return id === UNPLACED ? 'Unlocalized Stock'
         : id === DISCONTINUED ? 'Discontinued Stock' : null;
  }

  // ── The columns a line is searched by ──────────────────────────────────────
  //
  // A bare word looks in the six columns a person reads a part by. `pn:` is
  // either part number, because nobody holding a box knows whose number is on
  // it. One grammar on purpose — somebody who has learned `belt* -green` in
  // Requisitions should not have to learn a second dialect to find the belt.
  var FIELDS = {
    name:           { get: function (r) { return r.name; },           type: 'text', search: true, label: 'Item',
                      aliases: ['item', 'desc', 'description'] },
    item_id:        { get: function (r) { return r.item_id; },        type: 'text', search: true, label: 'Item no.',
                      aliases: ['no', 'id', 'itm', 'number'] },
    maker:          { get: function (r) { return r.maker; },          type: 'text', search: true, label: 'Maker',
                      aliases: ['mfr', 'manufacturer', 'make'] },
    makers_part_no: { get: function (r) { return r.makers_part_no; }, type: 'text', search: true, label: "Maker's P/N",
                      aliases: ['mpn', 'makerpn', 'makerspn'] },
    supplier:       { get: function (r) { return r.supplier; },       type: 'text', search: true, label: 'Supplier',
                      aliases: ['sup', 'vendor'] },
    suppliers_ref:  { get: function (r) { return r.suppliers_ref; },  type: 'text', search: true, label: "Supplier's P/N",
                      aliases: ['spn', 'supref', 'supplierpn'] },
    pn:             { get: function (r) { return [r.makers_part_no, r.suppliers_ref]; }, type: 'text',
                      aliases: ['part', 'partno', 'part_number'] },
    space:          { get: function (r) { return r.space; },          type: 'text', aliases: ['loc', 'location', 'where'] },
    unit:           { get: function (r) { return r.unit; },           type: 'text' },
    book:           { get: function (r) { return r.book_qty; },       type: 'num',  aliases: ['qty', 'stock'] },
    critical:       { get: function (r) { return r.critical; },       type: 'bool', aliases: ['crit'] },
    blocked:        { get: function (r) { return r.blocked; },        type: 'bool' }
  };

  // What the box's tooltip says. Kept beside the table it describes.
  var HELP = 'Words are ANDed · OR · NOT or -word · ( ) · "a phrase" · * any run, ? one character ' +
    '(a wildcard anchors: belt* starts with belt) · maker: mpn: supplier: spn: pn: no: name: space: · ' +
    'book>0 · critical:yes · blocked:yes';

  var _grammar = null;
  function grammar() {
    if (!_grammar) _grammar = getQuery().grammar(FIELDS);
    return _grammar;
  }

  // ── The rows ───────────────────────────────────────────────────────────────

  // Who makes it and who sells it, and what each of them calls it, joined onto
  // rows locationSheet made — or shipSheet below. They are on the item already
  // (the register's order lines needed them first, procurement-registry §14.5a);
  // they are joined on here rather than added to locationSheet, which the vault
  // exporter also reads and has no use for them.
  //
  // `part_number` stays on the row as the maker's-or-supplier's fallback,
  // because a printed sheet has one column to put a number in.
  function enrich(rows, state, locs) {
    if (!rows) return rows;
    var items = (state && state.items) || {};
    locs = locs || {};
    rows.forEach(function (r) {
      var it = items[r.item_id] || {};
      var sup = (it.suppliers && it.suppliers[0]) || {};
      r.maker = it.maker || null;
      r.makers_part_no = it.makers_part_no || null;
      r.supplier = sup.supplier_id || null;
      r.suppliers_ref = it.suppliers_ref || sup.supplier_part_number || null;
      // Blocked in TM Master: on the row itself, not only in the detail, so
      // nobody counts or moves it having never opened it to find out.
      r.blocked = !!it.blocked;
      var at = r.stowed_at || r.count_location_id || r.home_location_id;
      r.at = at || null;
      // What a row is called by its count box, its tick and its busy flag. On a
      // space's own sheet an item is there once and its number will do. In a
      // search of the ship the same item is a row in every space it is stowed
      // in, and a count typed against one must not land in the other's box.
      r.key = r.ship ? r.item_id + '@' + (at || '') : r.item_id;
      r.space = at ? (reservedName(at) || (locs[at] && locs[at].path) || at) : null;
    });
    return rows;
  }

  // Every sheet on the ship as one list — what the search looks through when no
  // space is picked.
  //
  // One row per item PER SPACE it is stowed in: the union of every space's own
  // 'this space only' sheet. Not built from the decks' deep sheets, because a
  // deep row is a sum across bins and a sum has no space a count can be filed
  // against. Here every row has exactly one, so every row can carry a count
  // box — a search of the ship is a sheet you can work from, not only a finder.
  //
  // The row shape is locationSheet's, field for field, so a screen draws and
  // counts it without knowing which of the two made it. Discontinued lines are
  // in it, flagged: the question is "where is this thing", and "nowhere" is the
  // wrong answer for a part that is on a shelf.
  function shipSheet(state, locs) {
    if (!state) return null;
    var R = getReduce();
    var q = R._q;
    var out = [];
    Object.keys(state.items).forEach(function (id) {
      var it = state.items[id];
      if (it.archived) return;
      var home = it.default_location_id || UNPLACED;
      var placed = Object.keys(it.by_location || {});
      var at = placed.slice();
      if (at.indexOf(home) === -1) at.push(home);
      at.forEach(function (loc) {
        var has = placed.indexOf(loc) !== -1;
        var here = has ? q(it.by_location[loc]) : 0;
        out.push({
          ship: true,
          item_id: it.item_id,
          name: it.name || it.item_id,
          unit: it.unit || 'ea',
          part_number: it.part_number || null,
          book_qty: here,
          on_hand: it.on_hand,
          stock_unknown: !!it.stock_unknown && !has,
          is_home: loc === home,
          home_location_id: loc === home ? home : null,
          count_location_id: loc,
          stowed_at: null,
          discontinued: R.isDiscontinued(it.name),
          elsewhere: q(q(it.on_hand) - here),
          min_qty: R.effective(it, 'min_qty'),
          critical: !!it.critical,
          last_count_at: it.last_count_at || null,
          last_verified_at: it.last_verified_at || null
        });
      });
    });
    out.sort(function (a, b) { return String(a.name).localeCompare(String(b.name)); });
    return enrich(out, state, locs);
  }

  // An audit open on a space, whoever opened it and on whichever device. A count
  // typed from a search while somebody is walking that space is part of that
  // walk; leaving it out would show the item as not yet seen on their sheet.
  // Two open on one space is a mistake somebody will make — the later is the
  // walk actually happening.
  function openSessionAt(state, locationId) {
    var all = (state && state.count_sessions) || {};
    var live = null;
    Object.keys(all).forEach(function (sid) {
      var c = all[sid];
      if (c.status !== 'open' || c.location_id !== locationId) return;
      if (!live || String(c.opened_at || '') > String(live.opened_at || '')) live = c;
    });
    return live;
  }

  // Rows gathered under the space they belong to.
  //
  // A sheet that spans more than one bin — 'including sublocations', the
  // discontinued sheet, a search of the ship — is a list of shelves, not a list
  // of items. Drawn flat it gives the person walking it no way to tell where
  // one shelf ends and the next begins. Rows split across bins go last, under
  // their own heading: they need a decision rather than a number.
  function groups(rows, grouped, locs, labelOf) {
    if (!grouped) return [{ key: null, label: null, path: null, rows: rows }];
    locs = locs || {};
    var by = {};
    rows.forEach(function (r) {
      // stowed_at is set only on the discontinued sheet, where the row's own
      // address is the context the space itself no longer supplies.
      var k = r.stowed_at || r.count_location_id || r.home_location_id || '__split';
      (by[k] || (by[k] = [])).push(r);
    });
    return Object.keys(by).map(function (k) {
      var l = locs[k];
      return {
        key: k,
        label: k === '__split' ? 'Split across more than one space'
             : (reservedName(k) || (labelOf ? labelOf(l) : '') || (l && l.path) || k),
        path: l ? l.path : null,
        rows: by[k].slice().sort(function (a, b) { return String(a.name).localeCompare(String(b.name)); })
      };
    }).sort(function (a, b) {
      if ((a.key === '__split') !== (b.key === '__split')) return a.key === '__split' ? 1 : -1;
      return String(a.path || a.label).localeCompare(String(b.path || b.label));
    });
  }

  // ── Filtering ──────────────────────────────────────────────────────────────

  // The term being typed at the end of the box: where it starts, a leading -/!,
  // the field if one was named, and the letters so far.
  function fragment(v) {
    var start = 0, inQuote = null;
    for (var i = 0; i < v.length; i++) {
      var c = v[i];
      if (inQuote) {
        if (c === '\\') i++;
        else if (c === inQuote) inQuote = null;
        continue;
      }
      if (c === '"') { inQuote = c; continue; }
      if (/[\s()|&]/.test(c)) start = i + 1;
    }
    var tok = v.slice(start), neg = '';
    if (/^[-!]/.test(tok)) { neg = tok[0]; tok = tok.slice(1); }
    var field = null, fieldText = '';
    var m = /^([A-Za-z_]+)([:=])(.*)$/.exec(tok);
    if (m && grammar().resolveField(m[1])) {
      field = grammar().resolveField(m[1]);
      fieldText = m[1] + m[2];
      tok = m[3];
    }
    return { start: start, neg: neg, field: field, fieldText: fieldText,
             frag: tok.replace(/^"/, '').replace(/\\(.)/g, '$1') };
  }

  // A query that does not parse is still a search. Half this ship's item names
  // end in an inch mark — `Stair Tread, 30"` — and to the grammar that is an
  // unclosed quote. So what cannot be read as a query is looked for as the
  // plain text it probably is, and `error` says which of the two happened.
  function filter(rows, q) {
    q = String(q || '').trim();
    if (!q) return { shown: rows, error: null };
    var g = grammar();
    var p = g.tryParse(q);
    if (p.ok) return { shown: rows.filter(function (r) { return g.matches(p.ast, r); }), error: null };

    // The last term is often simply not finished — `conv* OR supplier:` is on
    // its way to being a query, and emptying the list until the value arrives
    // would make the completions look like they had found nothing. So the term
    // still being typed is left out until it can be read. Only for a term
    // missing its other half: an unclosed quote is more often an inch mark.
    var head = q.slice(0, fragment(q).start).replace(/(\s|\b(or|and|not)\b|[|&!-])+$/i, '').trim();
    if (head !== q && /^Nothing after/.test(p.error)) {
      var ph = head ? g.tryParse(head) : { ok: true, ast: { k: 'all' } };
      if (ph.ok) {
        return { shown: rows.filter(function (r) { return g.matches(ph.ast, r); }),
                 error: null, partial: true };
      }
    }

    var needle = q.toLowerCase();
    return {
      shown: rows.filter(function (r) {
        return g.SEARCHABLE.some(function (k) {
          return String(FIELDS[k].get(r) || '').toLowerCase().indexOf(needle) !== -1;
        });
      }),
      error: p.error
    };
  }

  // Whether what is typed is plain words — no field, no operator, no quote. A
  // screen that also matches the query against space names only does so then:
  // `maker:parker` is a question about items, not about a locker called that.
  function isPlain(q) {
    q = String(q || '').trim();
    return !!q && !/[:"()|&*?<>=]/.test(q) && !/(^|\s)[-!]/.test(q) &&
      !/\b(OR|AND|NOT)\b/.test(q);
  }

  // ── Completing what is being typed ─────────────────────────────────────────
  //
  // The word under the caret is completed, not the box: a query is several
  // terms and the ones already typed are finished. The offers come off the rows
  // in scope, so a space only ever suggests what is in it.

  // A value as the grammar will read it back: bare when it is one plain word,
  // quoted — with its own quotes escaped — when it is not.
  function quote(v) {
    v = String(v);
    if (/^[A-Za-z0-9_.\/#+][A-Za-z0-9_.\/#+-]*$/.test(v) && !/^(or|and|not)$/i.test(v)) return v;
    return '"' + v.replace(/(["\\])/g, '\\$1') + '"';
  }

  // Every distinct value of every searchable column in these rows. Worth
  // holding between keystrokes — screens cache it beside the rows it came from.
  function vocab(rows) {
    var g = grammar();
    var out = [], seen = {};
    g.SEARCHABLE.forEach(function (k) {
      (rows || []).forEach(function (r) {
        var val = FIELDS[k].get(r);
        if (val === null || val === undefined || val === '') return;
        var key = k + '|' + String(val).toLowerCase();
        if (seen[key]) return;
        seen[key] = true;
        out.push({ field: k, value: String(val), low: String(val).toLowerCase() });
      });
    });
    return out;
  }

  // Up to nine completions for the term being typed. `inSpace` lowers the bar
  // to one letter: a shelf is short enough that one letter is a suggestion,
  // and fourteen thousand items is not.
  function suggest(v, voc, opts) {
    var fr = fragment(v);
    var frag = fr.frag.toLowerCase();
    // A named column is different: `supplier:` with nothing after it is
    // somebody asking what there is to choose from.
    if (frag.length < (fr.field ? 0 : (opts && opts.inSpace) ? 1 : 2)) return [];
    var out = [];

    // A field name, when none has been named yet: `mak` offers `maker:`.
    if (!fr.field) {
      Object.keys(FIELDS).forEach(function (k) {
        var names = [k].concat(FIELDS[k].aliases || []);
        if (names.some(function (n) { return n.indexOf(frag) === 0; })) {
          out.push({ score: -1, kind: 'field', label: 'search one column', show: k + ':',
                     text: fr.neg + k + ':', more: true });
        }
      });
    }

    var wordStart = new RegExp('(^|[^a-z0-9])' + frag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    (voc || []).forEach(function (c) {
      if (fr.field && fr.field !== 'pn' && c.field !== fr.field) return;
      if (fr.field === 'pn' && c.field !== 'makers_part_no' && c.field !== 'suppliers_ref') return;
      var at = c.low.indexOf(frag);
      if (at === -1) return;
      var score = at === 0 ? 0 : wordStart.test(c.low) ? 1 : 2;
      // A maker or a supplier is put back as maker:… — picked off a list that
      // said "Maker", it should find that maker, not every item naming it.
      var named = fr.field ? fr.fieldText
        : (c.field === 'maker' || c.field === 'supplier') ? c.field + ':' : '';
      out.push({ score: score, kind: c.field, label: FIELDS[c.field].label, show: c.value,
                 text: fr.neg + named + quote(c.value) + ' ', len: c.value.length });
    });

    out.sort(function (a, b) {
      return a.score - b.score || (a.len || 0) - (b.len || 0) ||
        String(a.show).localeCompare(String(b.show));
    });
    var top = out.slice(0, 9);
    top.forEach(function (o) { o.full = v.slice(0, fr.start) + o.text; o.frag = fr.frag; });
    return top;
  }

  return {
    UNPLACED: UNPLACED,
    DISCONTINUED: DISCONTINUED,
    SHEET_CAP: SHEET_CAP,
    FIELDS: FIELDS,
    HELP: HELP,
    isReserved: isReserved,
    reservedName: reservedName,
    grammar: grammar,
    enrich: enrich,
    shipSheet: shipSheet,
    openSessionAt: openSessionAt,
    groups: groups,
    fragment: fragment,
    filter: filter,
    isPlain: isPlain,
    quote: quote,
    vocab: vocab,
    suggest: suggest
  };
}));
