#!/usr/bin/env python3
"""
Binance Vision daily-dump backfill — free bulk archives, no auth
(R4 desk-side tool; live-verified 2026-11-11: XAUUSDT futures-um 2026-11-10 →
trades 13.86MB, aggTrades 7.73MB, bookDepth 570KB, all HTTP 200).

https://data.binance.vision/data/futures/um/daily/{kind}/{SYM}/{SYM}-{kind}-{DATE}.zip

Usage:
  python3 scripts/backfill_binance_vision.py --sym XAUUSDT --days 5 \
      [--kinds trades,aggTrades,bookDepth] [--out data/binance-vision] [--delay 1]
Raw ZIPs land in --out; a manifest.json records sizes + row counts (unzipped
peek for trades/aggTrades CSVs). Parsing into the series store is deliberately
NOT done here (v1 keeps archives raw; ingest is a separate, reviewed step).
"""
import argparse
import json
import re
import sys
import zipfile
from datetime import datetime, timedelta, timezone
from itertools import islice
from pathlib import Path

import requests

UA = {"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36"}
BASE = "https://data.binance.vision/data/futures/um/daily"
KINDS = ("trades", "aggTrades", "bookDepth")
MAX_ZIP = 512 * 1024 * 1024        # refuse archives above 512 MB
MAX_PEEK_ROWS = 50_000_000         # zip-peek row cap (RV-SEC: bomb guard)

# verified symbols worth archiving for the desk (metals/energy perps)
SUGGESTED = ["XAUUSDT", "XAGUSDT", "XPTUSDT", "PAXGUSDT", "COPPERUSDT", "CLUSDT", "NATGASUSDT"]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--sym", required=True, help="e.g. XAUUSDT (futures-um base asset)")
    ap.add_argument("--days", type=int, default=3)
    ap.add_argument("--kinds", default="trades,aggTrades,bookDepth")
    ap.add_argument("--out", default="data/binance-vision")
    ap.add_argument("--delay", type=float, default=1.0)
    args = ap.parse_args()

    out = Path(args.out) / args.sym.upper()
    out.mkdir(parents=True, exist_ok=True)
    sym = args.sym.upper()
    if not re.fullmatch(r"[A-Z0-9]+", sym):
        sys.exit(f"invalid symbol {sym!r} — must match [A-Z0-9]+ (path safety)")
    manifest_path = out / "manifest.json"
    manifest = json.loads(manifest_path.read_text()) if manifest_path.exists() else {}

    today = datetime.now(timezone.utc).date()
    for k in range(args.days, 0, -1):
        d = today - timedelta(days=k)
        ds = d.isoformat()
        for kind in [k2.strip() for k2 in args.kinds.split(",") if k2.strip() in KINDS]:
            key = f"{ds}/{kind}"
            if key in manifest:
                continue
            url = f"{BASE}/{kind}/{sym}/{sym}-{kind}-{ds}.zip"
            try:
                r = requests.get(url, headers=UA, timeout=120)
                if r.status_code != 200:
                    print(f"  {ds} {kind}: HTTP {r.status_code} — skipped (not persisted; retried next run)")
                    continue
                if len(r.content) > MAX_ZIP:
                    print(f"  {ds} {kind}: {len(r.content):,} bytes > cap — REFUSING (bomb guard)")
                    continue
                path = out / f"{sym}-{kind}-{ds}.zip"
                path.write_bytes(r.content)
                entry = {"url": url, "bytes": len(r.content), "status": 200}
                # bounded zip-peek: cap declared file_size and iterated rows
                # (RV-SEC MAJOR-3: central-directory sizes can lie)
                try:
                    with zipfile.ZipFile(path) as z:
                        name = z.namelist()[0]
                        info = z.getinfo(name)
                        if info.file_size > MAX_ZIP * 4:
                            entry["peek_error"] = f"declared size {info.file_size:,} implausible — skipped"
                        else:
                            with z.open(name) as f:
                                entry["rows"] = sum(1 for _ in islice(f, MAX_PEEK_ROWS)) - 1
                            entry["member"] = name
                except Exception as e:
                    entry["peek_error"] = str(e)[:80]
                manifest[key] = entry
                manifest_path.write_text(json.dumps(manifest, indent=1))
                print(f"  {ds} {kind}: {len(r.content):,} bytes"
                      + (f" · {entry.get('rows'):,} rows" if entry.get("rows") is not None else ""))
            except Exception as e:
                print(f"  {ds} {kind}: FAIL {e}")

    n_ok = sum(1 for v in manifest.values() if v.get("status") == 200)
    print(f"\n{args.sym.upper()}: {n_ok} archive(s) in {out}/ (manifest: {manifest_path})")
    print(f"suggested universe: {', '.join(SUGGESTED)}")


if __name__ == "__main__":
    main()
