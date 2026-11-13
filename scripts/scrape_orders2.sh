#!/bin/bash
OUT=/home/z/my-project/data/orders_raw2.txt
> $OUT
for i in $(seq 1 40); do
  agent-browser eval "(()=>{const rows=[]; document.querySelectorAll('div').forEach(g=>{ const st=getComputedStyle(g); if((st.overflowY==='auto'||st.overflowY==='scroll') && g.scrollHeight>g.clientHeight+100 && g.clientHeight>200){ g.scrollTop += 700; }}); const out=[]; document.querySelectorAll('div').forEach(g=>{const t=g.textContent||''; if(t.includes('Limit')&&t.includes('N/A')&&t.length<200&&/\$/.test(t)&&/[A-Z]{3,}/.test(t)&&t.includes('Short')||t.includes('Limit')&&t.includes('Long')&&t.includes('N/A')&&t.length<200){ const cs=g.children.length; if(cs>=5) out.push(t)}}); return JSON.stringify([...new Set(out)])})()" 2>/dev/null | tail -1 >> $OUT
  sleep 0.9
done
wc -c $OUT
