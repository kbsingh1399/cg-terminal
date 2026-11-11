#!/usr/bin/env python3
"""Cross-asset trading-opportunity scan: queries the terminal's live signal
engine for all 12 assets + the notification feed, then prints a synthesis."""
import json, time, urllib.request, sys

BASE = "http://localhost:3000/api/cg"
SYMS = ["BTC", "ETH", "SOL", "BNB", "XRP", "ADA", "AVAX", "DOGE", "LINK", "LTC", "XAU", "XAG"]

def get(path, timeout=90):
    with urllib.request.urlopen(f"{BASE}{path}", timeout=timeout) as r:
        return json.loads(r.read())

# ---------- 1. notifications feed (scanner output, all assets) ----------
try:
    notes = get("/notifications?limit=200")
    items = notes.get("items", [])
except Exception as e:
    items = []
    print(f"[warn] notifications failed: {e}", file=sys.stderr)

now_ms = int(time.time() * 1000)

# keep only fresh (last 6h) notifications
fresh = [n for n in items if now_ms - n.get("ts", 0) < 6 * 3600 * 1000]
# de-dup identical titles
seen, uniq = set(), []
for n in sorted(fresh, key=lambda x: -x.get("ts", 0)):
    k = (n.get("asset"), n.get("title"))
    if k not in seen:
        seen.add(k)
        uniq.append(n)

# high-severity first
prio = {"high": 0, "info": 1}
uniq.sort(key=lambda n: (prio.get(n.get("severity"), 2), -n.get("ts", 0)))

print("=" * 100)
print(f"RECENT SIGNALS (last 6h, {len(uniq)} unique) — sorted by severity")
print("=" * 100)
mins_ago = lambda ts: (now_ms - ts) / 60000
for n in uniq[:45]:
    print(f"[{n['severity'].upper():<4}] {mins_ago(n['ts']):5.0f}m ago  {n['asset']:<5} {n['dir']:<8} {n.get('title','')}")
    d = n.get("detail", "")
    if d:
        print(f"              {d[:150]}")

# ---------- 2. per-asset footprint signal counts ----------
print()
print("=" * 100)
print("FOOTPRINT SIGNAL ENGINE — all 12 assets (15m time / auto volume / auto range bars)")
print("=" * 100)


def sig_name(sig):
    """cgSigName port (cg-signals.ts:597) — CgSignal carries type field `t`,
    not `name` (the old reader printed `?` for every signal)."""
    t, side = sig.get("t", "?"), sig.get("side", "?")
    if t == "sdiv":
        return "Bull div" if side == "buy" else "Bear div"
    if t == "trap":
        return "Trapped shorts" if side == "buy" else "Trapped longs"
    return {"div": "Divergence", "abs": "Absorption"}.get(t, "Exhaustion")


summary = {}
for sym in SYMS:
    try:
        s = get(f"/signals?sym={sym}")
        c = s.get("counts", {})
        sets = s.get("sets", [])
        # newest signal per set — CgSignal.ts is unix SECONDS (cg-signals.ts:295);
        # the old `barTs` key never existed, so max() always returned the first row
        latest = []
        for st in sets:
            sigs = st.get("sigs", [])
            if sigs:
                newest = max(sigs, key=lambda x: x.get("ts", 0))
                age_min = (time.time() - (newest.get("ts") or 0)) / 60
                latest.append((age_min, f"{st['bt']}: {sig_name(newest)}({newest.get('side', '?')}) {age_min:.0f}m ago"))
        summary[sym] = (c, s.get("updatedAt", 0), latest)
        bulls, bears = c.get("bullish", 0), c.get("bearish", 0)
        age = (now_ms - s.get("updatedAt", 0)) / 60000
        print(f"{sym:<6} bullish={bulls:<3} bearish={bears:<3} (cache {age:4.0f}m old)")
        # newest signal per bar-type — the `latest` strings were built but never
        # printed before; show the fresh (<6h) ones so the fix is observable.
        # LOCAL name `freshTxt` — a loop-local `fresh` would shadow the module-
        # level notifications list (line 24) and crash section 3's bias table
        # with 'str' object has no attribute 'get' (adversarial review finding 1).
        freshTxt = [txt for a, txt in latest if a < 360]
        if freshTxt:
            print(f"       newest: {' · '.join(freshTxt)}")
    except Exception as e:
        print(f"{sym:<6} FAILED: {e}")

# ---------- 3. net bias table from fresh notifications ----------
print()
print("=" * 100)
print("NET 6h BIAS PER ASSET (notification engine: footprint+indicators+whale+liq+cvd)")
print("=" * 100)
bias = {}
for n in fresh:
    a = n.get("asset")
    d = 1 if n.get("dir") == "bullish" else -1
    w = 2 if n.get("severity") == "high" else 1
    bias.setdefault(a, 0)
    bias[a] += d * w
for a, v in sorted(bias.items(), key=lambda kv: -abs(kv[1])):
    bar = "+" * min(v, 15) if v > 0 else "-" * min(-v, 15)
    print(f"{a:<6} {v:+4d}  {bar}")
