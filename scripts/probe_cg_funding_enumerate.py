#!/usr/bin/env python3
"""Coinglass perp-venue enumeration for the classic universe (2026-11-11).

The user's screenshot showed coinglass.com search listing tradeXYZ SP500-USD
($463M vol) + Bitget SP500USDT. Verified: /api/v2/kline decrypts fine for
those keys. This probe enumerates the AUTHORITATIVE instrument list from
/api/fundingRate/v2/home (every symbol with funding data = a real perp
market) and cross-matches our 83 classic instruments, then sanity-pulls
kline + OI + liquidation endpoints for each match.

Output: scripts/research/cg-classic-perp-coverage.json + readable matrix.
"""
import json, sys, time, urllib.parse
sys.path.insert(0, "scripts")
import importlib.util
from pathlib import Path

spec = importlib.util.spec_from_file_location('cgc', 'scripts/cg_client.py')
cgc = importlib.util.module_from_spec(spec)
sys.modules['cgc'] = cgc
spec.loader.exec_module(cgc)

FAPI = "https://fapi.coinglass.com"
CAPI = "https://capi.coinglass.com"

def get(host, path, ttl=0.5):
    url = f"{host}{path}"
    status, headers, text = cgc.cg_get(url)
    H = {k.lower(): v for k, v in headers.items()}
    try:
        j = json.loads(text)
    except Exception:
        return status, None, text[:200]
    if j.get("code") not in ("0", 0) and j.get("success") is not True:
        return status, None, f'{j.get("msg") or j.get("message")} raw={text[:120]}'
    data = j.get("data")
    if isinstance(data, str):
        try:
            keyA = cgc.derive_key_a(H.get("v", "0"), H.get("cache-ts-v2", ""), H.get("time"), url)
            keyB = cgc.try_inflate(cgc.aes_ecb_decrypt(cgc.strip_quotes(H["user"]), keyA)).strip()
            payload = cgc.try_inflate(cgc.aes_ecb_decrypt(cgc.strip_quotes(data), keyB))
            return status, json.loads(payload), None
        except Exception as e:
            return status, None, f"dec-err {e}"
    return status, data, None

OUT = {"ts": int(time.time() * 1000), "funding_syms": {}, "probes": {}}

print("=== 1. fundingRate/v2/home enumeration ===")
status, data, err = get(CAPI, "/api/fundingRate/v2/home")
if err or not isinstance(data, list):
    print("funding home failed:", status, err)
    sys.exit(1)
print(f"total funding symbols: {len(data)}")
if data:
    print("sample keys:", list(data[0].keys())[:20])

# candidate classic terms to search in symbol names
TERMS = ["SP500", "SPX", "S&P", "NDX", "NASDAQ", "US30", "DOW", "DJ", "US2000",
         "RUSSELL", "VIX", "GER30", "DAX", "UK100", "FTSE", "FRA40", "CAC",
         "EUSTX", "STOXX", "SWI20", "SMI", "NTH25", "AEX", "JP225", "NIKKEI",
         "HK50", "HSI", "AUS200", "ASX", "GOLD", "XAU", "SILVER", "XAG",
         "PLAT", "XPT", "OIL", "WTI", "CRUDE", "BRENT", "UKO", "CL", "NATGAS",
         "EURUSD", "EUR-USD", "GBPUSD", "USDJPY", "AUDUSD", "USDCAD", "DXY",
         "EURUSDT", "GBPUSDT", "JPYUSDT", "AUDUSDT"]
hits = []
for item in data:
    sym = str(item.get("symbol") or "")
    name = str(item.get("symbolName") or item.get("name") or "")
    ex = str(item.get("exchangeName") or item.get("exchange") or "")
    hay = f"{sym} {name}".upper()
    for t in TERMS:
        if t.upper().replace("-", "") in hay.replace("-", "").replace("&", "").replace(" ", "") or t.upper() in hay:
            hits.append({"symbol": sym, "name": name, "exchange": ex,
                         "price": item.get("price"), "vol24h": item.get("vol24h") or item.get("volume24h"),
                         "oi": item.get("oi") or item.get("openInterest"), "funding": item.get("fundingRate") or item.get("predictedRate")})
            break
print(f"\nclassic-term hits in funding list: {len(hits)}")
for h in hits[:60]:
    print(f"  {h['exchange']:>10}  {h['symbol']:<22} {str(h['name'])[:28]:<28} price={h['price']} vol24h={h['vol24h']} oi={h['oi']} fr={h['funding']}")
OUT["funding_syms"] = {"total": len(data), "hits": hits}

Path("scripts/research").mkdir(exist_ok=True)
json.dump(OUT, open("scripts/research/cg-classic-perp-coverage.json", "w"), indent=1)
print("\nwrote scripts/research/cg-classic-perp-coverage.json (phase 1)")
