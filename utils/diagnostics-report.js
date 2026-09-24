'use strict';

// ── Navipedia → Diagnostics: the report ─────────────────────────────────────
//
// One document per request — Tier 1, Tier 2, Tier 3, or all three stacked —
// and it is the on-screen preview, the printed sheet and the saved PDF alike.
// docs/navipedia-diagnostics.md §4.
//
// The anatomy is the Roundtable escalation report's (escalation.py `blocks`),
// so a stack of reports from the room and from the Console reads as one kind
// of paper: tier and scope, criticality in the header in all three of its
// states, candidates with the gaps printed as gaps, the note's own first
// moves, the none-of-these path, a findings box and a signature, and the
// corpus coverage at the foot. The letterhead is the Report Generator's, read
// the way the card handouts read it.
//
// Pure: no DOM, no IPC. The screen hands it a model it has already assembled
// (navipedia-diagnostics.js `ndxModel`) and gets a complete HTML document back.
//
// ESCAPE FIRST. Every string here came off a share many people write to.

(function (root) {

  const L = root.diagnosticsLadder || (typeof require === 'function' ? require('./diagnostics-ladder.js') : null);

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // A code the reader can follow in the preview. On paper it is just the code.
  function xcode(code, label, ctx) {
    const text = esc(label == null ? code : label);
    if (!ctx.interactive || !code) return text;
    return `<a class="xref" data-code="${esc(code)}">${text}</a>`;
  }

  function fmtDate(d) {
    const x = d instanceof Date ? d : new Date(d || Date.now());
    if (isNaN(x)) return '';
    const m = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][x.getMonth()];
    return `${x.getDate()} ${m} ${x.getFullYear()}`;
  }

  function isoDay(d) {
    const x = d instanceof Date ? d : new Date(d || Date.now());
    const p = n => String(n).padStart(2, '0');
    return `${x.getFullYear()}-${p(x.getMonth() + 1)}-${p(x.getDate())}`;
  }

  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : (many || one + 's')); }

  // The phrases a sweep matched, marked where they fall in an excerpt. The
  // excerpt is escaped first; only then are the marks put in.
  function markTerms(text, terms) {
    let h = esc(text);
    for (const t of terms || []) {
      if (!t) continue;
      const re = new RegExp(esc(t).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
      h = h.replace(re, m => `<mark>${m}</mark>`);
    }
    return h;
  }

  function sec(title, inner, cls) {
    if (!inner) return '';
    return `<section class="sec${cls ? ' ' + cls : ''}">${title ? `<h2>${esc(title)}</h2>` : ''}${inner}</section>`;
  }
  function cite(text) { return `<p class="cite">${text}</p>`; }
  function ul(items) { return items && items.length ? `<ul>${items.map(i => `<li>${esc(i)}</li>`).join('')}</ul>` : ''; }
  function checks(items) {
    return items && items.length
      ? `<ol class="checks">${items.map(i => `<li><span class="box"></span><span>${esc(i)}</span></li>`).join('')}</ol>` : '';
  }

  // ── Letterhead, title, header facts ─────────────────────────────────────────

  function letterheadHtml(kind, opts) {
    const s = opts.setup || {};
    const at = { left: '', center: '', right: '' };
    const put = (align, html, fallback) => { at[['left', 'center', 'right'].includes(align) ? align : fallback] += html; };
    if (s.companyLogo) put(s.companyLogoAlign, `<img class="logo" src="${esc(s.companyLogo)}" alt="">`, 'left');
    if (s.vesselIcon)  put(s.vesselIconAlign,  `<img class="logo" src="${esc(s.vesselIcon)}" alt="">`, 'right');
    at.center += `<div class="lh-text">
        ${opts.vessel ? `<div class="lh-vessel">${esc(opts.vessel)}</div>` : ''}
        <div class="lh-kind">${esc(kind)}</div>
      </div>`;
    return `<header class="lh">
      <div class="lh-cell lh-left">${at.left}</div>
      <div class="lh-cell lh-center">${at.center}</div>
      <div class="lh-cell lh-right">${at.right}</div>
    </header>`;
  }

  // Criticality is advisory, stated, and never gates — and its third state is
  // printed as loudly as the other two.
  function critBanner(crit) {
    if (!crit) return '';
    if (crit.state === 'yes') return `<div class="banner banner-crit">CRITICAL EQUIPMENT — ${esc(crit.detail)}</div>`;
    if (crit.state === 'unregistered') {
      return `<div class="banner banner-unk">CRITICALITY NOT CAPTURED — ${esc(crit.detail)}. This report cannot tell you whether this equipment is critical.</div>`;
    }
    return '';
  }

  function headerHtml(m, ctx) {
    const title = m.title || m.code;
    const path = (m.ancestors || []).map(a => xcode(a.code, a.code, ctx) + ' ' + esc(a.name)).join(' › ');
    const rows = [
      ['Register code', esc(m.code) + (m.inRegister ? '' : ' <span class="dim">— not in the current register (renumbered, renamed or retired in TM Master)</span>')],
      path ? ['Filed under', path] : null,
      (m.maker || m.model) ? ['Maker · model', esc([m.maker, m.model].filter(Boolean).join(' · '))] : null,
      ['Reported symptom', m.symptom ? esc(m.symptom) : '<span class="dim">not entered</span>'],
      ['Engineer', m.engineer ? esc(m.engineer) : '<span class="dim">not recorded</span>'],
      ['Prepared', esc(fmtDate(m.preparedAt))]
    ].filter(Boolean);
    return `<div class="tb">
        <div class="tb-id">${esc(m.code)}</div>
        <div class="tb-title">${esc(title)}</div>
      </div>
      ${critBanner(m.critical)}
      <table class="facts">${rows.map(([k, v]) => `<tr><th>${esc(k)}</th><td>${v}</td></tr>`).join('')}</table>`;
  }

  function tierHead(n, first) {
    const t = L.TIERS[n];
    return `<div class="tier-head${first ? '' : ' tier-break'}">
        <div class="tier-name">${esc(t.name)}</div>
        <div class="tier-scope">${esc(t.scope)}</div>
      </div>`;
  }

  // ── Shared pieces ───────────────────────────────────────────────────────────

  function modesTable(note, ctx) {
    if (!note || !note.modes.length) return '';
    return `<table class="grid modes">
      <thead><tr><th class="c-n">#</th><th class="c-cat">Kind</th><th>Failure mode · symptom on record</th><th class="c-jobs">Jobs</th><th class="c-dates">When</th></tr></thead>
      <tbody>${note.modes.map(md => `<tr>
        <td class="c-n">${md.index}</td>
        <td class="c-cat">${md.category ? `<span class="cat cat-${esc(md.category)}" title="${esc(md.categoryName)}">${esc(md.category)}</span>` : '—'}</td>
        <td><b>${esc(L.plain(md.title))}</b>${md.symptom && md.symptom !== L.plain(md.title) ? `<div class="sub">${esc(md.symptom)}</div>` : ''}</td>
        <td class="c-jobs">${md.jobs}</td>
        <td class="c-dates">${esc(md.dates)}</td>
      </tr>`).join('')}</tbody></table>`;
  }

  function thinBox(note) {
    if (!note || !note.thin) return '';
    return `<div class="callout callout-warn"><div class="callout-title">${esc(note.thin.title)}</div>${note.thin.body ? `<p>${esc(note.thin.body)}</p>` : ''}</div>`;
  }

  function jobRows(jobs, ctx, opts) {
    opts = opts || {};
    if (!jobs || !jobs.length) return '';
    return `<div class="jobs">${jobs.map(j => {
      const head = [
        `<b>${esc(j.date || 'undated')}</b>`,
        opts.showCode ? xcode(j.code, j.code, ctx) + (j.unitName ? ' ' + esc(j.unitName) : '') : '',
        `<b>${esc(j.title || '(untitled job)')}</b>`
      ].filter(Boolean).join(' — ');
      const meta = [j.historyNo, j.signedBy ? 'signed ' + j.signedBy : '', j.reason, j.condition].filter(Boolean).map(esc).join(' · ');
      const text = opts.terms ? markTerms(j.excerpt || '', opts.terms)
        : esc(clip(j.serviceReport || j.remark || '', opts.clip || 900));
      return `<div class="job">
        <div class="job-head">${head}</div>
        ${meta ? `<div class="job-meta">${meta}${opts.terms && j.matched ? ` · matched <i>${j.matched.map(esc).join('</i>, <i>')}</i>` : ''}</div>` : ''}
        ${text ? `<div class="job-text">${text}</div>` : ''}
      </div>`;
    }).join('')}</div>`;
  }

  function clip(s, n) {
    s = String(s || '').replace(/\s+/g, ' ').trim();
    if (s.length <= n) return s;
    const cut = s.lastIndexOf(' ', n);
    return s.slice(0, cut > n * 0.6 ? cut : n) + ' …';
  }

  function coverageFoot(cov) {
    if (!cov) return '';
    const bits = [];
    if (cov.records != null) bits.push(plural(cov.records, 'record') + ' read into the summary');
    if (cov.mirrorJobs != null) bits.push(plural(cov.mirrorJobs, 'job row') + ' in the mirror');
    if (cov.range) bits.push('record range ' + cov.range);
    if (cov.syncedThrough) bits.push('synced through ' + cov.syncedThrough);
    if (cov.codes && cov.codes.length) bits.push('codes ' + cov.codes.join(', ') + ' (padding forms normalised)');
    const lines = [`Corpus coverage: ${esc(cov.corpus)} — ${esc(bits.join('; ') || 'nothing read')}.`];
    for (const x of cov.excluded || []) lines.push('Caveat: ' + esc(x));
    lines.push('Renumbered history (the 491.* and 493.* generations) is included only where a failure-history note\'s <code>covers:</code> lists it; the confirmed migration list is Roundtable\'s and is not read here.');
    return `<div class="coverage">${lines.map(l => `<p>${l}</p>`).join('')}</div>`;
  }

  function findingsHtml() {
    return sec('Findings at the machine',
      `<div class="findings"></div>
       <table class="sig"><tr><td>Carried out by</td><td class="gap"></td><td>Date</td></tr></table>`, 'keep');
  }

  // ── Tier 1 — the record ─────────────────────────────────────────────────────

  function tier1(m, ctx) {
    const out = [];
    const res = m.res || { via: 'none' };
    const note = res.note;

    if (res.via === 'parent' && note) {
      out.push(`<div class="banner banner-note">No failure-history note at ${esc(m.code)}. The nearest is the parent's —
        ${xcode(note.code, note.code, ctx)} ${esc(note.name)} — and it may speak of units other than this one.</div>`);
    }
    if (res.via === 'covers' && note) {
      out.push(cite(`This code is covered by ${xcode(note.code, note.code, ctx)} <b>${esc(note.name)}</b>, a note written across several codes because they fail the same way and the record reads as one story.`));
    }

    if (note) {
      out.push(sec('What is on record — the authored summary',
        cite('A <b>reading</b> of the completed-work record by the Maintenance seat: selective, cited, and it can be wrong. Recited here, not paraphrased — the person who wrote it was at the machine.') +
        (note.whatThis || []).map(p => `<p>${esc(p)}</p>`).join('') +
        thinBox(note) +
        modesTable(note, ctx)));
      if (note.firstMoves.length) {
        out.push(sec('First moves', cite('The note\'s own triage order — the fastest thing in it when the machine is down now.') + `<ol>${note.firstMoves.map(x => `<li>${esc(x)}</li>`).join('')}</ol>`));
      }
      if (note.openItems.length) out.push(sec('Open items', cite('Standing and unresolved. A temporary repair never made permanent is exactly what the next person needs to know.') + ul(note.openItems)));
      if (res.others && res.others.length) {
        out.push(sec('Also on this code', cite('More than one note answers for this code. Listed, not picked.') +
          `<ul>${res.others.map(o => `<li>${xcode(o.code, o.code, ctx)} ${esc(o.name)}</li>`).join('')}</ul>`));
      }

      // Currency, stated not assumed.
      const since = m.sinceSync || [];
      const last = m.coverage && m.coverage.range ? m.coverage.range.split(' to ')[1] : '';
      let cur = `<p>The summary is synced through <b>${esc(note.synced || 'an unrecorded date')}</b>` +
        (last ? `; the newest job in the record is <b>${esc(last)}</b>.` : '.') + '</p>';
      if (since.length) {
        cur += `<div class="banner banner-note">${plural(since.length, 'job')} since the summary was synced — the raw record, not folded into it. Nobody has drawn a conclusion from ${since.length === 1 ? 'it' : 'these'} yet.</div>` +
          jobRows(since, ctx, { clip: 700 });
      } else if (last && note.synced && last <= note.synced) {
        cur += cite('Nothing in the record is newer than the summary.');
      }
      out.push(sec('How current it is', cur));
    } else {
      const jobs = m.jobs || [];
      if (jobs.length) {
        const range = m.coverage && m.coverage.range ? `, ${esc(m.coverage.range)}` : '';
        out.push(sec('What is on record — the raw record',
          `<div class="banner banner-note">There is no failure-history summary for this one. Reading the raw record: ${plural(jobs.length, 'job')}${range}.</div>` +
          cite('This is the <b>unread record</b>, not a summary — every completed job in date order, as the crew wrote it at the time. Any pattern drawn from it is drawn live and on thin evidence; a note could be written (Roundtable <code>history-sync</code>).') +
          jobRows(jobs, ctx, { clip: 1200 })));
      } else {
        out.push(sec('What is on record',
          `<div class="banner banner-none">No recorded history.</div>` +
          `<p>Searched the failure-history summaries and the job-history mirror under ${esc((m.codes || [m.code]).join(', '))}, both padding forms. That is a real answer: this machine has never generated a service report — which is itself information.</p>`));
      }
    }

    if (m.beneath && m.beneath.length) {
      out.push(sec(`Notes filed under codes beginning ${m.code}`,
        cite('Failure-history notes whose code sits beneath this one. Filed by number, not by machine: a code the register has since renumbered can put another unit\'s history here, so read each title. Open one for its own record.') +
        `<table class="grid"><thead><tr><th>Code</th><th>Note</th><th class="c-jobs">Jobs read</th><th class="c-dates">Synced through</th></tr></thead><tbody>` +
        m.beneath.map(n => `<tr><td class="mono">${xcode(n.code, n.code, ctx)}</td><td>${esc(n.name)}<div class="sub">${n.modes.map(x => x.category).filter(Boolean).join(' · ')}</div></td><td class="c-jobs">${n.jobsRead}</td><td class="c-dates">${esc(n.synced)}</td></tr>`).join('') +
        `</tbody></table>`));
    }

    out.push(sec('What rides on every answer',
      ul(['A fix that worked is not a fix that is correct. Several repairs in this record are logged by their own authors as temporary.',
          'Absence of record is not absence of failure. Not everything gets written up.',
          'Where the OEM\'s guidance and the record disagree, both stand — the manual is the other half of the answer.']), 'quiet'));
    return out.join('\n');
  }

  // ── Tier 2 — historic frequency ─────────────────────────────────────────────

  function candidateHtml(c, i) {
    const row = (k, v, cls) => `<tr${cls ? ` class="${cls}"` : ''}><th>${esc(k)}</th><td>${v}</td></tr>`;
    const val = v => v ? esc(v) : `<span class="gap">${esc(L.UNAVAILABLE)}</span>`;
    return `<div class="cand">
      <div class="cand-head"><span class="cand-n">${i + 1}</span><span class="cand-name">${esc(c.name)}</span>
        ${c.category ? `<span class="cat cat-${esc(c.category)}">${esc(c.category)}</span>` : ''}
        ${c.failure ? '' : '<span class="notfail">not a failure — scheduled service</span>'}</div>
      <table class="kv">
        ${row('Failure mode', val(c.failureMode))}
        ${row('ISO 14224 (mapped)', esc(c.iso))}
        ${row('Basis', esc(c.basis))}
        ${row('Symptom on record', val(c.symptom))}
        ${row('Cause on record', val(c.cause))}
        ${row('Discriminator', val(c.discriminator), 'gaprow')}
        ${row('Rules it out', val(c.rulesOut), 'gaprow')}
        ${row('Common fix', val(c.fix))}
        ${c.standing ? row('Standing note', esc(c.standing), 'standing') : ''}
        ${c.records ? row('Records', `<span class="recs">${esc(c.records)}</span>`) : ''}
        ${row('Access', L.ACCESS_CLASSES.map(a => `<span class="acc"><span class="box"></span>${esc(a)}</span>`).join(''))}
      </table>
    </div>`;
  }

  function tier2(m, ctx) {
    const out = [];
    const res = m.res || { via: 'none' };
    const note = res.via === 'parent' ? null : res.note;

    if (!note) {
      out.push(`<div class="banner banner-none">No authored failure-history note covers ${esc(m.code)}.</div>`);
      out.push(`<p>That is not the same as no history. It means nobody has written the summary yet, and Tier 2 ranks only
        a summary that names this machine — the raw record${m.jobs && m.jobs.length ? ` (${plural(m.jobs.length, 'job')}, under Tier 1)` : ''}
        is not ranked, because ranking it would be drawing a pattern nobody has read for.
        ${res.via === 'parent' && res.note ? `The parent group's note, ${xcode(res.note.code, res.note.code, ctx)} ${esc(res.note.name)}, is recited under Tier 1.` : ''}</p>`);
      if (m.beneath && m.beneath.length) {
        out.push(`<p>This is a group. Its notes are listed under Tier 1 — Tier 2 is run on one of them.</p>`);
      }
      out.push(sec('None of these', `<p>Nothing on record here? Tier 3 reads the machines beside it.</p>`));
      return out.join('\n');
    }

    out.push(thinBox(note));

    const cands = m.candidates || [];
    if (cands.length) {
      const shown = cands.slice(0, L.MAX_CANDIDATES);
      out.push(sec('Candidates',
        cite('Ranked by how often each was recorded — real failures first, then most-recorded, then most-recent. <b>Frequency is frequency of recorded intervention, not likelihood of cause</b>: a rare and severe mode sinks below a common and trivial one, so read to the bottom.') +
        (m.symptom ? cite(`The reported symptom — “${esc(m.symptom)}” — is printed for the record and <b>does not rank anything</b>. Which candidate you have is decided at the machine, with a meter.`) : '') +
        shown.map(candidateHtml).join('') +
        (cands.length > shown.length
          ? `<div class="banner banner-note"><b>${cands.length - shown.length} further modes are on record and not printed above</b>, because the ranking is capped at ${L.MAX_CANDIDATES}. Named so the cap cannot hide one: ${esc(cands.slice(shown.length).map(c => c.name).join('; '))}.</div>` : '')));
      out.push(cite('<b>Discriminator</b> and <b>Rules it out</b> print as gaps on purpose: the record writes neither per mode, and deriving one from narrative is a reading. The gap is information — candidates with no discriminators are candidates the record cannot separate. <b>Access</b> is ticked at the machine: anything that needs isolation, entry, breaking containment or hot work needs a JSA; non-intrusive does not.'));
    } else {
      out.push(`<p>The note records no failure modes.</p>`);
    }

    if (note.firstMoves.length) {
      out.push(sec('First moves — the note\'s own',
        cite('Written by the author of the summary, not matched to the candidates above by this report. Where one of these separates two candidates, it is the discriminator the table could not state.') +
        checks(note.firstMoves)));
    }
    if (note.openItems.length) {
      out.push(sec('Open on this equipment', cite('Standing, unresolved, and carried by the note — read before assuming a behaviour is new.') + ul(note.openItems)));
    }
    out.push(sec('Ambiguity group',
      `<p>Not assessed at this tier. Naming the candidates no onboard measurement can separate is a reading of the precedents, not a recitation — it is Tier 3's work in the Roundtable.</p>`));
    out.push(sec('None of these',
      `<p>Nothing above fits what you are looking at? <b>That is a first-class answer and it costs one line.</b> A ranked list is an anchor, and an anchor gets worked top-down whether or not it fits. Tier 3 reads the machines beside this one. Nothing here blocks; the ladder is voluntary.</p>`));
    return out.join('\n');
  }

  // ── Tier 3 — lateral comparison, the mechanical half ────────────────────────

  function unitTable(units, ctx, opts) {
    opts = opts || {};
    if (!units.length) return '';
    return `<table class="grid"><thead><tr><th class="c-code">Code</th><th>Unit</th><th>On record</th></tr></thead><tbody>${
      units.map(u => {
        const rec = [];
        if (u.note) rec.push(`note: ${plural(u.note.modes.length, 'mode')} (${u.note.modes.map(x => x.category).filter(Boolean).join(' ')})` +
          (u.note.covers.length > 1 ? ` <span class="dim">— one note across ${u.note.covers.length} codes</span>` : ''));
        if (u.mirror) rec.push(`${plural(u.mirror.jobCount, 'job')}${u.mirror.lastJob ? ', last ' + u.mirror.lastJob : ''}`);
        if (!rec.length) rec.push('<span class="dim">nothing recorded</span>');
        return `<tr${u.self ? ' class="self"' : ''}><td class="mono">${xcode(u.code, u.code, ctx)}</td>
          <td>${esc(u.name)}${u.self ? ' <span class="dim">(this unit)</span>' : ''}${u.sibling ? ' <span class="dim">(also a sibling)</span>' : ''}${u.flags && u.flags.length ? `<div class="flag">[!] ${esc(u.flags.join('; '))}</div>` : ''}</td>
          <td>${rec.join('<br>')}</td></tr>`;
      }).join('')}</tbody></table>`;
  }

  function gridHtml(grid, ctx) {
    if (!grid || !grid.rows.length) return '';
    const cols = grid.cols;
    return `<table class="grid cats"><thead><tr><th>Unit</th>${cols.map(c => `<th class="c-cat" title="${esc((L.CATEGORIES.find(x => x.code === c) || {}).name || '')}">${c}</th>`).join('')}</tr></thead><tbody>${
      grid.rows.map(r => `<tr${r.self ? ' class="self"' : ''}><td>${r.units.map(u => `<span class="mono">${xcode(u.code, u.code, ctx)}</span>`).join(', ')} ${esc(r.name)}${
        r.note ? (r.units.length > 1 ? ` <span class="dim">— one note for ${r.units.length} units</span>` : '') : ' <span class="dim">— no note</span>'}</td>${
        cols.map(c => `<td class="c-cat">${r.cells[c] ? `<b>${r.cells[c]}</b>` : ''}</td>`).join('')}</tr>`).join('')
    }<tr class="tot"><td>Rows with a recorded mode of this kind</td>${cols.map(c => `<td class="c-cat">${grid.totals[c] ? `${grid.totals[c]}/${grid.rows.length}` : ''}</td>`).join('')}</tr>
    </tbody></table>`;
  }

  function precedentModes(rows, ctx) {
    const withNotes = rows.filter(r => r.note && !r.self);   // this unit's own note is Tiers 1 and 2
    if (!withNotes.length) return '';
    return withNotes.map(r => `<div class="prec">
        <div class="prec-head">${r.units.map(u => xcode(u.code, u.code, ctx)).join(', ')} ${esc(r.note.name)} <span class="dim">— synced through ${esc(r.note.synced || '?')}</span></div>
        <ul class="tight">${r.note.modes.map(md => `<li>${md.category ? `<span class="cat cat-${esc(md.category)}">${esc(md.category)}</span> ` : ''}<b>${esc(L.plain(md.title))}</b> — ${plural(md.jobs, 'job')}${md.dates ? ', ' + esc(md.dates) : ''}${md.symptom && md.symptom !== L.plain(md.title) ? `<div class="sub">${esc(md.symptom)}</div>` : ''}</li>`).join('')}</ul>
      </div>`).join('');
  }

  function tier3(m, ctx) {
    const out = [];
    const p = m.population;
    if (!p) return '<p>The register could not be read, so no population can be drawn.</p>';

    if (!m.inRegister) {
      out.push(`<div class="banner banner-note">${esc(m.code)} is not in the current register, so it has no maker or model on record, and its class is read off the name the record gives it. The populations below are drawn among the other codes the register no longer carries, by code arithmetic — and the unit numbers in old reports are not reliable (a 2020 report reads “PF#1 (Formally #3)”).</div>`);
    }

    // Axis 1
    let a1 = '';
    if (p.topLevel) {
      a1 = `<p>${esc(m.code)} is a top-level group. Parallel numbering is only meaningful below a parent.</p>`;
    } else {
      a1 += `<p>Parent ${xcode(p.parent.code, p.parent.code, ctx)} — ${esc(p.parent.name || 'not in the register')}.</p>`;
      a1 += `<p><b>Population: ${p.siblings.length + 1}</b> (${plural(p.siblings.length, 'sibling')} plus this unit). Strong analogy — same class, same install, same service, likely the same duty history.</p>`;
      if (p.siblings.length) {
        a1 += unitTable([m.selfUnit].concat(m.siblingUnits), ctx);
        a1 += cite('Three siblings out of four showing one mode means something very different from three out of forty. State the population, not just the hits.');
      } else {
        a1 += `<div class="banner banner-none">No identical sibling units.</div><p>This machine is a one-off under its parent, so axis 1 is empty. Said so rather than reaching quietly for axis 2 and presenting it as a sweep.</p>`;
      }
      if (m.otherUnits && m.otherUnits.length) {
        a1 += `<h3>Other components under ${esc(p.parent.code)} (${m.otherUnits.length})</h3>` +
          cite('Not siblings — but a fault on this unit may have been <i>filed</i> against a shared sub-assembly, and a sweep that skips them misses the record it was looking for.') +
          unitTable(m.otherUnits, ctx);
      }
    }
    out.push(sec('Axis 1 — parallel numbering', a1));

    if (m.grid && m.grid.units > 1) {
      out.push(sec('Recorded modes across axis 1, by kind',
        cite(`Jobs per house category on each failure-history note, one row per note (${m.grid.withNote} of ${m.grid.units} units are covered by ${plural(m.grid.notes, 'note')}). A note written across several units is <b>one</b> row: one reading counted once per unit is not several precedents. <b>A count, not a finding.</b> The same kind of failure on several siblings is worth reading across — whether it is one shared cause (a shared supply, controller, parts batch or commissioning error) is a reading this report does not make.`) +
        gridHtml(m.grid, ctx) +
        precedentModes(m.grid.rows, ctx)));
    }

    // Axis 2
    let a2 = '';
    if (p.sameTitle.length) {
      const outside = p.sameTitle.filter(u => !u.sibling).length;
      a2 += `<p><b>Same machine class by name — population: ${p.sameTitle.length + 1}.</b> The title with its unit number and position taken out (“${esc(p.classOf)}”), matched across the whole register. ${outside} of these sit outside the parent, so they are not on axis 1.</p>`;
      a2 += unitTable(m.sameTitleUnits, ctx);
      if (p.sameTitle.length > m.sameTitleUnits.length) a2 += `<p class="dim">…and ${p.sameTitle.length - m.sameTitleUnits.length} more.</p>`;
    }
    if (p.sameModel.length) {
      a2 += `<p><b>Same maker and model — population: ${p.sameModel.length + 1}.</b> A purchasing fact, and the one that makes a shared batch or a shared design defect plausible.</p>`;
      a2 += unitTable(m.sameModelUnits, ctx);
      if (p.sameModel.length > m.sameModelUnits.length) a2 += `<p class="dim">…and ${p.sameModel.length - m.sameModelUnits.length} more.</p>`;
    } else if (p.me && p.me.maker && p.me.model) {
      a2 += `<p><b>No other unit carries maker ${esc(p.me.maker)} and model ${esc(p.me.model)}.</b></p>`;
    } else {
      const missing = p.me ? ['maker', 'model'].filter(k => !p.me[k]).join(' and ') : 'maker and model';
      a2 += `<p><b>The maker-and-model test could not run</b> — this unit's register entry records no ${esc(missing)}. That is a gap in the register, not a finding about the machine.</p>`;
    }
    a2 += `<p>Wider counts, for scale only — <b>do not read either as a class</b>:</p>` +
      ul([`Same maker (${p.me && p.me.maker ? p.me.maker : 'not recorded'}): ${p.sameMakerCount != null ? p.sameMakerCount : 'test could not run'}`,
          `Same SFI group ${p.group}: ${p.sameGroupCount} — this is where the equipment is filed, not what it is`]);
    if (!p.sameTitle.length && !p.sameModel.length) {
      a2 += `<div class="banner banner-none">Axis 2 is empty by every mechanical test available here.</div>`;
    }
    out.push(sec('Axis 2 — type and class', a2));

    // Sweep
    const sw = m.sweep;
    let s = '';
    if (!sw || !sw.terms.length) {
      s = `<p class="dim">No search entered. Type the symptom as the crew would have written it — <i>won't start, tripped, no power</i> — and the record of every unit above is searched for any of those phrases.</p>`;
    } else {
      s += cite(`Searched the record for ${sw.terms.map(t => `“${esc(t)}”`).join(' or ')} across ${plural(sw.unitsSearched, 'unit')} — axis 1, the parent's other components${sw.includedClass ? ', and the same class by name' : ''} — and, last and apart, this unit itself. Literal phrases, case ignored; the record does not use your vocabulary, so try the crew's.`);
      s += `<h3>On the machines beside it — ${plural(sw.lateral.length, 'job')}</h3>` +
        (sw.lateral.length ? jobRows(sw.lateral, ctx, { showCode: true, terms: sw.terms }) : '<p class="dim">No job on any other unit mentions these.</p>');
      s += `<h3>On this unit — ${plural(sw.self.length, 'job')}</h3>` +
        (sw.self.length ? jobRows(sw.self, ctx, { showCode: true, terms: sw.terms }) : '<p class="dim">Not on this unit\'s record either.</p>');
      if (sw.capped) s += `<p class="dim">${esc(sw.capped)}</p>`;
    }
    out.push(sec('The record, searched', s));

    out.push(`<div class="callout callout-warn"><div class="callout-title">The class axis is where this report stops and a reading starts.</div>
      <p>Every population above is arithmetic over names, codes and purchase records. <b>None of them is a principle of operation</b> — a reciprocating refrigeration compressor and the other reciprocating compressors aboard may sit in different groups, under different makers, with different titles. Whether a precedent on a sister unit is the same fault, the discriminator that separates two candidates, and a call of common cause are judgements. They are the engineer's, or the Maintenance seat's Tier 3 in the Roundtable.</p></div>`);
    out.push(sec('None of these', `<p>Nothing on either axis fits? Tier 4 — what the drawings say must be true for it to be in this state — is a conversation, and it is the Roundtable's.</p>`));
    return out.join('\n');
  }

  // ── Service history — the technician's card ─────────────────────────────────
  //
  // docs/failure-history-upkeep.md §4. Every report, grouped by what TM Master
  // recorded, and the facts that make an engineer worth calling. No verdict.

  function techSection(m, ctx) {
    const s = m.service;
    const out = [];
    const codes = (m.codes || [m.code]).join(', ');
    if (!s || !s.count) {
      out.push(`<div class="banner banner-none">No service report on record.</div>
        <p>Searched the job-history mirror under ${esc(codes)}, both padding forms. This machine has never had a service report written against it — which is itself worth knowing.</p>`);
      return out.join('\n');
    }
    out.push(`<p class="lede"><b>${plural(s.count, 'service report')}</b> on record, ${esc(s.first)} to ${esc(s.last)}, under ${esc(codes)}.</p>`);

    // By reason
    const rows = s.groups.map(g => g.reasons.map((r, i) => `<tr>${i === 0 ? `<td rowspan="${g.reasons.length}" class="grp grp-${esc(g.group.toLowerCase().replace(/\s+/g, '-'))}">${esc(g.group)} <span class="dim">${g.count}</span></td>` : ''}
        <td>${esc(r.reason)}</td><td class="c-jobs">${r.count}</td><td class="c-dates">${esc(r.last)}</td></tr>`).join('')).join('');
    out.push(sec('By reason — as TM Master recorded it',
      `<table class="grid reasons"><thead><tr><th class="c-grp"></th><th>Reason</th><th class="c-jobs">Reports</th><th class="c-dates">Latest</th></tr></thead><tbody>${rows}</tbody></table>` +
      cite(`TM's own words and spelling. <b>Unplanned</b> is ${L.UNPLANNED.map(esc).join(', ')}; <b>Planned</b> is ${L.PLANNED.map(esc).join(', ')}. A reason on neither list is shown under its own name as <b>Other</b>.`)));

    // By outcome
    const o = s.outcomes;
    const oItems = L.OUTCOMES.filter(k => o[k]).map(k => `<span class="oc oc-${esc(k.replace(/\s+/g, '-'))}">${esc(k)} <b>${o[k]}</b></span>`).join(' ');
    out.push(sec('How it was left', `<p>${oItems}</p>` +
      cite('From TM\'s condition after the job. <b>Restored</b> is Good or Acceptable; <b>not restored</b> is Operational with defects, Non Operational, Broken, Not Acceptable or Bad.')));

    // Worth an engineer's eye
    out.push(sec('Worth an engineer\'s eye',
      (s.signals.length
        ? `<ul class="signals">${s.signals.map(x => `<li>${esc(x.text)}</li>`).join('')}</ul>`
        : `<p>None of these is true on the record: ${esc(s.checked.join('; '))}.</p>`) +
      cite('Facts off the record, each shown only when true. They are not a verdict and this card does not say whether to call an engineer — ' +
           (s.signals.length ? 'that is the decision of the person at the machine.' : 'and none being true is not a clearance: the record may simply not hold it.')), 'keep'));

    // The reports
    let jobs = s.jobs;
    const notes = [];
    if (m.techFilter) {
      jobs = jobs.filter(j => j.reasonText === m.techFilter || j.group === m.techFilter);
      notes.push(`showing <b>${esc(m.techFilter)}</b> only`);
    }
    const terms = m.techQuery ? L.sweepTerms(m.techQuery) : [];
    if (terms.length) {
      jobs = L.sweep(jobs, m.techQuery).hits;
      notes.push(`matching ${terms.map(t => `“${esc(t)}”`).join(' or ')}`);
    }
    const head = notes.length ? cite(`${plural(jobs.length, 'report')} of ${s.count} — ${notes.join(', ')}.`) : '';
    const list = jobs.length ? `<div class="jobs">${jobs.map(j => {
      const meta = [j.reasonText, j.condition ? j.condition + (j.outcome === 'not restored' || j.outcome === 'temporarily repaired' ? ` (${j.outcome})` : '') : '', j.historyNo, j.signedBy ? 'signed ' + j.signedBy : '']
        .filter(Boolean).map(esc).join(' · ');
      const text = String(j.serviceReport || j.remark || '');
      return `<div class="job job-${esc(j.group.toLowerCase().replace(/\s+/g, '-'))}">
        <div class="job-head"><b>${esc(j.date || 'undated')}</b> — <b>${esc(j.title || '(untitled job)')}</b>${j.code && L.normCode(j.code) !== L.normCode(m.code) ? ` <span class="dim">(filed under ${esc(j.code)})</span>` : ''}</div>
        ${meta ? `<div class="job-meta">${meta}</div>` : ''}
        ${text ? `<div class="job-text">${terms.length ? markTerms(clip(text, 4000), terms) : esc(clip(text, 4000))}</div>` : ''}
      </div>`;
    }).join('')}</div>` : '<p class="dim">No report matches.</p>';
    out.push(sec('The reports, newest first', head + list));
    return out.join('\n');
  }

  // ── Styles ──────────────────────────────────────────────────────────────────

  function styles(setup) {
    const accent = /^#[0-9a-f]{3,8}$/i.test(setup.secondaryColor || '') ? setup.secondaryColor : '#222222';
    const head   = /^#[0-9a-f]{3,8}$/i.test(setup.headerColor || '')    ? setup.headerColor    : '#555555';
    return `
@page { size: letter; margin: 0.45in 0.55in 0.6in; }
* { box-sizing: border-box; margin: 0; padding: 0; }
html { background: #fff; }
body { font-family: 'Segoe UI', Arial, Helvetica, sans-serif; font-size: 9.4pt; line-height: 1.42; color: #161616; }
* { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
.frame { width: 100%; border-collapse: collapse; }
.frame > thead > tr > td, .frame > tfoot > tr > td, .frame > tbody > tr > td { padding: 0; }
.foot-space { height: 0.28in; }
.foot { position: fixed; left: 0; right: 0; bottom: 0; font-size: 0.72em; color: #666; border-top: 0.5px solid #bbb; padding-top: 3px; }

.lh { display: grid; grid-template-columns: 1fr 1.6fr 1fr; align-items: center; gap: 0.8em;
  padding-bottom: 0.55em; border-bottom: 2px solid ${accent}; margin-bottom: 0.8em; }
.lh-cell { display: flex; flex-direction: column; gap: 0.3em; min-width: 0; }
.lh-left { align-items: flex-start; } .lh-center { align-items: center; text-align: center; } .lh-right { align-items: flex-end; }
.logo { max-height: 52px; max-width: 150px; object-fit: contain; }
.lh-vessel { font-size: 1.55em; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: ${accent}; line-height: 1.15; }
.lh-kind { font-size: 0.86em; letter-spacing: 0.08em; text-transform: uppercase; color: #555; margin-top: 0.15em; }

.tb { margin-bottom: 0.5em; }
.tb-id { font-size: 0.9em; font-weight: 700; letter-spacing: 0.05em; color: ${head}; font-family: Consolas, 'Courier New', monospace; }
.tb-title { font-size: 1.45em; font-weight: 700; line-height: 1.22; margin-top: 0.05em; }

.facts { width: 100%; border-collapse: collapse; margin-bottom: 0.8em; border-top: 0.5px solid #ccc; }
.facts th, .facts td { text-align: left; vertical-align: top; padding: 0.26em 0.5em; border-bottom: 0.5px solid #ccc; }
.facts th { width: 19%; font-size: 0.86em; font-weight: 600; color: #555; white-space: nowrap; background: #f4f4f4; }

.tier-head { margin: 0.4em 0 0.7em; padding: 0.45em 0.7em; background: ${accent}; color: #fff; }
.tier-break { break-before: page; page-break-before: always; }
.tier-name { font-size: 1.15em; font-weight: 700; letter-spacing: 0.03em; }
.tier-scope { font-size: 0.84em; opacity: 0.92; margin-top: 0.1em; }

.sec { margin: 0 0 0.8em; }
.sec > h2 { font-size: 0.86em; font-weight: 700; letter-spacing: 0.09em; text-transform: uppercase; color: ${head};
  border-bottom: 0.5px solid #ccc; padding-bottom: 0.12em; margin: 0 0 0.35em; break-after: avoid; page-break-after: avoid; }
.sec h3 { font-size: 0.95em; font-weight: 700; margin: 0.6em 0 0.25em; break-after: avoid; page-break-after: avoid; }
.sec p { margin: 0 0 0.45em; }
.sec ul, .sec ol { margin: 0 0 0.45em; padding-left: 1.35em; }
.sec li { margin-bottom: 0.15em; }
.sec.quiet { color: #444; font-size: 0.92em; }
.keep { break-inside: avoid; page-break-inside: avoid; }
ul.tight { margin: 0.1em 0 0.3em; padding-left: 1.1em; }
.cite { font-size: 0.88em; color: #555; font-style: italic; }
.cite b, .cite i { font-style: normal; }
.dim { color: #777; }
.mono, code { font-family: Consolas, 'Courier New', monospace; }
code { font-size: 0.92em; background: #f1f1f1; padding: 0 0.2em; border-radius: 2px; }
mark { background: #fff2a8; }
.sub { font-size: 0.9em; color: #444; margin-top: 0.1em; }

.xref { color: #0a5a8a; text-decoration: none; border-bottom: 1px solid rgba(10,90,138,0.35); cursor: pointer; }
.xref:hover { color: #063a5a; border-bottom-color: #063a5a; }
@media print { .xref { color: inherit; border-bottom: none; } }

.banner { padding: 0.35em 0.6em; margin: 0 0 0.6em; font-weight: 600; border: 1px solid; }
.banner-crit { background: #fde8e8; border-color: #b42318; color: #7a1a12; }
.banner-unk  { background: #fff8ea; border-color: #c98a1a; color: #7a4a00; font-weight: 500; }
.banner-note { background: #eef5fb; border-color: #9cc0dc; color: #163e5c; font-weight: 500; }
.banner-none { background: #f3f3f3; border-color: #bbb; color: #333; }

.callout { border-left: 3px solid #bbb; background: #f7f7f7; padding: 0.35em 0.6em 0.1em; margin: 0 0 0.6em; }
.callout-warn { border-left-color: #c98a1a; background: #fff8ea; }
.callout-title { font-weight: 700; margin-bottom: 0.2em; }

.grid { width: 100%; border-collapse: collapse; margin: 0 0 0.6em; font-size: 0.94em; }
.grid th { background: ${accent}; color: #fff; text-align: left; font-weight: 600; font-size: 0.9em; padding: 0.25em 0.45em; }
.grid td { border: 0.5px solid #c8c8c8; padding: 0.28em 0.45em; vertical-align: top; }
.grid tr { break-inside: avoid; page-break-inside: avoid; }
.grid thead { display: table-header-group; }
.grid .c-n { width: 2em; text-align: right; }
.grid .c-cat { width: 2.8em; text-align: center; }
.grid .c-jobs { width: 3.6em; text-align: right; }
.grid .c-dates { width: 9.5em; white-space: nowrap; font-size: 0.92em; }
.grid .c-code { width: 11em; }
.grid tr.self td { background: #f4f8fb; }
.grid tr.tot td { background: #f4f4f4; font-size: 0.88em; color: #444; }
.cats td.c-cat { font-size: 0.95em; }
.flag { font-size: 0.85em; color: #8a5300; }

.cat { display: inline-block; font-size: 0.78em; font-weight: 700; letter-spacing: 0.04em; padding: 0 0.35em;
  border: 1px solid #999; border-radius: 2px; color: #333; background: #fff; }
.cat-EL, .cat-EM { border-color: #b7791f; color: #7a4a00; }
.cat-CT { border-color: #6b46c1; color: #44337a; }
.cat-MC, .cat-ST { border-color: #2c7a7b; color: #1d4e4f; }
.cat-HY { border-color: #2b6cb0; color: #1a4270; }
.cat-PR, .cat-OP { border-color: #9b2c2c; color: #63171b; }
.cat-CS { border-color: #999; color: #666; }

.cand { border: 0.5px solid #bbb; margin: 0 0 0.6em; break-inside: avoid; page-break-inside: avoid; }
.cand-head { display: flex; align-items: baseline; gap: 0.5em; padding: 0.3em 0.55em; background: #f2f2f2; border-bottom: 0.5px solid #bbb; }
.cand-n { font-weight: 700; color: ${head}; }
.cand-name { font-weight: 700; flex: 1; }
.notfail { font-size: 0.82em; color: #666; font-style: italic; }
.kv { width: 100%; border-collapse: collapse; }
.kv th { width: 22%; text-align: left; vertical-align: top; font-weight: 600; font-size: 0.86em; color: #555; padding: 0.22em 0.55em; }
.kv td { padding: 0.22em 0.55em; vertical-align: top; }
.kv tr + tr th, .kv tr + tr td { border-top: 0.5px solid #e2e2e2; }
.kv .gap, .gap { color: #8a5300; font-style: italic; }
.kv tr.standing td { background: #fffbea; }
.recs { font-size: 0.86em; color: #555; }
.acc { display: inline-flex; align-items: center; gap: 0.3em; margin-right: 1em; font-size: 0.9em; white-space: nowrap; }
.box { display: inline-block; width: 1em; height: 1em; border: 1.2px solid #333; border-radius: 1px; vertical-align: middle; flex: 0 0 auto; }
ol.checks { list-style: none; padding-left: 0; }
ol.checks li { display: flex; gap: 0.5em; align-items: flex-start; }
ol.checks .box { margin-top: 0.15em; }

.jobs { margin: 0 0 0.5em; }
.job { border-left: 2px solid #ccc; padding: 0.15em 0 0.15em 0.6em; margin: 0 0 0.5em; break-inside: avoid; page-break-inside: avoid; }
.job-head { font-size: 0.96em; }
.job-meta { font-size: 0.84em; color: #666; }
.job-text { font-size: 0.92em; margin-top: 0.15em; white-space: pre-wrap; }

.prec { margin: 0.3em 0 0.5em; break-inside: avoid; page-break-inside: avoid; }
.prec-head { font-weight: 600; }

.findings { border: 0.5px solid #999; min-height: 1.3in; margin-bottom: 0.6em; }
.sig { width: 100%; border-collapse: collapse; }
.sig td { border-bottom: 1px solid #444; height: 2em; vertical-align: bottom; font-size: 0.8em; color: #555; width: 45%; }
.sig td.gap { border-bottom: none; width: 10%; }

.lede { font-size: 1.05em; margin: 0 0 0.7em; }
.reasons .c-grp { width: 8em; }
.reasons td.grp { font-weight: 700; background: #f6f6f6; }
.reasons td.grp-unplanned { color: #7a1a12; }
.reasons td.grp-planned { color: #1d4e4f; }
.oc { display: inline-block; margin: 0 0.9em 0.2em 0; }
.oc-not-restored b, .oc-temporarily-repaired b { color: #7a1a12; }
.signals li { font-weight: 600; }
.job-unplanned { border-left-color: #c98a1a; }
.job-planned { border-left-color: #9cc0dc; }

.coverage { margin-top: 1em; padding-top: 0.4em; border-top: 0.5px solid #ccc; font-size: 0.8em; color: #555; }
.coverage p { margin: 0 0 0.25em; }

@media screen {
  body { width: 8.5in; padding: 0.45in 0.55in; }
  .frame > thead, .frame > tfoot { display: none; }
  .foot { position: static; margin-top: 1.2em; }
  .tier-break { margin-top: 2em; }
}
`;
  }

  // ── The document ────────────────────────────────────────────────────────────

  // model: see navipedia-diagnostics.js ndxModel(). opts: { tiers: [1,2,3],
  // setup, vessel, printedAt, interactive }.
  function buildDocument(m, opts) {
    opts = opts || {};
    const tiers = (opts.tiers && opts.tiers.length ? opts.tiers : [1, 2, 3]).filter(t => L.TIERS[t]);
    const ctx = { interactive: !!opts.interactive };
    const setup = opts.setup || {};
    const kind = tiers.length === 1 ? L.TIERS[tiers[0]].name.replace(' — ', ' · ') : 'Diagnostic report · Tiers ' + tiers.join(', ');

    const body = [headerHtml(m, ctx)];
    tiers.forEach((t, i) => {
      body.push(tierHead(t, i === 0));
      body.push(t === 'tech' ? techSection(m, ctx) : t === 1 ? tier1(m, ctx) : t === 2 ? tier2(m, ctx) : tier3(m, ctx));
    });
    body.push(findingsHtml());
    body.push(coverageFoot(m.coverage));

    const foot = [
      esc(m.code) + ' ' + esc(m.title || ''),
      opts.vessel ? esc(opts.vessel) : '',
      'Printed ' + esc(fmtDate(opts.printedAt)) + ' — recited from the vault\'s record; not a diagnosis'
    ].filter(Boolean).join(' &nbsp;·&nbsp; ');

    return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8">
<title>${esc(kind + ' — ' + m.code + ' ' + (m.title || ''))}</title>
<style>${styles(setup)}</style>
</head><body>
<table class="frame">
  <thead><tr><td></td></tr></thead>
  <tfoot><tr><td><div class="foot-space"></div></td></tr></tfoot>
  <tbody><tr><td>
    ${letterheadHtml(kind, { setup, vessel: opts.vessel })}
    ${body.filter(Boolean).join('\n')}
  </td></tr></tbody>
</table>
<div class="foot">${foot}</div>
</body></html>`;
  }

  // `Tier 2 331.001 Forward Crane 2026-09-24.pdf` — the room files its reports
  // as `Tier 2 331.001 RPT-….pdf`, so the two sort together in 20.8 Diagnostics.
  function fileName(m, tiers, when) {
    const t = tiers && tiers.length === 1 ? (tiers[0] === 'tech' ? 'Service history' : 'Tier ' + tiers[0]) : 'Diagnostics';
    return (t + ' ' + m.code + ' ' + (m.title || '') + ' ' + isoDay(when))
      .replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ').trim().slice(0, 110) + '.pdf';
  }

  const api = { buildDocument, fileName, markTerms, esc };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.diagnosticsReport = api;

})(typeof window !== 'undefined' ? window : globalThis);
