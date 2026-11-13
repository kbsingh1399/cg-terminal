#!/usr/bin/env python3
"""Final analysis: side semantics, skew with buffer, burst anatomy, cloid fingerprint."""
import json, time, statistics
from collections import Counter, defaultdict

DATA = "/home/z/my-project/data"
fills = json.load(open(f"{DATA}/fills_ordered.json"))

def signed(f):
    q = float(f["sz"])
    return -q if f["side"] == "S" else q

# ---- 1. cross-tab side x dir (validate semantics) ----
ct = Counter((f["side"], f["dir"]) for f in fills)
print("=== SIDE x DIR cross-tab ===")
for (s, d), n in sorted(ct.items(), key=lambda x: -x[1]):
    print(f"  side={s} dir={d}: {n}")

# ---- 2. inventory skew with time buffer ----
print("\n=== INVENTORY SKEW (next fill >=5s later, per coin) ===")
by_coin = defaultdict(list)
for f in fills: by_coin[f["coin"]].append(f)
tot_when_long_sell = tot_n_long = tot_when_short_buy = tot_n_short = 0
for coin, fl in by_coin.items():
    for i in range(len(fl)-1):
        inv = float(fl[i]["startPosition"]) + signed(fl[i])
        nxt = fl[i+1]
        if nxt["time"] - fl[i]["time"] < 5000: continue
        if inv > 0:
            tot_n_long += 1
            if nxt["side"] == "S": tot_when_long_sell += 1
        elif inv < 0:
            tot_n_short += 1
            if nxt["side"] == "B": tot_when_short_buy += 1
print(f"when inventory LONG:  next fill is SELL {tot_when_long_sell/tot_n_long*100:.1f}% of {tot_n_long} cases")
print(f"when inventory SHORT: next fill is BUY  {tot_when_short_buy/tot_n_short*100:.1f}% of {tot_n_short} cases")
print(f"(50% would be no skew)")

# ---- 3. burst anatomy: the 52-fills-in-1-second events ----
print("\n=== BURST ANATOMY ===")
sec = defaultdict(list)
for f in fills: sec[f["time"]//1000].append(f)
big = sorted(sec.items(), key=lambda x: -len(x[1]))[:3]
for t, fl in big:
    coins = Counter(f["coin"] for f in fl)
    makers = sum(1 for f in fl if not f["crossed"])
    print(f"  {time.strftime('%m-%d %H:%M:%S', time.gmtime(t))}: {len(fl)} fills, maker {makers}, coins: {dict(coins)}")

# ---- 4. reaction: after a TAKER fill, how fast is the next fill? ----
taker_times = [f["time"] for f in fills if f["crossed"]]
fill_times = [f["time"] for f in fills]
import bisect
reactions = []
for tt in taker_times[:3000]:
    idx = bisect.bisect_right(fill_times, tt)
    if idx < len(fill_times):
        dt = fill_times[idx] - tt
        if dt >= 0: reactions.append(dt/1000)
reactions.sort()
if reactions:
    print(f"\n=== REACTION TIME after taker fill ===")
    print(f"next fill arrives: median {reactions[len(reactions)//2]:.1f}s, p90 {reactions[len(reactions)*9//10]:.1f}s")

# ---- 5. cloid fingerprint ----
print("\n=== CLOID FINGERPRINT ===")
cloid_fills = [(f["time"], f["cloid"]) for f in fills if f.get("cloid") and int(f["cloid"],16) != 0]
# cloid -> list of times (same cloid across fills = one logical order)
by_cloid = defaultdict(list)
for t, c in cloid_fills: by_cloid[c].append(t)
multi = {c: ts for c, ts in by_cloid.items() if len(ts) > 1}
print(f"distinct cloids: {len(by_cloid)}, used by >1 fill: {len(multi)} ({len(multi)/len(by_cloid)*100:.0f}%)")
# cloid prefix [14:18] = maybe market index? check correlation with coin
prefix_coin = defaultdict(set)
for f in fills:
    c = f.get("cloid")
    if c and int(c,16) != 0:
        prefix_coin[c[14:18]].add(f["coin"])
pure = sum(1 for p, coins in prefix_coin.items() if len(coins) == 1)
print(f"cloid[14:18] values: {len(prefix_coin)}, mapping to exactly 1 coin: {pure}")
sample = list(prefix_coin.items())[:6]
print("sample prefix->coins:", [(p, list(cs)[:3]) for p, cs in sample])

# ---- 6. fee economics ----
print("\n=== FEE ECONOMICS ===")
maker_fees = [float(f["fee"]) for f in fills if not f["crossed"]]
taker_fees = [float(f["fee"]) for f in fills if f["crossed"]]
print(f"maker fees: total ${sum(maker_fees):,.2f} (mean {sum(maker_fees)/len(maker_fees):.4f})")
print(f"taker fees: total ${sum(taker_fees):,.2f} (mean {sum(taker_fees)/len(taker_fees):.4f})")
print(f"note: negative maker fee = REBATE received")
neg_makers = sum(1 for x in maker_fees if x < 0)
print(f"maker fills with rebate: {neg_makers}/{len(maker_fees)}")

# ---- 7. per-market maker/taker pnl split top 10 ----
print("\n=== MAKER vs TAKER PNL BY MARKET (top by |pnl|) ===")
stats = defaultdict(lambda: {"mk_pnl":0,"tk_pnl":0,"mk_n":0,"tk_n":0,"vol":0})
for f in fills:
    s = stats[f["coin"]]; s["vol"] += float(f["px"])*float(f["sz"])
    if f["crossed"]: s["tk_pnl"] += float(f.get("closedPnl") or 0); s["tk_n"] += 1
    else: s["mk_pnl"] += float(f.get("closedPnl") or 0); s["mk_n"] += 1
for coin, s in sorted(stats.items(), key=lambda x: -(abs(x[1]["mk_pnl"])+abs(x[1]["tk_pnl"])))[:12]:
    print(f"  {coin:<15} maker: {s['mk_pnl']:>9,.0f}$ ({s['mk_n']:>4} fills) | taker: {s['tk_pnl']:>9,.0f}$ ({s['tk_n']:>4} fills)")

# ---- 8. equity & pnl split ----
mk = sum(float(f.get('closedPnl') or 0) for f in fills if not f["crossed"])
tk = sum(float(f.get('closedPnl') or 0) for f in fills if f["crossed"])
print(f"\nTOTAL realized: maker ${mk:,.0f} + taker ${tk:,.0f} = ${mk+tk:,.0f}")
print(f"funding (2d): $313 | equity now: $2,665,052")

# ---- 9. biggest single fills ----
print("\n=== LARGEST FILLS ===")
for f in sorted(fills, key=lambda x: -float(x["px"])*float(x["sz"]))[:8]:
    v = float(f["px"])*float(f["sz"])
    print(f"  {f['coin']:<15} ${v:>9,.0f}  {f['dir']:<12} {'maker' if not f['crossed'] else 'taker'}  pnl {float(f.get('closedPnl') or 0):>8,.0f}  {time.strftime('%m-%d %H:%M', time.gmtime(f['time']/1000))}")
