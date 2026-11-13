#!/usr/bin/env python3
"""
fp-research step 1 — pick the top-20 crypto USDT-perp universe.

Ranks Binance USDT-M perpetuals by 24h quote volume, excludes:
  - TradFi / equity / index / commodity perps (from the repo's curated set)
  - stablecoin bases and index products (BTCDOM etc.)
  - symbols with < MIN_DAYS of m15 history (new listings)
Prints the final 20 and writes data/fp-research/universe.json.
"""
import json
import os
import time
import urllib.request

FAPI = "https://fapi.binance.com"
OUT = "data/fp-research"
MIN_DAYS = 150

TRADFI = {
    "XAU", "XAG", "XPT", "NVDA", "SNDK", "SOXL", "SPCX", "GOOGL", "MU", "SKHY",
    "INTC", "CRCL", "MSTR", "QQQ", "AAPL", "TSLA", "DRAM", "KORU", "META",
    "NBIS", "MSFT", "AMZN", "AMD", "COIN", "NFLX", "AVGO", "TSM", "SPX500",
    "NDX100", "DJ30", "GER40", "UK100", "JP225", "SP500", "US30", "NAS100",
}
STABLES = {"USDC", "FDUSD", "TUSD", "DAI", "USDP", "EURI", "EUR", "AEUR", "USD1", "BUSD", "PAXG"}
INDEX = {"BTCDOM", "DEFI"}


def get(path, params=""):
    url = f"{FAPI}{path}" + (f"?{params}" if params else "")
    for attempt in range(5):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "fp-research/1.0"})
            with urllib.request.urlopen(req, timeout=20) as r:
                return json.load(r), r.headers
        except Exception as e:
            wait = 2 ** attempt
            print(f"  retry {url[:60]} after {e} ({wait}s)")
            time.sleep(wait)
    raise RuntimeError(f"failed {url}")


def main():
    os.makedirs(OUT, exist_ok=True)
    info, _ = get("/fapi/v1/exchangeInfo")
    perps = {
        s["baseAsset"]: s["symbol"]
        for s in info["symbols"]
        if s["contractType"] == "PERPETUAL"
        and s["quoteAsset"] == "USDT"
        and s["status"] == "TRADING"
    }
    print(f"USDT perps trading: {len(perps)}")

    tick, hdrs = get("/fapi/v1/ticker/24hr")
    print(f"used weight: {hdrs.get('X-MBX-USED-WEIGHT-1M')}")
    rows = []
    for t in tick:
        sym = t["symbol"]
        if not sym.endswith("USDT"):
            continue
        base = sym[: -len("USDT")]
        if base in TRADFI or base in STABLES or base in INDEX:
            continue
        if sym not in perps.values():
            continue
        rows.append((sym, float(t["quoteVolume"])))
    rows.sort(key=lambda x: -x[1])

    # history check: first m15 openTime → listing age
    now_ms = int(time.time() * 1000)
    final = []
    for sym, qv in rows:
        if len(final) >= 20:
            break
        kl, _ = get("/fapi/v1/klines", f"symbol={sym}&interval=15m&startTime=0&limit=2")
        if not kl:
            print(f"  skip {sym}: no klines")
            continue
        age_days = (now_ms - kl[0][0]) / 86_400_000
        if age_days < MIN_DAYS:
            print(f"  skip {sym}: listed {age_days:.0f}d ago (<{MIN_DAYS}d)")
            continue
        final.append({"symbol": sym, "qvol24h": qv, "ageDays": round(age_days, 1)})
        print(f"  keep {sym}: 24h qvol ${qv/1e6:,.0f}M · listed {age_days:.0f}d")

    print(f"\nUniverse ({len(final)}):")
    print(" ".join(x["symbol"] for x in final))
    with open(f"{OUT}/universe.json", "w") as f:
        json.dump(final, f, indent=1)
    print(f"wrote {OUT}/universe.json")


if __name__ == "__main__":
    main()
