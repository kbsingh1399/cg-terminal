#!/usr/bin/env bash
# Live-verification probe: every route must return fresh, moving data and
# the price ladder (WS-grade fapi vs Coinglass) must agree.
set -u
B=http://localhost:3000

echo "=== 1. Price ladder agreement (Binance direct vs /api/cg/live vs CG ticker) ==="
FAPI=$(curl -s --max-time 6 "https://fapi.binance.com/fapi/v1/ticker/bookTicker?symbol=BTCUSDT")
LIVE=$(curl -s --max-time 6 "$B/api/cg/live?sym=BTC")
CG=$(curl -s --max-time 8 "$B/api/cg/ticker?sym=BTC")
python3 - "$FAPI" "$LIVE" "$CG" <<'EOF'
import json, sys
fapi, live, cg = (json.loads(x) for x in sys.argv[1:4])
fb = float(fapi["bidPrice"]); fa = float(fapi["askPrice"]); fmid = (fb + fa) / 2
lp = live.get("price"); cp = cg.get("price")
print(f"fapi direct     : bid {fb} ask {fa} mid {fmid:.2f}")
print(f"/api/cg/live    : {lp} (source {live.get('source')}, age {live.get('ageMs')}ms)")
print(f"/api/cg/ticker  : {cp} (age {cg.get('ageMs')}ms)")
d1 = abs((lp or 0) - fmid) if lp else None
d2 = abs((cp or 0) - fmid) if cp else None
print(f"|live - fapi|   : {d1:.2f}" if d1 is not None else "live: n/a")
print(f"|cg   - fapi|   : {d2:.2f}" if d2 is not None else "cg: n/a")
ok = d1 is not None and d1 <= max(5, fmid * 0.0005)
print("PRICE-AGREEMENT:", "PASS" if ok else "FAIL")
EOF

echo ""
echo "=== 2. /api/cg/live freshness (two fetches 400ms apart, TTL=250ms → must refetch) ==="
A=$(curl -s "$B/api/cg/live?sym=BTC" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['fetchedAt'], d['price'])")
sleep 0.4
Bv=$(curl -s "$B/api/cg/live?sym=BTC" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['fetchedAt'], d['price'])")
echo "fetch1: $A"; echo "fetch2: $Bv"

echo ""
echo "=== 3. /api/cg/livebook ring growth + wall detection (4 polls, 2s apart) ==="
for i in 1 2 3 4; do
  curl -s "$B/api/cg/livebook?sym=BTC&band=5&grid=40" | python3 -c "
import json,sys
d=json.load(sys.stdin)
m=d['model']
print(f\"  poll: snaps={m['snapshots']:3d} walls={len(m['walls']):2d} events={len(m['events']):2d} imb={(m['imbalance'] or 0)*100:+.2f}% last={m['last']['price']}\")"
  sleep 2
done

echo ""
echo "=== 4. /api/cg/fp live lane (limit=8, TTL=8s) — forming bar must move ==="
for i in 1 2 3; do
  curl -s "$B/api/cg/fp?sym=BTC&itv=m15&limit=8&live=1" | python3 -c "
import json,sys
d=json.load(sys.stdin)
b=d['bars'][-1]
tot=sum(b['fp']['b'])+sum(b['fp']['s']) if b.get('fp') else 0
print(f\"  forming ts={b['ts']} close={b['c']} totalVol={tot:.1f} venues={d.get('venues')} updated={d.get('updatedAt')}\")"
  sleep 6
done

echo ""
echo "=== 5. Aggregate bookwalls (18s cache) responds ok ==="
curl -s "$B/api/cg/bookwalls?sym=BTC&market=futures&interval=m15&limit=150&band=5" | python3 -c "
import json,sys
d=json.load(sys.stdin)
m=d['model']
print(f\"  ok={d['ok']} snaps={m['snapshots']} walls={len(m['walls'])} depth bid=\${m['depth']['bidUsd']/1e9:.2f}B ask=\${m['depth']['askUsd']/1e9:.2f}B grid={m['grid']}\")"

echo ""
echo "=== 6. All other routes 200 + fresh ==="
for url in "market?sym=BTC" "signals?sym=BTC" "cvd?sym=BTC&itv=m15&limit=200&mode=total&anchor=all" "lto?symbol=BTC&minVolUsd=1000000" "liqlevels?sym=BTC&range=3d&lvR=4" "stopmap?sym=BTC" "engine/status"; do
  code=$(curl -s -o /tmp/probe.json -w "%{http_code}" --max-time 25 "$B/api/cg/$url")
  ok=$(python3 -c "import json; d=json.load(open('/tmp/probe.json')); print(d.get('ok', 'n/a'))" 2>/dev/null || echo parse-err)
  echo "  /api/cg/$url → HTTP $code ok=$ok"
done

echo ""
echo "=== 7. Metals on the live routes (XAU / XAG) ==="
for s in XAU XAG; do
  curl -s --max-time 8 "$B/api/cg/live?sym=$s" | python3 -c "
import json,sys
d=json.load(sys.stdin)
print(f\"  $s: price={d.get('price')} source={d.get('source')} ok={d.get('ok')}\")"
done
