#!/usr/bin/env python3
"""Coinglass index/commodity/FX perp probe (user screenshot 2026-11-11:
coinglass.com search shows tradeXYZ SP500-USD $463M vol + Bitget SP500USDT).
Goal: enumerate which CLASSIC instruments have real perp venues on Coinglass,
so they can be upgraded from Tier-3 (quotes-only) to the full perp engine
(funding/OI/liquidations/CVD/walls).

Probes:
 1. search endpoints (find instrument ids for sp500, nasdaq, gold, oil, eur...)
 2. kline endpoint with tradeXYZ_/Bitget_ instrument keys (price series sanity)
 3. open-interest / funding endpoints for the same keys
"""
import json, sys, time
sys.path.insert(0, "scripts")
import importlib.util
from pathlib import Path

spec = importlib.util.spec_from_file_location('cgc', 'scripts/cg_client.py')
cgc = importlib.util.module_from_spec(spec)
sys.modules['cgc'] = cgc
try:
    spec.loader.exec_module(cgc)
except Exception as e:
    print("IMPORT-ERR", e); sys.exit(1)

def decrypt_body(status, headers, text):
    """Run the cg_client decrypt chain on a response."""
    try:
        hdr_user = headers.get("user") or headers.get("User")
        enc = headers.get("encryption")
        v = headers.get("v")
        if not enc or enc != "1" or not hdr_user:
            return ("plain", text[:400])
        cache_ts = headers.get("cache-ts-v2", "")
        time_hdr = headers.get("time")
        keyA = cgc.derive_key_a(v, cache_ts, time_hdr, "")
        keyB = cgc.try_inflate(cgc.aes_ecb_decrypt(cgc.strip_quotes(hdr_user), keyA))
        payload = cgc.try_inflate(cgc.aes_ecb_decrypt(cgc.strip_quotes(json.loads(text).get("data", "")), keyB.strip()))
        return ("enc", payload.decode("utf-8", "replace")[:2000])
    except Exception as e:
        return ("decrypt-err", f"{e} :: raw={text[:200]}")

SEARCH_PATHS = [
    "/api/search/searchList?keyword={kw}&type=0",
    "/api/search?keyword={kw}",
    "/api/futures/searchList?keyword={kw}",
    "/api/search/search?keyword={kw}",
]

def probe(path):
    url = f"https://capi.coinglass.com{path}"
    status, headers, text = cgc.cg_get(url)
    return status, headers, text

print("=== 1. SEARCH ENDPOINT DISCOVERY (kw=sp500) ===")
for p in SEARCH_PATHS:
    status, headers, text = probe(p.format(kw="sp500"))
    mode, body = decrypt_body(status, headers, text)
    print(f"[{status}] {p} -> {mode}: {body[:300]}")
    time.sleep(0.4)

print()
print("=== 2. INSTRUMENT KEYS — kline sanity (m15, limit=3) ===")
KEYS = [
    "tradeXYZ_SP500-USD",
    "Bitget_SP500USDT_UMCBL",
    "tradeXYZ_NDX-USD",
    "Bitget_NDXUSDT_UMCBL",
    "tradeXYZ_US30-USD",
    "tradeXYZ_GOLD-USD",
    "tradeXYZ_OIL-USD",
    "Bitget_XAUUSDT_UMCBL",
    "Bitget_CLUSDT_UMCBL",
]
for k in KEYS:
    p = f"/api/kline/index?instrument={k}&interval=15m&size=3"
    status, headers, text = probe(p)
    mode, body = decrypt_body(status, headers, text)
    print(f"[{status}] {k}: {mode}: {body[:220]}")
    time.sleep(0.4)
