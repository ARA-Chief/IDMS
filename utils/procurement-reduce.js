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

  // ── Item shell ─────────────────────────────────────────────────────────────

  function newItem(itemId) {
    return {
      item_id: itemId,
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
      requested: 0,           // filled in by the requisition pass
      movements: [],          // derived, in replay order
      last_movement_at: null,
      last_count_at: null
    };
  }

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

  function reduce(events) {
    var ordered = (events || []).slice().sort(function (a, b) {
      var ka = sortKey(a), kb = sortKey(b);
      return ka < kb ? -1 : ka > kb ? 1 : 0;
    });

    var items = {}, reqs = {}, pos = {};

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
        applyItemFields(target, pay);
        target.updated_at = e.timestamp || target.updated_at;

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
        var row = applyMovement(mi, e);
        if (row) mi.movements.push(row);

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

    return { items: items, requisitions: reqs, purchase_orders: pos };
  }

  // ── Views over the derived state ───────────────────────────────────────────

  // §42.10. What is already on order counts — the failure this whole module
  // exists to prevent is ordering a part a second time because nobody could
  // see the first order was on its way.
  function isLow(item) {
    if (!item || item.archived) return false;
    if (item.min_qty === null || item.min_qty === undefined || item.min_qty === '') return false;
    return q(item.on_hand + item.on_order) < Number(item.min_qty);
  }

  function suggestedOrderQty(item) {
    if (!item) return 0;
    var have = q(item.on_hand + item.on_order);
    if (item.max_qty !== null && item.max_qty !== undefined && item.max_qty !== '') {
      return Math.max(0, q(Number(item.max_qty) - have));
    }
    if (item.reorder_qty) return mag(item.reorder_qty);
    if (item.min_qty !== null && item.min_qty !== undefined && item.min_qty !== '') {
      return Math.max(0, q(Number(item.min_qty) - have));
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
          detail: item.on_hand + ' on hand against a minimum of ' + item.min_qty + ', nothing on order.'
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
    isLow: isLow,
    suggestedOrderQty: suggestedOrderQty,
    exceptions: exceptions,
    UNASSIGNED_LOCATION: UNASSIGNED_LOCATION,
    _q: q
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.procurementReduce = api;
})(typeof window !== 'undefined' ? window : this);
