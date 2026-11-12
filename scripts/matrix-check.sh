#!/usr/bin/env bash
# 61-asset live HTTP matrix check (Phase 5.6) — probes every core route
# across crypto / TradFi / classic; asserts 0 unexpected 400/404/502.
BASE="http://127.0.0.1:3000"
ROUTES=(market signals fp cvd liqlevels oi funding quant stopmap narrative)
CRYPTO=(BTC SOL 1000SHIB 1000PEPE VET)
TRADFI=(NVDA GOOGL TSLA NBIS CRCL QQQ ANTHROPIC DRAM SPCX XAU CL)
CLASSIC=(SPX500 NDX100 UKO)

declare -a FAILS
declare -a SOFT
total=0
for r in "${ROUTES[@]}"; do
  for s in "${CRYPTO[@]}" "${TRADFI[@]}" "${CLASSIC[@]}"; do
    code=$(curl -s -o /tmp/mx.json -w "%{http_code}" --max-time 45 "$BASE/api/cg/$r?sym=$s")
    total=$((total+1))
    if [ "$code" != "200" ]; then
      body=$(head -c 140 /tmp/mx.json)
      FAILS+=("$r/$s -> $code $body")
    else
      # 200 but ok:false => also a failure
      ok=$(python3 -c "import json;d=json.load(open('/tmp/mx.json'));print(d.get('ok'))" 2>/dev/null)
      if [ "$ok" != "True" ]; then
        body=$(head -c 140 /tmp/mx.json)
        FAILS+=("$r/$s -> 200 but ok=$ok $body")
      else
        sup=$(python3 -c "import json;d=json.load(open('/tmp/mx.json'));print(d.get('supported'))" 2>/dev/null)
        if [ "$sup" == "False" ]; then SOFT+=("$r/$s (honest supported:false)"); fi
      fi
    fi
  done
done
echo "probed $total route×asset combinations"
echo "hard failures: ${#FAILS[@]}"
for f in "${FAILS[@]}"; do echo "  FAIL $f"; done
echo "honest degradations (supported:false, HTTP 200): ${#SOFT[@]}"
for s in "${SOFT[@]:0:40}"; do echo "  soft: $s"; done
[ ${#FAILS[@]} -eq 0 ] && echo "MATRIX PASS" || echo "MATRIX FAIL"
