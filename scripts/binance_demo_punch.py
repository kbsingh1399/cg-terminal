#!/usr/bin/env python3
"""Binance FUTURES TESTNET order puncher — signed REST (HMAC SHA256).

Keys live in .env (BINANCE_API_KEY / BINANCE_API_SECRET). These credentials
are valid on https://testnet.binancefuture.com (USD-M futures demo).

Usage:
  python3 scripts/binance_demo_punch.py faccount        # balances + positions
  python3 scripts/binance_demo_punch.py basket          # punch diversified demo basket
  python3 scripts/binance_demo_punch.py buy <SYM> <notional_usd> [lev]
  python3 scripts/binance_demo_punch.py sell <SYM> <notional_usd> [lev]
  python3 scripts/binance_demo_punch.py fpositions      # open positions snapshot
"""
import hashlib
import hmac
import json
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

BASE = "https://testnet.binancefuture.com"

ENV = {}
for line in (Path(__file__).resolve().parent.parent / ".env").read_text().splitlines():
    line = line.strip()
    if line and not line.startswith("#") and "=" in line:
        k, v = line.split("=", 1)
        ENV[k] = v
API_KEY = ENV.get("BINANCE_API_KEY", "")
API_SECRET = ENV.get("BINANCE_API_SECRET", "")

# diversified basket: (symbol, side, notional_usd, leverage)
BASKET = [
    ("BTCUSDT",  "BUY",  400, 10),
    ("ETHUSDT",  "BUY",  300, 10),
    ("SOLUSDT",  "BUY",  250, 10),
    ("XRPUSDT",  "BUY",  200, 10),
    ("BNBUSDT",  "BUY",  150, 10),
    ("PAXGUSDT", "BUY",  200, 10),   # gold (TradFi proxy)
    ("DOGEUSDT", "BUY",  100, 10),
    ("ADAUSDT",  "BUY",  100, 10),
    ("LINKUSDT", "SELL", 150, 10),   # short side demo
    ("LTCUSDT",  "SELL", 100, 10),   # short side demo
]

_INFO = None


def api(method, path, params=None, signed=False):
    url = BASE + path
    if signed:
        p = dict(params or {})
        p["timestamp"] = int(time.time() * 1000)
        p["recvWindow"] = 20000
        qs = urllib.parse.urlencode(p)
        sig = hmac.new(API_SECRET.encode(), qs.encode(), hashlib.sha256).hexdigest()
        url += "?" + qs + "&signature=" + sig
        req = urllib.request.Request(url, method=method,
                                     headers={"X-MBX-APIKEY": API_KEY})
    else:
        if params:
            url += "?" + urllib.parse.urlencode(params)
        req = urllib.request.Request(url, method=method,
                                     headers={"User-Agent": "cg-terminal/1.0"})
    try:
        with urllib.request.urlopen(req, timeout=25) as r:
            return json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        try:
            return {"error": True, "http": e.code, **json.loads(body)}
        except json.JSONDecodeError:
            return {"error": True, "http": e.code, "msg": body[:200]}
    except Exception as e:  # noqa: BLE001
        return {"error": True, "msg": str(e)}


def exchange_info():
    global _INFO
    if _INFO is None:
        _INFO = api("GET", "/fapi/v1/exchangeInfo")
    return _INFO


def sym_filters(sym):
    for s in exchange_info().get("symbols", []):
        if s["symbol"] == sym and s["status"] == "TRADING":
            step, min_not = None, 5.0
            for f in s["filters"]:
                if f["filterType"] == "LOT_SIZE":
                    step = float(f["stepSize"])
                if f["filterType"] == "MIN_NOTIONAL":
                    min_not = float(f["notional"])
            return {"step": step, "minNotional": min_not,
                    "pricePrecision": s["pricePrecision"],
                    "qtyPrecision": s["quantityPrecision"]}
    return None


def mark_price(sym):
    r = api("GET", "/fapi/v1/premiumIndex", {"symbol": sym})
    if r.get("error"):
        return None
    return float(r["markPrice"])


def round_step(qty, step):
    if not step:
        return qty
    # floor to step
    import math
    return math.floor(qty / step) * step


def fmt_qty(q, step):
    if not step:
        return f"{q:.6f}"
    dec = max(0, len(str(step).split(".")[-1]) if "." in str(step) else 0)
    return f"{q:.{dec}f}"


def set_leverage(sym, lev):
    return api("POST", "/fapi/v1/leverage",
               {"symbol": sym, "leverage": lev}, signed=True)


def market_order(sym, side, notional_usd, lev=10):
    """Punch a market order sized by USD notional."""
    f = sym_filters(sym)
    if not f:
        return {"error": True, "msg": f"{sym} not TRADING on futures testnet"}
    px = mark_price(sym)
    if not px:
        return {"error": True, "msg": f"no mark price for {sym}"}
    lev_res = set_leverage(sym, lev)
    raw_qty = notional_usd / px
    qty = round_step(raw_qty, f["step"])
    if qty * px < f["minNotional"]:
        qty = round_step(f["minNotional"] * 1.05 / px, f["step"])
    if qty <= 0:
        return {"error": True, "msg": f"qty rounds to 0 for {sym}"}
    res = api("POST", "/fapi/v1/order", {
        "symbol": sym, "side": side, "type": "MARKET",
        "quantity": fmt_qty(qty, f["step"]),
        "newOrderRespType": "RESULT",
    }, signed=True)
    if not res.get("error"):
        res["_punched"] = {
            "symbol": sym, "side": side, "qty": fmt_qty(qty, f["step"]),
            "markPx": px, "notionalUsd": round(qty * px, 2),
            "leverage": lev,
            "leverageAck": (None if lev_res.get("error")
                            else lev_res.get("leverage")),
        }
    return res


def positions():
    acct = api("GET", "/fapi/v2/account", signed=True)
    if acct.get("error"):
        return []
    out = []
    for p in acct.get("positions", []):
        if float(p["positionAmt"]) != 0:
            out.append({
                "symbol": p["symbol"], "amt": p["positionAmt"],
                "entry": p["entryPrice"], "mark": p.get("markPrice"),
                "uPnl": p["unrealizedProfit"],
                "lev": p.get("leverage"),
            })
    return out


def main():
    cmd = sys.argv[1] if len(sys.argv) > 1 else "faccount"
    if cmd == "faccount":
        bals = api("GET", "/fapi/v2/balance", signed=True)
        if isinstance(bals, dict) and bals.get("error"):
            print("ERROR:", bals)
            sys.exit(1)
        for b in bals:
            if float(b["balance"]) > 0:
                print(f"{b['asset']:<8} balance={b['balance']:>16} "
                      f"available={b['availableBalance']:>16}")
        print("\nOpen positions:")
        for p in positions():
            print(f"  {p['symbol']:<16} amt={p['amt']:>12} entry={p['entry']} "
                  f"uPnl={p['uPnl']}")
    elif cmd == "fpositions":
        for p in positions():
            print(f"  {p['symbol']:<16} amt={p['amt']:>12} entry={p['entry']} "
                  f"mark={p['mark']} uPnl={p['uPnl']} lev={p['lev']}")
    elif cmd in ("buy", "sell"):
        sym, notional = sys.argv[2], float(sys.argv[3])
        lev = int(sys.argv[4]) if len(sys.argv) > 4 else 10
        print(json.dumps(market_order(sym, cmd.upper(), notional, lev), indent=2))
    elif cmd == "basket":
        results = []
        print(f"Punching {len(BASKET)} demo orders on futures testnet...\n")
        for sym, side, notional, lev in BASKET:
            r = market_order(sym, side, notional, lev)
            if r.get("error"):
                print(f"  FAIL {sym:<12} {side:<4} -> {r}")
            else:
                p = r["_punched"]
                print(f"  OK   {sym:<12} {side:<4} qty={p['qty']:>14} "
                      f"~${p['notionalUsd']:>8} @mark {p['markPx']} "
                      f"orderId={r.get('orderId')} status={r.get('status')}")
            results.append({sym: sym, "side": side, "notional": notional,
                            "leverage": lev,
                            "result": {k: v for k, v in r.items()
                                       if k != "_punched"},
                            "punched": r.get("_punched")})
            time.sleep(0.4)
        ok = sum(1 for r in results if r.get("punched"))
        print(f"\nFilled {ok}/{len(BASKET)} orders. Positions now:")
        for p in positions():
            print(f"  {p['symbol']:<16} amt={p['amt']:>12} entry={p['entry']} "
                  f"uPnl={p['uPnl']}")
        out = Path("/home/z/my-project/download/punch_report_binance_demo.json")
        out.write_text(json.dumps({
            "generatedAt": time.strftime("%Y-%m-%d %H:%M:%S"),
            "venue": BASE, "results": results,
        }, indent=2))
        print(f"\nReport saved -> {out}")
    else:
        print(__doc__)


if __name__ == "__main__":
    main()
