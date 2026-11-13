#!/usr/bin/env python3
"""
fp-research step 8 — conditioning analysis on the alpha classes.

DESIGN window only (first 90d of the 180d span). For each alpha-positive
class×dir from the drift-adjusted table, split the drift-adjusted 24h edge by
conditioning variables and find lifters:
  strength, regime(4h), volp, |ema_dist|, funding z, UTC hour, symbol
  liquidity bucket (major vs alt), confluence (same-dir signals within ±6
  bars, distinct classes), signal size (zone volume / bar volume).
"""
import gzip
import json
import pickle
from collections import defaultdict

import numpy as np
import pandas as pd

DIR = "data/fp-research"
M15 = 900_000

CLASSES = [
    ("exhaustion", "bearish"),
    ("absorption", "bearish"),
    ("bear_div", "bearish"),
    ("trapped", "bearish"),
    ("trapped", "bullish"),
    ("exhaustion", "bullish"),
]


def load_m15(sym):
    rows = [json.loads(l) for l in gzip.open(f"{DIR}/15m_{sym}.jsonl.gz", "rt") if l.strip()]
    df = pd.DataFrame(rows)
    for c in ["o", "h", "l", "c", "v"]:
        df[c] = df[c].astype(float)
    df["t"] = df["t"].astype(np.int64)
    return df.sort_values("t").reset_index(drop=True)


def main():
    df = pd.read_pickle(f"{DIR}/events.pkl")
    t0, t1 = df["ts"].min(), df["ts"].max()
    split = t0 + (t1 - t0) // 2
    design = df[df["ts"] < split].copy()
    print(f"design window: {pd.to_datetime(t0, unit='ms').date()} → {pd.to_datetime(split, unit='ms').date()} · {len(design)} events")

    # drift per symbol on the design window (24h fwd from every bar)
    uni = [x["symbol"] for x in json.load(open(f"{DIR}/universe.json"))]
    MAJORS = {"BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT", "XRPUSDT"}
    drift = {}
    for sym in uni:
        m = load_m15(sym)
        c, t = m["c"].values, m["t"].values
        msk = (t >= t0) & (t <= split - 96 * M15)
        c2 = c[msk]
        if len(c2) > 200:
            drift[sym] = (c2[96:] / c2[:-96] - 1).mean()

    # confluence: count distinct same-dir classes within ±6 bars (±90 min)
    conf = defaultdict(set)
    by_ts = defaultdict(list)
    for _, r in design.iterrows():
        by_ts[(r["sym"], r["ts"])].append((r["type"], r["dir"]))
    for key, lst in by_ts.items():
        sym, ts = key
        for (ty, d) in lst:
            others = set()
            for off in range(-6, 7):
                for (ty2, d2) in by_ts.get((sym, ts + off * M15), []):
                    if d2 == d and ty2 != ty:
                        others.add(ty2)
            conf[(sym, ts, ty)] = len(others)
    design["confluence"] = [conf.get((r["sym"], r["ts"], r["type"]), 0) for _, r in design.iterrows()]
    design["bucket"] = np.where(design["sym"].isin(MAJORS), "major", "alt")

    # add drift-adjusted 24h return per event
    def adj24(row):
        d = drift.get(row["sym"], 0.0)
        return row["ret_24h"] * 1e4 - (d * 1e4 if row["dir"] == "bullish" else -d * 1e4)
    design["adj24"] = design.apply(adj24, axis=1)

    for (ty, d) in CLASSES:
        sub = design[(design["type"] == ty) & (design["dir"] == d)]
        if len(sub) < 150:
            print(f"\n### {ty}|{d}: n={len(sub)} — too small")
            continue
        print(f"\n### {ty}|{d} (n={len(sub)}) · base adj24 {sub['adj24'].mean():+.1f}bp")
        # regime
        print("  regime:", {k: f"{v:+.0f}bp(n={c})" for k, v, c in
              [(k, g["adj24"].mean(), len(g)) for k, g in sub.groupby("regime")]})
        # confluence
        print("  confluence:", {k: f"{v:+.0f}bp(n={c})" for k, v, c in
              [(k, g["adj24"].mean(), len(g)) for k, g in sub.groupby("confluence")]})
        # volp tercile
        sub2 = sub.copy()
        sub2["vp"] = pd.qcut(sub2["volp"].rank(method="first"), 3, labels=["lo", "mid", "hi"])
        print("  volp:", {k: f"{v:+.0f}bp(n={c})" for k, v, c in
              [(k, g["adj24"].mean(), len(g)) for k, g in sub2.groupby("vp")]})
        # extension tercile
        sub2["ext"] = pd.qcut(sub2["ema_dist"].abs().rank(method="first"), 3, labels=["near", "mid", "far"])
        print("  |ema_dist|:", {k: f"{v:+.0f}bp(n={c})" for k, v, c in
              [(k, g["adj24"].mean(), len(g)) for k, g in sub2.groupby("ext")]})
        # funding z bucket
        sub2["fz"] = pd.cut(sub2["fund_z"], [-np.inf, -1, 1, np.inf], labels=["neg", "neut", "pos"])
        print("  fund_z:", {k: f"{v:+.0f}bp(n={c})" for k, v, c in
              [(k, g["adj24"].mean(), len(g)) for k, g in sub2.groupby("fz")]})
        # bucket
        print("  sym:", {k: f"{v:+.0f}bp(n={c})" for k, v, c in
              [(k, g["adj24"].mean(), len(g)) for k, g in sub2.groupby("bucket")]})
        # strength tercile
        sub2["st"] = pd.qcut(sub2["strength"].rank(method="first"), 3, labels=["s1", "s2", "s3"])
        print("  strength:", {k: f"{v:+.0f}bp(n={c})" for k, v, c in
              [(k, g["adj24"].mean(), len(g)) for k, g in sub2.groupby("st")]})
        # hour buckets
        sub2["hb"] = pd.cut(sub2["hour_utc"], [-1, 3, 7, 11, 15, 19, 23], labels=["0-3", "4-7", "8-11", "12-15", "16-19", "20-23"])
        print("  hour:", {k: f"{v:+.0f}bp(n={c})" for k, v, c in
              [(k, g["adj24"].mean(), len(g)) for k, g in sub2.groupby("hb")]})


if __name__ == "__main__":
    main()
