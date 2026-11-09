#!/bin/bash
# One-shot visual verification: start server, drive headless browser, capture all tools.
set -u
cd /home/z/my-project
pkill -f "bun run start" 2>/dev/null; sleep 1
nohup bun run start > prod.log 2>&1 &
SERVER_PID=$!
sleep 8

echo "=== server up: $(curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/ --max-time 30) ==="

# warm the data routes (compile + fetch)
curl -s -o /dev/null "http://localhost:3000/api/cg/stopmap" --max-time 90
curl -s -o /dev/null "http://localhost:3000/api/cg/bookwalls?market=futures&interval=m15&limit=150&band=5" --max-time 180
curl -s -o /dev/null "http://localhost:3000/api/cg/cvd?itv=m15&limit=1500&mode=total&anchor=all" --max-time 180
curl -s "http://localhost:3000/api/cg/engine/status" --max-time 60 -o /tmp/est.json
python3 - <<'PYEOF'
import json, datetime
d = json.load(open('/tmp/est.json'))
print(f"=== engine: started={d['started']} venues={len(d['instrumentKeys'])} gaps={d['klineGaps']} ===")
for s in d['series'][:26]:
    last = datetime.datetime.fromtimestamp(s['lastTs']/1000).strftime('%m-%d %H:%M') if s['lastTs'] else '—'
    print(f"  {s['name'][:46]:<48} rows={s['count']:<7} last={last} err={s['lastError']}")
PYEOF

B="agent-browser"
$B open "http://localhost:3000/" >/dev/null 2>&1; sleep 12
$B set viewport 1600 1000 >/dev/null 2>&1
$B wait --load networkidle >/dev/null 2>&1; sleep 6
mkdir -p /tmp/render
$B screenshot /tmp/render/v-footprint.png >/dev/null 2>&1

# Large Orders (whale walls panel)
$B find text "Large Orders" click >/dev/null 2>&1; sleep 10
$B screenshot /tmp/render/v-largeorders-top.png >/dev/null 2>&1
$B eval "window.scrollTo(0, document.body.scrollHeight - 1400)" >/dev/null 2>&1; sleep 3
$B screenshot /tmp/render/v-whalewalls.png >/dev/null 2>&1
$B eval "window.scrollTo(0, 0)" >/dev/null 2>&1; sleep 1

# Liq Levels + Stops
$B find text "Liq Levels + Stops" click >/dev/null 2>&1; sleep 10
$B screenshot /tmp/render/v-liqlevels.png >/dev/null 2>&1
$B find text "Stops heatmap 24h" click >/dev/null 2>&1; sleep 12
$B screenshot /tmp/render/v-stops.png >/dev/null 2>&1

# Book Walls
$B find text "Book Walls" click >/dev/null 2>&1; sleep 15
$B screenshot /tmp/render/v-bookwalls.png >/dev/null 2>&1

# CVD
$B find text "CVD" click >/dev/null 2>&1; sleep 15
$B screenshot /tmp/render/v-cvd.png >/dev/null 2>&1

# header engine indicator
$B eval "window.scrollTo(0, 0)" >/dev/null 2>&1; sleep 2
$B screenshot /tmp/render/v-header.png >/dev/null 2>&1

echo "=== screenshots: $(ls /tmp/render/v-*.png | wc -l) ==="
ls -la /tmp/render/v-*.png | awk '{print $5, $9}'
echo "=== keeping server alive for 60s more ==="
sleep 60
curl -s -o /dev/null -w "final http %{http_code}\n" http://localhost:3000/ --max-time 30
