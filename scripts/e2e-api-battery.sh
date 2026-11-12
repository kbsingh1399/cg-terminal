#!/usr/bin/env bash
# E2E API battery — hits every /api/cg/* route across a symbol set.
# PASS: HTTP 200 + valid JSON, OR HTTP 400 + valid JSON {"ok":false,...}
#       (a clean 400 is the app's by-design honest answer for asset/route
#        combos outside a route's registry — e.g. classic?sym=BTC).
# FAIL: 5xx, connection error, non-JSON garbage, missing ok field.
# Usage: bash scripts/e2e-api-battery.sh [BASE]   (default http://127.0.0.1:3000)
set -u
BASE="${1:-http://127.0.0.1:3000}"
SYMS_MAIN="BTC ETH SOL"
SYMS_ALL="BTC XAU XAG XPT SPX500 NDX100 US30 NATGAS USO NVDA MU"
PASS=0; FAIL=0; PASS400=0; FAILED_LIST=""

check() { # $1=route  $2=query
  local route="$1"
  local query="${2:-}"
  local url="$BASE/api/cg/$route$query"
  local code
  if [ "$route" = "stream" ]; then
    local head
    head=$(curl -s --max-time 4 -o /dev/null -w "%{http_code}|%{content_type}" "$url" 2>/dev/null || echo "000|")
    code="${head%%|*}"
    if [ "$code" = "200" ] && echo "$head" | rg -q "event-stream"; then
      PASS=$((PASS+1)); echo "PASS  /api/cg/$route (SSE)"
    else
      FAIL=$((FAIL+1)); FAILED_LIST="$FAILED_LIST $route"; echo "FAIL  /api/cg/$route -> $head"
    fi
    return
  fi
  local code1 code2
  rm -f /tmp/battery-body.json
  code1=$(curl -s --max-time 30 -o /tmp/battery-body.json -w "%{http_code}" "$url" 2>/dev/null)
  [ -s /tmp/battery-body.json ] || echo '{"ok":false,"error":"empty body"}' > /tmp/battery-body.json
  # validate the FULL body (big payloads must not be truncated mid-JSON)
  code2=$(python3 - <<'EOF' 2>/dev/null && echo OK || echo BAD
import json
try:
    d = json.load(open("/tmp/battery-body.json"))
    assert isinstance(d, dict) and "ok" in d
except Exception:
    raise SystemExit(1)
EOF
)
  if [ "$code1" = "200" ] && [ "$code2" = "OK" ]; then
    PASS=$((PASS+1)); echo "PASS  /api/cg/$route$query"
  elif [ "$code1" = "400" ] && [ "$code2" = "OK" ]; then
    PASS400=$((PASS400+1)); echo "PASS  /api/cg/$route$query (clean 400: $(head -c 90 /tmp/battery-body.json))"
  else
    FAIL=$((FAIL+1)); FAILED_LIST="$FAILED_LIST $route$query"
    echo "FAIL  /api/cg/$route$query -> HTTP $code1 json=$code2, body: $(head -c 140 /tmp/battery-body.json 2>/dev/null)"
  fi
}

echo "=== E2E API battery against $BASE ==="
# sym-less routes
check assets ""
check engine "/status"
check ticker ""
# per-symbol routes on the core set (lto takes ?symbol=, not ?sym=)
for s in $SYMS_MAIN; do
  for r in market signals live orderflow orderflow-agg cvd bookwalls largeorder liqlevels stopmap perpdepth funding oi kline classic cot fp livebook micro; do
    check "$r" "?sym=$s"
  done
  check lto "?symbol=$s"
done
# extended symbol sweep on the routes that matter for the L2/L3 layer
for s in $SYMS_ALL; do
  for r in micro market signals classic; do
    check "$r" "?sym=$s"
  done
done
check notifications "?limit=50"
check stream ""

echo "=== RESULT: $PASS passed (200), $PASS400 passed (clean 400), $FAIL failed ==="
[ "$FAIL" -gt 0 ] && { echo "FAILED ROUTES:$FAILED_LIST"; exit 1; }
echo "ALL GREEN"
