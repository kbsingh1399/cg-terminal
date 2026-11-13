#!/usr/bin/env python3
"""
fp-research step 4 — event study over the reconstructed signals.

For every signal:
  entry  = open of the first m15 bar AFTER the signal is knowable
           (ts + (confirmBars+1)*15m) — no lookahead.
  fwd    = signed forward return of the signal direction at 1h/4h/12h/24h
  mfe/mae= max favorable / adverse excursion (of bar extremes) within 24h
  ctx    = 4h regime (last CLOSED 4h bar), funding z (3d mean vs 90d),
           distance to EMA89(m15), session, strength, vol percentile

Writes data/fp-research/events.pkl (pandas DataFrame) and prints the
per-class edge table with bootstrap CIs vs the all-bars baseline.
"""
import gzip
import json
import os
import pickle

import numpy as np
import pandas as pd

DIR = "data/fp-research"
HORIZONS = {"1h": 4, "4h": 16, "12h": 48, "24h": 96}  # m15 bars


def load_klines(path):
    rows = []
    with gzip.open(path, "rt") as f:
        for line in f:
            if line.strip():
                rows.append(json.loads(line))
    df = pd.DataFrame(rows)
    for c in ["o", "h", "l", "c", "v", "qv", "tb"]:
        df[c] = df[c].astype(float)
    df["t"] = df["t"].astype(np.int64)
    return df.sort_values("t").reset_index(drop=True)


def ema(series, span):
    return series.ewm(span=span, adjust=False).mean()


def main():
    uni = [x["symbol"] for x in json.load(open(f"{DIR}/universe.json"))]
    events = []

    for sym in uni:
        m15 = load_klines(f"{DIR}/15m_{sym}.jsonl.gz")
        h4 = load_klines(f"{DIR}/4h_{sym}.jsonl.gz")
        fund = pd.DataFrame(
            [json.loads(l) for l in gzip.open(f"{DIR}/funding_{sym}.jsonl.gz", "rt") if l.strip()]
        )
        fund["t"] = fund["t"].astype(np.int64)
        fund["r"] = fund["r"].astype(float)

        # features on m15
        m15["ema13"] = ema(m15["c"], 13)
        m15["ema89"] = ema(m15["c"], 89)
        m15["atr20"] = (m15["h"] - m15["l"]).rolling(20).mean()
        m15["volp"] = m15["v"].rolling(60).rank(pct=True)
        ts2i = {t: i for i, t in enumerate(m15["t"])}

        # 4h regime: EMA13/89 relation + slope of last closed bar (causal)
        h4["ema13"] = ema(h4["c"], 13)
        h4["ema89"] = ema(h4["c"], 89)

        # funding: rolling 3d (9 settl.) mean, z vs trailing 90d
        fund["m3"] = fund["r"].rolling(9).mean()
        fund["sd90"] = fund["m3"].rolling(270).std()
        fund["z"] = (fund["m3"] - fund["m3"].rolling(270).mean()) / fund["sd90"]

        def regime_at(ts_ms):
            idx = h4["t"].searchsorted(ts_ms, side="right") - 1
            # use last bar fully closed before ts
            while idx >= 0 and h4["t"].iloc[idx] + 14_400_000 > ts_ms:
                idx -= 1
            if idx < 20:
                return "na"
            e13, e89 = h4["ema13"].iloc[idx], h4["ema89"].iloc[idx]
            slope = h4["c"].iloc[idx] / h4["c"].iloc[max(0, idx - 6)] - 1
            sep = abs(e13 - e89) / e89
            if sep < 0.004:
                return "range"
            return "trend_up" if (e13 > e89 and slope > 0) or (e13 < e89 and slope > 0.01) else (
                "trend_down" if (e13 < e89 and slope < 0) or (e13 > e89 and slope < -0.01) else "range"
            )

        def funding_z_at(ts_ms):
            idx = fund["t"].searchsorted(ts_ms, side="right") - 1
            if idx < 270:
                return np.nan
            return fund["z"].iloc[idx]

        with open(f"{DIR}/cgsig_{sym}.jsonl") as f:
            sigs = [json.loads(l) for l in f if l.strip()]

        n = len(m15)
        o = m15["o"].values
        h = m15["h"].values
        l = m15["l"].values
        c = m15["c"].values

        for s in sigs:
            ts_ms = int(s["ts"])  # cgsig v2: already ms
            i = ts2i.get(ts_ms)
            if i is None:
                continue
            ei = i + s["confirmBars"] + 1  # entry bar index
            if ei >= n - 2:
                continue
            entry = o[ei]
            if not np.isfinite(entry) or entry <= 0:
                continue
            sign = 1 if s["dir"] == "bullish" else -1
            row = {
                "sym": sym, "ts": ts_ms, "type": s["type"], "dir": s["dir"],
                "strength": s["strength"], "price": s["price"], "entry": entry,
                "entry_i": ei,
                "regime": regime_at(ts_ms), "fund_z": funding_z_at(ts_ms),
                "ema_dist": (s["price"] / m15["ema89"].iloc[i] - 1),
                "volp": m15["volp"].iloc[i],
                "atr_pct": m15["atr20"].iloc[i] / s["price"] if s["price"] else np.nan,
                "hour_utc": (ts_ms // 3_600_000) % 24,
                "confirmBars": s["confirmBars"],
            }
            for name, hb in HORIZONS.items():
                j = min(ei + hb, n - 1)
                row[f"ret_{name}"] = sign * (c[j] / entry - 1)
            # MFE/MAE within 24h using bar extremes
            jend = min(ei + 96, n)
            seg_h = h[ei:jend]
            seg_l = l[ei:jend]
            row["mfe_24h"] = sign * ((seg_h.max() / entry - 1) if sign > 0 else (entry / seg_l.min() - 1))
            row["mae_24h"] = sign * ((entry / seg_l.min() - 1) if sign > 0 else (seg_h.max() / entry - 1))
            events.append(row)

    df = pd.DataFrame(events)
    df.to_pickle(f"{DIR}/events.pkl")
    print(f"events: {len(df)} across {df['sym'].nunique()} symbols")
    print(f"  span: {pd.to_datetime(df['ts'].min(), unit='ms')} → {pd.to_datetime(df['ts'].max(), unit='ms')}")

    # ---- edge table ----
    print("\n=== mean signed forward return (bps) by class × direction ===")
    g = df.groupby(["type", "dir"])[[f"ret_{k}" for k in HORIZONS]].mean() * 1e4
    g["n"] = df.groupby(["type", "dir"]).size()
    print(g.round(1).to_string())

    print("\n=== hit rate (share positive) at 4h ===")
    hr = df.groupby(["type", "dir"])["ret_4h"].apply(lambda x: (x > 0).mean())
    print(hr.round(3).to_string())

    # bootstrap CI on 4h mean for each class
    rng = np.random.default_rng(42)
    print("\n=== 4h mean edge, 95% bootstrap CI (bps) ===")
    for (t, d), grp in df.groupby(["type", "dir"]):
        x = grp["ret_4h"].values * 1e4
        if len(x) < 30:
            continue
        boots = [rng.choice(x, len(x), replace=True).mean() for _ in range(1000)]
        lo, hi = np.percentile(boots, [2.5, 97.5])
        print(f"  {t:11s} {d:8s} n={len(x):5d}  mean {x.mean():7.1f}  CI [{lo:7.1f}, {hi:7.1f}]")

    print("\n=== by regime (4h mean, bps) ===")
    print((df.groupby(["regime"])["ret_4h"].mean() * 1e4).round(1).to_string())
    print("\n=== by strength quartile (4h mean, bps) ===")
    df["sq"] = pd.qcut(df["strength"].rank(method="first"), 4, labels=["q1", "q2", "q3", "q4"])
    print((df.groupby("sq")["ret_4h"].mean() * 1e4).round(1).to_string())


if __name__ == "__main__":
    main()
