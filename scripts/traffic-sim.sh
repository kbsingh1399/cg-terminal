#!/usr/bin/env bash
# Browser-like traffic simulator — the endpoint mix the UI polls.
# /api/cg/live is hit ~4/s when the Binance WS fallback lane is active.
BASE=http://localhost:3000
while true; do
  for i in 1 2 3 4; do curl -s -o /dev/null --max-time 10 "$BASE/api/cg/live?sym=BTC"; done
  curl -s -o /dev/null --max-time 15 "$BASE/api/cg/market?sym=BTC"
  curl -s -o /dev/null --max-time 20 "$BASE/api/cg/signals?sym=BTC"
  curl -s -o /dev/null --max-time 10 "$BASE/api/cg/engine/status"
  curl -s -o /dev/null --max-time 10 "$BASE/api/cg/ticker?sym=BTC"
  curl -s -o /dev/null --max-time 15 "$BASE/api/cg/fp?sym=BTC&itv=m15"
  curl -s -o /dev/null --max-time 10 "$BASE/api/cg/notifications"
  curl -s -o /dev/null --max-time 15 "$BASE/api/cg/micro?sym=BTC"
  curl -s -o /dev/null --max-time 15 "$BASE/api/cg/orderflow?sym=BTC"
  curl -s -o /dev/null --max-time 15 "$BASE/api/cg/livebook?sym=BTC"
  curl -s -o /dev/null --max-time 15 "$BASE/api/cg/perpdepth?sym=BTC"
  curl -s -o /dev/null --max-time 15 "$BASE/api/cg/oi?sym=BTC"
  curl -s -o /dev/null --max-time 15 "$BASE/api/cg/funding?sym=BTC"
  curl -s -o /dev/null --max-time 20 "$BASE/api/cg/liqlevels?sym=BTC"
  curl -s -o /dev/null --max-time 20 "$BASE/api/cg/stopmap?sym=BTC"
  curl -s -o /dev/null --max-time 20 "$BASE/api/cg/largeorder?sym=BTC"
  curl -s -o /dev/null --max-time 15 "$BASE/api/cg/cvd?sym=BTC"
  curl -s -o /dev/null --max-time 15 "$BASE/api/cg/bookwalls?sym=BTC"
  curl -s -o /dev/null --max-time 15 "$BASE/api/cg/lto?sym=BTC"
  sleep 3
done
