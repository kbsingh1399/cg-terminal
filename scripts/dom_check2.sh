#!/bin/bash
# Final DOM verification with per-tool KPI targeting (post-fix build).
set -u
cd /home/z/my-project
pkill -f "bun run start" 2>/dev/null; sleep 1
nohup bun run start > prod.log 2>&1 &
sleep 8
B="agent-browser"
$B open "http://localhost:3000/" >/dev/null 2>&1
$B set viewport 1600 1000 >/dev/null 2>&1
sleep 15

# per-tool: capture the tool panel text (main element), skip the hidden engine hover table
TOOLTEXT='(() => {
  const main = document.querySelector("main");
  const clone = main.cloneNode(true);
  clone.querySelectorAll(".invisible").forEach((e) => e.remove());
  const txt = clone.innerText.replace(/\n+/g, " | ").slice(0, 1500);
  const bad = (txt.match(/NaN|undefined|Infinity/g) || []).length;
  const canvases = [...main.querySelectorAll("canvas")].map((c) => {
    const ctx = c.getContext("2d");
    if (!c.width || !c.height || !ctx) return "empty";
    const d = ctx.getImageData(0, 0, c.width, c.height).data;
    let lit = 0, total = 0;
    for (let i = 0; i < d.length; i += 40) { total++; if (d[i] > 30 || d[i+1] > 30 || d[i+2] > 30) lit++; }
    return Math.round(100 * lit / total) + "% lit";
  });
  return JSON.stringify({ bad, canvases, txt });
})()'

echo "##### FOOTPRINT #####"
$B eval "$TOOLTEXT" 2>/dev/null | python3 -c "import json,sys; d=json.loads(json.load(sys.stdin)) if False else json.loads(sys.stdin.read()); print('bad:', d['bad'], '| canvases:', d['canvases']); print(d['txt'][:600])" 2>/dev/null || $B eval "$TOOLTEXT" 2>/dev/null | head -3

$B find text "Large Orders" click >/dev/null 2>&1; sleep 9
echo ""; echo "##### LARGE ORDERS #####"
$B eval "$TOOLTEXT" 2>/dev/null | head -2
echo "--- scroll to whale walls ---"
$B eval "window.scrollTo(0, document.body.scrollHeight)" >/dev/null 2>&1; sleep 3
$B eval "(() => { const h = [...document.querySelectorAll('h3')].map(x => x.innerText.split('\n')[0]); return JSON.stringify(h); })()" 2>/dev/null
$B eval "(() => { const el = [...document.querySelectorAll('h3')].find(x => /Whale-order walls/.test(x.innerText)); if (!el) return 'PANEL NOT FOUND'; const p = el.closest('div'); return p.innerText.replace(/\n+/g,' | ').slice(0, 700); })()" 2>/dev/null
$B eval "window.scrollTo(0, 0)" >/dev/null 2>&1; sleep 1

$B find text "Liq Levels + Stops" click >/dev/null 2>&1; sleep 9
echo ""; echo "##### LIQ LEVELS #####"
$B eval "$TOOLTEXT" 2>/dev/null | head -2

$B find text "Stops heatmap 24h" click >/dev/null 2>&1; sleep 13
echo ""; echo "##### STOPS #####"
$B eval "$TOOLTEXT" 2>/dev/null | head -2

$B find text "Book Walls" click >/dev/null 2>&1; sleep 16
echo ""; echo "##### BOOK WALLS #####"
$B eval "$TOOLTEXT" 2>/dev/null | head -2

$B find text "CVD" click >/dev/null 2>&1; sleep 15
echo ""; echo "##### CVD #####"
$B eval "$TOOLTEXT" 2>/dev/null | head -2

echo ""; echo "##### ENGINE STATUS ROUTE #####"
curl -s "http://localhost:3000/api/cg/engine/status" --max-time 60 | python3 -c "
import json,sys,datetime
d = json.load(sys.stdin)
print('engine:', d['started'], '| venues:', len(d['instrumentKeys']), '| kline gaps:', d['klineGaps'])
for s in d['series']:
    last = datetime.datetime.fromtimestamp((s['lastTs'] or 0)/1000).strftime('%m-%d %H:%M') if s['lastTs'] else '—'
    print(f\"  {s['name'][:46]:<48} rows={s['count']:<7} last={last} err={s['lastError']} bf={s['backfilling']}\")"
echo "DONE"
