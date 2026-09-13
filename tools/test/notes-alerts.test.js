'use strict';

// Who the hub tells about a note (§41.7), run over the page's own
// ntaComputeAlerts and the real reducer.
//
// Two folders notify by being landed in rather than by naming anyone: the
// department's Alerts pad, and the engine room's Offload List. The failure this
// guards against does not throw — a folder that stops notifying just goes
// quiet, and a list of offload work nobody was told about looks exactly like a
// list nobody needed.

const fs = require('fs');
const vm = require('vm');
const path = require('path');
const { REPO, counter } = require('./_paths');
const REDUCER = path.join(REPO, 'utils', 'notes-reduce.js');

const T = counter(), check = T.check;

// The function and the constants it reads, lifted out of index.html by name.
// Line endings normalised so the function boundary is found on either.
const page = fs.readFileSync(path.join(REPO, 'index.html'), 'utf8').split('\r\n').join('\n');
function lift(startMarker) {
  const at = page.indexOf(startMarker);
  if (at < 0) return null;
  if (startMarker.startsWith('var ')) return page.slice(at, page.indexOf(';', at) + 1);
  // A function: up to the first line that is a lone closing brace.
  const end = page.indexOf('\n}\n', at);
  return end < 0 ? null : page.slice(at, end + 3);
}
const parts = [
  'var DEPT_FILE_MAP', 'var NTA_ALERT_FOLDER', 'var NTA_OFFLOAD_DEPT', 'var NTA_OFFLOAD_FOLDER',
  'function ntaAlertWhy(', 'function ntaComputeAlerts('
].map(lift);

if (parts.some(p => !p)) {
  check('the alert check and its constants can be found in index.html', false);
  process.exit(T.done() ? 0 : 1);
}

const sandbox = { console, module: { exports: {} } };
sandbox.window = sandbox;
vm.createContext(sandbox);
new vm.Script(fs.readFileSync(REDUCER, 'utf8'), { filename: 'notes-reduce.js' }).runInContext(sandbox);
if (!sandbox.notesReduce) sandbox.notesReduce = sandbox.module.exports;
new vm.Script(parts.join('\n') + '\nthis.ntaComputeAlerts = ntaComputeAlerts;',
              { filename: 'index.html (lifted)' }).runInContext(sandbox);

let seq = 0;
const ev = (type, payload, actor) => {
  seq++;
  const ts = '2026-09-12T10:' + String(seq).padStart(2, '0') + ':00.000Z';
  return { event_id: 'e' + seq, event_type: type, actor: actor || 'wostara', timestamp: ts,
           _fn: ts.replace(/[:.\-]/g, '') + '-e' + seq + '.json', payload };
};
const created = (id, folder, dept, extra) => ev('note_created', Object.assign({
  note_id: id, title: id, scope: { level: 'department', department: dept }, folder: folder, origin: 'manual'
}, extra || {}));

function alertsFor(user, events) {
  sandbox.currentUser = user;
  sandbox.NTA = { events };
  return sandbox.ntaComputeAlerts().map(i => i.note.note_id).sort();
}

const oiler  = { username: 'oiler1', departments: ['Engine Room'] };
const deckie = { username: 'deck1',  departments: ['Deck'] };

console.log('\nthe Offload List tells the engine room');

const pushed = [
  created('ofl-1', 'Offload List', 'engine', { origin: 'offload', assignment: 'assignable' }),
  created('ofl-2', 'Offload List', 'engine', { origin: 'offload', assignment: 'assignable' }),
  created('plain', null, 'engine')
];
check('a note pushed into the Offload List alerts an engine hand',
      alertsFor(oiler, pushed), ['ofl-1', 'ofl-2']);
check('and not a deck hand', alertsFor(deckie, pushed), []);

const moved = pushed.concat([
  ev('note_edited', { note_id: 'plain', patch: { folder: 'Offload List' }, before: { folder: null } })
]);
check('a note MOVED into the Offload List alerts the engine room too',
      alertsFor(oiler, moved), ['ofl-1', 'ofl-2', 'plain']);

check('one hand acknowledging does not silence the rest',
      alertsFor(oiler, moved.concat([ev('alert_acked', { targets: ['ofl-1'] }, 'oiler2')])),
      ['ofl-1', 'ofl-2', 'plain']);
check('and their own ack clears it for them',
      alertsFor(oiler, moved.concat([ev('alert_acked', { targets: ['ofl-1'] }, 'oiler1')])),
      ['ofl-2', 'plain']);

check('a completed or archived offload note stops alerting',
      alertsFor(oiler, moved.concat([ev('note_completed', { note_id: 'ofl-1' }),
                                     ev('note_archived',  { note_id: 'ofl-2' })])),
      ['plain']);

// The folder is the engine room's. A deck folder that happens to share the name
// is ordinary filing and addresses nobody.
check('a deck folder of the same name notifies nobody',
      alertsFor(deckie, [created('d1', 'Offload List', 'deck')]), []);

console.log('\nthe Alerts pad still behaves as before');
check('an Alerts note reaches its own department',
      alertsFor(deckie, [created('a1', 'Alerts', 'deck')]), ['a1']);
check('and only its own', alertsFor(oiler, [created('a1', 'Alerts', 'deck')]), []);

process.exit(T.done() ? 0 : 1);
