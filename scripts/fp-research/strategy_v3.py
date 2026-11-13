#!/usr/bin/env python3
"""
fp-research step 11 — beta-aware variants of the frozen short rules.

V1  TREND-GATED: only short when the 4h regime is trend_down (EMA13<EMA89 or
    negative slope). Flat during rallies — no beta bleed.
V2  V1 + LIMIT ENTRY: limit at signal close + 0.5×ATR (better fill for
    shorts; skip if unfilled within 12 bars).
V3  V1 + funding filter: require fund_z >= 0 (crowded longs) when available.
All on DESIGN window; the surviving config is then scored on the HOLDOUT.
Costs 15bp; disaster stop 6×ATR; 24h time exit; max 6 concurrent, 1/symbol.
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


def select(df):
    m = (
        ((df["type"] == "bear_div") & (df["dir"] == "bearish"))
        | ((df["type"] == "exhaustion") & (df["dir"] == "bearish") & (df["confluence"] >= 1))
        | ((df["type"] == "absorption") & (df["dir"] == "bearish") & (df["confluence"] >= 2))
    )
    return df[m].copy()


def simulate(ev, gate_trend=True, limit_entry=False, fund_filter=False, cost=COST):
    trades = []
    per_sym = defaultdict(list)
    for _, e in ev.iterrows():
        per_sym[e["sym"]].append(e)
    for sym, evs in per_sym.items():
        m = load_m15(sym)
        o, h, l, c = m["o"].values, m["h"].values, m["l"].values, m["c"].values
        t = m["t"].values
        n = len(m)
        atr = (m["h"] - m["l"]).rolling(20).mean().values
        t2i = {ts: i for i, ts in enumerate(t)}
        for e in evs:
            if gate_trend and e["regime"] != "trend_down":
                continue
            if fund_filter and not (np.isfinite(e["fund_z"]) and e["fund_z"] >= 0):
                continue
            i = t2i.get(int(e["ts"]))
            if i is None:
                continue
            ei = i + int(e["confirmBars"]) + 1
            if ei >= n - 2:
                continue
            a = atr[i]
            if not np.isfinite(a) or a <= 0:
                continue
            sig_i = ei - int(e["confirmBars"]) - 1
            stop_ref = h[sig_i]
            if limit_entry:
                # limit at signal close + 0.5×ATR, valid 12 bars
                lim = c[sig_i] + 0.5 * a
                fill_i = None
                for j in range(ei, min(ei + 12, n)):
                    if h[j] >= lim:
                        fill_i = j
                        break
                if fill_i is None:
                    continue
                ei2 = fill_i
                entry = lim
            else:
                ei2 = ei
                entry = o[ei2]
            if not np.isfinite(entry) or entry <= 0:
                continue
            stop = stop_ref + TAIL_ATR * a
            stop_dist = stop - entry
            if stop_dist <= 0:
                continue
            j_end = min(ei2 + HOLD_BARS, n - 1)
            exit_px, exit_i, reason = None, None, None
            for j in range(ei2, j_end + 1):
                if h[j] >= stop:
                    exit_px, exit_i, reason = stop, j, "stop"
                    break
            if exit_px is None:
                exit_px, exit_i, reason = c[j_end], j_end, "time"
            trades.append({
                "sym": sym, "ts": t[ei2], "exit_ts": t[exit_i], "rule": e["type"],
                "ret": -(exit_px / entry - 1) - cost, "reason": reason,
                "stop_pct": stop_dist / entry,
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
        print(f"{label}: 0 trades")
        return None
    r = np.array([t["ret"] for t in trades])
    rr = r / np.array([t["stop_pct"] for t in trades])
    days = max((trades[-1]["ts"] - trades[0]["ts"]) / 86_400_000, 1e-9)
    wins, losses = r[r > 0], r[r <= 0]
    eq = np.cumsum(rr * 0.01)
    dd = (np.maximum.accumulate(eq) - eq).max()
    shp = r.mean() / (r.std() + 1e-9) * np.sqrt(len(r) / days)
    print(f"  {label:28s} n={len(r):4d} ({len(r)/days:4.1f}/d) win={(r>0).mean():.3f} avg={r.mean()*1e4:+7.1f}bp "
          f"PF={wins.sum()/max(1e-9,-losses.sum()):.2f} Shp={shp:5.2f} eq(1%risk)={eq[-1]*100:+7.1f}% DD={dd*100:5.1f}%")
    return r


def main():
    df = pd.read_pickle(f"{DIR}/events.pkl")
    df = add_confluence(df)
    t0, t1 = df["ts"].min(), df["ts"].max()
    split = t0 + (t1 - t0) // 2
    design = select(df[df["ts"] < split])
    hold = select(df[df["ts"] >= split])

    print("=== DESIGN ===")
    report("ungated (baseline)", simulate(design, gate_trend=False))
    report("V1 trend-gated", simulate(design))
    report("V2 trend + limit entry", simulate(design, limit_entry=True))
    report("V3 trend + funding>=0", simulate(design, fund_filter=True))

    print("\n=== HOLDOUT (scored once per config) ===")
    report("ungated (baseline)", simulate(hold, gate_trend=False))
    report("V1 trend-gated", simulate(hold))
    report("V2 trend + limit entry", simulate(hold, limit_entry=True))
    report("V3 trend + funding>=0", simulate(hold, fund_filter=True))


if __name__ == "__main__":
    main()
