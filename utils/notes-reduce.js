'use strict';
// ── Notes Hub state derivation (IDMS-SCHEMA §41) ─────────────────────────────
// CANONICAL COPY. Mirrored byte-identical at
//   IDMS-Console/src/renderer/js/notes-reduce.js
// — same convention as utils/crew-display.js. Change it here first, then copy.
//
// Pure derivation of Notes Hub state from the append-only event stream.
// No DOM, no globals, no app context: both the notes page and the Console
// ingest lane replay through this exact function, which is what keeps two
// renderers honest against one contract.

(function (root) {

  // Deterministic replay order: the event *filename* is the sort key
  // (lex = chrono, per architecture.md). Events not yet round-tripped through
  // a filename fall back to the same compact-timestamp shape the filename is
  // built from, so a locally-appended event sorts exactly where its file will.
  function sortKey(ev) {
    if (ev._fn) return ev._fn;
    return String(ev.timestamp || '').replace(/[:.\-]/g, '') + '-' + (ev.event_id || '');
  }

  function reduce(events) {
    var ordered = events.slice().sort(function (a, b) {
      var ka = sortKey(a), kb = sortKey(b);
      return ka < kb ? -1 : ka > kb ? 1 : 0;
    });

    var notes = {};
    ordered.forEach(function (ev) {
      var p = ev.payload || {};
      var n = p.note_id ? notes[p.note_id] : null;
      switch (ev.event_type) {
        case 'note_created':
          notes[p.note_id] = {
            note_id: p.note_id, title: p.title || '(untitled)', body: p.body || '',
            scope: p.scope || {}, folder: p.folder || null,
            equipment_code: p.equipment_code || null,
            steps: (p.steps || []).map(function (s) {
              return { step_id: s.step_id, text: s.text, equipment_code: s.equipment_code || null, strikes: [] };
            }),
            template_id: p.template_id || null, origin: p.origin || 'manual',
            group_alert: !!p.group_alert,
            attachments: (p.attachments || []).slice(),
            author: ev.actor, created: ev.timestamp, updated: ev.timestamp,
            completed: false, completions: [], assignee: null, assigned_by: null,
            comments: [], archived: false, deleted: false,
            task_id: null, merged_into: null
          };
          break;
        case 'note_edited':
          if (n) {
            var patch = p.patch || {};
            for (var k in patch) n[k] = patch[k];
            n.updated = ev.timestamp;
          }
          break;
        case 'note_completed':
          if (n) { n.completed = true; n.completions.push({ actor: ev.actor, timestamp: ev.timestamp }); n.updated = ev.timestamp; }
          break;
        case 'note_uncompleted':
          if (n) { n.completed = false; n.completions.push({ actor: ev.actor, timestamp: ev.timestamp, undone: true }); n.updated = ev.timestamp; }
          break;
        case 'step_struck':
        case 'step_unstruck':
          if (n) {
            for (var i = 0; i < n.steps.length; i++) {
              if (n.steps[i].step_id === p.step_id) {
                n.steps[i].strikes.push({ actor: ev.actor, timestamp: ev.timestamp, struck: ev.event_type === 'step_struck' });
                break;
              }
            }
            n.updated = ev.timestamp;
          }
          break;
        case 'note_assigned':
          if (n) { n.assignee = p.assignee_username; n.assigned_by = ev.actor; n.updated = ev.timestamp; }
          break;
        case 'note_unassigned':
          if (n) { n.assignee = null; n.updated = ev.timestamp; }
          break;
        case 'comment_added':
          if (n) {
            n.comments.push({ comment_id: p.comment_id, text: p.text || '', attachments: p.attachments || [], actor: ev.actor, timestamp: ev.timestamp });
            n.updated = ev.timestamp;
          }
          break;
        case 'note_promoted':
          if (n) { n.task_id = p.task_id; n.updated = ev.timestamp; }
          break;
        case 'task_imported':
          notes[p.note_id] = {
            note_id: p.note_id, title: p.title || ('Task ' + p.task_id), body: '',
            scope: p.scope || {}, folder: p.folder || null,
            equipment_code: null, steps: [],
            template_id: null, origin: 'task_import', group_alert: false,
            attachments: [], author: ev.actor, created: ev.timestamp, updated: ev.timestamp,
            completed: false, completions: [], assignee: null, assigned_by: null,
            comments: [], archived: false, deleted: false,
            task_id: p.task_id, merged_into: null
          };
          break;
        case 'note_archived':
          if (n) { n.archived = true; n.updated = ev.timestamp; }
          break;
        case 'note_deleted':
          if (n) { n.deleted = true; n.updated = ev.timestamp; }
          break;
        case 'note_merged':
          if (notes[p.from_note_id]) notes[p.from_note_id].merged_into = p.into_note_id;
          break;
      }
    });
    return notes;
  }

  function stepStruck(step) {
    return step.strikes.length ? step.strikes[step.strikes.length - 1].struck : false;
  }

  var api = { reduce: reduce, stepStruck: stepStruck };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.notesReduce = api;
})(typeof window !== 'undefined' ? window : this);
