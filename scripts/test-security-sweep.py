#!/usr/bin/env python3
"""Security + validation regression sweep against the FIXED server on :3172."""
import json, urllib.request, urllib.error, time

B = "http://127.0.0.1:3172"

def req(path, method="GET", headers=None, timeout=45):
    r = urllib.request.Request(B + path, method=method, headers=headers or {})
    try:
        with urllib.request.urlopen(r, timeout=timeout) as resp:
            return resp.status, json.loads(resp.read().decode() or "{}")
    except urllib.error.HTTPError as e:
        try: return e.code, json.loads(e.read().decode() or "{}")
        except Exception: return e.code, {}

ok = lambda b: "PASS" if b else "FAIL"
tests = []
def check(name, cond, detail=""):
    tests.append(cond)
    print(f"{ok(cond)}  {name}" + (f"  [{detail}]" if detail else ""))

# --- 1. unbounded-cache primitives are closed ---
st, d = req("/api/cg/bookwalls?sym=BTC&endTime=1")
check("bookwalls endTime=1 rejected (was memory-growth primitive)", st == 400, d.get("error","")[:60])
st, d = req("/api/cg/bookwalls?sym=BTC&endTime=-5")
check("bookwalls negative endTime rejected", st == 400)
now = int(time.time())
st, d = req(f"/api/cg/bookwalls?sym=BTC&endTime={now}")
check("bookwalls valid endTime accepted", st == 200, f"ok={d.get('ok')}")
st, d = req(f"/api/cg/bookwalls?sym=BTC&endTime={now - 40*86400}")
check("bookwalls endTime >30d back rejected", st == 400)
st, d = req("/api/cg/stopmap?sym=BTC&endTime=1")
check("stopmap endTime=1 rejected", st == 400)
st, d = req(f"/api/cg/stopmap?sym=BTC&endTime={now}")
check("stopmap valid endTime accepted", st in (200, 502), f"status={st}")

# --- 2. unknown-asset allowlist now on every sym route ---
for ep in ["cvd?sym=FOOBAR", "lto?symbol=FOOBAR", "bookwalls?sym=FOOBAR", "market?sym=FOOBAR"]:
    st, d = req(f"/api/cg/{ep}")
    check(f"{ep.split('?')[0]} unknown asset → 400", st == 400, d.get("error","")[:40])
st, d = req("/api/cg/kline?symbol=../../etc/passwd")
check("kline path-traversal symbol rejected", st == 400)
st, d = req("/api/cg/kline?symbol=Binance_BTCUSDT&limit=5")
check("kline valid symbol accepted + echoes symbol", st == 200 and d.get("symbol") == "Binance_BTCUSDT")
st, d = req("/api/cg/orderflow?symbol=OKX_BTC-USDT-SWAP")
check("orderflow instrument-key validation OK", st == 200)

# --- 3. CSRF: cross-site POST to backfill ---
st, d = req("/api/cg/engine/backfill", method="POST", headers={"Origin": "https://evil.example", "Sec-Fetch-Site": "cross-site"})
check("cross-site POST backfill → 403", st == 403, d.get("error","")[:50])
st, d = req("/api/cg/engine/backfill", method="POST", headers={"Origin": "http://127.0.0.1:3172"})
check("same-origin POST backfill accepted (not 403/409)", st not in (403, 409), f"status={st}")
if st == 429:
    print("      (429 = cooldown from a previous run — acceptable)")
st, d = req("/api/cg/engine/backfill", method="POST", headers={"Origin": "http://127.0.0.1:3172"})
check("backfill second call hits cooldown/single-flight (429 or 409)", st in (429, 409), f"status={st}")

# --- 4. core data still healthy after all fixes ---
for s in ["BTC", "XRP", "XAU"]:
    st, d = req(f"/api/cg/market?sym={s}")
    p = d.get("price", {}).get("last")
    check(f"market {s} live", st == 200 and p, f"last={p}")
st, d = req("/api/cg/bookwalls?sym=XRP")
check("bookwalls XRP 2-venue route intact", st == 200 and d.get("venues") == ["Binance", "Hyperliquid"])
st, d = req("/api/cg/cvd?sym=XRP")
check("cvd XRP works (isAsset accepts valid)", st == 200 and d.get("sym") == "XRP")
st, d = req("/api/cg/ticker?sym=ETH")
check("ticker ETH live", st == 200 and d.get("price"))

print(f"\n{'ALL PASS' if all(tests) else 'SOME FAILED'} ({sum(tests)}/{len(tests)})")
