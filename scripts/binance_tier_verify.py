#!/usr/bin/env python3
"""Binance-tier endpoint battery — verifies the top-200 integration end-to-end
against the running terminal (:3000). Read-only except the TESTNET order
round-trip (place far-from-market LIMIT -> verify NEW -> cancelAll -> verify
0 open) which proves the signed demo path with fake funds.

Exit code 0 = all checks passed.
"""
import json
import sys
import urllib.error
import urllib.request

BASE = "http://127.0.0.1:3000"
PASS, FAIL = [], []


def call(path, method="GET", body=None, timeout=30):
    req = urllib.request.Request(
        BASE + path,
        method=method,
        headers={"content-type": "application/json"} if body else {},
        data=json.dumps(body).encode() if body else None,
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read().decode())
        except Exception:
            return e.code, {}


def check(name, ok, detail=""):
    (PASS if ok else FAIL).append(name)
    print(f"{'PASS' if ok else 'FAIL'}  {name}" + (f"  — {detail}" if detail else ""))


def main():
    # 1. universe
    st, u = call("/api/binance/universe")
    assets = u.get("assets", [])
    check("universe 200", st == 200 and u.get("ok") and len(assets) == 200, f"n={len(assets)} state={u.get('state')}")
    top = assets[0] if assets else {}
    check("universe ranked + decs", all(isinstance(a.get("priceDecs"), int) and a.get("rank") == i + 1 for i, a in enumerate(assets[:5])), f"top={top.get('sym')} vol={top.get('quoteVol24h', 0) / 1e9:.2f}B decs={top.get('priceDecs')}")
    syms = {a["sym"] for a in assets}
    # registry overlap expectation: majors always rank in the top-200 by 24h
    # quote volume; metals perps (XAU/XAG) legitimately sit BELOW the ~$3-4M
    # daily-volume cutoff and stay Tier-1-only — they are not expected here.
    registry_overlap = {"BTC", "ETH", "SOL", "BNB", "XRP", "DOGE"} & syms
    check("registry assets present in top-200", len(registry_overlap) >= 5, f"overlap={sorted(registry_overlap)}")
    non_reg = next((a for a in assets if a["sym"] not in {"BTC", "ETH", "SOL", "BNB", "XRP", "ADA", "AVAX", "DOGE", "LINK", "LTC", "XLM", "XMR", "XAU", "XAG", "XPT"}), None)
    check("non-registry assets included", non_reg is not None, f"e.g. {non_reg['sym']} rank {non_reg['rank']}")
    probe_sym = non_reg["sym"] if non_reg else "BTC"
    probe_decs = non_reg["priceDecs"] if non_reg else 2

    # 2. quotes (REST fallback tier)
    st, q = call("/api/binance/quotes")
    check("quotes bulk", st == 200 and q.get("ok") and len(q.get("quotes", {})) >= 150, f"{len(q.get('quotes', {}))} syms, age={q.get('ageMs')}ms")
    if probe_sym in q.get("quotes", {}):
        check("quotes probe price", q["quotes"][probe_sym]["last"] > 0, f"{probe_sym}={q['quotes'][probe_sym]['last']}")

    # 3. klines
    st, k = call(f"/api/binance/klines?sym={probe_sym}&interval=15m&limit=120")
    rows = k.get("rows", [])
    check("klines rows", st == 200 and k.get("ok") and len(rows) == 120, f"{probe_sym} 15m x{len(rows)}")
    check("klines shape", len(rows) > 0 and all(isinstance(v, (int, float)) for v in rows[0][:6]), f"row0={rows[0][:6] if rows else None}")
    st, k2 = call(f"/api/binance/klines?sym={probe_sym}&interval=notaninterval")
    check("klines bad interval -> 400", st == 400, f"got {st}")
    st, k3 = call("/api/binance/klines?sym=NOPEXYZ&interval=15m")
    check("klines unknown sym -> 400", st == 400, f"got {st}")

    # 4. market stats
    st, m = call(f"/api/binance/market?sym={probe_sym}")
    check("market stats", st == 200 and m.get("ok") and m.get("ticker", {}).get("last", 0) > 0, f"last={m.get('ticker', {}).get('last')}")
    check("market funding+oi", m.get("mark", {}).get("fundingRatePct") is not None and m.get("oi", {}).get("contracts", 0) >= 0, f"funding={m.get('mark', {}).get('fundingRatePct')}%/8h oi={m.get('oi', {}).get('usd')}")
    st, m2 = call("/api/binance/market?sym=NOTASYM")
    check("market unknown sym -> 400", st == 400, f"got {st}")

    # 5. /api/cg/live accepts binance-tier syms (fallback ladder extension)
    st, lv = call(f"/api/cg/live?sym={probe_sym}")
    check("cg/live binance-tier sym", st == 200 and lv.get("ok") and lv.get("price", 0) > 0, f"{probe_sym}={lv.get('price')} src={lv.get('source')}")

    # 6. account (signed testnet)
    st, acct = call("/api/binance/account")
    check("account testnet", st == 200 and acct.get("ok") and acct.get("mode") == "testnet", f"wallet={acct.get('totalWalletBalance')} canTrade={acct.get('canTrade')} openOrders={len(acct.get('openOrders', []))}")

    # 7. TESTNET order round-trip: place far-from-market LIMIT (cannot fill),
    #    verify it shows as NEW, then cancel all and verify zero open.
    st, px = call("/api/binance/market?sym=BTC")
    last = px.get("ticker", {}).get("last", 0)
    far = round(last * 0.5, px.get("rank") and 1 or 1) if last > 0 else 1000.0
    st, o1 = call("/api/binance/order", "POST", {"action": "place", "symbol": "BTC", "side": "BUY", "type": "LIMIT", "quantity": 0.002, "price": far})
    oid = (o1.get("result") or {}).get("orderId")
    check("testnet place LIMIT", st == 200 and o1.get("ok") and oid is not None, f"price={far} orderId={oid} status={(o1.get('result') or {}).get('status')}")
    st, acct2 = call("/api/binance/account")
    check("order visible on account", st == 200 and any((o.get("orderId") == oid) for o in acct2.get("openOrders", [])), f"openOrders={len(acct2.get('openOrders', []))}")
    st, o2 = call("/api/binance/order", "POST", {"action": "cancelAll", "symbol": "BTC"})
    check("testnet cancelAll", st == 200 and o2.get("ok"), f"result={str(o2.get('result'))[:80]}")
    st, acct3 = call("/api/binance/account")
    check("no residual open orders", not [o for o in acct3.get("openOrders", []) if o.get("symbol") == "BTCUSDT"], f"btc orders={len([o for o in acct3.get('openOrders', []) if o.get('symbol') == 'BTCUSDT'])}")
    st, o3 = call("/api/binance/order", "POST", {"action": "place", "symbol": "BTC", "side": "MAYBE", "type": "LIMIT", "quantity": 1, "price": far})
    check("order bad side -> 400", st == 400, f"got {st}")

    # 8. regressions
    st, _ = call("/api/health")
    check("health still 200", st == 200)
    st, a = call("/api/cg/assets")
    check("cg/assets registry intact (15)", st == 200 and len(a.get("assets", [])) == 15, f"n={len(a.get('assets', []))}")
    st, c = call("/api/cg/classic?list=1")
    check("classic list intact", st == 200 and c.get("ok"), "")

    print(f"\n=== {len(PASS)} passed, {len(FAIL)} failed ===")
    if FAIL:
        print("FAILED:", ", ".join(FAIL))
        sys.exit(1)


if __name__ == "__main__":
    main()
