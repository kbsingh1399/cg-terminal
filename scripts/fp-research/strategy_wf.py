#!/usr/bin/env python3
"""
fp-research step 5 — event-driven strategy backtester + walk-forward.

Core: "CVD Fade" — fade price moves that cumulative delta refuses to confirm.
  SHORT bear_div (price HH, CVD LL)      — fast fade, 4-12h
  LONG  bull_div (price LL, CVD HH)      — slow fade, 24h
  SHORT exhaustion-bearish (HH weak buys) — secondary, 24h
  (absorption added once full m1 zones land — configurable)

Engine: m15 bar-path simulation, entry at first-bar-open after knowability,
intrabar stop-before-target (conservative), fees+slippage in bps, portfolio
constraints (max concurrent, one per symbol), fixed-fractional risk sizing.

Walk-forward: 3 folds × (90d train → 30d OOS), params chosen on train by
Sharpe with trade-count floor; OOS trades concatenated for the verdict.
"""
import gzip
import itertools
import json
import pickle
import sys

import numpy as np
import pandas as pd

DIR = "data/fp-research"
COST_BPS = 15.0       # round trip: 2×taker 4bps + slippage ~3.5bps + impact
COST_STRESS_BPS = 25.0

# ---------------------------------------------------------------- data


def load_m15(sym):
    rows = [json.loads(l) for l in gzip.open(f"{DIR}/15m_{sym}.jsonl.gz", "rt") if l.strip()]
    df = pd.DataFrame(rows)
    for c in ["o", "h", "l", "c", "v"]:
        df[c] = df[c].astype(float)
    df["t"] = df["t"].astype(np.int64)
    return df.sort_values("t").reset_index(drop=True)


# ---------------------------------------------------------------- engine


class Sim:
    """Bar-path trade simulator over one symbol's m15 bars."""

    def __init__(self, m15: pd.DataFrame, cost_bps: float):
        self.t = m15["t"].values
        self.o = m15["o"].values
        self.h = m15["h"].values
        self.l = m15["l"].values
        self.c = m15["c"].values
        self.atr = (m15["h"] - m15["l"]).rolling(20).mean().values
        self.ts2i = {t: i for i, t in enumerate(self.t)}
        self.n = len(m15)
        self.cost = cost_bps / 1e4

    def run(self, events, stop_atr=1.0, stop_mode="struct", target_r=2.0,
            time_stop=96, tgt_mode="r"):
        """
        events: list of dicts with ts(ms), dir(+1/-1), entry_i (bar idx of entry)
        Returns list of trade dicts (R-multiple net of costs).
        """
        out = []
        for ev in events:
            i = ev["entry_i"]
            d = ev["dir"]
            entry = self.o[i]
            atr = self.atr[i]
            if not np.isfinite(entry) or not np.isfinite(atr) or atr <= 0:
                continue
            # structural stop: beyond the signal-bar extreme ± buffer
            if stop_mode == "struct":
                raw = (self.h[i - 1] + 0.5 * atr - entry) if d > 0 else (entry - (self.l[i - 1] - 0.5 * atr))
                stop_dist = max(raw, 0.5 * atr)
            else:  # atr mode
                stop_dist = stop_atr * atr
            stop = entry - d * stop_dist
            if tgt_mode == "r":
                target = entry + d * target_r * stop_dist
            j_end = min(i + time_stop, self.n - 1)
            exit_px = None
            exit_i = None
            reason = None
            for j in range(i, j_end + 1):
                # conservative: stop first when both touched intrabar
                if d > 0:
                    if self.l[j] <= stop:
                        exit_px, exit_i, reason = stop, j, "stop"
                        break
                    if self.h[j] >= target:
                        exit_px, exit_i, reason = target, j, "target"
                        break
                else:
                    if self.h[j] >= stop:
                        exit_px, exit_i, reason = stop, j, "stop"
                        break
                    if self.l[j] <= target:
                        exit_px, exit_i, reason = target, j, "target"
                        break
            if exit_px is None:
                exit_px, exit_i, reason = self.c[j_end], j_end, "time"
            gross_r = d * (exit_px - entry) / stop_dist
            cost_r = self.cost * entry / stop_dist
            out.append({
                "sym": ev["sym"], "ts": self.t[i], "exit_ts": self.t[exit_i],
                "dir": d, "r": gross_r - cost_r, "gross_r": gross_r,
                "reason": reason, "hold_bars": exit_i - i,
                "stop_dist_pct": stop_dist / entry,
                "type": ev.get("type", ""),
            })
        return out


# ---------------------------------------------------------------- events


def load_events():
    df = pd.read_pickle(f"{DIR}/events.pkl")
    # keep the drift-adjusted-positive core + optional extras
    core = (
        ((df["type"] == "bear_div") & (df["dir"] == "bearish"))
        | ((df["type"] == "bull_div") & (df["dir"] == "bullish"))
        | ((df["type"] == "exhaustion") & (df["dir"] == "bearish"))
    )
    return df, df[core].copy()


def apply_filters(ev: pd.DataFrame, p: dict) -> pd.DataFrame:
    m = pd.Series(True, index=ev.index)
    if p.get("regime") == "range":
        m &= ev["regime"] == "range"
    elif p.get("regime") == "counter":
        # longs only in trend_down/range, shorts only in trend_up/range
        up = ev["dir"] == "bullish"
        m &= ((up & ev["regime"].isin(["trend_down", "range"])) | (~up & ev["regime"].isin(["trend_up", "range"])))
    if p.get("min_strength"):
        m &= ev["strength"] >= p["min_strength"]
    if p.get("max_strength"):
        m &= ev["strength"] <= p["max_strength"]
    if p.get("min_volp"):
        m &= ev["volp"] >= p["min_volp"]
    if p.get("ext_abs"):
        # only when extended away from EMA89 (mean-reversion fuel)
        m &= ev["ema_dist"].abs() >= p["ext_abs"]
    if p.get("fund_flip"):
        m &= np.where(ev["dir"] == "bullish", ev["fund_z"] <= -1.0, ev["fund_z"] >= 1.0)
    if p.get("hours"):
        m &= ev["hour_utc"].isin(p["hours"])
    return ev[m]


def simulate(ev: pd.DataFrame, p: dict, cost_bps=COST_BPS, max_conc=5):
    """Group events per symbol, simulate, enforce portfolio concurrency."""
    trades = []
    for sym, grp in ev.groupby("sym"):
        m15 = load_m15(sym)
        sim = Sim(m15, cost_bps)
        recs = grp.to_dict("records")
        for r in recs:
            r["dir"] = 1 if r["dir"] == "bullish" else -1
        trades += sim.run(recs, stop_atr=p.get("stop_atr", 1.0),
                          stop_mode=p.get("stop_mode", "struct"),
                          target_r=p.get("target_r", 2.0),
                          time_stop=p.get("time_stop", 96))
    trades.sort(key=lambda x: x["ts"])
    # concurrency + one-per-symbol: walk chronologically
    held, kept = {}, []
    for tr in trades:
        if tr["sym"] in held and held[tr["sym"]] > tr["ts"]:
            continue
        if len(held) >= max_conc:
            # drop if all slots busy at entry time
            active = [ts for ts in held.values() if ts > tr["ts"]]
            if len(active) >= max_conc:
                continue
        kept.append(tr)
        held[tr["sym"]] = tr["exit_ts"]
        # prune finished
        held = {s: ts for s, ts in held.items() if ts > tr["ts"]}
    return kept


def metrics(trades):
    if not trades:
        return {"n": 0, "win": 0, "avg_r": 0, "pf": 0, "sharpe": 0, "maxdd": 0, "tpd": 0}
    r = np.array([t["r"] for t in trades])
    wins, losses = r[r > 0], r[r <= 0]
    eq = np.cumsum(r)
    dd = (np.maximum.accumulate(eq) - eq).max() if len(eq) else 0
    days = max((trades[-1]["ts"] - trades[0]["ts"]) / 86_400_000, 1e-9)
    return {
        "n": len(r), "win": float((r > 0).mean()), "avg_r": float(r.mean()),
        "pf": float(wins.sum() / max(1e-9, -losses.sum())),
        "sharpe": float(r.mean() / (r.std() + 1e-9) * np.sqrt(len(r) / days)),
        "maxdd": float(dd), "tpd": float(len(r) / days),
    }


# ---------------------------------------------------------------- walk-forward


def walk_forward(ev: pd.DataFrame, grid: list[dict], folds=None, verbose=False):
    """folds: list of (train_start, train_end, test_start, test_end) in ms."""
    if folds is None:
        t0, t1 = ev["ts"].min(), ev["ts"].max()
        span = t1 - t0
        fold_len = span // 6  # ~30d
        folds = [
            (t0, t0 + 3 * fold_len, t0 + 3 * fold_len, t0 + 4 * fold_len),
            (t0 + fold_len, t0 + 4 * fold_len, t0 + 4 * fold_len, t0 + 5 * fold_len),
            (t0 + 2 * fold_len, t0 + 5 * fold_len, t0 + 5 * fold_len, t1),
        ]
    oos_trades = []
    picked = []
    for (a, b, c, d) in folds:
        tr_ev = apply_filters(ev[(ev["ts"] >= a) & (ev["ts"] < b)], {})
        best, best_score = None, -1e9
        for p in grid:
            e = apply_filters(tr_ev, p)
            if len(e) < 40:
                continue
            trs = simulate(e, p)
            m = metrics(trs)
            if m["n"] < 25:
                continue
            score = m["sharpe"] * np.sqrt(min(m["n"], 400))  # sharpe with count brake
            if score > best_score:
                best_score, best = score, p
        if best is None:
            picked.append(None)
            continue
        te_ev = apply_filters(ev[(ev["ts"] >= c) & (ev["ts"] < d)], best)
        trs = simulate(te_ev, best)
        oos_trades += trs
        picked.append(best)
        if verbose:
            m = metrics(trs)
            print(f"  fold [{pd.to_datetime(c, unit='ms').date()} → {pd.to_datetime(d, unit='ms').date()}] "
                  f"picked {best} → OOS n={m['n']} pf={m['pf']:.2f} avgR={m['avg_r']:.3f}")
    return oos_trades, picked


if __name__ == "__main__":
    ev_all, ev_core = load_events()
    print(f"all events: {len(ev_all)} · core CVD-fade events: {len(ev_core)}")

    grid = []
    for stop_mode in ["struct", "atr"]:
        for stop_atr in ([1.0, 1.5] if stop_mode == "atr" else [1.0]):
            for target_r in [1.5, 2.0, 3.0]:
                for time_stop in [48, 96]:
                    for regime in [None, "range", "counter"]:
                        for min_strength in [0, 60]:
                            grid.append({
                                "stop_mode": stop_mode, "stop_atr": stop_atr,
                                "target_r": target_r, "time_stop": time_stop,
                                "regime": regime, "min_strength": min_strength,
                            })
    print(f"grid: {len(grid)} combos")

    print("\n=== WALK-FORWARD (90d train → 30d OOS ×3 folds) ===")
    oos, picked = walk_forward(ev_core, grid, verbose=True)
    m = metrics(oos)
    print(f"\nOOS AGGREGATE: n={m['n']} ({m['tpd']:.1f}/d) win={m['win']:.3f} "
          f"avgR={m['avg_r']:.3f} PF={m['pf']:.2f} Sharpe={m['sharpe']:.2f} maxDD={m['maxdd']:.1f}R")

    # cost stress on the same OOS trade set (re-simulated at higher cost)
    print("\npicked params per fold:", picked)
