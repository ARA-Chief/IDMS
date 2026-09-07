'use strict';

// Run every §42 suite and total them.
//
//   node tools/test/run.js
//   node tools/test/run.js --catalogue <path> --console <path>
//
// Exits non-zero if any suite fails. A suite that cannot find what it needs —
// the generated catalogue, or the Console checkout — skips and says why; that
// is not a failure, because the reducer suites still prove what they prove on
// a machine that has neither.

const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const dir = __dirname;
const suites = fs.readdirSync(dir).filter(f => f.endsWith('.test.js')).sort();
const passthrough = process.argv.slice(2);

let failed = 0, skipped = 0, ran = 0;
const totals = [];

for (const suite of suites) {
  console.log('\n' + '='.repeat(66));
  console.log(suite);
  console.log('='.repeat(66));
  const r = spawnSync(process.execPath, [path.join(dir, suite), ...passthrough],
                      { encoding: 'utf8' });
  process.stdout.write(r.stdout || '');
  if (r.stderr) process.stderr.write(r.stderr);

  const skip = /^SKIPPED —/m.test(r.stdout || '');
  const m = (r.stdout || '').match(/(\d+) passed, (\d+) failed/);
  if (skip) { skipped++; totals.push([suite, 'skipped']); continue; }
  ran++;
  if (r.status !== 0) failed++;
  totals.push([suite, m ? `${m[1]} passed, ${m[2]} failed` : `exit ${r.status}`]);
}

console.log('\n' + '='.repeat(66));
for (const [suite, result] of totals) {
  console.log('  ' + suite.padEnd(30) + result);
}
const cases = totals.reduce((n, [, r]) => {
  const m = r.match(/(\d+) passed/);
  return n + (m ? Number(m[1]) : 0);
}, 0);
console.log(`\n${ran} suite(s) run, ${skipped} skipped, ${cases} cases passed, ${failed} suite(s) failed`);
process.exit(failed ? 1 : 0);
