'use strict';

// A comment_id names one comment, however many times it is written (§41).
//
// Alerts gives its close comment a deterministic id, so that two consoles
// closing one episode leave one comment rather than two. On 2026-09-24 one
// console wrote the same close comment 141 times onto one alert note. The
// Console cache keys note_comments on comment_id, so the repeat failed its
// insert and froze the Notes Hub on every console; the phone replayed it as 141
// comments. The reducer keeps the first copy of each id, so both readers agree
// on one.

const fs = require('fs');
const vm = require('vm');
const path = require('path');
const { REPO, counter } = require('./_paths');
const REDUCER = path.join(REPO, 'utils', 'notes-reduce.js');

const T = counter(), check = T.check;

const sandbox = { console, module: { exports: {} } };
sandbox.window = sandbox;
vm.createContext(sandbox);
new vm.Script(fs.readFileSync(REDUCER, 'utf8'), { filename: 'notes-reduce.js' }).runInContext(sandbox);
const NR = sandbox.notesReduce || sandbox.module.exports;

let seq = 0;
const ev = (type, payload, actor, ts) => {
  seq++;
  const timestamp = ts || new Date(Date.UTC(2026, 8, 24, 20, 13, 3, seq)).toISOString();
  return { event_type: type, event_id: 'e' + String(seq).padStart(4, '0'),
           actor: actor || 'lherring', timestamp, payload };
};

const NOTE = 'note-alert-c3af6cbf8e093d41f4be070b2c3c2989';
const CMT  = 'cmt-f7a69fac4eeace12';
const created = ev('note_created', { note_id: NOTE, title: 'rounds overdue > 1h', folder: 'Alerts', origin: 'alert' },
                   'lherring', '2026-09-22T09:18:46.575Z');
const closeComment = (actor, text) =>
  ev('comment_added', { note_id: NOTE, comment_id: CMT, text: text || 'Cleared automatically.', attachments: [] }, actor);

console.log('\nthe same comment_id written many times is one comment');
{
  const events = [created];
  events.push(closeComment('lherring', 'first'));
  for (let i = 0; i < 140; i++) events.push(closeComment(i % 70 ? 'lherring' : 'mkilde', 'copy ' + i));
  const n = NR.reduce(events)[NOTE];
  check('141 writes of one id reduce to one comment', n.comments.length, 1);
  check('the first copy wins', [n.comments[0].text, n.comments[0].actor], ['first', 'lherring']);
  check('ids stay unique, so a table keyed on comment_id can take them all',
        new Set(n.comments.map(c => c.comment_id)).size, n.comments.length);
}

console.log('\nthe first copy is first in stream order, not in arrival order');
{
  const early = closeComment('lherring', 'early');
  const late  = closeComment('mkilde', 'late');
  const n = NR.reduce([created, late, early])[NOTE];
  check('the event that sorts first is kept', n.comments.map(c => c.text), ['early']);
}

console.log('\ndifferent ids are still different comments');
{
  const n = NR.reduce([
    created,
    closeComment('lherring', 'closed'),
    ev('comment_added', { note_id: NOTE, comment_id: 'cmt-a', text: 'a' }, 'wostara'),
    ev('comment_added', { note_id: NOTE, comment_id: 'cmt-b', text: 'b' }, 'wostara'),
    closeComment('lherring', 'again')
  ])[NOTE];
  check('three ids, three comments, in order', n.comments.map(c => c.text), ['closed', 'a', 'b']);
}

console.log('\nthe same id on two notes is not a repeat');
{
  const other = ev('note_created', { note_id: 'note-2', title: 'other' });
  const r = NR.reduce([
    created, other,
    closeComment('lherring', 'on the alert'),
    ev('comment_added', { note_id: 'note-2', comment_id: CMT, text: 'on the other' })
  ]);
  check('each note keeps its own', [r[NOTE].comments.length, r['note-2'].comments.length], [1, 1]);
}

console.log('\na comment with no id is never taken for a repeat');
{
  const n = NR.reduce([
    created,
    ev('comment_added', { note_id: NOTE, text: 'one' }),
    ev('comment_added', { note_id: NOTE, text: 'two' })
  ])[NOTE];
  check('both kept', n.comments.map(c => c.text), ['one', 'two']);
}

console.log('\na skipped repeat does not move the note');
{
  const first = closeComment('lherring', 'first');
  const repeat = ev('comment_added', { note_id: NOTE, comment_id: CMT, text: 'repeat' },
                    'lherring', '2026-09-27T16:57:51.777Z');
  const n = NR.reduce([created, first, repeat])[NOTE];
  check('updated stays at the first copy', n.updated, first.timestamp);
}

process.exit(T.done() ? 0 : 1);
