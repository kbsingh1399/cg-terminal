#!/usr/bin/env python3
"""Binance-tier verify+PUNCH battery v2 — same 23 checks as
binance_tier_verify.py but every fapi-hitting call RETRIES past transient
host-side 429/418 breaker windows (shared sandbox egress), plus a fuller
demo order punch sequence on the TESTNET:

  1. MARKET BUY BTC (small) -> position visible -> reduceOnly MARKET close -> flat
  2. far-from-market LIMIT on ZEC + SOL -> NEW -> cancelAll -> clean

Exit 0 = all green.
"""
import json
import re
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone

BASE = "http://127.0.0.1:3000"
PASS, FAIL = [], []
BAN_RE = re.compile(r"until (\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+)Z")


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


def ban_wait_seconds(err_text):
    """Extract seconds to wait from 'ban active until <ISO>' messages."""
    m = BAN_RE.search(err_text or "")
    if not m:
        return None
    until = datetime.fromisoformat(m.group(1)).replace(tzinfo=timezone.utc)
    return max(0.0, (until - datetime.now(timezone.utc)).total_seconds() + 1.0)


def rcall(path, method="GET", body=None, tries=6):
    """Call with retry past transient fapi ban windows (max ~5 min total)."""
    last = (0, {})
    for i in range(tries):
        st, j = call(path, method, body)
        last = (st, j)
        if st < 500 or st == 400 or st == 403:
            return st, j
        wait = ban_wait_seconds(j.get("error", "") if isinstance(j, dict) else "")
        if wait is None:
            wait = 5.0
        print(f"    (retry {i+1}/{tries}: HTTP {st}, waiting {wait:.0f}s)")
        time.sleep(min(wait, 70.0))
    return last


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
    registry_overlap = {"BTC", "ETH", "SOL", "BNB", "XRP", "DOGE"} & syms
    check("registry assets present in top-200", len(registry_overlap) >= 5, f"overlap={sorted(registry_overlap)}")
    non_reg = next((a for a in assets if a["sym"] not in {"BTC", "ETH", "SOL", "BNB", "XRP", "ADA", "AVAX", "DOGE", "LINK", "LTC", "XLM", "XMR", "XAU", "XAG", "XPT"}), None)
    check("non-registry assets included", non_reg is not None, f"e.g. {non_reg['sym']} rank {non_reg['rank']}")
    probe_sym = non_reg["sym"] if non_reg else "BTC"

    # 2. quotes
    st, q = rcall("/api/binance/quotes")
    check("quotes bulk", st == 200 and q.get("ok") and len(q.get("quotes", {})) >= 150, f"{len(q.get('quotes', {}))} syms, age={q.get('ageMs')}ms")
    if probe_sym in q.get("quotes", {}):
        check("quotes probe price", q["quotes"][probe_sym]["last"] > 0, f"{probe_sym}={q['quotes'][probe_sym]['last']}")

    # 3. klines
    st, k = rcall(f"/api/binance/klines?sym={probe_sym}&interval=15m&limit=120")
    rows = k.get("rows", [])
    check("klines rows", st == 200 and k.get("ok") and len(rows) == 120, f"{probe_sym} 15m x{len(rows)}")
    check("klines shape", len(rows) > 0 and all(isinstance(v, (int, float)) for v in rows[0][:6]), f"row0={rows[0][:6] if rows else None}")
    st, k2 = call(f"/api/binance/klines?sym={probe_sym}&interval=notaninterval")
    check("klines bad interval -> 400", st == 400, f"got {st}")
    st, k3 = call("/api/binance/klines?sym=NOPEXYZ&interval=15m")
    check("klines unknown sym -> 400", st == 400, f"got {st}")

    # 4. market stats
    st, m = rcall(f"/api/binance/market?sym={probe_sym}")
    check("market stats", st == 200 and m.get("ok") and m.get("ticker", {}).get("last", 0) > 0, f"last={m.get('ticker', {}).get('last')}")
    check("market funding+oi", m.get("mark", {}).get("fundingRatePct") is not None and m.get("oi", {}).get("contracts", 0) >= 0, f"funding={m.get('mark', {}).get('fundingRatePct')}%/8h oi_usd={m.get('oi', {}).get('usd')}")
    st, m2 = call("/api/binance/market?sym=NOTASYM")
    check("market unknown sym -> 400", st == 400, f"got {st}")

    # 5. cg/live binance-tier sym
    st, lv = rcall(f"/api/cg/live?sym={probe_sym}")
    check("cg/live binance-tier sym", st == 200 and lv.get("ok") and lv.get("price", 0) > 0, f"{probe_sym}={lv.get('price')} src={lv.get('source')}")

    # 6. account (signed testnet)
    st, acct = rcall("/api/binance/account")
    check("account testnet", st == 200 and acct.get("ok") and acct.get("mode") == "testnet", f"wallet={acct.get('totalWalletBalance')} canTrade={acct.get('canTrade')} openOrders={len(acct.get('openOrders', []))}")

    # 7. PUNCH SEQUENCE A — MARKET round-trip on BTC (open + close)
    st, px = rcall("/api/binance/market?sym=BTC")
    btc_last = px.get("ticker", {}).get("last", 0)
    check("btc price for sizing", btc_last > 0, f"BTC last={btc_last}")
    qty = 0.002  # ~$150 notional at ~$74k — well within $4096 fake wallet
    st, o1 = call("/api/binance/order", "POST", {"action": "place", "symbol": "BTC", "side": "BUY", "type": "MARKET", "quantity": qty})
    o1r = o1.get("result") or {}
    check("PUNCH market BUY BTC", st == 200 and o1.get("ok") and o1r.get("orderId") is not None, f"orderId={o1r.get('orderId')} status={o1r.get('status')} avgPx={o1r.get('avgPrice')}")
    st, acct2 = rcall("/api/binance/account")
    pos = next((p for p in acct2.get("positions", []) if p.get("symbol") == "BTCUSDT"), None)
    check("position open on account", pos is not None and abs(pos.get("positionAmt", 0)) >= qty - 1e-9, f"positionAmt={pos.get('positionAmt') if pos else None} entry={pos.get('entryPrice') if pos else None} uPnl={pos.get('unRealizedProfit') if pos else None}")
    st, o2 = call("/api/binance/order", "POST", {"action": "place", "symbol": "BTC", "side": "SELL", "type": "MARKET", "quantity": qty, "reduceOnly": True})
    o2r = o2.get("result") or {}
    check("PUNCH market close (reduceOnly SELL)", st == 200 and o2.get("ok") and o2r.get("orderId") is not None, f"orderId={o2r.get('orderId')} status={o2r.get('status')}")
    st, acct3 = rcall("/api/binance/account")
    pos2 = next((p for p in acct3.get("positions", []) if p.get("symbol") == "BTCUSDT"), None)
    check("position flat after close", pos2 is None or abs(pos2.get("positionAmt", 0)) < 1e-9, f"positionAmt={pos2.get('positionAmt') if pos2 else None} wallet={acct3.get('totalWalletBalance')}")

    # 8. PUNCH SEQUENCE B — far LIMIT place->NEW->cancelAll on ZEC + SOL
    for s in ("ZEC", "SOL"):
        st, mp = rcall(f"/api/binance/market?sym={s}")
        last = mp.get("ticker", {}).get("last", 0)
        if last <= 0:  # fallback to quotes lane
            st, qq = rcall("/api/binance/quotes")
            last = (qq.get("quotes", {}).get(s) or {}).get("last", 0)
        far = round(last * 0.5, 1)
        st, op = call("/api/binance/order", "POST", {"action": "place", "symbol": s, "side": "BUY", "type": "LIMIT", "quantity": 0.01 if s == "BTC" else (1 if s == "ZEC" else 0.5), "price": far})
        opr = op.get("result") or {}
        check(f"PUNCH far LIMIT {s}", st == 200 and op.get("ok") and opr.get("orderId") is not None, f"px={far} orderId={opr.get('orderId')} status={opr.get('status')}")
        st, oc = call("/api/binance/order", "POST", {"action": "cancelAll", "symbol": s})
        check(f"cancelAll {s}", st == 200 and oc.get("ok"), f"{(oc.get('result') or {}).get('msg', '')[:60]}")
    st, acct4 = rcall("/api/binance/account")
    check("no residual open orders", len(acct4.get("openOrders", [])) == 0, f"openOrders={len(acct4.get('openOrders', []))} wallet={acct4.get('totalWalletBalance')}")
    st, obad = call("/api/binance/order", "POST", {"action": "place", "symbol": "BTC", "side": "MAYBE", "type": "LIMIT", "quantity": 1, "price": 1})
    check("order bad side -> 400", st == 400, f"got {st}")

    # 9. regressions
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
