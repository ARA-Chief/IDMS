'use strict';
// ── Development Plan derivation (IDMS-SCHEMA §43) ────────────────────────────
// CANONICAL COPY. Mirrored byte-identical at
//   IDMS-Console/src/renderer/js/plan-derive.js
// — same convention as utils/notes-reduce.js. Change it here first, then copy.
//
// Pure derivation of one crew member's development plan — which competency
// cards their work demands, at what level, what they hold, and what closes the
// gap — from plain inputs. No DOM, no fetch, no globals, no store: the plan is
// computed every time it is read, on the phone and in the Console, through
// this exact code. That is what keeps the two from ever showing two plans.
//
// Two rules this file is built around, restated from the spec because they
// are the ones a later change is most likely to break:
//
//   * A plan is never a score. Nothing here produces a percentage, a rank, or
//     a total across members. Counts exist per group on one member's plan.
//   * Two currencies, never one ladder. Practice currency (did the work inside
//     the recency window — time-based) and revision currency (has read the
//     current revision — version-based) are reported side by side as separate
//     reasons on a refresh row. They are not folded into a three-state pip.

(function (root) {

  // ── Vocabulary ─────────────────────────────────────────────────────────────
  var LEVELS = ['aware', 'supervised', 'independent', 'assessor'];
  // Non-canonical rungs the corpus has been seen to use. Each is applied AND
  // reported as a defect — the exporter never rewrites a card, it lists what
  // it had to read past.
  var LEVEL_ALIASES = { assisted: 'supervised', supervise: 'supervised', independant: 'independent' };

  var SIGNABLE = /^(KSA|SKG|SKD)-/i;
  var KNOWLEDGE = /^(KNG|KND)-/i;

  var RING_RANK = { assigned: 0, due: 1, baseline: 2 };

  function levelName(n) { return LEVELS[(n | 0) - 1] || ''; }

  // "independent" → 3. Returns { level, applied } where `applied` names the
  // alias used, or null when the word was canonical. Unknown → level null.
  function normalizeLevel(s) {
    var w = String(s == null ? '' : s).trim().toLowerCase();
    if (!w) return { level: null, applied: null };
    var i = LEVELS.indexOf(w);
    if (i !== -1) return { level: i + 1, applied: null };
    if (LEVEL_ALIASES[w]) return { level: LEVELS.indexOf(LEVEL_ALIASES[w]) + 1, applied: LEVEL_ALIASES[w] };
    var n = parseInt(w, 10);
    if (n >= 1 && n <= 4 && String(n) === w) return { level: n, applied: null };
    return { level: null, applied: null };
  }

  // "[[SKD-0029-main-engine-starting]]: independent" → the id inside the link.
  function unwrapLink(entry) {
    var s = String(entry == null ? '' : entry);
    var m = s.match(/\[\[([^\]|]+)/);
    return (m ? m[1] : s.split(':')[0]).trim();
  }

  // One card's `requires_ksa` list → the canonical shape the demand mirror
  // carries. Shared by the Console exporter and the tests so the vocabulary
  // rules live in exactly one place.
  //   → { requires: [{id, level}], requires_knowledge: [id], defects: [..] }
  function parseRequires(entries, cardId) {
    var out = { requires: [], requires_knowledge: [], defects: [] };
    var list = Array.isArray(entries) ? entries : (entries ? [entries] : []);
    for (var i = 0; i < list.length; i++) {
      var raw = String(list[i] == null ? '' : list[i]).trim();
      if (!raw) continue;
      var id = unwrapLink(raw);
      var after = raw.indexOf(']]') !== -1 ? raw.slice(raw.indexOf(']]') + 2) : raw.slice(id.length);
      var lvlWord = after.replace(/^\s*:?\s*/, '').trim();
      // `\"[[X]]: independent\"` — YAML quotes escaped into the value. Read
      // past the quoting and report it; the word inside is what was meant.
      if (/[\\"']/.test(lvlWord)) {
        var cleaned = lvlWord.replace(/[\\"']/g, '').trim();
        out.defects.push({ card: cardId, field: 'requires_ksa', entry: raw, kind: 'quoting', applied: cleaned });
        lvlWord = cleaned;
      }
      if (!id) { out.defects.push({ card: cardId, field: 'requires_ksa', entry: raw, kind: 'unparseable' }); continue; }
      if (KNOWLEDGE.test(id)) {
        // Knowledge is unsignable by design: it is a reading, never a level.
        out.requires_knowledge.push(id);
        if (lvlWord) out.defects.push({ card: cardId, field: 'requires_ksa', entry: raw, kind: 'knowledge-at-level', applied: 'requires_knowledge' });
        continue;
      }
      if (!SIGNABLE.test(id)) {
        out.defects.push({ card: cardId, field: 'requires_ksa', entry: raw, kind: 'not-signable' });
        continue;
      }
      var lv = normalizeLevel(lvlWord);
      if (lv.level == null) {
        // No level stated (or a word nobody recognises): a demand exists, so
        // it is kept at the most common rung and reported.
        out.defects.push({ card: cardId, field: 'requires_ksa', entry: raw, kind: lvlWord ? 'level-vocabulary' : 'level-missing', applied: 'independent' });
        lv.level = 3;
      } else if (lv.applied) {
        out.defects.push({ card: cardId, field: 'requires_ksa', entry: raw, kind: 'level-vocabulary', applied: lv.applied });
      }
      out.requires.push({ id: id, level: lv.level });
    }
    return out;
  }

  // ── Assets ─────────────────────────────────────────────────────────────────
  // "601.001 Main Engine" → "601.001". Anything not starting with a digit is
  // vessel-global and cannot be reached by an equipment code.
  function assetCode(s) {
    var first = String(s == null ? '' : s).trim().split(/\s+/)[0] || '';
    return /^\d/.test(first) ? first : '';
  }
  function codeDepth(s) { return String(s || '').split('.').length; }

  // A task's equipment code demands a card whose asset is the same code or
  // exactly one level above it. This is the rule the Console already uses to
  // credit competency currency from the job history; the two must not drift.
  function assetMatches(taskCode, cardCode) {
    var t = String(taskCode || ''), c = String(cardCode || '');
    if (!t || !c) return false;
    if (t === c) return true;
    return t.indexOf(c + '.') === 0 && codeDepth(t) - codeDepth(c) === 1;
  }

  // ── Tasks ──────────────────────────────────────────────────────────────────
  function asArray(v) {
    if (Array.isArray(v)) return v;
    if (typeof v === 'string') {
      var s = v.trim();
      if (s.charAt(0) === '[') { try { var a = JSON.parse(s); return Array.isArray(a) ? a : []; } catch (e) { return []; } }
      return s ? [s] : [];
    }
    return [];
  }
  function taskEquipment(task) {
    var ids = asArray(task.equipment_ids);
    if (!ids.length && task.equipment_id) ids = [task.equipment_id];
    if (!ids.length && task.asset_code) ids = [task.asset_code];
    return ids.map(function (x) { return String(x || '').trim(); }).filter(Boolean);
  }
  function taskOpen(task) {
    var st = String(task.status || '').toLowerCase();
    return st !== 'completed' && st !== 'cancelled' && st !== 'closed';
  }
  function sameUser(a, b) {
    a = String(a == null ? '' : a).trim().toLowerCase();
    b = String(b == null ? '' : b).trim().toLowerCase();
    return a !== '' && a === b;
  }
  function taskHeldBy(task, member) {
    if (!member) return false;
    if (sameUser(task.assigned_to, member.username)) return true;
    var list = asArray(task.assignees);
    for (var i = 0; i < list.length; i++) {
      var a = list[i];
      var key = (a && typeof a === 'object') ? (a.crew_id || a.username) : a;
      if (member.crew_id && key === member.crew_id) return true;
      if (sameUser(key, member.username)) return true;
    }
    return false;
  }
  var MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  // ISO first; then the shapes TM Master's Due grid has been seen to use.
  function parseDate(s) {
    if (!s) return null;
    var t = String(s).trim();
    var m = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return m[1] + '-' + m[2] + '-' + m[3];
    m = t.match(/^(\d{1,2})[.\/](\d{1,2})[.\/](\d{4})$/);
    if (m) {
      // dd.mm.yyyy is TM's; m/d/yyyy is Windows-US. A dot is unambiguous.
      var dot = t.indexOf('.') !== -1;
      var d = dot ? +m[1] : +m[2], mo = dot ? +m[2] : +m[1];
      if (mo > 12 && d <= 12) { var x = d; d = mo; mo = x; }
      return m[3] + '-' + pad(mo) + '-' + pad(d);
    }
    m = t.match(/^(\d{1,2})\s+([A-Za-z]{3})[a-z]*\.?\s+(\d{4})$/);
    if (m && MONTHS[m[2].toLowerCase()]) return m[3] + '-' + pad(MONTHS[m[2].toLowerCase()]) + '-' + pad(+m[1]);
    return null;
  }
  function taskDue(task) {
    return parseDate(task.due_date) || parseDate(task.tm_due) || null;
  }
  function deptKey(s) {
    var w = String(s == null ? '' : s).trim().toLowerCase();
    if (!w) return '';
    if (w.indexOf('engine') !== -1) return 'engine';
    if (w.indexOf('factory') !== -1) return 'factory';
    if (w.indexOf('deck') !== -1) return 'deck';
    if (w.indexOf('accom') !== -1 || w.indexOf('galley') !== -1 || w.indexOf('steward') !== -1) return 'accommodation';
    return w;
  }
  // Vault tags are kebab ("engine-room"); crew departments are words.
  function tagMatchesDept(tag, dept) {
    return deptKey(String(tag || '').replace(/-/g, ' ')) === deptKey(dept);
  }
  function taskInDept(task, dept) {
    if (!task.department) return true;   // caller has already scoped it
    return deptKey(task.department) === deptKey(dept);
  }

  function addDays(iso, days) {
    var d = new Date(iso + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
  }
  function addMonths(iso, months) {
    var d = new Date(iso + 'T00:00:00Z');
    d.setUTCMonth(d.getUTCMonth() - months);
    return d.toISOString().slice(0, 10);
  }

  // ── Configuration ──────────────────────────────────────────────────────────
  function planDefaults() {
    return {
      rings: { assigned: true, due: true, baseline: true },
      due_window_days: 45,
      assessor_policy: 'chief',
      assessor_ranks: ['Chief Engineer', 'Assistant Engineer'],
      provisional_methods: ['workbook-import'],
      provisional_counts: true,
      recency_default_months: 24,
      baseline_scope: { tags: [], card_ids: [] }
    };
  }
  // The stored block for one department over the defaults. A department with
  // no block gets a baseline scope guessed from its own name, so the syllabus
  // ring works before anyone has opened the KSA Plan panel.
  function planConfigFor(config, dept) {
    var d = planDefaults();
    var stored = (config && config.plan && config.plan[dept]) || null;
    if (!stored) {
      for (var k in (config && config.plan) || {}) {
        if (deptKey(k) === deptKey(dept)) { stored = config.plan[k]; break; }
      }
    }
    if (stored) {
      for (var key in stored) {
        if (key === 'rings' || key === 'baseline_scope') {
          d[key] = {};
          for (var kk in planDefaults()[key]) d[key][kk] = planDefaults()[key][kk];
          for (var k2 in stored[key]) d[key][k2] = stored[key][k2];
        } else if (stored[key] !== undefined) d[key] = stored[key];
      }
    }
    if (!d.baseline_scope.tags || !d.baseline_scope.tags.length) {
      var guess = deptKey(dept);
      d.baseline_scope.tags = guess === 'engine' ? ['engine-room'] : guess ? [guess] : [];
    }
    return d;
  }

  // ── Registry ───────────────────────────────────────────────────────────────
  // Sign-offs and tracked entries may use the short id (KSA-T001) where the
  // registry carries the full slug (KSA-T001-torque-wrench). Everything keys
  // on the registry's id when one matches.
  function registryIndex(registry) {
    var cards = (registry && registry.cards) || [];
    var byId = {}, list = [];
    for (var i = 0; i < cards.length; i++) { byId[cards[i].id] = cards[i]; list.push(cards[i]); }
    function canonical(id) {
      if (!id) return id;
      if (byId[id]) return id;
      var s = String(id);
      for (var j = 0; j < list.length; j++) {
        var cid = list[j].id;
        if (cid.indexOf(s + '-') === 0 || s.indexOf(cid + '-') === 0) return cid;
      }
      return s;
    }
    return { byId: byId, list: list, canonical: canonical };
  }

  // Longest prerequisite chain beneath a card: a card with no `requires_ksa`
  // is depth 0 and sorts before the cards that require it. The syllabus order.
  function prereqDepth(idx) {
    var memo = {};
    function depth(id, seen) {
      if (memo[id] != null) return memo[id];
      if (seen[id]) return 0;                 // a hand-authored cycle — stop
      seen[id] = true;
      var card = idx.byId[id];
      var reqs = (card && card.requires_ksa) || [];
      var best = 0;
      for (var i = 0; i < reqs.length; i++) {
        var rid = idx.canonical(unwrapLink(reqs[i]));
        var dpt = depth(rid, seen) + 1;
        if (dpt > best) best = dpt;
      }
      memo[id] = best;
      return best;
    }
    return function (id) { return depth(id, {}); };
  }

  // ── Sign-offs ──────────────────────────────────────────────────────────────
  // Accepts a Map or an object keyed by card id, each value the latest
  // sign-off record ({level, date, method, author}). Re-keys on canonical ids.
  function signoffIndex(signoffs, idx) {
    var out = {};
    if (!signoffs) return out;
    var entries = (typeof signoffs.forEach === 'function' && !Array.isArray(signoffs))
      ? (function () { var a = []; signoffs.forEach(function (v, k) { a.push([k, v]); }); return a; })()
      : Object.keys(signoffs).map(function (k) { return [k, signoffs[k]]; });
    for (var i = 0; i < entries.length; i++) {
      var id = idx.canonical(entries[i][0]), so = entries[i][1];
      if (!so) continue;
      var prev = out[id];
      var when = so.date || so.created_at || '';
      if (!prev || when > (prev.date || prev.created_at || '')) out[id] = so;
    }
    return out;
  }
  function isProvisional(so, cfg) {
    if (!so) return false;
    var m = String(so.method || '').toLowerCase();
    var list = cfg.provisional_methods || [];
    for (var i = 0; i < list.length; i++) if (String(list[i]).toLowerCase() === m) return true;
    return false;
  }

  // ── Demand ─────────────────────────────────────────────────────────────────
  // Every (card, competency, level) a set of tasks demands. `ring` says how the
  // task got here; `heldBy` is whether the member holds the task.
  function demandCards(demand) {
    var cards = (demand && demand.cards) || [];
    return cards.filter(function (c) { return c && (c.kind === 'SOP' || c.kind === 'TASK'); });
  }
  function cardsForCode(cards, code) {
    var out = [];
    for (var i = 0; i < cards.length; i++) {
      if (cards[i].asset_code && assetMatches(code, cards[i].asset_code)) out.push(cards[i]);
    }
    return out;
  }
  function cardInScope(card, cfg) {
    var scope = cfg.baseline_scope || {};
    var ids = scope.card_ids || [];
    for (var i = 0; i < ids.length; i++) if (ids[i] === card.id) return true;
    var tags = card.tags || (card.department ? [card.department] : []);
    var want = scope.tags || [];
    for (var j = 0; j < want.length; j++) {
      for (var k = 0; k < tags.length; k++) {
        if (String(tags[k]).toLowerCase() === String(want[j]).toLowerCase()) return true;
        if (tagMatchesDept(tags[k], String(want[j]).replace(/-/g, ' '))) return true;
      }
    }
    return false;
  }

  // Collects demand into rows keyed by competency id.
  //   rows[id] = { required_level, demanded_by: [...], rings: {…}, due }
  function collectDemand(input, cfg, idx) {
    var member = input.member || {};
    var now = input.now || new Date().toISOString().slice(0, 10);
    var cards = demandCards(input.demand);
    var tasks = (input.tasks || []).filter(taskOpen);
    var horizon = addDays(now, cfg.due_window_days | 0);
    var rows = {};

    function add(id, level, ring, card, task, due) {
      var cid = idx.canonical(id);
      var r = rows[cid] || (rows[cid] = { id: cid, required_level: 0, demanded_by: [], rings: {}, due: null, demand_count: 0 });
      if (level > r.required_level) r.required_level = level;
      r.rings[ring] = true;
      if (due && (!r.due || due < r.due)) r.due = due;
      r.demanded_by.push({
        card_id: card.id, card_title: card.title || card.id, ring: ring, level: level,
        task_id: task ? task.task_id : null,
        task_title: task ? (task.title || task.job_name || null) : null,
        due: due || null
      });
    }

    for (var t = 0; t < tasks.length; t++) {
      var task = tasks[t];
      var held = taskHeldBy(task, member);
      var due = taskDue(task);
      var ring = null;
      if (held && cfg.rings.assigned) ring = 'assigned';
      else if (!held && cfg.rings.due && due && due <= horizon && taskInDept(task, member.department)) ring = 'due';
      if (!ring) continue;
      var codes = taskEquipment(task);
      for (var c = 0; c < codes.length; c++) {
        var hits = cardsForCode(cards, codes[c]);
        for (var h = 0; h < hits.length; h++) {
          var reqs = hits[h].requires || [];
          for (var q = 0; q < reqs.length; q++) add(reqs[q].id, reqs[q].level | 0, ring, hits[h], task, due);
        }
      }
    }
    if (cfg.rings.baseline) {
      for (var i = 0; i < cards.length; i++) {
        if (!cardInScope(cards[i], cfg)) continue;
        var rq = cards[i].requires || [];
        for (var k = 0; k < rq.length; k++) add(rq[k].id, rq[k].level | 0, 'baseline', cards[i], null, null);
      }
    }
    for (var id in rows) {
      var seenCards = {};
      for (var d = 0; d < rows[id].demanded_by.length; d++) seenCards[rows[id].demanded_by[d].card_id] = true;
      rows[id].demand_count = Object.keys(seenCards).length;
    }
    return rows;
  }

  // ── Currency ───────────────────────────────────────────────────────────────
  // Practice currency for one card: did the member exercise it inside the
  // window. `unknown` when no currency snapshot exists at all — the phone
  // without a Console-published file — and unknown is never reported as stale.
  function practiceFor(id, input, cfg, idx, tracked) {
    var cur = input.currency && input.currency.byCompetency;
    var now = input.now || new Date().toISOString().slice(0, 10);
    var card = idx.byId[id];
    var months = (tracked && tracked.recency_months) ||
                 (card && card.recency_default_months) ||
                 cfg.recency_default_months || null;
    var out = { last: null, via: null, n: 0, months: months, stale: false, unknown: !cur };
    if (!cur) return out;
    var hit = cur[id];
    if (hit) { out.last = hit.last || null; out.via = hit.via || null; out.n = hit.n | 0; }
    if (!months) return out;
    var strong = out.last && out.via !== 'discipline';
    out.stale = !strong || out.last < addMonths(now, months);
    return out;
  }
  function trackedFor(id, config, idx) {
    var list = (config && config.tracked) || [];
    for (var i = 0; i < list.length; i++) if (idx.canonical(list[i].ksa_id) === id) return list[i];
    return null;
  }

  // ── Assessors ──────────────────────────────────────────────────────────────
  // Who can sign this card off, under the department's policy. `members` are
  // {crew_id, name, role}; `signoffsByMember` maps crew_id → sign-off index.
  function assessorsFor(cardId, members, signoffsByMember, cfg, idx) {
    var id = idx ? idx.canonical(cardId) : cardId;
    var ranks = (cfg.assessor_ranks || []).map(function (r) { return String(r).toLowerCase(); });
    var out = [];
    for (var i = 0; i < (members || []).length; i++) {
      var m = members[i];
      var inRank = ranks.indexOf(String(m.role || '').toLowerCase()) !== -1;
      var so = signoffsByMember && signoffsByMember[m.crew_id] && signoffsByMember[m.crew_id][id];
      var lvl = so ? (so.level | 0) : 0;
      var ok = cfg.assessor_policy === 'record' ? lvl >= 4
             : cfg.assessor_policy === 'independent_rank' ? (inRank && lvl >= 3)
             : inRank;                                   // 'chief'
      if (ok) out.push({ crew_id: m.crew_id, name: m.name, level: lvl });
    }
    return out;
  }

  // ── The plan ───────────────────────────────────────────────────────────────
  function derivePlan(input) {
    input = input || {};
    var member = input.member || {};
    var cfg = planConfigFor(input.config, member.department);
    var idx = registryIndex(input.registry);
    var depthOf = prereqDepth(idx);
    var held = signoffIndex(input.signoffs, idx);
    var rows = collectDemand(input, cfg, idx);
    var members = input.members || null;
    var byMember = input.signoffsByMember || null;

    var now = [], next = [], refresh = [], unassessable = [];
    for (var id in rows) {
      var r = rows[id];
      var card = idx.byId[id] || null;
      var so = held[id] || null;
      var provisional = isProvisional(so, cfg);
      var heldLevel = so ? Math.max(0, Math.min(4, so.level | 0)) : 0;
      var effective = (provisional && cfg.provisional_counts === false) ? 0 : heldLevel;
      var tracked = trackedFor(id, input.config, idx);
      var practice = practiceFor(id, input, cfg, idx, tracked);
      var revised = card && card.revised ? String(card.revised) : null;
      var revisionBehind = Boolean(so && so.date && revised && String(so.date) < revised);

      var row = {
        id: id,
        label: card ? (card.label || id) : id,
        kind: card ? card.kind : null,
        category: card ? (card.category || card.discipline || null) : null,
        has_expectations: card ? card.has_expectations !== false : false,
        required_level: r.required_level,
        required_name: levelName(r.required_level),
        held_level: heldLevel,
        held_name: levelName(heldLevel),
        provisional: provisional,
        method: so ? (so.method || null) : null,
        signed_date: so ? (so.date || null) : null,
        signed_by: so && so.author ? (so.author.name || so.author.username || null) : null,
        practice: practice,
        revision: { card_revised: revised, behind: revisionBehind },
        reasons: [],
        demanded_by: r.demanded_by,
        rings: r.rings,
        ring: r.rings.assigned ? 'assigned' : r.rings.due ? 'due' : 'baseline',
        due: r.due,
        demand_count: r.demand_count,
        depth: depthOf(id),
        assessors: members ? assessorsFor(id, members, byMember, cfg, idx) : null,
        state: null,
        group: null
      };

      if (!card || !SIGNABLE.test(id) || card.has_expectations === false) {
        row.state = 'unassessable';
        row.group = 'unassessable';
        unassessable.push(row);
        continue;
      }
      if (!so) row.state = 'missing';
      else if (effective < r.required_level) row.state = 'partial';
      else {
        row.state = 'held';
        if (practice.stale) row.reasons.push('practice');
        if (revisionBehind) row.reasons.push('revision');
        if (row.reasons.length) row.state = 'refresh';
      }
      if (row.state === 'held') continue;              // nothing to do
      if (row.state === 'refresh') { row.group = 'refresh'; refresh.push(row); }
      else if (row.rings.assigned || row.rings.due) { row.group = 'now'; now.push(row); }
      else { row.group = 'next'; next.push(row); }
    }

    function cmp(a, b) {
      var ra = RING_RANK[a.ring], rb = RING_RANK[b.ring];
      if (ra !== rb) return ra - rb;
      if (a.due !== b.due) { if (!a.due) return 1; if (!b.due) return -1; if (a.due < b.due) return -1; return 1; }
      if (a.demand_count !== b.demand_count) return b.demand_count - a.demand_count;
      if (a.depth !== b.depth) return a.depth - b.depth;
      return a.label < b.label ? -1 : a.label > b.label ? 1 : 0;
    }
    now.sort(cmp); next.sort(cmp); refresh.sort(cmp); unassessable.sort(cmp);

    return {
      now: now, next: next, refresh: refresh, unassessable: unassessable,
      summary: { now: now.length, next: next.length, refresh: refresh.length, unassessable: unassessable.length },
      config: cfg,
      currency_known: Boolean(input.currency && input.currency.byCompetency),
      defects: (input.demand && input.demand.defects) || []
    };
  }

  // ── Vessel view ────────────────────────────────────────────────────────────
  // The officer's trip question, over a department's active members: which
  // cards demanded by due work does nobody hold, which are held by exactly one
  // person, and which have no assessor under the policy. Names cards; a member
  // appears only as the holder of a single-holder card.
  //   members: [{crew_id, name, role, username}]
  //   signoffsByMember: { crew_id: signoff index (id → latest record) }
  function deriveVesselView(input) {
    input = input || {};
    var dept = input.department || '';
    var cfg = planConfigFor(input.config, dept);
    var idx = registryIndex(input.registry);
    var now = input.now || new Date().toISOString().slice(0, 10);
    var horizon = addDays(now, cfg.due_window_days | 0);
    var cards = demandCards(input.demand);
    var tasks = (input.tasks || []).filter(taskOpen);
    var members = input.members || [];
    var byMember = {};
    for (var m = 0; m < members.length; m++) {
      byMember[members[m].crew_id] = signoffIndex((input.signoffsByMember || {})[members[m].crew_id], idx);
    }

    var demanded = {};
    function add(id, level, card, task, due) {
      var cid = idx.canonical(id);
      var r = demanded[cid] || (demanded[cid] = { id: cid, required_level: 0, demanded_by: [], due: null });
      if (level > r.required_level) r.required_level = level;
      if (due && (!r.due || due < r.due)) r.due = due;
      r.demanded_by.push({ card_id: card.id, card_title: card.title || card.id, task_id: task.task_id, task_title: task.title || task.job_name || null, due: due });
    }
    for (var t = 0; t < tasks.length; t++) {
      var task = tasks[t];
      if (!taskInDept(task, dept)) continue;
      var due = taskDue(task);
      var anyHeld = false;
      for (var mm = 0; mm < members.length && !anyHeld; mm++) anyHeld = taskHeldBy(task, members[mm]);
      if (!anyHeld && !(due && due <= horizon)) continue;
      var codes = taskEquipment(task);
      for (var c = 0; c < codes.length; c++) {
        var hits = cardsForCode(cards, codes[c]);
        for (var h = 0; h < hits.length; h++) {
          var reqs = hits[h].requires || [];
          for (var q = 0; q < reqs.length; q++) add(reqs[q].id, reqs[q].level | 0, hits[h], task, due);
        }
      }
    }

    var uncovered = [], single = [], noAssessor = [];
    for (var id in demanded) {
      var r = demanded[id];
      var card = idx.byId[id];
      var holders = [];
      for (var i = 0; i < members.length; i++) {
        var so = byMember[members[i].crew_id][id];
        if (!so) continue;
        var lvl = (isProvisional(so, cfg) && cfg.provisional_counts === false) ? 0 : (so.level | 0);
        if (lvl >= r.required_level) holders.push({ crew_id: members[i].crew_id, name: members[i].name, level: lvl });
      }
      var row = {
        id: id, label: card ? (card.label || id) : id,
        has_expectations: card ? card.has_expectations !== false : false,
        required_level: r.required_level, required_name: levelName(r.required_level),
        due: r.due, demanded_by: r.demanded_by, holders: holders,
        assessors: assessorsFor(id, members, byMember, cfg, idx)
      };
      if (!holders.length) uncovered.push(row);
      else if (holders.length === 1) single.push(row);
      if (!row.assessors.length) noAssessor.push(row);
    }
    function byDue(a, b) {
      if (a.due !== b.due) { if (!a.due) return 1; if (!b.due) return -1; return a.due < b.due ? -1 : 1; }
      return a.label < b.label ? -1 : a.label > b.label ? 1 : 0;
    }
    uncovered.sort(byDue); single.sort(byDue); noAssessor.sort(byDue);
    return {
      uncovered: uncovered, single_holder: single, no_assessor: noAssessor,
      demanded: Object.keys(demanded).length, config: cfg, horizon: horizon
    };
  }

  var api = {
    LEVELS: LEVELS,
    levelName: levelName,
    normalizeLevel: normalizeLevel,
    unwrapLink: unwrapLink,
    parseRequires: parseRequires,
    assetCode: assetCode,
    assetMatches: assetMatches,
    taskDue: taskDue,
    taskOpen: taskOpen,
    taskHeldBy: taskHeldBy,
    taskEquipment: taskEquipment,
    parseDate: parseDate,
    deptKey: deptKey,
    planDefaults: planDefaults,
    planConfigFor: planConfigFor,
    registryIndex: registryIndex,
    signoffIndex: signoffIndex,
    assessorsFor: assessorsFor,
    derivePlan: derivePlan,
    deriveVesselView: deriveVesselView
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.planDerive = api;
})(typeof window !== 'undefined' ? window : this);
