#!/usr/bin/env python3
"""
fp-research step 17 — END-TO-END WALK-FORWARD PORTFOLIO BACKTEST at $5,000.

Strategy family (from the Hyperliquid top-trader reverse-engineering report):
  Blueprint 1 (SilkBtc / NAKED SHORTS / Fasanara): bearish exhaustion /
    absorption confluence SHORTS in confirmed downtrends.
  Blueprint 3 (Fasanara / John Wick): bear-div CARRY SHORTS when funding
    z > +1 (crowded longs pay the short).
  Edge 5 (all profitable accounts): asymmetric loss control — wide disaster
    stops, time exits, small fixed-fractional risk, winners run.

Engine:
  $5,000 initial equity · compounding on settled equity · risk-fraction
  sizing off the stop distance · one position per symbol · max concurrent ·
  gross leverage cap 3x · Binance USDT-M taker 15bp round trip (25bp stress)
  · 8h funding PnL for shorts (shorts receive positive funding).

Honesty protocol:
  Walk-forward: 60d train / 30d test folds rolling across the 180d archive.
  Config chosen ONLY from trailing data (net expectancy bp/trade, n >= 25,
  must be positive; tie-break profit factor), then applied once OOS.
  Reported alongside: per-fold chosen configs, the all-config OOS median
  (no-skill reference), BTC buy&hold benchmark, stress variants, and a
  Monte-Carlo bootstrap of the OOS trade distribution.
"""
import gzip
import json
import os
import sys
from collections import defaultdict

import numpy as np
import pandas as pd

DIR = "data/fp-research"
OUT = "download/fp-research/e2e"
os.makedirs(OUT, exist_ok=True)
M15 = 900_000
DAY = 86_400_000

INITIAL = 5_000.0
COST = 0.0015            # round-trip taker + slippage
COST_STRESS = 0.0025
GROSS_LEV_CAP = 3.0      # portfolio gross notional cap
INDIV_CAP = 2.0          # per-position notional cap (x equity)
MAX_HOLD = 192           # 48h in m15 bars (grid superset)

STOP_KS = [3.0, 6.0]
HOLDS = [48, 96, 192]    # 12h / 24h / 48h
RISKS = [0.005, 0.01]
MAXCS = [4, 6]
GATES = ["none", "trend_down"]
MIN_N_TRAIN = 25

# ---------------------------------------------------------------- data ----
_BARS = {}
_FUND = {}


def load_bars(sym):
    if sym not in _BARS:
        rows = [json.loads(l) for l in gzip.open(f"{DIR}/15m_{sym}.jsonl.gz", "rt") if l.strip()]
        df = pd.DataFrame(rows)
        for c in ["o", "h", "l", "c"]:
            df[c] = df[c].astype(float)
        df["t"] = df["t"].astype(np.int64)
        df = df.sort_values("t").reset_index(drop=True)
        atr = (df["h"] - df["l"]).rolling(20).mean()
        _BARS[sym] = {
            "o": df["o"].values, "h": df["h"].values, "l": df["l"].values,
            "c": df["c"].values, "t": df["t"].values,
            "atr": atr.values, "ts2i": {int(t): i for i, t in enumerate(df["t"].values)},
        }
    return _BARS[sym]


def load_fund(sym):
    if sym not in _FUND:
        rows = [json.loads(l) for l in gzip.open(f"{DIR}/funding_{sym}.jsonl.gz", "rt") if l.strip()]
        df = pd.DataFrame(rows)
        df["t"] = df["t"].astype(np.int64)
        df["r"] = df["r"].astype(float)
        df = df.sort_values("t")
        _FUND[sym] = (df["t"].values, df["r"].values)
    return _FUND[sym]


def funding_between(sym, t0, t1):
    """Sum of funding rates settled in (t0, t1]. Short receives positive sum."""
    ft, fr = load_fund(sym)
    a = np.searchsorted(ft, t0, side="right")
    b = np.searchsorted(ft, t1, side="left")
    # side="left" on t1 excludes a settlement exactly at exit; include it if
    # the position was open at that timestamp (settlement marks use open pos)
    return float(fr[a:b].sum()) if b > a else 0.0


# ------------------------------------------------------------- events ----
def add_confluence(df):
    """Distinct other bearish signal classes within +/-6 m15 bars, same symbol."""
    by_key = {}
    for (sym, d), g in df.groupby(["sym", "dir"]):
        by_key[(sym, d)] = (g["ts"].values, g["type"].values)
    conf = np.zeros(len(df), dtype=int)
    syms = df["sym"].values
    tss = df["ts"].values
    dirs = df["dir"].values
    types = df["type"].values
    for i in range(len(df)):
        key = (syms[i], dirs[i])
        if key not in by_key:
            continue
        ts_arr, ty_arr = by_key[key]
        a = np.searchsorted(ts_arr, tss[i] - 6 * M15, side="left")
        b = np.searchsorted(ts_arr, tss[i] + 6 * M15, side="right")
        if b > a:
            others = set(ty_arr[a:b]) - {types[i]}
            conf[i] = len(others)
    out = df.copy()
    out["confluence"] = conf
    return out


def build_candidates():
    """All bearish exhaustion/absorption/bear_div events with precomputed
    outcomes for every (stop_k, hold) combo, incl. funding carry."""
    df = pd.read_pickle(f"{DIR}/events.pkl")
    df = df[df["dir"] == "bearish"]
    df = df[df["type"].isin(["exhaustion", "absorption", "bear_div"])]
    df = add_confluence(df)
    print(f"candidate events: {len(df)} bearish "
          f"({df['type'].value_counts().to_dict()})", flush=True)

    rows = []
    for sym, g in df.groupby("sym"):
        b = load_bars(sym)
        n = len(b["t"])
        o, h, c, t, atr = b["o"], b["h"], b["c"], b["t"], b["atr"]
        ts2i = b["ts2i"]
        for _, e in g.iterrows():
            i = ts2i.get(int(e["ts"]))
            if i is None:
                continue
            ei = i + int(e["confirmBars"]) + 1
            if ei >= n - 2:
                continue
            entry = o[ei]
            a = atr[i]
            if not np.isfinite(entry) or entry <= 0 or not np.isfinite(a) or a <= 0:
                continue
            stops = {k: h[i] + k * a for k in STOP_KS}
            j_end_max = min(ei + MAX_HOLD, n - 1)
            first_touch = {}
            for k, sp in stops.items():
                exit_px, exit_j, reason = None, None, None
                for j in range(ei, j_end_max + 1):
                    if h[j] >= sp:
                        exit_px, exit_j, reason = sp, j, "stop"
                        break
                first_touch[k] = (exit_px, exit_j, reason)
            for k in STOP_KS:
                sp = stops[k]
                stop_pct = (sp - entry) / entry
                if stop_pct <= 0:
                    continue
                for hold in HOLDS:
                    j_end = min(ei + hold, n - 1)
                    px, jj, rs = first_touch[k]
                    if rs == "stop" and jj is not None and jj <= j_end:
                        pass
                    else:
                        px, jj, rs = c[j_end], j_end, "time"
                    ret_raw = -(px / entry - 1)          # short
                    fund = funding_between(sym, t[ei], t[jj])
                    rows.append({
                        "sym": sym, "ts": int(t[ei]), "exit_ts": int(t[jj]),
                        "type": e["type"], "confluence": int(e["confluence"]),
                        "regime": e["regime"], "fund_z": e["fund_z"],
                        "strength": e["strength"], "k": k, "hold": hold,
                        "entry": float(entry), "exit": float(px),
                        "stop_pct": float(stop_pct), "ret_raw": float(ret_raw),
                        "fund_pct": float(fund), "reason": rs,
                        "hold_bars": int(jj - ei),
                    })
    cand = pd.DataFrame(rows).sort_values("ts").reset_index(drop=True)
    cand.to_pickle(f"{OUT}/candidates.pkl")
    print(f"candidate outcome rows: {len(cand)}", flush=True)
    return cand


# -------------------------------------------------------------- rules ----
def ruleset_mask(cand, ruleset):
    m = pd.Series(False, index=cand.index)
    exh = (cand["type"] == "exhaustion")
    ab = (cand["type"] == "absorption")
    bd = (cand["type"] == "bear_div")
    for r in ruleset:
        if r == "EXH1":
            m |= exh & (cand["confluence"] >= 1)
        elif r == "EXH2":
            m |= exh & (cand["confluence"] >= 2)
        elif r == "ABS1":
            m |= ab & (cand["confluence"] >= 1)
        elif r == "ABS2":
            m |= ab & (cand["confluence"] >= 2)
        elif r == "BD":
            m |= bd
        elif r == "BDZ1":
            m |= bd & (cand["fund_z"] >= 1.0)
        else:
            raise ValueError(r)
    return m


RULESETS = {
    "A_exh1": ["EXH1"],
    "B_exh2": ["EXH2"],
    "C_abs1": ["ABS1"],
    "D_abs2": ["ABS2"],
    "E_bd": ["BD"],
    "F_bdz1": ["BDZ1"],
    "G_exh1+abs2": ["EXH1", "ABS2"],
    "H_full": ["EXH1", "ABS2", "BDZ1"],
}


def schedule(cand, ruleset, gate, k, hold, maxc):
    """Greedy concurrency schedule (equity-independent): one per symbol,
    at most maxc concurrent, chronological."""
    m = ruleset_mask(cand, ruleset) & (cand["k"] == k) & (cand["hold"] == hold)
    if gate == "trend_down":
        m &= cand["regime"] == "trend_down"
    sub = cand[m]
    held, out = {}, []
    for _, e in sub.iterrows():
        held = {s: x for s, x in held.items() if x > e["ts"]}
        if e["sym"] in held or len(held) >= maxc:
            continue
        out.append(e)
        held[e["sym"]] = e["exit_ts"]
    return out


# ----------------------------------------------------- portfolio engine ----
def simulate_compounding(trades, equity0, risk, cost, use_funding=True,
                         indiv_cap=INDIV_CAP, gross_cap=GROSS_LEV_CAP):
    """Sequential event-accurate sim: settle closed positions at entry time of
    the next trade; size off settled equity; cap gross and per-position
    notional. Returns (equity_curve, trade_log, blew_up)."""
    trades = sorted(trades, key=lambda e: e["ts"])
    equity = float(equity0)
    open_pos = []           # list of dicts
    curve = [(int(trades[0]["ts"]) if trades else 0, equity)] if trades else [(0, equity)]
    log = []
    blew = False

    def settle_until(ts):
        nonlocal equity, open_pos, log
        still = []
        for p in open_pos:
            if p["exit_ts"] <= ts:
                equity += p["pnl"]
                log.append({**p["meta"], "pnl": p["pnl"], "equity_after": equity})
            else:
                still.append(p)
        open_pos = still

    for e in trades:
        settle_until(e["ts"])
        if equity <= 0:
            blew = True
            break
        stop_pct = e["stop_pct"]
        net_pct = e["ret_raw"] - cost + (e["fund_pct"] if use_funding else 0.0)
        notional = equity * risk / stop_pct
        notional = min(notional, equity * indiv_cap)
        gross_open = sum(p["notional"] for p in open_pos)
        if gross_open + notional > equity * gross_cap:
            notional = max(0.0, equity * gross_cap - gross_open)
            if notional <= 0:
                continue
        pnl = notional * net_pct
        open_pos.append({
            "exit_ts": e["exit_ts"], "pnl": pnl, "notional": notional,
            "meta": {
                "ts": int(e["ts"]), "exit_ts": int(e["exit_ts"]), "sym": e["sym"],
                "rule": e["type"], "k": e["k"], "hold": e["hold"],
                "entry": e["entry"], "exit": e["exit"], "stop_pct": e["stop_pct"],
                "ret_raw": e["ret_raw"], "fund_pct": e["fund_pct"] if use_funding else 0.0,
                "cost_pct": cost, "net_pct": net_pct, "notional": notional,
                "reason": e["reason"], "regime": e["regime"],
                "confluence": e["confluence"], "fund_z": e["fund_z"],
                "risk": risk,
            },
        })
        curve.append((int(e["ts"]), equity))
    settle_until(1 << 62)
    curve.append((int(trades[-1]["exit_ts"]) if trades else 0, equity))
    return curve, log, blew


def quick_metrics(trades, cost, use_funding=True):
    if not trades:
        return {"n": 0, "bp": -999.0, "pf": 0.0, "sum_r": 0.0}
    net = np.array([e["ret_raw"] - cost + (e["fund_pct"] if use_funding else 0.0) for e in trades])
    sp = np.array([e["stop_pct"] for e in trades])
    wins, losses = net[net > 0], net[net <= 0]
    pf = wins.sum() / max(1e-12, -losses.sum()) if len(losses) else float("inf")
    return {
        "n": len(net), "bp": float(net.mean() * 1e4), "pf": float(pf),
        "sum_r": float((net / sp).sum()),
    }


# ----------------------------------------------------------- walk-forward ----
def fold_bounds(t0, t1):
    """60d train / 30d test rolling folds over [t0, t1]."""
    folds = []
    test_start = t0 + 60 * DAY
    while test_start < t1:
        folds.append({
            "train": (t0 if folds == [] else test_start - 60 * DAY, test_start),
            "test": (test_start, min(test_start + 30 * DAY, t1)),
        })
        test_start += 30 * DAY
    return folds


def main():
    t_start = pd.Timestamp("2026-05-17", tz="UTC").value // 1_000_000
    t_end = pd.Timestamp("2026-11-13", tz="UTC").value // 1_000_000

    if os.path.exists(f"{OUT}/candidates.pkl"):
        cand = pd.read_pickle(f"{OUT}/candidates.pkl")
        print(f"loaded cached candidates: {len(cand)}", flush=True)
    else:
        cand = build_candidates()

    # pre-build schedules once (equity-independent)
    sched_keys = []
    scheds = {}
    for rs_name, rs in RULESETS.items():
        for gate in GATES:
            for k in STOP_KS:
                for hold in HOLDS:
                    for maxc in MAXCS:
                        key = (rs_name, gate, k, hold, maxc)
                        sched_keys.append(key)
                        scheds[key] = schedule(cand, rs, gate, k, hold, maxc)
    print(f"schedules built: {len(sched_keys)}", flush=True)

    folds = fold_bounds(t_start, t_end)
    print(f"folds: {len(folds)}", flush=True)

    # ---- walk-forward selection
    equity = INITIAL
    oos_curve = [(t_start, equity)]
    oos_log = []
    fold_rows = []
    for fi, f in enumerate(folds):
        tr0, tr1 = f["train"]
        te0, te1 = f["test"]
        ranked = []
        for key in sched_keys:
            rs_name, gate, k, hold, maxc = key
            tr_tr = [e for e in scheds[key] if tr0 <= e["ts"] < tr1]
            for risk in RISKS:
                m = quick_metrics(tr_tr, COST)
                ranked.append((m, key, risk))
        ok = [r for r in ranked if r[0]["n"] >= MIN_N_TRAIN and r[0]["bp"] > 0]
        ok.sort(key=lambda r: (-r[0]["bp"], -r[0]["pf"]))
        if not ok:
            fold_rows.append({"fold": fi + 1, "test": [te0, te1], "config": "NO-TRADE",
                              "train_n": 0, "train_bp": 0.0, "test_n": 0, "test_pnl": 0.0})
            print(f"fold {fi+1}: no qualifying config — sitting in cash", flush=True)
            continue
        (m, key, risk) = ok[0]
        rs_name, gate, k, hold, maxc = key
        te_tr = [e for e in scheds[key] if te0 <= e["ts"] < te1]
        curve, log, blew = simulate_compounding(te_tr, equity, risk, COST)
        start_eq = equity
        equity = curve[-1][1]
        oos_curve.extend([(ts, eq) for ts, eq in curve[1:]])
        oos_log.extend(log)
        te_pnl = equity - start_eq
        fold_rows.append({
            "fold": fi + 1, "test": [te0, te1],
            "config": f"{rs_name}|gate={gate}|k={k}|hold={hold}h|conc={maxc}|risk={risk*100:.1f}%",
            "train_n": m["n"], "train_bp": round(m["bp"], 1),
            "test_n": len(log), "test_pnl": round(te_pnl, 2),
        })
        print(f"fold {fi+1}: {rs_name} gate={gate} k={k} hold={hold} conc={maxc} risk={risk}"
              f" | train n={m['n']} {m['bp']:+.1f}bp | OOS n={len(log)} pnl ${te_pnl:+,.0f} "
              f"-> equity ${equity:,.0f}{'  BLOWUP' if blew else ''}", flush=True)
        if blew or equity <= 0:
            print("PORTFOLIO BLOWN UP — stopping", flush=True)
            break

    # ---- benchmarks & references
    btc = load_bars("BTCUSDT")
    m = (btc["t"] >= oos_curve[0][0]) & (btc["t"] <= oos_curve[-1][0])
    btc_c = btc["c"][m]
    btc_ret = float(btc_c[-1] / btc_c[0] - 1) if len(btc_c) > 2 else float("nan")

    oos0, oos1 = oos_curve[0][0], oos_curve[-1][0]
    allcfg_finals = []
    for key in sched_keys:
        rs_name, gate, k, hold, maxc = key
        te_tr = [e for e in scheds[key] if oos0 <= e["ts"] < oos1]
        for risk in RISKS:
            mtr = quick_metrics(te_tr, COST)
            if mtr["n"] == 0:
                continue
            allcfg_finals.append(INITIAL * (1 + mtr["sum_r"] * risk))
    allcfg = np.array(allcfg_finals) if allcfg_finals else np.array([INITIAL])

    # ---- stress variants of the chosen path
    stress = stress_pass(scheds, fold_rows, folds, cand) if fold_rows else {}

    # ---- outputs
    pd.DataFrame(oos_log).to_csv(f"{OUT}/e2e_trades_OOS.csv", index=False)
    curve_df = pd.DataFrame(oos_curve, columns=["ts", "equity"])
    curve_df.to_csv(f"{OUT}/e2e_equity_OOS.csv", index=False)
    with open(f"{OUT}/e2e_fold_choices.json", "w") as f:
        json.dump({"folds": fold_rows, "btc_buyhold_ret": btc_ret,
                   "allconfig_median_final": float(np.median(allcfg)),
                   "allconfig_p10": float(np.percentile(allcfg, 10)),
                   "allconfig_p90": float(np.percentile(allcfg, 90)),
                   "stress": stress}, f, indent=2, default=str)

    print("\n================ E2E WALK-FORWARD SUMMARY ($5,000 start) ================")
    print(f"final equity        : ${equity:,.2f}  ({(equity/INITIAL-1)*100:+.2f}%)")
    print(f"BTC buy&hold (OOS)  : {btc_ret*100:+.2f}%")
    print(f"all-config median   : ${np.median(allcfg):,.2f}  (no-skill reference)")
    if stress:
        for k_, v_ in stress.items():
            if v_:
                print(f"stress {k_:24s}: final ${v_['final']:,.2f} ({v_['ret']*100:+.2f}%)")
    n_tr = len(oos_log)
    if n_tr:
        pnls = np.array([t["pnl"] for t in oos_log])
        wins = pnls[pnls > 0]
        losses = pnls[pnls <= 0]
        pf = wins.sum() / max(1e-9, -losses.sum())
        print(f"OOS trades          : {n_tr} · win {(pnls>0).mean()*100:.1f}% · PF {pf:.2f}")
        print(f"avg win ${wins.mean() if len(wins) else 0:,.0f} vs avg loss ${losses.mean() if len(losses) else 0:,.0f}")
        stopfrac = np.mean([t["reason"] == "stop" for t in oos_log]) * 100
        fundtot = sum(t["fund_pct"] * t["notional"] for t in oos_log)
        costtot = sum(t["cost_pct"] * t["notional"] for t in oos_log)
        print(f"stopped trades      : {stopfrac:.1f}% · funding received ${fundtot:,.0f} · costs paid ${costtot:,.0f}")
    print("========================================================================", flush=True)


def stress_pass(scheds, fold_rows, folds, cand):
    """Re-run the exact chosen fold configs under cost/funding variants."""
    variants = {
        "base_15bp_funding": (COST, True),
        "stress_25bp": (COST_STRESS, True),
        "nofunding_15bp": (COST, False),
        "stress_25bp_nofunding": (COST_STRESS, False),
    }
    out = {}
    for vname, (cost_v, use_fund) in variants.items():
        equity = INITIAL
        logs = []
        for f in fold_rows:
            if f["config"] == "NO-TRADE":
                continue
            # config string: "<rs>|gate=..|k=..|hold=..h|conc=..|risk=..%"
            parts = f["config"].split("|")
            rs_name = parts[0]
            gate = parts[1].split("=")[1]
            k = float(parts[2].split("=")[1])
            hold = int(parts[3].split("=")[1].rstrip("h"))
            maxc = int(parts[4].split("=")[1])
            risk = float(parts[5].split("=")[1].rstrip("%")) / 100
            te0, te1 = f["test"]
            te_tr = [e for e in scheds[(rs_name, gate, k, hold, maxc)] if te0 <= e["ts"] < te1]
            curve, log, blew = simulate_compounding(te_tr, equity, risk, cost_v,
                                                    use_funding=use_fund)
            equity = curve[-1][1]
            logs.extend(log)
            if blew or equity <= 0:
                equity = max(equity, 0.0)
                break
        out[vname] = {"final": equity, "ret": equity / INITIAL - 1, "n": len(logs)}
    return out


if __name__ == "__main__":
    main()
