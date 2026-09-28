// ── LO/TO Assistance — the isolation points for one component ───────────────
//
// Pure, no DOM, UMD (the electrical-lookup.js shape): the Console screen, the
// phone (IDMS/navipedia.html, mirrored byte-identical into utils/) and
// tools/test-navipedia-loto.js run the same code. docs/navipedia-loto.md.
//
// The question is an officer's, before a job: "to make this machine
// electrically dead, which breakers do I open, and where are the panels?"
// It is answered from the same panel mirror as Electrical Distribution, and
// through electrical-lookup.js's own feedsOf — so the breakers named here are
// the breakers that screen and Roundtable's `,breaker` name. Nothing new is
// read; this module only arranges the answer for isolation:
//
//   - PRIMARY: every breaker that feeds the component, crosswalked first, a
//     label match marked unconfirmed — listed, never picked.
//   - SECONDARY: one point higher up that every one of those panels hangs
//     off, when there is one. It is found as a DOMINATOR, not as a shared
//     parent: a panel fed from two places (P402 takes LP9, UPS, CP2 and DPB2)
//     is dominated by neither, because opening one feed leaves the others
//     live. Where no single point exists the panels' own incoming feeds are
//     listed instead, each marked with the panels it covers.
//   - Everything a secondary point also kills is counted, because opening a
//     distribution breaker to isolate one pump is an officer's call.
//   - WHERE: the component's own location when one is recorded (TM Master's
//     Location, which only the Console carries), and the Space Register rooms
//     its register title names — a hint, said to be one. The panels' places
//     are electrical-lookup's locate().
//
// Every answer carries electrical-lookup's field-verify caveat.

(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./electrical-lookup.js'));
  else root.lotoAssist = factory(root.electricalLookup);
})(typeof self !== 'undefined' ? self : this, function (L) {
  'use strict';

  // Roundtable's jsa-creation skill, "Vessel inputs": a breaker list is not an
  // isolation. What no electrical schedule shows is listed on every page, as
  // a checklist the officer answers — never inferred for a machine.
  const OTHER_ENERGY = [
    ['Control and alarm power', 'a 24 V or UPS feed from another panel keeps controls, heaters or interlocks live after the power breaker opens'],
    ['Stored air', 'receivers and start-air lines — a compressor breaker does not isolate stored air'],
    ['Hydraulic', 'accumulators and trapped pressure in lines and cylinders'],
    ['Fuel, oil and pressurised fluids', 'valves shut and locked, lines drained or vented'],
    ['Rotation', 'shaft turned by the propeller, the sea or a connected machine; turning gear engaged'],
    ['Gravity and springs', 'suspended loads, counterweights, compressed springs'],
    ['Heat and cold', 'hot surfaces, steam and thermal oil; ammonia and refrigerant']
  ];

  const SECONDARY_NOTE = 'A secondary point isolates more than this machine. Open it only when the primary breakers cannot be trusted or reached, and account for everything else it kills.';

  const byNum = (a, b) => String(a).localeCompare(String(b), undefined, { numeric: true });

  // ── Dominators ────────────────────────────────────────────────────────────
  //
  // dom(p): the panels that EVERY upstream path from p passes through, nearest
  // first, p itself at the front. A panel with no recorded feed (a switchboard
  // bus, or a feed the schedule never wrote down) is its own root. A panel fed
  // from several places keeps only what all its feeds share.
  function dominators(ix, name, memo = new Map(), visiting = new Set()) {
    if (memo.has(name)) return memo.get(name);
    if (visiting.has(name)) return [name];
    const p = ix.byName.get(name);
    const feeds = p ? p.fedFrom : [];
    if (!feeds.length) { memo.set(name, [name]); return [name]; }
    visiting.add(name);
    const chains = feeds.map(f => dominators(ix, f.panel, memo, visiting));
    visiting.delete(name);
    const shared = chains[0].filter(n => chains.every(c => c.includes(n)));
    const out = [name, ...shared];
    memo.set(name, out);
    return out;
  }

  // Everything below a panel, by name — to ask which of its breakers lead to a
  // given supply panel.
  function below(ix, name) {
    const out = new Set();
    (function walk(n) {
      for (const d of ix.feeds.get(n) || []) {
        if (out.has(d.panel) || d.panel === name) continue;
        out.add(d.panel);
        walk(d.panel);
      }
    })(name);
    return out;
  }

  // What opening `panel br` kills beyond the one load: the panels it feeds and
  // everything beneath them. With no `br`, the panel itself, killed whole.
  function loadOf(ix, panel, br) {
    const fed = (ix.feeds.get(panel) || []).filter(f => br == null || f.br === br).map(f => f.panel);
    const panels = new Set(), multiFed = new Set();
    let circuits = 0;
    const count = n => {
      if (panels.has(n)) return;
      panels.add(n);
      const p = ix.byName.get(n);
      if (!p) return;
      circuits += p.breakers.filter(b => !L.isEmptyLabel(b.label)).length;
      if (p.fedFrom.length > 1) multiFed.add(n);
    };
    if (br == null) count(panel);
    for (const n of fed) {
      count(n);
      for (const d of L.downstreamLoad(ix, n).panels) count(d);
    }
    return { panels: [...panels].sort(byNum), circuits, multiFed: [...multiFed].sort(byNum) };
  }

  const feedPoint = (ix, f, covers) => ({
    panel: f.panel, br: f.br, label: f.label, known: ix.byName.has(f.panel),
    covers: covers.slice().sort(byNum), load: loadOf(ix, f.panel, f.br)
  });

  // ── The secondary point ───────────────────────────────────────────────────
  //
  //   single   — one breaker covers every supply panel.
  //   branches — one panel covers them, through several of its breakers: those
  //              breakers, all on one panel, all to be opened. Better than
  //              killing the panel: it is often a switchboard.
  //   feeds    — the common panel is itself a supply panel and is fed from
  //              several places; its incoming feeds, all to be opened.
  //   source   — the common panel is a supply panel with no recorded feed: its
  //              own incomer is the point, and the schedule cannot name it.
  //   per-panel — no single point: each supply panel's incoming feeds.
  //
  // `perPanel` skips the search for a common point: label matches are several
  // circuits that share words, and a point above all of them is a point above
  // things that are not this machine.
  function secondary(ix, supplyPanels, { perPanel = false } = {}) {
    const known = supplyPanels.filter(n => ix.byName.has(n));
    const unknown = supplyPanels.filter(n => !ix.byName.has(n));
    if (!known.length) return { kind: 'none', points: [], further: [], unknown, reason: 'No supply panel is in the panel mirror.' };

    const memo = new Map();
    const doms = known.map(n => dominators(ix, n, memo));
    const common = doms[0].filter(n => doms.every(d => d.includes(n)));

    if (common.length && !unknown.length && !perPanel) {
      const at = common[0];
      const further = common.slice(1);
      const atPanel = ix.byName.get(at);
      if (!known.includes(at)) {
        // Which of `at`'s breakers lead down to the supply panels.
        const brs = new Map();
        for (const f of ix.feeds.get(at) || []) {
          const under = below(ix, f.panel);
          const hits = known.filter(n => n === f.panel || under.has(n));
          if (!hits.length) continue;
          if (!brs.has(f.br)) brs.set(f.br, { f: { panel: at, br: f.br, label: f.label }, covers: new Set() });
          for (const h of hits) brs.get(f.br).covers.add(h);
        }
        const pts = [...brs.values()].sort((a, b) => a.f.br - b.f.br).map(x => feedPoint(ix, x.f, [...x.covers]));
        if (pts.length) return { kind: pts.length === 1 ? 'single' : 'branches', at, via: 'branch', points: pts, further, unknown };
      }
      const incoming = atPanel ? atPanel.fedFrom : [];
      if (!incoming.length) {
        return { kind: 'source', at, points: [], further, unknown, load: loadOf(ix, at, null) };
      }
      // The feeding panels are the points now, not "further up".
      const feeders = incoming.map(f => f.panel);
      return {
        kind: incoming.length === 1 ? 'single' : 'feeds', at, via: 'incoming',
        points: incoming.map(f => feedPoint(ix, f, known)),
        further: further.filter(n => !feeders.includes(n)), unknown
      };
    }

    // No one point. Each supply panel's own feeds, merged where two panels
    // share a feed breaker; a panel with no recorded feed is said to be one.
    const merged = new Map();
    const noFeed = [];
    for (const n of known) {
      const p = ix.byName.get(n);
      if (!p.fedFrom.length) { noFeed.push(n); continue; }
      for (const f of p.fedFrom) {
        const k = `${f.panel}|${f.br}`;
        if (!merged.has(k)) merged.set(k, { f, covers: [] });
        merged.get(k).covers.push(n);
      }
    }
    const points = [...merged.values()].map(x => feedPoint(ix, x.f, x.covers))
      .sort((a, b) => byNum(a.panel, b.panel) || a.br - b.br);
    const multi = known.filter(n => ix.byName.get(n).fedFrom.length > 1);
    return { kind: 'per-panel', points, further: [], unknown, noFeed, multiFed: multi, forced: perPanel };
  }

  // ── Where the component is ────────────────────────────────────────────────
  //
  // The Space Register's names and aliases, read in a text as whole words.
  // In a register TITLE only terms of two words or more: a single word
  // ("generator", "factory", "bridge", "chief") names machines as often as
  // rooms, and a room guessed from one is worse than no room. TM's Location
  // field is a place already, so there one word of four letters or more will
  // do ("Wheelhouse", "Laundry").
  function spaceTerms(ix, { minWords = 2 } = {}) {
    const out = [];
    for (const s of Object.values(ix.spaces || {})) {
      const terms = [s.name, ...(s.aliases || [])]
        .map(t => L.fold(t).replace(/\(.*?\)/g, ' ').replace(/[^\w]+/g, ' ').trim())
        .filter(t => t.split(' ').length >= minWords && t.length >= 4);
      for (const t of new Set(terms)) out.push({ id: s.id, term: t });
    }
    return out.sort((a, b) => b.term.length - a.term.length);
  }

  function spacesNamedIn(ix, text, terms = spaceTerms(ix)) {
    let f = ' ' + L.fold(text).replace(/[^\w]+/g, ' ') + ' ';
    const found = [];
    for (const { id, term } of terms) {
      const at = f.indexOf(' ' + term + ' ');
      if (at < 0) continue;
      // Longest first, and a matched phrase is blanked, so "engine control
      // room" is not also read as "control room".
      f = f.slice(0, at) + ' '.repeat(term.length + 2) + f.slice(at + term.length + 2);
      if (!found.some(x => x.id === id)) found.push({ id, term });
    }
    return found;
  }

  function ancestors(ix, row) {
    const byCode = new Map();
    for (const r of ix.equipment) if (r.group && !byCode.has(r.code)) byCode.set(r.code, r);
    const out = [];
    const parts = String(row.code || '').split('.');
    for (let i = parts.length - 1; i > 0; i--) {
      const up = byCode.get(parts.slice(0, i).join('.'));
      if (up && up !== row) out.push(up);
    }
    return out;
  }

  // `tmLocation` is TM Master's Location field for the component, when the
  // caller has it (the Console reads it per component; the phone does not
  // carry it). Returned as the words TM holds, with any room they name.
  function componentLocation(ix, row, { tmLocation } = {}) {
    const terms = spaceTerms(ix);
    const sp = id => ix.spaces[id];
    const out = { tm: null, named: [], fromGroup: null };
    const tm = String(tmLocation || '').trim();
    if (tm) out.tm = { text: tm, spaces: spacesNamedIn(ix, tm, spaceTerms(ix, { minWords: 1 })).map(x => sp(x.id)).filter(Boolean) };
    if (!row) return out;
    out.named = spacesNamedIn(ix, row.name || row.note, terms).map(x => ({ space: sp(x.id), term: x.term })).filter(x => x.space);
    if (!out.named.length) {
      for (const g of ancestors(ix, row)) {
        const hits = spacesNamedIn(ix, g.name || g.note, terms).map(x => ({ space: sp(x.id), term: x.term })).filter(x => x.space);
        if (hits.length) { out.fromGroup = { group: g, named: hits }; break; }
      }
    }
    return out;
  }

  // ── The plan ──────────────────────────────────────────────────────────────
  //
  // `component` is a register row a person picked; `query` what they typed.
  function plan(ix, { component, query, tmLocation } = {}) {
    const feeds = L.feedsOf(ix, { query, component });

    const primary = [];
    for (const { panel, rows } of feeds.panels) {
      const p = ix.byName.get(panel) || null;
      for (const r of rows) {
        primary.push({
          panel, br: r.br, label: r.label, how: r.how, via: r.via,
          known: !!p, locationOnly: !!(p && p.locationOnly),
          location: p ? L.locate(ix, p) : null
        });
      }
    }

    // The secondary is worked over the crosswalked panels when there are any:
    // a label match on some far panel must not drag the common point up to
    // the main switchboard.
    const confirmed = [...new Set(primary.filter(x => x.how === 'crosswalked').map(x => x.panel))];
    const basis = confirmed.length ? 'crosswalked' : 'label';
    const supplyPanels = confirmed.length ? confirmed : [...new Set(primary.map(x => x.panel))];

    const panels = [...new Set(primary.map(x => x.panel))].map(name => {
      const p = ix.byName.get(name);
      return {
        panel: name, known: !!p,
        location: p ? L.locate(ix, p) : null,
        fedFrom: p ? p.fedFrom : [],
        brs: primary.filter(x => x.panel === name).map(x => x.br),
        inBasis: supplyPanels.includes(name)
      };
    });

    // Roundtable's jsa-creation: search the machine AND its auxiliaries. The
    // units beneath it in the register that carry a crosswalked breaker of
    // their own — a heater, a local panel, a motor — listed apart from the
    // primary points and left out of the secondary.
    const inPrimary = new Set(primary.map(x => `${x.panel}|${x.br}`));
    const auxiliaries = component && !(feeds.group && feeds.group.children.length)
      ? L.childrenWithSupply(ix, component)
          .map(c => ({ component: c.component, supply: c.supply.filter(s => !inPrimary.has(`${s.panel}|${s.br}`)) }))
          .filter(c => c.supply.length)
      : [];

    return {
      component: component || null,
      query: feeds.query,
      auxiliaries,
      otherEnergy: OTHER_ENERGY,
      feeds,
      primary,
      panels,
      basis,
      secondary: primary.length ? secondary(ix, supplyPanels, { perPanel: basis === 'label' && supplyPanels.length > 1 }) : null,
      where: componentLocation(ix, component || (feeds.register.length === 1 ? feeds.register[0] : null), { tmLocation }),
      caveat: L.CAVEAT,
      secondaryNote: SECONDARY_NOTE
    };
  }

  // Register rows for the picker: a machine the crosswalk gave a breaker
  // first, then groups with such a machine under them, then the rest — the
  // same order Electrical Distribution's autocomplete uses for items.
  function suggest(ix, text, { limit = 14 } = {}) {
    const rows = L.findComponents(ix, text);
    const rank = r => ix.supply.has(r.note) ? 0 : r.group ? 1 : 2;
    return rows.slice().sort((a, b) => rank(a) - rank(b) || byNum(a.code, b.code)).slice(0, limit)
      .map(r => ({ component: r, supply: ix.supply.get(r.note) || null }));
  }

  return {
    SECONDARY_NOTE, OTHER_ENERGY, dominators, below, loadOf, secondary,
    spaceTerms, spacesNamedIn, ancestors, componentLocation, plan, suggest
  };
});
