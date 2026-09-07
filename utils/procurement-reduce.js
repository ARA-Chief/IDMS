'use strict';
// ── Procurement & Inventory state derivation (IDMS-SCHEMA §42) ───────────────
// CANONICAL COPY. To be mirrored byte-identical at
//   IDMS-Console/src/renderer/js/procurement-reduce.js when the Console lane is
//   built — same convention as utils/crew-display.js and utils/notes-reduce.js.
//   Change it here first, then copy.
//
// Pure derivation of the procurement register from the append-only event
// stream. No DOM, no globals, no app context. Every quantity this module
// reports is computed here and nowhere else: §42.1 rule 1 says on-hand is never
// authored, so this file is the only place the arithmetic lives, and the only
// place it can go wrong.

(function (root) {

  // Deterministic replay order: the event *filename* is the sort key
  // (lex = chrono, per architecture.md), exactly as notes-reduce does. Events
  // not yet round-tripped through a filename fall back to the same compact
  // timestamp shape the filename is built from, so a locally-appended event
  // sorts exactly where its file will.
  function sortKey(ev) {
    if (ev._fn) return ev._fn;
    return String(ev.timestamp || '').replace(/[:.\-]/g, '') + '-' + (ev.event_id || '');
  }

  // Quantities are decimal (litres, metres, kilos), and JavaScript floats will
  // happily turn 0.1 + 0.2 into 0.30000000000000004 in a stock ledger. Every
  // running total is rounded to six places on the way out of an addition,
  // which is far finer than any unit aboard and coarse enough to keep the
  // arithmetic clean over thousands of movements.
  function q(n) {
    var v = Number(n);
    if (!isFinite(v)) return 0;
    return Math.round(v * 1e6) / 1e6;
  }

  // A positive magnitude. The whole point of §42.7 is that no writer ever
  // supplies a sign — `kind` and `direction` carry it — so a negative or
  // nonsense qty is coerced rather than silently inverting a movement.
  function mag(n) {
    return Math.abs(q(n));
  }

  var UNASSIGNED_LOCATION = 'unassigned';

  function locOf(v) {
    return (v === null || v === undefined || v === '') ? UNASSIGNED_LOCATION : String(v);
  }

  // ── Count sessions (§42.7a) ────────────────────────────────────────────────
  // A session is one space walked end to end on one date. The counts filed
  // under it are ordinary `count` movements carrying a `session_id` — the
  // arithmetic is untouched, and a spot correction is the same movement with
  // no session on it. What a session adds is the thing a movement cannot say:
  // which items were looked at and found *right*. Those move nothing, so they
  // leave no movement, and without the session they are indistinguishable from
  // the items nobody ever reached.
  function newCountSession(sessionId) {
    return {
      session_id: sessionId,
      location_id: null,
      scope: 'here',          // 'here' = this space only, 'deep' = it and everything under it
      status: 'open',         // open | closed | abandoned
      note: null,
      opened_at: null,
      opened_by: null,
      closed_at: null,
      closed_by: null,
      abandoned_reason: null,
      // What the sheet held when it was opened. Taken from the opening event
      // rather than recomputed: coverage is a claim about the sweep as it was
      // walked, and a later transfer into the space must not retrospectively
      // turn a complete count into a partial one.
      expected: 0,
      counts: [],             // movement rows filed under this session
      confirmed: []           // item_ids seen and found correct
    };
  }

  // ── Item shell ─────────────────────────────────────────────────────────────

  // ── The catalogue (§42.14) ─────────────────────────────────────────────────
  // TM Master is the system of record for the item master and the stowage
  // locations. The catalogue is a generated, read-only projection of it, and
  // this module treats it as a *baseline*: quantities as they stood when the
  // export was taken, with the vessel's own movements layered on top. Nothing
  // here ever writes back — an edit to a TM-owned field is recorded as a
  // proposal and applied by an officer in TM Master, never by this code.

  // Columnar, dictionary-encoded on the low-cardinality columns. Both the PWA
  // and the Console hydrate through this one function so neither has to know
  // the encoding.
  function hydrateCatalogue(doc) {
    if (!doc || !Array.isArray(doc.items)) return null;
    var tables = doc.tables || {};
    var idx = {};
    (doc.item_fields || []).forEach(function (f, i) { idx[f] = i; });
    var lidx = {};
    (doc.location_fields || []).forEach(function (f, i) { lidx[f] = i; });

    function val(row, field) {
      var i = idx[field];
      if (i === undefined) return null;
      var v = row[i];
      if (v === undefined) return null;
      if (tables[field]) return (v === null) ? null : (tables[field][v] || null);
      return v;
    }

    var locations = {};
    (doc.locations || []).forEach(function (row) {
      var code = row[lidx.code];
      if (code === null || code === undefined) return;
      locations[locCode(code)] = {
        location_id: locCode(code),
        name: row[lidx.path] || locCode(code),
        path: row[lidx.path] || '',
        deck: row[lidx.deck] || null,
        depth: row[lidx.depth] || 1,
        parent_id: (row[lidx.parent] === null || row[lidx.parent] === undefined)
          ? null : locCode(row[lidx.parent]),
        items_here: row[lidx.items_here] || 0,
        items_deep: row[lidx.items_including_sublocations] || 0,
        sublocations: row[lidx.sublocations] || 0
      };
    });

    var flagBits = doc.flag_bits || {};
    var items = {};
    doc.items.forEach(function (row) {
      var id = itemCode(row[idx.id]);
      var loc = val(row, 'loc');
      var flags = val(row, 'flags') || 0;
      items[id] = {
        item_id: id,
        name: val(row, 'name') || id,
        unit: val(row, 'uom') || 'ea',
        item_type: val(row, 'item_type'),
        item_category: val(row, 'item_category'),
        location_id: (loc === null) ? null : locCode(loc),
        in_stock: val(row, 'in_stock'),          // null means unknown, not zero
        on_order_tm: val(row, 'on_order') || 0,
        on_draft: val(row, 'on_draft') || 0,
        qty_in_use: val(row, 'qty_in_use') || 0,
        min_qty: val(row, 'min_qty'),
        max_qty: val(row, 'max_qty'),
        supplier: val(row, 'supplier'),
        suppliers_ref: val(row, 'suppliers_ref'),
        makers_part_no: val(row, 'makers_part_no'),
        stock_tag: val(row, 'stock_tag'),
        tm_item_no: val(row, 'tm_item_no'),
        est_delivery_days: val(row, 'est_delivery_days'),
        last_known_price: val(row, 'last_known_price'),
        currency: val(row, 'currency'),
        consumption: {
          2026: val(row, 'c2026') || 0,
          2025: val(row, 'c2025') || 0,
          2024: val(row, 'c2024') || 0
        },
        validated:      !!(flags & (flagBits.validated || 1)),
        blocked:        !!(flags & (flagBits.blocked || 2)),
        controlled:     !!(flags & (flagBits.controlled_goods || 4)),
        review_minmax:  !!(flags & (flagBits.review_minmax || 8)),
        critical:       !!(flags & (flagBits.has_critical_occurrences || 16))
      };
    });

    return {
      baseline_at: doc.baseline_at || null,
      generated: doc.generated || null,
      built_at: doc.built_at || null,
      items: items,
      locations: locations,
      counts: doc.counts || {}
    };
  }

  function pad(n, width) {
    var s = String(n);
    while (s.length < width) s = '0' + s;
    return s;
  }
  function itemCode(n) { return (typeof n === 'number') ? 'ITM-' + pad(n, 5) : String(n); }
  function locCode(n)  { return (typeof n === 'number') ? 'LOC-' + pad(n, 4) : String(n); }

  function newItem(itemId) {
    return {
      item_id: itemId,
      source: 'local',        // 'tm' once seeded from the catalogue
      name: '',
      unit: 'ea',
      notes: '',
      part_number: null,
      sfi_code: null,
      barcode: null,
      category_id: null,
      default_location_id: null,
      min_qty: null,
      max_qty: null,
      reorder_qty: null,
      suppliers: [],
      archived: false,
      archived_reason: null,
      created_at: null,
      created_by: null,
      updated_at: null,

      by_location: {},        // { location_id: qty }
      on_hand: 0,
      on_order: 0,            // filled in by the PO pass
      on_order_tm: 0,         // what TM Master already had on order at baseline
      requested: 0,           // filled in by the requisition pass
      movements: [],          // derived, in replay order
      last_movement_at: null,
      last_count_at: null,
      // Last time anybody laid eyes on it: a count, or a session that reached
      // it and found the book right. `last_count_at` only moves when a count
      // movement was filed, so on its own it cannot tell a shelf that has been
      // audited clean from one nobody has opened in a year.
      last_verified_at: null,

      // §42.14. IDMS keeps its own reorder policy over the mirror, because
      // 13,885 of the 14,487 items in TM Master carry no minimum at all and a
      // register that cannot be given one is a register nobody can act on.
      // These always win over the catalogue's values.
      policy: {},             // min_qty / max_qty / reorder_qty / sfi_code / barcode / notes
      // Edits to fields TM Master owns are recorded and shown, never applied.
      proposals: [],
      // Movements at or before the catalogue's baseline are already reflected
      // in its quantities. They stay in the ledger, marked, but move nothing.
      superseded_movements: 0
    };
  }

  // The value actually in force: IDMS policy first, then the TM mirror.
  function effective(item, field) {
    if (!item) return null;
    if (item.policy && item.policy[field] !== undefined && item.policy[field] !== null) {
      return item.policy[field];
    }
    var v = item[field];
    return (v === undefined) ? null : v;
  }

  // IDMS's own overlay on a mirrored item. Deliberately only the fields that
  // are policy rather than fact: what we choose to hold, and how this item
  // joins the rest of IDMS. Never a name, a supplier or a part number — those
  // are TM Master's to state.
  var POLICY_FIELDS = ['min_qty', 'max_qty', 'reorder_qty', 'sfi_code', 'barcode', 'notes'];

  // Sparse patch: an absent key means unchanged, an explicit null clears
  // (§42.4). `item_id` can never be patched.
  var ITEM_FIELDS = [
    'name', 'unit', 'notes', 'part_number', 'sfi_code', 'barcode',
    'category_id', 'default_location_id', 'min_qty', 'max_qty', 'reorder_qty',
    'suppliers'
  ];

  function applyItemFields(item, payload) {
    for (var i = 0; i < ITEM_FIELDS.length; i++) {
      var f = ITEM_FIELDS[i];
      if (Object.prototype.hasOwnProperty.call(payload, f)) item[f] = payload[f];
    }
    if (!Array.isArray(item.suppliers)) item.suppliers = [];
  }

  // ── Movements ──────────────────────────────────────────────────────────────

  // Applies one movement to an item and returns the derived movement row that
  // goes on `item.movements`. The row carries what the ledger view needs to
  // explain itself later — the signed delta it actually applied, and for a
  // count, the book quantity it corrected and by how much.
  function applyMovement(item, ev) {
    var p = ev.payload || {};
    var kind = p.kind;
    var from = locOf(p.location_id);
    var row = {
      movement_id: p.movement_id || ev.event_id,
      item_id: item.item_id,
      kind: kind,
      qty: mag(p.qty),
      location_id: from,
      to_location_id: p.to_location_id ? String(p.to_location_id) : null,
      direction: p.direction || null,
      counted_qty: null,
      book_qty: null,
      variance: null,
      delta: 0,
      po_id: p.po_id || null,
      po_line_id: p.po_line_id || null,
      session_id: p.session_id || null,
      task_id: p.task_id || null,
      equipment_code: p.equipment_code || null,
      unit_cost: (p.unit_cost === 0 || p.unit_cost) ? Number(p.unit_cost) : null,
      currency: p.currency || null,
      reason: p.reason || null,
      note: p.note || null,
      actor: ev.actor || null,
      timestamp: ev.timestamp || null
    };

    function at(loc) { return q(item.by_location[loc] || 0); }
    function set(loc, v) { item.by_location[loc] = q(v); }

    if (kind === 'receipt') {
      set(from, at(from) + row.qty);
      row.delta = row.qty;

    } else if (kind === 'issue') {
      set(from, at(from) - row.qty);
      row.delta = -row.qty;

    } else if (kind === 'adjustment') {
      // `direction` carries the only sign in the system. Anything that is not
      // an explicit decrease is an increase — a malformed adjustment must not
      // quietly remove stock.
      var down = (p.direction === 'decrease');
      set(from, at(from) + (down ? -row.qty : row.qty));
      row.delta = down ? -row.qty : row.qty;

    } else if (kind === 'transfer') {
      var to = locOf(p.to_location_id);
      row.to_location_id = to;
      if (to === from) {          // a transfer to where it already is moves nothing
        row.delta = 0;
      } else {
        set(from, at(from) - row.qty);
        set(to, at(to) + row.qty);
        row.delta = 0;            // net zero across the item; the halves are per-location
      }

    } else if (kind === 'count') {
      // A count is recorded as what was seen, and reduced to the correction it
      // implies — "counted 12, book said 15, −3" — so the ledger explains the
      // change rather than just showing it (§42.7).
      var counted = mag(p.counted_qty);
      var book = at(from);
      set(from, counted);
      row.counted_qty = counted;
      row.book_qty = book;
      row.variance = q(counted - book);
      row.delta = row.variance;
      item.last_count_at = ev.timestamp || item.last_count_at;
      item.last_verified_at = ev.timestamp || item.last_verified_at;

    } else {
      return null;              // unknown kind — recorded nowhere, changes nothing
    }

    item.on_hand = q(Object.keys(item.by_location).reduce(function (sum, k) {
      return sum + q(item.by_location[k]);
    }, 0));
    item.last_movement_at = ev.timestamp || item.last_movement_at;
    return row;
  }

  // ── Requisitions ───────────────────────────────────────────────────────────

  function normaliseReqLine(l, idx) {
    return {
      line_id: (l && l.line_id) || ('l' + idx),
      item_id: (l && l.item_id) || null,
      description: (l && l.description) || '',
      qty: mag(l && l.qty),
      unit: (l && l.unit) || null,
      notes: (l && l.notes) || '',
      decision: null,          // null | 'approved' | 'rejected'
      qty_approved: null,
      ordered_qty: 0,          // filled in by the PO pass
      received_qty: 0,         // filled in by the PO pass
      po_ids: []
    };
  }

  function newReq(reqId) {
    return {
      req_id: reqId,
      status: 'draft',         // draft | submitted | approved | rejected | ordered | closed | cancelled
      department: null,
      need_by: null,
      priority: null,
      justification: '',
      lines: [],
      decision_comment: null,
      cancel_reason: null,
      created_at: null,
      requested_by: null,
      submitted_at: null,
      decided_at: null,
      decided_by: null
    };
  }

  // ── Purchase orders ────────────────────────────────────────────────────────

  function normalisePoLine(l, idx) {
    return {
      line_id: (l && l.line_id) || ('l' + idx),
      item_id: (l && l.item_id) || null,
      description: (l && l.description) || '',
      qty_ordered: mag(l && l.qty_ordered),
      unit: (l && l.unit) || null,
      unit_price: (l && (l.unit_price === 0 || l.unit_price)) ? Number(l.unit_price) : null,
      req_line_id: (l && l.req_line_id) || null,
      req_id: (l && l.req_id) || null,
      cancelled: false,
      received_qty: 0,         // filled in by the receipt pass
      status: 'open'           // open | partial | received | over | cancelled
    };
  }

  function newPo(poId) {
    return {
      po_id: poId,
      po_number: null,
      supplier_id: null,
      currency: null,
      expected_date: null,
      notes: '',
      lines: [],
      status: 'draft',         // draft | sent | partial | received | cancelled | closed
      cancel_reason: null,
      close_reason: null,
      created_at: null,
      created_by: null,
      sent_at: null,
      sent_by: null,
      sent_via: null
    };
  }

  var PO_HEADER_FIELDS = ['po_number', 'supplier_id', 'currency', 'expected_date', 'notes'];
  var REQ_HEADER_FIELDS = ['department', 'need_by', 'priority', 'justification'];

  // ── Reduce ─────────────────────────────────────────────────────────────────

  // `catalogue` is the hydrated TM Master baseline (§42.14) and is optional —
  // without one the register is whatever the event stream authored, which is
  // how this ran before the vault register existed and how a fresh vessel with
  // no TM export would still work.
  function reduce(events, catalogue) {
    var ordered = (events || []).slice().sort(function (a, b) {
      var ka = sortKey(a), kb = sortKey(b);
      return ka < kb ? -1 : ka > kb ? 1 : 0;
    });

    var items = {}, reqs = {}, pos = {}, sessions = {};
    var baselineAt = (catalogue && catalogue.baseline_at) || null;

    // ── Seed from the catalogue ──────────────────────────────────────────────
    // Baseline quantities go straight into by_location at the item's default
    // stowage. An item with no stowage in the export holds its stock at the
    // reserved 'unassigned' location rather than nowhere — 2,864 items are in
    // that state, and their stock is real even though its address is not.
    if (catalogue && catalogue.items) {
      Object.keys(catalogue.items).forEach(function (id) {
        var c = catalogue.items[id];
        var it = newItem(id);
        it.source = 'tm';
        it.name = c.name;
        it.unit = c.unit;
        it.item_type = c.item_type;
        it.item_category = c.item_category;
        it.default_location_id = c.location_id;
        it.part_number = c.makers_part_no || c.suppliers_ref || null;
        it.min_qty = c.min_qty;
        it.max_qty = c.max_qty;
        it.stock_tag = c.stock_tag;
        it.tm_item_no = c.tm_item_no;
        it.est_delivery_days = c.est_delivery_days;
        it.last_known_price = c.last_known_price;
        it.currency = c.currency;
        it.consumption = c.consumption;
        it.qty_in_use = c.qty_in_use;
        it.on_draft = c.on_draft;
        it.validated = c.validated;
        it.blocked = c.blocked;
        it.controlled = c.controlled;
        it.review_minmax = c.review_minmax;
        it.critical = c.critical;
        it.on_order_tm = c.on_order_tm || 0;
        if (c.supplier) it.suppliers = [{ supplier_id: c.supplier, supplier_part_number: c.suppliers_ref || null }];

        // `in_stock: null` means the export did not say — 2,181 items. That is
        // not zero, and must not be shown or counted as zero.
        it.stock_unknown = (c.in_stock === null || c.in_stock === undefined);
        if (!it.stock_unknown) {
          it.by_location[c.location_id || UNASSIGNED_LOCATION] = q(c.in_stock);
          it.on_hand = q(c.in_stock);
        }
        items[id] = it;
      });
    }

    // Creations are applied before mutations, in their own stream order. Same
    // reasoning as notes-reduce: filenames carry each writing device's own UTC
    // clock, so a receipt can legitimately sort ahead of the item it belongs to
    // — two phones a few seconds apart, or a phone reconnecting after a spell
    // offline. A single pass would drop that movement forever.
    var mutations = [];
    for (var i = 0; i < ordered.length; i++) {
      var ev = ordered[i];
      if (!ev || !ev.event_type) continue;
      var p = ev.payload || {};

      if (ev.event_type === 'item_created') {
        if (!p.item_id) continue;
        // Never over an item the catalogue already supplied: TM Master states
        // what that item is, and a stale local create must not rewrite it.
        if (items[p.item_id] && items[p.item_id].source === 'tm') continue;
        var it = items[p.item_id] || (items[p.item_id] = newItem(p.item_id));
        applyItemFields(it, p);
        it.created_at = it.created_at || ev.timestamp || null;
        it.created_by = it.created_by || ev.actor || null;

      } else if (ev.event_type === 'requisition_created') {
        if (!p.req_id) continue;
        var rq = reqs[p.req_id] || (reqs[p.req_id] = newReq(p.req_id));
        for (var a = 0; a < REQ_HEADER_FIELDS.length; a++) {
          if (Object.prototype.hasOwnProperty.call(p, REQ_HEADER_FIELDS[a])) {
            rq[REQ_HEADER_FIELDS[a]] = p[REQ_HEADER_FIELDS[a]];
          }
        }
        rq.lines = (p.lines || []).map(normaliseReqLine);
        rq.created_at = rq.created_at || ev.timestamp || null;
        rq.requested_by = rq.requested_by || ev.actor || null;

      } else if (ev.event_type === 'po_created') {
        if (!p.po_id) continue;
        var po = pos[p.po_id] || (pos[p.po_id] = newPo(p.po_id));
        for (var b = 0; b < PO_HEADER_FIELDS.length; b++) {
          if (Object.prototype.hasOwnProperty.call(p, PO_HEADER_FIELDS[b])) {
            po[PO_HEADER_FIELDS[b]] = p[PO_HEADER_FIELDS[b]];
          }
        }
        po.lines = (p.lines || []).map(normalisePoLine);
        po.created_at = po.created_at || ev.timestamp || null;
        po.created_by = po.created_by || ev.actor || null;

      } else if (ev.event_type === 'count_session_opened') {
        if (!p.session_id) continue;
        // In the creation pass with the other three, and for the same reason:
        // the phone that opens a sheet and the phone that files a count into it
        // may be different phones with different clocks, and a count sorted
        // ahead of the session it belongs to must not lose its session.
        var cs = sessions[p.session_id] || (sessions[p.session_id] = newCountSession(p.session_id));
        cs.location_id = locOf(p.location_id);
        cs.scope = (p.scope === 'deep') ? 'deep' : 'here';
        cs.note = p.note || cs.note;
        cs.expected = Number(p.expected_items) || 0;
        cs.opened_at = cs.opened_at || ev.timestamp || null;
        cs.opened_by = cs.opened_by || ev.actor || null;

      } else {
        mutations.push(ev);
      }
    }

    for (var m = 0; m < mutations.length; m++) {
      var e = mutations[m];
      var pay = e.payload || {};
      var t = e.event_type;

      if (t === 'item_updated') {
        var target = items[pay.item_id];
        if (!target) continue;
        // A mirrored item's TM-owned fields are never rewritten here (§42.14).
        // An older stream may still carry item_updated against one; it is kept
        // as a proposal rather than silently discarded or silently applied.
        if (target.source === 'tm') {
          target.proposals.push({
            proposal_id: pay.proposal_id || e.event_id,
            fields: pay, reason: pay.reason || null,
            actor: e.actor || null, timestamp: e.timestamp || null,
            legacy: true
          });
          continue;
        }
        applyItemFields(target, pay);
        target.updated_at = e.timestamp || target.updated_at;

      } else if (t === 'item_policy_set') {
        // IDMS's own reorder policy over the mirror — a minimum, a maximum, an
        // SFI code, a barcode, a note. Sparse: an absent key is unchanged, an
        // explicit null clears back to whatever TM Master says.
        var pit = items[pay.item_id];
        if (!pit) continue;
        POLICY_FIELDS.forEach(function (f) {
          if (Object.prototype.hasOwnProperty.call(pay, f)) {
            if (pay[f] === null) delete pit.policy[f];
            else pit.policy[f] = pay[f];
          }
        });
        pit.policy_set_at = e.timestamp || null;
        pit.policy_set_by = e.actor || null;

      } else if (t === 'item_change_proposed') {
        // Fields TM Master owns. Recorded, shown on the item, never applied —
        // an officer makes the change in TM Master and the next export carries
        // it back. This is the ratified rule for TM writes, not a limitation
        // of this screen.
        var cit = items[pay.item_id];
        if (!cit) continue;
        cit.proposals.push({
          proposal_id: pay.proposal_id || e.event_id,
          fields: pay.fields || {}, reason: pay.reason || null,
          actor: e.actor || null, timestamp: e.timestamp || null
        });

      } else if (t === 'item_archived') {
        if (!items[pay.item_id]) continue;
        items[pay.item_id].archived = true;
        items[pay.item_id].archived_reason = pay.reason || null;

      } else if (t === 'item_unarchived') {
        if (!items[pay.item_id]) continue;
        items[pay.item_id].archived = false;
        items[pay.item_id].archived_reason = null;

      } else if (t === 'stock_movement') {
        // A movement against an item that never had a creation event is kept,
        // not dropped: the stock is real and the item record can be filled in
        // afterwards. This is what lets a receipt of something new be recorded
        // at the pallet and named later.
        var mi = items[pay.item_id];
        if (!mi && pay.item_id) {
          mi = items[pay.item_id] = newItem(pay.item_id);
          mi.name = pay.item_name || '';
          mi.orphan = true;
        }
        if (!mi) continue;
        // Movements at or before the catalogue's baseline are already inside
        // its quantities — TM Master had absorbed them by the time the export
        // was taken. They stay in the ledger so the history reads continuously,
        // but applying them again would double-count (§42.14).
        if (baselineAt && e.timestamp && String(e.timestamp) <= String(baselineAt)) {
          mi.superseded_movements++;
          mi.movements.push({
            movement_id: pay.movement_id || e.event_id,
            item_id: mi.item_id, kind: pay.kind, qty: mag(pay.qty),
            location_id: locOf(pay.location_id), to_location_id: pay.to_location_id || null,
            delta: 0, superseded: true,
            counted_qty: (pay.kind === 'count') ? mag(pay.counted_qty) : null,
            session_id: pay.session_id || null,
            po_id: pay.po_id || null, po_line_id: pay.po_line_id || null,
            reason: pay.reason || null, note: pay.note || null,
            actor: e.actor || null, timestamp: e.timestamp || null
          });
          continue;
        }
        var row = applyMovement(mi, e);
        if (row) mi.movements.push(row);

      } else if (t === 'count_session_closed') {
        var csc = sessions[pay.session_id];
        if (!csc || csc.status !== 'open') continue;
        csc.status = 'closed';
        csc.closed_at = e.timestamp || null;
        csc.closed_by = e.actor || null;
        if (pay.note) csc.note = pay.note;
        if (pay.expected_items !== undefined && pay.expected_items !== null) {
          csc.expected = Number(pay.expected_items) || 0;
        }
        // Every item the sweep reached and found right. They file no movement,
        // because nothing moved — this list is the only evidence they were
        // looked at, and it is the whole difference between "counted, correct"
        // and "never reached".
        (Array.isArray(pay.confirmed) ? pay.confirmed : []).forEach(function (iid) {
          if (csc.confirmed.indexOf(iid) === -1) csc.confirmed.push(iid);
          var ci = items[iid];
          if (ci) ci.last_verified_at = e.timestamp || ci.last_verified_at;
        });

      } else if (t === 'count_session_abandoned') {
        var csa = sessions[pay.session_id];
        if (!csa || csa.status !== 'open') continue;
        // The counts already filed under it stand. They corrected real shelves,
        // and a shelf does not become uncounted because the walk was cut short.
        // What is abandoned is only the claim that the space was swept.
        csa.status = 'abandoned';
        csa.closed_at = e.timestamp || null;
        csa.closed_by = e.actor || null;
        csa.abandoned_reason = pay.reason || null;

      } else if (t === 'requisition_updated') {
        var ru = reqs[pay.req_id];
        if (!ru) continue;
        for (var c = 0; c < REQ_HEADER_FIELDS.length; c++) {
          if (Object.prototype.hasOwnProperty.call(pay, REQ_HEADER_FIELDS[c])) {
            ru[REQ_HEADER_FIELDS[c]] = pay[REQ_HEADER_FIELDS[c]];
          }
        }
        // Lines are replaceable only while the requisition is still the
        // requester's own draft (§42.4) — once submitted, the lines are what
        // the approver is being asked about, and must not move under them.
        if (Array.isArray(pay.lines) && ru.status === 'draft') {
          ru.lines = pay.lines.map(normaliseReqLine);
        }

      } else if (t === 'requisition_submitted') {
        var rs = reqs[pay.req_id];
        if (!rs || rs.status !== 'draft') continue;
        rs.status = 'submitted';
        rs.submitted_at = e.timestamp || null;

      } else if (t === 'requisition_decided') {
        var rd = reqs[pay.req_id];
        if (!rd || (rd.status !== 'submitted' && rd.status !== 'approved')) continue;
        var headline = (pay.decision === 'rejected') ? 'rejected' : 'approved';
        var perLine = pay.line_decisions || null;
        rd.lines.forEach(function (l) {
          var d = perLine && perLine[l.line_id];
          if (d) {
            l.decision = (d.decision === 'rejected') ? 'rejected' : 'approved';
            l.qty_approved = (d.qty_approved === 0 || d.qty_approved)
              ? mag(d.qty_approved)
              : (l.decision === 'approved' ? l.qty : 0);
          } else {
            l.decision = headline;
            l.qty_approved = (headline === 'approved') ? l.qty : 0;
          }
        });
        // The header follows the lines, not the other way round: an "approved"
        // decision that rejected every line is a rejection.
        var anyApproved = rd.lines.some(function (l) { return l.decision === 'approved' && l.qty_approved > 0; });
        rd.status = anyApproved ? 'approved' : 'rejected';
        rd.decision_comment = pay.comment || null;
        rd.decided_at = e.timestamp || null;
        rd.decided_by = e.actor || null;

      } else if (t === 'requisition_cancelled') {
        var rc = reqs[pay.req_id];
        if (!rc || rc.status === 'closed') continue;
        rc.status = 'cancelled';
        rc.cancel_reason = pay.reason || null;

      } else if (t === 'po_updated') {
        var pu = pos[pay.po_id];
        if (!pu) continue;
        for (var d2 = 0; d2 < PO_HEADER_FIELDS.length; d2++) {
          if (Object.prototype.hasOwnProperty.call(pay, PO_HEADER_FIELDS[d2])) {
            pu[PO_HEADER_FIELDS[d2]] = pay[PO_HEADER_FIELDS[d2]];
          }
        }
        if (Array.isArray(pay.lines) && pu.status === 'draft') {
          pu.lines = pay.lines.map(normalisePoLine);
        } else if (Array.isArray(pay.lines)) {
          // Once an order is sent its quantities are frozen (§42.4) — but
          // naming *which* item a line refers to is a link, not a change to
          // what was ordered, so that one field is still accepted. This is the
          // path that fires when a free-text line is received and becomes a
          // real item: without it the stock would be right and the order line
          // would never point at it, so `on_order` would silently miss.
          var byId = {};
          pay.lines.forEach(function (l) { if (l && l.line_id) byId[l.line_id] = l; });
          pu.lines.forEach(function (l) {
            var incoming = byId[l.line_id];
            if (incoming && incoming.item_id && !l.item_id) l.item_id = incoming.item_id;
          });
        }

      } else if (t === 'po_sent') {
        var ps = pos[pay.po_id];
        if (!ps || ps.status !== 'draft') continue;
        ps.status = 'sent';
        ps.sent_at = pay.sent_at || e.timestamp || null;
        ps.sent_by = e.actor || null;
        ps.sent_via = pay.sent_via || null;

      } else if (t === 'po_cancelled') {
        var pc = pos[pay.po_id];
        if (!pc) continue;
        if (Array.isArray(pay.line_ids) && pay.line_ids.length) {
          pc.lines.forEach(function (l) {
            if (pay.line_ids.indexOf(l.line_id) !== -1) l.cancelled = true;
          });
        } else {
          pc.lines.forEach(function (l) { l.cancelled = true; });
          pc.status = 'cancelled';
          pc.cancel_reason = pay.reason || null;
        }

      } else if (t === 'po_closed') {
        var pcl = pos[pay.po_id];
        if (!pcl || pcl.status === 'cancelled') continue;
        pcl.status = 'closed';
        pcl.close_reason = pay.reason || null;
      }
    }

    // ── Receipt pass: PO line progress is derived, never stored (rule 2) ──────
    var poIndex = {};
    Object.keys(pos).forEach(function (id) {
      pos[id].lines.forEach(function (l) { poIndex[id + '::' + l.line_id] = l; });
    });

    Object.keys(items).forEach(function (id) {
      items[id].movements.forEach(function (mv) {
        if (mv.kind !== 'receipt' || !mv.po_id || !mv.po_line_id) return;
        var line = poIndex[mv.po_id + '::' + mv.po_line_id];
        if (line) line.received_qty = q(line.received_qty + mv.qty);
      });
    });

    Object.keys(pos).forEach(function (id) {
      var po = pos[id];
      po.lines.forEach(function (l) {
        if (l.cancelled) { l.status = 'cancelled'; return; }
        if (l.received_qty <= 0) l.status = 'open';
        else if (l.received_qty < l.qty_ordered) l.status = 'partial';
        else if (l.received_qty > l.qty_ordered) l.status = 'over';
        else l.status = 'received';
        l.outstanding_qty = Math.max(0, q(l.qty_ordered - l.received_qty));
      });
      if (po.status === 'sent' || po.status === 'partial' || po.status === 'received') {
        var live = po.lines.filter(function (l) { return !l.cancelled; });
        if (!live.length) {
          po.status = 'cancelled';
        } else if (live.every(function (l) { return l.status === 'received' || l.status === 'over'; })) {
          po.status = 'received';
        } else if (live.some(function (l) { return l.received_qty > 0; })) {
          po.status = 'partial';
        } else {
          po.status = 'sent';
        }
      }
    });

    // ── on_order: what an open order still owes us ────────────────────────────
    // Two sources, deliberately kept apart and then added: what TM Master had
    // outstanding when the export was taken, and what this module's own orders
    // still owe. Collapsing them would make it impossible to tell an order
    // raised here from one raised ashore.
    Object.keys(items).forEach(function (id) {
      items[id].on_order = q(items[id].on_order_tm || 0);
    });
    Object.keys(pos).forEach(function (id) {
      var po = pos[id];
      if (po.status !== 'sent' && po.status !== 'partial') return;
      po.lines.forEach(function (l) {
        if (l.cancelled || !l.item_id) return;
        var item = items[l.item_id];
        if (!item) return;
        item.on_order = q(item.on_order + Math.max(0, q(l.qty_ordered - l.received_qty)));
      });
    });

    // ── Requisition line coverage, and the derived ordered/closed statuses ────
    var reqLineIndex = {};
    Object.keys(reqs).forEach(function (id) {
      reqs[id].lines.forEach(function (l) { reqLineIndex[id + '::' + l.line_id] = l; });
    });

    Object.keys(pos).forEach(function (id) {
      var po = pos[id];
      if (po.status === 'cancelled') return;
      po.lines.forEach(function (l) {
        if (l.cancelled || !l.req_line_id) return;
        // A PO line may name its requisition explicitly; when it does not, the
        // line_id is searched for across requisitions. Explicit is cheaper and
        // unambiguous, so writers are expected to set req_id — this is the
        // tolerant fallback, not the intended path.
        var key = l.req_id ? (l.req_id + '::' + l.req_line_id) : null;
        var rl = key ? reqLineIndex[key] : null;
        if (!rl) {
          var found = Object.keys(reqLineIndex).filter(function (k) {
            return k.split('::')[1] === l.req_line_id;
          });
          if (found.length === 1) rl = reqLineIndex[found[0]];
        }
        if (!rl) return;
        rl.ordered_qty = q(rl.ordered_qty + l.qty_ordered);
        rl.received_qty = q(rl.received_qty + l.received_qty);
        if (rl.po_ids.indexOf(po.po_id) === -1) rl.po_ids.push(po.po_id);
      });
    });

    Object.keys(reqs).forEach(function (id) {
      var rq = reqs[id];
      if (rq.status !== 'approved') return;
      var approved = rq.lines.filter(function (l) { return l.decision === 'approved' && l.qty_approved > 0; });
      if (!approved.length) return;
      if (approved.every(function (l) { return l.received_qty >= l.qty_approved; })) rq.status = 'closed';
      else if (approved.every(function (l) { return l.ordered_qty >= l.qty_approved; })) rq.status = 'ordered';
    });

    // ── requested: approved but not yet on an order ───────────────────────────
    Object.keys(reqs).forEach(function (id) {
      var rq = reqs[id];
      if (rq.status !== 'approved' && rq.status !== 'ordered') return;
      rq.lines.forEach(function (l) {
        if (l.decision !== 'approved' || !l.item_id) return;
        var item = items[l.item_id];
        if (!item) return;
        item.requested = q(item.requested + Math.max(0, q(l.qty_approved - l.ordered_qty)));
      });
    });

    // ── Count sessions: fold the movements back onto the sweep ────────────────
    // The counts are already applied; this only gathers them, so a session can
    // be read as one sheet. Nothing here changes a quantity.
    Object.keys(items).forEach(function (id) {
      items[id].movements.forEach(function (mv) {
        if (!mv.session_id) return;
        var s = sessions[mv.session_id];
        if (s) s.counts.push(mv);
      });
    });

    Object.keys(sessions).forEach(function (sid) {
      var s = sessions[sid];
      s.counts.sort(function (a, b) {
        var ka = String(a.timestamp || ''), kb = String(b.timestamp || '');
        return ka < kb ? -1 : ka > kb ? 1 : 0;
      });
      // A count that found the book right is not a variance. A sweep of forty
      // items with three wrong is a good sweep, and it should not read as three
      // items' worth of work.
      s.variances = s.counts.filter(function (m) { return q(m.variance) !== 0; });
      s.variance_count = s.variances.length;
      s.items_counted = s.counts.length;
      s.items_confirmed = s.confirmed.length;
      // An item both counted and confirmed is one item, not two — the operator
      // ticked it and then thought better of it.
      var seen = {};
      s.counts.forEach(function (m) { seen[m.item_id] = true; });
      s.confirmed.forEach(function (iid) { seen[iid] = true; });
      s.items_seen = Object.keys(seen).length;
      s.net_delta = s.counts.reduce(function (t, m) { return q(t + q(m.delta)); }, 0);
      s.coverage = s.expected > 0 ? Math.min(1, s.items_seen / s.expected) : null;
    });

    return { items: items, requisitions: reqs, purchase_orders: pos,
             count_sessions: sessions };
  }

  // ── Views over the derived state ───────────────────────────────────────────

  // Every location at or under `locationId`, itself first. The tree is 664
  // nodes four deep, so this walks rather than indexes.
  function locationsUnder(catalogue, locationId) {
    var out = [locationId];
    var locs = (catalogue && catalogue.locations) || null;
    if (!locs) return out;
    var frontier = [locationId];
    while (frontier.length) {
      var next = [];
      Object.keys(locs).forEach(function (k) {
        if (frontier.indexOf(locs[k].parent_id) === -1) return;
        if (out.indexOf(k) !== -1) return;      // a cycle in the export must not hang the screen
        out.push(k);
        next.push(k);
      });
      frontier = next;
    }
    return out;
  }

  // The count sheet for one space: what a person standing in front of it should
  // be asked about. Two things belong on it and they are not the same thing —
  // stock the book says is *here now*, and items whose *home* is here even
  // though the book says none are left. The second is the more useful half of
  // an audit: a bin the book has emptied is exactly where a miscount hides.
  //
  // Defined here rather than in either screen because the Console and the PWA
  // must ask the same question of the same shelf, and a sheet that differs by
  // device is a sheet nobody can sign.
  function locationSheet(state, catalogue, locationId, opts) {
    opts = opts || {};
    var ids = (opts.scope === 'deep')
      ? locationsUnder(catalogue, locationId)
      : [locationId];
    var wanted = {};
    ids.forEach(function (id) { wanted[id] = true; });

    var rows = [];
    var items = (state && state.items) || {};
    Object.keys(items).forEach(function (id) {
      var it = items[id];
      if (it.archived && !opts.include_archived) return;

      var here = 0, placed = 0, at = null;
      Object.keys(it.by_location || {}).forEach(function (loc) {
        if (!wanted[loc]) return;
        here = q(here + q(it.by_location[loc]));
        placed++;
        at = loc;
      });
      var homeLoc = locOf(it.default_location_id);
      var home = wanted[homeLoc] === true;
      if (!placed && !home) return;

      rows.push({
        item_id: it.item_id,
        name: it.name || it.item_id,
        unit: it.unit || 'ea',
        part_number: it.part_number || null,
        // The book figure for THIS space, not the item's total. Counting a bin
        // against a shipwide total is how a count sheet destroys good stock.
        book_qty: here,
        on_hand: it.on_hand,
        // 2,181 items carry no stock figure at all. Unknown is not zero, and a
        // sheet that prints 0 invites somebody to agree with it.
        stock_unknown: !!it.stock_unknown && !placed,
        is_home: home,
        home_location_id: home ? homeLoc : null,
        // Which space inside the sheet the book figure actually came from, when
        // there is exactly one. A deep sheet summing three bins has no single
        // answer, and a count filed against the wrong bin is worse than none —
        // so this is null there, and the screen offers no box.
        count_location_id: (placed === 1) ? at : (placed === 0 && home ? homeLoc : null),
        elsewhere: q(q(it.on_hand) - here),
        min_qty: effective(it, 'min_qty'),
        critical: !!it.critical,
        last_count_at: it.last_count_at || null,
        last_verified_at: it.last_verified_at || null
      });
    });

    rows.sort(function (a, b) {
      return String(a.name).localeCompare(String(b.name));
    });
    return rows;
  }

  // When each space was last swept, and how it went. Keyed by location, latest
  // closed session wins — an abandoned one is not a sweep and does not count.
  function lastVerified(state) {
    var out = {};
    var sessions = (state && state.count_sessions) || {};
    Object.keys(sessions).forEach(function (sid) {
      var s = sessions[sid];
      if (s.status !== 'closed' || !s.location_id) return;
      var prev = out[s.location_id];
      if (prev && String(prev.closed_at || '') >= String(s.closed_at || '')) return;
      out[s.location_id] = {
        session_id: s.session_id, closed_at: s.closed_at, closed_by: s.closed_by,
        scope: s.scope, items_seen: s.items_seen, expected: s.expected,
        variance_count: s.variance_count, net_delta: s.net_delta, coverage: s.coverage
      };
    });
    return out;
  }


  // §42.10. What is already on order counts — the failure this whole module
  // exists to prevent is ordering a part a second time because nobody could
  // see the first order was on its way.
  function isLow(item) {
    if (!item || item.archived) return false;
    // 2,181 items carry no stock figure in the export. Unknown is not zero, and
    // reporting them all as short would bury the ones that really are.
    if (item.stock_unknown) return false;
    var min = effective(item, 'min_qty');
    if (min === null || min === undefined || min === '') return false;
    return q(item.on_hand + item.on_order) < Number(min);
  }

  function suggestedOrderQty(item) {
    if (!item) return 0;
    var have = q(item.on_hand + item.on_order);
    var max = effective(item, 'max_qty');
    var reorder = effective(item, 'reorder_qty');
    var min = effective(item, 'min_qty');
    if (max !== null && max !== undefined && max !== '') {
      return Math.max(0, q(Number(max) - have));
    }
    if (reorder) return mag(reorder);
    if (min !== null && min !== undefined && min !== '') {
      return Math.max(0, q(Number(min) - have));
    }
    return 0;
  }

  // §42.10 exceptions — the one screen of things that need a person. Each entry
  // is { kind, severity, item_id?/po_id?/req_id?, location_id?, label, detail }.
  //
  // The taxonomy lives in config, which this file deliberately does not read
  // (§42.5), so a caller that knows the storeroom names passes `opts.locName`
  // to have them appear in the text. Without it the location id is shown, which
  // is still true — just less friendly.
  function exceptions(state, opts) {
    opts = opts || {};
    var now = opts.now ? new Date(opts.now) : new Date();
    var staleDays = opts.stale_days || 14;
    var locName = opts.locName || function (id) { return id; };
    var out = [];

    function lineLabel(l) {
      if (l.item_id && state.items && state.items[l.item_id] && state.items[l.item_id].name) {
        return state.items[l.item_id].name;
      }
      return l.description || l.item_id || l.line_id;
    }

    Object.keys(state.items || {}).forEach(function (id) {
      var item = state.items[id];
      if (item.archived) return;

      Object.keys(item.by_location).forEach(function (loc) {
        if (q(item.by_location[loc]) < 0) {
          out.push({
            kind: 'negative_stock', severity: 'high', item_id: id, location_id: loc,
            label: item.name || id,
            detail: 'Negative on hand at ' + locName(loc) + ' (' + item.by_location[loc] +
                    '). The book is wrong — count it.'
          });
        }
      });

      if (isLow(item) && item.on_order <= 0) {
        out.push({
          kind: 'below_minimum', severity: 'medium', item_id: id,
          label: item.name || id,
          detail: item.on_hand + ' on hand against a minimum of ' + effective(item, 'min_qty') +
                  ', nothing on order.'
        });
      }
    });

    Object.keys(state.purchase_orders || {}).forEach(function (id) {
      var po = state.purchase_orders[id];
      if (po.status !== 'sent' && po.status !== 'partial') return;

      po.lines.forEach(function (l) {
        if (l.status === 'over') {
          out.push({
            kind: 'over_receipt', severity: 'low', po_id: id,
            label: (po.po_number || id) + ' · ' + lineLabel(l),
            detail: 'Received ' + l.received_qty + ' against ' + l.qty_ordered + ' ordered.'
          });
        }
      });

      if (po.expected_date) {
        var due = new Date(po.expected_date);
        if (!isNaN(due.getTime()) && due < now && po.lines.some(function (l) {
          return !l.cancelled && l.outstanding_qty > 0;
        })) {
          out.push({
            kind: 'overdue_order', severity: 'medium', po_id: id,
            label: po.po_number || id,
            detail: 'Expected ' + String(po.expected_date).slice(0, 10) + ', still outstanding.'
          });
        }
      }
    });

    var staleMs = staleDays * 86400000;
    Object.keys(state.requisitions || {}).forEach(function (id) {
      var rq = state.requisitions[id];
      if (rq.status !== 'approved' || !rq.decided_at) return;
      var age = now.getTime() - new Date(rq.decided_at).getTime();
      if (!isFinite(age) || age < staleMs) return;
      var uncovered = rq.lines.filter(function (l) {
        return l.decision === 'approved' && l.ordered_qty < l.qty_approved;
      });
      if (!uncovered.length) return;
      out.push({
        kind: 'approved_not_ordered', severity: 'medium', req_id: id,
        label: 'Requisition ' + String(id).slice(0, 8),
        detail: uncovered.length + ' approved line(s) still not on an order after '
              + Math.floor(age / 86400000) + ' days.'
      });
    });

    // `high` ranks 0, so this cannot be an `|| 3` default — that would sort the
    // most urgent exceptions to the bottom.
    var rank = { high: 0, medium: 1, low: 2 };
    function rankOf(s) { return Object.prototype.hasOwnProperty.call(rank, s) ? rank[s] : 3; }
    out.sort(function (a, b) { return rankOf(a.severity) - rankOf(b.severity); });
    return out;
  }

  var api = {
    reduce: reduce,
    hydrateCatalogue: hydrateCatalogue,
    effective: effective,
    itemCode: itemCode,
    locCode: locCode,
    POLICY_FIELDS: POLICY_FIELDS,
    isLow: isLow,
    suggestedOrderQty: suggestedOrderQty,
    exceptions: exceptions,
    UNASSIGNED_LOCATION: UNASSIGNED_LOCATION,
    locationSheet: locationSheet,
    locationsUnder: locationsUnder,
    lastVerified: lastVerified,
    _q: q
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.procurementReduce = api;
})(typeof window !== 'undefined' ? window : this);
