'use strict';

// The register's search box — one grammar, two evaluators (IDMS-SCHEMA §42.18).
//
// The Requisitions register is one grid over two stores: 8,689 TM Master orders
// in SQLite, and the pre-drafts this Console authored, which live in the reduced
// event stream and are always held whole in the renderer. A search has to mean
// the same thing on both halves or the grid is lying — a row would appear or
// vanish depending on which store it came from.
//
// So the query is parsed ONCE into an AST here, and the AST is walked twice:
// `toSql` compiles it to a WHERE fragment for the 8,689, `matches` evaluates it
// against one merged row object for the few. Both walks read the same FIELDS
// table below, which is the only place a field is defined — the SQL column and
// the row accessor sit on the same line, so a field added to one cannot be
// forgotten in the other.
//
// UMD, for the same reason procurement-reduce.js is: main.js requires it to
// build the WHERE clause, the renderer loads it as a script, and Node tests it.
// There is no second copy of this grammar anywhere.
//
// The grammar, in the order a reader meets it:
//
//   belting                      a word, matched anywhere in the searchable fields
//   "bow thruster"               a phrase, matched as one string
//   belt*                        * is any run of characters, ? is exactly one
//   belt OR belting              either
//   belt -green                  the first without the second (- and NOT are the same)
//   dept:machine                 one named field
//   status:"on order"            a named field with a phrase
//   price>5000                   a comparison, on the fields that carry numbers
//   approved>=2026-01            a comparison, on the fields that carry dates
//   (belt OR hose) dept:factory  brackets, and an implied AND between terms
//
// Two rules worth stating because they are choices and not conventions:
//
// 1. **Adjacent terms are ANDed.** `brunvoll thruster` finds the one order, not
//    everything mentioning either word. That is what the register's old search
//    did over its six columns, and changing it would silently widen every habit
//    the crew already has.
// 2. **A term carrying a wildcard is anchored; a term without one is not.**
//    `belt` finds "Roughtop Belt"; `belt*` finds only what starts with it. A
//    wildcard is somebody being specific, and a `*` that still matched anywhere
//    would be a character with no effect.

(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) module.exports = factory();
  else root.procQuery = factory();
}(typeof self !== 'undefined' ? self : this, function () {

  // ── The field table ────────────────────────────────────────────────────────
  //
  // `col`      the SQL column on procurement_orders, or null for a field the
  //            TM half does not carry.
  // `get`      how the same field is read off a merged register row.
  // `constant` for a virtual field whose value is fixed for every TM row, so a
  //            predicate against it is decided at compile time rather than being
  //            unexpressible in SQL — see compileTerm.
  // `type`     text | num | date | bool. Decides what a comparison means.
  // `search`   whether a bare word with no field name looks here. The same six
  //            the register searched before this grammar existed, plus the two
  //            a pre-draft is actually identified by.

  var FIELDS = {
    order_no:     { col: 'order_no',     get: function (r) { return r.order_no; },     type: 'text', search: true,
                    aliases: ['no', 'order', 'number'] },
    name:         { col: 'name',         get: function (r) { return r.name; },         type: 'text', search: true,
                    aliases: ['subject', 'desc', 'description', 'title'] },
    supplier:     { col: 'supplier',     get: function (r) { return r.supplier; },     type: 'text', search: true,
                    aliases: ['sup', 'vendor'] },
    our_ref:      { col: 'our_ref',      get: function (r) { return r.our_ref; },      type: 'text', search: true,
                    aliases: ['ref', 'by', 'requester', 'raised'] },
    invoice_ref:  { col: 'invoice_ref',  get: function (r) { return r.invoice_ref; },  type: 'text', search: true,
                    aliases: ['invoice'] },
    docking_item: { col: 'docking_item', get: function (r) { return r.docking_item; }, type: 'text', search: true,
                    aliases: ['yard', 'dockitem'] },
    department:   { col: 'department',   get: function (r) { return r.department; },   type: 'text', search: true,
                    aliases: ['dept'] },
    status:       { col: 'status',       get: function (r) { return r.status; },       type: 'text', search: true },

    order_type:   { col: 'order_type',   get: function (r) { return r.order_type; },   type: 'text', aliases: ['type'] },
    suppliers_ref:{ col: 'suppliers_ref',get: function (r) { return r.suppliers_ref; },type: 'text', aliases: ['supref'] },
    // The resolved contact id, which is how the Contacts screen hands a whole
    // supplier over to the register. Exact rather than fuzzy on purpose: the
    // seed resolved that match once and nothing downstream re-derives it (§2).
    supplier_id:  { col: 'supplier_id', get: function (r) { return r.supplier_id; }, type: 'text',
                    aliases: ['con', 'contact'] },
    currency:     { col: 'currency',     get: function (r) { return r.currency; },     type: 'text', aliases: ['cur'] },
    port_name:    { col: 'port_name',    get: function (r) { return r.port_name; },    type: 'text', aliases: ['port'] },
    project:      { col: 'project',      get: function (r) { return r.project; },      type: 'text' },
    component:    { col: 'component',    get: function (r) { return r.component; },    type: 'text', aliases: ['comp'] },
    docking:      { col: 'docking',      get: function (r) { return r.docking; },      type: 'text', aliases: ['dock'] },
    cost_code:    { col: 'cost_code',    get: function (r) { return r.cost_code; },    type: 'text', aliases: ['cost'] },
    year:         { col: 'year',         get: function (r) { return r.year; },         type: 'text' },

    total_price:  { col: 'total_price',  get: function (r) { return r.total_price; },  type: 'num',
                    aliases: ['price', 'total', 'value'] },
    line_count:   { col: null, constant: null, get: function (r) { return r.line_count; }, type: 'num',
                    aliases: ['lines'] },

    approved_date:    { col: 'approved_date',    get: function (r) { return r.approved_date; },    type: 'date', aliases: ['approved'] },
    last_approved:    { col: 'last_approved',    get: function (r) { return r.last_approved; },    type: 'date' },
    delivery_date:    { col: 'delivery_date',    get: function (r) { return r.delivery_date; },    type: 'date', aliases: ['delivered', 'delivery'] },
    required_onboard: { col: 'required_onboard', get: function (r) { return r.required_onboard; }, type: 'date', aliases: ['needed', 'onboard'] },
    invoice_date:     { col: 'invoice_date',     get: function (r) { return r.invoice_date; },     type: 'date', aliases: ['invoiced'] },
    created_at:       { col: null, constant: null, get: function (r) { return r.created_at; },     type: 'date', aliases: ['created'] },

    is_open:       { col: 'is_open',  get: function (r) { return r.is_open; },  type: 'bool', aliases: ['open'] },
    critical:      { col: 'critical', get: function (r) { return r.critical; }, type: 'bool' },
    asap:          { col: 'asap',     get: function (r) { return r.asap; },     type: 'bool' },
    approved_flag: { col: 'approved', get: function (r) { return r.approved; }, type: 'bool', aliases: ['isapproved'] },
    paid:          { col: 'paid',     get: function (r) { return r.paid; },     type: 'bool' },

    // Which half of the register a row came from. Fixed for every TM row, so
    // `source:aboard` compiles to a constant false rather than to a column that
    // does not exist — the difference between a filter that works and a filter
    // that quietly returns the whole register.
    source: { col: null, constant: 'tm', get: function (r) { return r.source; }, type: 'text',
              aliases: ['from', 'half'] }
  };

  var ALIAS = (function () {
    var m = {};
    for (var k in FIELDS) {
      m[k] = k;
      (FIELDS[k].aliases || []).forEach(function (a) { m[a] = k; });
    }
    return m;
  }());

  var SEARCHABLE = Object.keys(FIELDS).filter(function (k) { return FIELDS[k].search; });

  // What the help panel lists. Canonical name first, aliases after, so a reader
  // learns the real spelling and still finds the short one.
  function fieldHelp() {
    return Object.keys(FIELDS).map(function (k) {
      return { field: k, aliases: FIELDS[k].aliases || [], type: FIELDS[k].type,
               searched: !!FIELDS[k].search };
    });
  }

  // ── Lexer ──────────────────────────────────────────────────────────────────

  var OPS = ['>=', '<=', '!=', ':', '=', '>', '<'];

  function matchOp(s, i) {
    for (var o = 0; o < OPS.length; o++) {
      if (s.substr(i, OPS[o].length) === OPS[o]) return OPS[o];
    }
    return null;
  }

  function lex(src) {
    var toks = [], i = 0, s = String(src == null ? '' : src);
    while (i < s.length) {
      var c = s[i];
      if (/\s/.test(c)) { i++; continue; }
      if (c === '(' || c === ')') { toks.push({ t: c }); i++; continue; }
      if (c === '|') { toks.push({ t: 'OR' });  i++; continue; }
      if (c === '&') { toks.push({ t: 'AND' }); i++; continue; }
      // A leading - or ! negates the term that follows. Mid-word it is just a
      // character: ARA-407 is an order number, not "ARA without 407".
      if ((c === '-' || c === '!') && (i === 0 || /[\s(|&]/.test(s[i - 1]))) {
        toks.push({ t: 'NOT' }); i++; continue;
      }
      if (c === '"' || c === "'") {
        var quote = c, buf = '';
        i++;
        while (i < s.length && s[i] !== quote) {
          if (s[i] === '\\' && i + 1 < s.length) { buf += s[i + 1]; i += 2; }
          else { buf += s[i]; i++; }
        }
        if (i >= s.length) throw new Error('Unclosed quote — add a closing ' + quote);
        i++;
        toks.push({ t: 'WORD', v: buf, quoted: true });
        continue;
      }
      var op = matchOp(s, i);
      if (op) { toks.push({ t: 'OP', v: op }); i += op.length; continue; }
      var word = '';
      while (i < s.length && !/[\s()|&"']/.test(s[i]) && !matchOp(s, i)) { word += s[i]; i++; }
      if (!word) throw new Error('Cannot read "' + s[i] + '" here');
      var up = word.toUpperCase();
      if (up === 'OR')  { toks.push({ t: 'OR' });  continue; }
      if (up === 'AND') { toks.push({ t: 'AND' }); continue; }
      if (up === 'NOT') { toks.push({ t: 'NOT' }); continue; }
      toks.push({ t: 'WORD', v: word });
    }
    return toks;
  }

  // ── Parser ─────────────────────────────────────────────────────────────────
  //
  // Nodes: {k:'and'|'or', a, b} · {k:'not', a} · {k:'term', field, op, value}
  // A term whose field is null is the bare-word case and looks at every
  // searchable field. {k:'all'} is the empty query.

  // `alias` is the name table the field names are resolved against — the
  // register's own unless a bound grammar (see `grammar` below) passes its own.
  function parse(src, alias) {
    alias = alias || ALIAS;
    var toks = lex(src), pos = 0;

    function peek() { return toks[pos]; }
    function eat(t) { if (toks[pos] && toks[pos].t === t) { pos++; return true; } return false; }

    function parseOr() {
      var left = parseAnd();
      while (peek() && peek().t === 'OR') {
        pos++;
        var right = parseAnd();
        if (!right) throw new Error('Nothing after OR');
        left = { k: 'or', a: left, b: right };
      }
      return left;
    }

    function parseAnd() {
      var left = parseUnary();
      for (;;) {
        var explicit = peek() && peek().t === 'AND';
        if (explicit) pos++;
        var t = peek();
        if (!t || t.t === 'OR' || t.t === ')') {
          if (explicit) throw new Error('Nothing after AND');
          break;
        }
        var right = parseUnary();
        if (!right) break;
        left = { k: 'and', a: left, b: right };
      }
      return left;
    }

    function parseUnary() {
      if (eat('NOT')) {
        var inner = parseUnary();
        if (!inner) throw new Error('Nothing after NOT');
        return { k: 'not', a: inner };
      }
      return parsePrimary();
    }

    function parsePrimary() {
      if (eat('(')) {
        var e = parseOr();
        if (!eat(')')) throw new Error('Unclosed bracket');
        return e;
      }
      var t = peek();
      if (!t) return null;
      if (t.t !== 'WORD') throw new Error('Unexpected ' + (t.v || t.t) + ' here');
      pos++;
      // field:value — only when the word was not quoted. "dept:machine" in
      // quotes is somebody searching for that literal string.
      var nxt = peek();
      if (!t.quoted && nxt && nxt.t === 'OP') {
        var key = alias[t.v.toLowerCase()];
        if (!key) throw new Error('No field called "' + t.v + '"');
        pos++;
        var vt = peek();
        if (!vt || vt.t !== 'WORD') throw new Error('Nothing after ' + t.v + nxt.v);
        pos++;
        return { k: 'term', field: key, op: nxt.v, value: vt.v, quoted: !!vt.quoted };
      }
      return { k: 'term', field: null, op: ':', value: t.v, quoted: !!t.quoted };
    }

    var ast = parseOr();
    if (pos < toks.length) throw new Error('Unexpected ' + (toks[pos].v || toks[pos].t) + ' here');
    return ast || { k: 'all' };
  }

  // Parse without throwing, because the search box is typed into a character at
  // a time and half a query is not an error worth a stack trace — it is a line
  // under the box saying what is missing.
  function tryParse(src) {
    try { return { ok: true, ast: parse(src) }; }
    catch (e) { return { ok: false, error: e.message }; }
  }

  // ── Matching one value ─────────────────────────────────────────────────────

  function hasWildcard(v) { return /[*?]/.test(v); }

  function toRegExp(v) {
    var out = '';
    for (var i = 0; i < v.length; i++) {
      var c = v[i];
      if (c === '*') out += '.*';
      else if (c === '?') out += '.';
      else out += c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
    return new RegExp('^' + out + '$', 'i');
  }

  function num(v) {
    if (v === null || v === undefined || v === '') return null;
    var n = Number(v);
    return isFinite(n) ? n : null;
  }

  function truthy(v) {
    if (v === true || v === 1) return true;
    if (v === false || v === 0 || v === null || v === undefined || v === '') return false;
    var s = String(v).toLowerCase();
    return s === '1' || s === 'true' || s === 'yes' || s === 'y';
  }

  function boolWanted(value) {
    var s = String(value).toLowerCase();
    return !(s === 'no' || s === 'false' || s === '0' || s === 'n');
  }

  // One field, one operator, one value. `type` decides what the operator means,
  // which is what makes `year>2023` and `approved>=2026-01` both do the obvious
  // thing over columns that are text in the database.
  function compare(actual, op, value, type) {
    if (type === 'bool') return truthy(actual) === boolWanted(value);

    if (op === ':' || op === '=') {
      var a = actual === null || actual === undefined ? '' : String(actual);
      if (op === '=') return a.toLowerCase() === String(value).toLowerCase();
      if (hasWildcard(value)) return toRegExp(value).test(a);
      return a.toLowerCase().indexOf(String(value).toLowerCase()) !== -1;
    }
    if (op === '!=') return !compare(actual, '=', value, type);

    if (type === 'num') {
      var x = num(actual), y = num(value);
      if (x === null || y === null) return false;
      return op === '>' ? x > y : op === '>=' ? x >= y : op === '<' ? x < y : x <= y;
    }
    // text and date alike: a lexicographic comparison, which is the right one
    // for ISO dates and for the four-digit year column.
    var s1 = actual === null || actual === undefined ? '' : String(actual);
    if (s1 === '') return false;      // an empty cell is not greater than anything
    var s2 = String(value).toLowerCase();
    s1 = s1.toLowerCase();
    return op === '>' ? s1 > s2 : op === '>=' ? s1 >= s2 : op === '<' ? s1 < s2 : s1 <= s2;
  }

  // ── Evaluator: one merged register row ─────────────────────────────────────

  // A field may answer with a list — "either part number" is one question put
  // to two columns — and then any one of them satisfying the term is enough.
  function compareAny(actual, op, value, type) {
    if (!Array.isArray(actual)) return compare(actual, op, value, type);
    // != has to hold of all of them, or `pn!=X` is true of the item that IS X
    // the moment it carries a second number.
    if (op === '!=') return actual.every(function (v) { return compare(v, op, value, type); });
    return actual.some(function (v) { return compare(v, op, value, type); });
  }

  function matches(ast, row, fields, searchable) {
    fields = fields || FIELDS;
    searchable = searchable || SEARCHABLE;
    if (!ast) return true;
    switch (ast.k) {
      case 'all': return true;
      case 'and': return matches(ast.a, row, fields, searchable) && matches(ast.b, row, fields, searchable);
      case 'or':  return matches(ast.a, row, fields, searchable) || matches(ast.b, row, fields, searchable);
      case 'not': return !matches(ast.a, row, fields, searchable);
      case 'term':
        if (ast.field) {
          var f = fields[ast.field];
          return compareAny(f.get(row), ast.op, ast.value, f.type);
        }
        for (var i = 0; i < searchable.length; i++) {
          var sf = fields[searchable[i]];
          if (compareAny(sf.get(row), ':', ast.value, sf.type)) return true;
        }
        return false;
    }
    return true;
  }

  // ── The same grammar over somebody else's rows ─────────────────────────────
  //
  // The lexer, the parser and the evaluator know nothing about orders; only the
  // field table does. So a second list that wants this search box — the Stock
  // sheet was the first — brings a table of its own and gets the grammar bound
  // to it, rather than a second parser that would drift from this one the first
  // time either learned a new operator.
  //
  // A table entry is `{ get, type, search, aliases }`, as above, without `col`:
  // a bound grammar is evaluated in memory and is never compiled to SQL.
  function grammar(fields) {
    var alias = {};
    Object.keys(fields).forEach(function (k) {
      alias[k] = k;
      (fields[k].aliases || []).forEach(function (a) { alias[a] = k; });
    });
    var searchable = Object.keys(fields).filter(function (k) { return fields[k].search; });
    return {
      FIELDS: fields,
      SEARCHABLE: searchable,
      resolveField: function (name) { return alias[String(name || '').toLowerCase()] || null; },
      parse: function (src) { return parse(src, alias); },
      tryParse: function (src) {
        try { return { ok: true, ast: parse(src, alias) }; }
        catch (e) { return { ok: false, error: e.message }; }
      },
      matches: function (ast, row) { return matches(ast, row, fields, searchable); },
      fieldHelp: function () {
        return Object.keys(fields).map(function (k) {
          return { field: k, aliases: fields[k].aliases || [], type: fields[k].type,
                   searched: !!fields[k].search };
        });
      }
    };
  }

  // ── Compiler: a WHERE fragment over procurement_orders ─────────────────────
  //
  // Returns { sql, args }, args being the named-parameter object better-sqlite3
  // wants. Parameter names come from a counter carried through the walk, so
  // nothing here interpolates a typed character into SQL.

  function like(value) {
    // LIKE's own metacharacters are escaped first, then the query's wildcards
    // are translated into them. The order matters: escaping afterwards would
    // escape the % this function just produced.
    var esc = String(value).replace(/[\\%_]/g, '\\$&');
    if (hasWildcard(value)) return esc.replace(/\*/g, '%').replace(/\?/g, '_');
    return '%' + esc + '%';
  }

  function compileTerm(node, ctx) {
    function param(v) {
      var k = 'pq' + (ctx.n++);
      ctx.args[k] = v;
      return '@' + k;
    }

    function one(key) {
      var f = FIELDS[key];
      // A field the TM half does not carry. Its value is the same for every row
      // in this table, so the predicate is settled here and becomes 1 or 0.
      if (!f.col) return compare(f.constant, node.op, node.value, f.type) ? '1' : '0';

      var col = f.col;
      if (f.type === 'bool') {
        return 'COALESCE(' + col + ',0) = ' + (boolWanted(node.value) ? '1' : '0');
      }
      if (node.op === ':') {
        return 'LOWER(COALESCE(' + col + ",'')) LIKE " + param(like(node.value).toLowerCase()) + " ESCAPE '\\'";
      }
      if (node.op === '=') {
        return 'LOWER(COALESCE(' + col + ",'')) = " + param(String(node.value).toLowerCase());
      }
      if (node.op === '!=') {
        return 'LOWER(COALESCE(' + col + ",'')) != " + param(String(node.value).toLowerCase());
      }
      if (f.type === 'num') {
        var n = num(node.value);
        if (n === null) return '0';
        return '(' + col + ' IS NOT NULL AND ' + col + ' ' + node.op + ' ' + param(n) + ')';
      }
      // NULLIF keeps an empty cell out of the result the way the JS side does —
      // without it every undated order would answer `approved<2020` with a yes.
      return "(NULLIF(" + col + ",'') IS NOT NULL AND LOWER(" + col + ') ' + node.op + ' ' +
             param(String(node.value).toLowerCase()) + ')';
    }

    if (node.field) return '(' + one(node.field) + ')';
    return '(' + SEARCHABLE.map(one).join(' OR ') + ')';
  }

  function compile(ast, ctx) {
    switch (ast.k) {
      case 'all':  return '1';
      case 'and':  return '(' + compile(ast.a, ctx) + ' AND ' + compile(ast.b, ctx) + ')';
      case 'or':   return '(' + compile(ast.a, ctx) + ' OR '  + compile(ast.b, ctx) + ')';
      case 'not':  return '(NOT ' + compile(ast.a, ctx) + ')';
      case 'term': return compileTerm(ast, ctx);
    }
    return '1';
  }

  function toSql(ast) {
    var ctx = { n: 0, args: {} };
    return { sql: compile(ast || { k: 'all' }, ctx), args: ctx.args };
  }

  // ── Ordering ───────────────────────────────────────────────────────────────
  //
  // The same problem the FIELDS table solves, in the other direction. The grid
  // is one list over two stores: main.js orders the 8,689 TM rows in SQL and
  // the renderer merges the pre-drafts into that order in JS. If those two
  // disagree about what "by supplier, descending" means, a pre-draft lands in a
  // position the rows around it do not justify — and it looks like a bug in the
  // data rather than in the sort.
  //
  // So one table again: `sql` is the ORDER BY expression, `get` reads the same
  // value off a merged row, `numeric` says which comparison to use. A column
  // name cannot be a bound parameter, so this table is also what keeps a sort
  // key the renderer sent out of the SQL string.
  //
  // Two rules both readers hold:
  //
  // * **An empty cell reads as the low value, not as nothing.** A missing date
  //   is '0000', so undated orders sit at the bottom of the sort the screen
  //   opens with — newest first — and at the top when it is reversed, which is
  //   what "oldest first" honestly means for a row with no date. Comparing the
  //   raw empty string instead would put them first in BOTH directions in SQL
  //   and last in both in JS, and the two halves of the grid would disagree.
  // * **Every ordering ends in order_no.** Nine years of orders with 1,900
  //   sharing a status would otherwise come back in whatever order SQLite felt
  //   like, and a grid whose rows shuffle under a scroll is unusable.

  var LOW = '0000';

  function dateSort(col) {
    return { sql: "COALESCE(NULLIF(" + col + ",''),'" + LOW + "')",
             get: function (r) { return r[col] || LOW; }, low: LOW };
  }

  var SORTS = {
    // The default. "When was this row about" — the approval for a TM order,
    // and for a pre-draft, which has no approval date and will not have one
    // until somebody decides on it, when it was written. Nothing diverges by
    // reading created_at here: no row in procurement_orders carries one.
    date: {
      sql: "COALESCE(NULLIF(last_approved,''), NULLIF(approved_date,''), NULLIF(invoice_date,''), '" + LOW + "')",
      get: function (r) {
        return r.last_approved || r.approved_date || r.invoice_date ||
               (r.source === 'aboard' ? String(r.created_at || '').slice(0, 10) : '') || LOW;
      },
      low: LOW, defaultDesc: true
    },
    order_no:    { sql: 'order_no',                get: function (r) { return r.order_no || ''; } },
    name:        { sql: "COALESCE(name,'')",       get: function (r) { return r.name || ''; } },
    supplier:    { sql: "COALESCE(supplier,'')",   get: function (r) { return r.supplier || ''; } },
    department:  { sql: "COALESCE(department,'')", get: function (r) { return r.department || ''; } },
    status:      { sql: "COALESCE(status,'')",     get: function (r) { return r.status || ''; } },
    our_ref:     { sql: "COALESCE(our_ref,'')",    get: function (r) { return r.our_ref || ''; } },
    order_type:  { sql: "COALESCE(order_type,'')", get: function (r) { return r.order_type || ''; } },
    currency:    { sql: "COALESCE(currency,'')",   get: function (r) { return r.currency || ''; } },
    year:        { sql: "COALESCE(year,'')",       get: function (r) { return r.year || ''; } },
    invoice_ref: { sql: "COALESCE(invoice_ref,'')",get: function (r) { return r.invoice_ref || ''; } },
    port_name:   { sql: "COALESCE(port_name,'')",  get: function (r) { return r.port_name || ''; } },
    project:     { sql: "COALESCE(project,'')",    get: function (r) { return r.project || ''; } },
    component:   { sql: "COALESCE(component,'')",  get: function (r) { return r.component || ''; } },
    docking:     { sql: "COALESCE(docking,'')",    get: function (r) { return r.docking || ''; } },
    cost_code:   { sql: "COALESCE(cost_code,'')",  get: function (r) { return r.cost_code || ''; } },

    approved_date:    dateSort('approved_date'),
    last_approved:    dateSort('last_approved'),
    delivery_date:    dateSort('delivery_date'),
    required_onboard: dateSort('required_onboard'),
    invoice_date:     dateSort('invoice_date'),

    // -1 for "no price", so an order with none sorts below one that cost
    // nothing. Both are real states and they are not the same state.
    total_price: { sql: 'COALESCE(total_price,-1)', numeric: true,
                   get: function (r) {
                     return (r.total_price === null || r.total_price === undefined) ? -1 : Number(r.total_price);
                   }, defaultDesc: true },
    line_count:  { sql: null, numeric: true,
                   get: function (r) { return Number(r.line_count) || 0; }, defaultDesc: true },
    is_open:     { sql: 'is_open',  numeric: true, get: function (r) { return Number(r.is_open) || 0; }, defaultDesc: true },
    critical:    { sql: 'critical', numeric: true, get: function (r) { return Number(r.critical) || 0; }, defaultDesc: true },
    paid:        { sql: 'paid',     numeric: true, get: function (r) { return Number(r.paid) || 0; }, defaultDesc: true }
  };

  function sortKey(key) { return SORTS[key] ? key : 'date'; }

  function sortDesc(key, dir) {
    if (dir) return String(dir).toLowerCase() === 'desc';
    return !!SORTS[sortKey(key)].defaultDesc;
  }

  // The ORDER BY fragment for procurement_orders. A sort whose value the TM
  // half does not carry (`lines`) orders by nothing but the tiebreak, which is
  // correct: every row in that table has the same answer for it.
  function sqlOrderBy(key, dir) {
    var k = sortKey(key), s = SORTS[k];
    var d = sortDesc(key, dir) ? 'DESC' : 'ASC';
    // COLLATE NOCASE on every text sort, because SQLite's default is BINARY
    // and the JS side lowercases: without it 'Ships Machinery' sorts before
    // 'eBay, Inc.' in the TM half and after it in the pre-draft half, since
    // every capital letter is below every lowercase one in ASCII. The test
    // caught exactly that. A-Z is also the right answer for a reader — a
    // supplier list where the lowercase names are exiled to the bottom is not
    // sorted by anything anybody asked for.
    //
    // One residue, small and stated rather than papered over: NOCASE folds
    // ASCII only, while JS toLowerCase folds Unicode. Two suppliers differing
    // only in the case of a non-ASCII letter would order differently in the two
    // halves. There are none in 1,745 contacts, and the fix would be a custom
    // collation registered on every connection.
    var expr = s.sql ? (s.sql + (s.numeric ? '' : ' COLLATE NOCASE') + ' ' + d + ', ') : '';
    return expr + 'order_no DESC';
  }

  // The same ordering over merged rows.
  function comparator(key, dir) {
    var k = sortKey(key), s = SORTS[k];
    var mul = sortDesc(key, dir) ? -1 : 1;
    return function (a, b) {
      var d;
      if (s.numeric) {
        d = s.get(a) - s.get(b);
      } else {
        var x = String(s.get(a)).toLowerCase(), y = String(s.get(b)).toLowerCase();
        d = x < y ? -1 : x > y ? 1 : 0;
      }
      if (d) return d < 0 ? -mul : mul;
      var oa = a.order_no || '', ob = b.order_no || '';
      return oa < ob ? 1 : oa > ob ? -1 : 0;
    };
  }

  return {
    FIELDS: FIELDS,
    SORTS: SORTS,
    sortKey: sortKey,
    sortDesc: sortDesc,
    sqlOrderBy: sqlOrderBy,
    comparator: comparator,
    SEARCHABLE: SEARCHABLE,
    fieldHelp: fieldHelp,
    resolveField: function (name) { return ALIAS[String(name || '').toLowerCase()] || null; },
    lex: lex,
    parse: parse,
    tryParse: tryParse,
    matches: matches,
    grammar: grammar,
    toSql: toSql
  };
}));
