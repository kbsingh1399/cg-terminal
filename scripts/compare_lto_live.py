#!/usr/bin/env python3
"""Live parity check: our /api/cg/lto output vs the Coinglass large-orderbook page."""
import json, subprocess, sys, time

LIVE = {
    # captured from coinglass.com/large-orderbook-statistics/BTC (same minute)
    "cards": {
        ("Binance", "Perp"):  {"net": "+$345M",  "bid": "$827M",  "ask": "$481M"},
        ("Binance", "Spot"):  {"net": "-$12M",   "bid": "$17M",   "ask": "$291M"},
        ("OKX", "Perp"):      {"net": "-$205M",  "bid": "$91.1M", "ask": "$297M"},
        ("OKX", "Spot"):      {"net": "+$10.8M", "bid": "$14.1M", "ask": "$3.23M"},
        ("Bybit", "Perp"):    {"net": "+$157M",  "bid": "$456M",  "ask": "$298M"},
        ("Bybit", "Spot"):    {"net": "+$10M",   "bid": "$17.2M", "ask": "$7.22M"},
        ("Coinbase", "Spot"): {"net": "-$414M",  "bid": "$102M",  "ask": "$515M"},
        ("Hyperliquid", "Perp"): {"net": "+$48.3M", "bid": "$194M", "ask": "$146M"},
    },
    "open_walls": 1178,
    "remaining_bid": 1.87e9,
    "remaining_ask": 2.04e9,
}

def parse_money(s: str) -> float:
    s = s.replace("+$", "").replace("-", "").replace("$", "").strip()
    mult = 1
    if s.endswith("B"): mult, s = 1e9, s[:-1]
    elif s.endswith("M"): mult, s = 1e6, s[:-1]
    elif s.endswith("K"): mult, s = 1e3, s[:-1]
    return float(s) * mult

def fmt_m(v: float) -> str:
    a = abs(v)
    sign = "+" if v >= 0 else "-"
    if a >= 1e9: return f"{sign}${a/1e9:.2f}B"
    if a >= 1e6: return f"{sign}${a/1e6:.1f}M"
    if a >= 1e3: return f"{sign}${a/1e3:.1f}K"
    return f"{sign}${a:.0f}"

MIN_USD = 1_000_000
out = subprocess.run(
    ["curl", "-s", "-m", "90", f"http://localhost:3000/api/cg/lto?minVolUsd={MIN_USD}"],
    capture_output=True, text=True
).stdout
d = json.loads(out)
if not d.get("ok"):
    print("API ERROR:", d.get("error")); sys.exit(1)

# aggregate per exchange+market
agg = {}
total_bid = total_ask = 0.0
open_count = 0
hl_sample = []
for g in d["groups"]:
    inst = g["instrument"]
    ex = inst["exName"]
    mkt = "Perp" if inst.get("type") == 1 else "Spot"
    key = (ex, mkt)
    e = agg.setdefault(key, {"bid": 0.0, "ask": 0.0, "n": 0})
    for it in g["list"]:
        if it.get("currentUsd", 0) < MIN_USD: continue
        if it["side"] == 2:  # bid
            e["bid"] += it["currentUsd"]; total_bid += it["currentUsd"]
        else:
            e["ask"] += it["currentUsd"]; total_ask += it["currentUsd"]
        e["n"] += 1
        open_count += 1
        if ex == "Hyperliquid" and it["side"] == 2 and abs(it["price"] - 74658.0) < 5:
            hl_sample.append(it)

print(f"=== OURS (minVolUsd ≥ $1M, {time.strftime('%H:%M:%S')}) ===")
print(f"total open orders: {open_count}  (live page: {LIVE['open_walls']})")
print(f"remaining bid: ${total_bid/1e9:.2f}B (live $1.87B) · ask: ${total_ask/1e9:.2f}B (live $2.04B)")
print()
print(f"{'exchange':16s} {'ours net':>12s} {'live net':>10s} | {'ours bid':>11s} {'live bid':>9s} | {'ours ask':>11s} {'live ask':>9s} | n")
for key in LIVE["cards"]:
    lv = LIVE["cards"][key]
    e = agg.get(key)
    if not e:
        print(f"{key[0]+' '+key[1]:16s} {'NO DATA':>12s} {lv['net']:>10s}")
        continue
    net = e["bid"] - e["ask"]
    print(
        f"{key[0]+' '+key[1]:16s} {fmt_m(net):>12s} {lv['net']:>10s} | "
        f"{fmt_m(e['bid'])[1:]:>11s} {lv['bid'][1:]:>9s} | "
        f"{fmt_m(e['ask'])[1:]:>11s} {lv['ask'][1:]:>9s} | {e['n']}"
    )
print()
# other exchanges with data
print("--- other exchanges (ours; live page has them behind the exchange picker) ---")
for key in sorted(agg):
    if key in LIVE["cards"]: continue
    e = agg[key]
    print(f"{key[0]+' '+key[1]:16s} net {fmt_m(e['bid']-e['ask']):>11s} bid {fmt_m(e['bid'])[1:]:>10s} ask {fmt_m(e['ask'])[1:]:>10s} n={e['n']}")

if hl_sample:
    it = hl_sample[0]
    print()
    print("HL bid wall @74,658 sample:", json.dumps({k: it[k] for k in ("price","side","startUsd","currentUsd","volUsd","count","state")}))
