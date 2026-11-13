#!/usr/bin/env python3
"""Algorithm inference: corrected ordering, inventory dynamics, spread capture, skew."""
import json, time, statistics
from collections import Counter, defaultdict

DATA = "/home/z/my-project/data"
fills = json.load(open(f"{DATA}/fills_all.json"))

def signed(f):
    q = float(f["sz"])
    return -q if f["side"] == "S" else q

# ---- fix same-ms ordering by chaining startPosition within each (coin, time) group ----
by_coin = defaultdict(list)
for f in fills: by_coin[f["coin"]].append(f)

def chain_group(group):
    """Order fills in a same-timestamp group so startPositions chain."""
    if len(group) <= 1: return group
    # build map from startPosition -> fill(s)
    remaining = list(group)
    # determine chain start: fill whose startPosition isn't produced by another fill's end
    ends = {}
    for f in remaining:
        ends[round(float(f["startPosition"]) + signed(f), 6)] = f
    ordered = []
    cur = None
    # greedy: start with fill whose startPosition has no incoming edge
    starts = [f for f in remaining if round(float(f["startPosition"]),6) not in ends or float(f["startPosition"]) == 0]
    if not starts:
        starts = [min(remaining, key=lambda f: float(f["startPosition"]))]
    used = set()
    cur_fill = starts[0]
    while True:
        ordered.append(cur_fill); used.add(cur_fill["tid"])
        nxt_pos = round(float(cur_fill["startPosition"]) + signed(cur_fill), 6)
        nxt = None
        for f in remaining:
            if f["tid"] not in used and round(float(f["startPosition"]),6) == nxt_pos:
                nxt = f; break
        if nxt is None: break
        cur_fill = nxt
    # append any leftovers (orphaned due to position jumps)
    left = [f for f in remaining if f["tid"] not in used]
    return ordered + left

fixed = []
for coin, fl in by_coin.items():
    fl.sort(key=lambda f: f["time"])
    groups = defaultdict(list)
    for f in fl: groups[f["time"]].append(f)
    out = []
    for t in sorted(groups): out.extend(chain_group(groups[t]))
    fixed.extend(out)
fills = fixed
fills.sort(key=lambda f: (f["time"],))
json.dump(fills, open(f"{DATA}/fills_ordered.json", "w"))
print(f"ordered fills: {len(fills)}")

# ---- validate continuity again ----
def check(fills):
    gaps = 0; pos = defaultdict(float)
    byc = defaultdict(list)
    for f in fills: byc[f["coin"]].append(f)
    for coin, fl in byc.items():
        p = 0.0
        for f in fl:
            sp = float(f["startPosition"])
            if abs(sp - p) > 1e-6: gaps += 1
            p = sp + signed(f)
    return gaps
print(f"remaining continuity gaps after chain-fix: {check(fills)}")

# ---- final positions vs UI ----
byc = defaultdict(list)
for f in fills: byc[f["coin"]].append(f)
ui = {"xyz:COIN": -1170, "xyz:XYZ100": 3.72, "xyz:CBRS": 763.15, "xyz:SILVER": -1390, "xyz:NFLX": -766.01}
print("\n=== FINAL POSITIONS (computed vs UI) ===")
computed = {coin: float(fl[-1]["startPosition"]) + signed(fl[-1]) for coin, fl in byc.items()}
for coin, uiv in ui.items():
    print(f"  {coin:<15} computed {computed.get(coin,0):>10.2f}  UI {uiv:>10}  match={abs(computed.get(coin,0)-uiv)<max(2,abs(uiv)*0.02)}")

# ---- inventory stats per market ----
print("\n=== INVENTORY DYNAMICS ===")
print(f"{'market':<15}{'medInv$':>9}{'p95Inv$':>9}{'medTrn$':>9}{'invTurn':>8}{'halfLife(h)':>12}")
inv_stats = []
for coin, fl in sorted(byc.items(), key=lambda x: -sum(float(f['px'])*float(f['sz']) for f in x[1]))[:15]:
    invs = [float(f["startPosition"]) + signed(f) for f in fl]
    pxs = [float(f["px"]) for f in fl]
    inv_dollars = [abs(i)*p for i, p in zip(invs, pxs)]
    vol = sum(float(f["px"])*float(f["sz"]) for f in fl)
    med = statistics.median(inv_dollars); p95 = sorted(inv_dollars)[int(len(inv_dollars)*0.95)]
    # half-life: time for |inv| autocorr to halve (sample every fill)
    import math
    abs_inv = [abs(i) for i in invs]
    if len(abs_inv) > 50 and max(abs_inv) > 0:
        # lag-1 correlation on abs inv
        x = abs_inv[:-1]; y = abs_inv[1:]
        mx = statistics.mean(x); my = statistics.mean(y)
        cov = sum((a-mx)*(b-my) for a,b in zip(x,y))/len(x)
        vx = statistics.pvariance(x); vy = statistics.pvariance(y)
        rho = cov/math.sqrt(vx*vy) if vx>0 and vy>0 else 0
        # fills arrive ~ every 30-60s; half life in fills = ln(0.5)/ln(rho)
        hl_fills = math.log(0.5)/math.log(rho) if 0 < rho < 1 else float('nan')
        avg_gap_s = (fl[-1]["time"]-fl[0]["time"])/1000/len(fl)
        hl_hours = hl_fills * avg_gap_s / 3600
    else:
        hl_hours = float('nan')
    inv_stats.append((coin, med, p95, vol, hl_hours))
    print(f"{coin:<15}{med:>9,.0f}{p95:>9,.0f}{vol:>9,.0f}{'':>8}{hl_hours:>12.1f}")

# ---- spread capture via 5-min buckets ----
print("\n=== SPREAD CAPTURE (per 5-min bucket, maker fills) ===")
caps = []
for coin, fl in byc.items():
    buckets = defaultdict(lambda: {"bP":[], "bQ":[], "sP":[], "sQ":[]})
    for f in fl:
        if f["crossed"]: continue
        b = f["time"] // (300*1000)
        d = buckets[b]
        if f["side"] == "B": d["bP"].append(float(f["px"])); d["bQ"].append(float(f["sz"]))
        else: d["sP"].append(float(f["px"])); d["sQ"].append(float(f["sz"]))
    for b, d in buckets.items():
        if d["bP"] and d["sP"]:
            vwap_b = sum(p*q for p,q in zip(d["bP"],d["bQ"]))/sum(d["bQ"])
            vwap_s = sum(p*q for p,q in zip(d["sP"],d["sQ"]))/sum(d["sQ"])
            caps.append((vwap_s - vwap_b) / ((vwap_s+vwap_b)/2) * 1e4)  # bps
caps.sort()
if caps:
    print(f"buckets with both maker buys & sells: {len(caps)}")
    print(f"maker sell-VWAP minus buy-VWAP: median {caps[len(caps)//2]:.2f} bps, mean {sum(caps)/len(caps):.2f} bps")
    print(f"  p10 {caps[len(caps)//10]:.2f}  p90 {caps[len(caps)*9//10]:.2f}")
    neg = sum(1 for c in caps if c < 0)
    print(f"  negative buckets (bought higher than sold): {neg} ({neg/len(caps)*100:.0f}%)")

# ---- inventory skew: does inventory predict next fill direction? ----
print("\n=== INVENTORY SKEW (inventory vs next maker fill side) ===")
for coin, fl in list(sorted(byc.items(), key=lambda x: -len(x[1])))[:8]:
    after_long_sell = 0; n_long = 0; after_short_buy = 0; n_short = 0
    for i in range(len(fl)-1):
        inv = float(fl[i]["startPosition"]) + signed(fl[i])
        nxt = fl[i+1]
        if not nxt["crossed"]: continue
        if inv > 0:
            n_long += 1
            if nxt["side"] == "S": after_long_sell += 1
        elif inv < 0:
            n_short += 1
            if nxt["side"] == "B": after_short_buy += 1
    if n_long > 20 and n_short > 20:
        print(f"  {coin:<15} when LONG: next maker fill sells {after_long_sell/n_long*100:.0f}% | when SHORT: next maker fill buys {after_short_buy/n_short*100:.0f}% (n={n_long}/{n_short})")

# ---- holding time / round trips ----
print("\n=== ROUND TRIPS (position local-extreme to next reduction) ===")
# approximate trade duration: time between position opening fill and the fill that closes majority of it
durs = []
for coin, fl in byc.items():
    cur_inv = 0.0; cur_t = None; cur_notional = 0.0
    for f in fl:
        inv_before = float(f["startPosition"])
        inv_after = inv_before + signed(f)
        if inv_before == 0 and inv_after != 0:
            cur_t = f["time"]; cur_inv = inv_after
        elif cur_t is not None and ((cur_inv > 0 and inv_after <= 0) or (cur_inv < 0 and inv_after >= 0)):
            durs.append((f["time"] - cur_t)/60000)  # minutes
            cur_t = None
            if inv_after != 0: cur_t = f["time"]; cur_inv = inv_after
durs.sort()
if durs:
    print(f"completed position cycles: {len(durs)}")
    print(f"duration minutes: median {durs[len(durs)//2]:.0f}, mean {sum(durs)/len(durs):.0f}, p10 {durs[len(durs)//10]:.0f}, p90 {durs[len(durs)*9//10]:.0f}")
    print(f"share < 60 min: {sum(1 for d in durs if d<60)/len(durs)*100:.0f}%  < 1 day: {sum(1 for d in durs if d<1440)/len(durs)*100:.0f}%")

# ---- price level granularity ----
print("\n=== MAKER PRICE GRANULARITY ===")
for coin in ["xyz:NVDA", "xyz:GOLD", "xyz:XYZ100"]:
    mp = [float(f["px"]) for f in byc[coin] if not f["crossed"]]
    diffs = sorted(abs(mp[i]-mp[i-1]) for i in range(1,len(mp)) if mp[i]!=mp[i-1])
    if diffs:
        print(f"  {coin:<15} min price step seen: {diffs[0]:.4f}  (median |Δpx| between maker fills: {diffs[len(diffs)//2]:.4f})")

# ---- loss response: BRENTOIL deep dive ----
print("\n=== BRENTOIL (worst market) daily PnL ===")
fl = byc.get("xyz:BRENTOIL", [])
daily = defaultdict(float)
for f in fl: daily[time.strftime('%m-%d', time.gmtime(f['time']/1000))] += float(f.get("closedPnl") or 0)
for d, p in sorted(daily.items()): print(f"  {d}: ${p:,.0f}  ({len([f for f in fl if time.strftime('%m-%d', time.gmtime(f['time']/1000))==d])} fills)")
