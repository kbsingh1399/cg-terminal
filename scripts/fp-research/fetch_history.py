#!/usr/bin/env python3
"""
fp-research step 2 — fetch deep history for the universe.

Per symbol: 180d of m1 + m15 + 4h klines (WITH taker-buy volumes = bar-level
footprint) and 8h funding history. Stored as gzipped JSONL under
data/fp-research/. Resumable: existing files continue from their last bar.

m1 is the heavy lift (~260 requests/symbol at limit 1000) — the price-zone
split for absorption signals is reconstructed from m1 sub-bars.
"""
import gzip
import json
import os
import sys
import time
import urllib.request
import urllib.error

FAPI = "https://fapi.binance.com"
OUT = "data/fp-research"
DAYS = int(sys.argv[1]) if len(sys.argv) > 1 else 180
DAYS_M1 = int(sys.argv[2]) if len(sys.argv) > 2 else 180

INTERVAL_MS = {"1m": 60_000, "15m": 900_000, "4h": 14_400_000}
WEIGHT_CAP = 1800  # back off when used weight (1m) exceeds this


def get(path, params=""):
    url = f"{FAPI}{path}" + (f"?{params}" if params else "")
    for attempt in range(6):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "fp-research/1.0"})
            with urllib.request.urlopen(req, timeout=25) as r:
                return json.load(r), r.headers
        except urllib.error.HTTPError as e:
            if e.code == 429 or e.code == 418:
                wait = int(e.headers.get("Retry-After", "30"))
                print(f"    rate-limited, sleeping {wait}s", flush=True)
                time.sleep(wait + 1)
                continue
            raise
        except Exception as e:
            wait = 2 ** attempt
            print(f"    retry {e} ({wait}s)", flush=True)
            time.sleep(wait)
    raise RuntimeError(f"failed {url}")


def load_tail(path):
    """Return (list_of_lines, last_openTime) for an existing JSONL.gz file."""
    if not os.path.exists(path):
        return [], None
    rows = []
    last_t = None
    with gzip.open(path, "rt") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            r = json.loads(line)
            rows.append(r)
            last_t = r["t"]
    return rows, last_t


def fetch_klines(sym, interval, days, log=print):
    path = f"{OUT}/{interval}_{sym}.jsonl.gz"
    step = INTERVAL_MS[interval]
    now_ms = int(time.time() * 1000)
    start = now_ms - days * 86_400_000
    rows, last_t = load_tail(path)
    if last_t is not None:
        start = max(start, last_t + step)
    n_req = 0
    while start < now_ms - step:
        kl, hdrs = get("/fapi/v1/klines", f"symbol={sym}&interval={interval}&startTime={start}&limit=1000")
        n_req += 1
        used = hdrs.get("X-MBX-USED-WEIGHT-1M")
        if used and int(used) > WEIGHT_CAP:
            time.sleep(20)
        if not kl:
            break
        with gzip.open(path, "at") as f:
            for k in kl:
                if rows and k[0] <= last_t:
                    continue
                f.write(json.dumps({
                    "t": k[0], "o": k[1], "h": k[2], "l": k[3], "c": k[4],
                    "v": k[5], "qv": k[7], "n": k[6], "tb": k[9],
                }) + "\n")
                rows.append({"t": k[0]})
                last_t = k[0]
        if kl[-1][0] == start:  # no progress (shouldn't happen)
            break
        start = kl[-1][0] + step
        if len(kl) < 1000:
            break
    log(f"  {sym} {interval}: total ~{len(rows)} bars ({n_req} req this run)")


def fetch_funding(sym, days):
    path = f"{OUT}/funding_{sym}.jsonl.gz"
    start = int(time.time() * 1000) - days * 86_400_000
    if os.path.exists(path):
        return
    fr, _ = get("/fapi/v1/fundingRate", f"symbol={sym}&startTime={start}&limit=1000")
    with gzip.open(path, "wt") as f:
        for r in fr:
            f.write(json.dumps({"t": r["fundingTime"], "r": r["fundingRate"]}) + "\n")
    print(f"  {sym} funding: {len(fr)} rows")


def main():
    os.makedirs(OUT, exist_ok=True)
    with open(f"{OUT}/universe.json") as f:
        uni = [x["symbol"] for x in json.load(f)]
    print(f"universe ({len(uni)}): {' '.join(uni)}", flush=True)
    t0 = time.time()
    # light first (m15 + 4h + funding), then the heavy m1 pass
    for sym in uni:
        fetch_klines(sym, "15m", DAYS)
        fetch_klines(sym, "4h", DAYS)
        fetch_funding(sym, DAYS)
    print(f"--- m15/4h/funding done in {time.time()-t0:.0f}s; starting m1 ---", flush=True)
    t1 = time.time()
    for i, sym in enumerate(uni):
        fetch_klines(sym, "1m", DAYS_M1)
        print(f"[m1 {i+1}/{len(uni)}] {sym} done ({time.time()-t1:.0f}s elapsed)", flush=True)
    print(f"ALL DONE in {time.time()-t0:.0f}s")


if __name__ == "__main__":
    main()
