'use strict';
// ── Motor hours: running-hours readings keyed by component code ─────────────
// CANONICAL COPY. Mirrored byte-identical at
//   IDMS-Console/src/renderer/js/motor-hours-reduce.js
// Same convention as utils/gear-sizes.js: change it here, then copy, then
// `node tools/test/run.js` (motor-hours.test.js compares the two).
//
// The engine room keeps a sheet of machines whose running hours are read by
// hand off a panel ("Araho Running Hours - Manual Updates") and typed into TM
// Master's Inventory > Counters. This module is the one place that decides
// what those readings mean, for every screen that shows one:
//
//   Console  Engine Room > Motor Hours (the sheet, print, TM reconcile)
//            Inventory > Components (the component's own page)
//            the service report form (Running Hours pre-fills from here)
//   Phone    Engine Room > Motor Hours (keypad entry, one column)
//
// FILES, all under Documents/IDMS/ (see IDMS-Console/docs/motor-hours.md):
//
//   data/motor-hours/register.json      which machines, in what order, and how
//                                       to read each one. Console-owned; the
//                                       phone falls back to DEFAULT_REGISTER.
//   data/motor-hours/events/<yyyy>/…    one file per save, never rewritten —
//                                       the durable record.
//   data/motor-hours/log-<yyyy>.json    every reading of the year in one file,
//                                       ETag-merged — the read model. A save
//                                       whose merge lost a race is still in
//                                       its event and is folded back in.
//   data/motor-hours/tm-counters.json   the last pull of TM's Counters grid.
//
// A READING IS WHAT THE METER SAYS — TM's "Counter" column, not its "Current
// Total". TM adds an Adjust to the meter when a motor was swapped or a meter
// reset (Trawl Winch Motor No. 1 reads 28424 with an adjust of -23979, total
// 4445). The crew read the meter, so the meter is stored; the total is derived
// wherever TM's adjust is known, and it is the total that a service report
// carries, because that is the figure TM keeps for the component.
//
// CURRENT = NEWEST, NOT HIGHEST. A reading lower than the one before is either
// a mistake or a replaced meter, and only a person can tell which — so a lower
// reading is flagged, never discarded or overruled by an older higher one.

(function (root) {
  var SCHEMA_VERSION = 1;
  var EVENT_TYPE = 'motor_hours_recorded';

  var PATHS = {
    register: 'data/motor-hours/register.json',
    tm:       'data/motor-hours/tm-counters.json',
    log:      function (year) { return 'data/motor-hours/log-' + year + '.json'; },
    events:   function (year) { return 'data/motor-hours/events/' + year; }
  };

  // The sheet as it stood on 2026-09-26 (Copy of Motor Hours Sheet(2).xlsx).
  // Codes are strings: the workbook stored 414.077, 464.018, 601.001, 665.002,
  // 702.005 and 734.001 as numbers, which is how an SFI code loses a trailing
  // zero. `info` is the sheet's "Motor Hours Information" column verbatim,
  // typos aside.
  var VFD = 'HMI Display on VFD, If not shown here, see below for info';
  var DEFAULT_REGISTER = {
    schema_version: SCHEMA_VERSION,
    title: 'Araho Running Hours - Manual Updates',
    footnote: 'To find motor hours for VFD\'s: HMI Screen on VFD, "ACT", "ENTER", ' +
              'Up/ Down Arrows (Blue arrow for first number, white arrows for second ' +
              'number), "1.38 Motor Hours"',
    rows: [
      { code: '362.003.001', component: 'MYCOM Cooling Compressor No. 1', info: 'Use Display Screen on Compressor Control Panel' },
      { code: '362.003.002', component: 'MYCOM Cooling Compressor No. 2', info: 'Use Display Screen on Compressor Control Panel' },
      { code: '362.003.003', component: 'MYCOM Cooling Compressor No. 3', info: 'Use Display Screen on Compressor Control Panel' },
      { code: '414.077',     component: '3rd Wire Winch', info: VFD },
      { code: '439.031.002', component: 'FWD Hydraulic System', info: 'Open Control Cabinet, Use Display to Select "Status Information", Then Scroll down to "Running Hours"' },
      { code: '464.015.001', component: 'Trawl Winch PS', info: 'Use Port Trawl Winch Motor with most hours' },
      { code: '464.015.001.005', component: 'Trawl Winch Levelwind PS', info: VFD },
      { code: '464.015.002', component: 'Trawl Winch SB', info: 'Use Starboard Trawl Winch Motor with most hours' },
      { code: '464.015.002.005', component: 'Trawl Winch Levelwind SB', info: VFD },
      { code: '464.015.003.001', component: 'Trawl Winch, PS No. 1 (Upper)', info: VFD },
      { code: '464.015.003.002', component: 'Trawl Winch, PS No. 2 (Middle)', info: VFD },
      { code: '464.015.003.003', component: 'Trawl Winch, PS No. 3 (Lower)', info: VFD },
      { code: '464.015.003.004', component: 'Trawl Winch, SB No. 4 (Upper)', info: VFD },
      { code: '464.015.003.005', component: 'Trawl Winch, SB No. 5 (Middle)', info: VFD },
      { code: '464.015.003.006', component: 'Trawl Winch, SB No. 6 (Lower)', info: VFD },
      { code: '464.016.001', component: 'Gilson Winch PS', info: VFD },
      { code: '464.016.002', component: 'Gilson Winch SB', info: VFD },
      { code: '464.017.001.001', component: 'Starboard Double Net Reel Winch, Outboard Components', info: VFD },
      { code: '464.017.001.002', component: 'Starboard Double Net Reel Winch, Inboard Components', info: VFD },
      { code: '464.017.002.001', component: 'Portside Double Net Reel Winch, Outboard Components', info: VFD },
      { code: '464.017.002.002', component: 'Portside Double Net Reel Winch, Inboard Components', info: VFD },
      { code: '464.018',     component: 'Single Net Drum', info: VFD },
      { code: '464.019.001', component: 'Cod End Winch PS', info: VFD },
      { code: '464.019.002', component: 'Out haul Winch', info: VFD },
      { code: '464.019.003', component: 'Cod End Winch Stbd', info: VFD },
      { code: '491.038.001', component: 'Hypochlorite Generator', info: 'Local Control Hours Display' },
      { code: '574.002.001', component: 'Supply fan Engine Room No.1', info: VFD },
      { code: '574.002.002', component: 'Supply fan Engine Room No.2', info: VFD },
      { code: '574.002.003', component: 'Supply fan Generator Room', info: VFD },
      { code: '601.001',     component: 'Main Engine', info: 'Use Hours Display on Local Engine Panel' },
      { code: '665.002',     component: 'Emergency Engine', info: 'Local Control Screen on EGEN, wait for values to cycle through' },
      { code: '702.005',     component: 'F.O. separator', info: 'Local Control Screen, Back Arrow, "3 Operation Info", "1 Timers, Counters", "2 Sep Time"' },
      { code: '734.001',     component: 'Instrument (Service) Air Compressor', info: 'Local Control Screen, "Menu", "Counters", "Running Hours"' }
    ]
  };

  // ── small pieces ──────────────────────────────────────────────────────────

  function normCode(code) {
    return code == null ? '' : String(code).trim();
  }

  // What the keypad or a text box produced, as hours. Whole or tenths; never
  // negative; blank is "not read", which is null and never zero.
  function parseHours(v) {
    if (v == null) return null;
    var s = String(v).replace(/[,\s]/g, '');
    if (s === '' || s === '.' || s === '-') return null;
    if (!/^\d+(\.\d+)?$/.test(s)) return null;
    var n = Number(s);
    if (!isFinite(n) || n < 0 || n > 10000000) return null;
    return Math.round(n * 10) / 10;
  }

  function fmtHours(n) {
    if (n == null || !isFinite(n)) return '';
    var whole = Math.round(n * 10) % 10 === 0;
    return whole ? String(Math.round(n)) : n.toFixed(1);
  }

  // TM writes dates as M/D/YYYY with no time; IDMS writes ISO instants. Both
  // come out as an ISO string that sorts: a bare date is taken as that day.
  function toIsoDate(s) {
    if (!s) return null;
    s = String(s).trim();
    var m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(s);
    if (m) return m[3] + '-' + ('0' + m[1]).slice(-2) + '-' + ('0' + m[2]).slice(-2);
    m = /^(\d{4}-\d{2}-\d{2})/.exec(s);
    return m ? m[1] : null;
  }

  function dayOf(iso) { return iso ? String(iso).slice(0, 10) : ''; }

  // ── the register ──────────────────────────────────────────────────────────

  // A missing or malformed register is the default one: a new setting has to
  // work from a missing file, because the phone may be the first to look.
  function cleanRegister(doc) {
    var src = doc && Array.isArray(doc.rows) ? doc : DEFAULT_REGISTER;
    var seen = {};
    var rows = [];
    src.rows.forEach(function (r) {
      var code = normCode(r && r.code);
      if (!code || seen[code]) return;
      seen[code] = true;
      rows.push({
        code: code,
        component: String((r.component || '')).trim(),
        info: String((r.info || '')).trim()
      });
    });
    return {
      schema_version: SCHEMA_VERSION,
      title: src.title || DEFAULT_REGISTER.title,
      footnote: src.footnote != null ? String(src.footnote) : DEFAULT_REGISTER.footnote,
      updated: src.updated || null,
      updated_by: src.updated_by || null,
      rows: rows,
      is_default: src === DEFAULT_REGISTER
    };
  }

  // ── readings ──────────────────────────────────────────────────────────────

  function uuid() {
    if (root && root.crypto && typeof root.crypto.randomUUID === 'function') return root.crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
  }

  // One save → one event. `entries` is [{code, hours}] as typed; blanks and
  // junk are dropped here so no caller has to remember to. Returns null when
  // nothing survives, which callers treat as "nothing to save".
  function buildEvent(opts) {
    var now = opts.now || new Date().toISOString();
    var eventId = opts.eventId || uuid();
    var actor = opts.actor || {};
    var readings = [];
    (opts.entries || []).forEach(function (e) {
      var code = normCode(e && e.code);
      var hours = parseHours(e && e.hours);
      if (!code || hours == null) return;
      readings.push({
        reading_id: eventId + ':' + code,
        code: code,
        hours: hours,
        read_at: e.read_at || now,
        by: actor.username || null,
        by_name: actor.display_name || actor.username || null,
        source: opts.source || 'console',
        event_id: eventId
      });
    });
    if (!readings.length) return null;
    return {
      schema_version: SCHEMA_VERSION,
      event_id: eventId,
      event_type: EVENT_TYPE,
      timestamp: now,
      actor: { username: actor.username || null, display_name: actor.display_name || null },
      payload: { source: opts.source || 'console', readings: readings }
    };
  }

  // The event file's name sorts by time and cannot collide.
  function eventFileName(ev) {
    return String(ev.timestamp).replace(/[-:.]/g, '').replace(/Z$/, 'Z') + '-' + ev.event_id + '.json';
  }

  function readingsOfEvent(ev) {
    if (!ev || ev.event_type !== EVENT_TYPE || !ev.payload || !Array.isArray(ev.payload.readings)) return [];
    return ev.payload.readings;
  }

  function validReading(r) {
    return r && normCode(r.code) && typeof r.hours === 'number' && isFinite(r.hours) && r.read_at && r.reading_id;
  }

  // Fold a year file and any events into one list. The year file is the read
  // model and the events are the record, so the union is what happened; a
  // reading is identified by reading_id and counted once however it arrived.
  // `removed` is a list of reading ids struck out on the Console (a mistyped
  // reading is struck, never edited — the number somebody saved stays on file).
  function foldReadings(logDocs, events) {
    var byId = {};
    var struck = {};
    (logDocs || []).forEach(function (doc) {
      if (!doc) return;
      (doc.readings || []).forEach(function (r) { if (validReading(r)) byId[r.reading_id] = r; });
      (doc.struck || []).forEach(function (id) { struck[id] = true; });
    });
    (events || []).forEach(function (ev) {
      readingsOfEvent(ev).forEach(function (r) { if (validReading(r) && !byId[r.reading_id]) byId[r.reading_id] = r; });
    });
    return Object.keys(byId)
      .filter(function (id) { return !struck[id]; })
      .map(function (id) { return byId[id]; })
      .sort(function (a, b) { return a.read_at < b.read_at ? -1 : a.read_at > b.read_at ? 1 : 0; });
  }

  // What a year file becomes once `readings` are merged into it. Pure, so the
  // ETag retry loop on both sides can re-run it on whatever it re-read.
  function mergeIntoLog(doc, year, readings, struckIds) {
    var base = doc && Array.isArray(doc.readings) ? doc : { readings: [], struck: [] };
    var byId = {};
    base.readings.forEach(function (r) { if (validReading(r)) byId[r.reading_id] = r; });
    (readings || []).forEach(function (r) { if (validReading(r)) byId[r.reading_id] = r; });
    var struck = {};
    (base.struck || []).forEach(function (id) { struck[id] = true; });
    (struckIds || []).forEach(function (id) { struck[id] = true; });
    return {
      schema_version: SCHEMA_VERSION,
      year: Number(year),
      readings: Object.keys(byId).map(function (k) { return byId[k]; })
        .sort(function (a, b) { return a.read_at < b.read_at ? -1 : a.read_at > b.read_at ? 1 : 0; }),
      struck: Object.keys(struck).sort()
    };
  }

  // Newest reading per code, and the one before it (for the "lower than last
  // time" check). Readings must already be sorted oldest first.
  function latestByCode(readings) {
    var out = {};
    (readings || []).forEach(function (r) {
      var code = normCode(r.code);
      var cur = out[code];
      out[code] = { last: r, prev: cur ? cur.last : null, count: (cur ? cur.count : 0) + 1 };
    });
    return out;
  }

  // ── TM Master's Counters grid ─────────────────────────────────────────────

  // The grid's "Copy content to clipboard" text: a header row and one
  // tab-separated line per counter. Columns are found by header name, never
  // by position, because the grid's columns are the user's to rearrange.
  function parseTmCounters(text) {
    var lines = String(text || '').replace(/\r/g, '').split('\n').filter(function (l) { return l.trim() !== ''; });
    if (!lines.length) return { ok: false, error: 'empty', rows: [] };
    var head = lines[0].split('\t').map(function (h) { return h.trim(); });
    function col(names) {
      for (var i = 0; i < names.length; i++) {
        var ix = head.indexOf(names[i]);
        if (ix >= 0) return ix;
      }
      return -1;
    }
    var ix = {
      code: col(['Code']),
      component: col(['Component', 'Component name', 'Name']),
      type: col(['Counter Type', 'Counter type']),
      counter: col(['Counter']),
      adjust: col(['Adjustment', 'Adjust', 'Adjust...', 'Adjust…']),
      total: col(['Current Total', 'Current total']),
      uom: col(['Counter UOM', 'Counter uom', 'UOM']),
      updated: col(['LastUpdated', 'Last Updated', 'Last updated']),
      average: col(['Average', 'Averag...', 'Average per day']),
      manual: col(['Manual'])
    };
    if (ix.code < 0 || ix.counter < 0) return { ok: false, error: 'not_counters', header: head, rows: [] };
    function num(s) {
      if (s == null) return null;
      var t = String(s).replace(/[,\s]/g, '');
      if (t === '') return null;
      var n = Number(t);
      return isFinite(n) ? n : null;
    }
    var rows = [];
    lines.slice(1).forEach(function (line) {
      var c = line.split('\t');
      var code = normCode(c[ix.code]);
      if (!code) return;
      var type = ix.type >= 0 ? String(c[ix.type] || '').trim() : '';
      if (type && !/running hours/i.test(type)) return;
      var counter = num(c[ix.counter]);
      var adjust = ix.adjust >= 0 ? num(c[ix.adjust]) : null;
      var total = ix.total >= 0 ? num(c[ix.total]) : null;
      rows.push({
        code: code,
        component: ix.component >= 0 ? String(c[ix.component] || '').trim() : '',
        counter: counter,
        adjust: adjust,
        total: total != null ? total : (counter != null ? counter + (adjust || 0) : null),
        uom: ix.uom >= 0 ? String(c[ix.uom] || '').trim() : '',
        last_updated: ix.updated >= 0 ? toIsoDate(c[ix.updated]) : null,
        average: ix.average >= 0 ? num(c[ix.average]) : null,
        manual: ix.manual >= 0 ? /^(true|yes|1|x|checked)$/i.test(String(c[ix.manual] || '').trim()) : null
      });
    });
    return { ok: true, rows: rows };
  }

  function tmByCode(tmDoc) {
    var out = {};
    ((tmDoc && tmDoc.rows) || []).forEach(function (r) { out[normCode(r.code)] = r; });
    return out;
  }

  // ── what a screen shows ───────────────────────────────────────────────────

  // The current figure for one code, from the newest IDMS reading and TM's
  // counter. TM wins only when its day is strictly newer than our reading's:
  // TM's date has no time, so on the same day nobody can say which came
  // second, and a reading somebody just took off the meter — even a lower one,
  // after a meter was swapped — is the better bet than a figure of unknown
  // hour.
  //
  //   { hours, total, at, source: 'idms'|'tm', by_name, adjust, reading, tm }
  //   hours = the meter; total = meter + TM's adjust (what TM keeps).
  function currentFor(code, latest, tmRows) {
    code = normCode(code);
    var mine = latest && latest[code] ? latest[code].last : null;
    var tm = tmRows ? tmRows[code] : null;
    var adjust = tm && tm.adjust ? tm.adjust : 0;
    var pick = null;
    if (mine && tm && tm.counter != null && tm.last_updated) {
      var md = dayOf(mine.read_at), td = tm.last_updated;
      pick = td > md ? 'tm' : 'idms';
    } else if (mine) pick = 'idms';
    else if (tm && tm.counter != null) pick = 'tm';
    if (!pick) return null;
    if (pick === 'idms') {
      return { hours: mine.hours, total: mine.hours + adjust, adjust: adjust, at: mine.read_at,
               source: 'idms', by_name: mine.by_name || mine.by || null, reading: mine, tm: tm || null };
    }
    return { hours: tm.counter, total: tm.total != null ? tm.total : tm.counter + adjust, adjust: adjust,
             at: tm.last_updated, source: 'tm', by_name: null, reading: mine || null, tm: tm };
  }

  // A reading worth a second look before it is saved. Not a gate: a meter
  // that was replaced really does read lower.
  //   'lower'  — below the current figure
  //   'jump'   — more hours than the clock allows since the current figure
  function checkReading(value, current, nowIso) {
    var h = parseHours(value);
    if (h == null || !current || current.hours == null) return null;
    if (h < current.hours) return { kind: 'lower', by: current.hours - h };
    if (current.at) {
      var then = Date.parse(current.at.length === 10 ? current.at + 'T00:00:00Z' : current.at);
      var now = Date.parse(nowIso || new Date().toISOString());
      if (isFinite(then) && isFinite(now) && now > then) {
        var elapsed = (now - then) / 3600000;
        // A day of slack either side: TM's date has no time and a round can
        // be typed up late.
        if (h - current.hours > elapsed + 24) return { kind: 'jump', by: h - current.hours, elapsed: elapsed };
      }
    }
    return null;
  }

  // The sheet: one row per register entry, with its current figure and TM's.
  function sheetRows(register, latest, tmRows) {
    return cleanRegister(register).rows.map(function (r) {
      var cur = currentFor(r.code, latest, tmRows);
      var tm = tmRows ? tmRows[r.code] || null : null;
      return {
        code: r.code, component: r.component, info: r.info,
        current: cur,
        tm: tm,
        in_tm: !!tm,
        // TM is behind when our newest reading is newer than its counter and
        // says something different. That is the list somebody types into TM.
        tm_behind: !!(cur && cur.source === 'idms' && (!tm || tm.counter !== cur.hours))
      };
    });
  }

  // The hours a service report on these components should carry: the first
  // component that has a current figure. Returns { code, hours, total, at,
  // source, by_name } or null. `total` is the figure to put on the report.
  function hoursForReport(codes, latest, tmRows) {
    for (var i = 0; i < (codes || []).length; i++) {
      var cur = currentFor(codes[i], latest, tmRows);
      if (cur) return { code: normCode(codes[i]), hours: cur.hours, total: cur.total, at: cur.at,
                        source: cur.source, by_name: cur.by_name, adjust: cur.adjust };
    }
    return null;
  }

  var api = {
    SCHEMA_VERSION: SCHEMA_VERSION,
    EVENT_TYPE: EVENT_TYPE,
    PATHS: PATHS,
    DEFAULT_REGISTER: DEFAULT_REGISTER,
    normCode: normCode,
    parseHours: parseHours,
    fmtHours: fmtHours,
    toIsoDate: toIsoDate,
    cleanRegister: cleanRegister,
    buildEvent: buildEvent,
    eventFileName: eventFileName,
    readingsOfEvent: readingsOfEvent,
    foldReadings: foldReadings,
    mergeIntoLog: mergeIntoLog,
    latestByCode: latestByCode,
    parseTmCounters: parseTmCounters,
    tmByCode: tmByCode,
    currentFor: currentFor,
    checkReading: checkReading,
    sheetRows: sheetRows,
    hoursForReport: hoursForReport
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.motorHours = api;
})(typeof window !== 'undefined' ? window : this);
