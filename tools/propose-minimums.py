#!/usr/bin/env python3
"""Propose order minimums from the consumption history that exists (IDMS-SCHEMA 42.15).

Reads the catalogue built by build-procurement-catalogue.py, bands every item by
how much movement history stands behind it, and writes
data/procurement/proposed-minimums.json. NOTHING IS APPLIED: publishing a
proposal as an item_policy_set event is an officer's decision about how the
vessel orders, not a computation.

The honest caveat is printed every run and carried in the output: est_delivery_days
is set on 1 item of 14,487, so lead time is an assumption, and with a 16-day
restock cycle it swings the answer four-fold. Fix that field, or let the module
learn real lead times from po_sent to first receipt, and this gets much better.
"""

OLD_DOC = """Proposed order minimums: what the data actually supports.

Real inputs now:
  restock cycle  = 16 days (median gap between the 19 offloads in scheduleconfig)
  consumption    = TM Master c2024 / c2025 / c2026, 2026 annualised on elapsed year
  lead time      = essentially absent (1 item of 14,487), so it is a stated assumption
"""
import io, json, os, math, collections, datetime, statistics

BASE = r"C:\Users\engineroom\OneDrive - O'Hara Corporation\Documents\IDMS"
doc = json.load(io.open(os.path.join(BASE, 'data', 'procurement', 'catalogue.json'), encoding='utf-8'))
idx = {f: i for i, f in enumerate(doc['item_fields'])}
tables = doc.get('tables', {})


def val(row, f):
    i = idx.get(f)
    if i is None:
        return None
    v = row[i]
    return (None if v is None else tables[f][v]) if f in tables else v


def num(v):
    return v if isinstance(v, (int, float)) and not isinstance(v, bool) else 0


items = doc['items']
N = len(items)
RESTOCK = 16
today = datetime.date(2026, 9, 5)
elapsed = (today - datetime.date(2026, 1, 1)).days / 365.0

rows = []
for r in items:
    a, b, c = num(val(r, 'c2024')), num(val(r, 'c2025')), num(val(r, 'c2026'))
    yrs = sum(1 for v in (a, b, c) if v > 0)
    if yrs == 0:
        continue
    c26a = c / elapsed if elapsed else 0
    seen = [v for v in (a, b, c26a) if v > 0]
    annual = sum((a, b, c26a)) / 3.0                 # zeros count: a year with none is data
    spread = (max(seen) / max(min(seen), 0.0001)) if len(seen) > 1 else None
    rows.append({
        'id': val(r, 'id'), 'name': val(r, 'name'), 'unit': val(r, 'uom'),
        'yrs': yrs, 'annual': annual, 'spread': spread,
        'stock': val(r, 'in_stock'), 'tm_min': val(r, 'min_qty'),
        'crit': bool(num(val(r, 'flags')) & 16),
        'blocked': bool(num(val(r, 'flags')) & 2),
        'total3': a + b + c,
    })

print('=' * 74)
print('SENSITIVITY TO THE MISSING LEAD TIME  (restock every %d days)' % RESTOCK)
print('=' * 74)
print('  Only 1 item of 14,487 carries est_delivery_days, so lead time has to be')
print('  assumed. It is the whole ballgame — the restock cycle is only 16 days.')
print()
print('  %-12s %10s %10s %10s' % ('assumed lead', 'min >= 1', 'min >= 2', 'median min'))
for lead in (7, 14, 30, 60, 90):
    cover = lead + RESTOCK
    mins = [max(1, math.ceil(x['annual'] * cover / 365.0)) for x in rows]
    print('  %-12s %10d %10d %10d'
          % ('%d days' % lead, sum(1 for m in mins if m >= 1),
             sum(1 for m in mins if m >= 2), int(statistics.median(mins))))

LEAD = 30
cover = LEAD + RESTOCK
for x in rows:
    x['min'] = max(1, math.ceil(x['annual'] * cover / 365.0))

print()
print('=' * 74)
print('CONFIDENCE BANDS  (at an assumed %d-day lead, %d-day cover)' % (LEAD, cover))
print('=' * 74)


def band(x):
    if x['yrs'] == 3 and (x['spread'] is None or x['spread'] <= 4):
        return 'A  three steady years'
    if x['yrs'] == 3:
        return 'B  three lumpy years'
    if x['yrs'] == 2:
        return 'C  two years'
    if x['total3'] >= 6:
        return 'D  one year, real quantity'
    return 'E  one year, 1-5 units (noise)'


for x in rows:
    x['band'] = band(x)

counts = collections.Counter(x['band'] for x in rows)
for k in sorted(counts):
    n = counts[k]
    sub = [x for x in rows if x['band'] == k]
    newmin = sum(1 for x in sub if not (isinstance(x['tm_min'], (int, float)) and x['tm_min'] > 0))
    print('  %-32s %5d   (%d would be a new minimum)' % (k, n, newmin))

usable = [x for x in rows if x['band'][0] in 'ABC']
print()
print('  DEFENSIBLE NOW (bands A-C)        : %5d  (%.1f%% of the register)'
      % (len(usable), 100.0 * len(usable) / N))
print('  Suggestive, needs an eye (band D) : %5d' % counts.get('D  one year, real quantity', 0))
print('  Not a rate (band E)               : %5d' % counts.get('E  one year, 1-5 units (noise)', 0))
print('  No movement at all in 3 years     : %5d  (%.1f%%)' % (N - len(rows), 100.0 * (N - len(rows)) / N))

crit_total = sum(1 for r in items if num(val(r, 'flags')) & 16)
crit_cov = sum(1 for x in usable if x['crit'])
print()
print('  critical-flagged items covered by bands A-C: %d of %d' % (crit_cov, crit_total))

print()
print('  Where it would bite: items whose proposed minimum is above what is on the')
print('  shelf right now — i.e. would immediately raise a shortage.')
short = [x for x in usable
         if isinstance(x['stock'], (int, float)) and x['stock'] < x['min'] and not x['blocked']]
short.sort(key=lambda x: -(x['min'] - x['stock']))
print('  %d of %d band A-C items are already below their proposed minimum.' % (len(short), len(usable)))
print()
print('  %-9s %-40s %6s %6s %5s %s' % ('id', 'name', 'annual', 'stock', 'min', 'band'))
for x in short[:20]:
    print('  %-9s %-40s %6.1f %6g %5d %s'
          % (x['id'], str(x['name'])[:40], x['annual'], x['stock'], x['min'], x['band'][0]))

out = os.path.join(BASE, 'data', 'procurement', 'proposed-minimums.json')
payload = {
    'schema_version': 1,
    'generated': str(today),
    'method': 'annual consumption (TM c2024/c2025/c2026, 2026 annualised) x (lead + restock) / 365',
    'assumptions': {'restock_days': RESTOCK, 'assumed_lead_days': LEAD,
                    'lead_time_known_for_items': 1},
    'bands': {k: counts[k] for k in sorted(counts)},
    'proposals': [
        {'item_id': 'ITM-%05d' % int(x['id']) if isinstance(x['id'], int) else x['id'],
         'name': x['name'], 'unit': x['unit'], 'annual_consumption': round(x['annual'], 2),
         'proposed_min_qty': x['min'], 'band': x['band'][0], 'years_with_movement': x['yrs'],
         'in_stock': x['stock'], 'tm_min_qty': x['tm_min'], 'critical': x['crit']}
        for x in usable
    ],
}
io.open(out, 'w', encoding='utf-8').write(json.dumps(payload, ensure_ascii=False, indent=1))
print()
print('  wrote %s  (%d proposals, nothing applied)' % (out, len(usable)))
