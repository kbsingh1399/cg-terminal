#!/usr/bin/env python3
"""Probe the heatmap aggregate NDJSON stream, #bs_usd kline flows, and liqHeatMap stops endpoints."""
import json, sys, time
sys.path.insert(0, "/home/z/my-project/scripts")
from cg_client import cg_get, decrypt_response

def probe(name, url, headers_extra=None, max_lines=6):
    print(f"\n===== {name} =====\n{url[:160]}")
    cache_ts = str(int(time.time() * 1000))
    status, hdrs, body = cg_get(url, headers_extra)
    print(f"HTTP {status}; content-type={hdrs.get('Content-Type','?')}; len={len(body)}")
    if status != 200:
        print(body[:300])
        return
    ct = hdrs.get("Content-Type", "")
    if "ndjson" in ct:
        lines = body.splitlines()
        print(f"NDJSON {len(lines)} lines")
        for ln in lines[:max_lines]:
            print(ln[:260])
    else:
        try:
            out = decrypt_response(hdrs, body, cache_ts, url)
            s = json.dumps(out)
            print(s[:900])
        except Exception as e:
            print("decrypt fail:", repr(e), body[:200])

now = int(time.time())
probe("AGG HEATMAP STREAM (futures)",
      f"https://capi.coinglass.com/liquidity-heatmap/api/liquidity/heatmap/aggregate/stream?coin=BTC&exchanges=Binance,OKX,Gate,Bitget,Hyperliquid&market=futures&interval=m15&limit=6&batchSize=10&endTime={now}")
probe("BS_USD flow (Binance perp)",
      "https://capi.coinglass.com/api/v2/kline?symbol=Binance_BTCUSDT%23bs_usd&interval=m15&limit=3&minLimit=false")
probe("LIQ HEATMAP v6",
      f"https://capi.coinglass.com/api/index/v6/liqHeatMap?symbol=BTC&interval=1h&limit=3&endTime={now}")
