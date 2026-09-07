// The incinerator replay (PWA-SCHEMA v1.10): utils/incinerator-reduce.js.
//
// The lamp on every phone and the "Incinerator running" row on the Console
// are painted from this one reduction. What it guards, in order of how much
// it cost to learn: an end or deletion must never be dropped for sorting
// ahead of its start; a deleted session stays deleted whatever is written
// against it afterwards; two racing starts collapse to one; and the Console's
// copy is byte-identical. When the live log is on this machine it is replayed
// too, so a reader that would stumble on real files stumbles here first.
'use strict';
var fs = require('fs');
var path = require('path');
var os = require('os');
const { REPO, findConsole, counter } = require('./_paths');
var R = require(path.join(REPO, 'utils', 'incinerator-reduce.js'));
var T = counter(), check = T.check;

function ev(type, ts, payload, extra) {
  var e = { schema_version: 1, event_id: 'e-' + Math.random().toString(16).slice(2, 10),
            event_type: type, actor: 'test', timestamp: ts, payload: payload };
  if (extra) Object.keys(extra).forEach(function (k) { e[k] = extra[k]; });
  return e;
}
function fn(ts, id) { return ts.replace(/[:.\-]/g, '') + '-' + id + '.json'; }

T.head('plain lifecycle');
var s1 = R.reduce([
  ev('session_start', '2026-08-05T10:00:00.000Z', { session_id: 'A', start_time: '2026-08-05T10:00:00.000Z', source_tank: 't1', qty: 0 }),
  ev('session_addition', '2026-08-05T11:00:00.000Z', { session_id: 'A', qty_add: 12.5 }),
  ev('session_end', '2026-08-05T14:00:00.000Z', { session_id: 'A', stop_time: '2026-08-05T14:00:00.000Z', qty: 20, retained: 5 })
]);
check('one session, closed', s1.sessions.length === 1 && s1.sessions[0].stop_time === '2026-08-05T14:00:00.000Z');
check('end quantity replaces the running total', s1.sessions[0].qty, 20);
check('retained carried', s1.sessions[0].retained, 5);
check('no open session', s1.openSession, null);
check('hours between', Number(R.hoursBetween('2026-08-05T10:00:00.000Z', '2026-08-05T14:30:00.000Z').toFixed(2)), 4.5);

T.head('an open session');
var s2 = R.reduce([
  ev('session_start', '2026-08-05T10:00:00.000Z', { session_id: 'A', start_time: '2026-08-05T10:00:00.000Z', source_tank: 't1', qty: 0 })
]);
check('is the open session', s2.openSession && s2.openSession.session_id, 'A');
check('is not stale after two hours', R.isStale(s2.openSession, Date.parse('2026-08-05T12:00:00.000Z')), false);
check('is stale after twelve', R.isStale(s2.openSession, Date.parse('2026-08-05T22:00:01.000Z')), true);

T.head('order tolerance — the failure that resurrected deleted sessions');
// The deletion's file sorts BEFORE the start's (a phone whose clock ran
// behind wrote it). A single-pass reader dropped it; the session then showed
// as running on every device for weeks.
var s3 = R.reduce([
  ev('session_deletion', '2026-08-05T09:59:00.000Z', { session_id: 'A' }, { _fn: fn('2026-08-05T09:59:00.000Z', 'del') }),
  ev('session_start',    '2026-08-05T10:00:00.000Z', { session_id: 'A', start_time: '2026-08-05T10:00:00.000Z', source_tank: 't1', qty: 0 }, { _fn: fn('2026-08-05T10:00:00.000Z', 'start') })
]);
check('a deletion that sorts ahead of its start still deletes', s3.sessions.length, 0);
check('nothing open', s3.openSession, null);
check('and it is not an orphan', s3.orphans.length, 0);
var s3b = R.reduce([
  ev('session_end',   '2026-08-05T09:59:00.000Z', { session_id: 'A', stop_time: '2026-08-05T13:00:00.000Z', qty: 3 }, { _fn: fn('2026-08-05T09:59:00.000Z', 'end') }),
  ev('session_start', '2026-08-05T10:00:00.000Z', { session_id: 'A', start_time: '2026-08-05T10:00:00.000Z', source_tank: 't1', qty: 0 }, { _fn: fn('2026-08-05T10:00:00.000Z', 'start') })
]);
check('an end that sorts ahead of its start still closes', s3b.sessions[0].stop_time, '2026-08-05T13:00:00.000Z');

T.head('order between events of one session still matters');
var s4 = R.reduce([
  ev('session_start', '2026-08-05T10:00:00.000Z', { session_id: 'A', start_time: '2026-08-05T10:00:00.000Z', source_tank: 't1', qty: 0 }, { _fn: fn('2026-08-05T10:00:00.000Z', 'a') }),
  ev('session_end',   '2026-08-05T14:00:00.000Z', { session_id: 'A', stop_time: '2026-08-05T14:00:00.000Z', qty: 1 }, { _fn: fn('2026-08-05T14:00:00.000Z', 'b') }),
  ev('session_end',   '2026-08-05T14:00:02.000Z', { session_id: 'A', stop_time: '2026-08-05T14:00:02.000Z', qty: 2 }, { _fn: fn('2026-08-05T14:00:02.000Z', 'c') })
]);
check('the last end wins', s4.sessions[0].stop_time, '2026-08-05T14:00:02.000Z');
check('and its qty', s4.sessions[0].qty, 2);
var shuffled = R.reduce([
  ev('session_end',   '2026-08-05T14:00:02.000Z', { session_id: 'A', stop_time: '2026-08-05T14:00:02.000Z', qty: 2 }, { _fn: fn('2026-08-05T14:00:02.000Z', 'c') }),
  ev('session_start', '2026-08-05T10:00:00.000Z', { session_id: 'A', start_time: '2026-08-05T10:00:00.000Z', source_tank: 't1', qty: 0 }, { _fn: fn('2026-08-05T10:00:00.000Z', 'a') }),
  ev('session_end',   '2026-08-05T14:00:00.000Z', { session_id: 'A', stop_time: '2026-08-05T14:00:00.000Z', qty: 1 }, { _fn: fn('2026-08-05T14:00:00.000Z', 'b') })
]);
check('download order does not change the answer', shuffled.sessions[0].stop_time, '2026-08-05T14:00:02.000Z');

T.head('deleted stays deleted');
// What the log actually holds for several sessions: deleted on 5 Aug, then a
// phone that had not seen the deletion wrote two ends on 24 Aug.
var s5 = R.reduce([
  ev('session_start',    '2026-08-05T16:26:44.845Z', { session_id: 'A', start_time: '2026-08-05T16:26:44.845Z', source_tank: 't1', qty: 0 }),
  ev('session_end',      '2026-08-05T17:17:18.426Z', { session_id: 'A', stop_time: '2026-08-05T17:17:18.426Z', qty: 0, retained: null, force_close: true }),
  ev('session_deletion', '2026-08-05T17:17:19.643Z', { session_id: 'A' }),
  ev('session_end',      '2026-08-24T06:53:00.871Z', { session_id: 'A', stop_time: '2026-08-24T06:53:00.866Z', qty: 0, retained: 0 }),
  ev('session_end',      '2026-08-24T06:53:02.448Z', { session_id: 'A', stop_time: '2026-08-24T06:53:02.446Z', qty: 0, retained: 0 })
]);
check('not in the visible list', s5.sessions.length, 0);
check('still in byId, flagged deleted and force-closed', s5.byId.A.deleted === true && s5.byId.A.force_closed === true);
check('nothing open', s5.openSession, null);

T.head('two racing starts collapse to one');
var s6 = R.reduce([
  ev('session_start', '2026-08-04T04:04:01.001Z', { session_id: 'A', start_time: '2026-08-04T04:04:01.001Z', source_tank: 't1', qty: 2 }),
  ev('session_start', '2026-08-04T04:04:20.773Z', { session_id: 'B', start_time: '2026-08-04T04:04:20.773Z', source_tank: 't1', qty: 3 })
]);
check('one open session', s6.openSession && s6.openSession.session_id, 'A');
check('earliest start is canonical and quantities sum', s6.openSession.qty, 5);
check('the duplicate is hidden from the table', s6.sessions.length, 1);
check('and named as aggregated', s6.openSession._aggregated_from, ['B']);

T.head('corrections');
var s7 = R.reduce([
  ev('session_start',      '2026-08-04T04:04:01.001Z', { session_id: 'A', start_time: '2026-08-04T04:04:01.001Z', source_tank: 't1', qty: 0 }),
  ev('session_correction', '2026-08-04T08:00:00.000Z', { session_id: 'A', patch: { start_time: '2026-08-04T02:30:00.000Z', stop_time: '2026-08-04T05:45:00.000Z', qty: 9 } })
]);
check('a correction can close a session on its own', s7.sessions[0].stop_time, '2026-08-04T05:45:00.000Z');
check('and move its start', s7.sessions[0].start_time, '2026-08-04T02:30:00.000Z');
var s7b = R.reduce([
  ev('session_start',      '2026-08-04T04:04:01.001Z', { session_id: 'A', start_time: '2026-08-04T04:04:01.001Z', source_tank: 't1', qty: 0 }),
  ev('session_end',        '2026-08-04T06:00:00.000Z', { session_id: 'A', stop_time: '2026-08-04T06:00:00.000Z', qty: 1 }),
  ev('session_correction', '2026-08-04T08:00:00.000Z', { session_id: 'A', patch: { stop_time: null } })
]);
check('a null stop in a patch re-opens (the writer guards this, the reducer is faithful)', s7b.openSession && s7b.openSession.session_id, 'A');

T.head('orphans and junk');
var s8 = R.reduce([
  null, {}, { event_type: 'session_end', payload: {} },
  ev('session_end', '2026-08-05T14:00:00.000Z', { session_id: 'GHOST', stop_time: '2026-08-05T14:00:00.000Z' })
]);
check('an end for a session with no start is reported, not applied', s8.orphans.length, 2);
check('nothing open', s8.openSession, null);
check('sort key falls back to the filename shape', R.sortKey({ timestamp: '2026-08-05T14:00:00.000Z', event_id: 'x' }), '20260805T140000000Z-x');

T.head('the live log, when it is on this machine');
var home = os.homedir();
var eventsDir = null;
try {
  fs.readdirSync(home).filter(function (d) { return /^OneDrive/.test(d); }).forEach(function (d) {
    var p = path.join(home, d, 'Documents', 'IDMS', 'data', 'incinerator', 'events');
    if (!eventsDir && fs.existsSync(p)) eventsDir = p;
  });
} catch (_) {}
if (!eventsDir) {
  T.note('no synced data/incinerator/events folder under ' + home + ' — skipping the live replay');
} else {
  var names = fs.readdirSync(eventsDir).filter(function (n) { return n.endsWith('.json'); }).sort();
  var bad = 0;
  var live = names.map(function (n) {
    try { var e = JSON.parse(fs.readFileSync(path.join(eventsDir, n), 'utf8')); e._fn = n; return e; }
    catch (_) { bad++; return null; }
  }).filter(Boolean);
  T.note(names.length + ' event files in ' + eventsDir);
  check('every file parses', bad, 0);
  var st = R.reduce(live);
  check('replays without orphans', st.orphans.length, 0);
  check('every visible session has a start', st.sessions.every(function (s) { return !!s.start_time; }));
  var openIds = st.sessions.filter(function (s) { return !s.stop_time; }).map(function (s) { return s.session_id; });
  check('at most one visible open session', openIds.length <= 1);
  T.note(st.openSession
    ? 'open session ' + st.openSession.session_id.slice(0, 8) + ' since ' + st.openSession.start_time
    : 'no open session');
  // The whole-file filename order and the timestamp order must agree, or the
  // phone (which sorts by filename) and a reader sorting by timestamp differ.
  var byTs = live.slice().sort(function (a, b) { return a.timestamp < b.timestamp ? -1 : 1; });
  check('filename order is timestamp order', byTs.map(function (e) { return e._fn; }), names);
}

T.head('the Console mirror');
var CONSOLE = findConsole();
if (!CONSOLE) {
  T.note('no IDMS-Console checkout found — mirror not checked');
} else {
  var mine = fs.readFileSync(path.join(REPO, 'utils', 'incinerator-reduce.js'), 'utf8');
  var theirsPath = path.join(CONSOLE, 'src', 'renderer', 'js', 'incinerator-reduce.js');
  check('Console has the mirror', fs.existsSync(theirsPath));
  if (fs.existsSync(theirsPath)) {
    check('byte-identical with the canonical copy', fs.readFileSync(theirsPath, 'utf8') === mine);
  }
  var sync = fs.readFileSync(path.join(CONSOLE, 'src', 'renderer', 'js', 'sync-incinerator.js'), 'utf8');
  check('Console reader replays through the shared reducer', /incineratorReduce\.reduce\(/.test(sync));
  check('Console reader no longer skips files it could not fetch', !/\.catch\(\(\) => null\)/.test(sync));
  var html = fs.readFileSync(path.join(CONSOLE, 'src', 'renderer', 'index.html'), 'utf8');
  check('the mirror is loaded before the reader',
        html.indexOf('js/incinerator-reduce.js') !== -1 &&
        html.indexOf('js/incinerator-reduce.js') < html.indexOf('js/sync-incinerator.js'));
}

process.exit(T.done() ? 0 : 1);
