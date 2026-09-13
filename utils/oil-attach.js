'use strict';
// ── Oil attachments: what goes where, and where it comes from ────────────────
// CANONICAL COPY. Mirrored byte-identical at
//   IDMS-Console/src/renderer/js/oil-attach.js
// Same convention as utils/procurement-reduce.js: change it here, then copy,
// then `node tools/test/run.js` (the console suite compares the two).
//
// The phone's Add Oil and the Console's Tank Levels & Transfers ask the same
// three questions — what oil, from where, to where — and until this file they
// answered them from two different lists with nothing joining oil to either
// end. This is the one answer both use.
//
// THE THREE-WAY FILTER. Pick any one of oil, From or To and the other two
// narrow to what is attached to it; pick two and the third narrows to what is
// attached to both. Every slot has an override that shows the whole universe
// again, and a row written through an override says so.
//
// WHAT "ATTACHED" MEANS. An item from Inventory > Items is attached to:
//   - an SFI component, when one of the item's SFI codes (procurementReduce
//     .sfiCodes) is that component's code, or sits UNDER it. A link rolls up:
//     Mobilgard 410 linked to 601.001.075 (ME lube oil system) is attached to
//     601.001 Main Engine, which is where the add-oil point is. It never rolls
//     down — Rando 46 on 831.001.01 (the HPU) is not an oil for 831.001.01.16,
//     the motor cooling unit under it, which takes HDZ — and it stops at a
//     machine that has a rounds point of its own, so HDZ on the motor cooling
//     unit is not offered for the HPU either (linkReaches).
//   - a tank, when the item's policy `tank_id` names it, or one of its SFI
//     codes is the tank's `asset_code` in vesselconfig (233.075.01 is L.O. MAIN
//     ENG. No.22). Exactly — a tank group code is not a tank.
//   - a stores location, when the reduced register has the item there.
// Waste-oil tanks take any oil — they are where oil goes to stop being oil —
// so they are always attached on the To side.
//
// An item is on the oil list at all when it has a tank link or its policy
// says `fluid: true`. SFI codes alone do not make a fluid: the Main Engine's
// lube oil FILTER is linked to the Main Engine too, and is not poured.
//
// HISTORIC PRECEDENT picks the default, never the list. Past lube_log and
// waste_log rows are counted per oil; the most frequent From and To among the
// attached options is suggested. A precedent that is not attached is not
// suggested — history can be wrong (a 15W40 tank once logged into the Main
// Engine), and suggesting it would teach the mistake.
//
// Pure. No DOM, no Graph, no globals beyond the export.

(function (root) {

  var WASTE = 'waste_oil';
  var LUBE  = 'lube_oil';

  function str(v) { return (v === null || v === undefined) ? '' : String(v).trim(); }

  function uniq(list) {
    var seen = {}, out = [];
    for (var i = 0; i < list.length; i++) {
      var c = str(list[i]);
      if (!c || seen[c]) continue;
      seen[c] = true;
      out.push(c);
    }
    return out;
  }

  // Same code, or one sits under the other on a dotted boundary. 601.001 and
  // 601.001.075 relate; 601.001 and 601.0011 do not.
  function codeRelated(a, b) {
    a = str(a); b = str(b);
    if (!a || !b) return false;
    if (a === b) return true;
    return b.indexOf(a + '.') === 0 || a.indexOf(b + '.') === 0;
  }

  // Does a link on `code` reach the component `target`? The same code, or a
  // code under it with no rounds point in between (the link's own code counts:
  // a machine with its own point is its own destination).
  function linkReaches(m, code, target) {
    code = str(code); target = str(target);
    if (!code || !target) return false;
    if (code === target) return true;
    if (code.indexOf(target + '.') !== 0) return false;
    var pts = (m && m.pointCodes) || [];
    for (var i = 0; i < pts.length; i++) {
      var p = pts[i];
      if (p === target) continue;
      if ((p === code || code.indexOf(p + '.') === 0) && p.indexOf(target + '.') === 0) return false;
    }
    return true;
  }

  // Stock comes off a shelf only in the unit the movement is measured in.
  // An item counted in drums or pails is recorded as the oil that moved but is
  // not debited — 5 USG out of an item counted in DR would take five drums off
  // the shelf. The engineer issues the drum by hand when it is empty. Decided
  // 2026-09-13: a disjoint inventory is better than a broken one.
  var GALLON_UNITS = ['gal', 'gals', 'gallon', 'gallons', 'usg', 'us gal', 'us gallon', 'us gallons'];
  function issuesStock(item) {
    var u = str(item && item.unit).toLowerCase().replace(/\.$/, '');
    return GALLON_UNITS.indexOf(u) >= 0;
  }

  // The item's SFI codes without depending on the reducer being loaded:
  // procurementReduce.sfiCodes when it is there, the same rule inline when not.
  function itemCodes(item) {
    if (!item) return [];
    var pr = root && root.procurementReduce;
    if (pr && typeof pr.sfiCodes === 'function') return pr.sfiCodes(item);
    var pol = item.policy || {};
    var one = (pol.sfi_code !== undefined && pol.sfi_code !== null) ? pol.sfi_code : item.sfi_code;
    return uniq([one].concat(Array.isArray(pol.sfi_codes) ? pol.sfi_codes : []));
  }

  // ── The world ──────────────────────────────────────────────────────────────
  //
  // world = {
  //   tanks:     vesselconfig.tanks[] (any categories; lube_oil and waste_oil are used)
  //   points:    [{ code, item_id, label, kind }]  roundsconfig add-oil points and
  //              tank-level inspection items; code may be null
  //   items:     reduced procurement items, { item_id: item } or an array
  //   logs:      lube_log[] and waste_log[] rows, concatenated
  //   assetName: function (code) -> name | null      (optional)
  //   locName:   function (location_id) -> string    (optional)
  // }
  function build(world) {
    world = world || {};
    var assetName = typeof world.assetName === 'function' ? world.assetName : function () { return null; };
    var locName   = typeof world.locName === 'function' ? world.locName : function (id) { return id; };

    var m = {
      nodes: {},          // key -> node
      tanks: [],          // tank nodes
      equipment: [],      // equipment / point nodes
      fluids: [],         // fluid descriptors
      fluidById: {},
      items: {},          // item_id -> item (every item given, fluid or not)
      logs: Array.isArray(world.logs) ? world.logs : [],
      locName: locName,
      pointCodes: uniq((world.points || []).map(function (p) { return p && p.code; }))
    };

    // Tanks. Only the two categories oil moves between; fuel and water have
    // their own panels and are never a destination for lube oil.
    (world.tanks || []).forEach(function (t) {
      if (!t || !t.tank_id) return;
      if (t.category !== LUBE && t.category !== WASTE) return;
      var n = {
        key: 'tank:' + t.tank_id, kind: 'tank', tank_id: t.tank_id,
        category: t.category, code: str(t.asset_code) || null,
        label: t.name || t.abbreviation || 'Unnamed tank',
        contents: t.contents || null, units: t.units || 'USG',
        group: t.category === WASTE ? 'Waste oil tanks' : 'Lube oil tanks'
      };
      m.nodes[n.key] = n;
      m.tanks.push(n);
    });

    function equipLabel(code, fallback) {
      var nm = assetName(code);
      if (nm) return nm + ' (' + code + ')';
      if (fallback) return fallback + ' (' + code + ')';
      return code;
    }
    function addCode(code, fallbackLabel, point) {
      code = str(code);
      if (!code) return null;
      // A code that IS a tank is the tank, not a second copy of it.
      for (var i = 0; i < m.tanks.length; i++) {
        if (m.tanks[i].code === code) return m.tanks[i];
      }
      var key = 'code:' + code;
      var n = m.nodes[key];
      if (!n) {
        n = { key: key, kind: 'equipment', code: code, label: equipLabel(code, fallbackLabel),
              point_item_id: null, point_kind: null, group: 'Equipment' };
        m.nodes[key] = n;
        m.equipment.push(n);
      }
      if (point && !n.point_item_id) {
        n.point_item_id = point.item_id || null;
        n.point_kind = point.kind || null;
      }
      return n;
    }

    // Points from the rounds config. One with no asset code can still be
    // picked (by override) and still written, it just cannot be attached.
    (world.points || []).forEach(function (p) {
      if (!p) return;
      if (str(p.code)) { addCode(p.code, p.label, p); return; }
      if (!p.item_id) return;
      var key = 'point:' + p.item_id;
      if (m.nodes[key]) return;
      var n = { key: key, kind: 'point', code: null, label: p.label || 'Unnamed',
                point_item_id: p.item_id, point_kind: p.kind || null, group: 'Equipment' };
      m.nodes[key] = n;
      m.equipment.push(n);
    });

    // Items.
    var list = Array.isArray(world.items) ? world.items
             : Object.keys(world.items || {}).map(function (k) { return world.items[k]; });
    list.forEach(function (it) {
      if (!it || !it.item_id) return;
      m.items[it.item_id] = it;
      var codes = itemCodes(it);
      var pol = it.policy || {};
      var tankIds = [];
      if (pol.tank_id) tankIds.push(pol.tank_id);
      m.tanks.forEach(function (t) {
        if (!t.code) return;
        for (var i = 0; i < codes.length; i++) {
          if (codes[i] === t.code) { tankIds.push(t.tank_id); break; }
        }
      });
      tankIds = uniq(tankIds);
      if (!(pol.fluid === true || tankIds.length)) return;
      if (it.archived) return;
      var f = { item_id: it.item_id, name: it.name || it.item_id, unit: it.unit || '',
                codes: codes, tank_ids: tankIds };
      m.fluids.push(f);
      m.fluidById[it.item_id] = f;
      // Every component an oil is linked to is somewhere oil can go, whether
      // or not the rounds config has an add-oil line for it.
      codes.forEach(function (c) { addCode(c, null, null); });
    });
    m.fluids.sort(function (a, b) { return a.name.localeCompare(b.name); });

    // Machines that history says have had oil, so an old destination is still
    // on the override list even if nobody has linked it.
    m.logs.forEach(function (e) { if (e && e.equipment_code) addCode(e.equipment_code, null, null); });

    m.equipment.sort(function (a, b) { return a.label.localeCompare(b.label); });
    return m;
  }

  // Stores locations holding this item, as From nodes. Negative and zero
  // balances are left off: nobody pours from an empty shelf.
  function locationNodes(m, itemId) {
    var it = m.items[itemId];
    if (!it) return [];
    var out = [];
    var by = it.by_location || {};
    Object.keys(by).forEach(function (loc) {
      var qty = Number(by[loc]);
      if (!(qty > 0)) return;
      out.push(locationNode(m, itemId, loc, qty));
    });
    out.sort(function (a, b) { return b.qty - a.qty; });
    return out;
  }
  function locationNode(m, itemId, loc, qty) {
    var it = m.items[itemId] || {};
    var key = 'loc:' + loc;
    return {
      key: key, kind: 'location', location_id: loc, item_id: itemId,
      qty: (qty === undefined) ? Number((it.by_location || {})[loc]) || 0 : qty,
      unit: it.unit || '',
      label: (loc === 'unassigned' ? 'Stores — no stowage recorded' : 'Stores — ' + m.locName(loc)),
      group: 'Stores'
    };
  }

  function nodeByKey(m, key, itemId) {
    if (!key) return null;
    if (m.nodes[key]) return m.nodes[key];
    if (key.indexOf('loc:') === 0) return locationNode(m, itemId, key.slice(4));
    return null;
  }

  // Is this item attached to this node, from this side?
  function attached(m, itemId, node, side) {
    if (!node) return false;
    var f = m.fluidById[itemId];
    var it = m.items[itemId];
    if (node.kind === 'tank') {
      if (side === 'to' && node.category === WASTE) return true;
      return !!(f && f.tank_ids.indexOf(node.tank_id) >= 0);
    }
    if (node.kind === 'equipment') {
      var codes = f ? f.codes : itemCodes(it);
      for (var i = 0; i < codes.length; i++) if (linkReaches(m, codes[i], node.code)) return true;
      return false;
    }
    if (node.kind === 'location') {
      return !!(it && node.item_id === itemId && Number((it.by_location || {})[node.location_id]) > 0);
    }
    return false;
  }

  // ── Precedent ──────────────────────────────────────────────────────────────

  // The oils a past row moved. Rows written from here on carry item_id; older
  // ones are credited to every fluid linked to the tank they came out of. A
  // tank holds one product, and two items on it are that product bought two
  // ways — Rando 46 in bulk and in drums — so their history is the same history.
  function rowItems(m, e) {
    if (e.item_id) return [e.item_id];
    if (!e.from_tank_id) return [];
    return m.fluids.filter(function (f) { return f.tank_ids.indexOf(e.from_tank_id) >= 0; })
      .map(function (f) { return f.item_id; });
  }
  function rowFrom(e) {
    if (e.from_tank_id) return 'tank:' + e.from_tank_id;
    if (e.from_location_id) return 'loc:' + e.from_location_id;
    if (e.equipment_side === 'from' && e.equipment_code) return 'code:' + str(e.equipment_code);
    return null;
  }
  function rowTo(e) {
    if (e.to_tank_id) return 'tank:' + e.to_tank_id;
    if (e.equipment_side !== 'from' && e.equipment_code) return 'code:' + str(e.equipment_code);
    return null;
  }
  // A code that is a tank's code is keyed as the tank.
  function canon(m, key) {
    if (!key || key.indexOf('code:') !== 0) return key;
    var code = key.slice(5);
    for (var i = 0; i < m.tanks.length; i++) if (m.tanks[i].code === code) return m.tanks[i].key;
    return key;
  }

  // { from: [{key, n, last}], to: [...] } for one oil, optionally holding the
  // other end fixed. Corrections are level fixes, not movements, and are left out.
  function precedent(m, itemId, fixed) {
    fixed = fixed || {};
    var tallies = { from: {}, to: {} };
    m.logs.forEach(function (e) {
      if (!e || e.to_type === 'correction' && !e.equipment_code) return;
      if (rowItems(m, e).indexOf(itemId) < 0) return;
      var fk = canon(m, rowFrom(e)), tk = canon(m, rowTo(e));
      function tally(side, key) {
        if (!key) return;
        var t = tallies[side][key] || (tallies[side][key] = { key: key, n: 0, last: '' });
        t.n++;
        if ((e.timestamp || '') > t.last) t.last = e.timestamp || '';
      }
      if (!fixed.to || fixed.to === tk) tally('from', fk);
      if (!fixed.from || fixed.from === fk) tally('to', tk);
    });
    function ranked(side) {
      return Object.keys(tallies[side]).map(function (k) { return tallies[side][k]; })
        .sort(function (a, b) { return (b.n - a.n) || (b.last < a.last ? -1 : b.last > a.last ? 1 : 0); });
    }
    return { from: ranked('from'), to: ranked('to') };
  }

  // ── The filter ─────────────────────────────────────────────────────────────
  //
  // sel = { item_id, from, to, override: { oil, from, to } }
  //   from / to are node keys ('tank:…', 'code:…', 'point:…', 'loc:…'), or
  //   'other' for a write-in, or empty.
  //
  // Returns {
  //   oils: [fluid + { attached }],  from: [node + { attached }],  to: [...],
  //   suggest: { from, to },         // keys, or null
  //   fromNode, toNode               // the resolved selections
  // }
  function options(m, sel) {
    sel = sel || {};
    var ov = sel.override || {};
    var itemId = sel.item_id || '';
    var fromNode = (sel.from && sel.from !== 'other') ? nodeByKey(m, sel.from, itemId) : null;
    var toNode   = (sel.to   && sel.to   !== 'other') ? nodeByKey(m, sel.to, itemId)   : null;

    // Oils: every fluid attached to whichever ends are chosen. An item picked
    // by override that is not a fluid still shows, so the selection is visible.
    var oils = m.fluids.map(function (f) {
      var ok = (!fromNode || attached(m, f.item_id, fromNode, 'from')) &&
               (!toNode   || attached(m, f.item_id, toNode, 'to'));
      return { item_id: f.item_id, name: f.name, unit: f.unit, codes: f.codes, attached: ok };
    });
    if (itemId && !m.fluidById[itemId] && m.items[itemId]) {
      var it = m.items[itemId];
      oils.push({ item_id: itemId, name: it.name || itemId, unit: it.unit || '',
                  codes: itemCodes(it), attached: false, not_fluid: true });
    }
    if (!ov.oil) oils = oils.filter(function (o) { return o.attached || o.item_id === itemId; });

    // Which oils the two ends are judged against: the chosen one, or — when
    // none is chosen — every oil still standing after the other end's filter.
    function candidates(otherNode, otherSide) {
      if (itemId) return [itemId];
      return m.fluids.filter(function (f) {
        return !otherNode || attached(m, f.item_id, otherNode, otherSide);
      }).map(function (f) { return f.item_id; });
    }

    function slot(side, universe, otherNode, otherSide, current) {
      var cands = candidates(otherNode, otherSide);
      var unfiltered = !itemId && !otherNode;
      var out = universe.map(function (n) {
        var ok = unfiltered || cands.some(function (id) { return attached(m, id, n, side); });
        return Object.assign({}, n, { attached: ok });
      });
      if (!ov[side]) out = out.filter(function (n) { return n.attached || n.key === current; });
      // The same place at both ends is not a movement.
      var otherKey = otherNode && otherNode.key;
      return out.filter(function (n) { return n.key !== otherKey; });
    }

    var fromUniverse = m.tanks.filter(function (t) { return t.category === LUBE || ov.from; })
      .concat(itemId ? locationNodes(m, itemId) : [])
      .concat(m.equipment);
    var toUniverse = m.tanks.concat(m.equipment);

    var from = slot('from', fromUniverse, toNode, 'to', sel.from);
    var to   = slot('to', toUniverse, fromNode, 'from', sel.to);

    // Suggestions only for a chosen oil, and only among what is on the list.
    var suggest = { from: null, to: null };
    if (itemId) {
      var p = precedent(m, itemId, { from: fromNode && fromNode.key, to: toNode && toNode.key });
      var onFrom = {}, onTo = {};
      from.forEach(function (n) { if (n.attached) onFrom[n.key] = true; });
      to.forEach(function (n) { if (n.attached && !(n.kind === 'tank' && n.category === WASTE)) onTo[n.key] = true; });
      var pf = p.from.filter(function (t) { return onFrom[t.key]; })[0];
      var pt = p.to.filter(function (t) { return onTo[t.key]; })[0];
      suggest.from = pf ? pf.key : null;
      suggest.to   = pt ? pt.key : null;
      // No history: the oil's own lube tank, then the fullest shelf.
      if (!suggest.from) {
        var home = from.filter(function (n) { return n.attached && n.kind === 'tank' && n.category === LUBE; })[0]
                || from.filter(function (n) { return n.attached && n.kind === 'location'; })[0];
        suggest.from = home ? home.key : null;
      }
      // With one attached machine and no history, that machine.
      if (!suggest.to) {
        var machines = to.filter(function (n) { return n.attached && n.kind === 'equipment'; });
        if (machines.length === 1) suggest.to = machines[0].key;
      }
    }

    return { oils: oils, from: from, to: to, suggest: suggest, fromNode: fromNode, toNode: toNode };
  }

  // Which slots were filled with something the attachments did not allow.
  // Empty when everything chosen was attached — the ordinary case.
  function overridesUsed(m, sel) {
    sel = sel || {};
    var itemId = sel.item_id;
    var out = [];
    if (!itemId) return out;
    var fromNode = (sel.from && sel.from !== 'other') ? nodeByKey(m, sel.from, itemId) : null;
    var toNode   = (sel.to   && sel.to   !== 'other') ? nodeByKey(m, sel.to, itemId)   : null;
    if (!m.fluidById[itemId]) out.push('oil');
    if (fromNode && !attached(m, itemId, fromNode, 'from')) out.push('from');
    if (toNode && !attached(m, itemId, toNode, 'to')) out.push('to');
    return out;
  }

  // The fields every writer puts on a lube_log / waste_log row for the oil.
  // `fluid` is the name as read now, so the row still says what it was after
  // the item is renamed or archived; `item_id` is what it traces by.
  function entryFields(m, sel) {
    sel = sel || {};
    var out = {};
    var it = sel.item_id ? m.items[sel.item_id] : null;
    if (it) { out.item_id = it.item_id; out.fluid = it.name || it.item_id; }
    else if (str(sel.fluid_text)) { out.item_id = null; out.fluid = str(sel.fluid_text); }
    var from = (sel.from && sel.from.indexOf('loc:') === 0) ? sel.from.slice(4) : null;
    if (from) out.from_location_id = from;
    var used = overridesUsed(m, sel);
    if (used.length) out.attachment_override = used;
    return out;
  }

  // ── The rows a movement leaves in fuelstate.json ───────────────────────────
  //
  // One writer for both surfaces. It was the phone's addOilApplyTankDeltas, and
  // the Console's Lube panel wrote a narrower shape of its own; two writers is
  // how the two logs came to disagree about signs and machines in the first
  // place (IDMS-Console docs/oil-history.md).
  //
  //   data = { lube_log: [], waste_log: [] }       mutated in place
  //   spec = {
  //     from: { kind, tank_id }, to: { kind, tank_id }
  //           kind: 'lube_tank' | 'waste_tank' | 'equipment' | 'inspection_tank'
  //                 | 'location' | 'other'
  //     qty, machine: { code, item_id, label, side: 'to'|'from' } | null,
  //     oil:  entryFields() output, sourceLabel, actor, source ('pwa'|'console'),
  //     now:  ISO string, nextId: number
  //   }
  //   io   = { get(tank_id) -> volume, set(tank_id, volume) -> stored volume }
  //          so each app keeps its own rounding and clamping.
  //
  // Returns { sourceRetained, destRetained, rows: [{ lane, entry }] }.
  //
  // Quantities are unsigned; to_type says which way. A tank-to-tank move in
  // one lane is ONE row carrying both tank ids — it used to be two, and the
  // log showed every lube-to-lube transfer twice. Across lanes (lube tank into
  // a waste tank) each lane gets its own row, because each lane is read alone.
  function writeMovement(data, spec, io) {
    if (!Array.isArray(data.lube_log)) data.lube_log = [];
    if (!Array.isArray(data.waste_log)) data.waste_log = [];
    var qty = Math.abs(Number(spec.qty)) || 0;
    var now = spec.now || new Date().toISOString();
    var nextId = Number(spec.nextId) || Date.now();
    var from = spec.from || {}, to = spec.to || {};
    var mach = spec.machine || null;
    var oil = spec.oil || {};
    var rows = [];
    var out = { sourceRetained: null, destRetained: null, rows: rows };

    function isTank(k) { return k === 'lube_tank' || k === 'waste_tank'; }
    function lane(k) { return k === 'waste_tank' ? 'waste_log' : 'lube_log'; }
    function push(laneName, entry, side) {
      if (mach && mach.side === side) {
        entry.equipment_id    = mach.item_id || null;
        entry.equipment_code  = mach.code    || null;
        entry.equipment_label = mach.label   || null;
        if (side === 'from') entry.equipment_side = 'from';
      }
      Object.keys(oil).forEach(function (k) { if (entry[k] === undefined) entry[k] = oil[k]; });
      if (!entry.from_tank_id && !entry.from_description && spec.sourceLabel) {
        entry.from_description = spec.sourceLabel;
      }
      if (spec.actor) entry.correction_by = spec.actor;
      entry.source = spec.source || null;
      data[laneName].push(entry);
      rows.push({ lane: laneName, entry: entry });
      return entry;
    }

    var srcTank = isTank(from.kind) && from.tank_id ? from.tank_id : null;
    var dstTank = isTank(to.kind) && to.tank_id ? to.tank_id : null;
    var sameLane = srcTank && dstTank && lane(from.kind) === lane(to.kind);

    if (srcTank) {
      out.sourceRetained = io.set(srcTank, Number(io.get(srcTank) || 0) - qty);
      if (sameLane) out.destRetained = io.set(dstTank, Number(io.get(dstTank) || 0) + qty);
      push(lane(from.kind), {
        id: nextId++, timestamp: now,
        from_tank_id: srcTank,
        to_tank_id: sameLane ? dstTank : (dstTank && from.kind === 'lube_tank' ? dstTank : null),
        quantity: qty,
        to_type: dstTank ? 'tank' : (from.kind === 'waste_tank' ? 'correction' : 'equipment'),
        qty_remaining: out.sourceRetained
      }, 'to');
    }

    if (dstTank && !sameLane) {
      out.destRetained = io.set(dstTank, Number(io.get(dstTank) || 0) + qty);
      // A machine draining into a waste tank is recorded here, on the row that
      // credits the tank: the machine has no volume of its own to debit.
      push(lane(to.kind), {
        id: nextId++, timestamp: now,
        from_tank_id: srcTank,
        to_tank_id: dstTank,
        quantity: qty,
        to_type: 'tank',
        qty_remaining: out.destRetained
      }, 'from');
    }

    // A machine at one end and no tracked tank at the other: a pail into a head
    // tank, a drum into a gearbox. Still oil into (or out of) a machine.
    if (mach && !rows.length) {
      push('lube_log', {
        id: nextId++, timestamp: now,
        from_tank_id: null, to_tank_id: null,
        quantity: qty,
        to_type: mach.side === 'from' ? 'drain' : 'equipment',
        qty_remaining: null
      }, mach.side);
    }
    return out;
  }

  var api = {
    build: build,
    writeMovement: writeMovement,
    options: options,
    attached: attached,
    precedent: precedent,
    overridesUsed: overridesUsed,
    entryFields: entryFields,
    nodeByKey: nodeByKey,
    locationNodes: locationNodes,
    codeRelated: codeRelated,
    linkReaches: linkReaches,
    issuesStock: issuesStock,
    itemCodes: itemCodes
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.oilAttach = api;
})(typeof window !== 'undefined' ? window : this);
