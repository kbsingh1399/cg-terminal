#!/usr/bin/env python3
"""
Dukascopy .bi5 tick backfill — free historical L1 BBO + volumes, no auth
(R4 desk-side tool; live-verified 2026-11-11: XAUUSD 06h file = 17,689 ticks).

URL: http://datafeed.dukascopy.com/datafeed/{SYM}/{YYYY}/{MM0}/{DD}/{HH}h_ticks.bi5
  · plain http ONLY (https times out from some egress)
  · month is 0-INDEXED (Jan=00, Nov=10)
  · payload = LZMA-alone stream of 20-byte big-endian records ">3i2f":
      [ms_offset_into_hour, ask_points, bid_points, ask_float_vol, bid_float_vol]
  · prices are integer "points" — divisor varies per instrument (auto-detected
    against a reference price, or taken from the table below). We REFUSE to
    write rows that land >20% away from the reference (wrong-instrument data
    is worse than no data — USO-ETF lesson).

Usage:
  python3 scripts/backfill_dukascopy.py --sym XAUUSD --hours 48 [--ref 4060] \
      [--out data/dukascopy] [--delay 0.5]
Output: data/dukascopy/{SYM}-{YYYYMMDDHH}.csv (ts_ms_utc, bid, ask, bid_vol, ask_vol)
        + summary printed.
"""
import argparse
import csv
import lzma
import re
import struct
import sys
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path

import requests

UA = {"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36"}
MAX_RAW = 8 * 1024 * 1024      # refuse .bi5 payloads above 8 MB (RV-SEC: bomb guard)
MAX_TICKS = 500_000            # refuse >500k ticks/hour from one file

# verified / documented point divisors (auto-detect with --ref overrides)
DIVISORS = {
    "EURUSD": 100_000, "GBPUSD": 100_000, "USDCHF": 100_000, "AUDUSD": 100_000,
    "USDCAD": 100_000, "NZDUSD": 100_000,
    "USDJPY": 1_000, "EURJPY": 1_000, "GBPJPY": 1_000,
    "XAUUSD": 1_000, "XAGUSD": 100, "XPTUSD": 1_000, "XPDUSD": 1_000,
    # cash indices (verify with --ref on first use)
    "USA30IDXUSD": 10, "USA500IDXUSD": 10, "USATECHIDXUSD": 10, "JPNIDXJPY": 10,
    "DEUIDXEUR": 10, "GBRIDXGBP": 10, "FRAIDXEUR": 10, "EUSTX50EUR": 10,
    "LIGHTCMDUSD": 1_000, "BRENTCMDUSD": 1_000, "NATGASCMDUSD": 1_000,
}
CANDIDATES = [10, 100, 1_000, 10_000, 100_000]


def fetch_hour(sym: str, dt: datetime, timeout=20) -> bytes | None:
    # https first, plain-http fallback (RV-SEC MAJOR-2: TLS when the feed
    # allows it; the documented quirk is that https times out on some egress)
    for scheme in ("https", "http"):
        url = (f"{scheme}://datafeed.dukascopy.com/datafeed/{sym}/"
               f"{dt.year}/{dt.month - 1:02d}/{dt.day:02d}/{dt.hour:02d}h_ticks.bi5")
        try:
            r = requests.get(url, headers=UA, timeout=timeout)
        except requests.RequestException:
            continue
        if r.status_code == 200 and r.content:
            if len(r.content) > MAX_RAW:
                print(f"  {dt.hour:02d}h — payload {len(r.content):,} bytes > {MAX_RAW} cap — REFUSING (bomb guard)")
                sys.exit(3)
            return r.content
        if r.status_code == 404:
            return None
    return None


def decode(raw: bytes):
    # bounded LZMA-alone decompression (RV-SEC: a small hostile file must not
    # expand unbounded — max_length caps output, unused_data means truncated)
    try:
        d = lzma.LZMADecompressor(format=lzma.FORMAT_ALONE)
        out = d.decompress(raw, max_length=MAX_TICKS * 20 + 20)
        if d.unused_data or not d.eof:
            # more input than consumed, or stream claims more output than allowed
            if not d.eof:
                print("  — decompressed output exceeded cap — REFUSING (bomb guard)")
                sys.exit(3)
        n = len(out) // 20
        if n > MAX_TICKS:
            print(f"  — {n:,} ticks > {MAX_TICKS:,} cap — REFUSING")
            sys.exit(3)
        rows = []
        for i in range(n):
            ms, ask_i, bid_i, av, bv = struct.unpack_from(">3i2f", out, i * 20)
            rows.append((ms, ask_i, bid_i, av, bv))
        return rows
    except lzma.LZMAError:
        return None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--sym", required=True, help="Dukascopy symbol, e.g. XAUUSD, EURUSD, USA500IDXUSD")
    ap.add_argument("--hours", type=int, default=24, help="how many trailing UTC hours to pull")
    ap.add_argument("--ref", type=float, default=None,
                    help="reference price (e.g. current mid) — enables divisor auto-detect + sanity gate")
    ap.add_argument("--out", default="data/dukascopy")
    ap.add_argument("--delay", type=float, default=0.5, help="seconds between hourly fetches (be polite)")
    args = ap.parse_args()

    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)
    sym = args.sym.upper()
    if not re.fullmatch(r"[A-Z0-9]+", sym):
        sys.exit(f"invalid symbol {sym!r} — must match [A-Z0-9]+ (path safety)")
    divisor = DIVISORS.get(sym)
    now = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)

    total_rows = 0
    files = []
    for k in range(args.hours, 0, -1):
        dt = now - timedelta(hours=k)
        label = dt.strftime("%Y%m%d%H")
        path = out_dir / f"{sym}-{label}.csv"
        if path.exists():
            files.append(path)
            total_rows += sum(1 for _ in open(path)) - 1
            continue
        raw = fetch_hour(sym, dt)
        if raw is None:
            print(f"  {label} — no file upstream (market closed / symbol off) — skipped")
            time.sleep(args.delay)
            continue
        rows = decode(raw)
        if not rows:
            print(f"  {label} — empty/undecodable — skipped")
            time.sleep(args.delay)
            continue
        # divisor resolution: table, else auto-detect from --ref
        div = divisor
        if div is None and args.ref:
            for c in CANDIDATES:
                if abs(rows[0][1] / c - args.ref) / args.ref < 0.2:
                    div = c
                    break
            if div is None:
                print(f"  {label} — no divisor candidate puts price within 20% of ref {args.ref}; "
                      f"first ask points={rows[0][1]} — REFUSING (add --ref or a DIVISORS entry)")
                sys.exit(2)
        elif div is None:
            print(f"  {label} — no divisor known for {sym} and no --ref given — REFUSING "
                  f"(pass --ref <current price> to auto-detect)")
            sys.exit(2)
        # sanity gate when a reference exists
        if args.ref:
            mid0 = (rows[0][1] + rows[0][2]) / 2 / div
            if abs(mid0 - args.ref) / args.ref > 0.2:
                print(f"  {label} — decoded mid {mid0:.4f} is >20% from ref {args.ref} — "
                      f"REFUSING to write (wrong instrument or wrong divisor)")
                sys.exit(2)
        with open(path, "w", newline="") as f:
            w = csv.writer(f)
            w.writerow(["ts_ms_utc", "bid", "ask", "bid_vol", "ask_vol"])
            base = int(dt.timestamp() * 1000)
            for ms, ask_i, bid_i, av, bv in rows:
                w.writerow([base + ms, round(bid_i / div, 6), round(ask_i / div, 6), round(bv, 2), round(av, 2)])
        files.append(path)
        total_rows += len(rows)
        print(f"  {label} — {len(rows):,} ticks → {path} (divisor {div})")
        time.sleep(args.delay)

    print(f"\n{sym}: {total_rows:,} ticks across {len(files)} hourly files in {out_dir}/")
    if files:
        print("rows are L1 BBO + top-of-book volume (broker feed) — good for session/VWAP studies,")
        print("NOT multi-level L2/L3 (no such free archive exists for OTC spot).")


if __name__ == "__main__":
    main()
