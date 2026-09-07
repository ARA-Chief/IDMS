#!/usr/bin/env python3
"""Build the PWA's procurement catalogue from the Engineering Vault item register.

IDMS-SCHEMA §42.14. TM Master is the system of record for the item master and
for the stowage locations; the Vault's `50 Procurement/` notes are a generated
mirror of a TM Master stock export, and this script is the second hop — it
projects those notes into the compact JSON the field PWA can load over Graph.

    TM Master  ->  Vault notes (mirror)  ->  catalogue JSON  ->  procurement.html

Nothing here writes to the Vault. It reads the notes and writes only into the
IDMS OneDrive folder, which is what keeps the corpus a corpus.

Two files come out, because 14,487 items will not fit down a vessel's connection
in one useful lump:

  catalogue.json            everything needed to search, list and count stock.
                            Columnar (a `fields` header and rows of values) and
                            dictionary-encoded on the low-cardinality columns,
                            because repeating "Spare part" 11,000 times is most
                            of the file otherwise.
  catalogue-detail.json     specification, remarks and maker detail — long free
                            text nobody needs until they open one item, so the
                            PWA fetches it lazily and only once.

Usage:
    python tools/build-procurement-catalogue.py [--vault PATH] [--out PATH] [--dry-run]

Both paths are guessed when omitted, and printed before anything is written.
"""

import argparse
import datetime
import json
import os
import re
import sys
from pathlib import Path

# Core: what the register, search, low-stock and check-in screens need.
CORE_FIELDS = [
    "id", "name", "uom", "item_type", "item_category", "loc",
    "in_stock", "on_order", "on_draft", "qty_in_use", "min_qty", "max_qty",
    "supplier", "suppliers_ref", "makers_part_no", "stock_tag", "tm_item_no",
    "est_delivery_days", "last_known_price", "currency",
    "c2026", "c2025", "c2024", "flags",
]

# Dictionary-encoded columns: each value becomes an index into a table shipped
# alongside. Chosen by cardinality, not by guess — `supplier` has a few hundred
# distinct values across 14k rows, `name` has ~14k and stays a plain string.
INTERNED = ["uom", "item_type", "item_category", "supplier", "currency"]

# Detail: long text and the fields only an opened item shows.
DETAIL_FIELDS = [
    "specification", "unit_specific_remarks", "maker", "makers_type",
    "price", "exchange_rate", "price_in_unit_currency", "last_known_price_date",
]

# Bit positions for the flag columns. One small integer instead of five
# booleans on every row.
FLAGS = [
    ("validated", 1), ("blocked", 2), ("controlled_goods", 4),
    ("review_minmax", 8), ("has_critical_occurrences", 16),
]

# Columns the register documents as never populated by the export. Present and
# empty on all 14,487 notes; carrying them would say nothing.
NEVER_POPULATED = [
    "material_group", "dangerous_goods", "dangerous_goods_class",
    "ihm_status", "hs_code", "hs_description",
]

NUMERIC = {
    "in_stock", "on_order", "on_draft", "qty_in_use", "min_qty", "max_qty",
    "est_delivery_days", "last_known_price", "price", "exchange_rate",
    "price_in_unit_currency", "c2026", "c2025", "c2024",
}

LOCATION_FIELDS = [
    "code", "path", "deck", "depth", "parent",
    "items_here", "items_including_sublocations", "sublocations",
]

WIKILINK = re.compile(r"^\[\[([^\]|]+?)(?:\|[^\]]*)?\]\]$")
ID_NUM = re.compile(r"^(?:ITM|LOC)-0*(\d+)$")


def parse_frontmatter(path):
    """Parse the narrow YAML subset `build-item-register.py` emits.

    That generator renders every string scalar with `json.dumps`, so a quoted
    value is by construction a valid JSON string — escapes, embedded quotes and
    the backslashes in Windows stowage paths included. Bare values are only ever
    numbers, booleans or empty. Matching the writer exactly beats a general YAML
    parser here, and anything unrecognised is reported rather than guessed at.
    """
    # utf-8-sig: a stray BOM is a known trap in this vault.
    with open(path, "r", encoding="utf-8-sig") as fh:
        if fh.readline().strip() != "---":
            return None, "no frontmatter"
        out, problems = {}, []
        for line in fh:
            stripped = line.rstrip("\n")
            if stripped.strip() == "---":
                break
            if not stripped.strip() or stripped.lstrip().startswith("- "):
                continue                       # list items (tags, aliases) — unused
            if ":" not in stripped:
                problems.append(stripped.strip()[:60])
                continue
            key, _, raw = stripped.partition(":")
            key, raw = key.strip(), raw.strip()
            if raw == "":
                out[key] = None
            elif raw in ("true", "false"):
                out[key] = (raw == "true")
            elif raw.startswith('"'):
                try:
                    out[key] = json.loads(raw)
                except ValueError:
                    problems.append(f"{key}: unparseable string")
            else:
                try:
                    out[key] = int(raw)
                except ValueError:
                    try:
                        out[key] = float(raw)
                    except ValueError:
                        out[key] = raw          # bare word — kept as written
        return out, ("; ".join(problems) if problems else None)


def link_target(value):
    """`[[LOC-0632 Trawl Deck - Deckhand Workshop]]` -> 632."""
    if not value:
        return None
    m = WIKILINK.match(str(value).strip())
    target = m.group(1).strip() if m else str(value).strip()
    head = target.split(" ", 1)[0]
    m2 = ID_NUM.match(head)
    return int(m2.group(1)) if m2 else None


def id_num(value):
    m = ID_NUM.match(str(value or "").strip())
    return int(m.group(1)) if m else None


class Interner:
    def __init__(self):
        self.values, self.index = [], {}

    def __call__(self, v):
        if v is None or v == "":
            return None
        if v not in self.index:
            self.index[v] = len(self.values)
            self.values.append(v)
        return self.index[v]


def guess_vault():
    for candidate in (
        Path(r"S:/Engineer's Files/Araho Engineering Vault"),
        Path.home() / "Engineer's Files" / "Araho Engineering Vault",
    ):
        if (candidate / "50 Procurement").is_dir():
            return candidate
    return None


def guess_out():
    home = Path.home()
    for entry in sorted(home.iterdir()) if home.is_dir() else []:
        if entry.name.startswith("OneDrive") and (entry / "Documents/IDMS").is_dir():
            return entry / "Documents/IDMS"
    return None


def write_atomic(path, body):
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(body, encoding="utf-8")
    os.replace(tmp, path)          # the PWA never reads a half-written file


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--vault", type=Path, default=None)
    ap.add_argument("--out", type=Path, default=None)
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    vault = args.vault or guess_vault()
    if not vault or not (vault / "50 Procurement").is_dir():
        sys.exit("Could not find the vault. Pass --vault.")
    out = args.out or guess_out()
    if not args.dry_run and (not out or not (out / "data").is_dir()):
        sys.exit("Could not find the IDMS OneDrive folder. Pass --out.")

    proc = vault / "50 Procurement"
    print(f"vault : {proc}")
    print(f"out   : {out if out else '(dry run)'}")

    generated = None
    problems = []

    # ── Locations ────────────────────────────────────────────────────────────
    loc_rows = []
    for path in sorted((proc / "50.4 Locations").rglob("*.md")):
        fm, problem = parse_frontmatter(path)
        if fm is None:
            problems.append((path.name, problem)); continue
        if problem:
            problems.append((path.name, problem))
        generated = generated or fm.get("generated")
        loc_rows.append([
            id_num(fm.get("code")), fm.get("path"), fm.get("deck"),
            fm.get("depth"), link_target(fm.get("parent")),
            fm.get("items_here"), fm.get("items_including_sublocations"),
            fm.get("sublocations"),
        ])
    print(f"locations : {len(loc_rows)}")

    # ── Items ────────────────────────────────────────────────────────────────
    interners = {f: Interner() for f in INTERNED}
    core_rows, detail = [], {}
    coerced = []          # non-numeric junk found in a numeric column
    stats = {"blank_stock": 0, "negative_stock": 0, "no_min": 0,
             "no_location": 0, "on_order": 0, "critical": 0, "blocked": 0}

    for path in sorted((proc / "50.3 Item Register").rglob("*.md")):
        fm, problem = parse_frontmatter(path)
        if fm is None:
            problems.append((path.name, problem)); continue
        if problem:
            problems.append((path.name, problem))
        generated = generated or fm.get("generated")

        iid = id_num(fm.get("id"))
        if iid is None:
            problems.append((path.name, "unreadable id")); continue

        src = dict(fm)
        for year in ("2026", "2025", "2024"):
            src[f"c{year}"] = fm.get(f"consumption_{year}")
        src["loc"] = link_target(fm.get("location"))

        # One row in the current export has a maker name in OnOrder and a part
        # number in Price — a column shift at source. Coerce to unknown and
        # report it rather than letting a string reach the arithmetic.
        for key in NUMERIC:
            v = src.get(key)
            if v is not None and (isinstance(v, bool) or not isinstance(v, (int, float))):
                coerced.append((fm.get("id"), key, repr(v)[:40]))
                src[key] = None

        flags = 0
        for name, bit in FLAGS:
            if fm.get(name):
                flags |= bit
        src["flags"] = flags

        row = []
        for f in CORE_FIELDS:
            if f == "id":
                row.append(iid)
            elif f in INTERNED:
                row.append(interners[f](src.get(f)))
            else:
                row.append(src.get(f))
        core_rows.append(row)

        d = {k: src.get(k) for k in DETAIL_FIELDS if src.get(k) not in (None, "")}
        if d:
            detail[str(iid)] = d

        if src.get("in_stock") is None: stats["blank_stock"] += 1
        elif src["in_stock"] < 0:       stats["negative_stock"] += 1
        if not src.get("min_qty"):      stats["no_min"] += 1
        if src.get("loc") is None:      stats["no_location"] += 1
        if (src.get("on_order") or 0) > 0: stats["on_order"] += 1
        if flags & 16:                  stats["critical"] += 1
        if flags & 2:                   stats["blocked"] += 1

    print(f"items     : {len(core_rows)}")

    if problems:
        print(f"\n{len(problems)} note(s) had unparsed lines; first five:")
        for name, why in problems[:5]:
            print(f"  {name}: {why}")
    if coerced:
        print(f"\n{len(coerced)} non-numeric value(s) in numeric columns "
              f"— coerced to unknown, source needs correcting in TM Master:")
        for iid, key, val in coerced[:5]:
            print(f"  {iid}  {key} = {val}")

    baseline_date = str(generated or "")[:10] or "1970-01-01"
    built_at = datetime.datetime.now(datetime.timezone.utc)\
        .isoformat(timespec="milliseconds").replace("+00:00", "Z")

    catalogue = {
        "schema_version": 1,
        "source": "TM Master stock export, via the Engineering Vault item register",
        "generated": baseline_date,
        # What the reducer compares movement timestamps against (§42.14): the
        # day the export was taken, not the day this script ran. The numbers
        # describe TM Master at that moment.
        "baseline_at": f"{baseline_date}T00:00:00.000Z",
        "built_at": built_at,
        "never_populated": NEVER_POPULATED,
        "tables": {f: interners[f].values for f in INTERNED},
        "flag_bits": {name: bit for name, bit in FLAGS},
        "item_fields": CORE_FIELDS,
        "items": core_rows,
        "location_fields": LOCATION_FIELDS,
        "locations": loc_rows,
        "counts": {"items": len(core_rows), "locations": len(loc_rows), **stats},
    }
    detail_doc = {
        "schema_version": 1, "generated": baseline_date, "built_at": built_at,
        "fields": DETAIL_FIELDS, "items": detail,
    }

    core_body = json.dumps(catalogue, ensure_ascii=False, separators=(",", ":"))
    detail_body = json.dumps(detail_doc, ensure_ascii=False, separators=(",", ":"))
    mb = lambda s: len(s.encode("utf-8")) / 1048576

    print(f"\ncatalogue.json        {mb(core_body):5.2f} MB")
    print(f"catalogue-detail.json {mb(detail_body):5.2f} MB  ({len(detail)} items with detail)")
    print("\nwhat the register says right now")
    for k, v in catalogue["counts"].items():
        print(f"  {k.replace('_', ' '):22s} {v}")

    if args.dry_run:
        print("\ndry run — nothing written")
        return

    dest = out / "data" / "procurement"
    dest.mkdir(parents=True, exist_ok=True)
    write_atomic(dest / "catalogue.json", core_body)
    write_atomic(dest / "catalogue-detail.json", detail_body)
    print(f"\nwrote {dest / 'catalogue.json'}")
    print(f"wrote {dest / 'catalogue-detail.json'}")


if __name__ == "__main__":
    main()
