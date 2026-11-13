#!/usr/bin/env python3
"""Deep analysis part 2: positions, inventory dynamics, spread capture, cloid decoding."""
import json, time, statistics
from collections import Counter, defaultdict

DATA = "/home/z/my-project/data"
fills = json.load(open(f"{DATA}/fills_all.json"))
fills.sort(key=lambda f: f["time"])

# ---- A. Position reconstruction per market ----
# track signed position; each "position cycle" = move from flat -> ... -> flat
def signed(f):
    q = float(f["sz"])
    if f["side"] == "S": q = -q
    return q

pos_state = defaultdict(float)          # coin -> current position
cycle = {}                              # coin -> open cycle info
cycles = []                             # completed round trips
entry_notional = defaultdict(float)     # running cost basis for FIFO-ish cycle tracking
peak_inv = defaultdict(float)

for f in fills:
    coin = f["coin"]
    q = signed(f)
    prev = pos_state[coin]
    new = prev + q
    pos_state[coin] = new
    peak_inv[coin] = max(peak_inv[coin], abs(new))
    # detect flat crossings
    if prev != 0 and (prev > 0) != (new > 0) and new != 0:
        cycles.append({"coin": coin, "time": f["time"], "type": "flip"})
    if prev != 0 and new == 0:
        cycles.append({"coin": coin, "time": f["time"], "type": "flat"})

print("=== POSITION CYCLES (returning to flat or flipping) ===")
flats = [c for c in cycles if c["type"]=="flat"]
print(f"total flat events: {len(flats)}, flips: {len(cycles)-len(flats)}")
fc = Counter(c["coin"] for c in flats)
print("markets most often returning to flat:", fc.most_common(10))

# ---- B. Inventory dynamics ----
print("\n=== PEAK INVENTORY vs DAILY VOLUME (top 12 by vol) ===")
by_coin_vol = defaultdict(float)
for f in fills: by_coin_vol[f["coin"]] += float(f["px"])*float(f["sz"])
for coin, vol in sorted(by_coin_vol.items(), key=lambda x:-x[1])[:12]:
    # inventory in $ at last known px
    last_px = [float(f["px"]) for f in fills if f["coin"]==coin][-1]
    print(f"  {coin:<15} peak inv: {peak_inv[coin]*last_px/1000:>8.0f}K$   final pos: {pos_state[coin]:>10.2f}  vol: {vol/1e6:.1f}M")

# ---- C. Spread capture: maker buy then maker sell ----
# For each coin, look at consecutive maker fills: buy at p1, sell at p2 > p1 quickly = captured spread
captures = []
maker_fills_by_coin = defaultdict(list)
for f in fills:
    if not f["crossed"]:
        maker_fills_by_coin[f["coin"]].append(f)
for coin, mf in maker_fills_by_coin.items():
    for i in range(1, len(mf)):
        a, b = mf[i-1], mf[i]
        if a["side"]=="B" and b["side"]=="S":
            dt = (b["time"]-a["time"])/1000
            if dt < 600:  # within 10 min
                captures.append((b["px"], a["px"], dt, coin))
print(f"\n=== SPREAD CAPTURE (maker buy->maker sell within 10min) ===")
print(f"pairs: {len(captures)}")
if captures:
    spreads_bps = [(float(s)-float(b2))/float(b2)*1e4 for s,b2,_,_ in captures]
    spreads_bps.sort()
    print(f"sell-buy spread bps: median {spreads_bps[len(spreads_bps)//2]:.1f}, mean {sum(spreads_bps)/len(spreads_bps):.1f}, p25 {spreads_bps[len(spreads_bps)//4]:.1f}, p75 {spreads_bps[len(spreads_bps)*3//4]:.1f}")
    neg = sum(1 for s in spreads_bps if s < 0)
    print(f"negative (crossed-spread against them): {neg} ({neg/len(spreads_bps)*100:.0f}%)")

# ---- D. cloid decoding ----
print("\n=== CLOID STRUCTURE ===")
cloids = [f["cloid"] for f in fills if f.get("cloid") and int(f["cloid"],16) != 0]
# Hex tail after 0x00000000000002: e.g. "230143943539014881"
tails = [c[16:] for c in cloids]  # strip 16 hex zeros
# these look like decimal digits inside hex string? "02230143943539014881" - all chars are 0-9!
all_dec = all(all(ch in "0123456789" for ch in t) for t in tails)
print(f"tails are pure decimal-digit strings: {all_dec}")
# first 4 hex chars look like a counter
prefix4 = Counter(c[14:18] for c in cloids)
print(f"cloid[14:18] distinct values: {len(prefix4)}, top: {prefix4.most_common(8)}")
seqs = [int(c[18:]) for c in cloids]
print(f"numeric tail: min {min(seqs)}, max {max(seqs)}, count {len(set(seqs))} distinct of {len(seqs)}")
# Are tails monotonic in time? correlation with fill time
pairs = sorted(zip([f['time'] for f in fills if f.get('cloid') and int(f['cloid'],16)!=0], seqs))
n = len(pairs); runs = 0
for i in range(1, n):
    if pairs[i][1] > pairs[i-1][1]: runs += 1
print(f"tail increasing with time: {runs/(n-1)*100:.1f}% of steps")

# ---- E. Same-second bursts ----
sec = Counter(f["time"]//1000 for f in fills)
print(f"\n=== BURST BEHAVIOR ===")
print(f"distinct seconds with fills: {len(sec)}; max fills in 1s: {max(sec.values())}; seconds with >=5 fills: {sum(1 for v in sec.values() if v>=5)}")

# ---- F. Taker usage: when do they cross the spread? ----
print("\n=== TAKER FILLS: purpose analysis ===")
# taker fills that REDUCE position vs INCREASE
reduce_taker = 0; increase_taker = 0
pos_now = defaultdict(float)
for f in fills:
    q = signed(f); prev = pos_now[f["coin"]]
    new = prev + q; pos_now[f["coin"]] = new
    if f["crossed"]:
        if abs(new) < abs(prev): reduce_taker += 1
        else: increase_taker += 1
print(f"taker fills reducing |inventory|: {reduce_taker} ({reduce_taker/(reduce_taker+increase_taker)*100:.0f}%)")
print(f"taker fills increasing |inventory|: {increase_taker}")

# ---- G. Order size quantization ----
print("\n=== SIZE QUANTIZATION (sz field, top markets) ===")
for coin in ["xyz:NVDA", "xyz:GOLD", "xyz:XYZ100", "xyz:SOXL", "xyz:HIMS"]:
    szs = [float(f["sz"]) for f in fills if f["coin"]==coin]
    common = Counter(round(s,2) for s in szs).most_common(6)
    print(f"  {coin:<14} distinct sizes {len(set(szs))}, mode: {common}")

# ---- H. Funding ----
try:
    funding = json.load(open(f"{DATA}/funding.json"))
    print(f"\n=== FUNDING === entries: {len(funding)}")
    if funding:
        t0 = min(x['time'] for x in funding); t1 = max(x['time'] for x in funding)
        print(f"range: {time.strftime('%Y-%m-%d', time.gmtime(t0/1000))} -> {time.strftime('%Y-%m-%d', time.gmtime(t1/1000))}")
        net = sum(float(x['payment']) for x in funding)
        print(f"net funding received: ${net:,.2f}")
        byc = defaultdict(float)
        for x in funding: byc[x['coin']] += float(x['payment'])
        print("funding by market:", {k: round(v,2) for k,v in sorted(byc.items(), key=lambda x:-abs(x[1]))[:10]})
except Exception as e:
    print("funding load error:", e)

# ---- I. State ----
try:
    state = json.load(open(f"{DATA}/state.json"))
    a = state["assetPositions"]
    print(f"\n=== CURRENT STATE === open positions: {len(a)}")
    print(f"marginSummary: {json.dumps(state.get('marginSummary',{}), indent=1)[:400]}")
    withdrawable = state.get("withdrawableUsd")
    print(f"withdrawableUsd: {withdrawable}")
except Exception as e:
    print("state error:", e)
