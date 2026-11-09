#!/usr/bin/env python3
"""Probe orderFlow endpoint for volume-bar / range-bar interval modes."""
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

base = "https://capi.coinglass.com/api/orderFlow?symbol=Binance_BTCUSDT%23order_flow&minLimit=false&limit=5"
variants = [
    "&interval=m15",
    "&interval=volume_2500",
    "&interval=vol2500",
    "&interval=V2500",
    "&interval=range_200",
    "&interval=renko200",
    "&interval=R200",
]
for v in variants:
    s, d = get(base + v)
    txt = json.dumps(d)[:250] if not isinstance(d, str) else d[:250]
    print(f"[{v}] HTTP {s} :: {txt}")
    print()
