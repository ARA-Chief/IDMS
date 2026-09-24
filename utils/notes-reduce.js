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

  // Keep the single-assignee mirrors in step with the list. Readers that
  // predate multi-assignment — the PWA alert check, the Console's derived
  // `assignee` column — keep working off the first entry, and
  // `assignee_usernames` is the membership test for everything new.
  function syncAssignment(n) {
    n.assignee = n.assignees.length ? n.assignees[0].crew_id : null;
    n.assignee_username = n.assignees.length ? (n.assignees[0].username || null) : null;
    n.assignee_usernames = n.assignees
      .map(function (a) { return a.username; })
      .filter(Boolean);
    if (n.assignees.length) n.assignment = 'assigned';
    else if (n.assignment === 'assigned') n.assignment = 'assignable';  // last person removed
  }

  // The note type a reader should show. `assignment` carries four values and
  // only three are ever chosen — 'assigned' is what ticking a person makes of
  // 'assignable', and the radios read it back as Assignable (§41.6a).
  //
  // The type answers WHO a note is for; `equipment_code` answers WHAT it is
  // about, and the two are independent. An assignable note may carry a code —
  // that is how a promoted note reaches the service report with its equipment
  // already filled in — so the code is not what makes a note equipment-typed.
  // Only 'equipment' is: about a machine, and nobody in particular.
  function noteType(n) {
    if (!n) return 'unassigned';
    if (n.assignees && n.assignees.length) return 'assignable';
    if (n.assignment === 'assignable') return 'assignable';
    if (n.assignment === 'equipment') return 'equipment';
    return 'unassigned';
  }

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
            // §41.4e — a note raised by an Alerts rule carries the rule, the
            // episode key and the evaluation trace that produced it. Additive
            // and inert: `origin` is 'alert' on these, every other note holds
            // null, and no reader has to know about it. Kept whole rather than
            // flattened so the reason a rule fired travels with the note
            // instead of being re-derived from a config that has since changed.
            alert: p.alert || null,
            attachments: (p.attachments || []).slice(),
            author: ev.actor, created: ev.timestamp, updated: ev.timestamp,
            completed: false, completions: [],
            // Note type, and the person list is the 'assigned' state rather
            // than a separate field (§41.6a):
            //   'unassigned' — nobody's, and not offered to anyone (default)
            //   'assignable' — open to whoever picks it up (Notes Tray)
            //   'assigned'   — one or more named people
            //   'equipment'  — filed against one asset code (§41.6d)
            // An explicit assignment wins. Without one, a creation that
            // carries a code is equipment-typed on the spot: an importer or an
            // older writer should not need a second event to say what it
            // plainly meant. Demotion from a task states 'assignable' and
            // carries the code, which is exactly why the explicit form exists.
            assignment: p.assignment ||
                        (p.equipment_code ? 'equipment' : 'unassigned'),
            assignees: [],            // [{crew_id, username}] — order is assignment order
            assignee: null,           // = assignees[0].crew_id, for single-assignee readers
            assignee_username: null,  // = assignees[0].username
            assignee_usernames: [],   // every assignee that is also an IDMS login
            assigned_by: null,
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
        // member. username rides along when the assignee is also an IDMS
        // login, which is what the PWA's alert check matches on.
        //
        // note_assigned ADDS a person — a note may be carried by several, and
        // the same event shape covers one or many.
        case 'note_assigned':
          if (n) {
            var addId = p.assignee_crew_id || p.assignee_username || null;
            if (addId && !n.assignees.some(function (a) { return a.crew_id === addId; })) {
              n.assignees.push({ crew_id: addId, username: p.assignee_username || null });
            }
            n.assigned_by = ev.actor;
            n.updated = ev.timestamp;
            syncAssignment(n);
          }
          break;
        // With a crew_id, drops that one person; without, clears everyone.
        case 'note_unassigned':
          if (n) {
            var dropId = p.assignee_crew_id || p.assignee_username || null;
            n.assignees = dropId
              ? n.assignees.filter(function (a) { return a.crew_id !== dropId; })
              : [];
            n.updated = ev.timestamp;
            syncAssignment(n);
          }
          break;
        // The three person-less types. Naming a person always wins, so this is
        // ignored while anyone is assigned — clear them first.
        //
        // Switching type does NOT drop the equipment code. Assignable and
        // Equipment both carry one — optional on the first, the point of the
        // second — so moving between them keeps the tag, which is what stopped
        // a note losing the machine it is about on a round trip. Only
        // 'unassigned' clears it, because that panel offers nothing to see or
        // change it with and a code stranded there is unreachable. Clearing on
        // purpose is the ✕ on the picker.
        case 'note_assignment_set':
          if (n && !n.assignees.length) {
            if (p.mode === 'equipment')       n.assignment = 'equipment';
            else if (p.mode === 'assignable') n.assignment = 'assignable';
            else { n.assignment = 'unassigned'; n.equipment_code = null; }
            if (p.equipment_code) n.equipment_code = p.equipment_code;
            n.updated = ev.timestamp;
          }
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
            completed: false, completions: [],
            assignment: 'unassigned', assignees: [], assignee: null,
            assignee_username: null, assignee_usernames: [], assigned_by: null,
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

  // ── Task metadata carried in comments (§41.6e) ─────────────────────────────
  // Crew already write "Priority: High" into a comment when they mean it, so
  // promotion reads that rather than asking them to learn a new place to put
  // it. Any comment line shaped `Label: value` is metadata; everything else is
  // prose and is left alone. Unknown labels are ignored rather than guessed
  // at — a wrong guess prefills a service report with something nobody said.
  //
  // Later comments win, because the last thing anyone wrote about a note is
  // the current answer. Within one comment, later lines win for the same
  // reason.
  var TASK_META_FIELDS = {
    priority:      'priority',
    category:      'job_type',
    type:          'job_type',
    'job type':    'job_type',
    equipment:     'equipment_code',
    'equipment code': 'equipment_code',
    asset:         'equipment_code',
    code:          'equipment_code',
    role:          'role',
    'assigned to': 'assigned_to',
    assignee:      'assigned_to',
    department:    'department',
    dept:          'department',
    'failure mode':  'failure_mode',
    'failure':       'failure_mode',
    hours:           'interval_hours',
    'equipment hours': 'interval_hours',
    interval:      'interval',
    status:        'status'
  };

  // One `Label: value` line. Deliberately strict about the shape: the label is
  // short, has no sentence punctuation in it, and the line is not a URL or a
  // clock time, so "Ran it up at 14:30" and "see https://x" stay prose.
  var META_LINE = /^\s*([A-Za-z][A-Za-z ]{1,20}?)\s*:\s*(.+?)\s*$/;

  function parseMetaLine(line) {
    var m = META_LINE.exec(line);
    if (!m) return null;
    var label = m[1].trim().toLowerCase().replace(/\s+/g, ' ');
    var field = TASK_META_FIELDS[label];
    if (!field) return null;
    var value = m[2].trim();
    if (!value) return null;
    return { field: field, value: value, label: m[1].trim() };
  }

  // Every metadata line in a note's comments, latest wins. Returns
  // { fields: {taskField: value}, sources: [{field, label, value, actor,
  // timestamp}] } — the sources list is what lets a UI say where a prefilled
  // value came from instead of it appearing out of nowhere.
  function taskMetaFromComments(note) {
    var fields = {}, sources = [];
    ((note && note.comments) || []).forEach(function (c) {
      String(c.text || '').split(/\r?\n/).forEach(function (line) {
        var hit = parseMetaLine(line);
        if (!hit) return;
        fields[hit.field] = hit.value;
        sources.push({
          field: hit.field, label: hit.label, value: hit.value,
          actor: c.actor, timestamp: c.timestamp
        });
      });
    });
    return { fields: fields, sources: sources };
  }

  // The comment text with its metadata lines taken out, so a transcript copied
  // onto a task does not repeat what the form fields already say.
  function commentProse(text) {
    return String(text || '')
      .split(/\r?\n/)
      .filter(function (line) { return !parseMetaLine(line); })
      .join('\n')
      .trim();
  }

  function stepStruck(step) {
    return step.strikes.length ? step.strikes[step.strikes.length - 1].struck : false;
  }

  // ── What a note hands over when it is promoted (§41.6) ─────────────────────
  // The two things the §41.6 table does not name and that a task has nowhere to
  // put: the people carrying the note, and its checklist. Both are pure, so the
  // shape of the hand-over can be tested without a form to open it in.

  // The note's assignees as the keys a task writes into `assigned_to`.
  //
  // A note keys people by crew_id (§41.4a); a task keys them by login, or by
  // display name for the crew who have none. The roster is the only place the
  // two meet, so `roster` is the caller's list of {crew_id, username, name} —
  // already display-resolved, because how a name is spelled is the caller's
  // business and not this file's. Somebody the roster no longer carries falls
  // back to the `username` the assignment event carried, and is dropped
  // altogether if it carried none: a raw crew_id in `assigned_to` would name
  // nobody on any task screen.
  function promoteHolders(note, roster) {
    var by = {};
    (roster || []).forEach(function (c) { if (c && c.crew_id) by[c.crew_id] = c; });
    var out = [];
    ((note && note.assignees) || []).forEach(function (a) {
      var c = by[a.crew_id];
      var key = c ? (c.username || c.name || null) : (a.username || null);
      if (key && out.indexOf(key) === -1) out.push(key);
    });
    return out;
  }

  // The checklist as text, ticks and all. A task has no step list, so the
  // description is the only place this survives the changeover — and writing it
  // unticked would claim a job nobody had started.
  function promoteChecklist(note) {
    var steps = (note && note.steps) || [];
    if (!steps.length) return '';
    var done = 0;
    var lines = steps.map(function (s) {
      var struck = stepStruck(s);
      if (struck) done++;
      return (struck ? '[x] ' : '[ ] ') + s.text + (s.equipment_code ? ' (' + s.equipment_code + ')' : '');
    });
    return 'Checklist from the note — ' + done + ' of ' + steps.length + ' done:\n' + lines.join('\n');
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

  // Is this note filed against a machine? Both renderers keep an Equipment pad
  // — a tree of asset codes — and this is what puts a note in it and takes it
  // out of the department's own list.
  //
  // It is the TYPE and not the code, and the difference matters. The type says
  // who a note is for; the code says what it is about, and the two are
  // independent (see noteType above). An alert carries a code and is still the
  // department's to read; an Offload List row carries one and is still work
  // somebody picks up; an assignable note carries one so the service report it
  // is promoted into arrives with its equipment filled in. Hiding every note
  // that merely names a machine would empty the three pads people actually
  // work off, which is why this asks the narrower question.
  //
  // The pad itself is deliberately wider than this: it lists every note
  // carrying a code, so an assignable note about a machine is reachable from
  // the machine as well as from the person. Nothing is hidden by being filed;
  // only equipment-typed notes are MOVED — and hiddenByPad below says what
  // "moved" costs them, which is less than all of it.
  //
  // Both halves are required, and the second is not pedantry. Choosing
  // Equipment on the radios and then walking away leaves a note typed for a
  // machine that names no machine: it has left every list, and the pad is a
  // tree of codes, so there is no code for it to hang under. Such a note would
  // exist and be reachable from nowhere. Until it names its machine it simply
  // has not moved, and the picker sitting open under the radio is the one
  // click that moves it.
  //
  // Accepts a derived note or the Console's flat `notes` row — both carry
  // `assignment`, `assignees` and `equipment_code`, which is all this reads.
  function isFiledAgainstEquipment(note) {
    if (!note || !note.equipment_code) return false;
    return noteType(note) === 'equipment';
  }

  // Does the Equipment pad take this note out of the ordinary list being drawn?
  // `folderPath` is the folder that list IS — null for the department's own
  // top level, for General and for a person's list.
  //
  // A note that has moved leaves the lists it merely fell into and keeps the
  // one it was PUT in. Filing is an act: somebody chose `Rounds`, or dragged a
  // note onto `Overhauls`, and answering that by emptying the folder is the app
  // overruling them. The top-level department list is the opposite — it is
  // where a note sits when nobody has filed it anywhere — so that is the list
  // an equipment note leaves, along with General and every personal list.
  //
  // So `Rounds` fills again: the phone's rounds comments are equipment-typed
  // and filed there, and they are now in the folder AND under their machine.
  // Which is right. A remark about the JW pump is reachable from the round it
  // was made on and from the pump, and it is still one note with one
  // completion — what "one home per note" was ever protecting against is two
  // RECORDS of one thing, not two ways in to the same one.
  //
  // Same arguments as isFiledAgainstEquipment, plus the folder of the list.
  function hiddenByPad(note, folderPath) {
    if (!isFiledAgainstEquipment(note)) return false;   // it never moved
    if (!note.folder) return true;                      // unfiled: the pad only
    return note.folder !== (folderPath || null);        // its own folder keeps it
  }

  // How many rows a Recents list mirrors. Both renderers draw two of them —
  // one for the department in hand plus General, one vessel-wide — and neither
  // is a place: nothing is filed there, and a note shown there still lives
  // wherever it lives. A fixed ten because the list answers "what has just
  // been touched", and a longer one stops answering it.
  var RECENT_LIMIT = 10;

  // Recency is `updated`, which every mutation in the reducer stamps —
  // including the ones with nothing to show for themselves, like a star. A
  // note that has never been edited falls back to its creation, so a stream
  // written before `updated` existed still sorts somewhere sensible rather
  // than at the bottom forever.
  function recencyOf(note) {
    if (!note) return '';
    return note.updated || note.created || '';
  }

  // Newest first. Does not mutate, and does not apply the pinned/starred order
  // the ordinary lists use — a mirror of what was last touched is the one list
  // on either screen where a star must not jump the queue.
  function byRecency(notes) {
    return (notes || []).slice().sort(function (a, b) {
      var ra = recencyOf(a), rb = recencyOf(b);
      return ra === rb ? 0 : (ra > rb ? -1 : 1);
    });
  }

  // Is this note on that person's plate? crew_id is the key; a username is
  // accepted so a caller that only knows a login can still ask.
  function isAssignedTo(note, crewIdOrUsername) {
    if (!note || !crewIdOrUsername) return false;
    return (note.assignees || []).some(function (a) {
      return a.crew_id === crewIdOrUsername || a.username === crewIdOrUsername;
    });
  }

  function hasAttachments(note) {
    if (!note) return false;
    if ((note.attachments || []).length) return true;
    return (note.comments || []).some(function (c) { return (c.attachments || []).length; });
  }

  var api = {
    reduce: reduce,
    noteType: noteType,
    isFiledAgainstEquipment: isFiledAgainstEquipment,
    hiddenByPad: hiddenByPad,
    byRecency: byRecency,
    recencyOf: recencyOf,
    RECENT_LIMIT: RECENT_LIMIT,
    taskMetaFromComments: taskMetaFromComments,
    commentProse: commentProse,
    TASK_META_FIELDS: TASK_META_FIELDS,
    stepStruck: stepStruck,
    promoteHolders: promoteHolders,
    promoteChecklist: promoteChecklist,
    isAssignedTo: isAssignedTo,
    attachmentExpiry: attachmentExpiry,
    hasAttachments: hasAttachments,
    RETENTION_DAYS: RETENTION_DAYS
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.notesReduce = api;
})(typeof window !== 'undefined' ? window : this);
