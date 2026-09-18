'use strict';

// ── A comment left on rounds, filed against the machine it is about ──────────
//
// CANONICAL COPY. Mirrored byte-identical at
//   IDMS-Console/src/renderer/js/rounds-notes.js
// — same convention as utils/notes-reduce.js. Change it in the IDMS repo
// first, then copy. Both ends raise the note, so both ends have to derive the
// same id from the same comment or the phone and the Console would each file
// their own copy of it.
//
// Pure: no DOM, no globals, no Graph. The lane that actually writes the events
// is each app's own — `sync-rounds-notes.js` on the Console, `rePublishCommentNotes`
// in roundsentry.js on the phone — because they reach OneDrive by different
// roads and agree about nothing except this.
//
// A rounds comment used to live in exactly one place: `entries[i].comments[]`
// inside the roundslog file it was typed against (docs/rounds-comments-pwa-
// contract.md). That is the right home for the thread — the badge on the item,
// the photo, the merge across a watch's several writers all read it there — but
// it is the wrong home for the FINDING. Nobody standing in front of the machine
// six months later opens Rounds Log for the 14th of March to learn that its
// packing was weeping.
//
// Every rounds item already names its component (`asset_code`, set in Rounds
// Setup), so the finding has somewhere to go. Each comment is published into
// the Notes Hub as a note filed against that code, which puts it on
// Inventory › Components › Notes beside everything else known about the
// machine, and in Records › Notes under the engine room's Rounds pad.
//
// ## Both copies, not one
//
// The roundslog comment stays exactly where it was. It is what the phone
// writes, what the phone reads back, and what the Console's own thread is built
// from — and it is written by a device that has never heard of the Notes Hub.
// The note is the published copy: a second reader for the same words, not a
// move.
//
// ## One note per comment
//
// Not one note per item with the comments hung off it. The component's Notes
// section lists a note by title, body and date and does not open its comment
// thread, so a comment filed as a note's comment would arrive on the component
// screen invisible — the worst shape a miss can take, because the list looks
// complete. A note per comment is a legible row per finding, dated, with its
// photographs on it.
//
// ## One note, one id
//
// The Hub takes client-chosen ids, so the note has a DERIVED one built from the
// comment's own identity — the item it is on and the instant it was written:
//
//   note-rnd-<item_id>-<timestamp, punctuation stripped>
//
// That is what makes publishing idempotent, and there are three writers to make
// it so for: the phone raises the note when it submits the round, the Console
// raises it when a comment is typed there, and the Console raises it again for
// every comment arriving on an ingested roundslog. Several consoles ingest the
// same file independently. All of them derive the same id, so a note already
// written is not written twice — and where two do race, the reducer keys notes
// by id and one note is what comes out. There is no table mapping comments to
// notes to be kept in step, and no way to end up with four copies of one remark.
//
// ## What it does not do
//
// It does not read the Hub back onto the round. A note edited in Records ›
// Notes stays edited there; the roundslog comment is untouched and unaware.
// Comments are append-only at both layers, so there is nothing to reconcile —
// which is the only reason one-way publishing is honest here.

(function (root) {

  // Rounds are the engine room's rounds — there is one rounds configuration,
  // not one per department — so the notes they raise are the engine room's, the
  // same tier that sees Shipyard and the Offload List.
  var NOTE_DEPT   = 'engine';
  var NOTE_FOLDER = 'Rounds';
  var NOTE_ORIGIN = 'rounds';

  /**
   * The Hub id for one comment. Derived, never stored, never guessed.
   *
   * The item id is a UUID and the timestamp is ISO 8601 to the millisecond, so
   * the pair is unique without a counter — two people cannot type into the same
   * item in the same millisecond, and one person cannot type twice in one.
   */
  function noteIdFor(itemId, timestamp) {
    return 'note-rnd-' + String(itemId || '') + '-' +
           String(timestamp || '').replace(/[^0-9A-Za-z]/g, '');
  }

  /**
   * An attachment as the Notes Hub stores it.
   *
   * The phone and the Console both upload a rounds photo to
   * `data/assets/pictures/{item_id}/`, which is where a note's own photos live
   * too, so the file needs no copying — only the one field the Hub reads and
   * the roundslog does not write. `kind` decides whether a note renders the
   * attachment as a picture or as a document, and everything arriving here is a
   * picture (the rounds photo picker takes `image/*` and re-encodes to JPEG).
   */
  function attachmentsOf(comment) {
    var atts = (comment && comment.attachments) || [];
    if (!Array.isArray(atts)) return [];
    return atts.filter(function (a) { return a && a.path; }).map(function (a) {
      return {
        kind:           a.kind || 'image',
        filename:       a.filename || '',
        path:           a.path,
        thumbnail_path: a.thumbnail_path || null
      };
    });
  }

  /** "ME LO Press — rounds R2, 2026-09-18". The machine's list is read by date
   *  and by title, so both have to say which round this came off. */
  function titleFor(entry, ctx) {
    var label = (entry && (entry.item_label || entry.item_id)) || 'Rounds item';
    var round = (ctx && ctx.round_number != null && ctx.round_number !== '')
      ? 'rounds R' + ctx.round_number : 'rounds';
    var date  = (ctx && ctx.date) || '';
    return label + ' — ' + round + (date ? ', ' + date : '');
  }

  /**
   * The note's body: what was written, then where it was written.
   *
   * The provenance line is not decoration. The Hub stamps a note with the
   * console that published it and the instant it published — for a phone's
   * comment that is the wrong person at the wrong time, minutes or hours after
   * the fact — so the line carries the crew member who actually left it and the
   * round they left it on, and that is the attribution a reader should believe.
   *
   * The reading at the time goes on it too. "Running hot" means one thing at
   * 82°C and another at 96°C, and six months later nobody can go back and look.
   */
  function bodyFor(comment, entry, ctx) {
    var text  = String((comment && comment.text) || '').trim();
    var atts  = attachmentsOf(comment);
    var head  = text || (atts.length
      ? (atts.length === 1 ? 'A photograph, with nothing typed against it.'
                           : atts.length + ' photographs, with nothing typed against them.')
      : '');

    var bits = [];
    if (comment && comment.author) bits.push(comment.author);
    bits.push((ctx && ctx.round_number != null && ctx.round_number !== '')
      ? 'round ' + ctx.round_number : 'rounds');
    if (ctx && ctx.date) bits.push(ctx.date);
    if (entry && entry.section_label) bits.push(entry.section_label);
    if (entry && entry.secd) bits.push('secured');
    else if (entry && entry.value != null && entry.value !== '') {
      bits.push('read ' + entry.value + (entry.unit ? ' ' + entry.unit : ''));
    }

    return (head ? head + '\n\n' : '') + '— ' + bits.join(' · ');
  }

  /**
   * The `note_created` payload for one comment, or null when there is nothing
   * to file.
   *
   * Two refusals, and they are different:
   *
   *   **No component code.** The item was never pointed at a machine in Rounds
   *   Setup, so there is no component page for this to appear on and the whole
   *   point of publishing is gone. The comment is still safe in the roundslog;
   *   the Console's modal says so, because the fix is a code on the item and
   *   not a retyped comment.
   *
   *   **Nothing said.** No text and no photograph. The roundslog should not
   *   hold such a comment either, but an empty note against a machine reads as
   *   "somebody looked", which is worse than no note at all.
   *
   * No `assignment`: a creation carrying an equipment code is equipment-typed
   * by the reducer on the spot, which is what this is — about a machine, and
   * nobody in particular.
   */
  function payloadFor(comment, entry, ctx) {
    if (!comment || !entry) return null;
    var code = String(entry.asset_code || '').trim();
    if (!code) return null;
    var atts = attachmentsOf(comment);
    if (!String(comment.text || '').trim() && !atts.length) return null;

    return {
      note_id:        noteIdFor(entry.item_id, comment.timestamp),
      title:          titleFor(entry, ctx),
      body:           bodyFor(comment, entry, ctx),
      scope:          { level: 'department', department: NOTE_DEPT },
      folder:         NOTE_FOLDER,
      equipment_code: code,
      origin:         NOTE_ORIGIN,
      attachments:    atts
    };
  }

  /**
   * What a round's entries would publish, given what the Hub already holds.
   *
   * Pure, and the whole of the decision — the lane below it only reads and
   * writes. `have` is the set of note ids already in the Hub, deleted and
   * archived ones included: a note somebody deleted must not walk back in on
   * the next pass, the same rule the Recurring Notes lane follows.
   *
   * @param {Array}  entries  rounds entries, each with comments[]
   * @param {object} ctx      { date, round_number }
   * @param {Set|object} have ids already in the Hub
   * @returns {{ writes: Array, held: number, uncoded: number, empty: number }}
   */
  function plan(entries, ctx, have) {
    var known = have && typeof have.has === 'function'
      ? have : { has: function (id) { return !!(have && have[id]); } };
    var out = { writes: [], held: 0, uncoded: 0, empty: 0 };

    (entries || []).forEach(function (entry) {
      var comments = (entry && entry.comments) || [];
      if (!Array.isArray(comments) || !comments.length) return;
      comments.forEach(function (c) {
        var payload = payloadFor(c, entry, ctx);
        if (!payload) {
          if (!String((entry && entry.asset_code) || '').trim()) out.uncoded++;
          else out.empty++;
          return;
        }
        if (known.has(payload.note_id)) { out.held++; return; }
        // The comment's own author, not this console's user. The Hub stamps
        // `author` from the event's actor, and a phone's comment ingested here
        // would otherwise be attributed to whoever happened to be logged in.
        out.writes.push({
          eventType: 'note_created',
          payload:   payload,
          actor:     (c && c.author) || null
        });
      });
    });

    return out;
  }

  /**
   * Every id a set of entries could write, for the one existence query.
   *
   * Built through `payloadFor` rather than from the ids directly, so the list
   * asked about and the list written can never come apart: a comment this
   * refuses to publish is not a comment worth asking the Hub about.
   */
  function candidateIds(entries) {
    var ids = [];
    (entries || []).forEach(function (entry) {
      ((entry && entry.comments) || []).forEach(function (c) {
        var p = payloadFor(c, entry, null);
        if (p) ids.push(p.note_id);
      });
    });
    return ids;
  }

  var API = {
    NOTE_DEPT: NOTE_DEPT,
    NOTE_FOLDER: NOTE_FOLDER,
    NOTE_ORIGIN: NOTE_ORIGIN,
    noteIdFor: noteIdFor,
    attachmentsOf: attachmentsOf,
    titleFor: titleFor,
    bodyFor: bodyFor,
    payloadFor: payloadFor,
    candidateIds: candidateIds,
    plan: plan
  };

  if (typeof module === 'object' && module.exports) module.exports = API;
  else root.roundsNotes = API;

})(typeof self !== 'undefined' ? self : this);
