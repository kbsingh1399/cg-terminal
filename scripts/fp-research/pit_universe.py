#!/usr/bin/env python3
"""
fp-research step 18 — POINT-IN-TIME universe (survivorship fix).

The original universe.json ranked Binance USDT-M perps by 24h quote volume on
2026-11-13 (the day the research started) — i.e. at the END of the 180d
backtest window. A long-biased strategy on that set rides tokens that are
top-20 *because* they pumped during the window (survivorship/lookahead in
universe selection).

This script rebuilds the universe as it was knowable on 2026-05-17 (sample
start): all USDT perps with >= 150d of history as of that date, excluding
TradFi / stable / index products, ranked by quote volume over the first 7
days of the sample window (2026-05-17 .. 2026-05-24). Writes
data/fp-research/universe_pit.json.
"""
import json
import os
import time
import urllib.request
import urllib.error

FAPI = "https://fapi.binance.com"
OUT = "data/fp-research"

MAY17 = 1779004800000            # 2026-05-17 00:00 UTC
WEEK = 7 * 86_400_000
AGE_MIN_DAYS = 150
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
    for attempt in range(6):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "fp-research/1.0"})
            with urllib.request.urlopen(req, timeout=25) as r:
                return json.load(r), r.headers
        except urllib.error.HTTPError as e:
            if e.code in (429, 418):
                wait = int(e.headers.get("Retry-After", "30"))
                print(f"rate-limited, sleeping {wait}s", flush=True)
                time.sleep(wait + 1)
                continue
            raise
        except Exception as e:
            time.sleep(2 ** attempt)
    raise RuntimeError(f"failed {url}")


def main():
    info, _ = get("/fapi/v1/exchangeInfo")
    cands = []
    for s in info["symbols"]:
        if s.get("contractType") != "PERPETUAL" or s.get("status") != "TRADING":
            continue
        if not s["symbol"].endswith("USDT"):
            continue
        base = s["baseAsset"].upper()
        if base in TRADFI or base in STABLES or base in INDEX:
            continue
        onboard = int(s.get("onboardDate", 0))
        age_days_at_may17 = (MAY17 - onboard) / 86_400_000
        if age_days_at_may17 < AGE_MIN_DAYS:
            continue
        cands.append({"symbol": s["symbol"], "onboard": onboard,
                      "age_at_may17": round(age_days_at_may17, 1)})
    print(f"candidates with age>={AGE_MIN_DAYS}d at 2026-05-17: {len(cands)}", flush=True)

    for c in cands:
        try:
            kl, _ = get("/fapi/v1/klines",
                        f"symbol={c['symbol']}&interval=1d&startTime={MAY17}&limit=8")
            qv = sum(float(k[7]) for k in kl if int(k[0]) < MAY17 + WEEK)
            ndays = len([k for k in kl if int(k[0]) < MAY17 + WEEK])
            c["qv_week1"] = round(qv, 0)
            c["days"] = ndays
        except Exception as e:
            c["qv_week1"] = 0.0
            c["days"] = 0
        time.sleep(0.06)

    cands = [c for c in cands if c["days"] >= 5]           # must have traded that week
    cands.sort(key=lambda c: -c["qv_week1"])
    top = cands[:20]
    with open(f"{OUT}/universe_pit.json", "w") as f:
        json.dump(top, f, indent=1)
    print("\nPOINT-IN-TIME top-20 (ranked by 2026-05-17..05-24 quote volume):")
    for i, c in enumerate(top, 1):
        print(f"{i:2d}. {c['symbol']:16s} qv_week1 ${c['qv_week1']/1e6:,.0f}M  age {c['age_at_may17']:.0f}d")
    old = {x["symbol"] for x in json.load(open(f"{OUT}/universe.json"))}
    new = {c["symbol"] for c in top}
    print(f"\nNEW vs old universe: +{sorted(new - old)}  -{sorted(old - new)}")


if __name__ == "__main__":
    main()
