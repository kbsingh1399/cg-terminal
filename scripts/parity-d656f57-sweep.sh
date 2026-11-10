#!/usr/bin/env bash
# Runtime asset-switch parity sweep against standalone server @ d656f57
B="http://127.0.0.1:3171"
J='curl -s -m 40'
echo "=== 0. engine status + home ==="
$J "$B/api/cg/engine/status" | head -c 220; echo
curl -s -o /dev/null -w "GET / -> %{http_code}\n" "$B/"

echo "=== 1. BTC baseline (full 5-venue futures aggregate) ==="
$J "$B/api/cg/market?sym=BTC" | python3 -c 'import json,sys;d=json.load(sys.stdin);print("market BTC:",d.get("sym"),d.get("last"))' 2>/dev/null
$J "$B/api/cg/bookwalls?sym=BTC" | python3 -c 'import json,sys;d=json.load(sys.stdin);print("bookwalls BTC: ok=",d.get("ok"),"mid=",d.get("mid"),"venues=",d.get("venues"),"minWallUsd=",d.get("minWallUsd"))' 2>/dev/null

echo "=== 2. XRP (altcoin -> Binance+Hyperliquid route) ==="
$J "$B/api/cg/market?sym=XRP" | python3 -c 'import json,sys;d=json.load(sys.stdin);print("market XRP:",d.get("sym"),d.get("last"))' 2>/dev/null
$J "$B/api/cg/ticker?sym=XRP" | python3 -c 'import json,sys;d=json.load(sys.stdin);print("ticker XRP:",d.get("sym"),d.get("price"),"live=",d.get("ok") and not d.get("stale"))' 2>/dev/null
$J "$B/api/cg/bookwalls?sym=XRP" | python3 -c 'import json,sys;d=json.load(sys.stdin);print("bookwalls XRP: ok=",d.get("ok"),"mid=",d.get("mid"),"venues=",d.get("venues"))' 2>/dev/null
$J "$B/api/cg/bookwalls?sym=XRP&market=spot" | python3 -c 'import json,sys;d=json.load(sys.stdin);print("bookwalls XRP spot: ok=",d.get("ok"),"mid=",d.get("mid"),"venues=",d.get("venues"))' 2>/dev/null

echo "=== 3. XAU (metal -> Binance-only route) ==="
$J "$B/api/cg/market?sym=XAU" | python3 -c 'import json,sys;d=json.load(sys.stdin);print("market XAU:",d.get("sym"),d.get("last"))' 2>/dev/null
$J "$B/api/cg/bookwalls?sym=XAU" | python3 -c 'import json,sys;d=json.load(sys.stdin);print("bookwalls XAU: ok=",d.get("ok"),"mid=",d.get("mid"),"venues=",d.get("venues"),"minWallUsd=",d.get("minWallUsd"))' 2>/dev/null
echo "--- XAU spot (expect clean 400, metals have no spot books):"
$J -w " [%{http_code}]" "$B/api/cg/bookwalls?sym=XAU&market=spot" | head -c 260; echo
echo "--- stopmap XRP (expect clean 400, BTC-only):"
$J -w " [%{http_code}]" "$B/api/cg/stopmap?sym=XRP" | head -c 260; echo

echo "=== 4. remaining panels per symbol (XRP / XAG) ==="
for ep in "fp?sym=XRP" "cvd?sym=XRP" "liqlevels?sym=XRP" "orderflow-agg?sym=XRP" "lto?sym=XRP" "signals?sym=XRP"; do
  $J "$B/api/cg/$ep" | head -c 150; echo "   <- $ep"
done
$J "$B/api/cg/market?sym=XAG" | python3 -c 'import json,sys;d=json.load(sys.stdin);print("market XAG:",d.get("sym"),d.get("last"))' 2>/dev/null

echo "=== 5. back to BTC (values must return, no stale alt data) ==="
$J "$B/api/cg/market?sym=BTC" | python3 -c 'import json,sys;d=json.load(sys.stdin);print("market BTC:",d.get("sym"),d.get("last"))' 2>/dev/null
$J "$B/api/cg/ticker?sym=BTC" | python3 -c 'import json,sys;d=json.load(sys.stdin);print("ticker BTC:",d.get("sym"),d.get("price"))' 2>/dev/null
