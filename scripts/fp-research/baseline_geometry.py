#!/usr/bin/env python3
"""
fp-research step 4b — drift-adjusted baselines + MFE/MAE geometry.

Answers two questions the raw edge table cannot:
  1. Is the signal edge just market drift? (signal mean minus the symbol's
     unconditional same-horizon drift, signed per direction)
  2. What stop/target geometry does the signal path support?
     (MFE/MAE distributions, P(reach +X before -Y) matrices)
"""
import json
import pickle

import numpy as np
import pandas as pd

DIR = "data/fp-research"
HORIZONS = {"1h": 4, "4h": 16, "12h": 48, "24h": 96}


def main():
    df = pd.read_pickle(f"{DIR}/events.pkl")

    # ---- 1. drift adjustment ----
    # per-symbol unconditional mean signed return at each horizon, computed
    # over ALL bars (direction-random) → bullish drift term = mu, bearish = -mu
    print("=== symbol drift over the window (24h horizon, bps) ===")
    uni = [x["symbol"] for x in json.load(open(f"{DIR}/universe.json"))]
    for sym in uni:
        d = df[df["sym"] == sym]
        if len(d):
            print(f"  {sym:14s} n={len(d):5d}  24h drift {d['ret_24h'].mean()*1e4:8.1f} bps")

    # global drift at each horizon from ALL signal rows' underlying bars is
    # approximated by the events sample; compute per-symbol drift from events
    # would bias. Instead: recompute drift from m15 klines directly.
    import gzip
    drift = {}
    for sym in uni:
        rows = [json.loads(l) for l in gzip.open(f"{DIR}/15m_{sym}.jsonl.gz", "rt") if l.strip()]
        c = np.array([float(r["c"]) for r in rows])
        t = np.array([r["t"] for r in rows])
        # align to events span
        lo, hi = df["ts"].min(), df["ts"].max()
        m = (t >= lo) & (t <= hi - 96 * 900_000)
        c2, t2 = c[m], t[m]
        if len(c2) > 100:
            fwd = c2[96:] / c2[:-96] - 1  # 24h forward return per bar
            drift[sym] = fwd.mean()
    mu = np.mean(list(drift.values()))
    print(f"\nuniverse mean 24h drift: {mu*1e4:.1f} bps  (per-symbol range "
          f"[{min(drift.values())*1e4:.1f}, {max(drift.values())*1e4:.1f}])")

    print("\n=== drift-adjusted 4h/24h edge (signal mean − direction-signed drift, bps) ===")
    # scale drift to horizon (drift_24h × h/96)
    for hname, hb in [("4h", 16), ("24h", 96)]:
        col = f"ret_{hname}"
        rows = []
        for (t, d), grp in df.groupby(["type", "dir"]):
            x = grp[col].values * 1e4
            # drift for this group: mean over grp symbols of drift24 * hb/96, signed
            dr = np.mean([drift.get(s, 0.0) * hb / 96 * 1e4 for s in grp["sym"]])
            adj = x.mean() - (dr if d == "bullish" else -dr)
            rows.append((t, d, len(x), x.mean(), adj))
        out = pd.DataFrame(rows, columns=["type", "dir", "n", "raw", "adj"]).set_index(["type", "dir"])
        print(f"--- {hname} ---")
        print(out.round(1).to_string())

    # ---- 2. MFE/MAE geometry (for stop/target design) ----
    print("\n=== MFE/MAE within 24h (bps, signed) by class ===")
    g = df.groupby(["type", "dir"])[["mfe_24h", "mae_24h"]].agg(["mean", lambda x: x.quantile(0.25), "median", lambda x: x.quantile(0.75)])
    g.columns = ["mfe_mean", "mfe_q25", "mfe_med", "mfe_q75", "mae_mean", "mae_q25", "mae_med", "mae_q75"]
    print((g * 1e4).round(1).to_string())

    # P(reach +X before −Y) style matrix for the workhorse class combos
    print("\n=== P(hit target +X% before stop −Y%) within 24h ===")
    for label, sel in [
        ("divergence|bullish", (df["type"] == "divergence") & (df["dir"] == "bullish")),
        ("bull_div|bullish", (df["type"] == "bull_div") & (df["dir"] == "bullish")),
        ("bear_div|bearish", (df["type"] == "bear_div") & (df["dir"] == "bearish")),
        ("exhaustion|bullish", (df["type"] == "exhaustion") & (df["dir"] == "bullish")),
    ]:
        sub = df[sel]
        if len(sub) < 100:
            continue
        for tgt, stp in [(0.005, 0.005), (0.010, 0.005), (0.010, 0.010), (0.015, 0.0075), (0.020, 0.010)]:
            hit = ((sub["mfe_24h"] >= tgt) & (sub["mae_24h"] >= -stp)).mean()
            print(f"  {label:20s} tgt +{tgt*100:.2f}% / stop −{stp*100:.2f}% → P(both reached)={hit:.3f}  (MFE-only={(sub['mfe_24h']>=tgt).mean():.3f})")

    # ---- 3. confluence preview: ≥2 distinct classes same dir within 12 bars ----
    print("\n=== confluence preview (≥2 distinct bull classes within 12 bars; ret in bps) ===")
    rows = []
    for sym in uni:
        d = df[(df["sym"] == sym) & (df["dir"] == "bullish")].sort_values("ts")
        if not len(d):
            continue
        ts = d["ts"].values
        types = d["type"].values
        used = set()
        for i in range(len(d)):
            if i in used:
                continue
            group = [i]
            for j in range(i + 1, len(d)):
                if ts[j] - ts[i] > 12 * 900_000:
                    break
                if types[j] != types[i]:
                    group.append(j)
            if len(set(types[g] for g in group)) >= 2:
                rows.append(d.iloc[i])
                used.update(group)
    conf = pd.DataFrame(rows)
    if len(conf):
        print(f"confluence events: {len(conf)}")
        print((conf[["ret_4h", "ret_12h", "ret_24h", "mfe_24h", "mae_24h"]].mean() * 1e4).round(1).to_string())
        print(f"hit 4h: {(conf['ret_4h'] > 0).mean():.3f} · hit 24h: {(conf['ret_24h'] > 0).mean():.3f}")


if __name__ == "__main__":
    main()
