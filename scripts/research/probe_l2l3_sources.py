#!/usr/bin/env python3
"""
Probe L2/L3 free data sources claimed by external research (2026-11-11).

User directive: "find multiple resources more like CME etc... continuous fetching
live free data via API for forex, indices, metals... at L2, L3 level too."

Sources under test (ALL live-probed, no second-hand numbers accepted):
  1. Hyperliquid xyz HIP-3  — L2 book + order count + OI + funding + candles
  2. Lighter DEX (zk-rollup CLOB) — TRUE L3 resting orders + recent trades
  3. Kraken Spot FX           — real fiat-to-fiat L2 depth
  4. Dukascopy .bi5           — historical tick dumps (L1 BBO + volumes)
  5. Binance Vision           — historical bulk dumps (trades/bookDepth/aggTrades)

Evidence written to scripts/research/probes/l2l3/ · summary to stdout.
"""
import json, lzma, struct, sys, time
from pathlib import Path

import requests

OUT = Path(__file__).parent / "probes" / "l2l3"
OUT.mkdir(parents=True, exist_ok=True)
UA = {"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36"}
results = {}

def save(name, obj):
    (OUT / f"{name}.json").write_text(json.dumps(obj, indent=1, default=str)[:400_000])
    print(f"  saved probes/l2l3/{name}.json")

def section(t):
    print(f"\n{'='*70}\n{t}\n{'='*70}")

# ----------------------------------------------------------------------------
section("1. HYPERLIQUID xyz HIP-3 — POST /info  (L2 book, OI, funding, candles)")
try:
    r = requests.post("https://api.hyperliquid.xyz/info",
                      json={"type": "metaAndAssetCtxs"}, headers=UA, timeout=15)
    r.raise_for_status()
    meta = r.json()
    universe, ctxs = meta[0], meta[1]
    xyz = []
    for i, (u, c) in enumerate(zip(universe, ctxs)):
        name = u.get("name", "")
        if name.startswith("xyz:"):
            try:
                vol = float(c.get("dayNtlVlm", 0))
                oi = float(c.get("openInterest", 0))
                px = float(c.get("markPx", 0) or 0)
                fund = float(c.get("funding", 0) or 0)
                xyz.append({"idx": i, "coin": name, "markPx": px,
                            "dayNtlVlm$": round(vol), "OI_base": round(oi, 3),
                            "funding_1h_pct": round(fund * 100, 5)})
            except (ValueError, TypeError):
                pass
    xyz.sort(key=lambda x: -x["dayNtlVlm$"])
    results["hyperliquid_xyz"] = {"ok": True, "n_xyz_markets": len(xyz), "top": xyz[:25]}
    save("hl-xyz-universe", xyz[:80])
    print(f"  OK — {len(xyz)} xyz markets. Top by 24h notional volume:")
    for z in xyz[:20]:
        print(f"    {z['coin']:<18} px={z['markPx']:<12} vol24h=${z['dayNtlVlm$']:>13,} OI={z['OI_base']:>14,} fund/1h={z['funding_1h_pct']}%")
except Exception as e:
    results["hyperliquid_xyz"] = {"ok": False, "error": str(e)}
    print(f"  FAIL — {e}")

# L2 book with order count (n) for xyz:GOLD
try:
    r = requests.post("https://api.hyperliquid.xyz/info",
                      json={"type": "l2Book", "coin": "xyz:GOLD"}, headers=UA, timeout=15)
    r.raise_for_status()
    book = r.json()
    bids, asks = book["levels"][0], book["levels"][1]
    results["hl_l2book_xyzGOLD"] = {
        "ok": True, "n_bids": len(bids), "n_asks": len(asks),
        "best_bid": bids[0] if bids else None, "best_ask": asks[0] if asks else None,
        "sample_bid_lvl3": bids[2] if len(bids) > 2 else None,
    }
    save("hl-l2book-xyzGOLD", book)
    print(f"  L2Book xyz:GOLD: {len(bids)} bids / {len(asks)} asks; best bid {bids[0]}, best ask {asks[0]}")
    print(f"  level shape has order-count n: {list(bids[0].keys()) if bids else 'n/a'}")
except Exception as e:
    results["hl_l2book_xyzGOLD"] = {"ok": False, "error": str(e)}
    print(f"  L2Book FAIL — {e}")

# Candles (60d 1h claimed)
try:
    now_ms = int(time.time() * 1000)
    r = requests.post("https://api.hyperliquid.xyz/info",
                      json={"type": "candleSnapshot", "req": {
                          "coin": "xyz:GOLD", "interval": "1h",
                          "startTime": now_ms - 62 * 86400_000, "endTime": now_ms}},
                      headers=UA, timeout=20)
    r.raise_for_status()
    candles = r.json()
    results["hl_candles_xyzGOLD"] = {
        "ok": True, "n_bars_1h_62d": len(candles),
        "first": candles[0] if candles else None, "last": candles[-1] if candles else None,
    }
    save("hl-candles-xyzGOLD", candles[-5:])
    if candles:
        print(f"  Candles xyz:GOLD 1h: {len(candles)} bars over 62d window; last close {candles[-1]['c']}")
except Exception as e:
    results["hl_candles_xyzGOLD"] = {"ok": False, "error": str(e)}
    print(f"  Candles FAIL — {e}")

# ----------------------------------------------------------------------------
section("2. LIGHTER DEX — REST L3 (order-by-order resting orders + trades)")
LIGHTER = "https://mainnet.zklighter.elliot.ai/api/v1"
# claimed market ids from external research (MUST re-verify by name)
CLAIMED = {"XAU": 92, "XAG": 93, "US100": 181, "US500": 180, "SPY": 128, "QQQ": 129,
           "WTI": 145, "BRENTOIL": 159, "NATGAS": 158, "EURUSD": 96, "USDJPY": 98, "GBPUSD": 97}
lighter_ok = {}
try:
    # enumerate markets to verify ids by NAME
    r = requests.get(f"{LIGHTER}/markets", headers=UA, timeout=15)
    r.raise_for_status()
    mkts = r.json()
    save("lighter-markets", mkts)
    print(f"  GET /markets OK — {len(mkts) if isinstance(mkts, list) else 'obj'} entries")
except Exception as e:
    print(f"  GET /markets FAIL — {e}")
    mkts = None

def lighter_probe(name, mid):
    try:
        ro = requests.get(f"{LIGHTER}/orderBookOrders", params={"market_id": mid, "limit": 5},
                          headers=UA, timeout=15)
        ro.raise_for_status()
        orders = ro.json()
        rt = requests.get(f"{LIGHTER}/recentTrades", params={"market_id": mid, "limit": 3},
                          headers=UA, timeout=15)
        rt.raise_for_status()
        trades = rt.json()
        o_list = orders if isinstance(orders, list) else orders.get("result", orders.get("data", []))
        t_list = trades if isinstance(trades, list) else trades.get("result", trades.get("data", []))
        lighter_ok[name] = {
            "ok": True, "id": mid, "n_orders_sample": len(o_list), "n_trades_sample": len(t_list),
            "order0": o_list[0] if o_list else None, "trade0": t_list[0] if t_list else None,
        }
        o0 = o_list[0] if o_list else {}
        keys = list(o0.keys()) if o0 else []
        print(f"  {name:<10} id={mid:<4} orders={len(o_list):>3} trades={len(t_list):>3} order-keys={keys[:9]}")
        return True
    except Exception as e:
        lighter_ok[name] = {"ok": False, "id": mid, "error": str(e)}
        print(f"  {name:<10} id={mid:<4} FAIL — {e}")
        return False

for nm, mid in CLAIMED.items():
    lighter_probe(nm, mid)
results["lighter"] = lighter_ok
save("lighter-l3-samples", lighter_ok)

# ----------------------------------------------------------------------------
section("3. KRAKEN SPOT FX — public L2 depth (real fiat-to-fiat)")
try:
    r = requests.get("https://api.kraken.com/0/public/Depth",
                     params={"pair": "EURUSD", "count": 25}, headers=UA, timeout=15)
    r.raise_for_status()
    j = r.json()
    if j.get("error"):
        raise RuntimeError(f"api error {j['error']}")
    key = list(j["result"].keys())[0]
    res = j["result"][key]
    bids, asks = res["bids"], res["asks"]
    results["kraken_depth_eurusd"] = {"ok": True, "pair_key": key, "n_bids": len(bids),
                                      "n_asks": len(asks), "best_bid": bids[0], "best_ask": asks[0]}
    save("kraken-depth-eurusd", j)
    print(f"  OK — pair key {key}: {len(bids)} bids / {len(asks)} asks; best bid {bids[0][:2]} best ask {asks[0][:2]}")
except Exception as e:
    results["kraken_depth_eurusd"] = {"ok": False, "error": str(e)}
    print(f"  FAIL — {e}")

# ----------------------------------------------------------------------------
section("4. DUKASCOPY .bi5 — historical tick dump (L1 BBO + vol, FX/metals/indices)")
try:
    # 2026-11-11, hour 06 UTC. month is 0-indexed: Nov = 10
    url = "http://datafeed.dukascopy.com/datafeed/XAUUSD/2026/10/11/06h_ticks.bi5"
    r = requests.get(url, headers=UA, timeout=20)
    r.raise_for_status()
    raw = r.content
    dec = lzma.decompress(raw, format=lzma.FORMAT_ALONE)
    n = len(dec) // 20
    ticks = []
    for i in range(min(n, 5)):
        ms_off, ask_i, bid_i, ask_v, bid_v = struct.unpack_from(">3i2f", dec, i * 20)
        ticks.append({"ms_offset": ms_off, "ask": ask_i / 1000.0, "bid": bid_i / 1000.0,
                      "ask_vol": round(ask_v, 2), "bid_vol": round(bid_v, 2)})
    results["dukascopy_xauusd"] = {"ok": True, "url": url, "bytes": len(raw),
                                   "n_ticks": n, "first_5": ticks}
    print(f"  OK — {len(raw)} bytes LZMA → {n} ticks in 06h UTC window; first: {ticks[0] if ticks else None}")
except Exception as e:
    results["dukascopy_xauusd"] = {"ok": False, "error": str(e)}
    print(f"  FAIL — {e}")

# ----------------------------------------------------------------------------
section("5. BINANCE VISION — historical bulk dumps (futures um, daily)")
for kind in ("trades", "aggTrades", "bookDepth"):
    url = f"https://data.binance.vision/data/futures/um/daily/{kind}/XAUUSDT/XAUUSDT-{kind}-2026-11-10.zip"
    try:
        r = requests.head(url, headers=UA, timeout=15, allow_redirects=True)
        results[f"binance_vision_{kind}"] = {"ok": r.status_code == 200, "status": r.status_code,
                                             "url": url, "content_length": r.headers.get("Content-Length")}
        print(f"  {kind:<10} HTTP {r.status_code} · content-length {r.headers.get('Content-Length')}")
    except Exception as e:
        results[f"binance_vision_{kind}"] = {"ok": False, "error": str(e), "url": url}
        print(f"  {kind:<10} FAIL — {e}")

# ----------------------------------------------------------------------------
section("SUMMARY")
n_ok = sum(1 for k, v in results.items() if isinstance(v, dict) and v.get("ok"))
print(json.dumps({k: ("OK" if v.get("ok") else f"FAIL {str(v.get('error'))[:80]}") for k, v in results.items()}, indent=1))
(OUT / "summary.json").write_text(json.dumps(results, indent=1, default=str)[:200_000])
print(f"\n{n_ok}/{len(results)} probes OK · evidence in scripts/research/probes/l2l3/")
