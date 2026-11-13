#!/usr/bin/env python3
"""
fp-research step 9 — FROZEN STRATEGY: two-window test (design / holdout).

Rules frozen from the design window (2026-05-17 → 2026-08-15):
  R1  bear_div|bearish  SHORT  — no filter (robust across all cuts)
  R2  exhaustion|bearish SHORT — confluence >= 1 (other bearish class ±6 bars)
  R3  absorption|bearish SHORT — confluence >= 2
Exits: 24h time exit · disaster stop 3×ATR beyond the signal-bar high.
Costs: 15bp round trip (25bp stress). Portfolio: max 6 concurrent, 1/symbol.
Sizing for the equity curve: 1% equity risk per trade off the stop distance.

The holdout (2026-08-15 → 2026-11-13) is scored ONCE — no iterations after
seeing it.
"""
import gzip
import json
from collections import defaultdict

import numpy as np
import pandas as pd

DIR = "data/fp-research"
M15 = 900_000
COST = 0.0015
COST_STRESS = 0.0025
HOLD_BARS = 96  # 24h
TAIL_ATR = 3.0
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
    """Frozen rules → candidate trade events."""
    m = (
        ((df["type"] == "bear_div") & (df["dir"] == "bearish"))
        | ((df["type"] == "exhaustion") & (df["dir"] == "bearish") & (df["confluence"] >= 1))
        | ((df["type"] == "absorption") & (df["dir"] == "bearish") & (df["confluence"] >= 2))
    )
    return df[m].copy()


def simulate(ev, cost=COST, max_conc=MAX_CONC):
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
            stop = h[sig_i] + TAIL_ATR * a  # SHORT disaster stop
            stop_dist = stop - entry
            if stop_dist <= 0:
                continue
            j_end = min(ei + HOLD_BARS, n - 1)
            exit_px, exit_i, reason = None, None, None
            for j in range(ei, j_end + 1):
                if h[j] >= stop:
                    exit_px, exit_i, reason = stop, j, "stop"
                    break
            if exit_px is None:
                exit_px, exit_i, reason = c[j_end], j_end, "time"
            ret = -(exit_px / entry - 1) - cost  # short
            trades.append({
                "sym": sym, "ts": t[ei], "exit_ts": t[exit_i], "rule": e["type"],
                "ret": ret, "reason": reason, "hold": exit_i - ei,
                "stop_pct": stop_dist / entry,
            })
    trades.sort(key=lambda x: x["ts"])
    held, kept = {}, []
    for tr in trades:
        held = {s: x for s, x in held.items() if x > tr["ts"]}
        if tr["sym"] in held or len(held) >= max_conc:
            continue
        kept.append(tr)
        held[tr["sym"]] = tr["exit_ts"]
    return kept


def report(label, trades, cost_note=""):
    if not trades:
        print(f"{label}: no trades")
        return
    r = np.array([t["ret"] for t in trades])
    wins, losses = r[r > 0], r[r <= 0]
    days = max((trades[-1]["ts"] - trades[0]["ts"]) / 86_400_000, 1e-9)
    eq = np.cumsum(r / np.array([t["stop_pct"] for t in trades]) * 0.01)  # 1% risk sizing
    dd = (np.maximum.accumulate(eq) - eq).max()
    pf = wins.sum() / max(1e-9, -losses.sum())
    print(f"{label}")
    print(f"  n={len(r)} ({len(r)/days:.1f}/d) · win {(r>0).mean():.3f} · avg {r.mean()*1e4:+.1f}bp · "
          f"PF {pf:.2f} · trades stopped {(np.array([t['reason'] for t in trades])=='stop').mean()*100:.0f}%")
    print(f"  equity (1% risk/trade): total {eq[-1]*100:+.1f}% · maxDD {dd*100:.1f}% · per-trade R mean {np.mean(r/np.array([t['stop_pct'] for t in trades])):+.3f}")
    by_rule = defaultdict(list)
    for t in trades:
        by_rule[t["rule"]].append(t["ret"])
    for k, v in sorted(by_rule.items()):
        print(f"    {k:11s} n={len(v):5d} avg {np.mean(v)*1e4:+7.1f}bp")


def main():
    df = pd.read_pickle(f"{DIR}/events.pkl")
    df = add_confluence(df)
    t0, t1 = df["ts"].min(), df["ts"].max()
    split = t0 + (t1 - t0) // 2
    design = df[df["ts"] < split]
    hold = df[df["ts"] >= split]

    print("=== DESIGN (in-sample — rule selection was done here) ===")
    report("design · frozen rules · 15bp cost", simulate(select(design)))
    print("\n=== HOLDOUT (out-of-sample — scored once) ===")
    htr = simulate(select(hold))
    report("holdout · frozen rules · 15bp cost", htr)
    print("\n=== HOLDOUT stress: 25bp cost ===")
    report("holdout · 25bp cost", simulate(select(hold), cost=COST_STRESS))

    # Monte Carlo bootstrap on holdout trades (1% risk sizing)
    r = np.array([t["ret"] / t["stop_pct"] * 0.01 for t in htr])
    rng = np.random.default_rng(20261113)
    paths = np.array([[eq for eq in np.cumsum(rng.choice(r, len(r), replace=True))] for _ in range(2000)])
    finals = paths[:, -1]
    maxdds = (np.maximum.accumulate(paths, axis=1) - paths).max(axis=1)
    print(f"\nMonte Carlo (2000 paths, holdout trade distribution):")
    print(f"  final equity p5 {np.percentile(finals,5)*100:+.1f}% · p50 {np.percentile(finals,50)*100:+.1f}% · p95 {np.percentile(finals,95)*100:+.1f}%")
    print(f"  P(loss) = {(finals < 0).mean():.3f} · P(maxDD > 10%) = {(maxdds > 0.10).mean():.3f} · P(maxDD > 20%) = {(maxdds > 0.20).mean():.3f}")

    # per-symbol holdout attribution
    by_sym = defaultdict(list)
    for t in htr:
        by_sym[t["sym"]].append(t["ret"])
    print("\nholdout per-symbol (avg bp, n):")
    print("  " + " · ".join(f"{s.replace('USDT','')}:{np.mean(v)*1e4:+.0f}({len(v)})" for s, v in sorted(by_sym.items(), key=lambda x: -np.mean(x[1]))))


if __name__ == "__main__":
    main()
