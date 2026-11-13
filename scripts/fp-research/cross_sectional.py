#!/usr/bin/env python3
"""
fp-research step 10 — CROSS-SECTIONAL selection test (beta-neutral).

Question: do symbols with more bearish footprint signals UNDERPERFORM symbols
with more bullish ones over the next 4h/12h/24h, RELATIVE to the universe?

Method: every 4h, score each symbol = Σ(strength × dir) of signals in the
last 8 m15 bars (2h lookback). Rank into quintiles (Q1 most bearish …
Q5 most bullish). Forward returns MINUS universe cross-sectional mean.
Run on design and holdout windows separately.
"""
import gzip
import json
from collections import defaultdict

import numpy as np
import pandas as pd

DIR = "data/fp-research"
M15 = 900_000
STEP = 16  # 4h scoring cadence
LOOKBACK = 8  # 2h of m15 bars


def load_m15(sym):
    rows = [json.loads(l) for l in gzip.open(f"{DIR}/15m_{sym}.jsonl.gz", "rt") if l.strip()]
    df = pd.DataFrame(rows)
    for c in ["o", "h", "l", "c", "v"]:
        df[c] = df[c].astype(float)
    df["t"] = df["t"].astype(np.int64)
    return df.sort_values("t").reset_index(drop=True)


def main():
    uni = [x["symbol"] for x in json.load(open(f"{DIR}/universe.json"))]
    klines = {s: load_m15(s) for s in uni}
    sigs = {s: [json.loads(l) for l in open(f"{DIR}/cgsig_{s}.jsonl")] for s in uni}

    # signal score per (sym, 15m bar): signed strength, knowability-lagged
    score = defaultdict(float)
    for s in uni:
        m = klines[s]
        t2i = {ts: i for i, ts in enumerate(m["t"].values)}
        for sig in sigs[s]:
            i = t2i.get(int(sig["ts"]))
            if i is None:
                continue
            j = i + sig["confirmBars"]  # knowable at the close of this bar
            d = -1 if sig["dir"] == "bearish" else 1
            score[(s, j)] += d * sig["strength"]

    df = pd.read_pickle(f"{DIR}/events.pkl")
    t0, t1 = df["ts"].min(), df["ts"].max()
    split = t0 + (t1 - t0) // 2

    for wname, lo, hi in [("DESIGN", t0, split), ("HOLDOUT", split, t1)]:
        # scoring timestamps every 4h across the window
        starts = np.arange(lo, hi - 96 * M15, STEP * M15)
        rows = []
        for st in starts:
            fwd = {}
            for s in uni:
                m = klines[s]
                t = m["t"].values
                i = np.searchsorted(t, st)
                if i >= len(m) - 97:
                    continue
                entry = m["o"].values[i]
                j = min(i + 96, len(m) - 1)
                fwd[s] = m["c"].values[j] / entry - 1
            if len(fwd) < 15:
                continue
            sc = {}
            for s in fwd:
                # sum scores of bars in (st - LOOKBACK, st]
                v = 0.0
                m = klines[s]
                t = m["t"].values
                base = np.searchsorted(t, st)  # bar index at st
                for b in range(max(0, base - LOOKBACK), base):
                    v += score.get((s, b), 0.0)
                sc[s] = v
            mu = np.mean(list(fwd.values()))
            rows.append({s: (sc[s], fwd[s] - mu) for s in fwd})
        # quintiles
        qvals = defaultdict(list)
        for row in rows:
            syms = sorted(row, key=lambda s: row[s][0])
            n = len(syms)
            for qi in range(5):
                lo_i = qi * n // 5
                hi_i = (qi + 1) * n // 5
                for s in syms[lo_i:hi_i]:
                    qvals[qi + 1].append(row[s][1])
        print(f"\n=== {wname}: 24h fwd return minus universe mean, by signal-score quintile (bp) ===")
        print(f"    (scoring every 4h · score = Σ signed strength over last 2h · {len(rows)} cross-sections)")
        for qi in range(1, 6):
            v = np.array(qvals[qi]) * 1e4
            print(f"  Q{qi} ({'most bearish' if qi == 1 else 'most bullish' if qi == 5 else '          '}): n={len(v):5d} mean {v.mean():+7.1f}bp · t-stat {v.mean()/(v.std()/np.sqrt(len(v))):+5.2f}")
        q1 = np.array(qvals[1]) * 1e4
        q5 = np.array(qvals[5]) * 1e4
        spread = (q5.mean() - q1.mean())
        # paired t on the Q5-Q1 spread per cross-section
        print(f"  Q5−Q1 spread: {spread:+.1f}bp per 24h")
        # zero-cost L/S: short Q1, long Q5, 15bp cost per leg round trip
        print(f"  L/S (short Q1 · long Q5) net of 2×15bp cost: {(spread/2) - 30:+.1f}bp per side per 24h")


if __name__ == "__main__":
    main()
