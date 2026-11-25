'use strict';

// Receiving against TM Master's open order lines — Inventory › Receive (§42.9a).
//
// The Console drives TM Master's Purchasing screen and publishes every order
// line still to come as data/procurement/open-order-lines.json (the Console's
// docs/procurement-registry.md §14.9). This file is what the phone does with
// it: find a part by what is written on the box, show every open line it is
// on, and split a delivered quantity across them, oldest order first.
//
// Every receipt made this way carries `tm_order_no` + `tm_order_line_no`, so a
// later driver can book it into TM against that line (receive-into-order, not a
// bare stock push — a stock push would leave the TM order open and count twice
// when somebody later received it in TM).
//
// PWA-only for now. Nothing here writes; it reads the published file and the
// procurement event stream and hands back plain rows. UMD, like its neighbours,
// so the test suite can require it in Node.

(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) module.exports = factory();
  else root.receiveLines = factory();
}(typeof self !== 'undefined' ? self : this, function () {

  // Lines on a purchase order that are not things anybody will carry aboard.
  // TM puts freight, duty and surcharges on the order as lines, and one of the
  // catalogue's own items is literally called "Tax" (23 open lines today), so
  // this is read off the line's name and component, not off whether it matched.
  var NON_GOODS_RE = new RegExp('^(?:' + [
    'tax', 'sales tax', 'import duty', 'duty', 'duties', 'tariffs?', 'surcharges?',
    'fuel surcharge', 'freight.*', 'estimated freight', 'air freight', 'ocean freight',
    'ground freight', 'freight consolidation', 'shipping.*', 'packing( costs?)?',
    'handling( charges?)?', 'finance charges?', 'delivery( charges?)?',
    'hazmat( fee)?', 'dutch harbor tax.*', 'customs.*', 'brokerage.*',
    'labou?r', 'service charge'
  ].join('|') + ')$', 'i');
  var NON_GOODS_COMPONENT_RE =
    /^(surcharges|import duty|finance charges|air freight|ocean freight|ground freight|freight\/shipping transportation|dutch harbor tax.*)$/i;
  // "497-250049-INV - 1/28/26": an invoice pasted in as a line.
  var INVOICE_RE = /-INV\b/i;

  function isNonGoods(line) {
    var n = String(line.item_name || '').trim();
    var c = String(line.component || '').trim();
    if (!n) return true;
    if (NON_GOODS_RE.test(n)) return true;
    if (INVOICE_RE.test(n)) return true;
    if (NON_GOODS_COMPONENT_RE.test(c)) return true;
    return false;
  }

  // TM shows the approval date as the US-format text it was typed in:
  // "10/2/2026". Anything else is left as it is, sorting after real dates.
  function approvedIso(s) {
    var m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(String(s || '').trim());
    if (!m) {
      var t = Date.parse(s);
      return isFinite(t) ? new Date(t).toISOString().slice(0, 10) : '';
    }
    return m[3] + '-' + (m[1].length < 2 ? '0' : '') + m[1] + '-' + (m[2].length < 2 ? '0' : '') + m[2];
  }

  function tmKey(orderNo, lineNo) { return String(orderNo) + '#' + String(lineNo); }

  function num(v) { var n = Number(v); return isFinite(n) ? n : 0; }
  function q(n) { return Math.round(n * 1e6) / 1e6; }
  function norm(s) { return String(s || '').toLowerCase().replace(/\s+/g, ' ').trim(); }

  // What IDMS has already recorded against each TM line: receipts that moved
  // stock (stock_movement, kind 'receipt', with the tm_* fields) and lines
  // marked received with nothing put on a shelf (tm_order_line_received).
  // Nothing books IDMS receipts into TM yet, so all of them still count against
  // the file's `outstanding`. An event carrying `_pending` is one still in the
  // phone's outbox — shown, and counted, so nobody types it twice.
  function recorded(events) {
    var out = {};
    (events || []).forEach(function (e) {
      var p = e && e.payload;
      if (!p || !p.tm_order_no || p.tm_order_line_no === undefined || p.tm_order_line_no === null) return;
      var stock = e.event_type === 'stock_movement' && p.kind === 'receipt';
      var bare = e.event_type === 'tm_order_line_received';
      if (!stock && !bare) return;
      var k = tmKey(p.tm_order_no, p.tm_order_line_no);
      var r = out[k] || (out[k] = { qty: 0, pending: 0, rows: [] });
      var n = num(p.qty);
      r.qty = q(r.qty + n);
      if (e._pending) r.pending = q(r.pending + n);
      r.rows.push({
        event_id: e.event_id, qty: n, item_id: stock ? (p.item_id || null) : null,
        location_id: stock ? (p.location_id || null) : null, no_stock: bare,
        actor: e.actor || null, timestamp: e.timestamp || null, pending: !!e._pending
      });
    });
    return out;
  }

  // Every receivable line, with "still to come" worked out, gathered into the
  // things somebody would search for: one group per catalogue item, and one per
  // name for lines TM could not tie to a single item (ambiguous, or none).
  function build(doc, events) {
    var rec = recorded(events);
    var lines = [];
    ((doc && doc.orders) || []).forEach(function (o) {
      if (o.order_type === 'ServiceOrder') return;
      var appr = approvedIso(o.approved);
      (o.lines || []).forEach(function (l) {
        if (!(num(l.outstanding) > 0)) return;
        if (isNonGoods(l)) return;
        var key = tmKey(o.order_no, l.line_no);
        var r = rec[key] || { qty: 0, pending: 0, rows: [] };
        lines.push({
          key: key,
          order_no: o.order_no, line_no: l.line_no,
          order_name: o.name || '', supplier: o.supplier || '', status: o.status || '',
          department: o.department || '',
          approved: o.approved || '', approved_iso: appr,
          item_name: l.item_name || '', uom: l.uom || '',
          on_order: num(l.on_order), received_tm: num(l.received), outstanding: num(l.outstanding),
          recorded: r.qty, pending: r.pending, receipts: r.rows,
          to_come: q(Math.max(0, num(l.outstanding) - r.qty)),
          makers_part_no: l.makers_part_no || '', suppliers_ref: l.suppliers_ref || '',
          unit_price: (l.unit_price === null || l.unit_price === undefined) ? null : l.unit_price,
          component: l.component || '', description: l.description || '',
          item_id: l.item_id || null, match: l.match || 'none',
          candidates: Array.isArray(l.candidates) ? l.candidates.slice() : []
        });
      });
    });

    var groups = {}, order = [];
    lines.forEach(function (l) {
      var kind = l.item_id ? 'item' : (l.match === 'ambiguous' ? 'ambiguous' : 'none');
      var gk = kind === 'item' ? 'item:' + l.item_id : kind + ':' + norm(l.item_name);
      var g = groups[gk];
      if (!g) {
        g = groups[gk] = { key: gk, kind: kind, item_id: l.item_id, name: l.item_name,
                           candidates: [], lines: [], to_come: 0, pending: 0, hay: '' };
        order.push(gk);
      }
      l.group = gk;
      g.lines.push(l);
      l.candidates.forEach(function (c) { if (g.candidates.indexOf(c) === -1) g.candidates.push(c); });
    });
    var list = order.map(function (k) {
      var g = groups[k];
      g.lines.sort(oldestFirst);
      g.to_come = q(g.lines.reduce(function (s, l) { return s + l.to_come; }, 0));
      g.pending = q(g.lines.reduce(function (s, l) { return s + l.pending; }, 0));
      g.hay = norm([g.name, g.item_id || ''].concat(g.lines.map(function (l) {
        return [l.order_no, l.makers_part_no, l.suppliers_ref, l.supplier].join(' ');
      })).join(' '));
      return g;
    });
    var byKey = {};
    lines.forEach(function (l) { byKey[l.key] = l; });
    return { lines: lines, groups: list, byGroup: groups, byKey: byKey };
  }

  function oldestFirst(a, b) {
    var ad = a.approved_iso || '9999', bd = b.approved_iso || '9999';
    if (ad !== bd) return ad < bd ? -1 : 1;
    if (a.order_no !== b.order_no) return String(a.order_no).localeCompare(String(b.order_no));
    return num(a.line_no) - num(b.line_no);
  }

  // Words ANDed, substring, over the item name, maker's part no, supplier's
  // ref, order no and supplier. `nameOf` lets the page add the register's own
  // name/part number for an item group (TM's line text is not always the same).
  function search(built, text, opts) {
    opts = opts || {};
    var terms = norm(text).split(' ').filter(Boolean);
    if (!terms.length) return [];
    var extra = opts.extraHay || function () { return ''; };
    var hits = built.groups.filter(function (g) {
      var hay = g.hay + ' ' + norm(extra(g));
      for (var i = 0; i < terms.length; i++) if (hay.indexOf(terms[i]) === -1) return false;
      return true;
    });
    hits.sort(function (a, b) {
      var ao = a.to_come > 0 ? 0 : 1, bo = b.to_come > 0 ? 0 : 1;
      if (ao !== bo) return ao - bo;
      var as = norm(a.name).indexOf(terms[0]) === 0 ? 0 : 1, bs = norm(b.name).indexOf(terms[0]) === 0 ? 0 : 1;
      if (as !== bs) return as - bs;
      return String(a.name).localeCompare(String(b.name));
    });
    return opts.limit ? hits.slice(0, opts.limit) : hits;
  }

  // One quantity, poured into the lines oldest first. What is left once every
  // line is full goes on the last (newest) line and is reported as `over`.
  function allocate(lines, qty) {
    var left = q(Math.max(0, num(qty)));
    var alloc = lines.map(function () { return 0; });
    for (var i = 0; i < lines.length && left > 0; i++) {
      var take = Math.min(left, Math.max(0, lines[i].to_come));
      alloc[i] = q(take);
      left = q(left - take);
    }
    if (left > 0 && lines.length) alloc[lines.length - 1] = q(alloc[lines.length - 1] + left);
    return { alloc: alloc, over: left };
  }

  // A tap: one unit onto line `i` (dir +1) or off it (dir −1), taken from or
  // given to another line so the total stays what was typed. Onto: taken from
  // the newest other line holding any. Off: given to the oldest other line with
  // room, else the newest other line. Single line: nothing to move between.
  function moveOne(lines, alloc, i, dir, step) {
    step = step || 1;
    var a = alloc.slice();
    if (lines.length < 2) return a;
    var j, n;
    if (dir > 0) {
      for (j = a.length - 1; j >= 0; j--) if (j !== i && a[j] > 0) break;
      if (j < 0) return a;
      n = Math.min(step, a[j]);
      a[j] = q(a[j] - n); a[i] = q(a[i] + n);
    } else {
      if (!(a[i] > 0)) return a;
      n = Math.min(step, a[i]);
      var to = -1;
      for (j = 0; j < a.length; j++) if (j !== i && a[j] < lines[j].to_come) { to = j; break; }
      if (to < 0) for (j = a.length - 1; j >= 0; j--) if (j !== i) { to = j; break; }
      a[i] = q(a[i] - n); a[to] = q(a[to] + n);
    }
    return a;
  }

  // How far past what is outstanding an allocation goes, line by line.
  function overBy(lines, alloc) {
    return q(lines.reduce(function (s, l, i) { return s + Math.max(0, num(alloc[i]) - l.to_come); }, 0));
  }

  return {
    isNonGoods: isNonGoods, approvedIso: approvedIso, tmKey: tmKey,
    recorded: recorded, build: build, search: search,
    allocate: allocate, moveOne: moveOne, overBy: overBy
  };
}));
