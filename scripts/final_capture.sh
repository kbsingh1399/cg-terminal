#!/bin/bash
# Final capture: start server, load each tool, wait for content, screenshot.
set -u
cd /home/z/my-project
pkill -9 -f "standalone/server" 2>/dev/null; sleep 1
nohup bun run start > prod.log 2>&1 &
sleep 9
B="agent-browser"
$B open "http://localhost:3000/" >/dev/null 2>&1
$B set viewport 1600 1000 >/dev/null 2>&1

wait_content () { # $1 = JS click, $2 = min length, $3 = tries
  local CLICK="$1" MIN="$2" TRIES="$3"
  for i in $(seq 1 "$TRIES"); do
    $B eval "$CLICK" >/dev/null 2>&1
    sleep 6
    LEN=$($B eval "document.querySelector('main').innerText.length" 2>/dev/null | tr -d '"')
    if [ "${LEN:-0}" -ge "$MIN" ]; then echo "    content ok (len=$LEN)"; return 0; fi
    sleep 6
  done
  echo "    content short (len=$LEN)"
}

echo "footprint:"; wait_content "1" 2500 4; $B screenshot /tmp/render/final-footprint.png >/dev/null 2>&1
echo "large-orders:"; wait_content "(() => { const b=[...document.querySelectorAll('nav button')].find(x=>/Large Orders/.test(x.innerText)); b&&b.click(); return 1; })()" 3000 5; $B screenshot /tmp/render/final-largeorders.png >/dev/null 2>&1
$B eval "window.scrollTo(0, document.body.scrollHeight)" >/dev/null 2>&1; sleep 3; $B screenshot /tmp/render/final-whalewalls.png >/dev/null 2>&1
$B eval "window.scrollTo(0, 0)" >/dev/null 2>&1; sleep 1
echo "liq-levels:"; wait_content "(() => { const b=[...document.querySelectorAll('nav button')].find(x=>/Liq Levels/.test(x.innerText)); b&&b.click(); return 1; })()" 3000 5; $B screenshot /tmp/render/final-liqlevels.png >/dev/null 2>&1
echo "stops:"; wait_content "(() => { const b=[...document.querySelectorAll('button')].find(x=>/Stops heatmap 24h/.test(x.innerText)); b&&b.click(); return 1; })()" 2000 6; $B screenshot /tmp/render/final-stops.png >/dev/null 2>&1
echo "book-walls:"; wait_content "(() => { const b=[...document.querySelectorAll('nav button')].find(x=>/Book Walls/.test(x.innerText)); b&&b.click(); return 1; })()" 3000 6; $B screenshot /tmp/render/final-bookwalls.png >/dev/null 2>&1
echo "cvd:"; wait_content "(() => { const b=[...document.querySelectorAll('nav button')].find(x=>/^CVD/.test(x.innerText.trim())); b&&b.click(); return 1; })()" 3000 6; $B screenshot /tmp/render/final-cvd.png >/dev/null 2>&1

echo ""; ls -la /tmp/render/final-*.png | awk '{print $5, $9}'
echo "DONE"
