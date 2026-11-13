#!/usr/bin/env python3
"""
fp-research step 12 — TRUE WALK-FORWARD with adaptive rule selection.

Every 30d fold, the rule×gate config is chosen from the TRAILING 60d only:
  rules:  R1 bear_div short · R2 exhaustion|bearish short (conf>=1) ·
          R3 absorption|bearish short (conf>=2)
  gates:  G0 none · G1 BTC 1d EMA13<EMA89 (market downtrend)
  stop:   6×ATR disaster · 24h time exit · 15bp cost · max 6 concurrent
Selection: best avg bp per trade with n>=30 on the train window.
Aggregate OOS trades across the 6 folds = the honest record.
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


def btc_1d_down_series():
    btc = load_m15("BTCUSDT")
    btc["day"] = btc["t"] // 86_400_000
    d1 = btc.groupby("day")["c"].last()
    e13 = d1.ewm(span=13, adjust=False).mean()
    e89 = d1.ewm(span=89, adjust=False).mean()
    return dict(zip(d1.index, (e13 < e89).astype(bool)))


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


def rules_for(df):
    return {
        "R1_bearDiv": (df["type"] == "bear_div") & (df["dir"] == "bearish"),
        "R2_exhConf1": (df["type"] == "exhaustion") & (df["dir"] == "bearish") & (df["confluence"] >= 1),
        "R3_absConf2": (df["type"] == "absorption") & (df["dir"] == "bearish") & (df["confluence"] >= 2),
    }


def simulate(ev, btc_down, use_gate, cost=COST):
    trades = []
    per_sym = defaultdict(list)
    for _, e in ev.iterrows():
        if use_gate:
            day = int(e["ts"]) // 86_400_000
            if not btc_down.get(day, False):
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
            stop = h[sig_i] + TAIL_ATR * a
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
            trades.append({
                "sym": sym, "ts": t[ei], "exit_ts": t[exit_i], "rule": e["type"],
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


def main():
    df = pd.read_pickle(f"{DIR}/events.pkl")
    df = add_confluence(df)
    btc_down = btc_1d_down_series()
    rules = rules_for(df)
    t0, t1 = df["ts"].min(), df["ts"].max()
    D = 86_400_000

    # 6 OOS folds of 30d; train = trailing 60d (first fold trains on 60d prior)
    folds = []
    start = t0 + 60 * D
    while start < t1:
        folds.append((start, min(start + 30 * D, t1)))
        start += 30 * D

    all_oos = []
    print("=== WALK-FORWARD (train 60d → trade 30d, adaptively selected rule×gate) ===")
    for (a, b) in folds:
        train = df[(df["ts"] >= a - 60 * D) & (df["ts"] < a)]
        test = df[(df["ts"] >= a) & (df["ts"] < b)]
        best, best_avg, best_n = None, -1e9, 0
        for rname, mask in rules.items():
            for gate in [False, True]:
                tr = simulate(train[mask], btc_down, gate)
                if len(tr) < 30:
                    continue
                avg = np.mean([x["ret"] for x in tr])
                if avg > best_avg:
                    best_avg, best, best_n = avg, (rname, gate), len(tr)
        if best is None:
            print(f"  fold {pd.to_datetime(a, unit='ms').date()} → {pd.to_datetime(b, unit='ms').date()}: no config with n>=30 — FLAT")
            continue
        rname, gate = best
        trs = simulate(test[rules[rname]], btc_down, gate)
        for t in trs:
            t["fold_cfg"] = f"{rname}{'_1dgate' if gate else ''}"
        all_oos += trs
        avg = np.mean([x["ret"] for x in trs]) if trs else 0
        print(f"  fold {pd.to_datetime(a, unit='ms').date()} → {pd.to_datetime(b, unit='ms').date()}: "
              f"picked {rname}{' + BTC1d gate' if gate else ''} (train avg {best_avg*1e4:+.1f}bp n={best_n}) → "
              f"OOS n={len(trs)} avg {avg*1e4:+.1f}bp")

    if not all_oos:
        print("no OOS trades")
        return
    r = np.array([t["ret"] for t in all_oos])
    rr = r / np.array([t["stop_pct"] for t in all_oos])
    wins, losses = r[r > 0], r[r <= 0]
    days = (all_oos[-1]["ts"] - all_oos[0]["ts"]) / D
    eq = np.cumsum(rr * 0.01)
    dd = (np.maximum.accumulate(eq) - eq).max()
    print(f"\n=== AGGREGATE WALK-FORWARD OOS ({days:.0f}d) ===")
    print(f"n={len(r)} ({len(r)/days:.1f}/d) · win {(r>0).mean():.3f} · avg {r.mean()*1e4:+.1f}bp · "
          f"PF {wins.sum()/max(1e-9,-losses.sum()):.2f}")
    print(f"equity (1% risk/trade): {eq[-1]*100:+.1f}% · maxDD {dd*100:.1f}%")
    # stress: 25bp
    r2 = r - 0.0010
    rr2 = r2 / np.array([t["stop_pct"] for t in all_oos])
    eq2 = np.cumsum(rr2 * 0.01)
    dd2 = (np.maximum.accumulate(eq2) - eq2).max()
    print(f"stress 25bp cost: equity {eq2[-1]*100:+.1f}% · maxDD {dd2*100:.1f}%")
    # bootstrap on R
    rng = np.random.default_rng(7)
    boots = [rng.choice(rr, len(rr), replace=True).sum() for _ in range(4000)]
    print(f"bootstrap P(total R <= 0) = {np.mean(np.array(boots) <= 0):.3f}")
    cfg = defaultdict(list)
    for t in all_oos:
        cfg[t["fold_cfg"]].append(t["ret"])
    print("\nOOS by chosen config:")
    for k, v in sorted(cfg.items()):
        print(f"  {k:24s} n={len(v):4d} avg={np.mean(v)*1e4:+.1f}bp")


if __name__ == "__main__":
    main()
