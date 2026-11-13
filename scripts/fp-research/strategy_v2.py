#!/usr/bin/env python3
"""
fp-research step 5b — honest two-window protocol + fast engine.

  DESIGN window:   day 0-90    (all class selection, horizons, filters here)
  HOLDOUT window:  day 90-180  (strategy frozen — the verdict)

Strategy core: class→direction→horizon mapping with TIME exits (the alpha is
horizon-based; a wide disaster stop only for tail control). Fixed-fractional
sizing off the disaster stop. Portfolio: max concurrent, one per symbol.
"""
import gzip
import json
import pickle
from collections import defaultdict

import numpy as np
import pandas as pd

DIR = "data/fp-research"
COST_BPS = 15.0

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


def simulate(events, cost_bps=COST_BPS, max_conc=6, tail_stop_atr=3.0,
             by_class_holding=True):
    """
    events: DataFrame rows with sym, ts, dir(+1/-1), entry_i, hold_bars,
            stop_ref (price of signal-bar extreme), atr
    Time exit at hold_bars; disaster stop at tail_stop_atr × ATR beyond
    signal extreme. Entry next-bar open (entry_i already points there).
    Returns list of trade dicts with r (R vs disaster stop), ret (pct).
    """
    per_sym = defaultdict(list)
    for e in events:
        per_sym[e["sym"]].append(e)
    trades = []
    cost = cost_bps / 1e4
    for sym, evs in per_sym.items():
        m = load_m15(sym)
        o, h, l, c = m["o"].values, m["h"].values, m["l"].values, m["c"].values
        n = len(m)
        for e in evs:
            i, d, hb = e["entry_i"], e["dir"], e["hold_bars"]
            entry = o[i]
            atr = e["atr"]
            if not np.isfinite(entry) or not np.isfinite(atr) or atr <= 0 or i >= n - 2:
                continue
            # disaster stop beyond signal-bar extreme
            ext = e["stop_ref"]
            stop = (ext - tail_stop_atr * atr) if d > 0 else (ext + tail_stop_atr * atr)
            stop_dist = abs(entry - stop)
            if stop_dist <= 0:
                continue
            j_end = min(i + hb, n - 1)
            exit_px, exit_i, reason = None, None, None
            for j in range(i, j_end + 1):
                if d > 0 and l[j] <= stop:
                    exit_px, exit_i, reason = stop, j, "stop"
                    break
                if d < 0 and h[j] >= stop:
                    exit_px, exit_i, reason = stop, j, "stop"
                    break
            if exit_px is None:
                exit_px, exit_i, reason = c[j_end], j_end, "time"
            ret = d * (exit_px / entry - 1)
            trades.append({
                "sym": sym, "ts": m["t"].values[i], "exit_ts": m["t"].values[exit_i],
                "type": e["type"], "dir": d, "ret": ret - cost,
                "gross": ret, "reason": reason, "hold": exit_i - i,
                "stop_pct": stop_dist / entry,
            })
    # portfolio constraints
    trades.sort(key=lambda x: x["ts"])
    held, kept = {}, []
    for tr in trades:
        held = {s: t for s, t in held.items() if t > tr["ts"]}
        if tr["sym"] in held:
            continue
        if len(held) >= max_conc:
            continue
        kept.append(tr)
        held[tr["sym"]] = tr["exit_ts"]
    return kept


def metrics(trades):
    if not trades:
        return {"n": 0, "win": 0.0, "avg_bps": 0.0, "pf": 0.0, "sharpe": 0.0, "maxdd_bps": 0.0, "tpd": 0.0}
    r = np.array([t["ret"] for t in trades])
    wins, losses = r[r > 0], r[r <= 0]
    eq = np.cumsum(r)
    dd = (np.maximum.accumulate(eq) - eq).max() if len(eq) else 0
    days = max((trades[-1]["ts"] - trades[0]["ts"]) / 86_400_000, 1e-9)
    return {
        "n": len(r), "win": float((r > 0).mean()), "avg_bps": float(r.mean() * 1e4),
        "pf": float(wins.sum() / max(1e-9, -losses.sum())),
        "sharpe": float(r.mean() / (r.std() + 1e-9) * np.sqrt(len(r) / days)),
        "maxdd_bps": float(dd * 1e4), "tpd": float(len(r) / days),
    }


def show(label, trades):
    m = metrics(trades)
    print(f"{label:34s} n={m['n']:5d} ({m['tpd']:5.1f}/d) win={m['win']:.3f} "
          f"avg={m['avg_bps']:7.1f}bp PF={m['pf']:.2f} Shp={m['sharpe']:5.2f} DD={m['maxdd_bps']:8.0f}bp")
    return m


def build_trade_events(ev: pd.DataFrame, holds: dict, tail=3.0):
    """ev: events rows; holds: {type: bars}. stop_ref = signal-bar extreme."""
    out = []
    for sym, grp in ev.groupby("sym"):
        m = load_m15(sym)
        h, l = m["h"].values, m["l"].values
        t2i = {t: i for i, t in enumerate(m["t"].values)}
        atr = (m["h"] - m["l"]).rolling(20).mean().values
        for _, e in grp.iterrows():
            hb = holds.get(e["type"])
            if hb is None:
                continue
            i = t2i.get(e["ts"])
            ei = e["entry_i"]
            if i is None or ei is None or ei >= len(m) - 2:
                continue
            sig_i = ei - e["confirmBars"] - 1  # the signal bar itself
            ext = h[sig_i] if e["dir"] == "bearish" else l[sig_i]
            out.append({
                "sym": sym, "ts": e["ts"], "type": e["type"],
                "dir": 1 if e["dir"] == "bullish" else -1,
                "entry_i": int(ei), "hold_bars": hb,
                "stop_ref": ext, "atr": atr[i],
            })
    return out


if __name__ == "__main__":
    df = pd.read_pickle(f"{DIR}/events.pkl")
    t0, t1 = df["ts"].min(), df["ts"].max()
    split = t0 + (t1 - t0) // 2  # 90d design / 90d holdout
    design = df[df["ts"] < split]
    hold = df[df["ts"] >= split]
    print(f"design: {pd.to_datetime(t0, unit='ms').date()} → {pd.to_datetime(split, unit='ms').date()} "
          f"({len(design)} events) · holdout: → {pd.to_datetime(t1, unit='ms').date()} ({len(hold)} events)")

    # ---- class selection ON DESIGN ONLY ----
    print("\n=== DESIGN-window drift-adjusted edges (4h / 12h / 24h, bps) ===")
    import gzip as gz
    drift = {}
    uni = [x["symbol"] for x in json.load(open(f"{DIR}/universe.json"))]
    for sym in uni:
        m = load_m15(sym)
        c = m["c"].values
        t = m["t"].values
        msk = (t >= t0) & (t <= split - 96 * 900_000)
        c2, t2 = c[msk], t[msk]
        if len(c2) > 100:
            drift[sym] = (c2[96:] / c2[:-96] - 1).mean()

    for (t, d), grp in design.groupby(["type", "dir"]):
        if len(grp) < 60:
            continue
        row = []
        for hname, hb in [("4h", 16), ("12h", 48), ("24h", 96)]:
            x = grp[f"ret_{hname}"].values * 1e4
            dr = np.mean([drift.get(s, 0.0) * hb / 96 * 1e4 for s in grp["sym"]])
            row.append(x.mean() - (dr if d == "bullish" else -dr))
        print(f"  {t:11s} {d:8s} n={len(grp):5d}  4h {row[0]:7.1f}  12h {row[1]:7.1f}  24h {row[2]:7.1f}")

    # ---- candidate mappings (chosen from the design table above) ----
    candidates = {
        "A_bearDivShort_12h": ({"bear_div": 48}, ("bear_div", "bearish")),
        "B_bullDivLong_24h": ({"bull_div": 96}, ("bull_div", "bullish")),
        "C_bearExhShort_24h": ({"exhaustion": 96}, ("exhaustion", "bearish")),
        "D_bearDivShort+bearExhShort": ({"bear_div": 48, "exhaustion": 96}, None),
        "E_all_core": ({"bear_div": 48, "bull_div": 96, "exhaustion": 96}, None),
    }

    print("\n=== DESIGN window performance (net 15bp cost) ===")
    for name, (holds, only) in candidates.items():
        ev = design
        if only:
            ev = design[(design["type"] == only[0]) & (design["dir"] == only[1])]
        tevs = build_trade_events(ev, holds)
        trs = simulate(tevs)
        show(f"  {name}", trs)

    print("\n=== HOLDOUT window performance (frozen) ===")
    for name, (holds, only) in candidates.items():
        ev = hold
        if only:
            ev = hold[(hold["type"] == only[0]) & (hold["dir"] == only[1])]
        tevs = build_trade_events(ev, holds)
        trs = simulate(tevs)
        show(f"  {name}", trs)

    # per-class holdout diagnostics for the winner components
    print("\n=== HOLDOUT per-class breakdown (E components) ===")
    for cls, d in [("bear_div", "bearish"), ("bull_div", "bullish"), ("exhaustion", "bearish")]:
        ev = hold[(hold["type"] == cls) & (hold["dir"] == d)]
        tevs = build_trade_events(ev, {cls: 48 if cls == "bear_div" else 96})
        trs = simulate(tevs)
        show(f"  {cls}/{d}", trs)
