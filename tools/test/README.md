# §42 Procurement — test suites

```
node tools/test/run.js
```

No dependencies beyond Node. Nothing here starts a browser, an Electron window
or a network call: every suite runs the real shared reducer over real or
synthetic event streams and checks the answers.

```
node tools/test/run.js --catalogue <path-to-catalogue.json> --console <path-to-IDMS-Console>
```

Both are found automatically when they are where they usually are — the
catalogue under `~/OneDrive*/Documents/IDMS/data/procurement/`, the Console
beside this repo. A suite that cannot find what it needs **skips and says so**
rather than failing, so the reducer suites still run on a machine that has
neither.

## What each one guards

| Suite | Guards |
|---|---|
| `reduce.test.js` | The arithmetic in `utils/procurement-reduce.js`, synthetically: out-of-order replay, partial and over receipt, transfers, count variance, negative stock, partial approval, decimal hygiene, and the rule that a negative `qty` is a magnitude rather than an inverted movement. |
| `freetext.test.js` | One regression. A free-text order line that is received becomes a real item, and the order line must link to it **even though the order is already sent** — without that, stock was right and `on_order` silently missed. |
| `catalogue.test.js` | The TM Master baseline (§42.14) against the **real** 14,487-item catalogue: hydration, dictionary decoding, the stowage tree, `baseline_at` suppressing already-absorbed movements, unknown stock never reading as a shortage, and the IDMS policy overlay winning over the mirror and clearing back to it. |
| `console-derive.test.js` | The cross-repo contract. Every derived row is checked against the column lists **parsed out of the Console's `main.js`** — a column the INSERT names and the row does not carry is how that lane breaks at runtime. Also asserts the reducer mirror is byte-identical, and the CSP rules below. |

## Two rules worth knowing about

**The reducer is mirrored, not reimplemented.** `utils/procurement-reduce.js` is
canonical; `IDMS-Console/src/renderer/js/procurement-reduce.js` must be
byte-identical. Change it here first, then copy. `console-derive.test.js` fails
if they drift.

**The Console forbids inline script.** It runs `script-src 'self'`, which makes
an `onclick=` attribute inert — the screen renders perfectly and every control
is dead. That shipped once. `console-derive.test.js` now fails if the
Procurement screen contains an inline handler, if the app stops forbidding
inline script, or if `_procurement-harness.html` stops enforcing the same
policy. Verify UI by **clicking**, not by calling the handler: calling
`prcGo()` passes under a policy that blocks the button which calls it.

## The catalogue

Generated, not committed. Rebuild it after each TM Master export:

```
python tools/build-procurement-catalogue.py
```
