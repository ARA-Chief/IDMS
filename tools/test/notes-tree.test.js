'use strict';

// The three rows on the Notes sidebar that nobody files into.
//
// To Order, Shipyard and Alerts are reserved folder paths: the Console's yard
// screens write notes at `folder: "Shipyard"`, the alert lane at
// `folder: "Alerts"`, and the Assign board's third tray at `folder: "To Order"`
// — and none of those names is ever stored in notesconfig.json. Both pages
// therefore have to draw those rows from a string held in their own source.
// That is how they went out of step — the Console synthesised them, this page
// drew only what the config held, and the notes sat in the data with no row to
// reach them by. Nothing throws when that happens, and nothing looks wrong; a
// whole band of work is simply absent.
//
// So this suite runs the page's own ntRenderTree over a stub DOM and reads the
// rows out, then checks the reserved strings against the Console's copies —
// all four of them for To Order, which is the one name FOUR files have to
// agree on: both Notes sidebars, the Assign board's tray, and the tray under
// Ours in Requisitions.

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
  check('Engine Room draws a To Order row with nothing configured',
        engine.includes('To Order'), true);
  check('Engine Room draws a Shipyard row with nothing configured',
        engine.includes('Shipyard'), true);
  check('Engine Room draws an Alerts row with nothing configured',
        engine.includes('Alerts'), true);
  check('and all three sit directly under Department notes, above the band',
        engine.slice(0, 4), [null, 'To Order', 'Shipyard', 'Alerts']);

  // A yard is engineering work — the same rule that hides the Shipyard screens
  // from everyone else. The other two are not: alert rules are written per
  // department, and every department buys its own things.
  sandbox.NT.crew.push({ crew_id: 'C2', name: 'B Hand', first_name: 'B', last_name: 'Hand',
                         department: 'Deck', status: 'active', role_id: 'r1', username: 'bhand' });
  sandbox.NT.dept = 'deck';
  sandbox.NT.notesConfig.department_folders.deck = [];
  const deck = folders();
  check('Deck gets an Alerts row too', deck.includes('Alerts'), true);
  check('and a To Order row of its own', deck.includes('To Order'), true);
  check('but no Shipyard row', deck.includes('Shipyard'), false);

  // A config that somehow carries the name must not produce a second row —
  // one with a ✎ and a ✕ on it, offering to rename what the lane writes into.
  sandbox.NT.dept = 'engine';
  sandbox.NT.notesConfig.department_folders.engine = ['Alerts', 'Shipyard', 'To Order', 'Overhauls'];
  const reserved = ['Alerts', 'Shipyard', 'To Order'];
  const dupes = folders().filter(f => reserved.includes(f));
  check('a reserved name in the config is filtered out of the folder band',
        dupes, ['To Order', 'Shipyard', 'Alerts']);
  check('and an ordinary folder beside it still draws',
        folders().includes('Overhauls'), true);

  console.log('\nboth pages name the same strings');
  const CON = findConsole();
  if (!CON) {
    T.note('no IDMS-Console checkout found — the cross-repo half is skipped. ' +
           'Pass --console <path> to run it.');
  } else {
    const read = f => fs.readFileSync(path.join(CON, 'src', 'renderer', 'js', f), 'utf8');
    const conSrc = read('notes.js');
    // Parsed by hand rather than by regex: what is being asserted is that a
    // literal string is the same in two files, and a pattern that quietly
    // matches nothing would report that as a pass on both sides.
    const strIn = (src, name) => {
      const at = src.indexOf('const ' + name);
      if (at < 0) return null;
      const line = src.slice(at, src.indexOf(';', at));
      const a = line.indexOf("'"), b = line.indexOf("'", a + 1);
      return a < 0 || b < 0 ? null : line.slice(a + 1, b);
    };
    const conStr = name => strIn(conSrc, name);
    check('the Alerts folder is the same string Console side',
          conStr('NTC_ALERT_FOLDER'), sandbox.NT_ALERT_FOLDER);
    check('the Shipyard folder is the same string Console side',
          conStr('NTC_YARD_FOLDER'), sandbox.NT_YARD_FOLDER);
    check('and Shipyard is the same department Console side',
          conStr('NTC_YARD_DEPT'), sandbox.NT_YARD_DEPT);
    check('the To Order folder is the same string Console side',
          conStr('NTC_ORDER_FOLDER'), sandbox.NT_ORDER_FOLDER);
    // The two screens that read that pad without being Notes. Neither imports
    // the name — each holds its own copy, for the same reason notes.js does —
    // so a rename in one place and not the others is exactly the silent break
    // this suite exists to catch, and now it has two more places to go wrong.
    check('and the Assign board files into that same folder',
          strIn(read('assignedtasks.js'), 'AT_ORDER_FOLDER'), sandbox.NT_ORDER_FOLDER);
    check('and Requisitions reads that same folder',
          strIn(read('procurement.js'), 'PRC_ORDER_FOLDER'), sandbox.NT_ORDER_FOLDER);
  }
}

process.exit(T.done() ? 0 : 1);
