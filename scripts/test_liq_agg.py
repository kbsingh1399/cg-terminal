#!/usr/bin/env python3
"""Probe liquidationLevels API for the aggregated symbol variant."""
import importlib.util, json, sys

spec = importlib.util.spec_from_file_location('cgc', '/home/z/my-project/scripts/cg_client.py')
m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)

candidates = [
    "BTC",
    "Aggregated_BTC",
    "BTC_Aggregated",
    "Aggregate_BTC",
    "ALL_BTC",
    "Binance_BTCUSDT",
]

for sym in candidates:
    url = f"https://capi.coinglass.com/api/liquidationLevels/v2?symbol={sym}&limit=5&range=3d"
    try:
        status, headers, body = m.cg_get(url)
        data = m.decrypt_response(headers, body, str(int(__import__('time').time()*1000)), url) if status == 200 else body
        if isinstance(data, dict):
            code = data.get("code"); msg = data.get("msg"); d = data.get("data")
            if isinstance(d, str):
                d = m.decrypt_response(headers, json.dumps({"data": d}), str(int(__import__('time').time()*1000)), url)
            rows = d if isinstance(d, list) else (d or {})
            print(f"[{sym}] HTTP {status} code={code} msg={msg} rows={len(rows) if isinstance(rows, list) else type(rows).__name__}")
            if isinstance(rows, list) and rows:
                print("   sample:", json.dumps(rows[0])[:300])
        else:
            print(f"[{sym}] HTTP {status} body[:200]={str(body)[:200]}")
    except Exception as e:
        print(f"[{sym}] ERROR {e}")
