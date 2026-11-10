#!/bin/bash
# One-shot: fresh server -> Large Orders tab + whale walls panel + engine status (new build).
set -u
cd /home/z/my-project
pkill -9 -f "standalone/server" 2>/dev/null; pkill -9 -f "bun run start" 2>/dev/null; sleep 2
nohup bun run start > prod.log 2>&1 &
sleep 10
B="agent-browser"
$B open "http://localhost:3000/" >/dev/null 2>&1
$B set viewport 1600 1000 >/dev/null 2>&1
sleep 15

echo "### nav buttons:"
$B eval "[...document.querySelectorAll('nav button')].map(b => b.innerText.split('\n')[0]).join(' | ')" 2>/dev/null

echo ""; echo "### click Large Orders (JS):"
$B eval "(() => { const btn = [...document.querySelectorAll('nav button')].find(b => /Large Orders/.test(b.innerText)); if (!btn) return 'NO BUTTON'; btn.click(); return 'clicked'; })()" 2>/dev/null
sleep 10
$B eval "(() => document.querySelector('main').innerText.slice(0, 320).replace(/\n+/g, ' | '))()" 2>/dev/null

echo ""; echo "### whale walls panel (scroll to bottom):"
$B eval "window.scrollTo(0, document.body.scrollHeight)" >/dev/null 2>&1; sleep 3
$B eval "(() => { const el = [...document.querySelectorAll('h3')].find(x => /Whale-order walls/.test(x.innerText)); if (!el) return 'PANEL NOT FOUND'; return el.closest('div.rounded-lg').innerText.replace(/\n+/g,' | ').slice(0, 900); })()" 2>/dev/null

echo ""; echo "### engine status (fresh build):"
curl -s "http://localhost:3000/api/cg/engine/status" --max-time 60 | python3 -c "
import json,sys,datetime
d = json.load(sys.stdin)
print('engine:', d['started'], '| venues:', len(d['instrumentKeys']), '| kline gaps:', d['klineGaps'])
for s in d['series']:
    if 'bs_usd' in s['name'] and s['count'] < 100: continue
    last = datetime.datetime.fromtimestamp((s['lastTs'] or 0)/1000).strftime('%m-%d %H:%M') if s['lastTs'] else '—'
    print(f\"  {s['name'][:46]:<48} rows={s['count']:<7} last={last} err={s['lastError']} bf={s['backfilling']}\")"

echo ""; echo "### stopmap route (numbers sanity):"
curl -s "http://localhost:3000/api/cg/stopmap" --max-time 90 | python3 -c "
import json,sys
d = json.load(sys.stdin)
m = d['model']
print('price:', m['lastPrice'], '| below B:', round(m['totals']['below']/1e9,2), '| above B:', round(m['totals']['above']/1e9,2))
print('below top:', [(c['price'], round(c['usd']/1e9,1)) for c in m['clusters']['below'][:2]])
print('above top:', [(c['price'], round(c['usd']/1e9,1)) for c in m['clusters']['above'][:2]])"
echo "DONE"
