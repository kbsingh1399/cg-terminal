#!/usr/bin/env python3
"""Scan Binance for the top most-liquid crypto assets (spot + futures) and
emit a ranked table: price, 24h %, OI, 24h vol, funding, market cap.

Ranked primarily by 24h quote volume (liquidity = easy trade finding),
with market-cap context. Excludes stablecoin pairs and leveraged tokens.

Usage: python3 scripts/top_assets_scan.py [N]   (default N=40)
"""
import json
import sys
import time
import urllib.request

N = int(sys.argv[1]) if len(sys.argv) > 1 else 40

SPOT_TICKER = "https://api.binance.com/api/v3/ticker/24hr"
FAPI_TICKER = "https://fapi.binance.com/fapi/v1/ticker/24hr"
FAPI_PREMIUM = "https://fapi.binance.com/fapi/v1/premiumIndex"
FAPI_OI = "https://fapi.binance.com/fapi/v1/openInterest?symbol={}"
CG_MARKETS = ("https://api.coingecko.com/api/v3/coins/markets"
              "?vs_currency=usd&order=market_cap_desc&per_page=250&page=1")

STABLES = {"USDC", "FDUSD", "TUSD", "DAI", "BUSD", "USDP", "EUR", "AEUR",
           "USD1", "XUSD", "EURI", "PYUSD", "USDE", "BFUSD"}
LEVERAGED_SUFFIXES = ("UP", "DOWN", "BULL", "BEAR")


def get(url, retries=3):
    for i in range(retries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "cg-terminal-scan/1.0"})
            with urllib.request.urlopen(req, timeout=20) as r:
                return json.loads(r.read().decode())
        except Exception as e:  # noqa: BLE001
            if i == retries - 1:
                print(f"WARN: failed {url}: {e}", file=sys.stderr)
                return None
            time.sleep(1.5 * (i + 1))
    return None


def fmt_usd(v):
    if v is None:
        return "—"
    a = abs(v)
    if a >= 1e12:
        return f"${v/1e12:.2f}T"
    if a >= 1e9:
        return f"${v/1e9:.2f}B"
    if a >= 1e6:
        return f"${v/1e6:.1f}M"
    return f"${v:,.2f}"


def fmt_price(p):
    if p is None:
        return "—"
    if p >= 1000:
        return f"${p:,.2f}"
    if p >= 1:
        return f"${p:,.3f}"
    return f"${p:.6f}"


def main():
    spot = get(SPOT_TICKER)
    fut = get(FAPI_TICKER) or []
    prem = get(FAPI_PREMIUM) or []
    if not spot:
        print("FATAL: cannot reach Binance spot API", file=sys.stderr)
        sys.exit(1)

    fut_by_sym = {t["symbol"]: t for t in fut}
    fund_by_sym = {p["symbol"]: p for p in prem}

    # filter: USDT pairs, not stable-stable, not leveraged tokens
    rows = []
    for t in spot:
        s = t["symbol"]
        if not s.endswith("USDT"):
            continue
        base = s[:-4]
        if base in STABLES:
            continue
        if base.endswith(LEVERAGED_SUFFIXES) and len(base) > 4:
            continue
        if s in ("USDTTRY",):
            continue
        try:
            qv = float(t["quoteVolume"])
        except (KeyError, ValueError):
            continue
        rows.append({"sym": s, "base": base, "qv": qv, "t": t})

    rows.sort(key=lambda r: r["qv"], reverse=True)
    top = rows[:N]

    # market caps from CoinGecko (best effort)
    mcap = {}
    cg = get(CG_MARKETS)
    if cg:
        for c in cg:
            u = (c.get("symbol") or "").upper()
            if c.get("market_cap"):
                mcap[u] = max(mcap.get(u, 0), c["market_cap"])

    # OI per symbol (futures only, needs per-symbol call)
    for r in top:
        f = fut_by_sym.get(r["sym"])
        p = fund_by_sym.get(r["sym"])
        r["perp"] = f is not None
        r["fut_qv"] = float(f["quoteVolume"]) if f else None
        r["funding"] = (float(p["lastFundingRate"]) * 100) if p else None
        r["oi"] = None
        if f:
            oi_raw = get(FAPI_OI.format(r["sym"]))
            if oi_raw:
                try:
                    r["oi"] = float(oi_raw["openInterest"]) * float(t_price(f, r["sym"]))
                except (KeyError, ValueError, TypeError):
                    r["oi"] = None

    out = []
    for i, r in enumerate(top, 1):
        t = r["t"]
        price = float(t["lastPrice"])
        chg = float(t["priceChangePercent"])
        out.append({
            "rank": i,
            "ticker": r["base"],
            "symbol": r["sym"],
            "price": price,
            "chg24h": chg,
            "oi_usd": r["oi"],
            "vol24h_usd_spot": r["qv"],
            "vol24h_usd_perp": r["fut_qv"],
            "funding_pct": r["funding"],
            "mcap_usd": mcap.get(r["base"]),
            "perp": r["perp"],
            "trades24h": int(float(t["count"])),
        })

    with open("/home/z/my-project/download/top_assets_binance.json", "w") as f:
        json.dump({"generatedAt": time.strftime("%Y-%m-%d %H:%M:%S %Z"),
                   "assets": out}, f, indent=2)

    # console table
    hdr = (f"{'#':>3} {'Ticker':<10} {'Price':>12} {'24h%':>8} {'OI':>10} "
           f"{'SpotVol':>10} {'PerpVol':>10} {'Fund%':>9} {'Mcap':>10} {'Perp':>4}")
    print(hdr)
    print("-" * len(hdr))
    for a in out:
        fund = f"{a['funding_pct']:+.4f}%" if a["funding_pct"] is not None else "—"
        print(f"{a['rank']:>3} {a['ticker']:<10} {fmt_price(a['price']):>12} "
              f"{a['chg24h']:>+7.2f}% {fmt_usd(a['oi_usd']):>10} "
              f"{fmt_usd(a['vol24h_usd_spot']):>10} {fmt_usd(a['vol24h_usd_perp']):>10} "
              f"{fund:>9} "
              f"{fmt_usd(a['mcap_usd']):>10} {'Y' if a['perp'] else 'N':>4}")
    print(f"\nSaved JSON -> download/top_assets_binance.json ({len(out)} assets)")


def t_price(f, sym):
    return f["lastPrice"]


if __name__ == "__main__":
    main()
