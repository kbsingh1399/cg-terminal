#!/usr/bin/env bash
# E2E endpoint sweep: every route with BTC (control), XRP (the reported bug), XAU (metal edge case)
set -u
B="http://localhost:3200"
declare -a TESTS=(
  "bookwalls|sym=BTC"
  "bookwalls|sym=XRP"
  "bookwalls|sym=ETH"
  "bookwalls|sym=XAU"
  "bookwalls|sym=XAU&market=spot"
  "bookwalls|sym=XRP&interval=1m&limit=60"
  "stopmap|sym=BTC"
  "stopmap|sym=XRP"
  "market|sym=XRP"
  "market|sym=XAU"
  "cvd|sym=XRP"
  "fp|sym=XRP&itv=m15&limit=60"
  "fp|sym=XAU&itv=m15&limit=60"
  "liqlevels|sym=XRP&range=3d"
  "liqlevels|sym=XAU&range=3d"
  "lto|symbol=XRP"
  "ticker|sym=XRP"
  "orderflow-agg|sym=XRP&interval=m15&limit=60"
  "orderflow-agg|sym=XAU&interval=m15&limit=60"
  "signals|sym=XRP"
)
for t in "${TESTS[@]}"; do
  route="${t%%|*}"; qs="${t#*|}"
  out=$(curl -s -m 100 "$B/api/cg/$route?$qs")
  ok=$(echo "$out" | head -c 400 | grep -o '"ok":[a-z]*' | head -1)
  # extract a distinguishing value per route
  case "$route" in
    bookwalls) val=$(echo "$out" | grep -o '"price":[0-9.]*' | head -1);;
    stopmap)   val=$(echo "$out" | grep -o '"lastPrice":[0-9.]*' | head -1);;
    market)    val=$(echo "$out" | grep -o '"last":[0-9.]*' | head -1);;
    cvd)       val=$(echo "$out" | grep -o '"sym":"[A-Z]*"' | head -1);;
    fp)        val=$(echo "$out" | grep -o '"sym":"[A-Z]*"' | head -1);;
    liqlevels) val=$(echo "$out" | grep -o '"last":[0-9.]*' | head -1);;
    lto)       val=$(echo "$out" | grep -o '"openOrders":[0-9]*' | head -1);;
    ticker)    val=$(echo "$out" | grep -o '"price":[0-9.]*' | head -1);;
    orderflow-agg) val=$(echo "$out" | grep -o '"venuesOk":[0-9]*' | head -1);;
    signals)   val=$(echo "$out" | grep -o '"all":[0-9]*' | head -1);;
  esac
  err=$(echo "$out" | grep -o '"error":"[^"]*"' | head -1 | head -c 140)
  printf "%-24s %-28s %-14s %-22s %s\n" "$route" "$qs" "$ok" "$val" "$err"
done
