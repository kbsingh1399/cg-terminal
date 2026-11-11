#!/usr/bin/env python3
"""Phase 3 — full perp-engine surface for confirmed winners + missing-grammar retry.

(a) retry WTI/US30/EU-indices/HK50/AUS200/USDJPY/AUDUSD/DXY with more grammars
(b) for winners: #oi_kline, liquidationLevels/v2, largeTakerOrder/v3,
    order_flow, fundingRate — the surface the 8-dim engine needs
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

def kline_alive(key):
    p = f"/api/v2/kline?symbol={urllib.parse.quote(key + '#kline')}&interval=15m&minLimit=false&limit=2"
    s, data, err = get(FAPI, p)
    if s == 200 and isinstance(data, list) and data:
        last = data[-1]
        return {"key": key, "close": last[4] if len(last) > 4 else None, "vol": last[5] if len(last) > 5 else None}
    return None

print("=== (a) missing-symbol grammar retry ===")
RETRY = {
    "WTI/USOIL": ["USOIL", "WTI", "OIL", "WTIOIL", "USO", "CRUDE"],
    "US30": ["US30", "DJ30", "DOW", "DJI", "DJ"],
    "RUSSELL": ["US2000", "RUSSELL", "RUSSELL2000", "RTY"],
    "VIX": ["VIX", "VOL"],
    "DAX": ["GER30", "DAX", "GER40"],
    "FTSE": ["UK100", "FTSE"],
    "CAC": ["FRA40", "CAC", "CAC40"],
    "EUSTX": ["EUSTX50", "STOXX50", "ESTX50"],
    "HK": ["HK50", "HSI", "HK"],
    "AUS": ["AUS200", "ASX", "ASX200"],
    "JPY": ["USDJPY", "JPY"],
    "AUD": ["AUDUSD", "AUD"],
    "DXY": ["DXY", "USDX"],
}
found = {}
for label, syms in RETRY.items():
    for sym in syms:
        for venue, key in [("tradeXYZ", f"tradeXYZ_{sym}-USD"), ("Bitget", f"Bitget_{sym}USDT_UMCBL"),
                           ("Binance", f"Binance_{sym}USDT"), ("OKX", f"OKX_{sym}-USDT-SWAP"), ("Bybit", f"Bybit_{sym}USDT")]:
            r = kline_alive(key)
            if r and r["close"] and float(r["close"] or 0) > 0.0001:
                print(f"  {label:<10} {key:<34} close={r['close']} vol={r['vol']}")
                found.setdefault(label, []).append({"venue": venue, **r})
            time.sleep(0.3)

print("\n=== (b) full engine surface for winners ===")
WINNERS = {
    "SP500": "tradeXYZ_SP500-USD",
    "NDX100": "Bitget_NDX100USDT_UMCBL",
    "JP225": "tradeXYZ_JP225-USD",
    "HSI": "Bitget_HSIUSDT_UMCBL",
    "BRENTOIL": "tradeXYZ_BRENTOIL-USD",
    "NATGAS": "Binance_NATGASUSDT",
    "EURUSD": "Bybit_EURUSDUSDT",
    "GOLD": "tradeXYZ_GOLD-USD",
}
surface = {}
for sym, key in WINNERS.items():
    print(f"-- {sym} ({key})")
    res = {}
    # OI kline
    p = f"/api/v2/kline?symbol={urllib.parse.quote(key + '#oi_kline')}&interval=15m&minLimit=false&limit=2"
    s, data, err = get(FAPI, p)
    res["oi_kline"] = {"status": s, "ok": isinstance(data, list) and len(data) > 0, "last": (data[-1] if isinstance(data, list) and data else None)}
    time.sleep(0.3)
    # liquidation levels
    p = f"/api/liquidationLevels/v2?symbol={urllib.parse.quote(key)}&limit=20&range=3d"
    s, data, err = get(CAPI, p)
    ll_ok = isinstance(data, list) and len(data) > 0
    res["liq_levels"] = {"status": s, "ok": ll_ok, "n": (len(data) if isinstance(data, list) else 0)}
    time.sleep(0.3)
    # large taker orders
    p = f"/api/largeTakerOrder/v3?exchange=tradeXYZ&symbol={urllib.parse.quote(key)}&market=all&limit=5&minVolUsd=100000"
    s, data, err = get(FAPI, p)
    res["lto"] = {"status": s, "type": type(data).__name__, "ok": data is not None}
    time.sleep(0.3)
    # order flow
    p = f"/api/orderFlow?symbol={urllib.parse.quote(key + '#order_flow')}&interval=15m&minLimit=false&limit=2"
    s, data, err = get(FAPI, p)
    res["order_flow"] = {"status": s, "ok": isinstance(data, list) and len(data) > 0}
    time.sleep(0.3)
    # funding chart
    p = f"/api/fundingRate/v2/chart?symbol={urllib.parse.quote(key)}&size=2"
    s, data, err = get(CAPI, p)
    res["funding_chart"] = {"status": s, "ok": data is not None, "type": type(data).__name__}
    time.sleep(0.3)
    surface[sym] = {"key": key, **res}
    for k, v in res.items():
        mark = "OK " if v.get("ok") else "MISS"
        extra = f" {str(v.get('last'))[:60]}" if v.get("last") else ""
        print(f"   [{mark}] {k}: {v}{''.join([]) }{extra[:80]}")

out = {"retry_found": found, "surface": surface}
json.dump(out, open("scripts/research/cg-engine-surface.json", "w"), indent=1, default=str)
print("\nwrote scripts/research/cg-engine-surface.json")
