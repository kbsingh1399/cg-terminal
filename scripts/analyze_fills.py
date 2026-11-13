#!/usr/bin/env python3
"""Deep analysis of Selini Capital #3 fills to reverse-engineer the trading algorithm."""
import json, time, statistics
from collections import Counter, defaultdict

DATA = "/home/z/my-project/data"
fills = json.load(open(f"{DATA}/fills_all.json"))
fills.sort(key=lambda f: f["time"])
print(f"=== DATASET: {len(fills)} fills ===")
print(f"span: {time.strftime('%Y-%m-%d %H:%M', time.gmtime(fills[0]['time']/1000))} -> {time.strftime('%Y-%m-%d %H:%M', time.gmtime(fills[-1]['time']/1000))}")
days = (fills[-1]['time'] - fills[0]['time']) / 86400000
print(f"span days: {days:.1f}, fills/day: {len(fills)/days:.0f}")

# ---- 1. Market universe ----
by_coin = defaultdict(lambda: {"n":0, "vol":0.0, "pnl":0.0, "fees":0.0, "buy":0, "sell":0})
for f in fills:
    c = by_coin[f["coin"]]
    c["n"] += 1
    c["vol"] += float(f["px"]) * float(f["sz"])
    c["pnl"] += float(f.get("closedPnl") or 0)
    c["fees"] += float(f.get("fee") or 0)
    if f["side"] == "B": c["buy"] += 1
    else: c["sell"] += 1

total_vol = sum(c["vol"] for c in by_coin.values())
total_pnl = sum(c["pnl"] for c in by_coin.values())
total_fee = sum(c["fees"] for c in by_coin.values())
print(f"\n=== AGGREGATES ===")
print(f"total volume: ${total_vol:,.0f}  (avg ${total_vol/days:,.0f}/day)")
print(f"total realized pnl (closedPnl): ${total_pnl:,.2f}")
print(f"total fees: ${total_fee:,.2f}  (fees/volume: {total_fee/total_vol*1e4:.4f} bps)")

print(f"\n=== MARKETS ({len(by_coin)}) — by volume ===")
print(f"{'market':<16}{'fills':>6}{'volume $M':>10}{'rPnL $':>10}{'fees $':>8}{'B/S':>9}")
for coin, c in sorted(by_coin.items(), key=lambda x: -x[1]["vol"])[:25]:
    print(f"{coin:<16}{c['n']:>6}{c['vol']/1e6:>10.1f}{c['pnl']:>10.0f}{c['fees']:>8.0f}{str(c['buy'])+'/'+str(c['n']-c['buy']):>9}")

# ---- 2. Maker vs taker ----
crossed = Counter(f["crossed"] for f in fills)
print(f"\n=== MAKER/TAKER ===")
maker = crossed[False]; taker = crossed[True]
print(f"maker fills: {maker} ({maker/len(fills)*100:.1f}%)  taker fills: {taker} ({taker/len(fills)*100:.1f}%)")
mk_pnl = sum(float(f.get('closedPnl') or 0) for f in fills if not f["crossed"])
tk_pnl = sum(float(f.get('closedPnl') or 0) for f in fills if f["crossed"])
mk_fee = sum(float(f.get('fee') or 0) for f in fills if not f["crossed"])
tk_fee = sum(float(f.get('fee') or 0) for f in fills if f["crossed"])
print(f"maker realized PnL: ${mk_pnl:,.0f} (fees ${mk_fee:,.0f})")
print(f"taker realized PnL: ${tk_pnl:,.0f} (fees ${tk_fee:,.0f})")
print(f"maker vol: ${sum(float(f['px'])*float(f['sz']) for f in fills if not f['crossed'])/1e6:,.0f}M, taker vol: ${sum(float(f['px'])*float(f['sz']) for f in fills if f['crossed'])/1e6:,.0f}M")

# taker fees: crossed=true fills pay taker fee. fee field sign?
tk_fee_pos = sum(float(f.get('fee') or 0) for f in fills if f["crossed"] and float(f.get('fee') or 0) > 0)
print(f"(fee>0 on taker: ${tk_fee_pos:,.0f}; sample taker fee field: {[f['fee'] for f in fills if f['crossed']][:5]})")

# ---- 3. Direction & dir types ----
dirs = Counter(f["dir"] for f in fills)
print(f"\n=== FILL DIRECTIONS ===")
for d, n in dirs.most_common(): print(f"  {d}: {n}")

# ---- 4. Time-of-day pattern ----
hod = Counter(time.gmtime(f["time"]/1000).tm_hour for f in fills)
print(f"\n=== FILLS BY HOUR (UTC) ===")
for h in range(24):
    bar = '#' * (hod.get(h,0) // 30)
    print(f"  {h:02d}:00 {hod.get(h,0):>5} {bar}")
dow = Counter(time.gmtime(f["time"]/1000).tm_wday for f in fills)
print("=== FILLS BY WEEKDAY (0=Mon) ===")
for d in range(7): print(f"  {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'][d]}: {dow.get(d,0)}")

# ---- 5. Fill size distribution ----
sizes = [float(f["sz"]) for f in fills]
notional = sorted(float(f["px"])*float(f["sz"]) for f in fills)
print(f"\n=== FILL NOTIONAL ($) ===")
print(f"  median: {notional[len(notional)//2]:,.0f}  mean: {sum(notional)/len(notional):,.0f}")
print(f"  p10: {notional[len(notional)//10]:,.0f}  p90: {notional[len(notional)*9//10]:,.0f}")
print(f"  max: {notional[-1]:,.0f}  min: {notional[0]:,.2f}")

# ---- 6. Orders: fills per order id, cloid patterns ----
oids = Counter(f["oid"] for f in fills)
print(f"\n=== ORDERS ===")
print(f"  unique order ids: {len(oids)}")
fpo = sorted(oids.values())
print(f"  fills per order: median {fpo[len(fpo)//2]}, mean {sum(fpo)/len(fpo):.2f}, max {fpo[-1]}")
cloids = [f["cloid"] for f in fills if f.get("cloid") and not f["cloid"].startswith("0x00000000000000000000000000000000")]
print(f"  fills with non-zero cloid: {len(cloids)} / {len(fills)}")
if cloids:
    prefixes = Counter(c[:8] for c in cloids)
    print(f"  cloid prefixes (first 8 hex): {prefixies if False else dict(list(prefixes.items())[:10])}")
    print(f"  sample cloids: {cloids[:5]}")

# twap usage
twap = [f for f in fills if f.get("twapId")]
print(f"  fills with twapId: {len(twap)}")

# ---- 7. Inter-fill timing ----
gaps = [(fills[i+1]["time"] - fills[i]["time"])/1000 for i in range(len(fills)-1)]
gaps_s = sorted(gaps)
print(f"\n=== INTER-FILL GAPS (sec) ===")
print(f"  median: {gaps_s[len(gaps_s)//2]:.0f}  mean: {sum(gaps_s)/len(gaps_s):.0f}")
print(f"  p10: {gaps_s[len(gaps_s)//10]:.0f}  p90: {gaps_s[len(gaps_s)*9//10]:.0f}")
