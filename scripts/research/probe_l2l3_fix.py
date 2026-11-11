#!/usr/bin/env python3
"""
Re-probe Lighter L3 with CORRECT response parsing ({code, asks[], bids[]}) and
persist full evidence per market (RV-ARCH B1 / RV-QUANT B2). Also verify the 7
Kraken FX pair names + measure visible-book notionals to calibrate thin rules.
"""
import json, time
from pathlib import Path
import requests

OUT = Path(__file__).parent / "probes" / "l2l3"
OUT.mkdir(parents=True, exist_ok=True)
UA = {"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36"}

MARKETS = [
    (92, "XAU"), (93, "XAG"), (180, "US500"), (181, "US100"), (128, "SPY"),
    (129, "QQQ"), (153, "IWM"), (145, "WTI"), (159, "BRENTOIL"), (158, "NATGAS"),
    (96, "EURUSD"), (98, "USDJPY"), (97, "GBPUSD"),
]

def px(x): return float(x["price"])
def rem(x): return float(x["remaining_base_amount"])

print("=" * 108)
print("LIGHTER L3 — corrected probe (orderBookOrders limit=250/side + recentTrades limit=100) · 2026-11-11")
print("=" * 108)
table = []
for mid, name in MARKETS:
    try:
        r = requests.get("https://mainnet.zklighter.elliot.ai/api/v1/orderBookOrders",
                         params={"market_id": mid, "limit": 250}, headers=UA, timeout=20)
        r.raise_for_status()
        book = r.json()
        asks, bids = book.get("asks", []), book.get("bids", [])
        ask_notional = sum(px(a) * rem(a) for a in asks)
        bid_notional = sum(px(b) * rem(b) for b in bids)
        best_ask = min((px(a) for a in asks), default=None)
        best_bid = max((px(b) for b in bids), default=None)
        # whale clustering preview (top accounts by total notional)
        acc = {}
        for side, orders in (("ask", asks), ("bid", bids)):
            for o in orders:
                a = acc.setdefault(o["owner_account_index"], {"ask": 0.0, "bid": 0.0, "n": 0})
                a[side] += px(o) * rem(o)
                a["n"] += 1
        whales = sorted(acc.items(), key=lambda kv: -(kv[1]["ask"] + kv[1]["bid"]))[:5]
        # partial fills (visible only — censored sample, RV-QUANT)
        partials = [o for o in asks + bids
                    if float(o["initial_base_amount"]) > 0
                    and 0 < float(o["remaining_base_amount"]) < float(o["initial_base_amount"])]
        (OUT / f"lighter-{name}-l3book.json").write_text(json.dumps(book, indent=1)[:1_500_000])
        t = requests.get("https://mainnet.zklighter.elliot.ai/api/v1/recentTrades",
                         params={"market_id": mid, "limit": 100}, headers=UA, timeout=20)
        t.raise_to_status = None
        trades_raw = t.json()
        trades = trades_raw if isinstance(trades_raw, list) else trades_raw.get("trades", [])
        (OUT / f"lighter-{name}-trades.json").write_text(json.dumps(trades_raw, indent=1)[:1_500_000])
        sym_echo = trades[0].get("market_symbol") if trades else None
        kind_echo = trades[0].get("market_kind") if trades else None
        taker_buy = sum(float(x.get("usd_amount", 0)) for x in trades if x.get("is_maker_ask"))
        taker_sell = sum(float(x.get("usd_amount", 0)) for x in trades if not x.get("is_maker_ask"))
        # Lighter timestamps are MILLISECONDS (R4 smoke finding) — span in seconds
        span_s = (int(trades[0]["timestamp"]) - int(trades[-1]["timestamp"])) / 1000 if len(trades) >= 2 else 0
        table.append({
            "id": mid, "name": name, "symbol_echo": sym_echo, "kind": kind_echo,
            "n_asks": len(asks), "n_bids": len(bids),
            "ask_notional_usd": round(ask_notional), "bid_notional_usd": round(bid_notional),
            "best_bid": best_bid, "best_ask": best_ask,
            "spread_pct": round((best_ask - best_bid) / best_bid * 100, 4) if best_ask and best_bid else None,
            "top5_accounts": [
                {"acc": k, "n": v["n"], "ask$": round(v["ask"]), "bid$": round(v["bid"]),
                 "two_sided": v["ask"] > 0 and v["bid"] > 0}
                for k, v in whales],
            "n_visible_partials": len(partials),
            "n_trades_fetched": len(trades),
            "taker_buy_usd": round(taker_buy), "taker_sell_usd": round(taker_sell),
            "trade_span_s": span_s,
        })
        r2 = table[-1]
        print(f"  {name:<10} id={mid:<4} echo={sym_echo!s:<8} {kind_echo!s:<6} asks={len(asks):<4} bids={len(bids):<4} "
              f"askNtl=${ask_notional:>12,.0f} bidNtl=${bid_notional:>12,.0f} "
              f"spread={r2['spread_pct']}% partials={len(partials)} trades={len(trades)} span={span_s}s")
    except Exception as e:
        print(f"  {name:<10} id={mid:<4} FAIL — {e}")
    time.sleep(0.4)

(OUT / "lighter-l3-full-verify.json").write_text(json.dumps(table, indent=1))
print(f"\nevidence: lighter-<NAME>-l3book.json + lighter-<NAME>-trades.json + lighter-l3-full-verify.json")

print("\nTop-5 accounts per market (MM = two-sided quoting suspicion):")
for r2 in table:
    tops = ", ".join(f"#{a['acc']}/{a['n']}ord/${(a['ask$']+a['bid$'])/1000:.0f}k{'(MM)' if a['two_sided'] else ''}" for a in r2["top5_accounts"][:3])
    print(f"  {r2['name']:<10} {tops}")

print("\n" + "=" * 108)
print("KRAKEN — verify 7 FX pair names (REST /0/public/Depth)")
print("=" * 108)
kr = {}
for pair in ["EURUSD", "USDJPY", "GBPUSD", "AUDUSD", "USDCAD", "USDCHF", "NZDUSD"]:
    try:
        r = requests.get("https://api.kraken.com/0/public/Depth", params={"pair": pair, "count": 10}, headers=UA, timeout=15)
        r.raise_for_status()
        j = r.json()
        if j.get("error"):
            kr[pair] = {"ok": False, "error": j["error"]}
            print(f"  {pair:<8} API ERROR {j['error']}")
            continue
        key = list(j["result"].keys())[0]
        res = j["result"][key]
        bb, ba = float(res["bids"][0][0]), float(res["asks"][0][0])
        newest_ts = max(float(x[2]) for x in res["bids"] + res["asks"])
        kr[pair] = {"ok": True, "key": key, "best_bid": bb, "best_ask": ba,
                    "spread_pct": round((ba - bb) / bb * 100, 5), "newest_level_ts": newest_ts}
        print(f"  {pair:<8} key={key:<12} bid={bb} ask={ba} spread={(ba-bb)/bb*100:.5f}% newest_lvl_age={time.time()-newest_ts:.0f}s")
    except Exception as e:
        kr[pair] = {"ok": False, "error": str(e)}
        print(f"  {pair:<8} FAIL {e}")
    time.sleep(0.5)
(OUT / "kraken-pairs-verify.json").write_text(json.dumps(kr, indent=1))
print("\ndone")
