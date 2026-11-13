#!/usr/bin/env python3
"""
fp-research step 13 — SYMMETRIC TREND-ALIGNED FOOTPRINT BOOK.

Principle (no side-specific tuning): trade the signal direction ONLY when
aligned with both the symbol's 4h trend and BTC's 1d trend.
  LONG  exhaustion|bullish (conf>=1) + trapped|bullish   in 4h trend_up  + BTC 1d up
  SHORT exhaustion|bearish (conf>=1) + absorption|bearish (conf>=2) in 4h trend_down + BTC 1d down
6×ATR disaster stop · 24h time exit · 15bp cost · max 6 concurrent · 1/sym.

Scored on BOTH windows (design + holdout). If profitable in both, this is
the candidate; final estimate = pooled.
"""
import gzip
import json
from collections import defaultdict

import numpy as np
import pandas as pd

DIR = "data/fp-research"
M15 = 900_000
COST = 0.0015
HOLD_BARS = 96
TAIL_ATR = 6.0
MAX_CONC = 6

_M15 = {}


def load_m15(sym):
    if sym not in _M15:
        rows = [json.loads(l) for l in gzip.open(f"{DIR}/15m_{sym}.jsonl.gz", "rt") if l.strip()]
        df = pd.DataFrame(rows)
        for c in ["o", "h", "l", "c", "v"]:
            df[c] = df[c].astype(float)
        df["t"] = df["t"].astype(np.int64)
        _M15[sym] = df.sort_values("t").reset_index(drop=True)
    return _M15[sym]


def btc_1d_trend():
    btc = load_m15("BTCUSDT")
    btc["day"] = btc["t"] // 86_400_000
    d1 = btc.groupby("day")["c"].last()
    e13 = d1.ewm(span=13, adjust=False).mean()
    e89 = d1.ewm(span=89, adjust=False).mean()
    return dict(zip(d1.index, (e13 > e89).astype(bool)))


def add_confluence(df):
    by_ts = defaultdict(list)
    for _, r in df.iterrows():
        by_ts[(r["sym"], r["ts"])].append((r["type"], r["dir"]))
    out = []
    for _, r in df.iterrows():
        others = set()
        for off in range(-6, 7):
            for (ty, d) in by_ts.get((r["sym"], r["ts"] + off * M15), []):
                if d == r["dir"] and ty != r["type"]:
                    others.add(ty)
        out.append(len(others))
    df = df.copy()
    df["confluence"] = out
    return df


def select_symmetric(df):
    longs = (
        ((df["type"] == "exhaustion") & (df["dir"] == "bullish") & (df["confluence"] >= 1))
        | ((df["type"] == "trapped") & (df["dir"] == "bullish"))
    ) & (df["regime"] == "trend_up")
    shorts = (
        ((df["type"] == "exhaustion") & (df["dir"] == "bearish") & (df["confluence"] >= 1))
        | ((df["type"] == "absorption") & (df["dir"] == "bearish") & (df["confluence"] >= 2))
    ) & (df["regime"] == "trend_down")
    return longs, shorts


def simulate(ev, btc_up, side):
    """side: +1 long, -1 short. BTC 1d gate: longs need BTC up, shorts BTC down."""
    trades = []
    per_sym = defaultdict(list)
    for _, e in ev.iterrows():
        day = int(e["ts"]) // 86_400_000
        btc_ok = btc_up.get(day, False) if side > 0 else not btc_up.get(day, True)
        if not btc_ok:
            continue
        per_sym[e["sym"]].append(e)
    for sym, evs in per_sym.items():
        m = load_m15(sym)
        o, h, l, c = m["o"].values, m["h"].values, m["l"].values, m["c"].values
        t = m["t"].values
        n = len(m)
        atr = (m["h"] - m["l"]).rolling(20).mean().values
        t2i = {ts: i for i, ts in enumerate(t)}
        for e in evs:
            i = t2i.get(int(e["ts"]))
            if i is None:
                continue
            ei = i + int(e["confirmBars"]) + 1
            if ei >= n - 2:
                continue
            entry = o[ei]
            a = atr[i]
            if not np.isfinite(entry) or not np.isfinite(a) or a <= 0:
                continue
            sig_i = ei - int(e["confirmBars"]) - 1
            if side > 0:
                stop = l[sig_i] - TAIL_ATR * a
                stop_dist = entry - stop
            else:
                stop = h[sig_i] + TAIL_ATR * a
                stop_dist = stop - entry
            if stop_dist <= 0:
                continue
            j_end = min(ei + HOLD_BARS, n - 1)
            exit_px, exit_i, reason = None, None, None
            for j in range(ei, j_end + 1):
                hit = (l[j] <= stop) if side > 0 else (h[j] >= stop)
                if hit:
                    exit_px, exit_i, reason = stop, j, "stop"
                    break
            if exit_px is None:
                exit_px, exit_i, reason = c[j_end], j_end, "time"
            ret = side * (exit_px / entry - 1) - COST
            trades.append({
                "sym": sym, "ts": t[ei], "exit_ts": t[exit_i], "rule": e["type"],
                "side": side, "ret": ret, "reason": reason, "stop_pct": stop_dist / entry,
            })
    trades.sort(key=lambda x: x["ts"])
    held, kept = {}, []
    for tr in trades:
        held = {s: x for s, x in held.items() if x > tr["ts"]}
        if tr["sym"] in held or len(held) >= MAX_CONC:
            continue
        kept.append(tr)
        held[tr["sym"]] = tr["exit_ts"]
    return kept


def report(label, trades):
    if not trades:
        print(f"  {label}: 0 trades")
        return None
    r = np.array([t["ret"] for t in trades])
    rr = r / np.array([t["stop_pct"] for t in trades])
    days = max((trades[-1]["ts"] - trades[0]["ts"]) / 86_400_000, 1e-9)
    wins, losses = r[r > 0], r[r <= 0]
    eq = np.cumsum(rr * 0.01)
    dd = (np.maximum.accumulate(eq) - eq).max()
    print(f"  {label:22s} n={len(r):4d} ({len(r)/days:4.1f}/d) win={(r>0).mean():.3f} avg={r.mean()*1e4:+7.1f}bp "
          f"PF={wins.sum()/max(1e-9,-losses.sum()):.2f} eq(1%risk)={eq[-1]*100:+7.1f}% DD={dd*100:5.1f}%")
    return r


def main():
    df = pd.read_pickle(f"{DIR}/events.pkl")
    df = add_confluence(df)
    btc_up = btc_1d_trend()
    t0, t1 = df["ts"].min(), df["ts"].max()
    split = t0 + (t1 - t0) // 2

    for wname, lo, hi in [("DESIGN", t0, split), ("HOLDOUT", split, t1)]:
        w = df[(df["ts"] >= lo) & (df["ts"] < hi)]
        longs, shorts = select_symmetric(w)
        print(f"=== {wname} ===")
        lt = simulate(w[longs], btc_up, +1)
        st = simulate(w[shorts], btc_up, -1)
        report("LONG leg", lt)
        report("SHORT leg", st)
        both = lt + st
        both.sort(key=lambda x: x["ts"])
        # re-apply concurrency over the combined book
        held, kept = {}, []
        for tr in both:
            held = {s: x for s, x in held.items() if x > tr["ts"]}
            if tr["sym"] in held or len(held) >= MAX_CONC:
                continue
            kept.append(tr)
            held[tr["sym"]] = tr["exit_ts"]
        report("COMBINED (concurrent)", kept)


if __name__ == "__main__":
    main()
