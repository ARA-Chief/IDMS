'use strict';

// ── Navipedia → Diagnostics: the ladder's mechanical half ────────────────────
//
// What the vessel's own record says about a machine, at three rungs of the
// progressive diagnostic ladder — docs/navipedia-diagnostics.md.
//
//   Tier 1   the record         Roundtable's `,history` / `,failure` walk: the
//                               authored failure-history note, recited — its
//                               modes, first moves and open items — or, with no
//                               note, the raw job-history mirror, said to be
//                               unread record rather than a summary.
//   Tier 2   this unit          The escalation script's `tier2`: the note's
//                               modes as ranked candidates, each with its house
//                               category and ISO 14224 reading, criticality,
//                               and what the corpus covers.
//   Tier 3   the machines       The escalation script's `population`: the two
//            beside it          axes (parallel numbering; type and class),
//                               never merged, each unit's recorded modes laid
//                               side by side, and a literal search of the
//                               record across them.
//
// Tier 3's other half — deciding which precedent is the same fault, writing a
// discriminator, calling common cause — is a READING, and Tier 4 converses. Both
// are the Maintenance seat's in the room and are not here. This file does only
// what gives the same bytes every time: it recites, ranks by a number an author
// wrote down, counts and lists. It never decides which mode you have.
//
// THE RULES ARE ROUNDTABLE'S. The parsers and the ranking are ported from
// roundtable/deployment/scripts/escalation/escalation.py and
// failure-lookup/failure_lookup.py, because a person who asks the room and the
// Console the same question must get the same answer. If the room's rules
// change, change these with them; tools/test-navipedia-diagnostics.js is the
// list the two share.
//
// Pure: no DOM, no IPC. UMD, so main/diagnostics.js parses the corpus with it
// and the test runs it in node.

(function (root) {

  // ── Vocabulary ──────────────────────────────────────────────────────────────

  // history-lookup's nine house categories, in its own order, with the question
  // each answers. They are this vessel's vocabulary, not ISO's.
  const CATEGORIES = [
    ['EL', 'Electrical supply / cabling', 'cable, plug, junction box, physical damage to the run'],
    ['EM', 'Motor / drive',               'motor, gearbox, VFD fault codes, drive failure'],
    ['CT', 'Control / interlock',         'E-stop loop, PLC, push-buttons, sensors, "everything stopped"'],
    ['MC', 'Mechanical wear',             'bearings, rollers, chains, belts, tracking, tension'],
    ['ST', 'Structure / mounting',        'frames, brackets, welds, fasteners, alignment'],
    ['HY', 'Hydraulic / pneumatic',       'pumps, cylinders, hoses, seals, pressure'],
    ['PR', 'Process / operating condition', 'fouling, ice, condensation, wrong loading, wrong setting'],
    ['OP', 'Operator-induced',            'mishandling, damage during another operation'],
    ['CS', 'Consumable / service',        'oil, filters, greasing, lamps, wear parts']
  ].map(([code, name, answers]) => ({ code, name, answers }));

  // escalation.py ISO_14224. A MAPPING, NOT A TAG: it prints as a mapping,
  // house code first, so a reader can see the translation and disagree with it.
  const ISO_14224 = {
    EL: ['Electrical failure (ELF)', 'open circuit, no power, faulty power, earth or isolation fault'],
    EM: ['Electrical failure (ELF) or Mechanical failure (MEF)', 'the house category does not separate the motor from its drive'],
    CT: ['Instrument failure (INF)', 'control failure, no signal, faulty signal, out of adjustment'],
    MC: ['Material failure (MAF)', 'wear, breakage, fatigue'],
    ST: ['Mechanical failure (MEF)', 'looseness, deformation, vibration'],
    HY: ['Mechanical failure (MEF)', 'leakage, sticking, clearance'],
    PR: ['External influence (EXI)', 'blockage, contamination, out-of-specification process condition'],
    OP: ['Miscellaneous (MIS)', 'operator-induced; ISO 14224 carries this as a failure cause, not a mechanism'],
    CS: ['Not a failure', 'consumable or scheduled service - ISO 14224 would record this as a maintenance activity, not a failure event']
  };

  // The three access classes. They decide whether a check needs a JSA, and they
  // cannot be read off a narrative without inferring — so they print as boxes
  // to tick at the machine, never as a value.
  const ACCESS_CLASSES = [
    'non-intrusive (observe, read a gauge, listen)',
    'requires isolation',
    'requires entry, breaking containment, or hot work'
  ];

  const TIERS = {
    tech: {
      name: 'Service history',
      short: 'Service history',
      scope: 'Covers every service report on record for this machine, grouped the way TM Master recorded them — the reason for the job and the condition it was left in. Does NOT read the reports for a pattern, and does not say what is wrong or whether to call an engineer.'
    },
    1: {
      name: 'Tier 1 — The record',
      short: 'The record',
      scope: 'Covers what the vessel has written down about this equipment: the authored ' +
             'failure-history summary where one exists, and the completed-work record ' +
             'where it does not. Does NOT rank anything and does not cover what is wrong now.'
    },
    2: {
      name: 'Tier 2 — Historic frequency',
      short: 'This unit',
      scope: 'Covers what has been recorded against this equipment before, ranked by how ' +
             'often it was recorded. Does NOT cover what is wrong now, and does not reach ' +
             'the machines beside it.'
    },
    3: {
      name: 'Tier 3 — Lateral comparison',
      short: 'Machines beside it',
      scope: 'Covers which machines are comparable by the register\'s arithmetic, and what ' +
             'is on record against each. Does NOT judge whether a precedent is the same ' +
             'fault, and does not determine the present fault — that reading is the ' +
             'engineer\'s, or the Maintenance seat\'s in the Roundtable.'
    }
  };

  const UNAVAILABLE = 'not stated in the record';

  // Capped at seven — the spec's number, and the number a person holds in their
  // head. The ones past it are NAMED, because a silent truncation of a
  // frequency ranking is how a rare-and-severe mode disappears.
  const MAX_CANDIDATES = 7;

  // ── Codes and titles ────────────────────────────────────────────────────────

  const CODE_RE = /^\d[\d.]*$/;

  // `492.038.099.115.01` and `492.038.99.115.01` are one machine. The
  // zero-padding trap, carried through every skill that reads this register.
  function normCode(code) {
    return String(code == null ? '' : code).trim().split('.')
      .map(s => (/^\d+$/.test(s) ? String(parseInt(s, 10)) : s)).join('.');
  }

  function compareCodes(a, b) {
    const pa = String(a).split('.'), pb = String(b).split('.');
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
      if (pa[i] == null) return -1;
      if (pb[i] == null) return 1;
      const na = parseInt(pa[i], 10), nb = parseInt(pb[i], 10);
      if (!isNaN(na) && !isNaN(nb) && na !== nb) return na - nb;
      if (pa[i] !== pb[i]) return pa[i] < pb[i] ? -1 : 1;
    }
    return 0;
  }

  function parentCode(code) {
    const s = String(code || '');
    const i = s.lastIndexOf('.');
    return i > 0 ? s.slice(0, i) : '';
  }

  function fold(s) {
    return String(s == null ? '' : s).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  }

  // A unit number inside a title — `No.2`, `No 2`, `#2`, `Nos. 1-5`.
  const UNIT_NUM = /\b(?:no\.?s?\.?\s*|#)\s*\d+(?:\s*-\s*\d+)?/gi;
  const UNIT_HASH = /#\s*\d+(?:\s*-\s*\d+)?/g;
  // Where it sits. CLOSED AND ENUMERATED — escalation.py POSITION, word for
  // word: add a word only when it is a POSITION, never a FUNCTION. `emergency`
  // and `standby` distinguish duty, and two pumps that differ by those are not
  // interchangeable evidence about each other.
  const POSITION = /\b(?:fwd|forward|fore|mid|midship|midships|amidships|aft|after|afterward|afterwards|stern|bow|port|stbd|starboard|upper|lower|inboard|outboard|left|right)\b/gi;

  // A title with its unit number and its position taken out — the class. A
  // title that reduces to nothing returns "", and "" never matches "".
  function classOf(title) {
    const t = fold(title).replace(UNIT_NUM, '').replace(UNIT_HASH, '').replace(POSITION, '');
    return t.replace(/\s+/g, ' ').replace(/^[\s\-,]+|[\s\-,]+$/g, '');
  }

  // Emphasis, code spans and wikilinks off a line, so a field reads as prose.
  function plain(s) {
    return String(s == null ? '' : s)
      .replace(/`([^`]*)`/g, '$1')
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/\*(.*?)\*/g, '$1')
      .replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, '$1')
      .replace(/\s+/g, ' ').trim();
  }

  // ── The failure-history corpus ──────────────────────────────────────────────

  // `Failure History — 331.001 Forward Crane`. A stem that does not match is
  // skipped rather than guessed at.
  const NOTE_STEM = /^Failure History\s+—\s+(\d[\d.]*|\(no code\))\s+(.*)$/;
  // `### 1. Receiver losing power — the slip ring terminal — 1 job, 2021-06-08`
  const MODE_RE = /^###\s+(\d+)\.\s+(.*?)\s+—\s*(\d+)\s+jobs?(?:,\s*(.*?))?\s*$/;
  // `*Category: **EL** — Electrical supply / cabling.*`
  const CATEGORY_RE = /^\*Category:\s*\*\*([A-Z]{2})\*\*\s*—\s*(.*?)\.?\*\s*$/m;

  function frontmatter(text) {
    const m = /^---\n([\s\S]*?)\n---/.exec(text);
    const out = {};
    if (!m) return out;
    let listKey = null;
    for (const line of m[1].split('\n')) {
      const item = /^\s+-\s+"?(.*?)"?\s*$/.exec(line);
      if (item && listKey) { out[listKey].push(item[1]); continue; }
      const kv = /^([\w-]+):\s*(.*)$/.exec(line);
      if (!kv) continue;
      const v = kv[2].trim();
      if (v === '') { out[kv[1]] = []; listKey = kv[1]; }
      else { out[kv[1]] = v.replace(/^"(.*)"$/, '$1'); listKey = null; }
    }
    return out;
  }

  // One `**Symptom.** …` field. The corpus writes a field two ways and both
  // have to work: inline, and — for the standing note always — a bare label
  // whose content is the blockquote under it. Reading only the first shape
  // returns "" for every standing note, silently.
  function modeField(lines, name) {
    const want = '**' + name + '.**';
    const out = [];
    let started = false;
    for (const line of lines) {
      const t = line.trim();
      if (!started) {
        if (t.startsWith(want)) {
          started = true;
          const rest = t.slice(want.length).trim();
          if (rest) out.push(rest);
        }
        continue;
      }
      if (t.startsWith('**') || t.startsWith('###') || t.startsWith('*Category')) break;
      if (!t) { if (out.length) break; continue; }
      out.push(t.replace(/^>\s?/, '').trim());
    }
    return out.filter(Boolean).join(' ').trim();
  }

  function makeMode(head, body) {
    const cat = CATEGORY_RE.exec(body.join('\n'));
    const dates = (head[4] || '').trim();
    const found = dates.match(/\d{4}-\d{2}-\d{2}/g) || [];
    const mode = {
      index: parseInt(head[1], 10),
      title: head[2].trim(),
      jobs: parseInt(head[3], 10),
      dates,
      lastDate: found.length ? found.slice().sort().pop() : '',
      category: cat ? cat[1] : '',
      categoryName: cat ? cat[2] : '',
      symptomRaw: modeField(body, 'Symptom'),
      cause: modeField(body, 'Cause'),
      fix: modeField(body, 'Fix'),
      standing: modeField(body, 'Standing note'),
      records: modeField(body, 'Records')
    };
    mode.symptom = symptomOf(mode);
    return mode;
  }

  // The symptom, or the title where the row is not a failure. Placeholder rows
  // (`—`, "Routine…", "Not a failure…") fall back — a closed test, so you can
  // predict which rows do by reading it.
  function symptomOf(mode) {
    const s = plain(mode.symptomRaw);
    if (!/[a-z]/i.test(s)) return plain(mode.title);
    if (/^(routine|not a failure)\b/i.test(s)) return plain(mode.title);
    return s;
  }

  // The list items under `## <heading>`, as plain lines.
  function listSection(lines, heading) {
    const out = [];
    let inside = false;
    for (const line of lines) {
      if (line.startsWith('## ')) { inside = line.trim().toLowerCase() === ('## ' + heading).toLowerCase(); continue; }
      if (!inside) continue;
      const t = line.trim();
      const m = /^(?:\d+\.|[-*])\s+(.*)$/.exec(t);
      if (m) out.push(plain(m[1]));
      else if (t && out.length) out[out.length - 1] = (out[out.length - 1] + ' ' + plain(t)).trim();
    }
    return out;
  }

  // The prose paragraphs under `## <heading>`.
  function proseSection(lines, heading) {
    const paras = [];
    let inside = false, cur = [];
    const flush = () => { if (cur.length) paras.push(cur.join(' ')); cur = []; };
    for (const line of lines) {
      if (line.startsWith('## ')) { if (inside) break; inside = line.trim().toLowerCase() === ('## ' + heading).toLowerCase(); continue; }
      if (!inside) continue;
      const t = line.trim();
      if (!t) { flush(); continue; }
      cur.push(t);
    }
    flush();
    return paras;
  }

  // A `> [!warning] …` callout as { title, body } — the thin-evidence caveat,
  // which rides wherever the note is quoted.
  function callout(lines, kind) {
    let title = '';
    const body = [];
    for (const line of lines) {
      if (title) {
        if (!line.startsWith('>')) break;
        body.push(line.replace(/^>\s?/, '').trim());
      } else if (line.trim().startsWith('> [!' + kind + ']')) {
        title = line.split(']').slice(1).join(']').trim() || kind;
      }
    }
    return title ? { title: plain(title), body: plain(body.filter(Boolean).join(' ')) } : null;
  }

  // One authored failure-history note. `rel` is its path under the corpus root
  // (the group folder is the first segment). Returns null for anything that is
  // not a note — the generated index, a stray file.
  function parseFailureNote(textIn, rel) {
    const text = String(textIn || '').replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
    const relPath = String(rel || '').replace(/\\/g, '/');
    const file = relPath.split('/').pop().replace(/\.md$/i, '');
    const stem = NOTE_STEM.exec(file);
    const fm = frontmatter(text);
    if (fm.type && fm.type !== 'failure-history') return null;
    if (!stem && fm.type !== 'failure-history') return null;

    const lines = text.split('\n');
    const modes = [];
    let head = null, cur = [], inside = false;
    for (const line of lines) {
      if (line.startsWith('## ')) {
        if (head) { modes.push(makeMode(head, cur)); head = null; cur = []; }
        inside = line.trim() === '## Failure modes';
        continue;
      }
      if (!inside) continue;
      const m = MODE_RE.exec(line);
      if (m) { if (head) modes.push(makeMode(head, cur)); head = m; cur = []; }
      else if (head) cur.push(line);
    }
    if (head) modes.push(makeMode(head, cur));

    const code = String(fm.code || (stem ? stem[1] : '')).trim();
    const covers = Array.isArray(fm.covers) && fm.covers.length ? fm.covers.map(String) : (code ? [code] : []);
    return {
      code: code === '(no code)' ? '' : code,
      name: (stem ? stem[2] : file).trim(),
      title: fm.title || file,
      covers: covers.filter(c => CODE_RE.test(c)),
      jobsRead: parseInt(fm.jobs_read, 10) || 0,
      synced: fm.synced_through || '',
      lastSync: fm.last_sync || '',
      group: relPath.includes('/') ? relPath.split('/')[0] : '',
      rel: relPath,
      whatThis: proseSection(lines, 'What this is').map(plain),
      modes,
      firstMoves: listSection(lines, 'First moves'),
      openItems: listSection(lines, 'Open items'),
      thin: callout(lines, 'warning')
    };
  }

  // ── The index over the corpus ───────────────────────────────────────────────

  // A code wins outright, including through `covers:` — the join the corpus is
  // built on, where one note answers to several generations of a conveyor.
  function indexNotes(notes) {
    const byNorm = new Map();      // normalised code -> [note]
    const under = new Set();       // every normalised ancestor of a covered code
    for (const n of notes) {
      const codes = new Set([n.code, ...n.covers].filter(Boolean).map(normCode));
      for (const c of codes) {
        if (!byNorm.has(c)) byNorm.set(c, []);
        if (!byNorm.get(c).includes(n)) byNorm.get(c).push(n);
        let p = parentCode(c);
        while (p) { under.add(p); p = parentCode(p); }
      }
    }
    return { notes, byNorm, under };
  }

  function hasNote(ix, code) { return ix.byNorm.has(normCode(code)); }
  function hasNoteBeneath(ix, code) { return ix.under.has(normCode(code)); }

  // The note that answers for `code`, and how it was reached:
  //   exact   — the note's own code
  //   covers  — named in another note's `covers:`
  //   parent  — no note at the leaf; the nearest ancestor's note (history-lookup
  //             step 2.3: a note at .115 answers a question about .115.02)
  // Several notes on one code are listed, never picked (`others`).
  function resolve(ix, code) {
    const n = normCode(code);
    const hits = ix.byNorm.get(n) || [];
    if (hits.length) {
      const own = hits.find(h => normCode(h.code) === n);
      const note = own || hits[0];
      return { note, via: own ? 'exact' : 'covers', others: hits.filter(h => h !== note) };
    }
    let p = parentCode(n);
    while (p) {
      const up = ix.byNorm.get(p) || [];
      if (up.length) {
        const note = up.find(h => normCode(h.code) === p) || up[0];
        return { note, via: 'parent', viaCode: p, others: up.filter(h => h !== note) };
      }
      p = parentCode(p);
    }
    return { note: null, via: 'none', others: [] };
  }

  // Notes filed beneath a group code — `,failure 331` lists these.
  function notesBeneath(ix, code) {
    const n = normCode(code);
    return ix.notes
      .filter(x => x.code && normCode(x.code) !== n && normCode(x.code).startsWith(n + '.'))
      .sort((a, b) => compareCodes(a.code, b.code));
  }

  // Every code the record should be searched under for this machine: its own,
  // and everything its note covers — both padding forms fall out of normCode.
  function codesSearched(code, res) {
    const out = [code];
    if (res && res.note && res.via !== 'parent') for (const c of res.note.covers) out.push(c);
    const seen = new Set();
    return out.filter(c => { const k = normCode(c); if (!k || seen.has(k)) return false; seen.add(k); return true; });
  }

  // ── Tier 2: the note's modes as ranked candidates ───────────────────────────

  // CS is a scheduled service, and ISO 14224 would not record it as a failure
  // event. It still prints — dropping a row from a corpus the reader can open
  // is how a report loses their trust — but it ranks below every real mode.
  function isFailure(mode) { return mode.category !== 'CS'; }

  function candidate(mode) {
    const iso = ISO_14224[mode.category] || ['Not mapped', 'no house category on this mode'];
    let basis = mode.jobs + ' job' + (mode.jobs === 1 ? '' : 's');
    if (mode.dates) basis += ', ' + mode.dates;
    return {
      index: mode.index,
      name: plain(mode.title),
      category: mode.category,
      failureMode: mode.category ? mode.category + ' — ' + mode.categoryName : UNAVAILABLE,
      iso: iso[0] + ' (' + iso[1] + ')',
      basis,
      symptom: mode.symptom,
      cause: plain(mode.cause),
      fix: plain(mode.fix),
      standing: plain(mode.standing),
      records: plain(mode.records),
      // Deliberately empty. The corpus writes no per-mode discriminator or
      // rule-out, and deriving one from narrative is a reading.
      discriminator: '',
      rulesOut: '',
      jobs: mode.jobs,
      lastDate: mode.lastDate,
      failure: isFailure(mode)
    };
  }

  // Real failures first, then most-recorded, then most-recent.
  function rankCandidates(note) {
    if (!note) return [];
    return note.modes.map(candidate).sort((a, b) =>
      (a.failure === b.failure ? 0 : a.failure ? -1 : 1) ||
      (b.jobs - a.jobs) ||
      String(b.lastDate).localeCompare(String(a.lastDate)) ||
      (a.index - b.index));
  }

  // ── Criticality — three states, and the third is said as loudly ─────────────

  // TM Master's own `critical` flag, captured into asset_tm_spec. The room has
  // no register and says "not registered"; here the third state is "not
  // captured", and it is stated rather than left blank, because a report that
  // prints nothing where the flag goes looks like one that checked.
  function criticality(tm) {
    if (!tm || tm.critical == null) {
      return { state: 'unregistered', detail: 'TM Master\'s critical flag has not been captured for this component' };
    }
    if (tm.critical) {
      return { state: 'yes', detail: 'flagged critical in TM Master' + (tm.criticalLevel ? ' (' + tm.criticalLevel + ')' : '') };
    }
    return { state: 'no', detail: 'not flagged critical in TM Master' };
  }

  // ── Coverage and currency ───────────────────────────────────────────────────

  // What was searched, over what range, and what was left out. An engineer
  // must be able to tell "no history" from "no history recorded", and that is
  // a count and a date range, not a sentence. `mirror` is the list of mirror
  // notes read for `codes`: { code, jobCount, firstJob, lastJob }.
  function coverage(note, codes, mirror) {
    const out = {
      corpus: note ? 'authored failure history (a reading of the completed-work record)'
                   : 'the job-history mirror (the completed-work record, unread)',
      records: note ? note.jobsRead : null,
      syncedThrough: note ? note.synced : '',
      codes: codes.slice(),
      mirrorJobs: null,
      range: '',
      excluded: []
    };
    const hit = (mirror || []).filter(m => m && m.jobCount != null);
    if (!hit.length) {
      if (note) out.excluded.push('no job-history mirror note carries ' + codes.join(', ') +
        ' — the summary exists but the record it was written from is not reachable from here, so its count is unverified');
      return out;
    }
    let jobs = 0, first = '', last = '';
    for (const m of hit) {
      jobs += m.jobCount || 0;
      if (m.firstJob && (!first || m.firstJob < first)) first = m.firstJob;
      if (m.lastJob && (!last || m.lastJob > last)) last = m.lastJob;
    }
    out.mirrorJobs = jobs;
    out.range = first && last ? first + ' to ' + last : '';
    if (note && jobs > note.jobsRead) {
      out.excluded.push('the mirror holds ' + jobs + ' job rows against these codes and the note was written from ' +
        note.jobsRead + ' — the note is behind the record, not wrong. Ask Maintenance to run history-sync before relying on the ranking');
    }
    if (note && jobs && jobs < note.jobsRead) {
      out.excluded.push('the note reports ' + note.jobsRead + ' jobs read and the mirror now holds ' + jobs +
        ' against these codes — a code has been renumbered or merged, and some of what the note read is filed elsewhere');
    }
    return out;
  }

  // Jobs in the record newer than the note's `synced_through` — reported as raw
  // record, kept apart from the summary, never folded into it.
  function jobsSinceSync(note, jobs) {
    if (!note || !note.synced) return [];
    return (jobs || []).filter(j => j.date && j.date > note.synced);
  }

  // ── Tier 3: the two axes ────────────────────────────────────────────────────

  // Register rows: { code, name, parent?, maker?, makers_type? }. THE AXES ARE
  // NEVER MERGED — parallel numbering is a strong analogy, type and class a
  // weaker one that reaches further, and adding their counts together produces
  // a number that means nothing. Parentage is code arithmetic, as the room's.
  function population(rows, code) {
    const byNorm = new Map(rows.map(r => [normCode(r.code), r]));
    const me = byNorm.get(normCode(code)) || null;
    const title = me ? me.name : '';
    const maker = me ? String(me.maker || '').trim() : '';
    const model = me ? String(me.makers_type || '').trim() : '';
    const myClass = classOf(title);
    const myNorm = normCode(code);
    const out = {
      me: me ? { code: me.code, name: me.name, maker, model } : null,
      inRegister: !!me,
      topLevel: !String(code).includes('.'),
      parent: null,
      siblings: [],
      other: [],
      sameTitle: [],
      sameModel: [],
      sameMakerCount: null,
      sameGroupCount: 0,
      group: String(code).split('.')[0],
      classOf: myClass
    };

    if (!out.topLevel) {
      const p = parentCode(code);
      const pr = byNorm.get(normCode(p));
      out.parent = { code: pr ? pr.code : p, name: pr ? pr.name : '' };
      const depth = String(code).split('.').length;
      for (const r of rows) {
        const n = normCode(r.code);
        if (n === myNorm || !n.startsWith(normCode(p) + '.')) continue;
        if (String(r.code).split('.').length !== depth) continue;
        const same = !!myClass && classOf(r.name) === myClass;
        const e = unit(r, maker, model);
        (same ? out.siblings : out.other).push(e);
      }
    }

    for (const r of rows) {
      if (normCode(r.code) === myNorm) continue;
      if (myClass && classOf(r.name) === myClass) out.sameTitle.push(Object.assign(unit(r, maker, model), {
        sibling: out.siblings.some(s => s.code === r.code)
      }));
      if (maker && model && String(r.maker || '').trim() === maker && String(r.makers_type || '').trim() === model) {
        out.sameModel.push(unit(r, maker, model));
      }
    }
    if (maker) out.sameMakerCount = rows.filter(r => normCode(r.code) !== myNorm && String(r.maker || '').trim() === maker).length + 1;
    out.sameGroupCount = rows.filter(r => normCode(r.code) !== myNorm && String(r.code).split('.')[0] === out.group).length + 1;

    for (const k of ['siblings', 'other', 'sameTitle', 'sameModel']) out[k].sort((a, b) => compareCodes(a.code, b.code));
    return out;
  }

  function unit(r, maker, model) {
    const flags = [];
    const rm = String(r.maker || '').trim(), rt = String(r.makers_type || '').trim();
    if (maker && rm && rm !== maker) flags.push('different maker: ' + rm);
    if (model && rt && rt !== model) flags.push('different model: ' + rt);
    return { code: r.code, name: r.name, maker: rm, model: rt, flags };
  }

  // The note a unit's OWN record is summarised in — through `covers:`, never
  // a parent's, which speaks of other units.
  function ownNote(ix, code) {
    const r = resolve(ix, code);
    return r.note && r.via !== 'parent' ? r.note : null;
  }

  // Each note's recorded modes by house category, and how many of the
  // population's notes carry each. A COUNT, NOT A FINDING: three of four
  // siblings with an EL mode is worth reading across, and whether it is one
  // shared cause is the reading this screen does not make.
  //
  // ONE NOTE IS ONE ROW, however many units it covers. The five 491.050.03
  // freezers share a single note, and drawn a row per unit the grid read "5/5
  // units" in every column — one reading counted five times, which is the look
  // of common cause with none of the evidence. A unit with no note of its own
  // is a row of its own, empty.
  function categoryGrid(ix, units) {
    const cols = CATEGORIES.map(c => c.code);
    const rows = [];
    const byNote = new Map();
    for (const u of units) {
      const own = ownNote(ix, u.code);
      if (own && byNote.has(own)) { byNote.get(own).units.push(u); if (u.self) byNote.get(own).self = true; continue; }
      const cells = {};
      for (const c of cols) cells[c] = 0;
      if (own) for (const m of own.modes) if (cells[m.category] != null) cells[m.category] += m.jobs;
      const row = { code: u.code, name: u.name, self: !!u.self, note: own, cells, units: [u] };
      rows.push(row);
      if (own) byNote.set(own, row);
    }
    const withNote = rows.filter(r => r.note).reduce((n, r) => n + r.units.length, 0);
    const totals = {};
    for (const c of cols) totals[c] = rows.filter(r => r.cells[c] > 0).length;
    return { cols, rows, withNote, units: units.length, notes: byNote.size, totals };
  }

  // ── Sweep: a literal search of the record ───────────────────────────────────

  // The record does not use your vocabulary, so the sweep takes the crew's:
  // comma-separated phrases, ANY of which matches (`won't start, tripped, no
  // power`). Literal and case-folded — a phrase is found or it is not, and the
  // screen shows the words that matched. It never widens a phrase itself.
  function sweepTerms(query) {
    return String(query || '').split(/[,;\n]/).map(s => fold(s).replace(/\s+/g, ' ').trim()).filter(s => s.length >= 2);
  }

  function sweep(jobs, query) {
    const terms = sweepTerms(query);
    if (!terms.length) return { terms, hits: [] };
    const hits = [];
    for (const j of jobs || []) {
      const hay = fold([j.title, j.remark, j.serviceReport, j.symptom].filter(Boolean).join('\n')).replace(/\s+/g, ' ');
      const matched = terms.filter(t => hay.includes(t));
      if (!matched.length) continue;
      hits.push(Object.assign({}, j, { matched, excerpt: excerpt(j, matched[0]) }));
    }
    hits.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
    return { terms, hits };
  }

  // The sentence around the first match, so a hit can be read without opening
  // the job. Whole words, and an ellipsis where it was cut.
  function excerpt(job, term) {
    const src = [job.serviceReport, job.remark, job.title].filter(Boolean).join(' ').replace(/\s+/g, ' ');
    const at = fold(src).indexOf(term);
    if (at < 0) return src.slice(0, 220);
    let a = Math.max(0, at - 110), b = Math.min(src.length, at + term.length + 110);
    while (a > 0 && src[a - 1] !== ' ') a--;
    while (b < src.length && src[b] !== ' ') b++;
    return (a > 0 ? '… ' : '') + src.slice(a, b).trim() + (b < src.length ? ' …' : '');
  }

  // ── The technician's service history ────────────────────────────────────────
  //
  // Every report on record, grouped the way TM Master recorded it — its Reason
  // and its condition after the job — with no inference. docs/failure-history-
  // upkeep.md §4. The two reason lists are closed and printed, so anyone can
  // see which is which; a reason on neither list is shown under its own name.

  const UNPLANNED = ['Break down', 'Operational problems', 'Leakage', 'Unplaned/Corrective'];
  const PLANNED   = ['Planned/Preventive Maintenence', 'Planned', 'Cond. based/Predictive Maintenance', 'Intelligent Maintenance', 'Overhaul'];
  const NO_REASON = 'No reason recorded';

  function reasonGroup(reason) {
    const r = String(reason || '').trim();
    if (!r) return 'Not recorded';
    if (UNPLANNED.some(x => x.toLowerCase() === r.toLowerCase())) return 'Unplanned';
    if (PLANNED.some(x => x.toLowerCase() === r.toLowerCase())) return 'Planned';
    return 'Other';
  }

  // TM's condition after the job. A closed list; anything else is "not recorded".
  const OUTCOMES = ['restored', 'not restored', 'temporarily repaired', 'pending', 'not recorded'];
  function outcomeOf(condition) {
    const after = String(condition || '').split('→').pop().trim().toLowerCase();
    if (!after || after === '—' || after === '-') return 'not recorded';
    if (after === 'good' || after === 'acceptable') return 'restored';
    if (/^temporar/.test(after)) return 'temporarily repaired';
    if (after === 'pending') return 'pending';
    if (['operational with defects', 'non operational', 'broken', 'not acceptable', 'bad'].includes(after)) return 'not restored';
    return 'not recorded';
  }

  // opts: { now, note (the machine's own card, or null), critical }
  function serviceHistory(jobsIn, opts) {
    opts = opts || {};
    const now = opts.now ? new Date(opts.now) : new Date();
    const yearAgo = new Date(now.getTime() - 365 * 864e5).toISOString().slice(0, 10);
    const seen = new Set();
    const jobs = [];
    for (const j of jobsIn || []) {
      const k = j.historyNo ? 'H:' + j.historyNo : normCode(j.code) + '|' + j.date + '|' + fold(j.title).replace(/[^a-z0-9]+/g, ' ').trim();
      if (seen.has(k)) continue;
      seen.add(k);
      const after = String(j.condition || '').split('→').pop().trim();
      jobs.push(Object.assign({}, j, {
        reasonText: String(j.reason || '').trim() || NO_REASON,
        group: reasonGroup(j.reason),
        outcome: outcomeOf(j.condition),
        after: after && after !== '—' ? after : ''
      }));
    }
    jobs.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));

    const groups = ['Unplanned', 'Planned', 'Other', 'Not recorded'].map(g => {
      const inG = jobs.filter(j => j.group === g);
      const reasons = new Map();
      for (const j of inG) {
        const r = reasons.get(j.reasonText) || { reason: j.reasonText, count: 0, last: '' };
        r.count++;
        if ((j.date || '') > r.last) r.last = j.date || '';
        reasons.set(j.reasonText, r);
      }
      return { group: g, count: inG.length, reasons: [...reasons.values()].sort((a, b) => b.count - a.count) };
    }).filter(g => g.count);

    const outcomes = {};
    for (const o of OUTCOMES) outcomes[o] = jobs.filter(j => j.outcome === o).length;

    // Facts that make an engineer worth calling — each only when true, and
    // never a verdict. `checked` lists every test, so "none of these" says what
    // was looked at rather than reading as a clearance.
    const signals = [];
    const last = jobs[0];
    if (last && (last.outcome === 'not restored' || last.outcome === 'temporarily repaired')) {
      signals.push({ kind: 'last', text: `The last report (${last.date}, “${last.title}”) left it ${last.after || last.outcome}.` });
    }
    const recent = jobs.filter(j => j.date && j.date >= yearAgo);
    const unplannedRecent = recent.filter(j => j.group === 'Unplanned');
    if (unplannedRecent.length >= 2) signals.push({ kind: 'unplanned', text: `${unplannedRecent.length} unplanned reports in the last 12 months.` });
    const titles = new Map();
    for (const j of recent) { const t = fold(j.title).replace(/[^a-z0-9]+/g, ' ').trim(); if (t) titles.set(t, (titles.get(t) || []).concat(j)); }
    for (const [, list] of titles) if (list.length >= 2) signals.push({ kind: 'repeat', text: `“${list[0].title}” ${list.length} times in the last 12 months.` });
    if (opts.critical && opts.critical.state === 'yes') signals.push({ kind: 'critical', text: 'TM Master flags it critical.' });
    if (opts.note) {
      const oi = opts.note.openItems.length;
      signals.push({ kind: 'card', text: `An engineer has written a failure history for it — ${opts.note.modes.length} failure mode${opts.note.modes.length === 1 ? '' : 's'}` +
        (oi ? `, ${oi} open item${oi === 1 ? '' : 's'}` : '') + ' (Tier 1).' });
    }
    const checked = [
      'the last report left it not restored or temporarily repaired',
      'two or more unplanned reports in the last 12 months',
      'the same job title more than once in the last 12 months',
      'TM Master flags it critical',
      'an engineer has written a failure history for it'
    ];

    return {
      count: jobs.length,
      first: jobs.length ? jobs[jobs.length - 1].date : '',
      last: jobs.length ? jobs[0].date : '',
      groups, outcomes, signals, checked, jobs
    };
  }

  // ── Search, for the autocomplete ────────────────────────────────────────────

  // The Components browser's ranking, so the two boxes agree: code exact, code
  // prefix, name prefix, code contains, name contains. Every word must match
  // somewhere, which lets `mid crane` find the Midship Crane.
  function searchUnits(units, term, limit) {
    const q = fold(term).trim();
    if (!q) return [];
    const words = q.split(/\s+/);
    const qn = normCode(q);
    const out = [];
    for (const u of units) {
      const code = fold(u.code), name = fold(u.name);
      let rank = -1;
      if (code === q || (CODE_RE.test(q) && normCode(code) === qn)) rank = 0;
      else if (code.startsWith(q) || (CODE_RE.test(q) && normCode(code).startsWith(qn))) rank = 1;
      else if (name.startsWith(q)) rank = 2;
      else if (code.includes(q)) rank = 3;
      else if (name.includes(q)) rank = 4;
      else if (words.length > 1 && words.every(w => name.includes(w) || code.includes(w))) rank = 5;
      if (rank >= 0) out.push({ u, rank });
    }
    out.sort((a, b) => a.rank - b.rank || compareCodes(a.u.code, b.u.code));
    return out.slice(0, limit || 40).map(h => h.u);
  }

  const api = {
    CATEGORIES, ISO_14224, ACCESS_CLASSES, TIERS, UNAVAILABLE, MAX_CANDIDATES,
    normCode, compareCodes, parentCode, classOf, plain, fold,
    parseFailureNote, indexNotes, hasNote, hasNoteBeneath, resolve, notesBeneath, codesSearched,
    candidate, rankCandidates, criticality, coverage, jobsSinceSync,
    population, ownNote, categoryGrid, sweepTerms,
    UNPLANNED, PLANNED, OUTCOMES, reasonGroup, outcomeOf, serviceHistory, sweep, searchUnits
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.diagnosticsLadder = api;

})(typeof window !== 'undefined' ? window : globalThis);
