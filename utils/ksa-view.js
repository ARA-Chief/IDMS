'use strict';

// ── Competency notes: the formatted view ─────────────────────────────────────
//
// The Job Mapping KSA tab holds four families — KSA cards, KNG knowledge, SKG
// global skills, SKD vessel skills — and every one of them used to open as a
// single textarea of Markdown, while a Task or a Job opened in the card
// editor's sections. The reason given was true as far as it went: these four do
// not share the card's section shape, and a structured *editor* over a shape it
// did not know would have been worse than the textarea.
//
// But "does not fit the card editor" is not "has no shape". These families
// state theirs twice — once in the `##` headings of the body, and once in the
// frontmatter fields that carry what the note requires, what it is assessed
// against, and what it was written from. So this renders them, read-only, in
// the card editor's own section shell, and the frontmatter's structured fields
// become sections of their own rather than YAML the reader has to parse by eye.
//
// Read-only is the whole design. Nothing here writes: the source textarea is
// one click away, is still the only thing that saves, and is still gated on a
// Change Log entry. A view that cannot save cannot corrupt a note, which is
// what lets this file be as loose about the vault's dialect as it is.
//
// Pure and self-contained, so `tools/test-ksa-view.js` can run it over the real
// corpus in node. It knows nothing about JM, the DOM or the vault — the caller
// hands it the note text and the corpus to resolve links against.

(function (root) {

  var LEVEL_ORDER = ['aware', 'supervised', 'independent', 'assessor'];

  // The frontmatter fields that carry structure. Everything else in the block
  // is either shown in the panel header already (title, revision, status) or is
  // bookkeeping the reader does not need (uuid, source_rows).
  var FIELD_SECTIONS = [
    { key: 'validity',            label: 'Validity' },
    { key: 'recency',             label: 'Recency' },
    { key: 'external_credential', label: 'External credential' }
  ];

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // SOP-0007, KSA-P001, TASK-G04, JOB-601.001 — the code, however the lane
  // writes it. Same test the list and the card editor use.
  function shortId(id) {
    var m = String(id || '').match(/^([A-Za-z]{2,4}-[A-Za-z]?[0-9]+(?:\.[0-9]+)*)/);
    return m ? m[1] : String(id || '');
  }

  function plainTitle(title) {
    return String(title || '').replace(/^[A-Za-z]{3}-[\w.-]+\s*[—-]\s*/, '').trim();
  }

  function unquote(v) {
    var s = String(v == null ? '' : v).trim();
    if ((s.charAt(0) === '"' && s.slice(-1) === '"') ||
        (s.charAt(0) === "'" && s.slice(-1) === "'")) return s.slice(1, -1);
    return s;
  }

  // ── The note, split ─────────────────────────────────────────────────────────
  //
  // Frontmatter comes back as lines rather than as parsed YAML. The one YAML
  // reader this corpus gets lives in main/vault-corpus.js, and a second one
  // here would be free to disagree with it about a note nobody had looked at.
  // What this view needs is narrower anyway — the value of a named key, as a
  // scalar, a list or a map — which is how sop-editor.js reads `requires_ksa`
  // off a card too.
  //
  // The BOM and the trailing \r are the two traps: all 48 KNG notes are written
  // with a BOM, which hides the opening `---` from a startsWith test, and 153
  // notes in the vault are CRLF, which leaves a \r on the last frontmatter line.
  function splitNote(text) {
    var t = String(text == null ? '' : text);
    var s = t.charCodeAt(0) === 0xFEFF ? t.slice(1) : t;
    if (s.indexOf('---') !== 0) return { fm: [], body: s };
    var end = s.indexOf('\n---', 3);
    if (end === -1) return { fm: [], body: s };
    return {
      fm:   s.slice(s.indexOf('\n') + 1, end).replace(/\r$/, '').split(/\r?\n/),
      body: s.slice(end + 4).replace(/^\r?\n/, '')
    };
  }

  function fmIndex(fm, key) {
    for (var i = 0; i < fm.length; i++) {
      if (fm[i].indexOf(key + ':') === 0) return i;
    }
    return -1;
  }

  function fmScalar(fm, key) {
    var i = fmIndex(fm, key);
    return i === -1 ? '' : unquote(fm[i].slice(key.length + 1));
  }

  // A key with nothing after it opens either a list or a map — the lines below
  // it decide which, exactly as the vault's own reader has it.
  function fmList(fm, key) {
    var i = fmIndex(fm, key);
    if (i === -1) return [];
    var inline = fm[i].slice(key.length + 1).trim();
    if (inline) {
      var flow = inline.match(/^\[(.*)\]$/);
      if (!flow) return [unquote(inline)];
      return flow[1].trim() ? flow[1].split(',').map(unquote) : [];
    }
    var out = [];
    for (var j = i + 1; j < fm.length; j++) {
      var item = fm[j].match(/^\s+-\s+(.*)$/);
      if (!item) break;
      out.push(unquote(item[1]));
    }
    return out;
  }

  function fmMap(fm, key) {
    var i = fmIndex(fm, key);
    if (i === -1 || fm[i].slice(key.length + 1).trim()) return [];
    var out = [];
    for (var j = i + 1; j < fm.length; j++) {
      var kv = fm[j].match(/^\s+([\w-]+):\s*(.*)$/);
      if (!kv) break;
      out.push([kv[1], unquote(kv[2])]);
    }
    return out;
  }

  // One `requires_ksa` entry, in either of the two shapes the corpus writes:
  //
  //   "[[KSA-T001-torque-wrench]]: independent"              the SOP cards'
  //   "[[KSA-T001-torque-wrench]] at supervised or better"   the KSA cards'
  //
  // The link is the competency; whatever follows it is the qualifier, and it is
  // shown as written rather than folded into the four-level vocabulary. The
  // second shape is a sentence, and rewriting it as `supervised` would be a
  // reading of it presented as the note's own words.
  function parseRequires(raw) {
    var s = String(raw == null ? '' : raw).trim();
    var m = s.match(/\[\[([^\]|]+)(?:\|[^\]]*)?\]\]\s*:?\s*(.*)$/)
         || s.match(/^([A-Za-z]{3}-[\w.-]+)\s*:?\s*(.*)$/);
    if (!m) return { id: '', note: s };
    return { id: m[1].trim(), note: (m[2] || '').trim() };
  }

  // ── Markdown ────────────────────────────────────────────────────────────────
  //
  // A renderer for what these four families actually write: paragraphs, bullet
  // and numbered lists, bold, italics, code spans and wikilinks. Not tables,
  // callouts or fenced code — the 244 notes in these ranges contain none of the
  // three, and a branch for them would be untested code standing in front of
  // the reader. Anything outside the set falls through as text, which is the
  // right failure for a document this view cannot edit.
  //
  // ESCAPE FIRST, ALWAYS. These files come off a share many people write to; a
  // note is data, not markup we authored. Every character is escaped before a
  // single tag is added, so the only HTML in the output is the HTML put here.
  function md(src) {
    if (!src || !String(src).trim()) return '';
    var lines = esc(src).replace(/\r\n?/g, '\n').split('\n');
    var out = [];
    var i = 0;

    var inline = function (s) {
      return s
        // Wikilinks are navigation inside Obsidian, not links this pane can
        // follow, so they render as their label rather than as dead anchors.
        .replace(/\[\[([^\]|]+)\|([^\]]*)\]\]/g, '<span class="ksa-wiki">$2</span>')
        .replace(/\[\[([^\]]+)\]\]/g, '<span class="ksa-wiki">$1</span>')
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        .replace(/(^|[\s(])\*([^*\n]+)\*/g, '$1<em>$2</em>');
    };

    var BULLET   = /^[-*+]\s+(.*)$/;
    var NUMBERED = /^\d+[.)]\s+(.*)$/;
    var starts = function (l) {
      return !l.trim() || BULLET.test(l) || NUMBERED.test(l)
          || /^#{1,6}\s/.test(l) || /^(-{3,}|\*{3,}|_{3,})$/.test(l.trim());
    };

    while (i < lines.length) {
      var line = lines[i];

      if (!line.trim()) { i++; continue; }

      if (/^(-{3,}|\*{3,}|_{3,})$/.test(line.trim())) { out.push('<hr>'); i++; continue; }

      var h = /^(#{1,6})\s+(.*)$/.exec(line);
      if (h) {
        // The section's own `##` heading is already the block's title, so
        // anything left inside it is a sub-heading whatever depth it claims.
        out.push('<div class="ksa-md-h">' + inline(h[2]) + '</div>');
        i++;
        continue;
      }

      var bullet = BULLET.exec(line), numbered = NUMBERED.exec(line);
      if (bullet || numbered) {
        var ordered = !!numbered;
        var re = ordered ? NUMBERED : BULLET;
        var items = [];
        while (i < lines.length) {
          var m = re.exec(lines[i]);
          if (!m) break;
          // The corpus wraps a long item onto indented continuation lines. They
          // belong to the item above them, not to a paragraph of their own —
          // an item split across two blocks reads as a sentence cut in half.
          var text = [m[1]];
          i++;
          while (i < lines.length && /^\s+\S/.test(lines[i]) && !starts(lines[i].trim())) {
            text.push(lines[i].trim());
            i++;
          }
          items.push('<li>' + inline(text.join(' ')) + '</li>');
        }
        out.push('<' + (ordered ? 'ol' : 'ul') + '>' + items.join('') + '</' + (ordered ? 'ol' : 'ul') + '>');
        continue;
      }

      var para = [];
      while (i < lines.length && !starts(lines[i])) { para.push(lines[i].trim()); i++; }
      if (para.length) out.push('<p>' + inline(para.join(' ')) + '</p>');
      else i++;
    }

    return out.join('\n');
  }

  // ── The body, in sections ───────────────────────────────────────────────────
  //
  // Split on `## ` headings; `###` and deeper stay inside their section, the
  // same cut the card editor makes. The H1 is dropped — the panel header states
  // the code and the title already, and the notes say it again in their first
  // line, badly, with the code welded on.
  function bodySections(body) {
    var lines = String(body == null ? '' : body).replace(/\r\n?/g, '\n').split('\n');
    var sections = [];
    var preamble = [];
    var cur = null;
    for (var i = 0; i < lines.length; i++) {
      var h = lines[i].match(/^##\s+(.*)$/);
      if (h) {
        cur = { heading: h[1].trim(), lines: [] };
        sections.push(cur);
        continue;
      }
      if (cur) cur.lines.push(lines[i]);
      else if (!/^#\s/.test(lines[i])) preamble.push(lines[i]);
    }
    return {
      preamble: preamble.join('\n').trim(),
      sections: sections.map(function (s) {
        return { heading: s.heading, text: s.lines.join('\n').trim() };
      })
    };
  }

  // ── Blocks ──────────────────────────────────────────────────────────────────

  function sectionHtml(title, bodyHtml, tag) {
    return '' +
      '<section class="sop-sec">' +
        '<div class="sop-sec-head">' +
          '<span class="sop-sec-title">' + esc(title) + '</span>' +
          (tag ? '<span class="sop-sec-tag sop-sec-tag--dim">' + esc(tag) + '</span>' : '') +
        '</div>' +
        '<div class="sop-sec-body">' +
          (bodyHtml || '<div class="sop-empty">Nothing stated.</div>') +
        '</div>' +
      '</section>';
  }

  function listHtml(items) {
    if (!items.length) return '';
    return '<div class="ksa-md"><ul>' + items.map(function (t) {
      return '<li>' + md(t).replace(/^<p>|<\/p>$/g, '') + '</li>';
    }).join('') + '</ul></div>';
  }

  // The level ladder, in the vault's order rather than the file's. A note that
  // states them out of order still reads bottom-to-top here, because the ladder
  // is the point: what "supervised" means is only legible next to what
  // "independent" means.
  function levelsHtml(pairs) {
    if (!pairs.length) return '';
    var seen = {};
    pairs.forEach(function (p) { seen[p[0]] = p[1]; });
    var order = LEVEL_ORDER.filter(function (l) { return l in seen; })
      .concat(pairs.map(function (p) { return p[0]; })
        .filter(function (l) { return LEVEL_ORDER.indexOf(l) === -1; }));
    return '<div class="ksa-levels">' + order.map(function (l) {
      return '<div class="ksa-level">' +
        '<span class="ksa-level-name">' + esc(l) + '</span>' +
        '<span class="ksa-level-text">' + (seen[l] ? md(seen[l]).replace(/^<p>|<\/p>$/g, '') : '—') + '</span>' +
      '</div>';
    }).join('') + '</div>';
  }

  // Required competencies, listed the way a card lists them — family, code,
  // title, and the qualifier the note stated. A link that resolves to nothing
  // says so: "not in the corpus" and "no competency required" are different
  // answers, and a silently dropped row would show the second for the first.
  function requiresHtml(entries, corpus) {
    if (!entries.length) return '';
    return entries.map(function (raw) {
      var e   = parseRequires(raw);
      var rec = null;
      for (var i = 0; i < corpus.length; i++) {
        if (corpus[i].id === e.id) { rec = corpus[i]; break; }
      }
      var fam = rec ? rec.family : (e.id ? e.id.slice(0, e.id.indexOf('-')) : '?');
      return '<div class="sop-ksa-row">' +
        '<span class="sop-ksa-fam">' + esc(fam) + '</span>' +
        '<code>' + esc(e.id ? shortId(e.id) : '—') + '</code>' +
        '<span class="sop-ksa-title">' + esc(rec ? plainTitle(rec.title) : '') + '</span>' +
        (rec ? '' : '<span class="sop-step-missing">not in the corpus</span>') +
        (e.note ? '<span class="ksa-req-note">' + esc(e.note) + '</span>' : '') +
      '</div>';
    }).join('');
  }

  function fieldsHtml(fm) {
    var rows = FIELD_SECTIONS.map(function (f) {
      var v = fmScalar(fm, f.key);
      return v ? { label: f.label, value: v } : null;
    }).filter(Boolean);
    if (!rows.length) return '';
    return '<div class="jm-meta-grid" style="margin-bottom:0">' + rows.map(function (r) {
      return '<div>' +
        '<div class="task-detail-field-label">' + esc(r.label) + '</div>' +
        '<div class="task-detail-field-value">' + esc(r.value) + '</div>' +
      '</div>';
    }).join('') + '</div>';
  }

  // ── The view ────────────────────────────────────────────────────────────────
  //
  // Frontmatter structure first — what this competency requires and is measured
  // by — then the note's own prose, then what it was written from. That is the
  // order the reader needs them in: a card is opened to answer "what does
  // someone have to be able to do", and the citations are the audit trail
  // behind the answer rather than part of it.
  function noteHtml(rec, text, corpus) {
    var split = splitNote(text);
    var fm    = split.fm;
    var body  = bodySections(split.body);
    var list  = corpus || [];
    var parts = [];

    if (/\[STUB\]/.test(split.body)) {
      parts.push(
        '<div class="sop-kind-note">' +
          'This note is a <strong>seeded stub</strong> — it holds the id and the title so ' +
          'sign-offs and links resolve, and its body has not been authored yet. What the ' +
          'import knew is below; the rest is written in the source.' +
        '</div>');
    }

    var levels = fmMap(fm, 'levels');
    if (levels.length) parts.push(sectionHtml('Levels', levelsHtml(levels)));

    var requires = fmList(fm, 'requires_ksa');
    if (requires.length) {
      parts.push(sectionHtml('Requires — other competencies', requiresHtml(requires, list)));
    }

    var fields = fieldsHtml(fm);
    if (fields) parts.push(sectionHtml('Validity and recency', fields));

    var hazards = fmList(fm, 'hazards');
    if (hazards.length) parts.push(sectionHtml('Hazards', listHtml(hazards)));

    var pre = fmList(fm, 'preconditions');
    if (pre.length) parts.push(sectionHtml('Preconditions', listHtml(pre)));

    if (body.preamble) parts.push('<div class="ksa-md ksa-preamble">' + md(body.preamble) + '</div>');

    body.sections.forEach(function (s) {
      var html = md(s.text);
      // An empty section is a real state in this corpus — a heading authored
      // ahead of the words under it — and it is said rather than shown as a
      // blank block, which reads as a rendering failure.
      parts.push(sectionHtml(s.heading, html ? '<div class="ksa-md">' + html + '</div>' : ''));
    });

    var sources = fmList(fm, 'sources');
    if (sources.length) {
      parts.push(sectionHtml('Sources', listHtml(sources), 'from the frontmatter'));
    }

    if (!parts.length) {
      return '<div class="sop-empty">' +
        'This note has no sections and no structured frontmatter — everything it says is in ' +
        'the source.</div>';
    }
    return parts.join('\n');
  }

  var api = {
    noteHtml:      noteHtml,
    splitNote:     splitNote,
    fmScalar:      fmScalar,
    fmList:        fmList,
    fmMap:         fmMap,
    parseRequires: parseRequires,
    bodySections:  bodySections,
    md:            md,
    shortId:       shortId,
    plainTitle:    plainTitle,
    LEVEL_ORDER:   LEVEL_ORDER
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.ksaView = api;

})(typeof window !== 'undefined' ? window : this);
