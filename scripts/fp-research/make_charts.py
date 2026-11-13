#!/usr/bin/env python3
"""fp-research — final report charts (English labels, terminal palette)."""
import gzip
import json
import sys
from collections import defaultdict

import matplotlib
matplotlib.use("Agg")
import matplotlib.font_manager as fm
fm.fontManager.addfont("/usr/share/fonts/truetype/chinese/NotoSansSC-Regular.ttf")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd

plt.rcParams["font.sans-serif"] = ["Noto Sans SC", "DejaVu Sans"]
plt.rcParams["axes.unicode_minus"] = False

DIR = "data/fp-research"
OUT = "download/fp-research"
import os
os.makedirs(OUT, exist_ok=True)

BG, FG, GRID = "#0b0e11", "#d4d8dd", "#2b3139"
ACCENTS = ["#f0b90b", "#e84142", "#26a17b", "#4f9cf9", "#b47be0", "#f2a03d"]


def style(ax):
    ax.set_facecolor(BG)
    for s in ax.spines.values():
        s.set_color(GRID)
    ax.tick_params(colors=FG, labelsize=8)
    ax.grid(color=GRID, lw=0.4, alpha=0.5)


def fig_ax(w, h):
    f = plt.figure(figsize=(w, h), facecolor=BG)
    return f, f.add_subplot(111)


# ------------------------------------------------ 1. validation table
f, ax = fig_ax(9.5, 3.6)
rows = [
    ("11-12 23:15", "Absorption · Selling absorbed at the low", "bullish", "MATCH"),
    ("11-12 22:45", "Absorption · Selling absorbed at the low", "bullish", "MATCH"),
    ("11-12 21:00", "Bull div · Lower low, higher CVD", "bullish", "MATCH"),
    ("11-12 20:30", "Exhaustion · Seller exhaustion", "bullish", "MATCH"),
    ("11-12 14:30", "Absorption · Buying absorbed at the high", "bearish", "MATCH"),
    ("11-12 00:45", "Divergence · Drop without taker selling", "bullish", "MATCH"),
    ("11-11 23:00", "Trapped shorts · Failed breakdown", "bullish", "MATCH"),
    ("11-11 21:30", "Absorption · Buying absorbed at the high", "bearish", "MATCH"),
    ("11-11 21:30", "Bear div · Higher high, lower CVD", "bearish", "MATCH"),
]
ax.axis("off")
ax.set_title("Signal validation — Coinglass BTC 15m panel vs reconstructed engine (2026-11-13 scrape)",
             color=FG, fontsize=11, pad=12)
y = 0.95
ax.text(0.02, y, "TIME (UTC)", color="#8a919c", fontsize=8, weight="bold")
ax.text(0.20, y, "SIGNAL", color="#8a919c", fontsize=8, weight="bold")
ax.text(0.72, y, "DIRECTION", color="#8a919c", fontsize=8, weight="bold")
ax.text(0.88, y, "RESULT", color="#8a919c", fontsize=8, weight="bold")
for i, (t, s, d, r) in enumerate(rows):
    yy = y - 0.095 * (i + 1)
    c = "#26a17b" if d == "bullish" else "#e84142"
    ax.text(0.02, yy, t, color=FG, fontsize=8, family="monospace")
    ax.text(0.20, yy, s, color=FG, fontsize=8)
    ax.text(0.72, yy, d, color=c, fontsize=8)
    ax.text(0.88, yy, "9/9 MATCH", color="#26a17b", fontsize=8, weight="bold")
ax.text(0.02, 0.02, "Calibrated gates: low-zone ratio ≥ 0.27 (bull) / high-zone ≥ 0.43 (bear, CG tick-attribution ≈ 0.70× m1-overlap) · closePos ≥ 0.65 / ≤ 0.35 · 1-bar hold · CVD-gap > 0.0015 · dedup 2 bars",
        color="#8a919c", fontsize=6.5)
f.savefig(f"{OUT}/chart1_validation.png", dpi=170, facecolor=BG, bbox_inches="tight")
plt.close(f)

# ------------------------------------------------ 2. horizon heatmaps
sys.path.insert(0, "scripts/fp-research")
from walk_forward_final import load_m15, btc_1d_down_series  # reuse loaders

df = pd.read_pickle(f"{DIR}/events.pkl")
uni = [x["symbol"] for x in json.load(open(f"{DIR}/universe.json"))]
K = {s: load_m15(s) for s in uni}
HORIZONS = {"30m": 2, "1h": 4, "2h": 8, "4h": 16, "8h": 32, "24h": 96}
t0, t1 = df["ts"].min(), df["ts"].max()
split = t0 + (t1 - t0) // 2

classes = [("absorption", "bearish"), ("absorption", "bullish"), ("bear_div", "bearish"),
           ("bull_div", "bullish"), ("divergence", "bearish"), ("divergence", "bullish"),
           ("exhaustion", "bearish"), ("exhaustion", "bullish"), ("trapped", "bearish"), ("trapped", "bullish")]

def adj_matrix(lo, hi):
    drift = {}
    for hname, hb in HORIZONS.items():
        drift[hname] = {}
        for s in uni:
            m = K[s]
            t, c = m["t"].values, m["c"].values
            msk = (t >= lo) & (t <= hi - hb * 900_000)
            c2 = c[msk]
            if len(c2) > hb + 50:
                drift[hname][s] = (c2[hb:] / c2[:-hb] - 1).mean()
    M = np.full((len(classes), len(HORIZONS)), np.nan)
    w = df[(df["ts"] >= lo) & (df["ts"] < hi)]
    for ci, (ty, d) in enumerate(classes):
        g = w[(w["type"] == ty) & (w["dir"] == d)]
        if len(g) < 200:
            continue
        for hi_, (hname, hb) in enumerate(HORIZONS.items()):
            vals = []
            for _, e in g.iterrows():
                m = K[e["sym"]]
                ei = int(e["entry_i"])
                if ei + hb >= len(m):
                    continue
                entry = m["o"].values[ei]
                fwd = m["c"].values[ei + hb] / entry - 1
                sign = 1 if d == "bullish" else -1
                vals.append(sign * fwd - sign * drift[hname].get(e["sym"], 0.0))
            M[ci, hi_] = np.mean(vals) * 1e4 if vals else np.nan
    return M

M1 = adj_matrix(t0, split)
M2 = adj_matrix(split, t1)
vmax = 60
f, (a1, a2) = plt.subplots(1, 2, figsize=(10.5, 4.6), facecolor=BG)
for ax, M, title in [(a1, M1, "DESIGN (May 17 – Aug 15, falling market)"), (a2, M2, "HOLDOUT (Aug 15 – Nov 13, rally + top)")]:
    im = ax.imshow(M, cmap="RdYlGn", vmin=-vmax, vmax=vmax, aspect="auto")
    ax.set_xticks(range(len(HORIZONS)), list(HORIZONS), color=FG, fontsize=8)
    ax.set_yticks(range(len(classes)), [f"{t}|{d[:4]}" for t, d in classes], color=FG, fontsize=8.5)
    ax.set_title(title, color=FG, fontsize=10)
    for ci in range(len(classes)):
        for hj in range(len(HORIZONS)):
            v = M[ci, hj]
            if np.isfinite(v):
                ax.text(hj, ci, f"{v:+.0f}", ha="center", va="center", fontsize=6.5,
                        color="#111" if abs(v) > 30 else FG)
    ax.set_facecolor(BG)
f.suptitle("Drift-adjusted mean forward return (bp) — sign instability across windows kills standalone edge", color=FG, fontsize=11)
f.colorbar(im, ax=[a1, a2], label="bp (drift-adjusted)", shrink=0.8).ax.tick_params(colors=FG, labelsize=7)
f.savefig(f"{OUT}/chart2_horizons.png", dpi=170, facecolor=BG, bbox_inches="tight")
plt.close(f)

# ------------------------------------------------ 3. strategy equity curves
sys.path.insert(0, "scripts/fp-research")
from strategy_final import add_confluence as cf_add, select as cf_select, simulate as cf_sim, COST, COST_STRESS

dfc = cf_add(df)
t0c, t1c = dfc["ts"].min(), dfc["ts"].max()
splitc = t0c + (t1c - t0c) // 2
f, ax = fig_ax(10, 4.2)
cfgs = []
for label, ev, gate_note in [
    ("Frozen rules · 3×ATR stop · DESIGN", cf_select(dfc[dfc["ts"] < splitc]), "d"),
    ("Frozen rules · 3×ATR stop · HOLDOUT", cf_select(dfc[dfc["ts"] >= splitc]), "h"),
]:
    cfgs.append((label, ev))
from strategy_v3 import simulate as v3_sim
for label, ev in cfgs:
    trs = v3_sim(ev, gate_trend=False, cost=0.0015)
    # rebuild with 3ATR via strategy_final's simulate (tail 3x inside its own defaults)
    trs2 = cf_sim(ev, cost=0.0015)
    rr = np.array([t["ret"] / t["stop_pct"] * 0.01 for t in trs2])
    eq = np.cumsum(rr) * 100
    x = pd.to_datetime([t["ts"] for t in trs2], unit="ms")
    ax.plot(x, eq, lw=1.4, color=ACCENTS[1] if "HOLDOUT" in label else ACCENTS[0], label=f"{label} (n={len(trs2)})")
# no-stop variant
from strategy_final import TAIL_ATR
import strategy_final as sf
for label, ev, col in [("No-stop time exit · DESIGN", cf_select(dfc[dfc["ts"] < splitc]), ACCENTS[2]),
                       ("No-stop time exit · HOLDOUT", cf_select(dfc[dfc["ts"] >= splitc]), ACCENTS[3])]:
    trs = []
    per = defaultdict(list)
    for _, e in ev.iterrows():
        per[e["sym"]].append(e)
    for sym, evs in per.items():
        m = load_m15(sym)
        o, c = m["o"].values, m["c"].values
        t = m["t"].values
        n = len(m)
        t2i = {ts: i for i, ts in enumerate(t)}
        for e in evs:
            i = t2i.get(int(e["ts"]))
            if i is None: continue
            ei = i + int(e["confirmBars"]) + 1
            if ei >= n - 2: continue
            entry = o[ei]
            j = min(ei + 96, n - 1)
            trs.append({"ts": t[ei], "ret": -(c[j]/entry-1) - 0.0015, "stop_pct": 0.06})
    trs.sort(key=lambda x: x["ts"])
    rr = np.array([t["ret"] / t["stop_pct"] * 0.01 for t in trs])
    eq = np.cumsum(rr) * 100
    x = pd.to_datetime([t["ts"] for t in trs], unit="ms")
    ax.plot(x, eq, lw=1.2, color=col, label=f"{label} (n={len(trs)})", alpha=0.85)
ax.axhline(0, color=GRID, lw=0.8)
style(ax)
ax.set_title("Directional short book (bear_div + exhaustion + absorption rules) — every variant loses out-of-sample · 1% equity risk/trade", color=FG, fontsize=10)
ax.set_ylabel("cumulative % (1% risk per trade)", color=FG, fontsize=8)
ax.legend(facecolor=BG, edgecolor=GRID, labelcolor=FG, fontsize=7, loc="upper right", framealpha=0.85)
f.savefig(f"{OUT}/chart3_equity.png", dpi=170, facecolor=BG, bbox_inches="tight")
plt.close(f)

# ------------------------------------------------ 4. agg vs binance overlap
f, (a1, a2) = plt.subplots(1, 2, figsize=(10, 3.8), facecolor=BG)
for ax, sym, ovl, nb, na in [(a1, "BTC", 75, 345, 340), (a2, "ETH", 74, 377, 335)]:
    ax.bar(["Binance-only", "Aggregated\n(5 venues)"], [nb, na], color=[ACCENTS[0], ACCENTS[3]], width=0.5)
    ax.bar(["Binance-only"], [ovl / 100 * nb], color=ACCENTS[2], width=0.5)
    ax.set_title(f"{sym} · 10d Coinglass footprint · {ovl}% signal overlap (±1 bar)", color=FG, fontsize=9.5)
    style(ax)
    ax.set_ylabel("signals (994 m15 bars)", color=FG, fontsize=8)
f.suptitle("Aggregated vs Binance-only footprint signals — statistically indistinguishable edge, ~75% congruence", color=FG, fontsize=11)
f.savefig(f"{OUT}/chart4_agg.png", dpi=170, facecolor=BG, bbox_inches="tight")
plt.close(f)

print("charts written to", OUT)
for fn in sorted(os.listdir(OUT)):
    print(" ", fn, os.path.getsize(f"{OUT}/{fn}"))
