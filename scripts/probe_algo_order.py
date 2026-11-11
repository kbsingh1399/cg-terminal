#!/usr/bin/env python3
"""Verify the NEW algo-order lane on the futures TESTNET.

Since 2025-12-09 Binance rejects STOP_MARKET/TAKE_PROFIT_MARKET on
/fapi/v1/order (-4120) — conditional orders live at POST /fapi/v1/algoOrder:
  algoType=CONDITIONAL, orderType STOP_MARKET|TAKE_PROFIT_MARKET,
  triggerPrice (NOT stopPrice — old name silently never fires),
  explicit quantity + reduceOnly=true (closePosition removed).
"""
import hashlib
import hmac
import json
import os
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


def signed_req(method, path, params, base=BASE):
    q = {k: str(v) for k, v in params.items()}
    q["recvWindow"] = "5000"
    q["timestamp"] = str(int(time.time() * 1000))
    qs = "&".join(f"{k}={v}" for k, v in q.items())
    sig = hmac.new(SEC.encode(), qs.encode(), hashlib.sha256).hexdigest()
    qs += f"&signature={sig}"
    url = f"{base}{path}?{qs}"
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


st, px = signed_req("GET", "/fapi/v1/ticker/price", {"symbol": "ETHUSDT"})
eth = float(px["price"])
sl = round(eth * 0.99, 2)
tp = round(eth * 1.02, 2)
print(f"ETH={eth} SL trigger={sl} TP trigger={tp}")

# 1. open a small position (>= $20 notional)
st1, r1 = signed_req("POST", "/fapi/v1/order", {
    "symbol": "ETHUSDT", "side": "BUY", "type": "MARKET", "quantity": 0.02,
})
print("entry MARKET 0.02 ETH:", st1, r1.get("orderId"), r1.get("status"))

# 2. conditional SL via the algo lane
st2, r2 = signed_req("POST", "/fapi/v1/algoOrder", {
    "symbol": "ETHUSDT", "side": "SELL", "algoType": "CONDITIONAL",
    "orderType": "STOP_MARKET", "triggerPrice": sl, "quantity": 0.02,
    "reduceOnly": "true", "workingType": "MARK_PRICE",
})
print("algoOrder STOP_MARKET:", st2, json.dumps(r2)[:300])

# 3. conditional TP
st3, r3 = signed_req("POST", "/fapi/v1/algoOrder", {
    "symbol": "ETHUSDT", "side": "SELL", "algoType": "CONDITIONAL",
    "orderType": "TAKE_PROFIT_MARKET", "triggerPrice": tp, "quantity": 0.02,
    "reduceOnly": "true", "workingType": "MARK_PRICE",
})
print("algoOrder TAKE_PROFIT_MARKET:", st3, json.dumps(r3)[:300])

# 4. list open algo orders (probe shapes)
for probe in [
    ("GET", "/fapi/v1/algoOrders", {}),
    ("GET", "/fapi/v1/algoOrder", {"symbol": "ETHUSDT"}),
    ("GET", "/fapi/v1/openAlgoOrders", {}),
]:
    st, r = signed_req(probe[0], probe[1], probe[2])
    print(f"{probe[0]} {probe[1]}: {st} {json.dumps(r)[:200]}")

# 5. cleanup — cancel algo orders + regular orders + flatten
for probe in [
    ("DELETE", "/fapi/v1/algoOrder", {"symbol": "ETHUSDT", "algoId": (r2.get("algoId") or r2.get("orderId") or 0)}),
    ("DELETE", "/fapi/v1/allOpenOrders", {"symbol": "ETHUSDT"}),
]:
    st, r = signed_req(probe[0], probe[1], probe[2])
    print(f"{probe[0]} {probe[1]}: {st} {json.dumps(r)[:150]}")

st, pos = signed_req("GET", "/fapi/v2/positionRisk", {})
if st == 200:
    for p in pos:
        amt = float(p.get("positionAmt", 0))
        if abs(amt) > 0 and p["symbol"] == "ETHUSDT":
            side = "SELL" if amt > 0 else "BUY"
            print("flatten:", signed_req("POST", "/fapi/v1/order", {
                "symbol": "ETHUSDT", "side": side, "type": "MARKET", "quantity": abs(amt),
            })[0])
