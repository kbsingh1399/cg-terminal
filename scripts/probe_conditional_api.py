#!/usr/bin/env python3
"""Probe the Binance futures TESTNET for the working conditional-order endpoint.

/fapi/v1/order rejects STOP_MARKET with 'use the Algo Order API endpoints
instead' — Binance migrated conditional/trigger orders. Candidates:
  POST /fapi/v1/conditional/order        (strategyType=STOP_MARKET ...)
  POST /fapi/v1/algoFutures/newOrder     (same shape)
"""
import hashlib
import hmac
import json
import os
import sys
import time
import urllib.request

BASE = "https://testnet.binancefuture.com"


def creds():
    key = os.environ.get("BINANCE_API_KEY")
    sec = os.environ.get("BINANCE_API_SECRET")
    if not key or not sec:
        env = {}
        with open("/home/z/my-project/.env") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, v = line.split("=", 1)
                    env[k.strip()] = v.strip()
        key = key or env.get("BINANCE_API_KEY")
        sec = sec or env.get("BINANCE_API_SECRET")
    return key, sec


KEY, SEC = creds()


def signed_req(method, path, params):
    q = {k: str(v) for k, v in params.items()}
    q["recvWindow"] = "5000"
    q["timestamp"] = str(int(time.time() * 1000))
    qs = "&".join(f"{k}={v}" for k, v in q.items())
    sig = hmac.new(SEC.encode(), qs.encode(), hashlib.sha256).hexdigest()
    qs += f"&signature={sig}"
    url = f"{BASE}{path}?{qs}"
    req = urllib.request.Request(url, method=method, headers={"X-MBX-APIKEY": KEY, "accept": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=10) as r:
            return r.status, json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        body = e.read().decode()[:300]
        try:
            body = json.loads(body)
        except Exception:
            pass
        return e.code, body
    except Exception as e:  # noqa: BLE001
        return -1, str(e)


# current ETH price to build sane triggers
st, px = signed_req("GET", "/fapi/v1/ticker/price", {"symbol": "ETHUSDT"})
# note: public endpoint, signature harmless
eth = float(px.get("price", 2000)) if st == 200 else 2000.0
sl = round(eth * 0.99, 2)
print(f"ETH last={eth}  testing SL trigger={sl}")

# small real position first so conditional closePosition has something to close
st1, r1 = signed_req("POST", "/fapi/v1/order", {
    "symbol": "ETHUSDT", "side": "BUY", "type": "MARKET", "quantity": 0.01,
})
print("MARKET entry 0.01 ETH:", st1, json.dumps(r1)[:200])

candidates = [
    ("/fapi/v1/conditional/order", {"strategyType": "STOP_MARKET"}),
    ("/fapi/v1/conditional/order", {"strategyType": "STOP_MARKET", "workingType": "MARK_PRICE"}),
    ("/fapi/v1/algoFutures/newOrder", {"strategyType": "STOP_MARKET"}),
    ("/fapi/v1/algo/futures/newOrderConditional", {"strategyType": "STOP_MARKET"}),
]
for path, extra in candidates:
    params = {
        "symbol": "ETHUSDT", "side": "SELL", "stopPrice": sl,
    }
    params.update(extra)
    st, r = signed_req("POST", path, params)
    print(f"POST {path} {extra.get('strategyType')}: {st} {json.dumps(r)[:260]}")
    if st == 200:
        print("WINNER:", path)
        break

# cleanup: cancel everything on ETHUSDT (both engines)
print("cancelAll /fapi/v1/allOpenOrders:", signed_req("DELETE", "/fapi/v1/allOpenOrders", {"symbol": "ETHUSDT"})[0])
print("cancelAll conditional:", signed_req("DELETE", "/fapi/v1/conditional/allOpenOrders", {"symbol": "ETHUSDT"})[0])
# flatten position
st, pos = signed_req("GET", "/fapi/v2/positionRisk", {})
if st == 200:
    for p in pos:
        amt = float(p.get("positionAmt", 0))
        if abs(amt) > 0 and p["symbol"] == "ETHUSDT":
            side = "SELL" if amt > 0 else "BUY"
            print("flatten:", signed_req("POST", "/fapi/v1/order", {
                "symbol": "ETHUSDT", "side": side, "type": "MARKET", "quantity": abs(amt),
            })[0])
