#!/usr/bin/env python3
"""Phase 2 — venue-key verification for classic perp symbols (2026-11-11).
For each candidate symbol, try the known venue grammars against /api/v2/kline
(price series, limit=2). A 200 + bars = the instrument key is LIVE.
Then for the winners, probe #oi_kline + liquidationLevels + largeTakerOrder
(the full perp-engine surface).
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

def get(host, path):
    url = f"{host}{path}"
    status, headers, text = cgc.cg_get(url)
    H = {k.lower(): v for k, v in headers.items()}
    try:
        j = json.loads(text)
    except Exception:
        return status, None, text[:100]
    if j.get("code") not in ("0", 0) and j.get("success") is not True:
        return status, None, (j.get("msg") or j.get("message") or "")[:80]
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

def keygrammars(sym):
    return [
        ("tradeXYZ", f"tradeXYZ_{sym}-USD"),
        ("Bitget", f"Bitget_{sym}USDT_UMCBL"),
        ("Binance", f"Binance_{sym}USDT"),
        ("OKX", f"OKX_{sym}-USDT-SWAP"),
        ("Bybit", f"Bybit_{sym}USDT"),
    ]

# classic symbols to test (desk naming -> candidate coinglass names)
CANDIDATES = ["SP500", "SPX", "NDX", "NDX100", "NASDAQ100", "US30", "DJ30", "US2000",
              "RUSSELL", "VIX", "GER30", "DAX", "UK100", "FTSE", "FRA40", "CAC40",
              "EUSTX50", "JP225", "NIKKEI", "HK50", "HSI", "AUS200", "ASX200",
              "GOLD", "SILVER", "PLATINUM", "USOIL", "WTIOIL", "UKOIL", "BRENTOIL",
              "NATGAS", "EURUSD", "EUR", "GBPUSD", "DXY", "US10Y", "US30Y"]

results = {}
print(f"{'sym':<10} venue-key verdict")
for sym in CANDIDATES:
    for venue, key in keygrammars(sym):
        p = f"/api/v2/kline?symbol={urllib.parse.quote(key + '#kline')}&interval=15m&minLimit=false&limit=2"
        s, data, err = get(FAPI, p)
        ok = s == 200 and isinstance(data, list) and len(data) >= 1
        if ok:
            last = data[-1]
            close = last[4] if len(last) > 4 else "?"
            vol = last[5] if len(last) > 5 else "?"
            print(f"  {sym:<10} {key:<32} LIVE  close={close} vol={vol}")
            results.setdefault(sym, []).append({"venue": venue, "key": key, "close": close, "vol": vol})
        time.sleep(0.35)
    if sym not in results:
        pass  # silent for misses to keep output readable

print(f"\n=== {len(results)} symbols with live perp keys ===")
for sym, rs in results.items():
    print(f"{sym}: {', '.join(r['venue'] for r in rs)}")

Path("scripts/research").mkdir(exist_ok=True)
json.dump(results, open("scripts/research/cg-classic-perp-keys.json", "w"), indent=1)
print("\nwrote scripts/research/cg-classic-perp-keys.json")
