#!/bin/bash
# LIVE PARITY: our CVD + book walls vs coinglass.com at the same moment.
set -u
cd /home/z/my-project
pkill -9 -f "standalone/server" 2>/dev/null; sleep 1
nohup bun run start > prod.log 2>&1 &
sleep 9
B="agent-browser"

echo "############ OURS: CVD (m15) ############"
curl -s "http://localhost:3000/api/cg/cvd?itv=m15&limit=1500&mode=total&anchor=all" --max-time 180 | python3 -c "
import json,sys
d = json.load(sys.stdin)
k = d['kpis']
print('futures CVD:', k['perpCvd']/1000, 'B | spot CVD:', k['spotCvd']/1000, 'B | buy share:', k['buyRatio'], '%')
print('latest div:', k['latestDiv'])
print('div count:', len(d['divergences']))"

echo ""
echo "############ OURS: BOOK WALLS (futures agg, m15, band 5) ############"
curl -s "http://localhost:3000/api/cg/bookwalls?market=futures&interval=m15&limit=150&band=5" --max-time 180 | python3 -c "
import json,sys
d = json.load(sys.stdin)
m = d['model']
print('last:', m['last'], '| bid depth ±5%:', round(m['depth']['bidUsd']/1e6,1), 'M | ask:', round(m['depth']['askUsd']/1e6,1), 'M')
print('imbalance:', round(m['imbalance']*100,1), '%')
bids = [w for w in m['walls'] if w['side']=='b']; asks = [w for w in m['walls'] if w['side']=='a']
mb = max(bids, key=lambda w: w['usd']) if bids else None
ma = max(asks, key=lambda w: w['usd']) if asks else None
print('max bid wall:', (mb['price'], round(mb['usd']/1e6,1)) if mb else None)
print('max ask wall:', (ma['price'], round(ma['usd']/1e6,1)) if ma else None)"

echo ""
echo "############ COINGLASS LIVE: /cvd/BTC ############"
$B open "https://www.coinglass.com/cvd/BTC" >/dev/null 2>&1
sleep 18
$B eval "document.body.innerText.slice(0, 2200)" 2>/dev/null | python3 -c "
import sys, re
t = sys.stdin.read()
# pull the KPI card region
for pat, name in [
  (r'(Futures CVD|Perp CVD)[^0-9\-+]*([+\-]?[\d.]+[KMB]?)', 'futures cvd'),
  (r'(Spot CVD)[^0-9\-+]*([+\-]?[\d.]+[KMB]?)', 'spot cvd'),
  (r'(Taker buy share|Active buy)[^0-9]*([\d.]+%)', 'buy share'),
  (r'(Bull div|Bear div)[^0-9]*([\d,]+\.?\d*)', 'latest div'),
]:
    m = re.search(pat, t, re.I)
    if m: print(f'{name}: {m.group(2)}')
print('--- raw head ---')
print(t[:800])"
