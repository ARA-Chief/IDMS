'use strict';

// Who gets into Procurement, and who only gets to look.
//
// The gate is written twice — `userIsProcurement()` in `index.html` decides
// whether the department is offered at all, and `pcHasAccess()` in
// `procurement.html` is the authoritative check on the page itself. Two copies
// of one rule is exactly the shape that drifts: widen one and the tile appears
// and then refuses, or widen the other and the tile never shows for the people
// who can now use it. So this suite pulls both out of their pages and asserts
// they answer identically for every crew record, as well as asserting the rule.
//
// The rule (§42.11): admins, the approver roles, anyone carrying Procurement on
// their crew record, and anyone in a department the vessel has opened the
// module to — `settings.access_departments`, which is how the whole engine room
// arrives. Access is not approval; that gate stays where it was.

const { REPO, counter } = require('./_paths');
const fs = require('fs');
const path = require('path');
const T = counter(), check = T.check;

// ── Pull the two gates out of their pages ──────────────────────────────────

function slice(file, from, to) {
  const src = fs.readFileSync(path.join(REPO, file), 'utf8');
  const a = src.indexOf(from), b = src.indexOf(to);
  check(file + ': the gate block is where it was left', a !== -1 && b > a, true);
  return src.slice(a, b);
}

// procurement.html — takes user and cfg as arguments, so it needs no globals
// beyond DEFAULT_CFG and the PC singleton that pcCanApprove reads.
const PC = { user: null, cfg: null };

// The page's own DEFAULT_CFG, lifted from the file rather than restated here.
// No procurementconfig.json has ever been written to OneDrive, so this literal
// is not a fallback — it is what is actually in force on every phone, and a
// stub in its place would let it drift without a test noticing.
const pageSrc = fs.readFileSync(path.join(REPO, 'procurement.html'), 'utf8');
const dStart = pageSrc.indexOf('var DEFAULT_CFG = {');
const dEnd = pageSrc.indexOf('};', dStart);
check('the shipped DEFAULT_CFG is where it was left', dStart !== -1 && dEnd > dStart, true);
const DEFAULT_CFG = new Function(
  pageSrc.slice(dStart, dEnd + 2) + ' return DEFAULT_CFG;')();
const page = new Function('DEFAULT_CFG', 'PC',
  slice('procurement.html', '// §42.11. Admin tier', 'async function pcEnterApp') +
  '\nreturn { pcHasAccess: pcHasAccess, pcCanApprove: pcCanApprove,' +
  '         pcAccessDepartments: pcAccessDepartments };')(DEFAULT_CFG, PC);

// index.html — reads the module-level `currentUser` and a localStorage cache of
// the config, both of which the sandbox owns so the suite can move them.
const store = {};
const hub = new Function('localStorage', 'currentUser',
  slice('index.html', '// ── Procurement gate (§42.11)',
        '// Every department a user can actually reach') +
  '\nreturn { userIsProcurement: userIsProcurement,' +
  '         procAccessDepartments: procAccessDepartments,' +
  '         procApproverRoles: procApproverRoles,' +
  '         setUser: function (u) { currentUser = u; } };')(
  { getItem: function (k) { return (k in store) ? store[k] : null; },
    setItem: function (k, v) { store[k] = v; } }, null);

// Ask both gates the same question. Disagreement is the failure this suite is
// really for, so it is checked on every case rather than in one case of its own.
function admits(label, user, cfg, want) {
  PC.user = user; PC.cfg = cfg;
  if (cfg) store.fw_proccfg = JSON.stringify(cfg); else delete store.fw_proccfg;
  hub.setUser(user);
  const onPage = page.pcHasAccess(user, cfg);
  const onTile = hub.userIsProcurement();
  check(label, onPage, want);
  if (onPage !== onTile) {
    check(label + ' — but the tile gate disagrees with the page gate', onTile, onPage);
  }
}

const SHIPPED = DEFAULT_CFG.settings.access_departments;

T.head('the shipped default');
check('opens the stores to the engine room and the wheelhouse',
  SHIPPED, ['Engine Room', 'Wheelhouse']);
// PROC_DEFAULT_DEPTS in index.html is a second copy of this list. It decides
// whether the tile is offered; the page's copy decides whether it opens.
store.fw_proccfg = '';
check('and the hub ships the very same list', hub.procAccessDepartments(), SHIPPED);

const cfgLive = { settings: { approver_roles: ['Chief Engineer', 'Admin'],
                              access_departments: SHIPPED } };

// ── The change: the engine room is in ──────────────────────────────────────

T.head('anyone in the engine department gets Procurement');

// rgarcia on the live roster: standard tier, a role no approver list names, and
// Engine Room on the record. Before access_departments this user was refused,
// which is the whole reason the list exists.
const engineer = { username: 'rgarcia', role: 'Factory Engineer',
                   permission_tier: 'standard', departments: ['Factory', 'Engine Room'] };
admits('a standard-tier engineer is admitted by the department', engineer, cfgLive, true);

PC.user = engineer; PC.cfg = cfgLive;
check('but cannot approve spend', page.pcCanApprove(), false);

// The wheelhouse is Master, Mate and Purser. Admitting the department admits
// all three, and the purser is the one that had to be decided rather than
// assumed: pursers were excluded from Procurement everywhere until 2026-09-07,
// and the Console said in as many words that opening it to them would be its
// own decision. It was taken — a purser keeping the accounts has more call on
// what was bought than most of the people who could already see it.
T.head('and so does anyone in the wheelhouse');

admits('the master is admitted',
  { username: 'm1', role: 'Master', permission_tier: 'standard',
    departments: ['Wheelhouse'] }, cfgLive, true);
admits('a mate is admitted',
  { username: 'm2', role: 'Mate', permission_tier: 'standard',
    departments: ['Wheelhouse'] }, cfgLive, true);

const purser = { username: 'p1', role: 'Purser', permission_tier: 'standard',
                 departments: ['Wheelhouse'] };
admits('and so is a purser, deliberately', purser, cfgLive, true);

// The reason that was safe. Reading the register and committing money to it
// are different gates, and only the first one moved.
PC.user = purser; PC.cfg = cfgLive;
check('who still cannot approve spend', page.pcCanApprove(), false);

// ── And nobody else moved ──────────────────────────────────────────────────

T.head('the doors that were already open are unchanged');

admits('an admin is still admitted',
  { username: 'admin', role: 'Admin', permission_tier: 'admin', departments: [] },
  cfgLive, true);

admits('an approver role is still admitted',
  { username: 'tploch', role: 'Chief Engineer', permission_tier: 'standard',
    departments: ['Factory'] }, cfgLive, true);

admits('Procurement on the crew record is still admitted',
  { username: 'x', role: 'Storekeeper', permission_tier: 'standard',
    departments: ['Procurement'] }, cfgLive, true);

T.head('and the gate is still a gate');

admits('a factory hand with no engine department is refused',
  { username: 'y', role: 'Processor', permission_tier: 'standard',
    departments: ['Factory'] }, cfgLive, false);

admits('so is a deck hand',
  { username: 'z', role: 'Deckhand', permission_tier: 'standard',
    departments: ['Deck'] }, cfgLive, false);

admits('and a user with no departments at all',
  { username: 'w', role: 'Cook', permission_tier: 'standard', departments: [] },
  cfgLive, false);

check('nobody at all is refused without a user', page.pcHasAccess(null, cfgLive), false);

// ── The list is read, not hard-coded ───────────────────────────────────────

T.head('access_departments is config, not a constant');

const cfgDeck = { settings: { approver_roles: ['Chief Engineer', 'Admin'],
                              access_departments: ['Deck'] } };
admits('a vessel that opens it to Deck admits a deck hand',
  { username: 'z', role: 'Deckhand', permission_tier: 'standard',
    departments: ['Deck'] }, cfgDeck, true);
admits('and refuses the engine room it did not name',
  { username: 'e', role: 'Oiler', permission_tier: 'standard',
    departments: ['Engine Room'] }, cfgDeck, false);

// The live config on OneDrive predates this key. Falling back to nobody would
// mean shipping a change that does nothing until somebody edits a JSON file on
// a boat, so the default stands in until the config carries the key.
T.head('a config without the key falls back to the default, not to nobody');

const cfgOld = { settings: { approver_roles: ['Chief Engineer', 'Admin'] } };
admits('the engine room is admitted against a config that never heard of it',
  { username: 'e', role: 'Oiler', permission_tier: 'standard',
    departments: ['Engine Room'] }, cfgOld, true);
check('and the page names the default when asked',
  page.pcAccessDepartments(cfgOld), SHIPPED);
store.fw_proccfg = JSON.stringify(cfgOld);
check('as does the hub', hub.procAccessDepartments(), SHIPPED);
admits('the wheelhouse comes in the same way',
  { username: 'p1', role: 'Purser', permission_tier: 'standard',
    departments: ['Wheelhouse'] }, cfgOld, true);

// An emptied list, though, means what it says. Clearing the field in Settings
// is the only way to close the module back to roles alone, so reading it as
// "you must have meant the default" would make the setting one-way.
T.head('but an emptied list means closed, not defaulted');

const cfgEmpty = { settings: { approver_roles: ['Chief Engineer', 'Admin'],
                               access_departments: [] } };
check('the page takes an empty list at its word',
  page.pcAccessDepartments(cfgEmpty), []);
store.fw_proccfg = JSON.stringify(cfgEmpty);
check('and so does the hub', hub.procAccessDepartments(), []);
admits('so the engine room is back outside',
  { username: 'e', role: 'Oiler', permission_tier: 'standard',
    departments: ['Engine Room'] }, cfgEmpty, false);
admits('while the approvers it was gated on before still get in',
  { username: 'tploch', role: 'Chief Engineer', permission_tier: 'standard',
    departments: ['Engine Room'] }, cfgEmpty, true);

// The neighbouring list does not work that way, and the difference is the point:
// a config naming no approver is broken, a config naming no department is not.
store.fw_proccfg = JSON.stringify(
  { settings: { approver_roles: [], access_departments: [] } });
check('an emptied approver list still falls back, because someone must approve',
  hub.procApproverRoles(), ['Chief Engineer', 'Admin']);

process.exit(T.done() ? 0 : 1);
