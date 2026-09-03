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

  var CREATE_TYPES = { note_created: 1, task_imported: 1 };

  function reduce(events) {
    var ordered = events.slice().sort(function (a, b) {
      var ka = sortKey(a), kb = sortKey(b);
      return ka < kb ? -1 : ka > kb ? 1 : 0;
    });

    // Creations are applied first, in their own stream order, before any
    // mutation. Filenames carry each writing device's own UTC clock, so a
    // comment or strike can legitimately sort *ahead* of the note it belongs
    // to — two devices a few seconds apart, or offline devices reconnecting
    // (§41.9). Single-pass, such an event would find no note and be dropped
    // permanently. Mutations still apply to each other in stream order, which
    // is where last-writer-wins actually matters.
    ordered = ordered.filter(function (ev) { return CREATE_TYPES[ev.event_type]; })
              .concat(ordered.filter(function (ev) { return !CREATE_TYPES[ev.event_type]; }));

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
            completed: false, completions: [], assignee: null,
            assignee_username: null, assigned_by: null,
            comments: [], archived: false, deleted: false,
            task_id: null, merged_into: null,
            starred: false, sort_index: null,
            // Stamped for the attachment retention clocks (§41.14). Null while
            // the state has never been entered; the latest transition wins.
            completed_at: null, deleted_at: null, promoted_at: null, archived_at: null
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
          if (n) { n.completed = true; n.completed_at = ev.timestamp; n.completions.push({ actor: ev.actor, timestamp: ev.timestamp }); n.updated = ev.timestamp; }
          break;
        case 'note_uncompleted':
          if (n) { n.completed = false; n.completed_at = null; n.completions.push({ actor: ev.actor, timestamp: ev.timestamp, undone: true }); n.updated = ev.timestamp; }
          break;
        case 'note_starred':
        case 'note_unstarred':
          if (n) { n.starred = ev.event_type === 'note_starred'; n.updated = ev.timestamp; }
          break;
        // Manual ordering, starred notes only. sort_index is a float so an
        // insert between two neighbours costs one event instead of reindexing
        // the whole list.
        case 'note_reordered':
          if (n) { n.sort_index = typeof p.sort_index === 'number' ? p.sort_index : null; n.updated = ev.timestamp; }
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
        // crew_id is the identity key: most of the roster carries username
        // null, so a username can neither address nor distinguish a crew
        // member. assignee_username rides along when the assignee is also an
        // IDMS login, which is what the PWA's alert check matches on.
        case 'note_assigned':
          if (n) {
            n.assignee = p.assignee_crew_id || p.assignee_username || null;
            n.assignee_username = p.assignee_username || null;
            n.assigned_by = ev.actor;
            n.updated = ev.timestamp;
          }
          break;
        case 'note_unassigned':
          if (n) { n.assignee = null; n.assignee_username = null; n.updated = ev.timestamp; }
          break;
        case 'comment_added':
          if (n) {
            n.comments.push({ comment_id: p.comment_id, text: p.text || '', attachments: p.attachments || [], actor: ev.actor, timestamp: ev.timestamp });
            n.updated = ev.timestamp;
          }
          break;
        case 'note_promoted':
          if (n) { n.task_id = p.task_id; n.promoted_at = ev.timestamp; n.updated = ev.timestamp; }
          break;
        case 'task_imported':
          notes[p.note_id] = {
            note_id: p.note_id, title: p.title || ('Task ' + p.task_id), body: '',
            scope: p.scope || {}, folder: p.folder || null,
            equipment_code: null, steps: [],
            template_id: null, origin: 'task_import', group_alert: false,
            attachments: [], author: ev.actor, created: ev.timestamp, updated: ev.timestamp,
            completed: false, completions: [], assignee: null,
            assignee_username: null, assigned_by: null,
            comments: [], archived: false, deleted: false,
            task_id: p.task_id, merged_into: null,
            starred: false, sort_index: null,
            completed_at: null, deleted_at: null, promoted_at: null, archived_at: null
          };
          break;
        case 'note_archived':
          if (n) { n.archived = true; n.archived_at = ev.timestamp; n.updated = ev.timestamp; }
          break;
        case 'note_unarchived':
          if (n) { n.archived = false; n.archived_at = null; n.updated = ev.timestamp; }
          break;
        case 'note_deleted':
          if (n) { n.deleted = true; n.deleted_at = ev.timestamp; n.updated = ev.timestamp; }
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

  // Attachment retention (§41.14). Files outlive the note by a grace period so
  // a failed sync is recoverable, then become eligible for purge. Archiving is
  // the escape hatch: an archived note keeps its files indefinitely.
  //
  // This computes ELIGIBILITY only. Nothing here deletes; purging is an
  // officer action in the Console, because architecture.md reserves deletion
  // for a human.
  var RETENTION_DAYS = { deleted: 30, completed: 30, promoted: 10 };

  function attachmentExpiry(note) {
    if (!note || note.archived) return null;
    var cands = [];
    if (note.deleted   && note.deleted_at)   cands.push({ reason: 'deleted',   from: note.deleted_at,   days: RETENTION_DAYS.deleted });
    if (note.task_id   && note.promoted_at)  cands.push({ reason: 'promoted',  from: note.promoted_at,  days: RETENTION_DAYS.promoted });
    if (note.completed && note.completed_at) cands.push({ reason: 'completed', from: note.completed_at, days: RETENTION_DAYS.completed });
    if (!cands.length) return null;
    var best = null;
    cands.forEach(function (c) {
      var due = new Date(new Date(c.from).getTime() + c.days * 86400000).toISOString();
      if (!best || due < best.due) best = { due: due, reason: c.reason, days: c.days };
    });
    return best;
  }

  function hasAttachments(note) {
    if (!note) return false;
    if ((note.attachments || []).length) return true;
    return (note.comments || []).some(function (c) { return (c.attachments || []).length; });
  }

  var api = {
    reduce: reduce,
    stepStruck: stepStruck,
    attachmentExpiry: attachmentExpiry,
    hasAttachments: hasAttachments,
    RETENTION_DAYS: RETENTION_DAYS
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.notesReduce = api;
})(typeof window !== 'undefined' ? window : this);
