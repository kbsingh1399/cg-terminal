#!/usr/bin/env python3
"""A/B test: does csrf cookie unlock 3-day liq heatmap?"""
import sys, time, urllib.parse, urllib.request, json
sys.path.insert(0, "/home/z/my-project/scripts")
from cg_token import make_obe_token
from cg_client import decrypt_response

def fetch(url, cookie=None):
    now_ms = str(int(time.time() * 1000))
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        "Origin": "https://www.coinglass.com", "Referer": "https://www.coinglass.com/",
        "Accept": "application/json", "encryption": "true", "cache-ts-v2": now_ms,
        "language": "en", "obe": make_obe_token(),
    }
    if cookie:
        headers["Cookie"] = cookie
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req, timeout=30) as r:
        hdrs = dict(r.headers)
        body = r.read().decode()
    return decrypt_response(hdrs, body, now_ms, url)

tok = urllib.parse.quote(make_obe_token())
url = f"https://capi.coinglass.com/api/index/v2/liqHeatMap?merge=true&symbol=Binance_BTCUSDT&interval=15&limit=288&data={tok}"
cookie = "_ga=GA1.1.551547175.1794235102; csrf_token=3f23caf0-4173-467a-a45c-c7020cbefe3d; sajssdk_2015_cross_new_user=1"

for label, ck in [("with cookies", cookie), ("no cookies", None)]:
    out = fetch(url, ck)
    ok = isinstance(out, dict) and "liq" in out
    if ok:
        print(f"{label}: liq={len(out['liq'])} prices={len(out['prices'])} y={len(out['y'])} sum={round(sum(x[2] for x in out['liq'])/1e9,2)}B")
    else:
        print(f"{label}: {json.dumps(out)[:120]}")
