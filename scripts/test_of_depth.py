#!/usr/bin/env python3
"""Check orderFlow m1 limit cap + per-bar volume for volume-bar sizing."""
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

for lim in (1000, 2000, 2880):
    s, d = get(f"https://capi.coinglass.com/api/orderFlow?symbol=Binance_BTCUSDT%23order_flow&interval=m1&minLimit=false&limit={lim}")
    if isinstance(d, dict) and d.get("code") == "0":
        rows = d.get("data") or []
        # per-bar total volume stats
        vols = []
        for ts, buckets in rows[-200:]:
            v = sum(b[2] + b[3] for b in buckets) if isinstance(buckets, list) else 0
            vols.append(v)
        if vols:
            print(f"limit={lim}: {len(rows)} bars, span {(rows[-1][0]-rows[0][0])/3600:.1f}h, avg vol/bar {sum(vols)/len(vols):.0f} BTC, max {max(vols):.0f}")
        else:
            print(f"limit={lim}: {len(rows)} bars")
    else:
        print(f"limit={lim}: HTTP {s} :: {str(d)[:150]}")
