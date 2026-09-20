'use strict';

// Where a note is listed, over the notes page's own functions (§41.4f, §41.6d).
//
// Two rules landed together and both fail SILENTLY:
//
//   A note filed against a machine leaves the lists it merely fell into for the
//   Equipment pad, and KEEPS the folder it was put in. Key the rule off the
//   equipment CODE instead of the note's TYPE and every alert, every Offload
//   List row and every To Order line that happens to name a machine disappears
//   from the pad people work off — nothing throws, the list is simply short.
//   Key it off the type but forget that a note can be typed Equipment before it
//   names a machine, and that note leaves every list for a tree of codes it has
//   no code to hang under: it exists, and it is reachable from nowhere. Forget
//   the folder and `Rounds` empties under the people who file into it.
//
//   Recents mirrors the last ten notes edited. Sorted on the wrong field, or
//   through ntSortNotes like every other list, it still renders ten rows —
//   just not the ten that were edited.
//
// The Console runs the same two rules over SQLite rows rather than a replay in
// memory (tools/test-notes-views.js there). Both read them out of the canonical
// reducer, and the last block below checks that neither has grown a second
// opinion in its own source.

const fs = require('fs');
const vm = require('vm');
const path = require('path');
const { REPO, findConsole, counter } = require('./_paths');

const T = counter(), check = T.check;

// ── The page's script, minus the one line that would start it ──────────────
const page = fs.readFileSync(path.join(REPO, 'notes.html'), 'utf8');
const open = page.indexOf('<script>', page.lastIndexOf('</head>'));
const src  = page.slice(page.indexOf('>', open) + 1, page.lastIndexOf('</script>'))
                 .replace(/^ntInit\(\);\s*$/m, '');

const tree = { innerHTML: '' };
const noop = () => {};
const el = () => ({ innerHTML: '', textContent: '', style: {}, dataset: {},
                    classList: { add: noop, remove: noop, contains: () => false },
                    addEventListener: noop, appendChild: noop, focus: noop });
const sandbox = {
  console,
  setTimeout, clearTimeout, setInterval, clearInterval,
  fetch: () => Promise.reject(new Error('no network in tests')),
  localStorage: { getItem: () => null, setItem: noop, removeItem: noop },
  navigator: { onLine: true, serviceWorker: { register: () => Promise.reject(new Error('none')) } },
  location: { href: 'https://example.invalid/notes.html', search: '', hash: '' },
  document: {
    getElementById: id => (id === 'tree' ? tree : el()),
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener: noop,
    createElement: el,
    body: el(),
    title: ''
  }
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;

// The real reducer, not a stub: isFiledAgainstEquipment and byRecency are the
// rules under test, and a stub would only prove the page calls something.
vm.createContext(sandbox);
new vm.Script(fs.readFileSync(path.join(REPO, 'utils', 'notes-reduce.js'), 'utf8'),
              { filename: 'notes-reduce.js' }).runInContext(sandbox);

let loaded = true;
try {
  new vm.Script(src, { filename: 'notes.html' }).runInContext(sandbox);
} catch (e) {
  loaded = false;
  check('the page script loads outside a browser', false);
  T.note(String(e && e.message));
}

if (loaded) {
  const NT = sandbox.NT;

  // ── A boat's worth of notes, in the reducer's own shape ────────────────
  const note = o => Object.assign({
    note_id: o.note_id, title: o.note_id, body: '',
    scope: { level: 'department', department: 'engine' },
    folder: null, equipment_code: null, assignment: 'unassigned', assignees: [],
    steps: [], attachments: [], comments: [], completions: [],
    starred: false, sort_index: null, completed: false, archived: false,
    deleted: false, merged_into: null, task_id: null, group_alert: false,
    author: 'wostara', origin: 'manual',
    created: '2026-09-01T00:00:00.000Z', updated: '2026-09-01T00:00:00.000Z'
  }, o);

  const NOTES = [
    note({ note_id: 'plain', updated: '2026-09-02T00:00:00.000Z' }),
    note({ note_id: 'filed', folder: 'Overhauls', updated: '2026-09-03T00:00:00.000Z' }),
    // Names a machine and is still the department's to read. This is the row
    // that vanishes if the rule keys off the code.
    note({ note_id: 'alert', folder: 'Alerts', origin: 'alert', equipment_code: '601.001',
           updated: '2026-09-04T00:00:00.000Z' }),
    // Assignable AND coded — the shape a note needs so the service report it is
    // promoted into arrives with the machine already in it.
    note({ note_id: 'offload', folder: 'Offload List', assignment: 'assignable',
           equipment_code: '601.002', updated: '2026-09-05T00:00:00.000Z' }),
    // Equipment-typed, with a machine: moved.
    note({ note_id: 'eq-me', assignment: 'equipment', equipment_code: '601.001.003',
           folder: 'Rounds', updated: '2026-09-06T00:00:00.000Z' }),
    // Equipment-typed and naming NO machine: nowhere in the pad to hang, so it
    // has not moved.
    note({ note_id: 'eq-none', assignment: 'equipment', updated: '2026-09-07T00:00:00.000Z' }),
    note({ note_id: 'mine', scope: { level: 'crew', department: 'engine', owner_crew_id: 'C1' },
           updated: '2026-09-08T00:00:00.000Z' }),
    note({ note_id: 'factory', scope: { level: 'department', department: 'factory' },
           updated: '2026-09-09T00:00:00.000Z' }),
    note({ note_id: 'global', scope: { level: 'general' }, updated: '2026-09-10T00:00:00.000Z' })
  ];

  NT.notes = {};
  NOTES.forEach(n => { NT.notes[n.note_id] = n; });
  NT.crew = [
    { crew_id: 'C1', name: 'A Hand', department: 'Engine Room', status: 'active', role_id: 'r1', username: 'ahand' },
    { crew_id: 'C2', name: 'B Hand', department: 'Factory',     status: 'active', role_id: 'r1', username: 'bhand' }
  ];
  NT.dept = 'engine';
  NT.meCrewId = 'C1';
  NT.user = { username: 'ahand' };
  NT.notesConfig = { department_heads: {}, department_folders: { engine: ['Overhauls', 'Rounds'] }, templates: [] };

  const listOf = view => {
    NT.view = view;
    return sandbox.ntVisibleNotes().map(n => n.note_id);
  };

  T.head('a note filed against a machine leaves the ordinary lists');
  check('the department list drops it',
        listOf({ kind: 'department', owner: null, folder: null }), ['eq-none', 'plain']);
  check('an ordinary folder is untouched',
        listOf({ kind: 'department', owner: null, folder: 'Overhauls' }), ['filed']);

  T.head('but the folder it was FILED in keeps it');
  // Filing is an act. Somebody chose `Rounds` — or the phone did, on their
  // behalf — and emptying it is the app overruling them. The note is in the
  // folder AND under its machine; still one note, with one completion.
  check('Rounds still holds the rounds comment filed there',
        listOf({ kind: 'department', owner: null, folder: 'Rounds' }), ['eq-me']);
  check('and the pad holds it as well',
        listOf({ kind: 'equipment', owner: '601.001.003', folder: null }).includes('eq-me'), true);
  check('while the top-level list, where nobody put it, does not',
        listOf({ kind: 'department', owner: null, folder: null }).includes('eq-me'), false);
  check('nor does a different folder',
        listOf({ kind: 'department', owner: null, folder: 'Overhauls' }).includes('eq-me'), false);
  check('and the folder row carries a count again',
        sandbox.ntCounts({ kind: 'department', owner: null, folder: 'Rounds' }).open, 1);

  T.head('but a note that merely names a machine stays where it is');
  check('the Alerts pad still holds the alert about 601.001',
        listOf({ kind: 'department', owner: null, folder: 'Alerts' }), ['alert']);
  check('and the Offload List still holds its assignable row',
        listOf({ kind: 'department', owner: null, folder: 'Offload List' }), ['offload']);
  check('a note typed Equipment that names no machine has not moved',
        listOf({ kind: 'department', owner: null, folder: null }).includes('eq-none'), true);

  T.head('the Equipment pad is where the moved notes are, and more besides');
  check('a code lists what is filed at it and everything under it',
        listOf({ kind: 'equipment', owner: '601', folder: null }),
        ['eq-me', 'offload', 'alert']);
  check('a leaf lists only itself',
        listOf({ kind: 'equipment', owner: '601.001.003', folder: null }), ['eq-me']);
  check('the tree is built from the codes in reach',
        sandbox.ntEqCodesInUse().sort(), ['601.001', '601.001.003', '601.002']);

  T.head('Recents mirrors what was last edited');
  check('the department mirror is this department plus General, newest first',
        listOf({ kind: 'recent', owner: 'dept', folder: null }),
        ['global', 'mine', 'eq-none', 'eq-me', 'offload', 'alert', 'filed', 'plain']);
  check('it does not reach the factory’s notes',
        listOf({ kind: 'recent', owner: 'dept', folder: null }).includes('factory'), false);
  check('and the vessel-wide one does',
        listOf({ kind: 'recent', owner: 'vessel', folder: null }).slice(0, 3),
        ['global', 'factory', 'mine']);
  // The pad's notes are mirrored too: the pad is where they LIVE, and this is a
  // record of what has just been touched.
  check('a note that moved to the pad is still mirrored',
        listOf({ kind: 'recent', owner: 'dept', folder: null }).includes('eq-me'), true);

  // The cap is what makes it a mirror rather than a second list of everything.
  const many = {};
  for (let i = 0; i < 20; i++) {
    const n = note({ note_id: 'n' + i,
                     updated: '2026-10-' + String(i + 1).padStart(2, '0') + 'T00:00:00.000Z' });
    many[n.note_id] = n;
  }
  const real = NT.notes;
  NT.notes = many;
  check('never more than RECENT_LIMIT rows',
        listOf({ kind: 'recent', owner: 'vessel', folder: null }).length,
        sandbox.notesReduce.RECENT_LIMIT);
  check('and they are the newest, not the first found',
        listOf({ kind: 'recent', owner: 'vessel', folder: null })[0], 'n19');

  // A star must not jump a mirror: the list answers "what was touched", and the
  // §41.4c order would quietly make it answer something else.
  NT.notes = {
    'starred-old': note({ note_id: 'starred-old', starred: true, updated: '2026-08-01T00:00:00.000Z' }),
    'plain-new':   note({ note_id: 'plain-new', updated: '2026-10-01T00:00:00.000Z' })
  };
  check('a star does not jump the queue in a mirror',
        listOf({ kind: 'recent', owner: 'vessel', folder: null }), ['plain-new', 'starred-old']);
  check('while it still does in an ordinary list',
        listOf({ kind: 'department', owner: null, folder: null }), ['starred-old', 'plain-new']);
  NT.notes = real;

  T.head('a mirror counts nothing, and is not a place');
  check('no badge on a Recents row',
        sandbox.ntCounts({ kind: 'recent', owner: 'dept', folder: null }), { open: 0, mine: 0 });
  check('and nothing is ever "in" one',
        sandbox.ntInView(NOTES[0], { kind: 'recent', owner: 'vessel', folder: null }), false);

  T.head('a row in a mirror says which list it came out of');
  const where = id => sandbox.ntWhereNoteLives(NT.notes[id]);
  check('a folder',      where('filed'),  'Engine Room · Overhauls');
  check('the top level', where('plain'),  'Engine Room');
  check('General',       where('global'), 'General');
  check('a person',      where('mine'),   'Engine Room · A');
  // Filed in `Rounds`, so it is in two lists and the folder is the one the ⚙
  // chip beside it does not already name.
  check('the pad, filed',   where('eq-me'),  'Engine Room · Rounds');
  // Not the pad: it names a machine but it has not moved, and saying it lives
  // in the pad would send somebody to a list it is not in.
  check('an alert that names a machine still reads as the Alerts pad',
        where('alert'), 'Engine Room · Alerts');

  T.head('the sidebar draws both mirrors');
  NT.view = { kind: 'department', owner: null, folder: null };
  NT.showEquipment = false;
  sandbox.ntRenderTree();
  const views = [...tree.innerHTML.matchAll(/data-view='([^']*)'/g)]
    .map(m => JSON.parse(m[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&')))
    .filter(v => v.kind === 'recent')
    .map(v => v.owner);
  check('one vessel-wide and one for the department, in that order',
        views, ['vessel', 'dept']);

  // ── Neither renderer may grow a second opinion ────────────────────────
  T.head('both sides read the rule out of the reducer');
  check('the page asks isFiledAgainstEquipment and nothing else',
        /notesReduce\.isFiledAgainstEquipment\(/.test(src), true);
  check('and takes its cap from the reducer too',
        /notesReduce\.RECENT_LIMIT/.test(src), true);

  const CON = findConsole();
  if (!CON) {
    T.note('no IDMS-Console checkout found — the cross-repo half is skipped. ' +
           'Pass --console <path> to run it.');
  } else {
    const conSrc = fs.readFileSync(path.join(CON, 'src', 'renderer', 'js', 'notes.js'), 'utf8');
    check('the Console asks the same question',
          /notesReduce\.isFiledAgainstEquipment\(/.test(conSrc), true);
    check('and takes the same cap',
          /notesReduce\.RECENT_LIMIT/.test(conSrc), true);
    // A local re-derivation is the failure mode this block exists to catch:
    // one side deciding for itself what "filed against equipment" means is how
    // the two screens stop being the same screen.
    check('and neither re-derives it from the assignment field',
          /assignment\s*===\s*'equipment'/.test(conSrc), false);
    check('nor the page', /assignment\s*===\s*'equipment'/.test(src), false);
    // The folder exemption is the half most easily dropped on one side — both
    // clients must ask hiddenByPad rather than isFiledAgainstEquipment when
    // deciding what an ordinary list draws.
    check('the Console asks hiddenByPad for what a list draws',
          /notesReduce\.hiddenByPad\(/.test(conSrc), true);
    check('and so does the page', /notesReduce\.hiddenByPad\(/.test(src), true);
    // Both mirrors have to exist on both sides, or one screen has a row the
    // other does not and "it's in Recents" stops meaning anything.
    check('the Console draws a vessel-wide mirror',
          /ntcSideItem\('recent', 'vessel'/.test(conSrc), true);
    check('and a department one',
          /ntcSideItem\('recent', 'dept'/.test(conSrc), true);
  }
}

process.exit(T.done() ? 0 : 1);
