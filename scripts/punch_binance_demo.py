#!/usr/bin/env python3
"""Punch the scan's punch-list directly on the Binance futures TESTNET.

For every candidate: MARKET entry -> STOP_MARKET SL (reduce-only algo leg)
-> TAKE_PROFIT_MARKET TP (reduce-only algo leg). Verifies each acceptance,
then prints the account truth (positions + open bracket legs) and writes
desk/deepscan/BIN-PUNCH-latest.{json,md} as the trade record.

TESTNET ONLY by server gate — this script talks to the terminal's own
/api/binance/order route, which refuses anything but BINANCE_MODE=testnet.
"""
from __future__ import annotations

import json
import time
import urllib.request
from datetime import datetime, timezone

BASE = "http://127.0.0.1:3000"
TESTNET_INFO = "https://testnet.binancefuture.com/fapi/v1/exchangeInfo"
SCAN = "/home/z/my-project/desk/deepscan/BIN-SCAN-latest.json"
OUT_JSON = "/home/z/my-project/desk/deepscan/BIN-PUNCH-latest.json"
OUT_MD = "/home/z/my-project/desk/deepscan/BIN-PUNCH-latest.md"


def testnet_tradable() -> set[str]:
    """The TESTNET lists a NARROWER symbol set than mainnet (GRAM: 'Invalid
    symbol', PUMP: not open for trading). Pre-flight every pair against the
    testnet's own exchangeInfo: status TRADING + order trading enabled."""
    with urllib.request.urlopen(TESTNET_INFO, timeout=15) as r:
        info = json.loads(r.read().decode())
    ok: set[str] = set()
    for s in info.get("symbols", []):
        if s.get("status") == "TRADING" and s.get("isOrderTradingEnabled", True):
            ok.add(s["symbol"])
    return ok


def post(body: dict, timeout: int = 15) -> dict:
    req = urllib.request.Request(
        f"{BASE}/api/binance/order",
        method="POST",
        headers={"content-type": "application/json"},
        data=json.dumps(body).encode(),
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        return json.loads(e.read().decode())


def get(path: str, timeout: int = 15):
    with urllib.request.urlopen(f"{BASE}{path}", timeout=timeout) as r:
        return json.loads(r.read().decode())


def main() -> None:
    with open(SCAN) as f:
        scan = json.load(f)

    tradable = testnet_tradable()
    print(f"testnet exchangeInfo: {len(tradable)} TRADING pairs")

    acct_before = get("/api/binance/account")
    held = {p["symbol"].replace("USDT", "") for p in acct_before.get("positions", []) if p.get("positionAmt")}
    n_pos = len(held)
    slots = max(0, 4 - n_pos)  # desk mandate: max 4 concurrent positions

    # candidates in score order, skipping non-testnet pairs and held symbols
    queue = [c for c in scan["candidates"] if c["pair"] in tradable and c["sym"] not in held]
    punch = queue[:slots]
    skipped = [c["sym"] for c in scan["punchList"] if c["pair"] not in tradable]
    if skipped:
        print(f"skipped (not tradable on testnet): {skipped}")

    dt = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
    print(f"punching {len(punch)} candidates at {dt} (testnet, {slots} slots open)\n")
    print(f"wallet before: ${acct_before.get('totalWalletBalance', 0):.2f} · positions {len(acct_before.get('positions', []))} · open orders {len(acct_before.get('openOrders', []))}\n")

    records: list[dict] = []
    for c in punch:
        sym = c["sym"]
        long = c["direction"] == "LONG"
        side = "BUY" if long else "SELL"
        exit_side = "SELL" if long else "BUY"
        rec = {"sym": sym, "pair": c["pair"], "direction": c["direction"],
               "score": c["score"], "rank": c["rank"],
               "plannedEntry": c["entry"], "sl": c["sl"], "tp": c["tp"],
               "qty": c["qty"], "notional": c["notional"], "riskUsd": c["riskUsd"],
               "rMultiple": c["rMultiple"], "legs": []}

        # 1) entry
        r = post({"action": "place", "symbol": sym, "side": side,
                  "type": "MARKET", "quantity": c["qty"]})
        ok = r.get("ok")
        res = r.get("result", {})
        rec["legs"].append({"leg": "ENTRY", "type": "MARKET", "ok": ok,
                            "orderId": res.get("orderId"), "status": res.get("status"),
                            "avgPrice": res.get("avgPrice")})
        print(f"{sym:>8} ENTRY  {side} {c['qty']} MARKET -> {'OK ' + str(res.get('orderId')) if ok else 'FAIL ' + str(r.get('error'))}")
        if not ok:
            rec["error"] = r.get("error")
            records.append(rec)
            continue

        # 2) SL (conditional algo lane)
        r = post({"action": "place", "symbol": sym, "side": exit_side,
                  "type": "STOP_MARKET", "stopPrice": c["sl"],
                  "quantity": c["qty"], "reduceOnly": True})
        res = r.get("result", {})
        rec["legs"].append({"leg": "SL", "type": "STOP_MARKET", "ok": r.get("ok"),
                            "algoId": res.get("algoId"), "trigger": res.get("triggerPrice"),
                            "status": res.get("algoStatus")})
        print(f"{sym:>8} SL     {exit_side} STOP_MARKET trigger {c['sl']} -> {'OK ' + str(res.get('algoId')) if r.get('ok') else 'FAIL ' + str(r.get('error'))}")

        # 3) TP (conditional algo lane)
        r = post({"action": "place", "symbol": sym, "side": exit_side,
                  "type": "TAKE_PROFIT_MARKET", "stopPrice": c["tp"],
                  "quantity": c["qty"], "reduceOnly": True})
        res = r.get("result", {})
        rec["legs"].append({"leg": "TP", "type": "TAKE_PROFIT_MARKET", "ok": r.get("ok"),
                            "algoId": res.get("algoId"), "trigger": res.get("triggerPrice"),
                            "status": res.get("algoStatus")})
        print(f"{sym:>8} TP     {exit_side} TAKE_PROFIT_MARKET trigger {c['tp']} -> {'OK ' + str(res.get('algoId')) if r.get('ok') else 'FAIL ' + str(r.get('error'))}")
        records.append(rec)
        time.sleep(0.3)

    # settle: give the matching engine a beat, then read the account truth
    time.sleep(2)
    acct = get("/api/binance/account")
    print(f"\nwallet after: ${acct.get('totalWalletBalance', 0):.2f} · unrealized {acct.get('totalUnrealizedProfit', 0):+.2f}")
    print("positions:")
    for p in acct.get("positions", []):
        print(f"  {p['symbol']:>16} {p['positionAmt']:>12} @ {p['entryPrice']} lev {p['leverage']} uPnL {p['unRealizedProfit']:+.3f}")
    print("open orders:")
    for o in acct.get("openOrders", []):
        trig = f"trigger {o.get('triggerPrice')}" if o.get("algo") else f"@ {o.get('price')}"
        print(f"  #{o['orderId']} {o['symbol']:>16} {o['side']} {o['type']} qty {o['origQty']} {trig} [{o['status']}]")

    out = {"punchedAt": dt, "walletBefore": acct_before.get("totalWalletBalance"),
           "walletAfter": acct.get("totalWalletBalance"),
           "unrealized": acct.get("totalUnrealizedProfit"),
           "positions": acct.get("positions"), "openOrders": acct.get("openOrders"),
           "trades": records}
    with open(OUT_JSON, "w") as f:
        json.dump(out, f, indent=1)

    lines = [f"# Binance demo punch — {dt}",
             f"testnet · wallet ${acct_before.get('totalWalletBalance', 0):.2f} → ${acct.get('totalWalletBalance', 0):.2f} · unrealized {acct.get('totalUnrealizedProfit', 0):+.2f}",
             "",
             "| sym | dir | score | qty | entry (plan/fill) | SL | TP | R | notional | risk$ | legs |",
             "|---|---|---|---|---|---|---|---|---|---|---|"]
    for rec in records:
        fill = next((l.get("avgPrice") for l in rec["legs"] if l["leg"] == "ENTRY" and l.get("avgPrice")), "–")
        legs = ", ".join(f"{l['leg']}:{'OK' if l['ok'] else 'FAIL'}" for l in rec["legs"])
        lines.append(f"| {rec['sym']} | {rec['direction']} | {rec['score']} | {rec['qty']} | {rec['plannedEntry']}/{fill} | {rec['sl']} | {rec['tp']} | {rec['rMultiple']} | ${rec['notional']} | ${rec['riskUsd']} | {legs} |")
    lines += ["", "Open positions (testnet truth):"]
    for p in acct.get("positions", []):
        lines.append(f"- {p['symbol']} {p['positionAmt']} @ {p['entryPrice']} · lev {p['leverage']} · uPnL {p['unRealizedProfit']:+.3f}")
    lines += ["", "Open orders (brackets):"]
    for o in acct.get("openOrders", []):
        trig = f"trigger {o.get('triggerPrice')}" if o.get("algo") else f"@ {o.get('price')}"
        lines.append(f"- #{o['orderId']} {o['symbol']} {o['side']} {o['type']} qty {o['origQty']} {trig} [{o['status']}]")
    with open(OUT_MD, "w") as f:
        f.write("\n".join(lines) + "\n")
    print(f"\nwrote {OUT_JSON} and {OUT_MD}")


if __name__ == "__main__":
    main()
