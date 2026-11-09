#!/usr/bin/env python3
"""Probe instrument lists + liquidation level endpoints used by the LL page."""
import importlib.util, json, time

spec = importlib.util.spec_from_file_location('cgc', '/home/z/my-project/scripts/cg_client.py')
m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)

def get(url):
    try:
        status, headers, body = m.cg_get(url)
        ts = str(int(time.time() * 1000))
        data = m.decrypt_response(headers, body, ts, url) if status == 200 else None
        return status, data if data is not None else body
    except Exception as e:
        return 0, str(e)

urls = [
    # possible instrument-list endpoints
    "https://capi.coinglass.com/api/liquidationLevels/instrument",
    "https://capi.coinglass.com/api/liquidationLevels/v2/instrument",
    "https://capi.coinglass.com/api/liquidationLevels/instruments",
    "https://capi.coinglass.com/api/liquidationLevels/symbol/list",
    "https://capi.coinglass.com/api/liquidationLevels/v2/symbols?symbol=BTC",
    # how the page might request aggregated
    "https://capi.coinglass.com/api/liquidationLevels/v2?symbol=OKX_BTC-USDT-SWAP&limit=3&range=3d",
    "https://capi.coinglass.com/api/liquidationLevels/v2?symbol=Bybit_BTCUSDT&limit=3&range=3d",
    "https://capi.coinglass.com/api/liquidationLevels/v2?symbol=Hyperliquid_BTC-USD&limit=3&range=3d",
]
for u in urls:
    s, d = get(u)
    txt = json.dumps(d)[:400] if not isinstance(d, str) else d[:400]
    print(f"== {u.split('.com')[1][:80]}\n   HTTP {s} :: {txt}\n")
