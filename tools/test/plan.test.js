'use strict';

// Synthetic exercise of §43's derivation. Proves the rules the spec states:
// the three demand rings and their order, the one-level asset join, the
// level vocabulary defects, provisional sign-offs, the two currencies kept
// apart on a refresh row, unassessable targets kept out of Now/Next, and the
// vessel view's uncovered / single-holder / no-assessor findings.
const path = require('path');
const { REPO, counter } = require('./_paths');
const P = require(path.join(REPO, 'utils', 'plan-derive.js'));
const T = counter(), check = T.check;

const NOW = '2026-09-07';

// ── vocabulary ───────────────────────────────────────────────────────────────
T.head('vocabulary');
check('canonical word', P.normalizeLevel('independent').level, 3);
check('alias applied and named', P.normalizeLevel('assisted'), { level: 2, applied: 'supervised' });
check('unknown word is null', P.normalizeLevel('expert').level, null);
check('digit accepted', P.normalizeLevel('4').level, 4);

const pr = P.parseRequires([
  '[[SKD-0029-main-engine-starting]]: independent',
  '[[SKD-0046-refrigeration]]: assisted',
  '[[KNG-0043-battery-maintenance-fundamentals]]: independent',
  '[[SKG-0001-multimeter-use]]',
  '[[JOB-601-nonsense]]: aware'
], 'SOP-TEST');
check('signable at canonical level', pr.requires[0], { id: 'SKD-0029-main-engine-starting', level: 3 });
check('alias normalised to supervised', pr.requires[1], { id: 'SKD-0046-refrigeration', level: 2 });
check('alias reported as a defect', pr.defects.some(d => d.kind === 'level-vocabulary' && d.applied === 'supervised'));
check('knowledge moved out, no level', pr.requires_knowledge, ['KNG-0043-battery-maintenance-fundamentals']);
check('knowledge-at-level reported', pr.defects.some(d => d.kind === 'knowledge-at-level'));
check('missing level defaults to independent and is reported', pr.requires[2].level === 3 && pr.defects.some(d => d.kind === 'level-missing'));
check('non-signable target dropped and reported', pr.requires.length === 3 && pr.defects.some(d => d.kind === 'not-signable'));
const pq = P.parseRequires(['\\"[[KSA-P002-loto-sequencing]]: independent\\"'], 'SOP-Q');
check('escaped YAML quotes are read past and named as a quoting defect',
  pq.requires[0].level === 3 && pq.defects.length === 1 && pq.defects[0].kind === 'quoting');

// ── asset join ───────────────────────────────────────────────────────────────
T.head('asset join');
check('equal code matches', P.assetMatches('601.001', '601.001'), true);
check('one level under matches', P.assetMatches('601.001.027', '601.001'), true);
check('two levels under does not', P.assetMatches('601.001.027.001', '601.001'), false);
check('parent does not match child card', P.assetMatches('601.001', '601.001.027'), false);
check('asset code from label', P.assetCode('601.001 Main Engine'), '601.001');
check('non-numeric asset is global', P.assetCode('[VERIFY] unknown'), '');

T.head('dates');
check('iso', P.parseDate('2026-09-12'), '2026-09-12');
check('tm dotted', P.parseDate('12.09.2026'), '2026-09-12');
check('us slash', P.parseDate('9/12/2026'), '2026-09-12');
check('d Mon yyyy', P.parseDate('12 Sep 2026'), '2026-09-12');
check('garbage is null', P.parseDate('soon'), null);

// ── fixtures ─────────────────────────────────────────────────────────────────
const registry = { cards: [
  { id: 'SKD-0029-main-engine-starting', label: 'Main engine starting', kind: 'SKD', category: 'Machinery', revised: '2026-08-27', has_expectations: true, requires_ksa: ['[[KSA-P002-loto-sequencing]]'] },
  { id: 'KSA-P002-loto-sequencing', label: 'LO/TO sequencing', kind: 'KSA', category: 'General', revised: '2026-08-22', has_expectations: true, requires_ksa: [] },
  { id: 'SKG-0001-multimeter-use', label: 'Multimeter use', kind: 'SKG', category: 'Electrical', revised: '2026-08-23', has_expectations: true, requires_ksa: [] },
  { id: 'SKD-0046-refrigeration', label: 'Refrigeration compressors', kind: 'SKD', category: 'Refrigeration', revised: null, has_expectations: false, requires_ksa: [] },
  { id: 'SKG-0060-grease-gun-use', label: 'Grease gun use', kind: 'SKG', category: 'Machinery', revised: '2026-08-23', has_expectations: true, requires_ksa: [] }
]};
const demand = { cards: [
  { id: 'SOP-0021-main-engine-start', kind: 'SOP', title: 'Main engine start', asset_code: '601.001', tags: ['engine-room'],
    requires: [{ id: 'SKD-0029-main-engine-starting', level: 3 }, { id: 'KSA-P002-loto-sequencing', level: 3 }] },
  { id: 'SOP-0033-battery-check', kind: 'SOP', title: 'Battery charger weekly check', asset_code: '812.001', tags: ['engine-room'],
    requires: [{ id: 'SKG-0001-multimeter-use', level: 2 }] },
  { id: 'SOP-0071-blackout', kind: 'SOP', title: 'Blackout recovery', asset_code: '', tags: ['engine-room'],
    requires: [{ id: 'SKD-0046-refrigeration', level: 2 }] },
  { id: 'SOP-0099-factory-thing', kind: 'SOP', title: 'Factory card', asset_code: '492.050', tags: ['factory'],
    requires: [{ id: 'SKG-0060-grease-gun-use', level: 3 }] },
  { id: 'JOB-601-ignored', kind: 'JOB', title: 'A job', asset_code: '601.001', tags: ['engine-room'],
    requires: [{ id: 'SKG-0060-grease-gun-use', level: 4 }] }
], defects: [] };
const member = { crew_id: 'c-1', username: 'jdoe', name: 'J. Doe', role: 'Oiler', department: 'Engine Room' };
const tasks = [
  { task_id: 't-assigned', title: 'Start ME after service', equipment_ids: ['601.001'], assigned_to: 'jdoe', status: 'open', department: 'Engine Room', due_date: '2026-10-01' },
  { task_id: 't-due', title: 'Weekly charger check', equipment_ids: ['812.001.003'], assigned_to: '', status: 'open', department: 'Engine Room', tm_due: '20.09.2026' },
  { task_id: 't-far', title: 'Far-off charger check', equipment_ids: ['812.001.003'], assigned_to: '', status: 'open', department: 'Engine Room', tm_due: '2027-03-01' },
  { task_id: 't-done', title: 'Old job', equipment_ids: ['601.001'], assigned_to: 'jdoe', status: 'completed', department: 'Engine Room' },
  { task_id: 't-deep', title: 'Too deep to reach 601.001', equipment_ids: ['601.001.027.001'], assigned_to: 'jdoe', status: 'open', department: 'Engine Room' },
  { task_id: 't-other', title: 'Factory task', equipment_ids: ['492.050'], assignees: ['c-9'], status: 'open', department: 'Factory', due_date: '2026-09-10' }
];

// ── plan: a member with nothing signed ───────────────────────────────────────
T.head('plan — nothing held');
let plan = P.derivePlan({ member, tasks, demand, registry, signoffs: {}, currency: null, config: {}, now: NOW });
const ids = g => g.map(r => r.id);
check('assigned ring demands both ME cards, LOTO first by depth', ids(plan.now).slice(0, 2), ['KSA-P002-loto-sequencing', 'SKD-0029-main-engine-starting']);
check('due ring reaches the charger card inside the window', ids(plan.now).includes('SKG-0001-multimeter-use'));
check('now group is exactly those three', plan.now.length, 3);
check('completed task adds nothing', plan.now.every(r => !r.demanded_by.some(d => d.task_id === 't-done')));
check('two-level-deep task adds nothing', plan.now.every(r => !r.demanded_by.some(d => d.task_id === 't-deep')));
check('far-off task is outside the window', plan.now.every(r => !r.demanded_by.some(d => d.task_id === 't-far')));
check('factory task is not this department', plan.now.every(r => !r.demanded_by.some(d => d.task_id === 't-other')));
check('ring recorded as assigned', plan.now[0].ring, 'assigned');
check('demanded_by names the task and its due', plan.now[0].demanded_by[0].task_id === 't-assigned' && plan.now[0].demanded_by[0].due === '2026-10-01');
check('missing state', plan.now[0].state, 'missing');
check('baseline ring via tag: grease gun is factory-only, absent', !ids(plan.next).includes('SKG-0060-grease-gun-use'));
check('JOB cards are not demand cards', !plan.next.concat(plan.now).some(r => r.demanded_by.some(d => d.card_id === 'JOB-601-ignored')));
check('stub target is unassessable, not in now', ids(plan.unassessable), ['SKD-0046-refrigeration']);
check('summary counts, no percentage anywhere', plan.summary, { now: 3, next: 0, refresh: 0, unassessable: 1 });
check('currency unknown reported', plan.currency_known, false);
check('unknown currency never reads stale', plan.now.every(r => r.practice.unknown && !r.practice.stale));

// ── plan: held, partial, provisional ─────────────────────────────────────────
T.head('plan — sign-offs');
const signoffs = {
  'SKD-0029': { level: 3, date: '2026-08-30', method: 'observed-work', author: { name: 'W. Ostara' } },   // short id resolves
  'KSA-P002-loto-sequencing': { level: 2, date: '2026-08-25', method: 'workbook-import' },
  'SKG-0001-multimeter-use': { level: 3, date: '2026-08-01', method: 'workbook-import' }
};
plan = P.derivePlan({ member, tasks, demand, registry, signoffs, currency: null, config: {}, now: NOW });
check('short id resolved to the registry slug and held', !ids(plan.now).includes('SKD-0029-main-engine-starting'));
check('LOTO partial: holds 2, needs 3', plan.now.find(r => r.id === 'KSA-P002-loto-sequencing').state, 'partial');
check('provisional flagged', plan.now.find(r => r.id === 'KSA-P002-loto-sequencing').provisional, true);
check('multimeter signed 08-01 before card revised 08-23 → refresh for revision', plan.refresh.map(r => [r.id, r.reasons]), [['SKG-0001-multimeter-use', ['revision']]]);

plan = P.derivePlan({ member, tasks, demand, registry, signoffs, currency: null,
  config: { plan: { 'Engine Room': { provisional_counts: false } } }, now: NOW });
check('provisional_counts:false — multimeter now missing for the gap, still shows its level',
  plan.now.find(r => r.id === 'SKG-0001-multimeter-use').state === 'partial' &&
  plan.now.find(r => r.id === 'SKG-0001-multimeter-use').held_level === 3);

// ── currencies ───────────────────────────────────────────────────────────────
T.head('two currencies');
const currency = { byCompetency: {
  'SKD-0029-main-engine-starting': { last: '2024-01-15', via: 'equipment', n: 2 },     // outside 24 months
  'SKG-0001-multimeter-use': { last: '2026-09-01', via: 'tool', n: 1 }
}};
plan = P.derivePlan({ member, tasks, demand, registry, signoffs, currency, config: {}, now: NOW });
check('currency known', plan.currency_known, true);
const me = plan.refresh.find(r => r.id === 'SKD-0029-main-engine-starting');
check('practice-stale alone: reason is practice, not revision', me && me.reasons, ['practice']);
check('window came from the config default', me && me.practice.months, 24);
const mm = plan.refresh.find(r => r.id === 'SKG-0001-multimeter-use');
check('current by doing but behind revision: reason is revision only', mm && mm.reasons, ['revision']);
plan = P.derivePlan({ member, tasks, demand, registry, signoffs,
  currency: { byCompetency: { 'SKD-0029-main-engine-starting': { last: '2026-09-01', via: 'discipline', n: 1 } } },
  config: {}, now: NOW });
check('discipline-only evidence never satisfies currency', plan.refresh.find(r => r.id === 'SKD-0029-main-engine-starting').reasons, ['practice']);
plan = P.derivePlan({ member, tasks, demand, registry, signoffs, currency,
  config: { tracked: [{ ksa_id: 'SKD-0029', recency_months: 60 }] }, now: NOW });
check('tracked recency window wins over the default', !plan.refresh.some(r => r.id === 'SKD-0029-main-engine-starting'));

// ── rings switchable ─────────────────────────────────────────────────────────
T.head('rings');
plan = P.derivePlan({ member, tasks, demand, registry, signoffs: {}, currency: null,
  config: { plan: { 'Engine Room': { rings: { assigned: true, due: false, baseline: false } } } }, now: NOW });
check('due ring off removes the charger card', !ids(plan.now).includes('SKG-0001-multimeter-use'));
check('baseline off leaves next empty', plan.next.length, 0);
plan = P.derivePlan({ member: { ...member, department: 'Factory' }, tasks, demand, registry, signoffs: {}, currency: null, config: {}, now: NOW });
const gg = plan.now.find(r => r.id === 'SKG-0060-grease-gun-use');
check('factory member: due-ring factory task reaches the grease gun', Boolean(gg) && gg.ring === 'due');
check('factory member: baseline guessed from the department name also demands it', Boolean(gg) && gg.rings.baseline === true);
check('factory member: assigned ring still follows the person, not the department', ids(plan.now).includes('SKD-0029-main-engine-starting'));

// ── ordering ─────────────────────────────────────────────────────────────────
T.head('ordering');
plan = P.derivePlan({ member, tasks, demand, registry, signoffs: {}, currency: null, config: {}, now: NOW });
check('assigned before due, then depth', ids(plan.now), ['KSA-P002-loto-sequencing', 'SKD-0029-main-engine-starting', 'SKG-0001-multimeter-use']);

// ── vessel view ──────────────────────────────────────────────────────────────
T.head('vessel view');
const members = [
  { crew_id: 'c-1', name: 'J. Doe', role: 'Oiler', username: 'jdoe' },
  { crew_id: 'c-2', name: 'A. Chief', role: 'Chief Engineer', username: 'achief' }
];
const byMember = {
  'c-1': { 'KSA-P002-loto-sequencing': { level: 3, date: '2026-08-25', method: 'observed-work' } },
  'c-2': { 'KSA-P002-loto-sequencing': { level: 3, date: '2026-08-25', method: 'observed-work' } }
};
let vv = P.deriveVesselView({ department: 'Engine Room', members, tasks, demand, registry, signoffsByMember: byMember, config: {}, now: NOW });
check('uncovered: ME starting and multimeter, nobody holds them', vv.uncovered.map(r => r.id).sort(), ['SKD-0029-main-engine-starting', 'SKG-0001-multimeter-use']);
check('LOTO held by two — not single', vv.single_holder.length, 0);
check('chief policy: every card has the chief as assessor', vv.no_assessor.length, 0);
byMember['c-2'] = {};
vv = P.deriveVesselView({ department: 'Engine Room', members, tasks, demand, registry, signoffsByMember: byMember, config: {}, now: NOW });
check('LOTO now single-holder, naming the holder', vv.single_holder.map(r => [r.id, r.holders[0].name]), [['KSA-P002-loto-sequencing', 'J. Doe']]);
vv = P.deriveVesselView({ department: 'Engine Room', members, tasks, demand, registry, signoffsByMember: byMember,
  config: { plan: { 'Engine Room': { assessor_policy: 'record' } } }, now: NOW });
check('record policy with no level-4 anywhere: nobody can assess anything', vv.no_assessor.length, vv.demanded);

process.exit(T.done() ? 0 : 1);
