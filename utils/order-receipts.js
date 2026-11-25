/* order-receipts.js — what IDMS has received against TM Master's open order
 * lines, and how much of it TM already knows about.
 *
 * MIRRORED byte-identical: IDMS-Console src/renderer/js/order-receipts.js
 * and IDMS (PWA) utils/order-receipts.js. The phone works out "still to come"
 * with it; the Console lists what is still owed to TM with it. Change both or
 * neither — the PWA's test suite compares the bytes.
 *
 * Console: docs/procurement-registry.md §14.10.
 *
 * ── The problem ─────────────────────────────────────────────────────────────
 * The open-order-lines document is a snapshot of TM taken at `pulled_at`:
 * per line, on order and received. Phones then file receipts against those
 * lines. A receipt reaches TM by somebody receiving the order line in TM —
 * by hand today, by a driver later — and the next pull shows TM's received
 * figure risen. But TM's received figure also rises when somebody receives
 * goods in TM WITHOUT a phone ever seeing them. TM keeps one number per line,
 * so it cannot say whose receipt a rise was.
 *
 * Subtracting every phone receipt from every snapshot counts a booked receipt
 * twice once the snapshot includes it. Subtracting none forgets receipts TM
 * has not heard of. Both are wrong.
 *
 * ── The rule ────────────────────────────────────────────────────────────────
 * Every phone receipt records what TM said that line had received in the
 * snapshot it was working from (`tm_received_seen`). On any later snapshot,
 * TM's rise since then — `received - min(seen)` — is taken to cover the
 * phone's receipts, oldest first. What it covers is in TM; the rest is still
 * owed to TM. A rise bigger than the phones' receipts is goods received in TM
 * directly, and is already in the snapshot's outstanding.
 *
 * So, per line:
 *   owed           = phone receipts filed before the pull, not covered by TM's rise
 *   since_pull     = phone receipts filed after the pull (the snapshot cannot hold them)
 *   still_to_come  = snapshot outstanding - owed - since_pull, floored at 0
 *
 * The ambiguity this accepts, said plainly: if the phone received 4 and,
 * separately, somebody received 4 OTHER units of the same line in TM, TM's rise
 * of 4 is read as the phone's 4. The line then shows 4 more to come than is
 * true, never fewer — it errs towards offering goods, not hiding them.
 *
 * A booking marker (`tm_order_receipt_booked`) is somebody saying "I have
 * received this in TM". It changes no arithmetic — TM is the truth, and the
 * next pull will show it — it only lets the Console stop listing the receipt
 * as something to do while that pull is pending.
 */
(function (root) {
  'use strict';

  var RECEIPT = 'stock_movement', BARE = 'tm_order_line_received', BOOKED = 'tm_order_receipt_booked';

  function num(v) { var n = Number(v); return isFinite(n) ? n : 0; }
  function q(n) { return Math.round(n * 1e6) / 1e6; }
  function key(orderNo, lineNo) { return String(orderNo) + '#' + String(lineNo); }
  function seenOf(p) {
    var v = p.tm_received_seen;
    return (v === null || v === undefined || v === '' || !isFinite(Number(v))) ? null : Number(v);
  }

  // Receipts and booking markers out of a procurement event stream. Events are
  // { event_id, event_type, timestamp, actor, payload, _pending? }.
  function collect(events) {
    var byLine = {}, booked = {};
    (events || []).forEach(function (e) {
      var p = e && e.payload;
      if (!p) return;
      if (e.event_type === BOOKED) {
        (p.event_ids || []).forEach(function (id) {
          if (!booked[id] || String(e.timestamp) < booked[id].at) booked[id] = { at: e.timestamp || '', by: e.actor || null };
        });
        return;
      }
      if (!p.tm_order_no || p.tm_order_line_no === undefined || p.tm_order_line_no === null) return;
      var stock = e.event_type === RECEIPT && p.kind === 'receipt';
      var bare = e.event_type === BARE;
      if (!stock && !bare) return;
      var k = key(p.tm_order_no, p.tm_order_line_no);
      (byLine[k] = byLine[k] || []).push({
        event_id: e.event_id || p.movement_id || null,
        order_no: String(p.tm_order_no), line_no: p.tm_order_line_no,
        qty: num(p.qty), seen: seenOf(p), at: e.timestamp || '',
        actor: e.actor || null, item_id: stock ? (p.item_id || null) : null,
        location_id: stock ? (p.location_id || null) : null,
        no_stock: bare, pending: !!e._pending
      });
    });
    Object.keys(byLine).forEach(function (k) {
      byLine[k].sort(function (a, b) { return String(a.at).localeCompare(String(b.at)); });
    });
    return { byLine: byLine, booked: booked };
  }

  // One line of the snapshot against the receipts filed for it.
  function reconcileLine(line, receipts, pulledAt, booked) {
    receipts = receipts || [];
    booked = booked || {};
    var before = [], after = [];
    receipts.forEach(function (r) {
      // A receipt still in a phone's outbox has not reached OneDrive, so no
      // pull can have seen it, whatever its clock says.
      if (!r.pending && pulledAt && r.at && String(r.at) <= String(pulledAt)) before.push(r); else after.push(r);
    });

    var received = num(line.received);
    var seens = before.map(function (r) { return r.seen; }).filter(function (s) { return s !== null; });
    var base = seens.length ? Math.min.apply(null, seens) : null;
    // No receipt says what TM showed: nothing can be shown to be in TM.
    var gain = base === null ? 0 : Math.max(0, q(received - base));

    var left = gain, owed = 0, inTm = 0, rows = [];
    before.forEach(function (r) {
      var covered = Math.min(r.qty, left);
      left = q(left - covered);
      inTm = q(inTm + covered);
      owed = q(owed + (r.qty - covered));
      rows.push(rowOf(r, covered, booked));
    });
    var since = 0;
    after.forEach(function (r) { since = q(since + r.qty); rows.push(rowOf(r, 0, booked)); });

    var outstanding = num(line.outstanding);
    var still = q(outstanding - owed - since);
    return {
      key: key(line.order_no, line.line_no),
      phone_qty: q(inTm + owed + since),
      in_tm: inTm,
      owed_before_pull: owed,
      since_pull: since,
      owed_to_tm: q(owed + since),
      // TM's rise beyond the phones' receipts: received in TM directly.
      tm_direct: base === null ? 0 : Math.max(0, q(gain - inTm)),
      still_to_come: Math.max(0, still),
      over_received: still < 0 ? q(-still) : 0,
      receipts: rows
    };
  }

  function rowOf(r, covered, booked) {
    var owe = q(r.qty - covered);
    var b = booked[r.event_id];
    return {
      event_id: r.event_id, qty: r.qty, at: r.at, actor: r.actor,
      item_id: r.item_id, location_id: r.location_id, no_stock: r.no_stock, pending: r.pending,
      seen: r.seen, in_tm: covered, owed: owe,
      state: owe <= 0 ? 'in_tm' : (b ? 'booked' : 'owed'),
      booked_at: b ? b.at : null, booked_by: b ? b.by : null
    };
  }

  /**
   * @param {object} doc     open-order-lines.json
   * @param {Array}  events  procurement events (any types; the rest are ignored)
   * @returns {{ lines: Object<string,object>, gone: Array }}
   *   lines — per `order_no#line_no` in the snapshot, reconcileLine's result
   *           (lines with no receipts included, so callers can read still_to_come)
   *   gone  — receipts against lines the snapshot no longer lists: TM has moved
   *           the order out of the open statuses (received, finished, cancelled)
   *           or the line is gone. Grouped by order; nothing here can tell
   *           whether TM took them in, so the Console asks.
   */
  function reconcile(doc, events) {
    var c = collect(events);
    var pulledAt = (doc && doc.pulled_at) || '';
    var lines = {}, seen = {};
    ((doc && doc.orders) || []).forEach(function (o) {
      (o.lines || []).forEach(function (l) {
        var line = Object.assign({}, l, { order_no: o.order_no });
        var k = key(o.order_no, l.line_no);
        seen[k] = true;
        lines[k] = reconcileLine(line, c.byLine[k], pulledAt, c.booked);
      });
    });
    var goneBy = {};
    Object.keys(c.byLine).forEach(function (k) {
      if (seen[k]) return;
      c.byLine[k].forEach(function (r) {
        var g = goneBy[r.order_no] || (goneBy[r.order_no] = { order_no: r.order_no, receipts: [] });
        g.receipts.push(rowOf(r, 0, c.booked));
      });
    });
    return { lines: lines, gone: Object.keys(goneBy).sort().map(function (k) { return goneBy[k]; }), pulled_at: pulledAt };
  }

  var api = {
    reconcile: reconcile, reconcileLine: reconcileLine, collect: collect, key: key,
    RECEIPT_EVENT: RECEIPT, BARE_EVENT: BARE, BOOKED_EVENT: BOOKED
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.orderReceipts = api;
})(typeof window !== 'undefined' ? window : this);
