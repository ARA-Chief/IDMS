'use strict';

// Motor hours — the Engine Room's running-hours sheet
// (IDMS-Console/docs/motor-hours.md).
//
// What fails silently here, and is checked:
//
//   "Current" is newest, not highest. A lower reading is a replaced meter or a
//   typo; either way it must show, flagged, not be overruled by an older
//   higher figure.
//
//   A reading is the meter; TM's Current Total is meter + Adjust. Mixing them
//   puts 28424 on a report for a motor TM says has run 4445 hours.
//
//   A save whose year-file merge lost a race still exists as an event and
//   must still count, once.
//
//   The Console runs the same module. A copy that drifts means the phone and
//   the Console disagree about what a machine has run.

const fs = require('fs');
const path = require('path');
const { REPO, findConsole, counter } = require('./_paths');

const T = counter(), check = T.check;
const MH = require(path.join(REPO, 'utils', 'motor-hours-reduce.js'));

T.head('the register');
const reg = MH.cleanRegister(null);
check('a missing register is the sheet as it stood', reg.rows.length, 33);
check('and says it is the default', reg.is_default, true);
check('codes stored as numbers in the workbook keep their zeros',
  ['414.077', '464.018', '601.001', '665.002', '702.005', '734.001'].every(c => reg.rows.some(r => r.code === c)));
check('a duplicated code is kept once',
  MH.cleanRegister({ rows: [{ code: '601.001' }, { code: ' 601.001 ' }] }).rows.length, 1);
check('an edited register is used as is', MH.cleanRegister({ rows: [{ code: '1', component: 'A', info: 'x' }] }).rows[0],
  { code: '1', component: 'A', info: 'x' });

T.head('what the keypad typed');
check('whole hours', MH.parseHours('30238'), 30238);
check('tenths', MH.parseHours('12.25'), 12.3);
check('thousands separators are ignored', MH.parseHours('30,238'), 30238);
check('blank is not read, never zero', MH.parseHours(''), null);
check('a minus is refused', MH.parseHours('-5'), null);
check('junk is refused', MH.parseHours('12a'), null);
check('whole hours print without a decimal', MH.fmtHours(30238), '30238');

T.head('a save');
const actor = { username: 'wostara', display_name: 'William Ostara' };
const ev = MH.buildEvent({ entries: [{ code: '601.001', hours: '64574' }, { code: '665.002', hours: '' }],
  actor, source: 'pwa', now: '2026-09-26T20:00:00.000Z', eventId: 'e1' });
check('drops the rows left blank', ev.payload.readings.length, 1);
check('carries who and where', [ev.payload.readings[0].by, ev.payload.readings[0].source], ['wostara', 'pwa']);
check('reading ids are event + code', ev.payload.readings[0].reading_id, 'e1:601.001');
check('nothing typed is nothing to save', MH.buildEvent({ entries: [{ code: '601.001', hours: '' }] }), null);
check('the event file name sorts by time', MH.eventFileName(ev), '20260926T200000000Z-e1.json');

T.head('folding the year file and the events');
const ev2 = MH.buildEvent({ entries: [{ code: '601.001', hours: '64590' }], actor, now: '2026-09-27T08:00:00.000Z', eventId: 'e2' });
const log = MH.mergeIntoLog(null, 2026, ev.payload.readings);
let all = MH.foldReadings([log], [ev, ev2]);
check('an event whose merge lost the race still counts', all.map(r => r.hours), [64574, 64590]);
check('and a reading in both counts once', MH.foldReadings([log], [ev]).length, 1);
const log2 = MH.mergeIntoLog(log, 2026, ev2.payload.readings, ['e2:601.001']);
check('a struck reading drops out', MH.foldReadings([log2], [ev, ev2]).map(r => r.hours), [64574]);
check('merging is idempotent', JSON.stringify(MH.mergeIntoLog(log2, 2026, ev2.payload.readings)), JSON.stringify(log2));

T.head('TM Master\'s Counters grid');
const grid = [
  'Code\tComponent\tCounter Type\tCounter\tAdjust...\tCurrent Total\tCounter UOM\tTag\tLastUpdated\tAverage\tManual',
  '464.015.003.001\tTrawl Winch Motor No. 1, NR 0021\tRunning hours\t28424\t-23979\t4445\tHours\t\t9/26/2026\t13.15\tFalse',
  '601.001\tMain Engine\tRunning hours\t64500\t0\t64500\tHours\t\t9/20/2026\t20.1\tTrue',
  '362.009.02\tForced Air Evaporator\tRunning hours\t7640\t0\t7640\tHours\t54\t8/10/2026\t0.48\tFalse',
  '999.001\tSomething\tCycles\t5\t0\t5\tCycles\t\t9/1/2026\t0\tFalse'
].join('\r\n');
const tm = MH.parseTmCounters(grid);
check('reads the running-hours rows', tm.rows.map(r => r.code), ['464.015.003.001', '601.001', '362.009.02']);
check('keeps meter, adjust and total apart', [tm.rows[0].counter, tm.rows[0].adjust, tm.rows[0].total], [28424, -23979, 4445]);
check('TM\'s M/D/YYYY becomes a day', tm.rows[0].last_updated, '2026-09-26');
check('a grid that is not Counters is refused', MH.parseTmCounters('Name\tSerialNo\nA\tB').ok, false);
check('columns are found by name, not position',
  MH.parseTmCounters('Counter\tCode\tLastUpdated\n10\t1.1\t1/2/2026').rows[0], {
    code: '1.1', component: '', counter: 10, adjust: null, total: 10, uom: '', last_updated: '2026-01-02', average: null, manual: null });

T.head('the current figure');
const tmRows = MH.tmByCode({ rows: tm.rows });
let latest = MH.latestByCode(all);
let cur = MH.currentFor('601.001', latest, tmRows);
check('our newer reading beats TM\'s older counter', [cur.source, cur.hours], ['idms', 64590]);
cur = MH.currentFor('464.015.003.001', {}, tmRows);
check('with no reading, TM\'s counter stands', [cur.source, cur.hours, cur.total], ['tm', 28424, 4445]);
const r1 = MH.buildEvent({ entries: [{ code: '464.015.003.001', hours: '28430' }], actor, now: '2026-09-27T01:00:00.000Z', eventId: 'e3' });
cur = MH.currentFor('464.015.003.001', MH.latestByCode(r1.payload.readings), tmRows);
check('a report carries meter + TM\'s adjust', [cur.hours, cur.total], [28430, 28430 - 23979]);
const old = MH.buildEvent({ entries: [{ code: '601.001', hours: '64000' }], actor, now: '2026-09-01T01:00:00.000Z', eventId: 'e4' });
cur = MH.currentFor('601.001', MH.latestByCode(old.payload.readings), tmRows);
check('TM\'s newer counter beats our older reading', [cur.source, cur.hours], ['tm', 64500]);
const sameDay = MH.buildEvent({ entries: [{ code: '601.001', hours: '64400' }], actor, now: '2026-09-20T10:00:00.000Z', eventId: 'e5' });
cur = MH.currentFor('601.001', MH.latestByCode(sameDay.payload.readings), tmRows);
check('on the same day ours stands, even when TM\'s is higher', [cur.source, cur.hours], ['idms', 64400]);
const lower = MH.buildEvent({ entries: [{ code: '601.001', hours: '100' }], actor, now: '2026-09-28T01:00:00.000Z', eventId: 'e6' });
latest = MH.latestByCode(MH.foldReadings([], [ev, ev2, lower]));
check('newest, not highest: a lower reading is current', MH.currentFor('601.001', latest, {}).hours, 100);
check('an unknown machine has no figure', MH.currentFor('000', latest, tmRows), null);

T.head('a second look before saving');
const base = { hours: 1000, at: '2026-09-26T00:00:00.000Z' };
check('lower than now', MH.checkReading('990', base, '2026-09-27T00:00:00.000Z'), { kind: 'lower', by: 10 });
check('more hours than the clock allows', MH.checkReading('1100', base, '2026-09-27T00:00:00.000Z').kind, 'jump');
check('a day of running is fine', MH.checkReading('1024', base, '2026-09-27T00:00:00.000Z'), null);
check('nothing to compare with, nothing to say', MH.checkReading('5', null), null);

T.head('the sheet and the report');
const rows = MH.sheetRows(null, MH.latestByCode(all), tmRows);
const me = rows.find(r => r.code === '601.001');
check('a row per register entry', rows.length, 33);
check('TM is behind when our newer reading differs', me.tm_behind, true);
check('a code TM has no counter for says so', rows.find(r => r.code === '464.015.003.002').in_tm, false);
check('a report takes the first machine with hours',
  MH.hoursForReport(['000', '601.001'], MH.latestByCode(all), tmRows).code, '601.001');
check('and none when no machine has any', MH.hoursForReport(['000'], {}, {}), null);

// ── The Console runs the same module ────────────────────────────────────────
const CON = findConsole();
if (!CON) T.note('no IDMS-Console checkout beside this repo — mirror check skipped');
else {
  T.head('mirrored to the Console');
  const theirs = path.join(CON, 'src', 'renderer', 'js', 'motor-hours-reduce.js');
  check('motor-hours-reduce.js is byte-identical with the Console\'s',
    fs.existsSync(theirs) && fs.readFileSync(path.join(REPO, 'utils', 'motor-hours-reduce.js')).equals(fs.readFileSync(theirs)));
}

// ── The door in ─────────────────────────────────────────────────────────────
T.head('the Engine Room screen');
const hub = fs.readFileSync(path.join(REPO, 'index.html'), 'utf8');
check('loads the module', /<script src="utils\/motor-hours-reduce\.js"><\/script>/.test(hub));
check('offers a Motor Hours tile', /class="er-hub-tile" onclick="openMotorHours\(\)"/.test(hub));
const mhjs = fs.readFileSync(path.join(REPO, 'motorhours.js'), 'utf8').replace(/\r/g, '');
check('has the screen it opens', /id="screen-motor-hours"/.test(hub) && /<script src="motorhours\.js"><\/script>/.test(hub) &&
  /function openMotorHours\(\)/.test(mhjs));
check('writes the event before the year file', (() => {
  const i = mhjs.indexOf('async function mhSave(');
  const body = mhjs.slice(i, mhjs.indexOf('\n}\n', i));
  const a = body.indexOf('mhAppendEvent('), b = body.indexOf('mhMergeLog(');
  return i >= 0 && a >= 0 && b > a;
})());

check('a back swipe cannot leave the screen: the page-wide guard is in place',
  /function installBackNavGuard\(\)/.test(hub) && /addEventListener\('popstate'/.test(hub));
check('and the screen adds the Rounds guards while open, pull-to-refresh included',
  /function openMotorHours\(\) \{\s*showScreen\('screen-motor-hours'\);\s*mhBindGestures\(\);/.test(mhjs) &&
  /function mhExit\(\) \{[\s\S]*?mhUnbindGestures\(\);/.test(mhjs) &&
  /scrollTop === 0 && dy > 8/.test(mhjs));

process.exit(T.done() ? 0 : 1);
