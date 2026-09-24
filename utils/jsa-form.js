'use strict';

// ── The JSA builder's form, its note, and the page it prints ─────────────────
//
// A JSA on this vessel is a company workbook page: a header block naming the
// task, who performs it, where it is and what PPE it needs, and then three
// columns — the steps, what could go wrong at each, and what is done about it.
// The three department templates in
// `S:\Engineer's Files\Procedures & How Tos\JSA` differ only in what is already
// typed into them, so there is one layout here and not three.
//
// The vault is where a JSA lives, so the form has to survive a round trip
// through a Markdown note. Three functions carry that:
//
//   noteText(form)     the form as the vault note it is stored as
//   formFromNote(...)  that note read back into a form
//   buildDocument(...) the form as the page that is printed or saved as a PDF
//
// **The note is the record and the form is a reading of it.** Anything the
// builder does not model — a section somebody wrote in Obsidian, a table nobody
// here has a field for — is carried through `extra` untouched rather than
// dropped, because the round trip happens every time a draft is edited and a
// lossy one would quietly delete a colleague's paragraph.
//
// Pure: no DOM, no IPC, nothing global it does not check for. The screen hands
// it a form and gets back text; `tools/test-jsa-form.js` runs it in node.
//
// ESCAPE FIRST, like navipedia-cards-print.js and for the same reason: the
// vault is a share many people write to and a note is data, not markup.

(function (root) {

  // ── The form ───────────────────────────────────────────────────────────────
  //
  // Every field is a string except `steps` and the two lists, because that is
  // what the workbook holds: free text in a box, typed by an officer. Offering
  // a picker where the company form offers a line would be inventing a schema
  // the paper does not have, and the paper is what gets signed.
  function blankForm(today) {
    return {
      id:          '',
      title:       '',
      date:        today || new Date().toISOString().slice(0, 10),
      asset:       '',          // "601.001 Main Engine" — code first, see assetCode()
      department:  '',
      titles:      '',          // titles of those who perform the task
      supervisor:  '',
      author:      '',
      approved_by: '',
      status:      'draft',
      revision:    '0',
      job:         '',          // "[[SOP-…]]" when seeded from a card, else the work description
      ppe:         '',
      notes:       '',
      caution:     '',
      unusual:     '',
      flags:       '',
      isolation:   '',          // what the officer wrote about isolation
      // The two LOOKED-UP blocks, kept apart from the prose beside them so that
      // running a lookup again replaces the lookup and never the officer's own
      // words. Both are Markdown, both lead with a `###` heading, and that
      // heading is what tells them apart on the way back in — see §3 and §6 in
      // formFromNote.
      isolationTable:  '',      // §3, anything under it this form does not model
      // §3's table. One row per lock, per valve, per stored source. Assembled
      // from the card set's own LO/TO sections, the panel schedule and the
      // standing energy list — and then EDITED: a row that does not apply is
      // deleted, a row nobody wrote down is added. A search that cannot be
      // corrected is a search nobody trusts.
      isolationRows:   [],      // [{ hazard, location, position, area, load, from }]
      competency:  '',          // what the officer wrote about competency
      competencyTable: '',      // §6, from the crew record
      // Who is doing this job. Editable for as long as the JSA is a draft —
      // that is the point of it: a JSA is written before the work, read by the
      // people who will do it, and somebody gets moved. The competency check
      // runs against this list, so changing it changes the answer, and signing
      // freezes whichever answer was true at the time.
      assigned_crew: [],
      // The competencies the job requires. A composition takes them from the
      // card set; on a JSA written from scratch they are named here.
      ksa:         [],
      permits:     [],
      hazardsBlock: '',         // §4 as somebody else wrote it — see formFromNote
      composed_from: [],
      built_with:  'form',      // how it was authored; a composed JSA carries no such key
      changeNote:  '',          // what the Change Log line says about this save
      steps:       [{ step: '', hazards: '', controls: '' }],
      extra:       []           // [{ heading, text }] — sections this form does not model
    };
  }

  // The standing paragraph the Engineering template carries above its table.
  // It is a default in a text box, not a constant printed behind the officer's
  // back: a JSA for one non-routine job should be able to say something else.
  const DEFAULT_CAUTION =
    'This JSA covers the task named above. For non-routine work, all participating '
    + 'personnel must identify and review hazards specific to the job being performed. '
    + 'When a task involves multiple crewmembers, the least senior crewmember sets the pace.';

  // ── Small helpers ──────────────────────────────────────────────────────────

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function tidy(s) { return String(s == null ? '' : s).trim(); }

  // `approved_by:` with nothing after it parses as `[]` — "not stated", not
  // "an empty list". vault-corpus.js says the same thing about the same key.
  function scalar(v) {
    if (v == null) return '';
    if (Array.isArray(v)) return v.length === 1 ? String(v[0]).trim() : '';
    if (typeof v === 'object') return '';
    return String(v).trim();
  }
  function list(v) {
    if (v == null) return [];
    if (Array.isArray(v)) return v.map(x => String(x).trim()).filter(Boolean);
    if (typeof v === 'object') return [];
    const s = String(v).trim();
    return s ? [s] : [];
  }

  // ── PPE ────────────────────────────────────────────────────────────────────
  //
  // Ticked, not typed. "Required PPE for this task" was a free-text box, and a
  // box is how one JSA asks for "gloves", the next for "hand protection" and a
  // third forgets boots — then the crew-facing workbook prints three different
  // answers to one question.
  //
  // **The wording is the vessel's, not this file's.** Every line below that
  // overlaps the company JSA workbook templates is worded the way those
  // templates word it — "Non-slip steel-toed shoes or boots", "approved hard
  // hat", "gloves with liners", "climbing safety harness" — because the ticked
  // answer is printed into A8 of that same workbook and should read like the
  // form it lands on. The gloves are split finer than the templates do, which
  // is the one place this goes further: a template that says "gloves
  // (electrical gloves as needed)" is not telling anybody which pair to draw.
  //
  // `form.ppe` stays what it has always been — one item per line. The ticks are
  // a picker over that list, so the note's `ppe:` list, the printed page and
  // the Excel cell all keep working with no idea this exists, and anything
  // typed in free rides alongside as its own line.
  const PPE_CATALOGUE = [
    ['Hands', [
      'Work gloves',
      'Gloves with liners',
      'Cut-resistant gloves',
      'Chemical-resistant gloves',
      'Electrical insulating gloves',
      'Fish gloves with liners'
    ]],
    ['Eyes and face', [
      'Safety glasses',
      'Safety goggles',
      'Brazing/welding goggles',
      'Face shield'
    ]],
    ['Head and feet', [
      'Approved hard hat',
      'Non-slip steel-toed shoes or boots'
    ]],
    ['Hearing and breathing', [
      'Hearing protection',
      'Dust mask or respirator',
      'NH3 mask',
      'SCBA'
    ]],
    ['Body', [
      'Approved PFD',
      'Approved HiVis PFD',
      'High-visibility vest',
      'Chemical apron or splash suit',
      'Proper freezer attire',
      'Weather-appropriate clothing'
    ]],
    ['Working at height', [
      'Climbing safety harness'
    ]]
  ];

  // Case and spacing only. Two officers writing "Safety Glasses" and "safety
  // glasses" mean one item and must not tick two boxes or print two lines.
  function ppeKey(s) {
    return String(s == null ? '' : s).toLowerCase().replace(/\s+/g, ' ').trim();
  }

  function ppeHas(ppe, item) {
    const k = ppeKey(item);
    return splitLines(ppe).some(x => ppeKey(x) === k);
  }

  // Returns the new PPE text. Unticking removes the line however it was
  // capitalised; ticking appends it in the catalogue's own words.
  function ppeToggle(ppe, item) {
    const lines = splitLines(ppe);
    const k = ppeKey(item);
    const out = lines.filter(x => ppeKey(x) !== k);
    if (out.length === lines.length) out.push(tidy(item));
    return out.join('\n');
  }

  // What is ticked that the catalogue does not know about — a free entry. Shown
  // as its own pill so it is as visible as the ticked ones, and removable the
  // same way.
  function ppeExtras(ppe) {
    const known = new Set();
    for (const [, items] of PPE_CATALOGUE) for (const i of items) known.add(ppeKey(i));
    return splitLines(ppe).filter(x => !known.has(ppeKey(x)));
  }

  // ── The asset, and why the code leads ──────────────────────────────────────
  //
  // `asset:` is what makes a JSA reachable from Inventory › Components, and the
  // join is on the code and nothing else. JSA-0001 was written
  // `601.001 Main Engine  # IDMS registry - prints as Location of the task`, so
  // the convention predates the builder — this only holds it still.
  //
  // A trailing dot is not part of a code ("601.001." at the end of a sentence),
  // and a bare name with no code is a legitimate answer: a JSA over a task that
  // touches no one machine files under no component, and must not be forced
  // onto the nearest one.
  function assetCode(asset) {
    const m = String(asset || '').trim().match(/^(\d+(?:\.\d+)*)/);
    return m ? m[1].replace(/\.$/, '') : '';
  }
  function assetName(asset) {
    const code = assetCode(asset);
    return String(asset || '').trim().slice(code.length).replace(/^[\s—–-]+/, '').trim();
  }

  // ── Ids ────────────────────────────────────────────────────────────────────
  //
  // `JSA-####-<ISO date>`. The number is allocated from the highest one the
  // range already holds, not from the SOP being composed over — a composed JSA
  // takes its number from its job wrapper, and a built one has no wrapper to
  // take a number from. Both live in one folder, so one allocator reads both.
  function nextNumber(existingIds) {
    let max = 0;
    for (const id of existingIds || []) {
      const m = String(id).match(/JSA-(\d+)/i);
      if (m) max = Math.max(max, parseInt(m[1], 10) || 0);
    }
    return String(max + 1).padStart(4, '0');
  }
  function makeId(number, date) {
    return 'JSA-' + String(number).padStart(4, '0') + '-' + tidy(date);
  }
  function fileNameFor(form) {
    return tidy(form.id) + '.md';
  }

  // ── What a JSA must say before anybody signs it ────────────────────────────
  //
  // Findings, not a blocked Save. A draft with a gap in it is a normal state —
  // it is being written — and the officer is the one who decides it is ready.
  // Saving a half-written JSA and losing it are the two outcomes, and only one
  // of them is recoverable.
  function validate(form) {
    const out = [];
    if (!tidy(form.title))  out.push({ field: 'title',  detail: 'The JSA has no task title.' });
    if (!tidy(form.date))   out.push({ field: 'date',   detail: 'No date.' });
    if (!tidy(form.asset))  out.push({ field: 'asset',  detail: 'No component named, so this JSA will not appear under any machine in Inventory › Components.' });
    else if (!assetCode(form.asset)) out.push({ field: 'asset', detail: 'The component is named but carries no register code, so nothing can file it. Pick it from the register rather than typing it.' });
    if (!tidy(form.titles)) out.push({ field: 'titles', detail: 'Nobody is named as performing the task.' });
    if (!tidy(form.ppe))    out.push({ field: 'ppe',    detail: 'No PPE stated. "None required" is an answer; blank is not.' });
    // The `jsa-creation` skill's rule, and the reason it is a finding rather
    // than a blank box nobody notices: a breaker list is not an isolation, and
    // the energy a schedule cannot show is what a thorough-looking JSA leaves
    // out. "No isolation required" is an answer.
    // A row with a hazard named and nowhere to go and lock it out is a question
    // nobody has answered. Reported per row rather than as one line, because
    // which one is unanswered is the useful part.
    for (const r of isolationRowsOf(form)) {
      if (tidy(r.hazard) && !tidy(r.location) && !tidy(r.position)) {
        out.push({ field: 'isolation',
          detail: '"' + tidy(r.hazard) + '" is listed as an energy source with no isolation point '
                + 'against it. Say where it is isolated, or delete the row if it does not apply here.' });
      }
    }
    if (!tidy(form.isolation) && !tidy(form.isolationTable) && !isolationRowsOf(form).length) out.push({ field: 'isolation',
      detail: 'Nothing stated about isolation or permits. "No isolation required" is an answer; blank is not — '
            + 'and a breaker list on its own is not an isolation. Run the panel-schedule lookup, then say '
            + 'what the schedule cannot: stored air, fuel, accumulators, shaft rotation, turning gear.' });
    // The looked-up half on its own is not an answer either. The schedule
    // cannot show stored or mechanical energy, and a JSA that lists breakers
    // and stops is the thorough-looking one the skill warns about.
    else if ((tidy(form.isolationTable) || isolationRowsOf(form).length) && !tidy(form.isolation)) out.push({ field: 'isolation',
      detail: 'The panel schedule has been searched but nobody has written anything about this job’s '
            + 'isolation. The breaker list is the part a lookup can do; which points apply, who confirms '
            + 'them and what stored energy is present is the part it cannot.' });
    // Competency: the check answers a question nobody asked if nobody is going
    // to do the job, and required competencies with nobody assigned is the
    // state this screen exists to let an officer fix before signing.
    if ((form.ksa || []).length && !(form.assigned_crew || []).length) out.push({ field: 'assigned_crew',
      detail: 'This JSA names ' + (form.ksa || []).length + ' required competenc'
            + ((form.ksa || []).length === 1 ? 'y' : 'ies')
            + ' and nobody is assigned to the job, so nothing has been checked against the crew record.' });
    const steps = stepRows(form);
    if (!steps.length) out.push({ field: 'steps', detail: 'No task steps.' });
    steps.forEach((s, i) => {
      if (!tidy(s.hazards))  out.push({ field: 'steps.' + i, detail: 'Step ' + (i + 1) + ' names no hazard. "No hazard identified" is an answer; blank is not.' });
      if (!tidy(s.controls)) out.push({ field: 'steps.' + i, detail: 'Step ' + (i + 1) + ' names no control.' });
    });
    return out;
  }

  // Rows with something in them. A builder leaves a blank row at the bottom to
  // type into and it must not reach paper.
  function stepRows(form) {
    return (form.steps || []).filter(s =>
      tidy(s.step) || tidy(s.hazards) || tidy(s.controls));
  }

  // ── The note ───────────────────────────────────────────────────────────────

  // YAML that a flat reader can read back. Quote only what forces it, the way
  // sop-editor.js does — a diff nobody asked for is a diff nobody can review.
  function yamlScalar(v) {
    const s = String(v == null ? '' : v);
    if (s === '') return '';
    if (/^[\s]|[\s]$|^[-?:,[\]{}#&*!|>'"%@`]|: |#|\r|\n/.test(s)) {
      return '"' + s.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
    }
    return s;
  }
  function yamlLine(key, v) {
    const s = yamlScalar(v);
    return key + ':' + (s ? ' ' + s : '');
  }
  function yamlList(key, items) {
    const vals = list(items);
    if (!vals.length) return key + ': []';
    return key + ':\n' + vals.map(v => '  - ' + yamlScalar(v)).join('\n');
  }

  // A cell of the three-column table. Newlines are the workbook's own shape —
  // a LOTO step is a list of breakers — so they survive as `<br>`, which is
  // what Obsidian renders inside a table cell and what reads back cleanly.
  function cell(text) {
    return String(text == null ? '' : text)
      .replace(/\r\n?/g, '\n')
      .split('\n').map(l => l.trim()).join('<br>')
      .replace(/\|/g, '\\|')
      .trim() || '—';
  }
  function uncell(text) {
    return String(text == null ? '' : text)
      .replace(/\\\|/g, '|')
      .replace(/<br\s*\/?>/gi, '\n')
      .trim();
  }

  // The body section heading a section's text belongs under. The template in
  // `30.1 Templates` numbers its headings and both dialects — composed and
  // built — keep those numbers, so a reader who knows §3 is isolation knows it
  // on either.
  const SECTIONS = [
    ['unusual',    '1. What is unusual about this job'],
    ['flags',      '2. Red flags for officer review'],
    ['isolation',  '3. Isolation and permits'],
    [null,         '4. Hazards and controls'],       // the table — written, not free text
    [null,         '5. Sequence'],                   // a pointer at §4, see below
    ['competency', '6. Competency'],
    [null,         '7. Sign-off']
  ];

  // Which sections carry a looked-up block underneath the officer's prose, and
  // which field holds it. §3's comes from the electrical panel schedule and §6's
  // from the crew record; both are regenerated on demand, so they are kept in
  // their own field and never mixed into the text somebody typed.
  const LOOKUP_BLOCK = { isolation: 'isolationTable', competency: 'competencyTable' };

  // ── §3's isolation table ───────────────────────────────────────────────────
  //
  // The columns an engineer standing at a panel needs: what KIND of energy,
  // WHICH panel, WHICH position on it, and WHERE that panel is. `What it
  // isolates` is the load as the schedule or the card words it — how you know
  // you have the right breaker before you open it. `From` is the card or the
  // source the row came out of, so a row can be argued with.
  const ISO_COLUMNS = ['Hazard', 'Location', 'Position', 'Area', 'What it isolates', 'From'];
  const ISO_KEYS    = ['hazard', 'location', 'position', 'area', 'load', 'from'];

  function isolationRowsOf(form) {
    return (form.isolationRows || []).filter(r =>
      ISO_KEYS.some(k => tidy(r && r[k])));
  }

  function isolationTableMd(rows) {
    const head = '| ' + ISO_COLUMNS.join(' | ') + ' |\n|' + ISO_COLUMNS.map(() => '---').join('|') + '|';
    if (!rows.length) return '';
    return head + '\n' + rows.map(r =>
      '| ' + ISO_KEYS.map(k => cell(r[k])).join(' | ') + ' |').join('\n');
  }

  // Ours by its header, never by the `|---|` rule — the same rule §4 learned
  // the hard way. A table somebody else wrote into §3 stays whole in
  // `isolationTable` and is editable as Markdown.
  function parseIsolationTable(text) {
    const lines = String(text || '').split(/\r?\n/);
    const rows = [];
    const other = [];
    let inTable = false;
    for (const line of lines) {
      const t = line.trim();
      if (t.startsWith('|')) {
        const cells = tableCells(t);
        if (/^hazard$/i.test(cells[0] || '') && /^location$/i.test(cells[1] || '')) { inTable = true; continue; }
        if (!inTable) { other.push(line); continue; }
        if (cells.every(c => /^:?-+:?$/.test(c))) continue;
        // `cell()` writes an em-dash for an empty column so the table stays
        // square; it reads back as empty, the way a step row's does. Without
        // this an energy source with no point against it comes back with "—"
        // in every column and stops being a finding.
        const row = {};
        ISO_KEYS.forEach((k, i) => {
          const v = uncell(cells[i] || '');
          row[k] = v === '—' ? '' : v;
        });
        if (ISO_KEYS.some(k => row[k])) rows.push(row);
        continue;
      }
      if (inTable && t) { inTable = false; other.push(line); continue; }
      if (!inTable) other.push(line);
    }
    return { rows, other: other.join('\n').trim(), found: rows.length > 0 };
  }

  function noteText(form, opts) {
    opts = opts || {};
    const steps = stepRows(form);
    const eol   = opts.eol === '\r\n' ? '\r\n' : '\n';

    const fm = [
      yamlLine('id', form.id),
      yamlLine('job', form.job),
      // The trailing comment only when there is a value in front of it:
      // `asset:   # …` parses as a value of "# …", because vault-corpus.js only
      // strips a comment that has whitespace in front of the hash.
      yamlLine('asset', form.asset) + (tidy(form.asset)
        ? '   # IDMS registry — prints as Location of the task' : ''),
      yamlLine('department', form.department),
      yamlLine('titles', form.titles),
      yamlLine('supervisor', form.supervisor),
      yamlLine('date', form.date),
      yamlLine('revision', form.revision || '0'),
      yamlLine('author', form.author),
      yamlLine('approved_by', form.approved_by),
      yamlLine('status', form.status || 'draft'),
      yamlList('ppe', splitLines(form.ppe)),
      yamlList('permits', form.permits),
      // The competencies the job demands. Named `requires_ksa` because that is
      // the key the SOP and job cards already use for the same thing — one word
      // for one idea across the corpus, so a reader who knows it on a card
      // knows it here.
      yamlList('requires_ksa', (form.ksa || []).map(k => (k && k.id) ? k.id : k)),
      yamlList('composed_from', form.composed_from),
      // The template's own flag for a JSA that was not crawled out of the
      // corpus. The builder is exactly that case, so it is stated rather than
      // left to be inferred from an empty `composed_from`.
      'uncomposed: ' + (list(form.composed_from).length ? 'false' : 'true'),
      // How this JSA was authored, kept as it was. A composed JSA opened in the
      // builder and edited is still a composition of those cards at those
      // revisions — the editing does not turn its provenance into something else.
      yamlLine('built_with', form.built_with || 'form'),
      // The template has always had this key and the builder always wrote it
      // empty. It is the JSA's answer to "who is doing this", and the
      // competency check is run against it.
      yamlList('assigned_crew', form.assigned_crew)
    ].join('\n');

    const head = '# ' + tidy(form.id) + ' — ' + tidy(form.title) + ' — ' + tidy(form.date);

    const body = [];
    body.push(head);
    body.push('');
    body.push('Built on the company JSA workbook form. The table in §4 is that form\'s three'
            + '\ncolumns; §5 does not repeat it. **This is a proposal until an officer signs it.**');

    for (const [key, heading] of SECTIONS) {
      body.push('');
      body.push('## ' + heading);
      body.push('');
      if (key) {
        // §3 and §6 are the officer's own words FIRST, then whatever was looked
        // up, under its `###` heading. That order is what makes the round trip
        // work — everything before the first `###` is prose, everything from it
        // is the lookup — and it is also the right order to read: what this
        // officer decided about this job, then the evidence it stands on.
        const looked = LOOKUP_BLOCK[key] ? tidy(form[LOOKUP_BLOCK[key]]) : '';
        const prose  = tidy(form[key]);
        const isoMd  = key === 'isolation' ? isolationTableMd(isolationRowsOf(form)) : '';
        if (!prose && !looked && !isoMd) { body.push('_Nothing stated._'); continue; }
        if (prose) body.push(prose);
        if (isoMd) {
          if (prose) body.push('');
          body.push('### Isolation points');
          body.push('');
          body.push(isoMd);
          body.push('');
          body.push('**Every row is confirmed before it is trusted.** A point off the panel schedule is '
            + 'what the vessel wrote down, not proof of what is wired today, and a row with no location '
            + 'against it is a question nobody has answered yet. **A breaker list is not an isolation.**');
        }
        if (looked) { if (prose || isoMd) body.push(''); body.push(looked); }
        continue;
      }
      if (heading.startsWith('4.')) {
        if (tidy(form.hazardsBlock)) { body.push(tidy(form.hazardsBlock)); body.push(''); }
        if (tidy(form.caution)) { body.push(tidy(form.caution)); body.push(''); }
        // A composed JSA that nobody has added steps to keeps its own §4 and
        // gains no empty table: an empty table under somebody's hazard analysis
        // reads as a second, contradictory one.
        if (steps.length || !tidy(form.hazardsBlock)) body.push(stepTable(steps));
        continue;
      }
      if (heading.startsWith('5.')) {
        body.push('The sequence is column A of the table in §4. It is not repeated here, so the'
                + '\ntwo cannot drift apart.');
        continue;
      }
      // §7
      body.push('| Reviewed by | Date | Signature |');
      body.push('|---|---|---|');
      body.push('| ' + (tidy(form.approved_by) || '') + ' | ' + (tidy(form.approved_by) ? tidy(form.date) : '') + ' |  |');
      body.push('');
      body.push(tidy(form.approved_by)
        ? 'Signed. A JSA is a frozen instance — a later job is a new JSA, never a revision of this one.'
        : 'Unsigned. An officer signs in the Console; the signature binds to the text of'
          + '\nthis note as it stands at signing.');
    }

    for (const s of (form.extra || [])) {
      if (!tidy(s.heading)) continue;
      body.push('');
      body.push('## ' + tidy(s.heading));
      body.push('');
      body.push(tidy(s.text));
    }

    // Notes from the form's own box are the workbook's `Notes:` cell and belong
    // on the page, not in a section a reader has to go looking for. They ride
    // in frontmatter-adjacent prose under their own heading so both the note
    // and the printed form can show them.
    if (tidy(form.notes)) {
      body.push('');
      body.push('## Notes');
      body.push('');
      body.push(tidy(form.notes));
    }

    body.push('');
    body.push('## Change Log');
    body.push('');
    body.push('- ' + tidy(form.date) + ' — ' + (tidy(form.author) || 'unknown')
      + ' — ' + (tidy(form.changeNote) || 'Built in the Console\'s JSA builder.'));
    body.push('');

    return ('---\n' + fm + '\n---\n\n' + body.join('\n')).replace(/\n/g, eol);
  }

  function stepTable(steps) {
    const head = '| A. Sequence of task steps | B. Potential hazards | C. Recommended actions or procedures |\n|---|---|---|';
    if (!steps.length) return head + '\n| _no steps written_ | — | — |';
    return head + '\n' + steps.map((s, i) =>
      '| ' + cell(numbered(s.step, i)) + ' | ' + cell(s.hazards) + ' | ' + cell(s.controls) + ' |').join('\n');
  }

  // The officer types "Notify the engine department"; the workbook shows
  // "1. Notify…". The number is added on the way out and taken off on the way
  // back, so re-ordering a row renumbers the page and never leaves two 3s.
  function numbered(text, i) {
    const t = tidy(text);
    if (!t) return t;
    return /^\d+\./.test(t) ? t : (i + 1) + '. ' + t;
  }
  function unnumbered(text) {
    return String(text == null ? '' : text).replace(/^\s*\d+\.\s*/, '');
  }

  function splitLines(v) {
    if (Array.isArray(v)) return v.map(tidy).filter(Boolean);
    return String(v == null ? '' : v)
      .split(/\r?\n|;\s*/).map(s => s.replace(/^[-•*]\s*/, '').trim()).filter(Boolean);
  }

  // ── Reading a note back ────────────────────────────────────────────────────
  //
  // `note` is `{ frontmatter, body }` as vault:readNote returns it.
  function formFromNote(rec, note) {
    const fm   = (note && note.frontmatter) || {};
    const body = String((note && note.body) || '');
    const form = blankForm();

    form.id          = scalar(fm.id) || (rec && rec.id) || '';
    form.job         = scalar(fm.job);
    form.asset       = scalar(fm.asset);
    form.department  = scalar(fm.department);
    form.titles      = scalar(fm.titles);
    form.supervisor  = scalar(fm.supervisor);
    form.date        = scalar(fm.date);
    form.revision    = scalar(fm.revision) || '0';
    form.author      = scalar(fm.author);
    form.approved_by = scalar(fm.approved_by);
    form.status      = scalar(fm.status) || 'draft';
    form.ppe         = list(fm.ppe).join('\n');
    form.permits     = list(fm.permits);
    form.assigned_crew = list(fm.assigned_crew);
    form.ksa         = list(fm.requires_ksa).map(unwrapWiki).filter(Boolean).map(id => ({ id, demandedBy: [] }));
    form.composed_from = list(fm.composed_from);
    form.built_with  = scalar(fm.built_with)
      || (form.composed_from.length ? 'composed' : 'form');

    const secs = bodySections(body);
    const take = heading => {
      const hit = secs.find(s => norm(s.heading).startsWith(heading));
      return hit ? hit.text.trim() : '';
    };
    form.title = titleOf(body) || scalar(fm.title) || (rec && rec.title) || '';
    form.unusual    = stripPlaceholder(take('1.'));
    form.flags      = stripPlaceholder(take('2.'));
    form.notes      = stripPlaceholder(take('notes'));

    // §3 and §6 each hold two things — what the officer wrote and what was
    // looked up for them — and they are split on the first `###`. Anything
    // before it is prose; anything from it is the block a lookup wrote, and
    // running that lookup again replaces exactly that much.
    //
    // A composed JSA's §3 is prose with no sub-heading, so it reads back whole
    // as prose, which is what it is.
    const three = splitLookup(stripPlaceholder(take('3.')));
    form.isolation = three.prose;
    // The block under §3 is ours when it carries our header. Anything else
    // somebody wrote there is kept whole and edited as Markdown, the same rule
    // §4 uses for a composed JSA's hazard table.
    const iso = parseIsolationTable(three.looked);
    form.isolationRows  = iso.rows;
    form.isolationTable = iso.found ? stripIsoBoilerplate(iso.other) : three.looked;
    const six = splitLookup(stripPlaceholder(take('6.')));
    form.competency      = six.prose;
    form.competencyTable = six.looked;

    const four = secs.find(s => norm(s.heading).startsWith('4.'));
    if (four) {
      const parsed = parseStepTable(four.text);
      if (parsed.isStepTable) {
        form.steps   = parsed.rows.length ? parsed.rows : blankForm().steps;
        form.caution = parsed.before;
      } else {
        // Somebody else's §4 — a composed JSA's merged hazard table, or prose.
        // Kept whole and written back above the step table, so an officer can
        // add steps to a composed JSA without the composition being rewritten
        // into a shape it was never in.
        form.hazardsBlock = four.text.trim();
        form.steps = blankForm().steps;
      }
    }

    // Everything the builder does not model, kept whole. A JSA composed by
    // jsa-compose.js has a §5 Sequence full of procedure text and a §2 the
    // crawl wrote; opening one here and saving it must not throw that away.
    const MODELLED = ['1.', '2.', '3.', '4.', '5.', '6.', '7.', 'notes', 'change log'];
    form.extra = secs
      .filter(s => !MODELLED.some(p => norm(s.heading).startsWith(p)))
      .map(s => ({ heading: s.heading.trim(), text: s.text.trim() }))
      .filter(s => s.text);

    // §5 only carries the pointer sentence on a built JSA. On a composed one it
    // is the whole sequence, and that is worth keeping.
    const five = secs.find(s => norm(s.heading).startsWith('5.'));
    if (five && five.text.trim() && !/not repeated here/i.test(five.text)) {
      form.extra.unshift({ heading: five.heading.trim(), text: five.text.trim() });
    }

    return form;
  }

  function norm(h) { return String(h || '').trim().toLowerCase(); }

  // `[[SOP-0021-main-engine-start|the start]]` → `SOP-0021-main-engine-start`.
  function unwrapWiki(v) {
    const m = String(v == null ? '' : v).match(/\[\[([^\]|]+)/);
    return tidy(m ? m[1] : String(v == null ? '' : v));
  }

  // A section into the officer's prose and the block a lookup wrote under it.
  // The `###` is the seam, and it is the seam in BOTH directions: noteText
  // writes prose then the block, and this reads prose then the block.
  function splitLookup(text) {
    const t = String(text == null ? '' : text);
    const m = t.match(/^###\s+/m);
    if (!m) return { prose: t.trim(), looked: '' };
    const at = t.indexOf(m[0]);
    return { prose: t.slice(0, at).trim(), looked: t.slice(at).trim() };
  }

  // The heading and the standing sentence this form writes around its own
  // table. Read back and written again they would double on every save, which
  // is the bug the title's id-stripping already taught this file once.
  function stripIsoBoilerplate(t) {
    return String(t || '')
      .replace(/^###\s+Isolation points\s*$/im, '')
      .replace(/\*\*Every row is confirmed[\s\S]*?not an isolation\.\*\*/i, '')
      .trim();
  }

  function stripPlaceholder(t) {
    return /^_nothing stated\._?$/i.test(String(t || '').trim()) ? '' : String(t || '').trim();
  }

  // "# JSA-0002 — Fuel injector replacement — 2026-09-17" → the middle.
  //
  // The id is matched by SHAPE, not by the id the note carries. JSA-0001's
  // frontmatter says `JSA-0001-2026-08-22` and its H1 says `JSA-0001`, and
  // matching the full id against the short one left the number in the title —
  // so the next save wrote `# JSA-0001-2026-08-22 — JSA-0001 — …`, and the
  // title grew a copy of itself on every edit.
  const ID_PREFIX = /^JSA-\d+(?:-\d{4}-\d{2}-\d{2})?\s*[—–-]\s*/i;
  const DATE_SUFFIX = /\s*[—–-]\s*\d{4}-\d{2}-\d{2}\s*$/;

  function titleOf(body) {
    const m = String(body).match(/^#\s+(.+)$/m);
    if (!m) return '';
    return m[1].trim().replace(ID_PREFIX, '').replace(DATE_SUFFIX, '').trim();
  }

  function bodySections(body) {
    const out = [];
    const lines = String(body).split(/\r?\n/);
    let cur = null;
    for (const line of lines) {
      const m = line.match(/^##\s+(.+?)\s*$/);
      if (m) { cur = { heading: m[1], text: '' }; out.push(cur); continue; }
      if (cur) cur.text += line + '\n';
    }
    return out;
  }

  // Split on unescaped pipes only — `\|` inside a cell is an escaped pipe, the
  // same rule vault-corpus.js's table reader uses.
  function tableCells(line) {
    return line.split(/(?<!\\)\|/).slice(1, -1).map(c => c.trim());
  }

  // The builder's own table and nothing else. A composed JSA's §4 is a table
  // too — `| Hazard | Magnitude | Occurs at | Controls |`, four columns about a
  // different thing — and reading it as steps would file its Magnitude column
  // as hazards, its Occurs-at as controls, and drop its Controls entirely. So
  // the header is what identifies the table, never the `|---|` rule underneath
  // it: every markdown table has one of those.
  function parseStepTable(text) {
    const lines = String(text || '').split(/\r?\n/);
    const rows  = [];
    const before = [];
    let inTable = false;
    for (const line of lines) {
      const t = line.trim();
      if (t.startsWith('|')) {
        const cells = tableCells(t);
        if (cells.length < 3) { if (!inTable) before.push(line); continue; }
        if (/^a\./i.test(cells[0]) && /^b\./i.test(cells[1] || '')) { inTable = true; continue; }
        if (!inTable) { before.push(line); continue; }
        if (/^-+:?$/.test(cells[0].replace(/:/g, ''))) continue;   // the rule
        const step = uncell(cells[0]);
        if (/^_no steps written_$/i.test(step)) continue;
        rows.push({
          step:     unnumbered(step) === '—' ? '' : unnumbered(step),
          hazards:  uncell(cells[1]) === '—' ? '' : uncell(cells[1]),
          controls: uncell(cells[2]) === '—' ? '' : uncell(cells[2])
        });
        continue;
      }
      if (!inTable && t) before.push(line);
    }
    return { rows, before: before.join('\n').trim(), isStepTable: inTable };
  }

  // ── The page ───────────────────────────────────────────────────────────────
  //
  // The company workbook, as a page. Landscape US Letter, because the three
  // columns are what the form is and squeezing them into portrait is how a JSA
  // becomes unreadable on the deck.
  //
  // opts: { setup, vessel, printedAt, signatureLines, interactive }
  function buildDocument(form, opts) {
    opts = opts || {};
    const setup = opts.setup || {};
    const steps = stepRows(form);
    const signed = !!tidy(form.approved_by);

    const rows = steps.map((s, i) => `<tr>
      <td class="c-step">${multi(numbered(s.step, i), CELL)}</td>
      <td class="c-haz">${multi(s.hazards, CELL)}</td>
      <td class="c-ctl">${multi(s.controls, CELL)}</td>
    </tr>`).join('');

    const head = `<table class="hdr">
      <tr>
        <td class="hdr-title" colspan="2"><div class="ttl">${esc(tidy(form.title).toUpperCase())}</div>
          <div class="sub">${esc(tidy(form.id))}</div></td>
        <td class="hdr-inst" rowspan="4">
          <div class="lbl">Instructions:</div>
          <div class="inst">Break the task into sequential steps (Column A). For each step,
            identify potential hazards or what could go wrong (Column B). Analyze how and why
            each hazard may occur, and specify control measures to eliminate or reduce the
            risk (Column C).</div>
          <div class="lbl" style="margin-top:0.5em">Notes:</div>
          <div class="inst">${multi(form.notes, CELL) || '—'}</div>
        </td>
      </tr>
      <tr>
        <td class="hdr-f"><span class="lbl">Date:</span> ${esc(tidy(form.date))}</td>
        <td class="hdr-f"><span class="lbl">Approved by:</span> ${
          signed ? esc(tidy(form.approved_by))
                 : '<span class="draft-tag">DRAFT — NOT YET APPROVED</span>'}</td>
      </tr>
      <tr>
        <td class="hdr-f"><span class="lbl">Titles of those who perform the task:</span><br>${esc(tidy(form.titles)) || '—'}</td>
        <td class="hdr-f"><span class="lbl">Supervisor:</span><br>${esc(tidy(form.supervisor)) || '—'}</td>
      </tr>
      <tr>
        <td class="hdr-f"><span class="lbl">Location of the task:</span><br>${esc(tidy(form.asset)) || '—'}</td>
        <td class="hdr-f"><span class="lbl">Department:</span><br>${esc(tidy(form.department)) || '—'}</td>
      </tr>
      <tr>
        <td class="hdr-f hdr-ppe" colspan="3"><span class="lbl">Required PPE for this task:</span><br>${
          ppeHtml(form.ppe) || '—'}</td>
      </tr>
    </table>`;

    const caution = tidy(form.caution)
      ? `<div class="caution">${multi(form.caution)}</div>` : '';

    const sign = opts.signatureLines === false ? '' : `<table class="grid sign">
      <thead><tr><th>Reviewed by</th><th>Date</th><th>Signature</th></tr></thead>
      <tbody><tr><td>${esc(tidy(form.approved_by))}</td><td>${
        signed ? esc(tidy(form.date)) : ''}</td><td></td></tr></tbody>
    </table>`;

    // Everything else the note carries, under the table. The four named
    // sections in the order the template numbers them, then whatever else is in
    // the note — a composed JSA's sequence, a section somebody added in
    // Obsidian. **The page prints what the note says.** Dropping a section
    // because this form has no field for it would hand somebody a JSA that is
    // missing the part that mattered.
    // Who is on the job, printed as its own block and never folded into
    // "Titles of those who perform the task". The company form asks that cell
    // for REQUIRED TITLES — rank or position — and a crew name in it is the one
    // field-discipline mistake the `jsa-creation` skill calls out by name. The
    // names belong on the page all the same: this is the sheet the crew reads
    // at the pre-job brief, and who is doing it is half of that conversation.
    const crew = (form.assigned_crew || []).filter(x => tidy(x));

    const asides = [
      ['What is unusual about this job', form.unusual],
      ['Red flags for officer review',   form.flags],
      ['Isolation and permits',          form.isolation],
      ['',                               isolationTableMd(isolationRowsOf(form))],
      ['',                               form.isolationTable],
      ['Hazards and controls',           steps.length ? '' : form.hazardsBlock],
      ['Assigned for this job',          crew.length ? crew.map(c => '- ' + c).join('\n') : ''],
      ['Competency required',            form.competency],
      ['',                               form.competencyTable]
    ].concat((form.extra || []).map(s => [s.heading, s.text]))
     .filter(([, v]) => tidy(v))
     // A blank heading means "this continues the block above it" — the
     // looked-up half of §3 and §6, which carries its own `###` headings. A
     // second `<h2>` there would say the panel schedule is a different subject
     // from isolation.
     .map(([h, v]) => `<section class="aside">${tidy(h)
        ? `<h2>${esc(String(h).replace(/^\d+\.\s*/, ''))}</h2>` : ''}${mdBlock(v)}</section>`).join('');

    return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8">
<title>${esc(tidy(form.id) + ' — ' + tidy(form.title))}</title>
<style>${styles(setup)}</style>
</head><body>
<table class="frame">
  <thead><tr><td></td></tr></thead>
  <tfoot><tr><td><div class="foot-space"></div></td></tr></tfoot>
  <tbody><tr><td>
    ${letterhead(setup, opts.vessel)}
    ${head}
    ${caution}
    <table class="grid steps">
      <thead><tr>
        <th class="c-step">A. Sequence of task steps</th>
        <th class="c-haz">B. Potential hazards</th>
        <th class="c-ctl">C. Recommended actions or procedures</th>
      </tr></thead>
      <tbody>${rows || `<tr><td colspan="3"><em>${tidy(form.hazardsBlock)
        ? 'No step table — this JSA was composed from the card set, and its hazard analysis is below.'
        : 'No task steps written.'}</em></td></tr>`}</tbody>
    </table>
    ${asides}
    ${sign}
  </td></tr></tbody>
</table>
<div class="foot">${footer(form, opts)}</div>
</body></html>`;
  }

  // ── Inline text ────────────────────────────────────────────────────────────
  //
  // ESCAPED FIRST, then the handful of marks the vault's prose actually uses.
  // Every transform below matches literal asterisks, backticks or brackets in
  // already-escaped text, so the only tags in the output are the ones added
  // here.
  //
  // **Paper has no links**, but a wikilink's target is often the only name a
  // thing has — a JSA composed over the card set names `[[SOP-0002-main-engine-
  // loto-apply]]` in its red flags, and printing the slug with its brackets is
  // printing a broken link to somebody standing at a machine. So the target is
  // printed as a name.
  function inlineMd(raw) {
    let s = esc(raw);
    s = s.replace(/\[\[([^\]]+)\]\]/g, (_m, inner) => {
      const bar    = inner.lastIndexOf('|');
      const target = (bar === -1 ? inner : inner.slice(0, bar)).trim();
      const alias  = (bar === -1 ? '' : inner.slice(bar + 1)).trim();
      return '<span class="ref">' + (alias || target.replace(/#/g, ' › ')) + '</span>';
    });
    s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
    s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    // Single asterisks last, so `**bold**` is already gone and cannot be read
    // as two empty emphases around the word.
    s = s.replace(/(^|[^*\w])\*([^*\n]+)\*(?![*\w])/g, '$1<em>$2</em>');
    return s;
  }

  // Free text with the line breaks the officer typed. Paragraph breaks become
  // paragraphs and a leading bullet becomes one, because the workbook's boxes
  // are written as bullet lists and printing "• " as literal text is not it.
  // `breaks` is the difference between a CELL and PROSE, and it is the only
  // interesting decision in here.
  //
  //   A cell of the workbook — a step, a hazard, the PPE box — is typed with the
  //   line breaks the officer meant. A LOTO step is a list of breakers and it
  //   prints as one. `breaks: true`.
  //
  //   Prose read back out of the note is Markdown, where a single newline is a
  //   space: the vault's notes are hard-wrapped at about 72 characters and
  //   printing those wraps would put a ragged edge down the middle of the page,
  //   where Obsidian shows the same paragraph flowing. Default.
  //
  // Either way a `-` or `1.` list is a list. A line that carries no marker
  // continues the item above it, because that is how the vault writes a list
  // item that runs past one line.
  const LIST_MARKER = /^\s*(?:[-•*]|\d+[.)])\s+/;
  const CELL = { breaks: true };

  function multi(text, opts) {
    const breaks = !!(opts && opts.breaks);
    const t = String(text == null ? '' : text).replace(/\r\n?/g, '\n').trim();
    if (!t) return '';

    return t.split(/\n{2,}/).map(chunk => {
      const lines = chunk.split('\n').filter(l => l.trim());
      if (!lines.length) return '';
      if (LIST_MARKER.test(lines[0])) {
        const items = [];
        for (const line of lines) {
          if (LIST_MARKER.test(line)) items.push(line.replace(LIST_MARKER, '').trim());
          else if (items.length) items[items.length - 1] += ' ' + line.trim();
          else items.push(line.trim());
        }
        return '<ul>' + items.map(it => '<li>' + inlineMd(it) + '</li>').join('') + '</ul>';
      }
      return '<p>' + (breaks
        ? lines.map(l => inlineMd(l.trim())).join('<br>')
        : inlineMd(lines.join('\n')).replace(/\n/g, ' ')) + '</p>';
    }).join('');
  }

  // The PPE box is a list whatever it was typed as: it is a YAML list in the
  // note and the workbook prints it as one, so somebody who types three lines
  // without bullets means three items.
  function ppeHtml(v) {
    const items = splitLines(v);
    if (!items.length) return '';
    if (items.length === 1) return '<p>' + inlineMd(items[0]) + '</p>';
    return '<ul>' + items.map(x => '<li>' + inlineMd(x) + '</li>').join('') + '</ul>';
  }

  // A block of the note's own prose, with its markdown tables drawn as tables.
  // Only tables, lists and paragraphs — the same small dialect the vault's
  // notes are written in, and the same rule about what the page will not do:
  // anything outside it falls through as text, which is the right failure for a
  // document this screen cannot edit.
  function mdBlock(text) {
    const lines = String(text == null ? '' : text).replace(/\r\n?/g, '\n').split('\n');
    const out = [];
    let buf = [];
    const flush = () => { if (buf.length) { out.push(multi(buf.join('\n'))); buf = []; } };

    for (let i = 0; i < lines.length; i++) {
      // A sub-heading inside a section — `### Not on the panel schedule` in a
      // composed JSA's §3 — is a heading, not three hashes of literal text.
      const h = lines[i].match(/^(#{3,6})\s+(.+?)\s*$/);
      if (h) { flush(); out.push('<h3>' + inlineMd(h[2]) + '</h3>'); continue; }
      if (!lines[i].trim().startsWith('|')) { buf.push(lines[i]); continue; }
      flush();
      const table = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) { table.push(lines[i].trim()); i++; }
      i--;
      const rows = table.map(tableCells)
        .filter(cells => !cells.every(c => /^:?-+:?$/.test(c)));
      if (!rows.length) continue;
      const [head, ...body] = rows;
      out.push('<table class="grid"><thead><tr>'
        + head.map(c => '<th>' + inlineMd(uncell(c)) + '</th>').join('')
        + '</tr></thead><tbody>'
        + body.map(r => '<tr>' + r.map(c => '<td>' + multi(uncell(c), CELL) + '</td>').join('') + '</tr>').join('')
        + '</tbody></table>');
    }
    flush();
    return out.join('\n');
  }

  function letterhead(setup, vessel) {
    const cells = { left: '', center: '', right: '' };
    const put = (align, html, fallback) => {
      const at = ['left', 'center', 'right'].includes(align) ? align : fallback;
      cells[at] += html;
    };
    if (setup.companyLogo) put(setup.companyLogoAlign, `<img class="logo" src="${esc(setup.companyLogo)}" alt="">`, 'left');
    if (setup.vesselIcon)  put(setup.vesselIconAlign,  `<img class="logo" src="${esc(setup.vesselIcon)}" alt="">`, 'right');
    cells.center += `<div class="lh-text">
      ${vessel ? `<div class="lh-vessel">${esc(vessel)}</div>` : ''}
      <div class="lh-kind">Job Safety Analysis</div>
    </div>`;
    return `<header class="lh">
      <div class="lh-cell lh-left">${cells.left}</div>
      <div class="lh-cell lh-center">${cells.center}</div>
      <div class="lh-cell lh-right">${cells.right}</div>
    </header>`;
  }

  function fmtDate(d) {
    const dt = d instanceof Date ? d : new Date(d || Date.now());
    return dt.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function footer(form, opts) {
    return [
      esc(tidy(form.id)), esc(opts.vessel || ''),
      'Printed ' + esc(fmtDate(opts.printedAt)),
      '<span class="uncontrolled">uncontrolled when printed; check the Console for the current revision</span>'
    ].filter(Boolean).join(' &nbsp;·&nbsp; ');
  }

  function styles(setup) {
    const accent = setup.headerColor || '#555555';
    const second = setup.secondaryColor || '#222222';
    return `
@page { size: letter landscape; margin: 0.5in 0.5in 0.7in; }
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body { font: 10pt/1.35 "Segoe UI", Arial, sans-serif; color: #111; background: #fff; }
.frame { width: 100%; border-collapse: collapse; }
.frame > tbody > tr > td { padding: 0; }
.foot-space { height: 0.45in; }
.foot { position: fixed; bottom: 0; left: 0; right: 0; font-size: 7.5pt; color: #555;
  border-top: 0.5px solid #bbb; padding-top: 0.15em; }
.uncontrolled { font-style: italic; }

.lh { display: flex; align-items: center; gap: 0.6em; border-bottom: 1.5px solid ${second};
  padding-bottom: 0.3em; margin-bottom: 0.5em; }
.lh-cell { flex: 1 1 0; display: flex; align-items: center; gap: 0.5em; }
.lh-left { justify-content: flex-start; } .lh-center { justify-content: center; flex-direction: column; }
.lh-right { justify-content: flex-end; }
.logo { max-height: 0.5in; max-width: 2in; }
.lh-vessel { font-size: 12pt; font-weight: 700; color: ${second}; }
.lh-kind { font-size: 8pt; letter-spacing: 0.1em; text-transform: uppercase; color: ${accent}; }

.hdr { width: 100%; border-collapse: collapse; margin-bottom: 0.5em; }
.hdr td { border: 0.5px solid #999; padding: 0.3em 0.5em; vertical-align: top; }
.hdr-title { background: ${accent}; color: #fff; }
.ttl { font-size: 13pt; font-weight: 700; line-height: 1.15; }
.sub { font-size: 8pt; opacity: 0.85; letter-spacing: 0.06em; }
.hdr-inst { width: 34%; font-size: 8pt; color: #333; }
.hdr-f { width: 33%; }
.hdr-ppe { width: auto; }
.lbl { font-size: 7.5pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: #555; }
.inst p, .inst ul { margin: 0.15em 0; }
.draft-tag { color: #a11; font-weight: 700; }

.caution { border: 1px solid #c98a1a; background: #fff8ea; padding: 0.3em 0.55em;
  margin-bottom: 0.5em; font-size: 9pt; }
.caution p { margin: 0.15em 0; }

/* A fixed layout and a break rule on the cells, because a table out of the note
   is not one this page chose the columns of: a composed JSA's isolation table
   has a long unbroken control sentence in it, and an auto layout let that one
   cell push the whole table off the right-hand edge of the page. */
.grid { width: 100%; border-collapse: collapse; margin-bottom: 0.6em; table-layout: fixed; }
.grid th, .grid td { overflow-wrap: anywhere; word-break: normal; }
.grid th { background: ${accent}; color: #fff; text-align: left; font-size: 8.5pt;
  padding: 0.3em 0.5em; letter-spacing: 0.02em; }
.grid td { border: 0.5px solid #999; padding: 0.35em 0.5em; vertical-align: top; }
.grid tr { break-inside: avoid; page-break-inside: avoid; }
.grid thead { display: table-header-group; }
.steps .c-step { width: 34%; }
.steps .c-haz  { width: 26%; }
.steps .c-ctl  { width: 40%; }
.grid p { margin: 0.1em 0; }
.grid ul { margin: 0.1em 0; padding-left: 1.1em; }

.ref { font-weight: 600; }
code { font-family: Consolas, "Courier New", monospace; font-size: 0.92em; background: #f2f2f2; padding: 0 0.15em; }

.aside { break-inside: avoid; page-break-inside: avoid; margin-bottom: 0.5em; }
.aside h2 { font-size: 9pt; text-transform: uppercase; letter-spacing: 0.05em; color: ${accent};
  border-bottom: 0.5px solid #ccc; margin: 0 0 0.2em; padding-bottom: 0.1em; }
.aside p { margin: 0.15em 0; } .aside ul { margin: 0.15em 0; padding-left: 1.1em; }
.aside h3 { font-size: 8.5pt; margin: 0.5em 0 0.15em; color: #333; }

.sign { width: 60%; }
.sign td { height: 2.2em; }

@media screen {
  html { background: #fff; }
  body { width: 10in; padding: 0.4in; }
  .frame > thead, .frame > tfoot { display: none; }
  .foot { position: static; margin-top: 1em; }
}
`;
  }

  // A filename a folder of handouts can tell apart.
  function pdfName(form) {
    const base = (tidy(form.id) + ' ' + tidy(form.title))
      .replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ').trim().slice(0, 90);
    return base + '.pdf';
  }

  const api = {
    blankForm, DEFAULT_CAUTION, SECTIONS,
    assetCode, assetName, nextNumber, makeId, fileNameFor,
    validate, stepRows, splitLines,
    noteText, formFromNote, parseStepTable, bodySections, titleOf,
    isolationRowsOf, isolationTableMd, parseIsolationTable, ISO_COLUMNS, ISO_KEYS,
    PPE_CATALOGUE, ppeKey, ppeHas, ppeToggle, ppeExtras,
    buildDocument, pdfName,
    // exported for the tests and for the screen's own escaping
    esc, scalar, list
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.jsaForm = api;

})(typeof window !== 'undefined' ? window : globalThis);
