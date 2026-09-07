'use strict';
// ── Incinerator session replay (PWA-SCHEMA v1.10) ────────────────────────────
// CANONICAL COPY. Mirrored byte-identical at
//   IDMS-Console/src/renderer/js/incinerator-reduce.js
// — same convention as utils/procurement-reduce.js. Change it here first,
// then copy.
//
// Pure derivation of incinerator session state from the append-only event
// log at data/incinerator/events/. No DOM, no globals, no network. Both the
// phone and the Console light their "running" indicator from THIS reduction
// and nothing else, so the two can only disagree when they have read
// different sets of files — never because they replayed the same files
// differently.
//
// Why two passes. The log has one physical incinerator behind it and several
// phones writing to it, each on its own clock. The earlier readers applied
// events in a single pass and dropped any end / deletion / correction that
// sorted ahead of its session_start — which happened whenever the Console
// replayed in download order (fixed 2026-08-22) and can happen again the
// moment two devices' clocks disagree by more than the seconds between a
// start and its deletion. A dropped deletion resurrects a session that
// every other device knows is gone, and the crew then write ends and
// deletions against it for weeks. So: collect every session_start first,
// then apply everything else in log order. Order still matters between
// events of the same session (the last stop_time wins); it no longer
// matters between a start and the events that refer to it.

(function (root) {

  // Deterministic replay order: the event *filename* is the sort key (lex =
  // chrono). Events not yet round-tripped through a filename fall back to
  // the same compact timestamp shape the filename is built from, so a
  // locally-appended event sorts exactly where its file will.
  function sortKey(ev) {
    if (ev._fn) return ev._fn;
    return String(ev.timestamp || '').replace(/[:.\-]/g, '') + '-' + (ev.event_id || '');
  }

  function hoursBetween(startIso, stopIso) {
    if (!startIso || !stopIso) return 0;
    var ms = new Date(stopIso).getTime() - new Date(startIso).getTime();
    return isFinite(ms) ? Math.max(0, ms / 3600000) : 0;
  }

  // Real incinerator runs are one to six hours. A session still open after
  // this many hours is almost certainly an orphan (STOP never landed), and
  // both surfaces mark it so the operator looks before believing it.
  var STALE_HOURS = 12;

  function isStale(session, nowMs) {
    if (!session || session.stop_time || !session.start_time) return false;
    var start = new Date(session.start_time).getTime();
    if (!isFinite(start)) return false;
    return ((nowMs || Date.now()) - start) >= STALE_HOURS * 3600000;
  }

  // events: array of raw event JSON objects (optionally carrying `_fn`, the
  // filename they were read from). Returns
  //   { sessions, byId, openSession, orphans }
  // sessions    — non-deleted sessions, newest start first (what the table shows)
  // byId        — every session including deleted ones (edit / delete look here)
  // openSession — the ONE canonical open session, or null
  // orphans     — events that named a session_id with no session_start at all
  //               (diagnostic: a reader that sees these has an incomplete log)
  function reduce(events) {
    var list = (events || []).filter(function (ev) { return ev && ev.event_type; });
    list.sort(function (a, b) {
      var ka = sortKey(a), kb = sortKey(b);
      return ka < kb ? -1 : (ka > kb ? 1 : 0);
    });

    var byId = {};
    list.forEach(function (ev) {
      if (ev.event_type !== 'session_start') return;
      var p = ev.payload || {};
      var sid = p.session_id;
      if (!sid || byId[sid]) return;              // first start for an id wins
      byId[sid] = {
        session_id:   sid,
        start_time:   p.start_time || ev.timestamp,
        stop_time:    null,
        source_tank:  p.source_tank || null,
        qty:          Number(p.qty || 0),
        deleted:      false,
        force_closed: false,
        actor:        ev.actor || null
      };
    });

    var orphans = [];
    list.forEach(function (ev) {
      var t = ev.event_type;
      if (t === 'session_start') return;
      var p = ev.payload || {};
      var s = p.session_id ? byId[p.session_id] : null;
      if (!s) { orphans.push(ev); return; }
      if (t === 'session_addition') {
        s.qty = Number(s.qty || 0) + Number(p.qty_add || 0);
      } else if (t === 'session_end') {
        s.stop_time = p.stop_time || ev.timestamp;
        if (p.qty      != null) s.qty      = Number(p.qty);
        if (p.retained != null) s.retained = Number(p.retained);
        if (p.force_close) s.force_closed = true;
      } else if (t === 'session_correction') {
        if (p.patch) Object.keys(p.patch).forEach(function (k) { s[k] = p.patch[k]; });
      } else if (t === 'session_deletion') {
        s.deleted = true;
      }
    });

    var sessions = Object.keys(byId).map(function (k) { return byId[k]; })
                         .filter(function (s) { return !s.deleted; });
    sessions.sort(function (a, b) { return (a.start_time < b.start_time) ? 1 : -1; });

    // Only one physical incinerator exists. If two users raced and both wrote
    // a session_start before either replayed, several open sessions appear.
    // Collapse them into ONE canonical session — earliest start wins, qty is
    // summed — and hide the duplicates from the table. Later additions / ends
    // land against whichever session_id their writer used and merge here.
    var openList = sessions.filter(function (s) { return !s.stop_time; });
    var open = null;
    if (openList.length === 1) {
      open = openList[0];
    } else if (openList.length > 1) {
      openList.sort(function (a, b) { return (a.start_time < b.start_time) ? -1 : 1; });
      var canonical = openList[0];
      var mergedQty = 0;
      openList.forEach(function (s) { mergedQty += Number(s.qty || 0); });
      canonical.qty = mergedQty;
      canonical._aggregated_from = openList.slice(1).map(function (s) { return s.session_id; });
      var drop = {};
      openList.slice(1).forEach(function (s) { drop[s.session_id] = true; });
      sessions = sessions.filter(function (s) { return !drop[s.session_id]; });
      open = canonical;
    }

    return { sessions: sessions, byId: byId, openSession: open, orphans: orphans };
  }

  var api = {
    reduce: reduce,
    sortKey: sortKey,
    hoursBetween: hoursBetween,
    isStale: isStale,
    STALE_HOURS: STALE_HOURS
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.incineratorReduce = api;
})(typeof window !== 'undefined' ? window : this);
