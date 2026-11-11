#!/usr/bin/env bash
# verify-live.sh — post-deploy verification (shipping-and-launch checklist).
# Asserts the FULL public path answers: edge proxy :81 -> app :3000.
# Catches the 2026-11-11 regression where the server ran on :3100 and the
# public URL returned 502 while everything looked fine locally.
set -u
BASE="${1:-http://127.0.0.1:81}"
FAIL=0

say() { echo "$1"; }
die() { say "✗ $1"; exit 1; }

code=$(curl -s -o /tmp/verify-live.html -w "%{http_code}" --max-time 15 "$BASE/" || echo 000)
[ "$code" = "200" ] || die "public path $BASE/ returned HTTP $code (expected 200)"
rg -q "Order-Flow Terminal" /tmp/verify-live.html || die "homepage HTML does not contain the terminal title"
say "✓ public path serves the terminal (HTTP 200, title present)"

code=$(curl -s -o /tmp/verify-health.json -w "%{http_code}" --max-time 10 "$BASE/api/health" || echo 000)
[ "$code" = "200" ] || die "/api/health returned HTTP $code"
python3 -c "import json;d=json.load(open('/tmp/verify-health.json'));assert d['ok'] is True;print('✓ /api/health ok — rss %dMB, uptime %ss' % (d['rssMb'], d['uptimeSec']))" || die "/api/health payload invalid"

code=$(curl -s -o /tmp/verify-eng.json -w "%{http_code}" --max-time 15 "$BASE/api/cg/engine/status" || echo 000)
[ "$code" = "200" ] || die "/api/cg/engine/status returned HTTP $code"
say "✓ engine status reachable"

say "ALL LIVE-CHECKS GREEN"
