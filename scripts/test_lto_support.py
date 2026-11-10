#!/usr/bin/env python3
"""Check largeTakerOrder support list + spot/perp instruments (fapi)."""
import importlib.util, json, time

spec = importlib.util.spec_from_file_location('cgc', '/home/z/my-project/scripts/cg_client.py')
m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)

def get(url, host="https://fapi.coinglass.com"):
    try:
        status, headers, body = m.cg_get(url)
        ts = str(int(time.time() * 1000))
        data = m.decrypt_response(headers, body, ts, url) if status == 200 else None
        return status, data if data is not None else body
    except Exception as e:
        return 0, str(e)

s, d = get("https://fapi.coinglass.com/api/largeTakerOrder/support/v3?symbol=BTC")
print("HTTP", s)
fut = d.get("futures", []) if isinstance(d, dict) else []
spot = d.get("spot", []) if isinstance(d, dict) else []
print(f"futures exchanges ({len(fut)}):", [x.get("exchange") for x in fut])
print(f"spot exchanges ({len(spot)}):", [x.get("exchange") for x in spot])
print()
for x in fut:
    print("FUT", x.get("exchange"), "instruments:", x.get("instruments"))
for x in spot:
    print("SPOT", x.get("exchange"), "instruments:", x.get("instruments"))
