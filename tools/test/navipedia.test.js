'use strict';

// navipedia.html — the Console's Navipedia on the phone, read-only
// (IDMS-Console/docs/navipedia-mobile.md).
//
// Three things fail silently here, and each is checked:
//
//   The pure modules the page draws with are the Console's own, mirrored. A
//   copy that drifts draws a different breaker, a different Tier 2 ranking, a
//   different card — with nothing to say it did. They were born in the
//   Console, so the Console's copy is canonical and these are the mirrors.
//
//   The SOP step tables are parsed on the Console and looked up here by a
//   fingerprint of the block. Change the fingerprint on one side only and
//   every procedure prints as a bare code block.
//
//   The page is read-only by contract. A write — to the vault's mirror on
//   OneDrive or anywhere else — is not something this page may grow.

const fs = require('fs');
const vm = require('vm');
const path = require('path');
const { REPO, findConsole, counter } = require('./_paths');

const T = counter(), check = T.check;

// ── The page's script, minus the line that would start it ───────────────────
const page = fs.readFileSync(path.join(REPO, 'navipedia.html'), 'utf8');
// The first </head>: the script itself writes one into each paper frame.
const open = page.indexOf('<script>', page.indexOf('</head>'));
const src  = page.slice(page.indexOf('>', open) + 1, page.lastIndexOf('</script>'))
                 .replace(/^nvInit\(\);\s*$/m, '');

const noop = () => {};
const sandbox = {
  console, setTimeout, clearTimeout,
  fetch: () => Promise.reject(new Error('no network in tests')),
  localStorage: { getItem: () => null, setItem: noop, removeItem: noop },
  location: { href: 'https://example.invalid/navipedia.html', search: '', hash: '', pathname: '/navipedia.html' },
  history: { pushState: noop, replaceState: noop, back: noop, go: noop },
  document: { getElementById: () => ({ style: {}, textContent: '', innerHTML: '', classList: { add: noop, remove: noop } }),
              querySelectorAll: () => [], addEventListener: noop },
  addEventListener: noop, scrollTo: noop,
  indexedDB: { open: () => { throw new Error('no indexedDB in tests'); } }
};
sandbox.window = sandbox;
vm.createContext(sandbox);
for (const f of ['ksa-view.js', 'navipedia-cards-print.js', 'jsa-form.js', 'electrical-lookup.js', 'diagnostics-ladder.js', 'diagnostics-report.js']) {
  vm.runInContext(fs.readFileSync(path.join(REPO, 'utils', f), 'utf8'), sandbox, { filename: f });
}
vm.runInContext(src, sandbox, { filename: 'navipedia.html' });
const S = sandbox;

console.log('\nthe page loads');
check('with every Console module it draws with', ['ksaView', 'navipediaCardsPrint', 'jsaForm', 'electricalLookup', 'diagnosticsLadder', 'diagnosticsReport']
  .every(k => S[k]));

// ── Read-only ───────────────────────────────────────────────────────────────
console.log('\nread-only');
check('the page never sends a write', !/method\s*:\s*['"](PUT|POST|PATCH|DELETE)/i.test(src));
// Button labels, not prose: the page's own header comment lists what it lacks.
check('and draws none of the Console\'s authoring buttons',
  !/>\s*(Edit|Mark reviewed|New map…?|New trail…?|New JSA…?|Save PDF…?|Print…?|Sign…?|Upkeep|Make workbook…?)\s*</.test(page));

// ── The map reader (navipedia.js npdMarkdown, ported) ───────────────────────
console.log('\nthe map reader');
S.NV.files['range.json'] = {
  ok: true, notes: [], folders: [],
  links: {
    'Below Main Deck': { kind: 'nav', rel: '0.8.1 The Ship/Below Main Deck.md', ambiguous: 0 },
    'SOP-0021-main-engine-start': { kind: 'card', id: 'SOP-0021-main-engine-start', rel: '20 Maintenance/x.md', ambiguous: 0 },
    'Location Register': { kind: 'note', rel: '0 Vessel/0.7 Locations/Location Register.md', ambiguous: 0 },
    '233 General Tanks, Inner Bottom & Cargo Tanks': { kind: 'note', rel: '0 Vessel/0.5 Equipment/233.md', ambiguous: 0 }
  },
  embeds: {
    'SOP-0021-main-engine-start#Hazards': { ok: true, body: '- Hot surfaces', source: 'SOP-0021-main-engine-start › Hazards' },
    'Gone#Nowhere': { ok: false, error: 'No heading “Nowhere” in Gone' }
  }
};
const html = S.nvMarkdown([
  '# Title the header already carries',
  'Go to [[Below Main Deck|the deck map]], read [[SOP-0021-main-engine-start]] and [[Location Register]].',
  'A tank: [[233 General Tanks, Inner Bottom & Cargo Tanks]]. Unwritten: [[Nobody Wrote This]].',
  '',
  '![[SOP-0021-main-engine-start#Hazards]]',
  '![[Gone#Nowhere]]',
  '',
  '> [!warning] Mind the gap',
  '> Body of it',
  '',
  '| A | B |',
  '| --- | --- |',
  '| [[Below Main Deck\\|deck]] | x<br>y |'
].join('\n'), 0);
check('the note\'s own H1 is not repeated', !/Title the header already carries/.test(html));
check('a link to a range page opens the page', /data-note="0\.8\.1 The Ship\/Below Main Deck\.md"[^>]*>the deck map</.test(html));
check('a link to a card opens the card', /data-card="SOP-0021-main-engine-start"/.test(html));
check('a link to a lane note opens the lane note', /data-note="0 Vessel\/0\.7 Locations\/Location Register\.md"/.test(html));
check('a title holding & still resolves (lifted out before escaping)', /data-note="0 Vessel\/0\.5 Equipment\/233\.md"/.test(html));
check('an unwritten link is shown, dashed, never dropped', /class="dangling"[^>]*>Nobody Wrote This</.test(html));
check('an embed shows the lane\'s own words, labelled with where they came from', /class="embed"/.test(html) && /Hot surfaces/.test(html));
check('an embed that does not resolve says why', /Embed does not resolve[\s\S]*No heading “Nowhere”/.test(html));
check('a callout keeps its title on a line of its own', /callout-warning[\s\S]*callout-title">Mind the gap</.test(html));
check('an escaped pipe inside a table cell stays inside its link', /data-note="0\.8\.1 The Ship\/Below Main Deck\.md"[^>]*>deck</.test(html));
check('<br> in a generated table cell survives, and nothing else does', /x<br>y/.test(html) && !/<script/i.test(html));

// ── The step-block fingerprint, against the Console's ───────────────────────
console.log('\nthe step-block fingerprint');
check('matches the known answer the Console is tested against', S.nvFingerprint('') === '811c9dc5-0');
const CON = findConsole();
if (!CON) {
  console.log('  skip no IDMS-Console checkout found. Pass --console <path>.');
} else {
  const pub = fs.readFileSync(path.join(CON, 'src', 'renderer', 'js', 'navipedia-mobile-publish.js'), 'utf8');
  const i = pub.indexOf('function npmFingerprint');
  const ctx = {};
  vm.createContext(ctx);
  vm.runInContext(pub.slice(i, pub.indexOf('\n}\n', i) + 2), ctx);
  const blocks = ['```yaml\n- id: 1\n  step: Stop the engine\n```', 'ÅÆØ — unicode, and a long line '.repeat(40), ''];
  check('and gives the Console\'s answer for every block', blocks.every(b => ctx.npmFingerprint(b) === S.nvFingerprint(b)));

  // ── The mirrored modules ──────────────────────────────────────────────────
  console.log('\nmirrored from the Console');
  for (const f of ['ksa-view.js', 'navipedia-cards-print.js', 'jsa-form.js', 'electrical-lookup.js', 'diagnostics-ladder.js', 'diagnostics-report.js']) {
    check(f + ' is byte-identical with the Console\'s',
      fs.readFileSync(path.join(REPO, 'utils', f)).equals(fs.readFileSync(path.join(CON, 'src', 'renderer', 'js', f))));
  }
  const mob = fs.readFileSync(path.join(CON, 'src', 'main', 'navipedia-mobile.js'), 'utf8');
  const v = mob.match(/const BUNDLE_VERSION = (\d+);/);
  check('the bundle version this page reads is the one the Console publishes', v && Number(v[1]) === S.NV_BUNDLE_VERSION);
}

// ── The door in ─────────────────────────────────────────────────────────────
console.log('\nthe department screen');
const hub = fs.readFileSync(path.join(REPO, 'index.html'), 'utf8');
check('offers Navipedia', /function openNavipedia\(\)/.test(hub) && /location\.href = 'navipedia\.html'/.test(hub));
check('writes the session navipedia.html signs in from before it goes',
  /function openNavipedia\(\) \{\s*try \{ localStorage\.setItem\('fw_session'/.test(hub));
const reach = hub.slice(hub.indexOf('function reachableDepartments'), hub.indexOf('function openProcurement'));
check('and is not a department: a single-department user still goes straight in', reach.length > 0 && !/Navipedia/.test(reach));

process.exit(T.done() ? 0 : 1);
