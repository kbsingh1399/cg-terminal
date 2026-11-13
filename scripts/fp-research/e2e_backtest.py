#!/usr/bin/env python3
"""
fp-research step 17b — E2E WALK-FORWARD PORTFOLIO BACKTEST v2 at $5,000.

Extends v1 with the axes the profitable Hyperliquid traders actually use:
  * chandelier TRAILING stops (Edge 5: asymmetric loss control — ratchet the
    stop behind favorable moves, let winners run);
  * a NO-TIME-EXIT patience variant (14d cap, stop/trail only — the "100%
    whale" holds for weeks, SilkBtc scales out over months);
  * a lean LONG-side probe (bullish exhaustion confluence, bull-div carry at
    funding z <= -1) as a falsification test: the reverse-engineered edge is
    short-side in this regime; the walk-forward may never pick longs.

Strategy family (Hyperliquid top-trader reverse-engineering report):
  Blueprint 1 (SilkBtc / NAKED SHORTS / Fasanara): bearish exhaustion /
    absorption confluence SHORTS in confirmed downtrends.
  Blueprint 3 (Fasanara / John Wick): bear-div CARRY SHORTS at funding z>+1.
  Edge 5: asymmetric loss control — wide disaster stop + trailing ratchet,
    time exit or patience, small fixed-fractional risk.

Engine: $5,000 start · compounding on settled equity · risk-fraction sizing
  off the effective stop distance · one position per symbol · max concurrent
  · gross leverage cap 3x · per-position cap 2x · Binance USDT-M taker 15bp
  round trip (25bp stress) · 8h funding PnL (shorts receive positive rates).

Honesty protocol: 60d train / 30d test rolling folds; config chosen ONLY on
  trailing data (net expectancy bp/trade, n >= 25, > 0; tie-break PF), then
  applied once OOS. Reported with: all-config OOS median (no-skill ref),
  BTC buy&hold, stress variants, Monte-Carlo bootstrap of OOS trades.
"""
import gzip
import json
import os
import sys
from bisect import bisect_left, bisect_right
from collections import defaultdict

import numpy as np
import pandas as pd

DIR = "data/fp-research"
OUT = os.environ.get("E2E_OUT", "download/fp-research/e2e")
EVENTS = os.environ.get("E2E_EVENTS", f"{DIR}/events.pkl")
os.makedirs(OUT, exist_ok=True)
M15 = 900_000
DAY = 86_400_000

INITIAL = 5_000.0
COST = 0.0015
COST_STRESS = 0.0025
GROSS_LEV_CAP = 3.0
INDIV_CAP = 2.0

STOP_KS = [3.0, 6.0]
TRAILS = [0.0, 3.0, 6.0]      # 0 = no trail (disaster stop only)
HOLDS = [48, 96, 192, 1344]   # 12h / 24h / 48h / 14d (patience cap)
HOLD_INF = 1344
RISKS = [0.005, 0.01]
MAXCS = [4, 6]
GATES = ["none", "aligned"]
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
            "c": df["c"].values, "t": df["t"].values, "atr": atr.values,
            "ts2i": {int(t): i for i, t in enumerate(df["t"].values)},
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
    """Sum of funding rates settled in (t0, t1]. >0 = short receives."""
    ft, fr = load_fund(sym)
    a = np.searchsorted(ft, t0, side="right")
    b = np.searchsorted(ft, t1, side="left")
    return float(fr[a:b].sum()) if b > a else 0.0


# ------------------------------------------------------------- events ----
def leakfree_confluence(df):
    """Confluence counted ONLY from signals fully CONFIRMED by our entry
    decision time (no lookahead): a confirming signal on bar s with its own
    confirmBars c_s is knowable at conf_time = s + (c_s+1)*M15 (bar close +
    confirmation bars). For event E entering at bar ei (open time t_ei), count
    distinct other types (same sym, same dir) with conf_time in
    [ts_E - 6*M15, t_ei]. Replaces the lookahead-leaking +/-6-bar window."""
    conf = np.zeros(len(df), dtype=int)
    syms = df["sym"].values
    tss = df["ts"].values
    dirs = df["dir"].values
    types = df["type"].values
    confs = df["confirmBars"].values.astype(int)
    # entry decision time per event = its own signal ts + (confirmBars+1) bars
    te = tss + (confs + 1) * M15
    by_key = {}
    for i in range(len(df)):
        by_key.setdefault((syms[i], dirs[i]), []).append(i)
    for key, idxs in by_key.items():
        ct = te[idxs]                     # conf_time of each event in group
        order = np.argsort(ct)
        idxs = np.asarray(idxs)[order]
        ct = ct[order]
        tys = types[idxs]
        for i in idxs:
            a = np.searchsorted(ct, tss[i] - 6 * M15, side="left")
            b = np.searchsorted(ct, te[i], side="right")
            if b > a:
                conf[i] = len(set(tys[a:b]) - {types[i]})
    return conf


def scan_path(h, l, ei, j_end, disaster, trail_k, atr_v, is_short):
    """Vectorized exit scan. Returns (touch_j, touch_px) — first bar where the
    effective stop (disaster vs ratcheting chandelier trail, computed from
    bars STRICTLY BEFORE j) is touched, else (None, None).
    Short: stop above; trail = min(high[ei..j-1]) + trail_k*ATR, ratchets down.
    Long:  stop below; trail = max(low[ei..j-1])  - trail_k*ATR, ratchets up."""
    n = j_end - ei + 1
    if n <= 0:
        return None, None
    if is_short:
        seg = h[ei:j_end + 1]
        if trail_k > 0:
            run = np.minimum.accumulate(seg)
            tl = np.full(n, np.inf)
            tl[1:] = run[:-1] + trail_k * atr_v        # info up to j-1
            eff = np.minimum(disaster, tl)
        else:
            eff = np.full(n, disaster)
        touch = seg >= eff
    else:
        seg = l[ei:j_end + 1]
        if trail_k > 0:
            run = np.maximum.accumulate(seg)
            tl = np.full(n, -np.inf)
            tl[1:] = run[:-1] - trail_k * atr_v
            eff = np.maximum(disaster, tl)
        else:
            eff = np.full(n, disaster)
        touch = seg <= eff
    if not touch.any():
        return None, None
    j = int(np.argmax(touch))
    return ei + j, float(eff[j])


def build_candidates():
    """Eligible short & long events with outcomes for every
    (stop_k, trail, hold) combo, incl. funding carry."""
    df = pd.read_pickle(EVENTS)
    df = df[df["type"].isin(["exhaustion", "absorption", "bear_div", "bull_div"])]
    df = df.copy()
    df["confluence"] = leakfree_confluence(df)

    short_elig = (
        ((df["dir"] == "bearish") & (df["type"] == "exhaustion") & (df["confluence"] >= 1))
        | ((df["dir"] == "bearish") & (df["type"] == "absorption") & (df["confluence"] >= 2))
        | ((df["dir"] == "bearish") & (df["type"] == "bear_div") & (df["fund_z"] >= 1.0))
    )
    long_elig = (
        ((df["dir"] == "bullish") & (df["type"] == "exhaustion") & (df["confluence"] >= 1))
        | ((df["dir"] == "bullish") & (df["type"] == "bull_div") & (df["fund_z"] <= -1.0))
    )
    df = df[short_elig | long_elig].copy()
    df["side"] = np.where(df["dir"] == "bearish", "short", "long")
    print(f"eligible events: {len(df)} ({df['side'].value_counts().to_dict()})", flush=True)

    combos = [(k, tr) for k in STOP_KS for tr in TRAILS]
    rows = []
    for sym, g in df.groupby("sym"):
        b = load_bars(sym)
        n = len(b["t"])
        o, h, l, c, t, atr = b["o"], b["h"], b["l"], b["c"], b["t"], b["atr"]
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
            is_short = e["side"] == "short"
            j_cap = min(ei + HOLD_INF, n - 1)
            for k, tr in combos:
                disaster = (h[i] + k * a) if is_short else (l[i] - k * a)
                stop_pct = abs(disaster - entry) / entry
                if stop_pct <= 0:
                    continue
                tj, tpx = scan_path(h, l, ei, j_cap, disaster, tr, a, is_short)
                for hold in HOLDS:
                    j_end = min(ei + hold, n - 1)
                    if tj is not None and tj <= j_end:
                        jj, px, reason = tj, tpx, ("trail" if tr > 0 else "stop")
                    else:
                        jj, px, reason = j_end, c[j_end], "time"
                    ret_raw = -(px / entry - 1) if is_short else (px / entry - 1)
                    fund = funding_between(sym, t[ei], t[jj])
                    if not is_short:
                        fund = -fund          # longs pay positive funding
                    rows.append((
                        sym, int(t[ei]), int(t[jj]), e["type"], e["side"],
                        int(e["confluence"]), e["regime"], e["fund_z"], e["strength"],
                        k, tr, hold, float(entry), float(px), float(stop_pct),
                        float(ret_raw), float(fund), reason, int(jj - ei),
                    ))
    cand = pd.DataFrame(rows, columns=[
        "sym", "ts", "exit_ts", "type", "side", "confluence", "regime", "fund_z",
        "strength", "k", "trail", "hold", "entry", "exit", "stop_pct",
        "ret_raw", "fund_pct", "reason", "hold_bars"])
    cand = cand.sort_values("ts").reset_index(drop=True)
    cand.to_pickle(f"{OUT}/candidates_v3.pkl")
    print(f"candidate outcome rows: {len(cand)}", flush=True)
    return cand


# -------------------------------------------------------------- rules ----
def ruleset_mask(cand, ruleset):
    sh = cand["side"] == "short"
    lo = cand["side"] == "long"
    exh = cand["type"] == "exhaustion"
    ab = cand["type"] == "absorption"
    bd = cand["type"] == "bear_div"
    bld = cand["type"] == "bull_div"
    m = pd.Series(False, index=cand.index)
    for r in ruleset:
        if r == "EXH1":
            m |= sh & exh & (cand["confluence"] >= 1)
        elif r == "EXH2":
            m |= sh & exh & (cand["confluence"] >= 2)
        elif r == "ABS2":
            m |= sh & ab & (cand["confluence"] >= 2)
        elif r == "BDZ1":
            m |= sh & bd & (cand["fund_z"] >= 1.0)
        elif r == "L_EXH1":
            m |= lo & exh & (cand["confluence"] >= 1)
        elif r == "L_BDZM1":
            m |= lo & bld & (cand["fund_z"] <= -1.0)
        else:
            raise ValueError(r)
    return m


RULESETS = {
    "A_exh1": ["EXH1"],
    "B_exh2": ["EXH2"],
    "D_abs2": ["ABS2"],
    "F_bdz1": ["BDZ1"],
    "G_exh1+abs2": ["EXH1", "ABS2"],
    "H_full": ["EXH1", "ABS2", "BDZ1"],
    "L1_exh1": ["L_EXH1"],
    "L2_bdz-1": ["L_BDZM1"],
    "L3_full": ["L_EXH1", "L_BDZM1"],
}

LONG_RULESETS = {n for n in RULESETS if n.startswith("L")}


def gate_mask(cand, gate):
    if gate == "none":
        return pd.Series(True, index=cand.index)
    aligned = ((cand["side"] == "short") & (cand["regime"] == "trend_down")) | \
              ((cand["side"] == "long") & (cand["regime"] == "trend_up"))
    return aligned


def schedule(cand, ruleset, gate, k, trail, hold, maxc):
    m = (ruleset_mask(cand, ruleset) & gate_mask(cand, gate)
         & (cand["k"] == k) & (cand["trail"] == trail) & (cand["hold"] == hold))
    sub = cand[m]
    held, out_ts, out = {}, [], []
    for _, e in sub.iterrows():
        for s in [s for s, x in held.items() if x <= e["ts"]]:
            del held[s]
        if e["sym"] in held or len(held) >= maxc:
            continue
        out.append(e)
        out_ts.append(int(e["ts"]))
        held[e["sym"]] = e["exit_ts"]
    return {"ts": out_ts, "trades": out}


def slice_sched(sched, t0, t1):
    a = bisect_left(sched["ts"], t0)
    b = bisect_left(sched["ts"], t1)
    return sched["trades"][a:b]


# ----------------------------------------------------- portfolio engine ----
def simulate_compounding(trades, equity0, risk, cost, use_funding=True,
                         indiv_cap=INDIV_CAP, gross_cap=GROSS_LEV_CAP):
    trades = sorted(trades, key=lambda e: e["ts"])
    equity = float(equity0)
    open_pos = []
    curve = [(int(trades[0]["ts"]) if trades else 0, equity)]
    log = []
    blew = False
    max_gross_lev = 0.0

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
        notional = min(equity * risk / stop_pct, equity * indiv_cap)
        gross_open = sum(p["notional"] for p in open_pos)
        if gross_open + notional > equity * gross_cap:
            notional = max(0.0, equity * gross_cap - gross_open)
            if notional <= 0:
                continue
        max_gross_lev = max(max_gross_lev, (gross_open + notional) / equity)
        pnl = notional * net_pct
        open_pos.append({
            "exit_ts": e["exit_ts"], "pnl": pnl, "notional": notional,
            "meta": {
                "ts": int(e["ts"]), "exit_ts": int(e["exit_ts"]), "sym": e["sym"],
                "side": e["side"], "rule": e["type"], "k": e["k"], "trail": e["trail"],
                "hold": e["hold"], "entry": e["entry"], "exit": e["exit"],
                "stop_pct": e["stop_pct"], "ret_raw": e["ret_raw"],
                "fund_pct": e["fund_pct"] if use_funding else 0.0,
                "cost_pct": cost, "net_pct": net_pct, "notional": notional,
                "reason": e["reason"], "regime": e["regime"],
                "confluence": e["confluence"], "fund_z": e["fund_z"], "risk": risk,
            },
        })
        curve.append((int(e["ts"]), equity))
    settle_until(1 << 62)
    curve.append((int(trades[-1]["exit_ts"]) if trades else 0, equity))
    return curve, log, blew, max_gross_lev


def quick_metrics(trades, cost, use_funding=True):
    if not trades:
        return {"n": 0, "bp": -999.0, "pf": 0.0, "sum_r": 0.0}
    net = np.array([e["ret_raw"] - cost + (e["fund_pct"] if use_funding else 0.0) for e in trades])
    sp = np.array([e["stop_pct"] for e in trades])
    wins, losses = net[net > 0], net[net <= 0]
    pf = float(wins.sum() / max(1e-12, -losses.sum())) if len(losses) else 99.0
    return {"n": int(len(net)), "bp": float(net.mean() * 1e4), "pf": pf,
            "sum_r": float((net / sp).sum())}


# ----------------------------------------------------------- walk-forward ----
def fold_bounds(t0, t1):
    folds = []
    test_start = t0 + 60 * DAY
    while test_start < t1:
        folds.append({
            "train": (t0 if not folds else test_start - 60 * DAY, test_start),
            "test": (test_start, min(test_start + 30 * DAY, t1)),
        })
        test_start += 30 * DAY
    return folds


def main():
    t_start = pd.Timestamp("2026-05-17", tz="UTC").value // 1_000_000
    t_end = pd.Timestamp("2026-11-13", tz="UTC").value // 1_000_000

    if os.path.exists(f"{OUT}/candidates_v3.pkl"):
        cand = pd.read_pickle(f"{OUT}/candidates_v3.pkl")
        print(f"loaded cached candidates: {len(cand)}", flush=True)
    else:
        cand = build_candidates()

    sched_keys = []
    scheds = {}
    for rs_name, rs in RULESETS.items():
        for gate in GATES:
            for k in STOP_KS:
                for tr in TRAILS:
                    for hold in HOLDS:
                        for maxc in MAXCS:
                            key = (rs_name, gate, k, tr, hold, maxc)
                            sched_keys.append(key)
                            scheds[key] = schedule(cand, rs, gate, k, tr, hold, maxc)
    print(f"schedules built: {len(sched_keys)}", flush=True)

    folds = fold_bounds(t_start, t_end)
    equity = INITIAL
    oos_curve = [(t_start, equity)]
    oos_log = []
    fold_rows = []
    for fi, f in enumerate(folds):
        tr0, tr1 = f["train"]
        te0, te1 = f["test"]
        ranked = []
        for key in sched_keys:
            tr_tr = slice_sched(scheds[key], tr0, tr1)
            for risk in RISKS:
                m = quick_metrics(tr_tr, COST)
                ranked.append((m, key, risk))
        ok = [r for r in ranked if r[0]["n"] >= MIN_N_TRAIN and r[0]["bp"] > 0]
        ok.sort(key=lambda r: (-r[0]["bp"], -r[0]["pf"]))
        if not ok:
            fold_rows.append({"fold": fi + 1, "test": [te0, te1], "config": "NO-TRADE",
                              "train_n": 0, "train_bp": 0.0, "test_n": 0,
                              "test_pnl": 0.0, "equity_after": equity})
            print(f"fold {fi+1}: no qualifying config — cash", flush=True)
            continue
        m, key, risk = ok[0]
        rs_name, gate, k, tr, hold, maxc = key
        te_tr = slice_sched(scheds[key], te0, te1)
        curve, log, blew, maxlev = simulate_compounding(te_tr, equity, risk, COST)
        start_eq = equity
        equity = curve[-1][1]
        oos_curve.extend([(ts, eq) for ts, eq in curve[1:]])
        oos_log.extend(log)
        fold_rows.append({
            "fold": fi + 1, "test": [te0, te1],
            "config": (f"{rs_name}|gate={gate}|k={k}|trail={tr}|hold="
                       f"{'inf' if hold == HOLD_INF else hold}|conc={maxc}|risk={risk*100:.1f}%"),
            "train_n": m["n"], "train_bp": round(m["bp"], 1),
            "test_n": len(log), "test_pnl": round(equity - start_eq, 2),
            "equity_after": round(equity, 2), "max_gross_lev": round(maxlev, 2),
        })
        print(f"fold {fi+1}: {rs_name} gate={gate} k={k} trail={tr} "
              f"hold={'inf' if hold == HOLD_INF else hold} conc={maxc} risk={risk*100:.1f}%"
              f" | train n={m['n']} {m['bp']:+.1f}bp PF {m['pf']:.2f}"
              f" | OOS n={len(log)} pnl ${equity-start_eq:+,.0f} -> ${equity:,.0f}"
              f"{'  BLOWUP' if blew else ''}", flush=True)
        if blew or equity <= 0:
            print("PORTFOLIO BLOWN UP — stopping", flush=True)
            break

    # ---- benchmarks (OOS test window: first fold test start -> last fold test end)
    btc = load_bars("BTCUSDT")
    oos0 = folds[0]["test"][0] if folds else t_start
    oos1 = folds[-1]["test"][1] if folds else t_end
    msk = (btc["t"] >= oos0) & (btc["t"] <= oos1)
    btc_c = btc["c"][msk]
    btc_ret = float(btc_c[-1] / btc_c[0] - 1) if len(btc_c) > 2 else float("nan")

    allcfg_finals = []
    oos0r, oos1r = (folds[0]["test"][0], folds[-1]["test"][1]) if folds else (t_start, t_end)
    for key in sched_keys:
        te_tr = slice_sched(scheds[key], oos0r, oos1r)
        if not te_tr:
            continue
        for risk in RISKS:
            mtr = quick_metrics(te_tr, COST)
            if mtr["n"] == 0:
                continue
            allcfg_finals.append(INITIAL * (1 + mtr["sum_r"] * risk))
    allcfg = np.array(allcfg_finals) if allcfg_finals else np.array([INITIAL])

    stress = stress_pass(scheds, fold_rows) if fold_rows else {}

    # ---- outputs
    pd.DataFrame(oos_log).to_csv(f"{OUT}/e2e_trades_OOS.csv", index=False)
    pd.DataFrame(oos_curve, columns=["ts", "equity"]).to_csv(f"{OUT}/e2e_equity_OOS.csv", index=False)
    with open(f"{OUT}/e2e_fold_choices.json", "w") as f:
        json.dump({"folds": fold_rows, "btc_buyhold_ret": btc_ret,
                   "allconfig_median_final": float(np.median(allcfg)),
                   "allconfig_p10": float(np.percentile(allcfg, 10)),
                   "allconfig_p90": float(np.percentile(allcfg, 90)),
                   "stress": stress}, f, indent=2, default=str)

    print("\n============ E2E WALK-FORWARD v2 SUMMARY ($5,000 start) ============")
    print(f"final equity        : ${equity:,.2f}  ({(equity/INITIAL-1)*100:+.2f}%)")
    print(f"BTC buy&hold (OOS)  : {btc_ret*100:+.2f}%")
    print(f"all-config median   : ${np.median(allcfg):,.2f}  (no-skill reference)")
    for k_, v_ in stress.items():
        print(f"stress {k_:26s}: ${v_['final']:,.2f} ({v_['ret']*100:+.2f}%)")
    n_tr = len(oos_log)
    if n_tr:
        pnls = np.array([t["pnl"] for t in oos_log])
        wins, losses = pnls[pnls > 0], pnls[pnls <= 0]
        pf = wins.sum() / max(1e-9, -losses.sum())
        print(f"OOS trades          : {n_tr} · win {(pnls>0).mean()*100:.1f}% · PF {pf:.2f}")
        print(f"avg win ${wins.mean() if len(wins) else 0:,.0f} vs avg loss "
              f"${losses.mean() if len(losses) else 0:,.0f}")
        rf = defaultdict(int)
        for t in oos_log:
            rf[t["reason"]] += 1
        print(f"exit mix            : {dict(rf)}")
        fundtot = sum(t["fund_pct"] * t["notional"] for t in oos_log)
        costtot = sum(t["cost_pct"] * t["notional"] for t in oos_log)
        print(f"funding received    : ${fundtot:,.0f} · costs paid ${costtot:,.0f}")
    print("=====================================================================", flush=True)


def stress_pass(scheds, fold_rows):
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
            parts = f["config"].split("|")
            rs_name = parts[0]
            gate = parts[1].split("=")[1]
            k = float(parts[2].split("=")[1])
            tr = float(parts[3].split("=")[1])
            hold_s = parts[4].split("=")[1]
            hold = HOLD_INF if hold_s == "inf" else int(hold_s)
            maxc = int(parts[5].split("=")[1])
            risk = float(parts[6].split("=")[1].rstrip("%")) / 100
            te0, te1 = f["test"]
            te_tr = slice_sched(scheds[(rs_name, gate, k, tr, hold, maxc)], te0, te1)
            curve, log, blew, _ = simulate_compounding(te_tr, equity, risk, cost_v,
                                                       use_funding=use_fund)
            equity = curve[-1][1]
            logs.extend(log)
            if blew or equity <= 0:
                equity = max(equity, 0.0)
                break
        out[vname] = {"final": round(equity, 2), "ret": equity / INITIAL - 1, "n": len(logs)}
    return out


if __name__ == "__main__":
    main()
