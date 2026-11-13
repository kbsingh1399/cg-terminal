#!/usr/bin/env python3
"""Recompute with CORRECT side semantics: B=buy, A=sell."""
import json, time, statistics, math
from collections import Counter, defaultdict

DATA = "/home/z/my-project/data"
fills = json.load(open(f"{DATA}/fills_ordered.json"))

def signed(f):
    q = float(f["sz"])
    return -q if f["side"] == "A" else q   # A = Ask = SELL

# ---- validate positions against UI ----
byc = defaultdict(list)
for f in fills: byc[f["coin"]].append(f)
ui = {"xyz:COIN": -1170, "xyz:XYZ100": 3.72, "xyz:CBRS": 763.15, "xyz:SILVER": -1390, "xyz:NFLX": -766.01, "xyz:NVDA": None}
print("=== FINAL POSITIONS: computed (startPosition of LAST fill + its fill) vs UI ===")
for coin, uiv in ui.items():
    fl = byc.get(coin, [])
    if not fl: print(f"  {coin}: no fills"); continue
    p = float(fl[-1]["startPosition"]) + signed(fl[-1])
    print(f"  {coin:<15} computed {p:>10.2f}" + (f"  UI {uiv:>10}" if uiv is not None else ""))

# ---- continuity check with correct semantics ----
def check():
    gaps = 0
    for coin, fl in byc.items():
        p = 0.0
        for f in fl:
            if abs(float(f["startPosition"]) - p) > 1e-6: gaps += 1
            p = float(f["startPosition"]) + signed(f)
    return gaps
print(f"\ncontinuity gaps with correct side semantics: {check()} (0 = perfect chain)")

# ---- inventory dynamics (corrected) ----
print("\n=== INVENTORY DYNAMICS (corrected) ===")
print(f"{'market':<15}{'medInv$':>9}{'p95Inv$':>9}{'vol$M':>8}{'halfLife':>10}{'maxInvDays':>11}")
for coin, fl in sorted(byc.items(), key=lambda x: -sum(float(f['px'])*float(f['sz']) for f in x[1]))[:14]:
    invs = [float(f["startPosition"]) + signed(f) for f in fl]
    pxs = [float(f["px"]) for f in fl]
    inv_d = [abs(i)*p for i, p in zip(invs, pxs)]
    vol = sum(float(f["px"])*float(f["sz"]) for f in fl)
    med = statistics.median(inv_d); p95 = sorted(inv_d)[int(len(inv_d)*0.95)]
    mx = max(inv_d)
    # half-life via lag-1 autocorr of signed inventory (mean-reverting OU)
    inv_signed = invs
    x = inv_signed[:-1]; y = inv_signed[1:]
    mx_ = statistics.mean(x); my_ = statistics.mean(y)
    cov = sum((a-mx_)*(b-my_) for a,b in zip(x,y))/len(x)
    vx = statistics.pvariance(x)
    var_y = statistics.pvariance(y)
    rho = cov/math.sqrt(vx*var_y) if vx>0 and var_y>0 else 1
    avg_gap_s = (fl[-1]["time"]-fl[0]["time"])/1000/max(len(fl)-1,1)
    hl_h = (math.log(0.5)/math.log(rho))*avg_gap_s/3600 if 0<rho<1 else float('nan')
    print(f"{coin:<15}{med:>9,.0f}{p95:>9,.0f}{vol/1e6:>8.1f}{hl_h:>9.1f}h{mx/ (vol/ max((fl[-1]['time']-fl[0]['time'])/86400000,0.1)) :>10.1f}x/d")

# ---- inventory skew (corrected) ----
print("\n=== INVENTORY SKEW (corrected; next fill >=5s later) ===")
nL=sL=nS=sS=0
for coin, fl in byc.items():
    for i in range(len(fl)-1):
        inv = float(fl[i]["startPosition"]) + signed(fl[i])
        nxt = fl[i+1]
        if nxt["time"] - fl[i]["time"] < 5000: continue
        if inv > 0:
            nL += 1
            if nxt["side"] == "A": sL += 1
        elif inv < 0:
            nS += 1
            if nxt["side"] == "B": sS += 1
print(f"inventory LONG  -> next fill SELL: {sL/nL*100:.1f}%  (n={nL})")
print(f"inventory SHORT -> next fill BUY:  {sS/nS*100:.1f}%  (n={nS})")

# skew by maker only
nL=sL=nS=sS=0
for coin, fl in byc.items():
    for i in range(len(fl)-1):
        inv = float(fl[i]["startPosition"]) + signed(fl[i])
        nxt = fl[i+1]
        if nxt["crossed"] or nxt["time"] - fl[i]["time"] < 5000: continue
        if inv > 0:
            nL += 1
            if nxt["side"] == "A": sL += 1
        elif inv < 0:
            nS += 1
            if nxt["side"] == "B": sS += 1
print(f"MAKER-only: LONG->sell {sL/max(nL,1)*100:.1f}% (n={nL}) | SHORT->buy {sS/max(nS,1)*100:.1f}% (n={nS})")

# ---- round trips (corrected) ----
durs = []
for coin, fl in byc.items():
    cur_t = None; cur_inv = 0.0
    for f in fl:
        ib = float(f["startPosition"]); ia = ib + signed(f)
        if ib == 0 and ia != 0:
            cur_t = f["time"]; cur_inv = ia
        elif cur_t is not None and ((cur_inv > 0 and ia <= 0) or (cur_inv < 0 and ia >= 0)):
            durs.append((f["time"]-cur_t)/60000)
            cur_t = f["time"] if ia != 0 else None
            cur_inv = ia
durs.sort()
print(f"\n=== ROUND TRIPS (corrected): {len(durs)} cycles ===")
print(f"duration min: median {durs[len(durs)//2]:.0f}, mean {sum(durs)/len(durs):.0f}, p10 {durs[len(durs)//10]:.0f}, p90 {durs[len(durs)*9//10]:.0f}")
print(f"<60min: {sum(1 for d in durs if d<60)/len(durs)*100:.0f}%  <1d: {sum(1 for d in durs if d<1440)/len(durs)*100:.0f}%")

# ---- net direction: are they net short the market? ----
print("\n=== NET INVENTORY SNAPSHOT (last 1000 fills window) ===")
tot_long_usd = tot_short_usd = 0
for coin, fl in byc.items():
    p = float(fl[-1]["startPosition"]) + signed(fl[-1])
    px = float(fl[-1]["px"])
    v = p*px
    if v > 0: tot_long_usd += v
    else: tot_short_usd += -v
print(f"total long inventory: ${tot_long_usd:,.0f} | total short: ${tot_short_usd:,.0f} | net: ${tot_long_usd-tot_short_usd:,.0f}")
