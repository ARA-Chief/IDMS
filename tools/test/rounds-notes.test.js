'use strict';

// A comment left on rounds, and the note it becomes (utils/rounds-notes.js).
//
// This is the canonical copy of a rule two apps run: the phone raises these
// notes when it submits a round, and the Console raises them for a comment
// typed there and for anything that arrived on an ingested roundslog. The
// mirror is checked byte-for-byte in console-derive.test.js; what is checked
// here is the rule itself, which both ends depend on agreeing about.
//
// The cases are the ones that would read WRONG rather than break: the same
// comment published twice, a comment on an item nobody pointed at a machine, a
// photograph with nothing typed against it, and a note attributed to the
// console that ingested it instead of the crew member who left it.
//
// Run: node tools/test/rounds-notes.test.js  (or tools/test/run.js)

const path = require('path');
const { REPO, counter } = require('./_paths');
const RN = require(path.join(REPO, 'utils', 'rounds-notes.js'));

const T = counter();
const check = T.check;

const CTX = { date: '2026-09-18', round_number: 2 };

const entry = over => Object.assign({
  item_id:       'a1b2c3d4-0000-4000-8000-000000000001',
  item_label:    'ME LO Press',
  asset_code:    '601.001.01',
  section_label: 'Engine Room Fwd',
  unit:          'PSI',
  value:         '58',
  secd:          false,
  comments:      []
}, over || {});

const comment = over => Object.assign({
  text:      'Weeping at the packing, watch it next round',
  author:    'jhaugen',
  timestamp: '2026-09-18T14:30:12.345Z'
}, over || {});

T.head('the id is derived from the comment, so two writers file one note');
check('item and instant, punctuation stripped',
      RN.noteIdFor('item-1', '2026-09-18T14:30:12.345Z'),
      'note-rnd-item-1-20260918T143012345Z');
check('the phone and the Console derive the same id',
      RN.noteIdFor('item-1', '2026-09-18T14:30:12.345Z') ===
      RN.noteIdFor('item-1', '2026-09-18T14:30:12.345Z'), true);
check('two comments a millisecond apart are two notes',
      RN.noteIdFor('item-1', '2026-09-18T14:30:12.345Z') ===
      RN.noteIdFor('item-1', '2026-09-18T14:30:12.346Z'), false);
check('the same instant on two items is two notes',
      RN.noteIdFor('item-1', '2026-09-18T14:30:12.345Z') ===
      RN.noteIdFor('item-2', '2026-09-18T14:30:12.345Z'), false);

T.head('what the note says');
const p = RN.payloadFor(comment(), entry(), CTX);
check('filed against the component the item names', p.equipment_code, '601.001.01');
check('the title names the item and the round it came off',
      p.title, 'ME LO Press — rounds R2, 2026-09-18');
check('the body is what was written, then where',
      p.body,
      'Weeping at the packing, watch it next round\n\n' +
      '— jhaugen · round 2 · 2026-09-18 · Engine Room Fwd · read 58 PSI');
check('it lands in the engine room’s Rounds pad',
      [p.scope.level, p.scope.department, p.folder, p.origin],
      ['department', 'engine', 'Rounds', 'rounds']);
// A creation carrying an equipment code is typed as an equipment note by the
// reducer (utils/notes-reduce.js). Stating a type here would override that.
check('no assignment is stated', 'assignment' in p, false);

T.head('the reading at the time travels with the comment');
check('a secured item says so rather than quoting a value',
      RN.payloadFor(comment(), entry({ secd: true, value: null }), CTX).body.split('\n\n')[1],
      '— jhaugen · round 2 · 2026-09-18 · Engine Room Fwd · secured');
check('an item with no value quotes none',
      RN.payloadFor(comment(), entry({ value: '' }), CTX).body.split('\n\n')[1],
      '— jhaugen · round 2 · 2026-09-18 · Engine Room Fwd');
check('an unscheduled round has no number',
      RN.payloadFor(comment(), entry(), { date: '2026-09-18', round_number: null }).title,
      'ME LO Press — rounds, 2026-09-18');

T.head('photographs');
const pics = [
  { filename: 'a.jpg', path: 'data/assets/pictures/i/a.jpg', thumbnail_path: 'data/assets/pictures/i/thumb-a.jpg' },
  { filename: 'b.jpg', path: 'data/assets/pictures/i/b.jpg' }
];
// erTaskUploadImage already puts these under data/assets/pictures/{item_id}/,
// which is where a note's own photographs live — so nothing is copied and the
// only field the Hub needs that the roundslog does not write is `kind`.
check('the phone’s uploads carry over, marked as pictures',
      RN.payloadFor(comment({ attachments: pics }), entry(), CTX).attachments,
      [{ kind: 'image', filename: 'a.jpg', path: 'data/assets/pictures/i/a.jpg',
         thumbnail_path: 'data/assets/pictures/i/thumb-a.jpg' },
       { kind: 'image', filename: 'b.jpg', path: 'data/assets/pictures/i/b.jpg',
         thumbnail_path: null }]);
check('an attachment with no path is not an attachment',
      RN.attachmentsOf({ attachments: [{ filename: 'x.jpg' }] }), []);
check('a photograph with nothing typed is still a note, and says so',
      RN.payloadFor(comment({ text: '', attachments: pics }), entry(), CTX).body.split('\n\n')[0],
      '2 photographs, with nothing typed against them.');
check('one photograph, singular',
      RN.payloadFor(comment({ text: '', attachments: [pics[0]] }), entry(), CTX).body.split('\n\n')[0],
      'A photograph, with nothing typed against it.');

T.head('what is refused, and why the two refusals are different');
check('an item with no component code has nowhere to file to',
      RN.payloadFor(comment(), entry({ asset_code: '' }), CTX), null);
check('whitespace is not a component code',
      RN.payloadFor(comment(), entry({ asset_code: '   ' }), CTX), null);
check('an empty comment is not a note',
      RN.payloadFor(comment({ text: '   ', attachments: [] }), entry(), CTX), null);

T.head('what a submitted round publishes');
const entries = [
  entry({ comments: [comment(), comment({ text: 'and again', timestamp: '2026-09-18T15:00:00.000Z' })] }),
  entry({ item_id: 'item-2', item_label: 'Stbd Gen Exh', asset_code: '', comments: [comment()] }),
  entry({ item_id: 'item-3', item_label: 'Bilge', comments: [] })
];
check('every id the round could write, and only those',
      RN.candidateIds(entries),
      ['note-rnd-a1b2c3d4-0000-4000-8000-000000000001-20260918T143012345Z',
       'note-rnd-a1b2c3d4-0000-4000-8000-000000000001-20260918T150000000Z']);

// The phone plans against an empty set: a comment typed into a draft on this
// handset minutes ago has never been anywhere. The Console passes what the Hub
// already holds, because what it is publishing may be the phone's own work.
let plan = RN.plan(entries, CTX, new Set());
check('two comments on a coded item are two notes; the uncoded one is counted, not written',
      [plan.writes.length, plan.held, plan.uncoded, plan.empty], [2, 0, 1, 0]);
check('each note is attributed to the crew member who left the comment',
      plan.writes.map(w => w.actor), ['jhaugen', 'jhaugen']);
check('they are creations', plan.writes.map(w => w.eventType), ['note_created', 'note_created']);

T.head('a note the Hub already holds is left alone');
plan = RN.plan(entries, CTX, new Set(['note-rnd-a1b2c3d4-0000-4000-8000-000000000001-20260918T143012345Z']));
check('the second comment is written, the first is held',
      [plan.writes.map(w => w.payload.body.split('\n\n')[0]), plan.held],
      [['and again'], 1]);

// Why `have` is asked for with deleted and archived notes included: a note
// somebody threw away must not walk back in on the next ingest.
T.head('a note somebody deleted stays deleted');
plan = RN.plan(entries, CTX, new Set(RN.candidateIds(entries)));
check('nothing is rewritten', [plan.writes.length, plan.held, plan.uncoded], [0, 2, 1]);

T.head('a comment naming no author');
plan = RN.plan([entry({ comments: [comment({ author: null })] })], CTX, new Set());
check('is left null, so the writing app signs it rather than guessing',
      plan.writes[0].actor, null);

T.head('nothing to do');
check('a round with no comments plans nothing',
      RN.plan([entry()], CTX, new Set()), { writes: [], held: 0, uncoded: 0, empty: 0 });
check('and offers no ids to look up', RN.candidateIds([entry()]), []);

process.exit(T.done() ? 0 : 1);
