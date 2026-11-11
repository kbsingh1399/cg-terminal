#!/usr/bin/env python3
"""Round-2 cross-asset opportunity scan (post liq/whale fix).

Differences vs round 1:
- liq clusters come from the FIXED /api/cg/liqlevels (live-price anchored)
- whale-wall notifications from BEFORE the fix are re-checked for
  plausibility vs the live price (asks >= market, bids <= market, +-10%)
- market context (RSI/VWAP/POC) + CVD for the top candidates
"""
import json, time, urllib.request, sys

BASE = "http://localhost:3000/api/cg"
SYMS = ["BTC", "ETH", "SOL", "BNB", "XRP", "ADA", "AVAX", "DOGE", "LINK", "LTC", "XAU", "XAG"]

def get(path, timeout=90):
    with urllib.request.urlopen(f"{BASE}{path}", timeout=timeout) as r:
        return json.loads(r.read())

now_ms = int(time.time() * 1000)
ago = lambda ts: (now_ms - ts) / 60000

# ---------------- Phase A: all 12 assets ----------------
SIG_SCOPE = sys.argv[2].split(",") if len(sys.argv) > 2 else ["BTC", "ETH", "SOL", "XRP", "XAU", "XAG"]
live, liq, sig = {}, {}, {}
for s in SYMS:
    try:
        live[s] = get(f"/live?sym={s}", 15).get("price")
    except Exception as e:
        live[s] = None
    try:
        d = get(f"/liqlevels?sym={s}", 60)
        st = d.get("stats", {})
        liq[s] = {
            "last": st.get("last"),
            "above": st.get("keyLevels", {}).get("above", [])[:3],
            "below": st.get("keyLevels", {}).get("below", [])[:3],
        }
    except Exception:
        liq[s] = None
    if s not in SIG_SCOPE:
        sig[s] = None
        continue
    try:
        g = get(f"/signals?sym={s}", 120)
        c = g.get("counts", {})
        sig[s] = (c.get("bullish", 0), c.get("bearish", 0))
    except Exception:
        sig[s] = None

print("=" * 110)
print("PHASE A — LIVE PRICE + CORRECTED LIQ CLUSTERS + FOOTPRINT COUNTS")
print("=" * 110)
for s in SYMS:
    p = live[s]
    ps = f"{p:,.4f}" if isinstance(p, (int, float)) else "–"
    b, be = sig[s] if sig[s] else ("cache-cold", "")
    l = liq[s]
    print(f"\n{s}  live {ps}  footprint bull/bear {b}/{be}")
    if l:
        for tag, key in (("ABOVE short-liq", "above"), ("BELOW long-liq", "below")):
            for lv in l[key]:
                print(f"   {tag:<16} {lv['price']:<12} dist {lv['distPct']:+.2f}%   ${lv['usd']/1e6:,.1f}M  str {lv['strength']:.0f}  {lv['lev']}")

# ---------------- notifications, plausibility-filtered ----------------
notes = get("/notifications?limit=200", 30).get("items", [])
fresh = [n for n in notes if now_ms - n.get("ts", 0) < 6 * 3600 * 1000]
seen, uniq = set(), []
for n in sorted(fresh, key=lambda x: -x.get("ts", 0)):
    k = (n.get("asset"), n.get("title"))
    if k not in seen:
        seen.add(k)
        uniq.append(n)

def plausible_wall(n):
    """Re-check pre-fix whale walls vs live price: ask>=mkt, bid<=mkt, +-10%."""
    p = live.get(n.get("asset"))
    w = n.get("price")
    side = (n.get("meta") or {}).get("side")
    if not isinstance(p, (int, float)) or not isinstance(w, (int, float)) or not side:
        return True  # not a wall note — keep
    rel = (w - p) / p
    return (rel <= 0.005 and rel >= -0.10) if side == "bid" else (rel >= -0.005 and rel <= 0.10)

kept = [n for n in uniq if n.get("kind") != "whale_wall" or plausible_wall(n)]
dropped = len(uniq) - len(kept)
print()
print("=" * 110)
print(f"PHASE A2 — FILTERED NOTIFICATIONS (6h, {len(kept)} kept, {dropped} implausible walls dropped)")
print("=" * 110)
prio = {"high": 0, "info": 1}
kept.sort(key=lambda n: (prio.get(n.get("severity"), 2), -n.get("ts", 0)))
for n in kept[:40]:
    print(f"[{n['severity'].upper():<4}] {ago(n['ts']):5.0f}m  {n['asset']:<5} {n['dir']:<8} {n.get('title','')[:92]}")

# net bias from FILTERED notes
bias = {}
for n in fresh:
    if n.get("kind") == "whale_wall" and not plausible_wall(n):
        continue
    d = 1 if n.get("dir") == "bullish" else -1
    w = 2 if n.get("severity") == "high" else 1
    bias[n.get("asset")] = bias.get(n.get("asset"), 0) + d * w
print()
print("NET 6h BIAS (filtered):")
for a, v in sorted(bias.items(), key=lambda kv: -kv[1]):
    print(f"   {a:<5} {v:+4d}   {'+' * min(v,12) if v>0 else '-' * min(-v,12)}")

# ---------------- Phase B: market context for candidates ----------------
CANDS = sys.argv[1].split(",") if len(sys.argv) > 1 else ["XRP", "BTC", "ETH", "XAU", "XAG", "SOL"]
print()
print("=" * 110)
print(f"PHASE B — MARKET CONTEXT: {', '.join(CANDS)}")
print("=" * 110)
for s in CANDS:
    try:
        m = get(f"/market?sym={s}", 90)
    except Exception as e:
        print(f"{s}: market fetch failed: {e}")
        continue
    pr = m.get("price", {})
    last = live.get(s) or pr.get("last")
    rsi = m.get("rsi", {})
    vw = m.get("vwap", {})
    day = m.get("auction", {}).get("day", {}) or {}
    print(f"\n{s} — live {last}  day {pr.get('chgDayPct'):+.2f}%  range {pr.get('dayLow')}–{pr.get('dayHigh')}")
    print(f"   RSI  m15 {rsi.get('m15')}  h1 {rsi.get('h1')}  h4 {rsi.get('h4')}  d1 {rsi.get('d1')}")
    if isinstance(vw, dict):
        pos = vw.get("band") or vw.get("position") or "?"
        v = vw.get("vwap")
        sd = vw.get("sd") or vw.get("sigma")
        print(f"   day VWAP {v}  pos {pos}  sd {sd}")
    if day:
        print(f"   day POC {day.get('poc')}  VAH {day.get('vah')}  VAL {day.get('val')}")
    try:
        c = get(f"/cvd?sym={s}", 60)
        divs = c.get("divergences", [])
        print(f"   CVD {c.get('cvd')}  24hΔ {c.get('delta24h')}  divergences(24h): {len(divs)}")
        for dv in divs[-2:]:
            print(f"      {dv.get('dir')} p {dv.get('p0')}→{dv.get('p1')}")
    except Exception:
        pass
