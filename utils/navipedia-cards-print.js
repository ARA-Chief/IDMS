'use strict';

// ── Navipedia → SOPs, Jobs, KSAs: the handout ────────────────────────────────
//
// One card out of the vault, as a page somebody can be handed: an oiler at the
// start of a job, an engineer picking up a system, a vendor who needs to know
// how this vessel does the thing. docs/navipedia-cards.md.
//
// The same document is the on-screen preview, the printed page and the saved
// PDF. The screen writes it into an iframe, so what the officer reads before
// pressing Print is the page that comes out of the printer — not a dark-theme
// rendering of the card with a print stylesheet guessed at behind it.
//
// Two formats, because the two handouts are different things:
//
//   sheet   US Letter. The whole card, less its Change Log — the change log is
//           the vault's audit trail, and the revision line in the header is
//           what a reader of paper needs from it.
//   card    5½ × 8½, half a Letter sheet. The sections somebody carries to the
//           work: what it is, the hazards, the steps, when to stop, how to put
//           it back. Evidence, sources and scope notes stay on the sheet.
//
// Pure: no DOM, no IPC, no globals it does not check for. The screen hands it
// the note (frontmatter already parsed by main/vault-corpus.js), the corpus to
// resolve links against, and the Report Setup's letterhead settings, and gets a
// complete HTML document back. tools/test-navipedia-cards.js runs it over the
// real vault in node.
//
// ESCAPE FIRST. The vault is a share many people write to, and a note is data,
// not markup. Links and code spans are lifted out before escaping, so a title
// holding `&` still resolves, and every other character is escaped before a
// single tag is added.

(function (root) {

  const K = root.ksaView || (typeof require === 'function' ? require('./ksa-view.js') : null);

  // ── Which cards live in which section ──────────────────────────────────────
  //
  // SOPs and Jobs follow Job Mapping's rule: a card is filed by what it does,
  // not by which range it came from. An SOP whose procedure chains other cards
  // is a job, so it lists under Jobs — and under SOPs as well, because its id
  // says SOP and that is where somebody with the number in hand will look.
  //
  // KSAs are the whole competency corpus. "KSA" is the umbrella for knowledge
  // and skills, global and vessel-dependent — NOT a category. The handful of
  // legacy KSA-P/KSA-T cards are practice and tool skills, and they file by
  // their own category beside the skills rather than in a bucket of their own;
  // a "KSA" tab is how a category being retired keeps coming back.
  const COMPETENCY = ['KSA', 'KNG', 'KND', 'SKG', 'SKD'];

  const SECTIONS = {
    sops: { label: 'SOPs', noun: 'procedure', has: r => r.family === 'SOP' || r.family === 'TASK' },
    jobs: { label: 'Jobs', noun: 'job',       has: r => r.family === 'JOB' || (r.family === 'SOP' && !!r.is_job) },
    ksas: { label: 'KSAs', noun: 'competency', has: r => COMPETENCY.includes(r.family) }
  };

  // Where a link to this card should land. An SOP is opened under SOPs even
  // when it is also a job wrapper: the id is what the reader followed.
  function homeSection(rec) {
    if (!rec) return null;
    if (rec.family === 'SOP' || rec.family === 'TASK') return 'sops';
    if (rec.family === 'JOB') return 'jobs';
    if (COMPETENCY.includes(rec.family)) return 'ksas';
    return null;
  }

  // Knowledge or skill, and global or vessel — the only two cuts the
  // competency corpus is browsed by.
  function competencyKind(rec) {
    if (!rec) return null;
    if (rec.family === 'KNG') return { kind: 'knowledge', scope: 'global' };
    if (rec.family === 'KND') return { kind: 'knowledge', scope: 'vessel' };
    if (rec.family === 'SKD') return { kind: 'skill', scope: 'vessel' };
    if (rec.family === 'SKG' || rec.family === 'KSA') return { kind: 'skill', scope: 'global' };
    return null;
  }

  // The line under the vessel name: what kind of document this is.
  function docKind(rec) {
    if (!rec) return '';
    switch (rec.family) {
      case 'SOP':  return rec.is_job ? 'Job — a sequence of procedures' : 'Standard Operating Procedure';
      case 'TASK': return 'Global Task';
      case 'JOB':  return 'Job Card';
      case 'KNG':  return 'Knowledge';
      case 'KND':  return 'Knowledge — vessel-specific';
      case 'SKD':  return 'Skill — vessel-specific';
      case 'SKG':
      case 'KSA':  return 'Skill';
      default:     return rec.family_label || rec.family || '';
    }
  }

  // ── Search ─────────────────────────────────────────────────────────────────
  //
  // Every term must appear somewhere, so "main engine loto" narrows rather than
  // widening. Ranking: id prefix, then id, then title, then everything else —
  // typing "SOP-0073" must not be outranked by a card that merely mentions it.
  // The same rule the Report Generator's card picker uses, so the two search
  // boxes agree about what the best hit for a query is.
  function haystack(rec) {
    const ck = competencyKind(rec);
    return [
      rec.id, rec.title, rec.asset, rec.equipment, rec.category, rec.subcategory,
      docKind(rec), ck ? ck.kind : '', ck && ck.scope === 'vessel' ? 'vessel dependency' : '',
      (rec.tags || []).join(' ')
    ].filter(Boolean).join(' ').toLowerCase();
  }

  function search(cards, query, limit) {
    const q = String(query || '').trim().toLowerCase();
    if (!q) return [];
    const terms = q.split(/\s+/).filter(Boolean);
    const hits = [];
    for (const rec of cards || []) {
      const hay = rec._hay || (rec._hay = haystack(rec));
      if (!terms.every(t => hay.includes(t))) continue;
      const id    = String(rec.id).toLowerCase();
      const short = shortId(rec.id).toLowerCase();
      const title = String(rec.title || '').toLowerCase();
      let score = 4;
      if (title.includes(q))                          score = 3;
      if (title.startsWith(q))                        score = 2;
      if (id.includes(q))                             score = 1;
      if (id.startsWith(q) || short.startsWith(q))    score = 0;
      hits.push({ rec, score });
    }
    hits.sort((a, b) => a.score - b.score
      || String(a.rec.id).localeCompare(String(b.rec.id), undefined, { numeric: true }));
    return hits.slice(0, limit || 12).map(h => h.rec);
  }

  // ── Small helpers ──────────────────────────────────────────────────────────

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function shortId(id)  { return K ? K.shortId(id) : String(id || ''); }
  function plainTitle(t) { return K ? K.plainTitle(t) : String(t || ''); }

  // `approved_by:` with nothing after it parses as `[]`, which is "not stated",
  // not "an empty list". Everything below reads values through these two.
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

  function fmtDate(d) {
    const dt = d instanceof Date ? d : new Date(d || Date.now());
    return dt.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  // ── Links ──────────────────────────────────────────────────────────────────
  //
  // Paper has no links, but the target is often the only name a thing has.
  // A card prints as its short id and title, so "[[SOP-0003-main-engine-loto-
  // remove]]" reads as "SOP-0003 Main engine LOTO remove" rather than as a
  // slug. Anything else — equipment, job history — prints as its own name.
  // With `interactive`, card links carry data-id so the on-screen preview can
  // follow them; the print stylesheet draws them as plain text.
  function corpusIndex(corpus) {
    const byId = new Map(), byShort = new Map();
    for (const r of corpus || []) {
      byId.set(r.id, r);
      const s = shortId(r.id);
      if (!byShort.has(s)) byShort.set(s, r);
    }
    return { byId, byShort, find: t => byId.get(t) || byShort.get(shortId(t)) || null };
  }

  function linkHtml(inner, ctx) {
    const bar    = inner.lastIndexOf('|');
    const target = (bar === -1 ? inner : inner.slice(0, bar)).replace(/\\$/, '').trim();
    const alias  = (bar === -1 ? ''    : inner.slice(bar + 1)).trim();
    const note   = target.split('#')[0].trim();
    const rec    = note ? ctx.index.find(note) : null;

    let label;
    if (alias)      label = esc(alias);
    else if (rec)   label = `<b>${esc(shortId(rec.id))}</b> ${esc(plainTitle(rec.title))}`;
    else            label = esc(target.replace(/#/g, ' › ') || inner);

    if (rec && ctx.interactive) {
      return `<a class="xref" data-id="${esc(rec.id)}" title="Open ${esc(shortId(rec.id))}">${label}</a>`;
    }
    return `<span class="ref">${label}</span>`;
  }

  function inline(raw, ctx) {
    const slots = [];
    const slot  = html => ' ' + (slots.push(html) - 1) + '';
    let s = String(raw == null ? '' : raw);
    // An embed on paper is the name of what it embeds. The section itself is a
    // Navipedia map's business, and no card in the corpus uses one.
    s = s.replace(/!\[\[([^\]]+)\]\]/g, (m, inner) => slot(linkHtml(inner, ctx)));
    s = s.replace(/\[\[([^\]]+)\]\]/g,  (m, inner) => slot(linkHtml(inner, ctx)));
    s = s.replace(/`([^`]+)`/g,         (m, code)  => slot('<code>' + esc(code) + '</code>'));
    s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (m, text) => slot(esc(text)));
    s = esc(s);
    s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
         .replace(/(^|[^*\w])\*([^*\n]+)\*/g, '$1<em>$2</em>')
         .replace(/(^|[^_\w])_([^_\n]+)_(?!\w)/g, '$1<em>$2</em>')
         .replace(/==([^=]+)==/g, '<mark>$1</mark>')
         // An open question on the card stays visible on the paper, set in a
         // way that reads as a flag rather than as part of the instruction.
         .replace(/\[VERIFY\]/g, '<span class="vfy">[VERIFY]</span>')
         .replace(/&lt;br\s*\/?&gt;/gi, '<br>');
    return s.replace(/ (\d+)/g, (m, i) => slots[Number(i)]);
  }

  // ── Blocks ─────────────────────────────────────────────────────────────────

  const BOX = '<span class="box"></span>';

  // Split on unescaped pipes only: `\|` inside a cell is the pipe of an aliased
  // wikilink, and splitting there prints half a link.
  function cells(row) {
    return row.trim().replace(/^\|/, '').replace(/\|$/, '')
      .split(/(?<!\\)\|/).map(c => c.trim().replace(/\\\|/g, '|'));
  }

  // A job's Task decomposition is six columns wide — Seq, Task, Scope, Skills
  // required, Tools required, LO/TO — and on a half sheet it is a wall. On the
  // card it is trimmed to what somebody working down the job reads off the
  // page: the sequence number, the step, and a box to tick. The columns that go
  // are all reference, and the sheet still carries them — except for the card a
  // global step chains, which is the one thing in them the reader may have to
  // go and fetch, so that link folds under the step text the way a yaml step's
  // does. Returns null on any table that is not this one, and the plain
  // renderer takes it.
  function decompHtml(rows, ctx) {
    const head = cells(rows[0]);
    const at   = re => head.findIndex(h => re.test(String(h).trim()));
    const iSeq = at(/^seq/i), iTask = at(/^task|^step/i), iScope = at(/^scope/i);
    if (iSeq < 0 || iTask < 0) return null;
    const body = rows.slice(2).map(cells);
    return `<table class="grid steps decomp">
      <thead><tr><th class="c-id">${inline(head[iSeq], ctx)}</th><th>${inline(head[iTask], ctx)}</th><th class="c-box">✓</th></tr></thead>
      <tbody>${body.map(r => {
        const links = iScope >= 0 ? String(r[iScope] || '').match(/\[\[[^\]]+\]\]/g) || [] : [];
        const sub = links.length
          ? `<div class="step-card">Card: ${links.map(l => inline(l, ctx)).join(' · ')}</div>` : '';
        return `<tr><td class="c-id">${inline(r[iSeq] || '', ctx)}</td>
          <td>${inline(r[iTask] || '', ctx)}${sub}</td>
          <td class="c-box">${BOX}</td></tr>`;
      }).join('')}</tbody>
    </table>`;
  }

  function tableHtml(rows, ctx) {
    if (ctx.decompose) {
      const trimmed = decompHtml(rows, ctx);
      if (trimmed) return trimmed;
    }
    const head = cells(rows[0]);
    const body = rows.slice(2).map(cells);
    // A fill-in table — the Record section, a blank Entry column — prints with
    // room to write in. Blank cells are the point of printing it.
    const blanks = body.length && body.every(r => r.slice(1).every(c => !c));
    return `<table class="grid${blanks ? ' fill' : ''}">
      <thead><tr>${head.map(h => `<th>${inline(h, ctx)}</th>`).join('')}</tr></thead>
      <tbody>${body.map(r => `<tr>${head.map((_, i) => `<td>${inline(r[i] || '', ctx)}</td>`).join('')}</tr>`).join('')}</tbody>
    </table>`;
  }

  // The SOP lane writes its steps as a yaml fence (id / step / src / sop /
  // depth). On paper each step gets a box to tick with a pen.
  function stepsHtml(fenceText, ctx) {
    const parse = ctx.parseSteps;
    if (typeof parse !== 'function') return null;
    let rows;
    try { rows = parse(fenceText); } catch (_) { return null; }
    if (!Array.isArray(rows) || !rows.some(r => r.id || r.text)) return null;
    return `<table class="grid steps">
      <thead><tr><th class="c-id">Step</th><th>Action</th><th class="c-box">✓</th></tr></thead>
      <tbody>${rows.map(r => {
        const card = r.sopId ? ctx.index.find(r.sopId) : null;
        const sub  = r.sopId
          ? `<div class="step-card">Card: ${linkHtml(card ? card.id : r.sopId, ctx)}</div>` : '';
        return `<tr><td class="c-id">${esc(r.id || '')}</td>
          <td class="${r.depth ? 'sub-step' : ''}">${inline(r.text || '', ctx)}${sub}</td>
          <td class="c-box">${BOX}</td></tr>`;
      }).join('')}</tbody>
    </table>`;
  }

  // ── Figures ────────────────────────────────────────────────────────────────
  //
  // A card's own pictures — a photo of the panel a step names, a screenshot of
  // the field to fill in — are embedded the Obsidian way, one to a line, with an
  // italic caption on the line under it:
  //
  //   ![[Boat Book p014 ICMS stations.jpeg]]
  //   *Figure 1 — The ICMS operator stations (step A10). Boat Book v0.1, p.14.*
  //
  // The machine's pictures are inherited from its folder (picturesHtml); these
  // belong to the procedure. This module cannot read a file, so the screen hands
  // the bytes in as `opts.figures` — name → data: URL — and a figure it was not
  // handed prints as its name rather than as nothing. That is what the phone,
  // reading a bundle without the pictures in it, shows.
  const FIGURE_LINE  = /^!\[\[([^\]|#]+?\.(?:png|jpe?g|gif|webp|bmp))(?:\|[^\]]*)?\]\]\s*$/i;
  const CAPTION_LINE = /^(?:\*([^*].*?)\*|_([^_].*?)_)\s*$/;

  function figureNames(text) {
    const out = [];
    for (const line of String(text || '').split(/\r?\n/)) {
      const m = line.trim().match(FIGURE_LINE);
      if (m && !out.includes(m[1].trim())) out.push(m[1].trim());
    }
    return out;
  }

  function figureHtml(fig, ctx) {
    const src = ctx.figures && ctx.figures[fig.name];
    const cap = fig.caption ? `<figcaption>${inline(fig.caption, ctx)}</figcaption>` : '';
    const pic = typeof src === 'string' && /^data:image\//.test(src)
      ? `<img src="${src}" alt="${esc(fig.caption || fig.name)}">`
      : `<div class="fig-none">Picture: ${esc(fig.name)}</div>`;
    return `<figure>${pic}${cap}</figure>`;
  }

  function md(text, ctx) {
    const lines = String(text || '').replace(/\r\n?/g, '\n').split('\n');
    const out = [];
    let para = [];
    const flush = () => {
      if (para.length) out.push(`<p>${inline(para.join(' '), ctx)}</p>`);
      para = [];
    };
    const LI = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const t = line.trim();

      const fence = t.match(/^(```+|~~~+)(.*)$/);
      if (fence) {
        flush();
        const buf = [line];
        for (i++; i < lines.length; i++) {
          buf.push(lines[i]);
          if (lines[i].trim().startsWith(fence[1])) break;
        }
        const whole = buf.join('\n');
        const steps = /^ya?ml/i.test(fence[2].trim()) ? stepsHtml(whole, ctx) : null;
        out.push(steps || `<pre>${esc(buf.slice(1, -1).join('\n'))}</pre>`);
        continue;
      }

      if (!t) { flush(); continue; }
      if (/^(-{3,}|\*{3,}|_{3,})$/.test(t)) { flush(); out.push('<hr>'); continue; }

      // A run of figures, blank lines between them allowed, sets as one grid.
      if (FIGURE_LINE.test(t)) {
        flush();
        const figs = [];
        while (i < lines.length) {
          const m = lines[i].trim().match(FIGURE_LINE);
          if (m) {
            const cap = (lines[i + 1] || '').trim().match(CAPTION_LINE);
            figs.push({ name: m[1].trim(), caption: cap ? (cap[1] || cap[2]) : '' });
            i += cap ? 2 : 1;
            continue;
          }
          if (!lines[i].trim() && FIGURE_LINE.test((lines[i + 1] || '').trim())) { i++; continue; }
          break;
        }
        i--;
        out.push(`<div class="figs">${figs.map(f => figureHtml(f, ctx)).join('')}</div>`);
        continue;
      }

      const h = t.match(/^(#{1,6})\s+(.*)$/);
      if (h) { flush(); out.push(`<h3>${inline(h[2], ctx)}</h3>`); continue; }

      if (t.startsWith('|') && /^\s*\|[\s:|-]+\|\s*$/.test(lines[i + 1] || '')) {
        flush();
        const buf = [];
        while (i < lines.length && lines[i].trim().startsWith('|')) buf.push(lines[i++]);
        i--;
        out.push(tableHtml(buf, ctx));
        continue;
      }

      if (t.startsWith('>')) {
        flush();
        const buf = [];
        let title = '';
        while (i < lines.length && lines[i].trim().startsWith('>')) {
          let inner = lines[i].trim().replace(/^>\s?/, '');
          const c = inner.match(/^\[![a-z]+\][-+]?\s*(.*)$/i);
          if (c) { title = c[1].trim(); inner = ''; }
          buf.push(inner);
          i++;
        }
        i--;
        out.push(`<div class="callout">${title ? `<div class="callout-title">${inline(title, ctx)}</div>` : ''}${md(buf.join('\n'), ctx)}</div>`);
        continue;
      }

      const li = line.match(LI);
      if (li) {
        flush();
        const ordered = /\d/.test(li[2]);
        const items = [];
        while (i < lines.length) {
          const m = lines[i].match(LI);
          if (m) { items.push({ sub: m[1].length >= 2, text: m[3] }); i++; continue; }
          // The corpus wraps at 72 columns; an indented line belongs to the
          // item above it, or a long expectation prints cut in half.
          if (items.length && lines[i].trim() && /^\s+\S/.test(lines[i])) {
            items[items.length - 1].text += ' ' + lines[i].trim();
            i++;
            continue;
          }
          break;
        }
        i--;
        const tag = ordered ? 'ol' : 'ul';
        out.push(`<${tag}>${items.map(it =>
          `<li${it.sub ? ' class="sub"' : ''}>${inline(it.text, ctx)}</li>`).join('')}</${tag}>`);
        continue;
      }

      para.push(t);
    }
    flush();
    return out.join('\n');
  }

  // ── What goes on which format ──────────────────────────────────────────────
  //
  // The card is ONE section: the doing part. A knowledge note's Summary is the
  // shape the rest follow — a page somebody can be handed without a briefing,
  // not an abridged sheet. So an SOP prints its Procedure (its Sequence, when
  // the SOP is a job wrapper), a task its Atomic steps, a job its Task
  // decomposition, and nothing else out of the body. Purpose, scope, specs,
  // abort and acceptance criteria, restoration, the record table — all of it is
  // the sheet's, and the sheet is a keystroke away.
  //
  // What sits above the section does NOT change with the format: the facts
  // table, the hazard box and the required competency are the frontmatter, and
  // they are how the card says which machine, who may touch it and what will
  // hurt them. Legacy KSA-* cards are the one lane with more than one section,
  // because their four are what a skill card is.
  //
  // Headings are matched by prefix, lower-cased, so "Assessment criteria, per
  // level" and "LO/TO list" match without the lanes agreeing on punctuation.
  const CARD_SECTIONS = {
    SOP:  ['procedure', 'sequence'],
    JOB:  ['task decomposition'],
    TASK: ['atomic steps'],
    KSA:  ['purpose', 'expectations', 'assessment criteria', 'common errors'],
    KNG:  ['summary'],
    KND:  ['summary'],
    SKG:  ['summary'],
    SKD:  ['summary']
  };

  // Never printed. The Change Log is the vault's audit trail and the header
  // carries the revision; a sign-off register section is a pointer into the
  // training workbook for the officer, not something the person holding the
  // card can act on.
  const NEVER = ['change log', 'sign-off register'];

  function wantSection(rec, heading, format) {
    const h = String(heading || '').trim().toLowerCase();
    if (NEVER.some(p => h.startsWith(p))) return false;
    if (format !== 'card') return true;
    const allow = CARD_SECTIONS[rec.family] || [];
    return allow.some(p => h.startsWith(p));
  }

  // Frontmatter worth putting on paper, per lane, and on which format. `both`
  // unless it says `sheet`.
  const FIELDS = {
    SOP: [
      ['equipment',      'Equipment'],
      ['asset',          'Asset',            'sheet'],
      ['titles',         'Who may perform'],
      ['requires_state', 'Plant must be'],
      ['yields_state',   'Leaves the plant',  'sheet'],
      ['permits',        'Permits'],
      ['tools',          'Tools'],
      ['inverse_card',   'Undone by']
    ],
    JOB:  [['asset', 'Asset'], ['interval', 'Interval'], ['tm_job', 'TM Master job', 'sheet']],
    TASK: [['scope', 'Scope'], ['tools', 'Tools']],
    KSA:  [['_category', 'Category'], ['validity', 'Where it applies'], ['recency', 'Recency', 'sheet'],
           ['external_credential', 'External credential']],
    KNG:  [['_category', 'Category']],
    KND:  [['_category', 'Category'], ['system', 'System']],
    SKG:  [['_category', 'Category']],
    SKD:  [['_category', 'Category'], ['system', 'System']]
  };

  function fieldValue(fm, key) {
    if (key === '_category') {
      return [scalar(fm.category), scalar(fm.subcategory)].filter(Boolean).join(' › ');
    }
    return fm[key];
  }

  function fieldsHtml(rec, fm, format, ctx) {
    const rows = (FIELDS[rec.family] || [])
      .filter(([, , only]) => !only || only === format)
      .map(([key, label]) => {
        const items = list(fieldValue(fm, key));
        if (!items.length) return '';
        const val = items.length === 1
          ? inline(items[0], ctx)
          : `<ul class="tight">${items.map(v => `<li>${inline(v, ctx)}</li>`).join('')}</ul>`;
        return `<tr><th>${esc(label)}</th><td>${val}</td></tr>`;
      }).filter(Boolean);
    return rows.length ? `<table class="facts">${rows.join('')}</table>` : '';
  }

  // The level ladder in the vault's order, bottom to top, whatever order the
  // note wrote it in — "supervised" only means something next to "independent".
  function levelsHtml(levels, ctx) {
    if (!levels || typeof levels !== 'object' || Array.isArray(levels)) return '';
    const keys  = Object.keys(levels).filter(k => scalar(levels[k]));
    if (!keys.length) return '';
    const order = (K ? K.LEVEL_ORDER : []).filter(l => keys.includes(l))
      .concat(keys.filter(l => !(K ? K.LEVEL_ORDER : []).includes(l)));
    return `<section class="sec"><h2>Levels</h2>
      <table class="grid levels"><tbody>${order.map(l =>
        `<tr><th>${esc(l)}</th><td>${inline(scalar(levels[l]), ctx)}</td></tr>`).join('')}</tbody></table>
    </section>`;
  }

  function requiresHtml(entries, ctx) {
    const rows = list(entries).map(raw => {
      const e   = K ? K.parseRequires(raw) : { id: '', note: raw };
      const rec = e.id ? ctx.index.find(e.id) : null;
      const who = rec
        ? linkHtml(rec.id, ctx)
        : esc(e.id ? shortId(e.id) : e.note);
      const lvl = e.id ? esc(e.note) : '';
      return `<tr><td>${who}</td><td class="lvl">${lvl}</td></tr>`;
    });
    if (!rows.length) return '';
    return `<section class="sec"><h2>Required competency</h2>
      <table class="grid req"><thead><tr><th>Knowledge or skill</th><th class="lvl">Level</th></tr></thead>
      <tbody>${rows.join('')}</tbody></table></section>`;
  }

  function hazardsHtml(items, ctx, title) {
    const h = list(items);
    if (!h.length) return '';
    return `<section class="sec hazards"><h2>${esc(title || 'Hazards')}</h2>
      <ul>${h.map(v => `<li>${inline(v, ctx)}</li>`).join('')}</ul></section>`;
  }

  // ── Letterhead ─────────────────────────────────────────────────────────────
  //
  // Report Generator → Report Setup's logo, vessel icon, their alignment and
  // its colours — the settings every printed document the Console issues is
  // dressed in. The vessel name is stated in words as well as by icon: a
  // handout leaves the ship, and an icon on its own names nothing to a vendor.
  function letterheadHtml(rec, opts) {
    const s = opts.setup || {};
    const cellsAt = { left: '', center: '', right: '' };
    const put = (align, html, fallback) => {
      const at = ['left', 'center', 'right'].includes(align) ? align : fallback;
      cellsAt[at] += html;
    };
    if (s.companyLogo) put(s.companyLogoAlign, `<img class="logo" src="${esc(s.companyLogo)}" alt="">`, 'left');
    if (s.vesselIcon)  put(s.vesselIconAlign,  `<img class="logo" src="${esc(s.vesselIcon)}" alt="">`, 'right');

    const title = `<div class="lh-text">
        ${opts.vessel ? `<div class="lh-vessel">${esc(opts.vessel)}</div>` : ''}
        <div class="lh-kind">${esc(docKind(rec))}</div>
      </div>`;
    // The text block is centred. A logo set to centre sits above it rather than
    // on top of it.
    cellsAt.center = cellsAt.center + title;

    return `<header class="lh">
      <div class="lh-cell lh-left">${cellsAt.left}</div>
      <div class="lh-cell lh-center">${cellsAt.center}</div>
      <div class="lh-cell lh-right">${cellsAt.right}</div>
    </header>`;
  }

  function isApproved(fm) {
    return String(scalar(fm.status)).toLowerCase() === 'approved' && !!scalar(fm.approved_by);
  }

  function titleBlockHtml(rec, fm) {
    const rev     = scalar(fm.revision);
    const revised = scalar(fm.revised) || rec.revised || '';
    const status  = scalar(fm.status) || rec.status || '';
    const signed  = isApproved(fm);
    const meta = [
      rev !== '' ? 'Rev ' + esc(rev) : '',
      revised ? 'Revised ' + esc(revised) : '',
      signed ? 'Approved by ' + esc(scalar(fm.approved_by))
             : `<span class="draft-tag">${esc(status ? status.toUpperCase() : 'DRAFT')} — NOT YET APPROVED</span>`
    ].filter(Boolean).join(' &nbsp;·&nbsp; ');
    return `<div class="tb">
      <div class="tb-id">${esc(shortId(rec.id))}</div>
      <div class="tb-title">${esc(plainTitle(rec.title))}</div>
      <div class="tb-meta">${meta}</div>
    </div>`;
  }

  function footerText(rec, fm, opts) {
    const rev = scalar(fm.revision);
    return [
      esc(shortId(rec.id)) + (rev !== '' ? ' rev ' + esc(rev) : ''),
      opts.vessel ? esc(opts.vessel) : '',
      'Printed ' + esc(fmtDate(opts.printedAt)) + ' — uncontrolled when printed; check the Console for the current revision'
    ].filter(Boolean).join(' &nbsp;·&nbsp; ');
  }

  function issuedHtml(format) {
    const f = (label, w) => `<div class="iss-f" style="flex:${w}"><div class="iss-line"></div><span>${label}</span></div>`;
    return format === 'card'
      ? `<div class="issued">
           <div class="iss-row">${f('Issued to', 3)}${f('Date', 1.4)}</div>
           <div class="iss-row">${f('Issued by', 3)}${f('Signature', 1.4)}</div>
         </div>`
      : `<div class="issued">
           <div class="iss-row">${f('Issued to', 3)}${f('Position / company', 2.4)}${f('Date', 1.3)}</div>
           <div class="iss-row">${f('Issued by', 3)}${f('Signature of recipient', 2.4)}${f('', 1.3)}</div>
         </div>`;
  }

  // ── Styles ─────────────────────────────────────────────────────────────────
  // ── What the card inherits from its machine ──────────────────────────────────
  //
  // `opts.equipment` is equipCardContext.forAsset()'s answer for the card's
  // `asset:` (src/renderer/js/equipment-pictures.js). None of it is on the card:
  // it is the component's, looked up as the card is read, so a photo replaced in
  // the component's folder is replaced on every card about that machine.
  // docs/equipment-pictures.md.

  // How many pictures each format carries. The half-sheet is taken to the job,
  // where two pictures say "this one" and a page of them says nothing.
  const PICTURE_CAP = { sheet: 12, card: 2 };

  function picturesHtml(eq, format, ctx) {
    const pics = (eq && eq.pictures && eq.pictures.items) || [];
    if (!pics.length) return '';
    const shown = pics.slice(0, PICTURE_CAP[format] || 2);
    const whose = eq.pictures.filedAt && eq.pictures.filedAt !== eq.code
      ? ` <span class="eq-whose">— pictures of ${esc(eq.pictures.filedAt)}, the nearest filed</span>` : '';
    return `<section class="sec eq-pics"><h2>Equipment pictures${whose}</h2>
      <div class="eq-grid eq-grid-${format}">${shown.map(p => {
        const img = `<img src="${p.src}" alt="${esc(p.caption)}">`;
        return `<figure>${ctx.interactive
          ? `<a class="eqopen" data-path="${esc(p.path)}" title="Open ${esc(p.name)}">${img}</a>` : img}
          <figcaption>${esc(p.caption)}</figcaption></figure>`;
      }).join('')}</div></section>`;
  }

  // Drawings and manual folders held for the machine. On paper the path is
  // printed, because a handout cannot be clicked and the path is how it is found.
  function equipmentDocsHtml(eq, format, ctx) {
    if (format !== 'sheet' || !eq || !eq.docs) return '';
    const { drawings = [], manuals = [] } = eq.docs;
    if (!drawings.length && !manuals.length) return '';
    const door = (label, target, sub) => {
      const main = ctx.interactive && target
        ? `<a class="eqopen" data-path="${esc(target)}">${label}</a>` : label;
      return `<li>${main}${sub ? `<div class="eq-path">${esc(sub)}</div>` : ''}</li>`;
    };
    const dRows = drawings.map(d => {
      const target = d.exists ? d.path : d.folderPath;
      const where = d.how === 'group' && d.via && d.via.length ? ` (for ${esc(d.via.join(', '))})` : '';
      const label = `<b>${esc(d.drawing)}</b> ${esc(d.title || '')}${d.rev ? ' · rev ' + esc(d.rev) : ''}${where}`
        + (target ? '' : ' <span class="eq-whose">— file not found</span>');
      return door(label, target, target);
    });
    const mRows = manuals.map(m => {
      const label = `<b>${esc(m.folder)}</b>${m.filedAt && m.filedAt !== eq.code ? ` (filed under ${esc(m.filedAt)})` : ''}`
        + (m.reachable ? ` · ${m.fileCount} file${m.fileCount === 1 ? '' : 's'}` : ' <span class="eq-whose">— share not reachable</span>');
      return door(label, m.reachable ? m.path : null, m.path);
    });
    return `<section class="sec"><h2>Equipment documents — ${esc(eq.code)}</h2>
      ${dRows.length ? `<h3>Drawings</h3><ul>${dRows.join('')}</ul>` : ''}
      ${mRows.length ? `<h3>Manuals</h3><ul>${mRows.join('')}</ul>` : ''}</section>`;
  }

  //
  // One stylesheet, two scales. Everything is sized in `em` off the body, so
  // the card is the sheet at a smaller type size rather than a second layout
  // that drifts from the first.
  function styles(format, setup) {
    const accent = /^#[0-9a-f]{3,8}$/i.test(setup.secondaryColor || '') ? setup.secondaryColor : '#222222';
    const head   = /^#[0-9a-f]{3,8}$/i.test(setup.headerColor || '')    ? setup.headerColor    : '#555555';
    const card   = format === 'card';
    const page   = card
      ? { size: '5.5in 8.5in', margin: '0.3in 0.32in 0.5in', font: '7.6pt', width: '5.5in', pad: '0.3in 0.32in' }
      : { size: 'letter',      margin: '0.45in 0.55in 0.6in', font: '9.6pt', width: '8.5in', pad: '0.45in 0.55in' };
    return `
@page { size: ${page.size}; margin: ${page.margin}; }
* { box-sizing: border-box; margin: 0; padding: 0; }
html { background: #fff; }
body { font-family: 'Segoe UI', Arial, Helvetica, sans-serif; font-size: ${page.font}; line-height: 1.42; color: #161616; }
* { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }

.frame { width: 100%; border-collapse: collapse; }
.frame > thead > tr > td, .frame > tfoot > tr > td, .frame > tbody > tr > td { padding: 0; }
.foot-space { height: 0.28in; }
.foot { position: fixed; left: 0; right: 0; bottom: 0; font-size: 0.72em; color: #666;
  border-top: 0.5px solid #bbb; padding-top: 3px; }

.lh { display: grid; grid-template-columns: 1fr 1.6fr 1fr; align-items: center; gap: 0.8em;
  padding-bottom: 0.55em; border-bottom: 2px solid ${accent}; margin-bottom: 0.8em; }
.lh-cell { display: flex; flex-direction: column; gap: 0.3em; min-width: 0; }
.lh-left { align-items: flex-start; } .lh-center { align-items: center; text-align: center; } .lh-right { align-items: flex-end; }
.logo { max-height: ${card ? '34px' : '52px'}; max-width: ${card ? '96px' : '150px'}; object-fit: contain; }
.lh-vessel { font-size: 1.55em; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: ${accent}; line-height: 1.15; }
.lh-kind { font-size: 0.86em; letter-spacing: 0.08em; text-transform: uppercase; color: #555; margin-top: 0.15em; }

.tb { margin-bottom: 0.7em; }
.tb-id { font-size: 0.9em; font-weight: 700; letter-spacing: 0.05em; color: ${head}; }
.tb-title { font-size: 1.45em; font-weight: 700; line-height: 1.22; margin-top: 0.05em; }
.tb-meta { font-size: 0.82em; color: #555; margin-top: 0.3em; }
.draft-tag { color: #8a5300; font-weight: 700; letter-spacing: 0.03em; }

.stub { border: 1px dashed #999; padding: 0.8em 1em; color: #555; margin: 0.6em 0; }

.facts { width: 100%; border-collapse: collapse; margin-bottom: 0.7em; border-top: 0.5px solid #ccc; }
.facts th, .facts td { text-align: left; vertical-align: top; padding: 0.28em 0.5em; border-bottom: 0.5px solid #ccc; }
.facts th { width: ${card ? '26%' : '19%'}; font-size: 0.86em; font-weight: 600; color: #555; white-space: nowrap; background: #f4f4f4; }

.sec { margin: 0 0 0.75em; }
.sec > h2 { font-size: 0.86em; font-weight: 700; letter-spacing: 0.09em; text-transform: uppercase; color: ${head};
  border-bottom: 0.5px solid #ccc; padding-bottom: 0.12em; margin: 0 0 0.35em; break-after: avoid; page-break-after: avoid; }
.sec h3 { font-size: 0.95em; font-weight: 700; margin: 0.55em 0 0.2em; break-after: avoid; page-break-after: avoid; }
.sec p { margin: 0 0 0.45em; }
.sec ul, .sec ol { margin: 0 0 0.45em; padding-left: 1.35em; }
.sec li { margin-bottom: 0.12em; }
.sec li.sub { margin-left: 1.2em; }
ul.tight { margin: 0; padding-left: 1.1em; }
code { font-family: Consolas, 'Courier New', monospace; font-size: 0.92em; background: #f1f1f1; padding: 0 0.2em; border-radius: 2px; }
pre { font-family: Consolas, 'Courier New', monospace; font-size: 0.85em; background: #f6f6f6; border: 0.5px solid #ddd;
  padding: 0.4em 0.6em; margin: 0 0 0.5em; white-space: pre-wrap; }
hr { border: none; border-top: 0.5px solid #ccc; margin: 0.5em 0; }
mark { background: #fff2a8; }
.vfy { font-size: 0.8em; font-weight: 700; color: #8a5300; letter-spacing: 0.02em; }
.ref b, .xref b { font-weight: 700; }
.xref { color: #0a5a8a; text-decoration: none; border-bottom: 1px solid rgba(10,90,138,0.35); cursor: pointer; }
.xref:hover { color: #063a5a; border-bottom-color: #063a5a; }
@media print { .xref { color: inherit; border-bottom: none; } }

.callout { border-left: 3px solid #bbb; background: #f7f7f7; padding: 0.35em 0.6em 0.05em; margin: 0 0 0.5em; }
.callout-title { font-weight: 700; margin-bottom: 0.2em; }

.grid { width: 100%; border-collapse: collapse; margin: 0 0 0.55em; font-size: 0.94em; }
.grid th { background: ${accent}; color: #fff; text-align: left; font-weight: 600; font-size: 0.9em;
  padding: 0.25em 0.45em; letter-spacing: 0.02em; }
.grid td { border: 0.5px solid #c8c8c8; padding: 0.28em 0.45em; vertical-align: top; }
.grid tr { break-inside: avoid; page-break-inside: avoid; }
.grid thead { display: table-header-group; }
.grid.fill td { height: 2.1em; }
.grid.fill td:first-child { width: 42%; background: #f6f6f6; font-weight: 600; }
.steps .c-id { width: 3.6em; font-weight: 700; white-space: nowrap; }
.steps .c-box { width: 2.4em; text-align: center; }
.steps .sub-step { padding-left: 1.6em; }
.step-card { font-size: 0.86em; color: #555; margin-top: 0.15em; }
.box { display: inline-block; width: 1.05em; height: 1.05em; border: 1.2px solid #333; border-radius: 1px; vertical-align: middle; }
.levels th { width: 7.5em; background: #f0f0f0; color: #222; text-transform: capitalize; border: 0.5px solid #c8c8c8; }
.req .lvl { width: 32%; }

.hazards { border: 1px solid #c98a1a; background: #fff8ea; padding: 0.35em 0.6em 0.1em; }
.hazards > h2 { color: #8a5300; border-bottom-color: #e5c68f; }
.hazards ul { margin-bottom: 0.3em; }

.figs { display: grid; grid-template-columns: repeat(${card ? 1 : 2}, 1fr); gap: 0.6em; margin: 0.2em 0 0.6em; }
.figs figure { break-inside: avoid; page-break-inside: avoid; }
.figs img { display: block; width: 100%; max-height: ${card ? '2.6in' : '3.3in'}; object-fit: contain;
  background: #f4f4f4; border: 0.5px solid #ccc; }
.figs figcaption { font-size: 0.82em; color: #444; margin-top: 0.2em; }
.fig-none { border: 1px dashed #aaa; color: #666; font-size: 0.85em; padding: 0.6em; text-align: center; }

.eq-grid { display: grid; gap: 0.5em; margin-bottom: 0.3em; }
.eq-grid-sheet { grid-template-columns: repeat(3, 1fr); }
.eq-grid-card  { grid-template-columns: repeat(2, 1fr); }
.eq-grid figure { break-inside: avoid; page-break-inside: avoid; }
.eq-grid img { display: block; width: 100%; height: ${card ? '1.35in' : '1.9in'}; object-fit: contain;
  background: #f4f4f4; border: 0.5px solid #ccc; }
.eq-grid figcaption { font-size: 0.8em; color: #444; margin-top: 0.15em; }
.eq-grid a { cursor: zoom-in; }
.eq-whose { font-weight: 400; text-transform: none; letter-spacing: 0; color: #777; }
.eq-path { font-family: Consolas, 'Courier New', monospace; font-size: 0.78em; color: #666; word-break: break-all; }
a.eqopen { color: #0a5a8a; text-decoration: none; cursor: pointer; }
@media print { a.eqopen { color: inherit; } }

.issued { margin-top: 1.1em; break-inside: avoid; page-break-inside: avoid; }
.iss-row { display: flex; gap: 1.2em; margin-top: 0.9em; }
.iss-f { min-width: 0; }
.iss-line { border-bottom: 1px solid #444; height: 1.5em; }
.iss-f span { display: block; font-size: 0.74em; color: #555; margin-top: 0.12em; }

@media screen {
  html { background: #fff; }
  body { width: ${page.width}; padding: ${page.pad}; }
  .frame > thead, .frame > tfoot { display: none; }
  .foot { position: static; margin-top: 1.2em; }
}
`;
  }

  // ── The document ───────────────────────────────────────────────────────────
  //
  // note: { frontmatter, body } as vault:readNote returns them.
  // opts: { format: 'sheet'|'card', corpus, setup, vessel, printedAt,
  //         issuedLine, interactive, parseSteps, equipment, figures }
  function buildDocument(rec, note, opts) {
    opts = opts || {};
    const format = opts.format === 'card' ? 'card' : 'sheet';
    const fm     = (note && note.frontmatter) || {};
    const body   = (note && note.body) || '';
    const ctx    = {
      index: corpusIndex(opts.corpus || []),
      interactive: !!opts.interactive,
      parseSteps: opts.parseSteps || root.sopParseYamlSteps,
      figures: opts.figures || null
    };
    const setup  = opts.setup || {};

    const parts = [];
    parts.push(titleBlockHtml(rec, fm));

    const stub = !!rec.is_stub || /\[STUB\]/.test(body);
    if (stub) {
      parts.push(`<div class="stub"><strong>Not written yet.</strong> This ${esc(docKind(rec).toLowerCase())}
        is a seeded placeholder: it holds the number and the title so records and sign-offs
        resolve, and its body has not been authored.</div>`);
    }

    parts.push(fieldsHtml(rec, fm, format, ctx));
    parts.push(hazardsHtml(fm.hazards, ctx));
    if (rec.family === 'KSA') parts.push(hazardsHtml(fm.preconditions, ctx, 'Before starting'));
    if (format === 'sheet' || COMPETENCY.includes(rec.family)) parts.push(levelsHtml(fm.levels, ctx));
    parts.push(requiresHtml(fm.requires_ksa, ctx));
    parts.push(picturesHtml(opts.equipment, format, ctx));

    if (!stub) {
      const split = K ? K.bodySections(body) : { preamble: body, sections: [] };
      if (split.preamble) parts.push(`<section class="sec">${md(split.preamble, ctx)}</section>`);
      for (const s of split.sections) {
        if (!wantSection(rec, s.heading, format)) continue;
        // The one section a job card carries is its decomposition table, and on
        // the card that table is trimmed to Seq / Task / ✓.
        const sctx = (format === 'card' && /^task decomposition/i.test(String(s.heading).trim()))
          ? Object.assign({}, ctx, { decompose: true })
          : ctx;
        const html = md(s.text, sctx);
        if (!html.trim()) continue;
        parts.push(`<section class="sec"><h2>${inline(s.heading, ctx)}</h2>${html}</section>`);
      }
      // Sources in frontmatter (the knowledge and skill notes) are the evidence
      // behind the summary. The sheet carries them; the card does not.
      if (format === 'sheet') {
        const src = list(fm.sources);
        if (src.length) {
          parts.push(`<section class="sec"><h2>Sources</h2><ul>${src.map(v => `<li>${inline(v, ctx)}</li>`).join('')}</ul></section>`);
        }
      }
    }

    parts.push(equipmentDocsHtml(opts.equipment, format, ctx));
    if (opts.issuedLine) parts.push(issuedHtml(format));

    const label = shortId(rec.id) + ' — ' + plainTitle(rec.title);
    return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8">
<title>${esc(label)}</title>
<style>${styles(format, setup)}</style>
</head><body class="fmt-${format}">
<table class="frame">
  <thead><tr><td></td></tr></thead>
  <tfoot><tr><td><div class="foot-space"></div></td></tr></tfoot>
  <tbody><tr><td>
    ${letterheadHtml(rec, { setup, vessel: opts.vessel })}
    ${parts.filter(Boolean).join('\n')}
  </td></tr></tbody>
</table>
<div class="foot">${footerText(rec, fm, opts)}</div>
</body></html>`;
  }

  // A filename a mailbox or a folder of handouts can tell apart.
  function fileName(rec, format) {
    const base = (shortId(rec.id) + ' ' + plainTitle(rec.title))
      .replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ').trim().slice(0, 90);
    return base + (format === 'card' ? ' (card)' : '') + '.pdf';
  }

  const api = {
    SECTIONS, COMPETENCY, homeSection, competencyKind, docKind,
    search, buildDocument, fileName, wantSection, md, inline, corpusIndex, figureNames
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.navipediaCardsPrint = api;

})(typeof window !== 'undefined' ? window : globalThis);
