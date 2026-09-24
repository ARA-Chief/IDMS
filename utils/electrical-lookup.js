// ── Electrical Distribution — the lookup ─────────────────────────────────────
//
// Pure, no DOM, UMD (the ksa-view.js shape): the screen and
// tools/test-navipedia-electrical.js run the same code. docs/navipedia-electrical.md.
//
// A PORT of Roundtable's breaker-lookup (`,breaker` and `,panel`), not a
// rethink of it: roundtable/script-bank/breaker-lookup--*/breaker_lookup.py.
// The room and the Console are two doors onto the same panel mirror, and a
// person who asks both the same question must get the same answer. So the
// rules below are that script's rules, named the same where they can be:
//
//   - The query is AND across terms, OR inside a group (`lights or lighting`),
//     minus exclusions (`pump not bilge`, `pump -bilge`). Every term carries
//     the electricians' shorthand (`fuel` also finds `F.O.`).
//   - A component's supply comes first from the crosswalk (a linked breaker
//     cell), and only then from reading labels — and a label match is marked
//     unconfirmed, because the crosswalk has not confirmed it.
//   - A group is not a machine: it is descended, never answered with one
//     child's breaker.
//   - Several candidates are listed, never picked.
//   - Every answer that names a breaker carries the field-verify caveat.
//
// Where this differs, it differs by adding, not by answering differently: a
// panel's DOWNSTREAM tree (everything that loses power if it trips), the
// canonical space the panel sits in, and where that space is on a deck map.

(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.electricalLookup = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const CAVEAT = 'Field-verify at the panel — confirm the breaker actually drops the load before trusting it as an isolation point.';

  const EMPTY_LABELS = new Set(['', 'spare', 'blank', '_(unlabeled)_']);

  const SHORTHAND = {
    fuel: ['f.o.', 'fo'],
    oil: ['f.o.', 'l.o.', 'lo'],
    sea: ['s.w.', 'sw'],
    salt: ['s.w.', 'sw'],
    fresh: ['f.w.', 'fw'],
    water: ['s.w.', 'f.w.', 'sw', 'fw'],
    socket: ['skt', 'outlet'],
    outlet: ['skt', 'socket'],
    cable: ['cbl'],
    heating: ['cbl', 'heater'],
    number: ['#', 'no.'],
    lighting: ['light'],
    refrigeration: ['ref', 'fridge'],
    hydraulic: ['hyd'],
    ventilation: ['vent', 'fan']
  };

  const SHORT_OK = new Set(['fo', 'sw', 'fw', 'lo', 'hw', 'ac', 'dc', 'no', '#1', '#2', '#3']);
  const CODE_RE  = /^\d[\d.]*$/;
  const STEM = 4;

  function fold(s) {
    return String(s == null ? '' : s).normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase();
  }

  const isEmptyLabel = l => EMPTY_LABELS.has(fold(l).trim());

  // ── Query ─────────────────────────────────────────────────────────────────
  class Query {
    constructor(raw) {
      this.raw = String(raw || '').trim();
      this.groups = [];
      this.excludes = [];
      let pendingOr = false, negateNext = false;
      for (const token of fold(this.raw).split(/\s+/)) {
        if (!token) continue;
        if (token === 'or' || token === '|') { pendingOr = true; continue; }
        if (token === 'and' || token === '&') continue;
        if (token === 'not' || token === '!') { negateNext = true; continue; }
        const neg = negateNext || token.startsWith('-');
        negateNext = false;
        const term = token.replace(/^-+/, '').replace(/[^\w#.]+/g, '').replace(/^\.+|\.+$/g, '');
        if (!term || (term.length < 3 && !SHORT_OK.has(term))) { pendingOr = false; continue; }
        if (neg) { this.excludes.push(term); pendingOr = false; continue; }
        const alts = [term, ...(SHORTHAND[term] || [])];
        if (pendingOr && this.groups.length) {
          const g = this.groups[this.groups.length - 1];
          for (const a of alts) if (!g.includes(a)) g.push(a);
        } else {
          this.groups.push(alts);
        }
        pendingOr = false;
      }
    }
    get empty() { return !this.groups.length; }
    matches(text) {
      const f = fold(text);
      if (this.excludes.some(x => f.includes(x))) return false;
      return this.groups.every(g => g.some(a => f.includes(a)));
    }
    without(i) {
      const q = new Query('');
      q.raw = this.raw;
      q.groups = this.groups.filter((_, j) => j !== i);
      q.excludes = this.excludes.slice();
      return q;
    }
    // Which term, left out, would find something — and how much. One wrong
    // word empties an AND and a bare "not found" does not say which.
    blocking(texts) {
      if (this.groups.length < 2) return [];
      const out = [];
      this.groups.forEach((g, i) => {
        const sub = this.without(i);
        const n = texts.filter(t => sub.matches(t)).length;
        if (n) out.push({ group: g, index: i, count: n });
      });
      return out.sort((a, b) => a.count - b.count);
    }
    deadTerms(texts) {
      const folded = texts.map(fold);
      return this.groups.filter(g => !folded.some(f => g.some(a => f.includes(a))));
    }
    describe() {
      const parts = this.groups.map(g => g.map(a => `"${a}"`).join(' or '));
      let out = parts.map(p => (p.includes(' or ') ? `(${p})` : p)).join(' and ');
      if (this.excludes.length) out += ' not ' + this.excludes.map(x => `"${x}"`).join(' ');
      return out || `"${this.raw}"`;
    }
  }

  function nearWords(term, texts) {
    const head = term.slice(0, STEM);
    if (head.length < STEM) return [];
    const seen = new Set();
    for (const t of texts) {
      for (const w of fold(t).split(/[^\w#]+/)) {
        if (w.length >= STEM && w !== term && w.startsWith(head)) seen.add(w);
      }
    }
    return [...seen].sort().slice(0, 6);
  }

  // ── Where a panel is, inside its room ─────────────────────────────────────
  //
  // The schedule's Position column is words — "Starboard Forward", "Aft
  // Console, Below", "Forward Chart Table". Read the two axes it can state and
  // keep the rest as words: a dot placed on a guess is worse than a sentence.
  function roomPosition(text) {
    const f = fold(text);
    const word = w => new RegExp('\\b' + w + '\\b').test(f);
    let fa = null, ps = null;
    if (word('forward') || word('fwd')) fa = 'fwd';
    else if (word('aft')) fa = 'aft';
    else if (word('midship') || word('mid') || word('midships')) fa = 'mid';
    if (word('starboard') || word('stbd')) ps = 'stbd';
    else if (word('port')) ps = 'port';
    else if (word('center') || word('centre') || word('centerline')) ps = 'center';
    if (fa === null && ps === 'center' && word('midship')) fa = 'mid';
    return { fa, ps };
  }

  // ── The index ─────────────────────────────────────────────────────────────
  function build(model) {
    const panels = (model && model.panels) || [];
    const byName = new Map(panels.map(p => [p.name, p]));

    // Every way a person writes a panel, folded: the note key, the schedule's
    // own key, the aliases, the H1's bracketed form. Only an unambiguous
    // spelling is kept — two panels answering to one name is a question, not
    // a lookup.
    const spellings = new Map();
    const addSpelling = (s, p) => {
      const k = fold(s).replace(/\s+/g, ' ').trim();
      if (!k) return;
      const had = spellings.get(k);
      if (had === undefined) spellings.set(k, p);
      else if (had !== p) spellings.set(k, null);
    };
    for (const p of panels) {
      addSpelling(p.name, p); addSpelling(p.panel, p); addSpelling(p.display, p);
      for (const a of p.aliases) addSpelling(a, p);
      const inner = (p.display.match(/\((.+)\)$/) || [])[1];
      if (inner) addSpelling(inner, p);
      addSpelling(p.name.replace(/-/g, '/'), p);
      addSpelling(p.name.replace(/\s+/g, ''), p);
    }
    const resolvePanel = q => {
      const k = fold(q).replace(/\s+/g, ' ').trim();
      if (byName.has(q)) return byName.get(q);
      const hit = spellings.get(k) || spellings.get(k.replace(/\s+/g, ''));
      return hit || null;
    };

    // Downstream: the inverse of every Fed from line.
    const feeds = new Map();
    for (const p of panels) {
      for (const f of p.fedFrom) {
        if (!feeds.has(f.panel)) feeds.set(f.panel, []);
        feeds.get(f.panel).push({ panel: p.name, br: f.br, label: f.label });
      }
    }
    for (const list of feeds.values()) list.sort((a, b) => a.br - b.br);

    // Component note -> the breakers the crosswalk linked to it. The same
    // lines the component note prints as its Power supply section.
    const supply = new Map();
    for (const p of panels) {
      for (const b of p.breakers) {
        for (const l of b.links) {
          if (l.kind !== 'component') continue;
          if (!supply.has(l.note)) supply.set(l.note, []);
          supply.get(l.note).push({ panel: p.name, br: b.no, label: b.label });
        }
      }
    }

    const equipment = (model && model.equipment) || [];
    const equipByNote = new Map(equipment.map(r => [r.note, r]));

    // Spaces: "Deck|Room" as the panel schedule writes it -> Space Register ids.
    const spaces = (model && model.spaces) || {};
    const roomSpaces = new Map();
    for (const s of Object.values(spaces)) {
      for (const k of s.panelRooms || []) {
        const key = fold(k);
        if (!roomSpaces.has(key)) roomSpaces.set(key, []);
        if (!roomSpaces.get(key).includes(s.id)) roomSpaces.get(key).push(s.id);
      }
    }
    const maps = (model && model.maps) || [];

    const labels = [];
    for (const p of panels) for (const b of p.breakers) if (!isEmptyLabel(b.label)) labels.push({ panel: p, b });
    const labelTexts = labels.map(x => x.b.label);

    return {
      model, panels, byName, resolvePanel, feeds, supply, equipment, equipByNote,
      spaces, roomSpaces, maps, labels, labelTexts
    };
  }

  // ── Location ──────────────────────────────────────────────────────────────
  function locate(ix, panel) {
    const ids = ix.roomSpaces.get(fold(`${panel.deck}|${panel.room}`)) || [];
    const spaces = ids.map(id => ix.spaces[id]).filter(Boolean);
    let map = null;
    for (const m of ix.maps) {
      const id = ids.find(i => m.spaces[i]);
      if (id) { map = { name: m.name, image: m.image, aspect: m.aspect, space: id, rect: m.spaces[id] }; break; }
    }
    const deck = spaces[0] ? spaces[0].deck : panel.deck;
    return {
      deck, room: panel.room, position: panel.position, spaces, map,
      // P407 and UPS are on no Summary row: the schedule sheet's own heading
      // ("Workshop", "Aux Gen Room") is then the only word on where they are.
      where: [panel.deck, panel.room, panel.position].filter(Boolean).join(' · ')
        || (panel.scheduleLocation ? `schedule sheet says “${panel.scheduleLocation}”` : 'location not recorded'),
      inRoom: roomPosition(panel.position)
    };
  }

  // ── Trees ─────────────────────────────────────────────────────────────────
  // Full, not truncated — the room's script prints all of it, because "cite the
  // chain as far as the job needs" is a person's judgement. `seen` guards a
  // loop a future export might introduce; there is none today.
  function upstream(ix, name, seen = []) {
    const p = ix.byName.get(name);
    if (!p) return [];
    return p.fedFrom.map(f => {
      const loop = seen.includes(f.panel) || f.panel === name;
      return {
        panel: f.panel, br: f.br, label: f.label,
        known: ix.byName.has(f.panel), loop,
        up: loop ? [] : upstream(ix, f.panel, seen.concat(name))
      };
    });
  }

  function downstream(ix, name, seen = []) {
    return (ix.feeds.get(name) || []).map(f => {
      const loop = seen.includes(f.panel) || f.panel === name;
      return { panel: f.panel, br: f.br, label: f.label, loop, down: loop ? [] : downstream(ix, f.panel, seen.concat(name)) };
    });
  }

  // Everything that goes dark with a panel: its own labelled breakers, and the
  // labelled breakers of every panel beneath it. A panel fed from two sources
  // may stay alive on the other — the tree says so, the count does not pretend.
  function downstreamLoad(ix, name) {
    const out = { panels: new Set(), circuits: 0, multiFed: new Set() };
    (function walk(n, seen) {
      for (const d of ix.feeds.get(n) || []) {
        if (seen.includes(d.panel) || out.panels.has(d.panel)) continue;
        out.panels.add(d.panel);
        const p = ix.byName.get(d.panel);
        if (p) {
          out.circuits += p.breakers.filter(b => !isEmptyLabel(b.label)).length;
          if (p.fedFrom.length > 1) out.multiFed.add(d.panel);
        }
        walk(d.panel, seen.concat(n));
      }
    })(name, []);
    return { panels: [...out.panels], circuits: out.circuits, multiFed: [...out.multiFed] };
  }

  // ── Questions ─────────────────────────────────────────────────────────────

  // `LP3 23`, `LP3 br 23`, `P405 breaker 4` — a panel and a position. Only the
  // panel list can tell that from `washing machine 1`.
  function parseBreakerRef(ix, text) {
    const m = String(text || '').trim().match(/^(.*?)[\s,]+(?:br|breaker|cb|#)?\s*(\d+)$/i);
    if (!m) return null;
    const p = ix.resolvePanel(m[1].trim());
    return p ? { panel: p, br: Number(m[2]) } : null;
  }

  function serves(ix, panelName, br) {
    const p = ix.byName.get(panelName);
    if (!p) return { found: false, reason: 'no-panel' };
    const b = p.breakers.find(x => x.no === br);
    const cited = p.citedBy.filter(c => c.brs.includes(br)).map(c => c.note);
    if (p.locationOnly) return { found: true, panel: p, breaker: null, locationOnly: true, cited };
    if (!b) {
      const nums = p.breakers.map(x => x.no);
      return { found: false, reason: 'no-position', panel: p, held: nums.length ? `1–${Math.max(...nums)}` : 'none' };
    }
    return {
      found: true, panel: p, breaker: b, empty: isEmptyLabel(b.label),
      components: b.links.filter(l => l.kind === 'component').map(l => l.note),
      feedsPanels: b.links.filter(l => l.kind === 'panel').map(l => l.panel)
        .concat((ix.feeds.get(p.name) || []).filter(f => f.br === br).map(f => f.panel))
        .filter((v, i, a) => a.indexOf(v) === i),
      cited
    };
  }

  function nameOf(row) { return row.name || row.note; }

  function findComponents(ix, query) {
    const q = fold(String(query || '').trim());
    if (!q) return [];
    if (CODE_RE.test(q)) {
      const exact = ix.equipment.filter(r => r.code === q);
      if (exact.length) return exact;
      return ix.equipment.filter(r => fold(r.note).includes(q));
    }
    const parsed = new Query(query);
    if (parsed.empty) return [];
    return ix.equipment.filter(r => parsed.matches(r.note));
  }

  // Beneath a group: every note at the group's own code or under it that the
  // crosswalk gave a supply. Same-code siblings count — `702.005 F.O.
  // separator` and `702.005 Replacement FO Separator - Westfalia` share a code,
  // and the replacement is the one with the breaker.
  function childrenWithSupply(ix, row) {
    const out = [];
    for (const r of ix.equipment) {
      if (r === row) continue;
      if (!(r.code === row.code || r.code.startsWith(row.code + '.'))) continue;
      const s = ix.supply.get(r.note);
      if (s) out.push({ component: r, supply: s });
    }
    return out;
  }

  function searchLabels(ix, subject) {
    const q = new Query(subject);
    if (q.empty) return { hits: [], q };
    const hits = ix.labels.filter(x => q.matches(x.b.label))
      .map(x => ({ panel: x.panel.name, br: x.b.no, label: x.b.label }));
    return { hits, q };
  }

  // "What feeds this?" — the room's `panels-for`, shaped for a screen: every
  // panel it is fed from, crosswalked links first, each breaker marked with
  // how it was found. `component` is the register row a person picked, when
  // they picked one; `query` is what they typed.
  function feedsOf(ix, { query, component } = {}) {
    const typed = String(query || (component && component.note) || '').trim();
    const notes = component ? [component] : findComponents(ix, typed);
    const found = new Map();   // panel -> rows
    const add = (panel, br, label, how, via) => {
      if (!found.has(panel)) found.set(panel, []);
      const rows = found.get(panel);
      const had = rows.find(r => r.br === br);
      if (had) { if (how === 'crosswalked') { had.how = how; had.via = via || had.via; } return; }
      rows.push({ br, label, how, via: via || null });
    };

    let group = null;
    const linked = [];
    for (const r of notes) {
      const s = ix.supply.get(r.note);
      if (s) { linked.push(r); for (const x of s) add(x.panel, x.br, x.label, 'crosswalked', r.note); }
    }
    if (notes.length === 1 && notes[0].group && !linked.length) {
      group = { component: notes[0], children: childrenWithSupply(ix, notes[0]) };
      for (const c of group.children) for (const x of c.supply) add(x.panel, x.br, x.label, 'crosswalked', c.component.note);
    }

    // A bare code is in no label; search the component's own name instead.
    const subject = (component || (notes.length && CODE_RE.test(typed))) ? nameOf(component || notes[0]) : typed;
    const { hits, q } = searchLabels(ix, subject);
    for (const h of hits) add(h.panel, h.br, h.label, 'label');

    const rank = ([name, rows]) => [rows.some(r => r.how === 'crosswalked') ? 0 : 1, name];
    const panels = [...found.entries()]
      .sort((a, b) => {
        const ra = rank(a), rb = rank(b);
        return ra[0] - rb[0] || ra[1].localeCompare(rb[1], undefined, { numeric: true });
      })
      .map(([name, rows]) => ({ panel: name, rows: rows.sort((a, b) => a.br - b.br) }));

    let diagnosis = null;
    if (!panels.length && !q.empty) {
      const blocking = q.blocking(ix.labelTexts);
      const dead = q.deadTerms(ix.labelTexts);
      diagnosis = blocking.map(b => {
        const isDead = dead.includes(b.group);
        const sub = q.without(b.index);
        return {
          terms: b.group, count: b.count, dead: isDead,
          near: isDead ? nearWords(b.group[0], ix.labelTexts) : [],
          sample: b.count <= 3
            ? ix.labels.filter(x => sub.matches(x.b.label)).map(x => ({ panel: x.panel.name, br: x.b.no, label: x.b.label }))
            : []
        };
      });
    }

    return {
      query: typed, subject, searched: q.describe(), panelCount: ix.panels.length,
      register: notes, linked, group, panels, diagnosis,
      multiPanel: panels.length > 1
    };
  }

  // ── Autocomplete ──────────────────────────────────────────────────────────
  //
  // Panels by name first (a panel name is short and exact), then a panel and
  // position, then register components — the ones the crosswalk gave a breaker
  // ahead of the ones it did not — then breaker labels. Returned in groups so
  // the list can say what each hit is.
  function suggest(ix, text, { limit = 14 } = {}) {
    const raw = String(text || '').trim();
    if (!raw) return [];
    const f = fold(raw).replace(/\s+/g, ' ');
    const out = [];
    const seen = new Set();
    const push = (h) => { if (!seen.has(h.key)) { seen.add(h.key); out.push(h); } };

    // A whole panel name wins over "panel + position": `ups 205` is UPS205,
    // not position 205 on UPS.
    const exact = ix.resolvePanel(raw);
    if (exact) push({ kind: 'panel', key: `p:${exact.name}`, panel: exact.name });

    const ref = exact ? null : parseBreakerRef(ix, raw);
    let unheld = null;
    if (ref) {
      const b = ref.panel.breakers.find(x => x.no === ref.br);
      const hit = { kind: 'breaker', key: `b:${ref.panel.name}:${ref.br}`, panel: ref.panel.name, br: ref.br,
                    label: b ? b.label : '', held: !!b };
      // A position the schedule does not hold is still an answer ("LP3 has no
      // br 99"), but it goes last, behind anything that is real.
      if (b || ref.panel.locationOnly) push(hit); else unheld = hit;
    }
    const flat = f.replace(/[\s/-]/g, '');
    for (const p of ix.panels) {
      const names = [p.name, p.display, ...p.aliases].map(n => fold(n).replace(/[\s/-]/g, ''));
      if (names.some(n => n.startsWith(flat))) push({ kind: 'panel', key: `p:${p.name}`, panel: p.name });
    }
    // A panel prefix with a trailing number: `lp3 2` lists LP3's 2, 20–29.
    const pm = raw.match(/^(.*?)[\s,]+(?:br|breaker)?\s*(\d+)$/i);
    const pp = pm && ix.resolvePanel(pm[1]);
    if (pp) {
      for (const b of pp.breakers) {
        if (String(b.no).startsWith(pm[2]) && b.no !== Number(pm[2])) {
          push({ kind: 'breaker', key: `b:${pp.name}:${b.no}`, panel: pp.name, br: b.no, label: b.label, held: true });
        }
      }
    }

    const comps = findComponents(ix, raw);
    const withSupply = comps.filter(r => ix.supply.has(r.note));
    const groups = comps.filter(r => !ix.supply.has(r.note) && r.group);
    const rest = comps.filter(r => !ix.supply.has(r.note) && !r.group);
    for (const r of withSupply) push({ kind: 'component', key: `c:${r.note}`, component: r, supply: ix.supply.get(r.note) });

    const q = new Query(raw);
    if (!q.empty) {
      for (const x of ix.labels) {
        if (!q.matches(x.b.label)) continue;
        push({ kind: 'breaker', key: `b:${x.panel.name}:${x.b.no}`, panel: x.panel.name, br: x.b.no, label: x.b.label, held: true });
      }
    }
    for (const r of groups) push({ kind: 'component', key: `c:${r.note}`, component: r, supply: null });
    for (const r of rest) push({ kind: 'component', key: `c:${r.note}`, component: r, supply: null });

    if (unheld) push(unheld);
    const total = out.length;
    const shown = out.slice(0, limit);
    // The free-text search is always offered: "everything that names this"
    // is the question when no single hit is the answer.
    if (!exact && !ref) shown.push({ kind: 'search', key: `s:${raw}`, query: raw, total });
    return shown;
  }

  return {
    CAVEAT, SHORTHAND, Query, fold, isEmptyLabel, nearWords, roomPosition,
    build, locate, upstream, downstream, downstreamLoad,
    parseBreakerRef, serves, findComponents, childrenWithSupply, searchLabels, feedsOf, suggest
  };
});
