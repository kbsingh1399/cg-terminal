#!/usr/bin/env python3
"""Generate all charts for the institutional trading report (English labels)."""
import json, time, statistics
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.font_manager as fm
import numpy as np
from collections import Counter, defaultdict

for fp in ["/usr/share/fonts/truetype/chinese/NotoSansSC-Regular.ttf"]:
    try: fm.fontManager.addfont(fp)
    except: pass
plt.rcParams["font.sans-serif"] = ["DejaVu Sans", "Noto Sans SC"]
plt.rcParams["axes.unicode_minus"] = False

DATA = "/home/z/my-project/data"
OUT = "/home/z/my-project/data/charts"
import os; os.makedirs(OUT, exist_ok=True)

# Palette — professional finance
NAVY = "#16324F"; BLUE = "#2E6E9E"; TEAL = "#3E8E7E"; GOLD = "#B8860B"
RED = "#B0413E"; GRAY = "#8A97A5"; LIGHT = "#DCE4EC"

def save(fig, name):
    fig.savefig(f"{OUT}/{name}", dpi=180, bbox_inches="tight", pad_inches=0.15, facecolor="white")
    plt.close(fig)
    print("saved", name)

# ---------- Chart 1: Equity curve ----------
fav = json.load(open(f"{DATA}/fav_trader.json"))
pg = fav["portfolioGraph"]
ts = [p["timestamp"]/1000 for p in pg]; vals = [float(p["value"]) for p in pg]
fig, ax = plt.subplots(figsize=(10, 5), constrained_layout=True)
ax.plot(ts, vals, color=NAVY, lw=2.2)
ax.fill_between(ts, vals, color=NAVY, alpha=0.12)
ax.set_title("Selini Capital #3 — Account Value, Nov 2025 to Nov 2026", fontsize=13, pad=12, color="#222")
ax.set_ylabel("Account value (USD)", fontsize=11)
ax.yaxis.set_major_formatter(lambda x, _: f"${x/1e6:.1f}M")
import datetime
ticks = [datetime.date(2025,12,1), datetime.date(2026,2,1), datetime.date(2026,4,1), datetime.date(2026,6,1), datetime.date(2026,8,1), datetime.date(2026,10,1), datetime.date(2026,11,13)]
ax.set_xticks([datetime.datetime.combine(t, datetime.time(12)).timestamp() for t in ticks])
ax.set_xticklabels([t.strftime("%b %y") for t in ticks], fontsize=9)
ax.spines[["top","right"]].set_visible(False)
ax.grid(axis="y", alpha=0.3, color="#CCC")
ax.annotate(f"${vals[-1]/1e6:.2f}M", (ts[-1], vals[-1]), textcoords="offset points", xytext=(-8,8),
            fontsize=11, fontweight="bold", color=NAVY)
save(fig, "equity_curve.png")

# ---------- Chart 2: Hourly activity ----------
fills = json.load(open(f"{DATA}/fills_ordered.json"))
hod = Counter(time.gmtime(f["time"]/1000).tm_hour for f in fills)
hours = list(range(24)); counts = [hod.get(h, 0) for h in hours]
colors = [BLUE if not (13 <= h <= 21) else NAVY for h in hours]
fig, ax = plt.subplots(figsize=(10, 4.6), constrained_layout=True)
ax.bar(hours, counts, color=colors, edgecolor="white")
ax.set_title("Fill Activity by Hour (UTC) — US Regular Session Highlighted", fontsize=13, pad=12)
ax.set_xlabel("Hour (UTC)", fontsize=11); ax.set_ylabel("Fills", fontsize=11)
ax.set_xticks(hours)
ax.spines[["top","right"]].set_visible(False)
ax.grid(axis="y", alpha=0.3, color="#CCC")
ax.axvspan(13.5, 20, alpha=0.08, color=GOLD)
ax.text(16.7, max(counts)*0.97, "US equities\n13:30-20:00 UTC", ha="center", fontsize=9, color=GOLD)
save(fig, "hourly_fills.png")

# ---------- Chart 3: Maker vs taker PnL by market ----------
stats = defaultdict(lambda: {"mk":0.0, "tk":0.0})
for f in fills:
    if f["crossed"]: stats[f["coin"]]["tk"] += float(f.get("closedPnl") or 0)
    else: stats[f["coin"]]["mk"] += float(f.get("closedPnl") or 0)
top = sorted(stats.items(), key=lambda x: -(abs(x[1]["mk"])+abs(x[1]["tk"])))[:12]
names = [c.replace("xyz:","") for c,_ in top][::-1]
mk = [v["mk"] for _,v in top][::-1]
tk = [v["tk"] for _,v in top][::-1]
fig, ax = plt.subplots(figsize=(10, 6.2), constrained_layout=True)
y = np.arange(len(names))
ax.barh(y - 0.17, mk, height=0.34, color=TEAL, label="Maker fills (passive)")
ax.barh(y + 0.17, tk, height=0.34, color=RED, label="Taker fills (aggressive)")
ax.set_yticks(y); ax.set_yticklabels(names, fontsize=10)
ax.axvline(0, color="#333", lw=0.8)
ax.set_title("Realized PnL by Market, Split by Execution Type (Nov 2-13)", fontsize=13, pad=12)
ax.set_xlabel("Realized PnL (USD)", fontsize=11)
ax.legend(loc="lower right", frameon=False, fontsize=10)
ax.spines[["top","right"]].set_visible(False)
ax.grid(axis="x", alpha=0.3, color="#CCC")
ax.xaxis.set_major_formatter(lambda x, _: f"${x/1000:.0f}K")
save(fig, "pnl_by_market.png")

# ---------- Chart 4: Inventory half-life ----------
hl = {"NVDA":7.7,"GOLD":4.9,"XYZ100":59.2,"BRENTOIL":12.3,"SP500":20.0,"SOXL":4.8,
      "SILVER":32.1,"CL":17.7,"AMD":6.4,"SPCX":6.8,"AAPL":32.5,"KORU":4.3,"CBRS":23.3,"SNDK":7.5}
pairs = sorted(hl.items(), key=lambda x: x[1])
names4 = [k for k,_ in pairs]; vals4 = [v for _,v in pairs]
fig, ax = plt.subplots(figsize=(10, 5.2), constrained_layout=True)
cols = [BLUE if v < 15 else NAVY for v in vals4]
ax.bar(names4, vals4, color=cols, edgecolor="white")
ax.set_title("Inventory Half-Life by Market (hours)", fontsize=13, pad=12)
ax.set_ylabel("Half-life (hours)", fontsize=11)
ax.spines[["top","right"]].set_visible(False)
ax.grid(axis="y", alpha=0.3, color="#CCC")
plt.xticks(rotation=45, ha="right", fontsize=10)
for i, v in enumerate(vals4):
    ax.text(i, v+0.8, f"{v:.1f}", ha="center", fontsize=9, color="#333")
save(fig, "halflife.png")

# ---------- Chart 5: Round-trip durations ----------
def signed(f):
    q = float(f["sz"]); return -q if f["side"] == "A" else q
byc = defaultdict(list)
for f in fills: byc[f["coin"]].append(f)
durs = []
for coin, fl in byc.items():
    cur_t = None; cur_inv = 0.0
    for f in fl:
        ib = float(f["startPosition"]); ia = ib + signed(f)
        if ib == 0 and ia != 0: cur_t = f["time"]; cur_inv = ia
        elif cur_t is not None and ((cur_inv > 0 and ia <= 0) or (cur_inv < 0 and ia >= 0)):
            durs.append((f["time"]-cur_t)/60000)
            cur_t = f["time"] if ia != 0 else None; cur_inv = ia
fig, ax = plt.subplots(figsize=(10, 4.8), constrained_layout=True)
bins = np.logspace(np.log10(max(min(durs),0.5)), np.log10(max(durs)), 28)
ax.hist(durs, bins=bins, color=BLUE, edgecolor="white")
ax.set_xscale("log")
ax.set_title("Position Round-Trip Duration Distribution (n=551 completed cycles)", fontsize=13, pad=12)
ax.set_xlabel("Duration (minutes, log scale)", fontsize=11); ax.set_ylabel("Cycles", fontsize=11)
ax.axvline(96, color=RED, lw=1.4, ls="--")
ax.text(105, ax.get_ylim()[1]*0.9, f"median 96 min", fontsize=10, color=RED)
ax.spines[["top","right"]].set_visible(False)
ax.grid(axis="y", alpha=0.3, color="#CCC")
ax.set_xticks([1, 5, 15, 60, 240, 720, 1440, 4320, 10000])
ax.set_xticklabels(["1m","5m","15m","1h","4h","12h","1d","3d","7d"])
save(fig, "durations.png")

# ---------- Chart 6: Institutional comparison ----------
comp = [("MachiBigBrother", -35.77, "swing"), ("Flow Traders #1", -0.60, "position"),
        ("Selini #4", -0.13, "algo"), ("Selini #5", -0.08, "algo"),
        ("Jump", 0.35, "algo"), ("Selini #2", 0.31, "algo"),
        ("Selini #3", 2.40, "algo"), ("Manifold", 6.18, "scalp"),
        ("Cumberland #1", 40.33, "algo"), ("Auros", 58.91, "algo")]
names6 = [c[0] for c in comp]; vals6 = [c[1] for c in comp]
cols6 = [RED if v < 0 else (TEAL if v < 20 else NAVY) for v in vals6]
fig, ax = plt.subplots(figsize=(10, 5.6), constrained_layout=True)
bars = ax.bar(names6, vals6, color=cols6, edgecolor="white")
ax.axhline(0, color="#333", lw=0.8)
ax.set_title("All-Time PnL — Hyperdash-Tagged Institutional & Whale Wallets (USD millions)", fontsize=13, pad=12)
ax.set_ylabel("All-time PnL ($M)", fontsize=11)
ax.spines[["top","right"]].set_visible(False)
ax.grid(axis="y", alpha=0.3, color="#CCC")
plt.xticks(rotation=40, ha="right", fontsize=10)
for b, v in zip(bars, vals6):
    ax.text(b.get_x()+b.get_width()/2, v + (1.2 if v>=0 else -2.6), f"{v:+.1f}" if abs(v)>=10 else f"{v:+.2f}",
            ha="center", fontsize=9, color="#333")
save(fig, "comparison.png")

# ---------- Chart 7: Live ladder diagram (CL) ----------
orders = json.load(open(f"{DATA}/orders_live.json"))
cl = [o for o in orders if o["asset"]=="CL"]
longs = sorted([o["price"] for o in cl if o["side"]=="Long"])
shorts = sorted([o["price"] for o in cl if o["side"]=="Short"])
mid = (longs[-1] + shorts[0]) / 2
fig, ax = plt.subplots(figsize=(9, 5.6), constrained_layout=True)
for i, p in enumerate(longs):
    ax.scatter([p], [i], marker="^", s=260, color=TEAL)
    ax.text(p, i, f"  {p:.3f}", va="center", fontsize=9.5, color=TEAL)
for i, p in enumerate(shorts):
    ax.scatter([p], [i], marker="v", s=260, color=RED)
    ax.text(p, i, f"  {p:.3f}", va="center", fontsize=9.5, color=RED)
ax.axvline(mid, color=GRAY, ls="--", lw=1.2)
ax.text(mid, max(len(longs),len(shorts))-0.2, f" mid {mid:.3f}", color=GRAY, fontsize=10)
ax.set_title("Live Quote Ladder — xyz:CL (Crude Oil), 10 Resting Orders", fontsize=13, pad=12)
ax.set_xlabel("Price (USD)", fontsize=11); ax.set_ylabel("Ladder level", fontsize=11)
ax.legend(handles=[plt.Line2D([0],[0],marker="^",color="w",markerfacecolor=TEAL,markersize=12,label="Buy (bid) levels"),
                   plt.Line2D([0],[0],marker="v",color="w",markerfacecolor=RED,markersize=12,label="Sell (ask) levels")],
          loc="upper left", frameon=False)
ax.spines[["top","right"]].set_visible(False)
ax.grid(axis="x", alpha=0.3, color="#CCC")
save(fig, "ladder.png")

# ---------- Chart 8: PnL attribution donut ----------
mk_total = 118644; tk_total = -7323; fees = -1607; funding = 313
fig, ax = plt.subplots(figsize=(7.2, 4.6), constrained_layout=True)
labels = ["Maker spread capture\n+$118.6K", "Taker inventory mgmt\n-$7.3K", "Net fees\n-$1.6K", "Funding\n+$0.3K"]
vals8 = [118644, -7323, -1607, 313]
colors8 = [TEAL, RED, GOLD, BLUE]
wedges, _ = ax.pie([abs(v) for v in vals8], colors=colors8, startangle=90, wedgeprops=dict(width=0.42, edgecolor="white"))
ax.text(0, 0.06, "$111.3K", ha="center", fontsize=20, fontweight="bold", color=NAVY)
ax.text(0, -0.16, "net realized\n(Nov 2-13)", ha="center", fontsize=9.5, color=GRAY)
ax.legend(wedges, labels, loc="center left", bbox_to_anchor=(1.02, 0.5), frameon=False, fontsize=10)
save(fig, "attribution.png")

print("ALL CHARTS DONE")
