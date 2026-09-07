'use strict';
// ── Contact book derivation (IDMS-SCHEMA §42.16) ─────────────────────────────
//
// Pure derivation of the contact book from the TM Master baseline plus the
// contact events in the procurement stream. No DOM, no globals, no app context —
// same discipline as procurement-reduce.js beside it, and deliberately a
// separate file: that one is mirrored byte-identical from the IDMS repo, and
// growing it here would break the mirror on the next copy.
//
// The rule this file exists to hold, in one place:
//
//   TM Master's contact export is a *baseline*, not the truth. A contact edited
//   aboard keeps that edit when a fresh export lands, because the edit is an
//   event replayed over the new baseline rather than a write into it. What TM
//   knows and nobody aboard has touched comes from TM; what somebody aboard
//   changed stays changed, per field, until they change it back.
//
// Order history is not reduced here. It comes off the order register, which no
// event can alter — you cannot edit an order in the Console, only in TM.

(function (root) {

  // Same replay order as every other lane: the event filename is the sort key,
  // with a fallback for an event appended locally and not yet round-tripped
  // through a file, so it sorts exactly where its file will.
  function sortKey(ev) {
    if (ev._fn) return ev._fn;
    return String(ev.timestamp || '').replace(/[:.\-]/g, '') + '-' + (ev.event_id || '');
  }

  // Every field a person can change from the Console. Anything outside this
  // list is the baseline's or the register's, and an event cannot touch it —
  // which is what stops a stale client from writing an order count.
  var EDITABLE = ['name', 'country', 'email', 'phone', 'fax', 'web', 'remarks', 'tags',
    'currency', 'payment_terms', 'delivery_terms', 'ecommerce_id', 'qa_year', 'qa_status',
    'qa_grade', 'qa_experience', 'risk', 'criticality', 'trade_agreement',
    'trade_agreement_date', 'trade_agreement_expires', 'ncr', 'validated', 'blocked'];

  var FLAGS = { trade_agreement: 1, ncr: 1, validated: 1, blocked: 1 };

  function norm(field, v) {
    if (FLAGS[field]) return (v === true || v === 1 || v === '1') ? 1 : 0;
    if (v === undefined || v === null || v === '') return null;
    return String(v).trim() || null;
  }

  // Undo the seed's columnar dictionary encoding. The vault exporter has the
  // same three lines; both read one file and must read it one way.
  function decode(doc, fieldsKey, rowsKey) {
    if (!doc || !Array.isArray(doc[rowsKey])) return [];
    var fields = doc[fieldsKey] || [];
    var tables = doc.tables || {};
    return doc[rowsKey].map(function (row) {
      var o = {};
      for (var i = 0; i < fields.length; i++) {
        var f = fields[i], v = row[i];
        if (v !== null && v !== undefined && tables[f]) o[f] = (tables[f][v] === undefined ? null : tables[f][v]);
        else o[f] = (v === undefined ? null : v);
      }
      return o;
    });
  }

  function hydrateContacts(doc) {
    if (!doc) return null;
    var list = decode(doc, 'contact_fields', 'contacts');
    var recent = doc.recent || {};
    var byId = {};
    list.forEach(function (c) {
      c.recent = recent[c.contact_id] || [];
      c.archived = 0;
      byId[c.contact_id] = c;
    });
    return { generated: doc.generated || null, source: doc.source || null,
             contacts: byId, order: list.map(function (c) { return c.contact_id; }),
             counts: doc.counts || {} };
  }

  function hydrateOrders(doc) {
    if (!doc) return null;
    var list = decode(doc, 'order_fields', 'orders');
    return { generated: doc.generated || null, source: doc.source || null,
             covers: doc.covers || null, baseline_at: doc.baseline_at || null,
             orders: list, counts: doc.counts || {} };
  }

  // A locally-added contact needs an id that cannot collide with the seed's
  // CON-#### (which is assigned by sort position and shifts on every re-seed).
  // A separate prefix keeps the two numbering schemes from ever meeting.
  function newContactId() {
    var t = Date.now().toString(36).toUpperCase();
    var r = Math.floor(Math.random() * 1296).toString(36).toUpperCase();
    return 'CONX-' + t + '-' + (r.length < 2 ? '0' + r : r);
  }

  function reduce(events, baseline) {
    var contacts = {};
    var order = [];
    if (baseline && baseline.contacts) {
      for (var i = 0; i < baseline.order.length; i++) {
        var id = baseline.order[i];
        var src = baseline.contacts[id];
        var copy = {};
        for (var k in src) copy[k] = src[k];
        contacts[id] = copy;
        order.push(id);
      }
    }

    var ordered = (events || []).slice().sort(function (a, b) {
      var ka = sortKey(a), kb = sortKey(b);
      return ka < kb ? -1 : ka > kb ? 1 : 0;
    });

    // Creations first, in their own pass, for the reason procurement-reduce
    // gives at length: two devices with their own clocks can legitimately file
    // an update ahead of the create it belongs to, and a single pass drops it.
    var mutations = [];
    for (var e = 0; e < ordered.length; e++) {
      var ev = ordered[e];
      if (!ev || !ev.event_type) continue;
      if (String(ev.event_type).slice(0, 8) !== 'contact_') continue;
      var p = ev.payload || {};
      if (!p.contact_id) continue;

      if (ev.event_type === 'contact_created') {
        // Never over a contact the baseline supplied. A stale create replaying
        // onto a fresh export must not blank out what TM now knows.
        if (contacts[p.contact_id]) continue;
        var c = { contact_id: p.contact_id, source: 'idms', archived: 0,
                  order_count: 0, order_spend: 0, first_order: null, last_order: null,
                  recent: [], created_at: ev.timestamp || null, created_by: ev.actor || null };
        for (var f = 0; f < EDITABLE.length; f++) c[EDITABLE[f]] = norm(EDITABLE[f], p[EDITABLE[f]]);
        contacts[p.contact_id] = c;
        order.push(p.contact_id);
      } else {
        mutations.push(ev);
      }
    }

    for (var m = 0; m < mutations.length; m++) {
      var mv = mutations[m];
      var pay = mv.payload || {};
      var t = contacts[pay.contact_id];
      if (!t) continue;

      if (mv.event_type === 'contact_updated') {
        // Field by field, last write wins, and only the fields the event
        // actually carries. A client that knows fewer fields than the one that
        // wrote before it cannot blank the ones it has never heard of.
        for (var g = 0; g < EDITABLE.length; g++) {
          var fld = EDITABLE[g];
          if (Object.prototype.hasOwnProperty.call(pay, fld)) t[fld] = norm(fld, pay[fld]);
        }
        t.updated_at = mv.timestamp || t.updated_at || null;
        t.updated_by = mv.actor || t.updated_by || null;

      } else if (mv.event_type === 'contact_archived') {
        // Retiring a supplier does not unhappen the orders that went to it, so
        // the contact is flagged, never removed: the order register still
        // points here, and a card that vanishes takes that history's other end
        // with it. §42.16 rule 3.
        t.archived = 1;
        t.archive_reason = pay.reason || null;
        t.updated_at = mv.timestamp || t.updated_at || null;
        t.updated_by = mv.actor || t.updated_by || null;

      } else if (mv.event_type === 'contact_restored') {
        t.archived = 0;
        t.archive_reason = null;
        t.updated_at = mv.timestamp || t.updated_at || null;
        t.updated_by = mv.actor || t.updated_by || null;
      }
    }

    return { contacts: contacts, order: order };
  }

  // Fold the order register onto the reduced contacts: how many, how much, when
  // first, when last — and the newest order's number and description, which is
  // the "last referenced, and for what" a card leads with.
  //
  // The register's supplier_id was resolved once, by the seed, from the two
  // exports together. Re-resolving it here from the supplier text would be a
  // second matching rule that could disagree with the vault's, so this only
  // ever reads the id the seed decided on.
  function attachOrderHistory(state, orderRegister) {
    var byId = state.contacts;
    for (var id in byId) {
      byId[id].order_count = 0; byId[id].order_spend = 0;
      byId[id].first_order = null; byId[id].last_order = null;
      byId[id].last_order_id = null; byId[id].last_order_no = null;
      byId[id].last_order_for = null;
    }
    if (!orderRegister || !orderRegister.orders) return state;

    for (var i = 0; i < orderRegister.orders.length; i++) {
      var o = orderRegister.orders[i];
      var c = o.supplier_id ? byId[o.supplier_id] : null;
      if (!c) continue;
      c.order_count++;
      c.order_spend = Math.round((c.order_spend + (Number(o.total_price) || 0)) * 100) / 100;
      var d = o.last_approved || o.approved_date || o.invoice_date || null;
      if (d) {
        if (!c.first_order || d < c.first_order) c.first_order = d;
        if (!c.last_order  || d > c.last_order) {
          c.last_order = d;
          c.last_order_id = o.order_id;
          c.last_order_no = o.order_no;
          c.last_order_for = o.name;
        }
      } else if (!c.last_order_id) {
        // An order TM never dated still counts, and still names something —
        // better a card that says what without when than one that says nothing.
        c.last_order_id = o.order_id;
        c.last_order_no = o.order_no;
        c.last_order_for = o.name;
      }
    }
    return state;
  }

  // Which statuses mean an order is still live. Everything TM calls Finished or
  // Cancelled is closed; the rest is somewhere between asking and arriving.
  // Same set as the vault exporter's, and for the same reason both sides need
  // it: "what is still open" must not depend on which surface asked.
  var OPEN_STATUSES = ['Draft', 'Price requested', 'Supplier selected', 'On Order',
    'Received by agent', 'Partly received by agent', 'Partly received',
    'Received at Warehouse', 'Received and read at office'];

  function isOpenStatus(status) {
    return OPEN_STATUSES.indexOf(String(status || '')) >= 0;
  }

  root.contactsReduce = {
    reduce: reduce,
    hydrateContacts: hydrateContacts,
    hydrateOrders: hydrateOrders,
    attachOrderHistory: attachOrderHistory,
    newContactId: newContactId,
    isOpenStatus: isOpenStatus,
    OPEN_STATUSES: OPEN_STATUSES,
    EDITABLE_FIELDS: EDITABLE,
    decode: decode
  };

})(typeof window !== 'undefined' ? window : globalThis);
