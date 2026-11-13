#!/usr/bin/env python3
"""
fp-research step 7 — AGGREGATED vs BINANCE-ONLY signal comparison.

Pulls from the running terminal (which proxies Coinglass orderFlow):
  /api/cg/orderflow?sym=BTC&interval=m15&limit=1000      → Binance-only buckets
  /api/cg/orderflow-agg?sym=BTC&interval=m15&limit=1000  → aggregated
      (Binance+OKX+Bybit+Bitget+Hyperliquid, re-gridded)

Builds FlowBars directly from the PRICE CELLS (true attribution — no m1
approximation), runs the calibrated CG engine on both, and reports:
  - signal counts per class
  - overlap (same bar ± 1, same class+dir)
  - forward returns per class on each variant (1h/4h/12h) using fapi closes
"""
import gzip
import json
import sys

import numpy as np
import pandas as pd

sys.path.insert(0, "scripts/fp-research")
from cg_signals_v2 import compute_cg_signals, M15  # noqa: E402

T = "http://127.0.0.1:3000"
DIR = "data/fp-research"


def fetch_footprint(path):
    import urllib.request
    req = urllib.request.Request(f"{T}{path}", headers={"User-Agent": "fp-research/1.0"})
    with urllib.request.urlopen(req, timeout=120) as r:
        return json.load(r)


def flow_from_buckets(bars, m15df):
    """bars: [{ts, buckets:[[lo,hi,buy,sell,...],...]}] → flow DataFrame
    aligned to the Binance m15 OHLC (for closePos and zone boundaries)."""
    m = m15df.set_index("t")
    rows = []
    for b in bars:
        ts_ms = b["ts"] * 1000
        k = m.loc[ts_ms] if ts_ms in m.index else None
        if k is None:
            continue
        lo, hi = float(k["l"]), float(k["h"])
        rng = hi - lo or 1e-12
        buy = sell = low30 = high30 = low10 = high10 = 0.0
        for bk in b["buckets"]:
            blo, bhi, bbuy, bsell = float(bk[0]), float(bk[1]), float(bk[2]), float(bk[3])
            buy += bbuy
            sell += bsell
            # cell center attribution
            c = (blo + bhi) / 2
            if c <= lo + 0.3 * rng:
                low30 += bsell
            if c >= hi - 0.3 * rng:
                high30 += bbuy
            if c <= lo + 0.1 * rng:
                low10 += bsell + bbuy
            if c >= hi - 0.1 * rng:
                high10 += bsell + bbuy
        vol = buy + sell
        rows.append({
            "t": ts_ms, "l": lo, "h": hi, "c": float(k["c"]), "o": float(k["o"]),
            "buy": buy, "sell": sell, "v": vol, "delta": buy - sell,
            "low30": low30, "high30": high30, "low10": low10, "high10": high10,
        })
    df = pd.DataFrame(rows).sort_values("t").reset_index(drop=True)
    df["cvd"] = df["delta"].cumsum()
    df["closePos"] = ((df["c"] - df["l"]) / (df["h"] - df["l"]).clip(lower=1e-12)).clip(0, 1)
    return df


def fwd_returns(sigs, m15df):
    c = m15df.set_index("t")["c"]
    t = m15df["t"].values
    n = len(t)
    out = []
    for s in sigs:
        i = np.searchsorted(t, s["ts"])
        ei = i + s["confirmBars"] + 1
        if ei >= n - 2:
            continue
        entry = m15df["o"].values[ei]
        if not np.isfinite(entry) or entry <= 0:
            continue
        sign = 1 if s["dir"] == "bullish" else -1
        row = {"type": s["type"], "dir": s["dir"], "ts": s["ts"]}
        for name, hb in [("1h", 4), ("4h", 16), ("12h", 48)]:
            j = min(ei + hb, n - 1)
            row[f"ret_{name}"] = sign * (c.values[j] / entry - 1)
        out.append(row)
    return pd.DataFrame(out)


def main():
    for sym in ["BTCUSDT", "ETHUSDT"]:
        m15 = pd.DataFrame([json.loads(l) for l in gzip.open(f"{DIR}/15m_{sym}.jsonl.gz", "rt") if l.strip()])
        for c in ["o", "h", "l", "c", "v"]:
            m15[c] = m15[c].astype(float)
        m15["t"] = m15["t"].astype(np.int64)
        m15 = m15.sort_values("t").reset_index(drop=True)

        print(f"\n================ {sym} ================")
        variants = {}
        for name, path in [
            ("binance", f"/api/cg/orderflow?symbol=Binance_{sym}&interval=m15&limit=1000"),
            ("aggregated", f"/api/cg/orderflow-agg?sym={sym.replace('USDT', '')}&interval=m15&limit=1000"),
        ]:
            j = fetch_footprint(path)
            if not j.get("ok") or not j.get("bars"):
                print(f"  {name}: unavailable ({j.get('reason') or j.get('error')})")
                continue
            df = flow_from_buckets(j["bars"], m15)
            sigs = compute_cg_signals(df)
            variants[name] = (df, sigs)
            fr = fwd_returns(sigs, m15)
            print(f"  {name:10s}: {len(df)} bars → {len(sigs)} signals", end="")
            if len(fr):
                print(f" · 4h mean {fr['ret_4h'].mean()*1e4:+.1f}bp · hit {(fr['ret_4h']>0).mean():.2f}")
            else:
                print()
            # also cross-validate the Binance variant against kline reconstruction
        if "binance" in variants and "aggregated" in variants:
            b = {(s["ts"], s["type"], s["dir"]) for s in variants["binance"][1]}
            a = {(s["ts"], s["type"], s["dir"]) for s in variants["aggregated"][1]}
            exact = b & a
            near_b = set()
            for (ts, ty, d) in b:
                if any((ts + off, ty, d) in a for off in (-M15, 0, M15)):
                    near_b.add((ts, ty, d))
            print(f"  overlap: binance {len(b)} · aggregated {len(a)} · exact {len(exact)} · within±1bar {len(near_b)} ({len(near_b)/max(1,len(b))*100:.0f}% of binance)")
            # per-class forward-return comparison
            frb = fwd_returns(variants["binance"][1], m15)
            fra = fwd_returns(variants["aggregated"][1], m15)
            if len(frb) and len(fra):
                print("  class                  binance n/4h-bp     agg n/4h-bp")
                for (ty, d) in sorted(set(zip(frb["type"], frb["dir"])) | set(zip(fra["type"], fra["dir"]))):
                    gb = frb[(frb["type"] == ty) & (frb["dir"] == d)]["ret_4h"]
                    ga = fra[(fra["type"] == ty) & (fra["dir"] == d)]["ret_4h"]
                    print(f"  {ty:11s} {d:8s}  {len(gb):4d} {gb.mean()*1e4 if len(gb) else 0:+8.1f}     {len(ga):4d} {ga.mean()*1e4 if len(ga) else 0:+8.1f}")


if __name__ == "__main__":
    main()
