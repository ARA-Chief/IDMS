'use strict';

// The two rows on the Notes sidebar that nobody files into.
//
// Shipyard and Alerts are reserved folder paths: the Console's yard screens and
// the alert lane write notes at `folder: "Shipyard"` and `folder: "Alerts"`,
// and neither name is ever stored in notesconfig.json. Both pages therefore
// have to draw those rows from a string held in their own source. That is how
// they went out of step — the Console synthesised both, this page drew only
// what the config held, and the notes sat in the data with no row to reach
// them by. Nothing throws when that happens, and nothing looks wrong; a whole
// band of work is simply absent.
//
// So this suite runs the page's own ntRenderTree over a stub DOM and reads the
// rows out, then checks the reserved strings against the Console's copy.

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

// Enough DOM for the tree to render into and for the module scope to load.
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
  },
  notesReduce: { isAssignedTo: () => false, hasAttachments: () => false }
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;

let loaded = true;
try {
  vm.createContext(sandbox);
  new vm.Script(src, { filename: 'notes.html' }).runInContext(sandbox);
} catch (e) {
  loaded = false;
  check('the page script loads outside a browser', false);
  T.note(String(e && e.message));
}

if (loaded) {
  console.log('\nthe reserved rows are drawn, not configured');

  // One engineer, so the Engine Room is a department the tree knows about.
  sandbox.NT.crew = [{ crew_id: 'C1', name: 'A Hand', first_name: 'A', last_name: 'Hand',
                       department: 'Engine Room', status: 'active', role_id: 'r1', username: 'ahand' }];
  sandbox.NT.notes = {};
  sandbox.NT.dept = 'engine';
  sandbox.NT.view = { kind: 'department', owner: null, folder: null };
  sandbox.NT.showEquipment = false;
  // Deliberately empty: neither reserved name is ever stored here, which is
  // the whole reason the rows have to come from the source.
  sandbox.NT.notesConfig = { department_heads: {}, department_folders: { engine: [] }, templates: [] };

  const folders = () => {
    sandbox.ntRenderTree();
    const out = [];
    const re = /data-view='([^']*)'/g;
    let m;
    while ((m = re.exec(tree.innerHTML))) {
      const v = JSON.parse(m[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&'));
      if (v.kind === 'department') out.push(v.folder);
    }
    return out;
  };

  const engine = folders();
  check('Engine Room draws a Shipyard row with nothing configured',
        engine.includes('Shipyard'), true);
  check('Engine Room draws an Alerts row with nothing configured',
        engine.includes('Alerts'), true);
  check('and both sit directly under Department notes, above the band',
        engine.slice(0, 3), [null, 'Shipyard', 'Alerts']);

  // A yard is engineering work — the same rule that hides the Shipyard screens
  // from everyone else. Alerts is not: the rules are written per department.
  sandbox.NT.crew.push({ crew_id: 'C2', name: 'B Hand', first_name: 'B', last_name: 'Hand',
                         department: 'Deck', status: 'active', role_id: 'r1', username: 'bhand' });
  sandbox.NT.dept = 'deck';
  sandbox.NT.notesConfig.department_folders.deck = [];
  const deck = folders();
  check('Deck gets an Alerts row too', deck.includes('Alerts'), true);
  check('but no Shipyard row', deck.includes('Shipyard'), false);

  // A config that somehow carries the name must not produce a second row —
  // one with a ✎ and a ✕ on it, offering to rename what the lane writes into.
  sandbox.NT.dept = 'engine';
  sandbox.NT.notesConfig.department_folders.engine = ['Alerts', 'Shipyard', 'Overhauls'];
  const dupes = folders().filter(f => f === 'Alerts' || f === 'Shipyard');
  check('a reserved name in the config is filtered out of the folder band',
        dupes, ['Shipyard', 'Alerts']);
  check('and an ordinary folder beside it still draws',
        folders().includes('Overhauls'), true);

  console.log('\nboth pages name the same strings');
  const CON = findConsole();
  if (!CON) {
    T.note('no IDMS-Console checkout found — the cross-repo half is skipped. ' +
           'Pass --console <path> to run it.');
  } else {
    const conSrc = fs.readFileSync(path.join(CON, 'src', 'renderer', 'js', 'notes.js'), 'utf8');
    // Parsed by hand rather than by regex: what is being asserted is that a
    // literal string is the same in two files, and a pattern that quietly
    // matches nothing would report that as a pass on both sides.
    const conStr = name => {
      const at = conSrc.indexOf('const ' + name);
      if (at < 0) return null;
      const line = conSrc.slice(at, conSrc.indexOf(';', at));
      const a = line.indexOf("'"), b = line.indexOf("'", a + 1);
      return a < 0 || b < 0 ? null : line.slice(a + 1, b);
    };
    check('the Alerts folder is the same string Console side',
          conStr('NTC_ALERT_FOLDER'), sandbox.NT_ALERT_FOLDER);
    check('the Shipyard folder is the same string Console side',
          conStr('NTC_YARD_FOLDER'), sandbox.NT_YARD_FOLDER);
    check('and Shipyard is the same department Console side',
          conStr('NTC_YARD_DEPT'), sandbox.NT_YARD_DEPT);
  }
}

process.exit(T.done() ? 0 : 1);
