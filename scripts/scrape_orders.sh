#!/bin/bash
OUT=/home/z/my-project/data/orders_raw.txt
> $OUT
for i in $(seq 1 30); do
  agent-browser eval "(()=>{const out=[]; document.querySelectorAll('div').forEach(d=>{const t=(d.textContent||''); if(/^[A-Z0-9]{2,10}$/.test(t.trim()) && d.querySelector===undefined) return;}); const rows=[]; const groups=document.querySelectorAll('[role=group], div'); groups.forEach(g=>{ if(g.onclick && g.textContent && g.textContent.includes('Limit')) { const c=g.children; if(c.length>=5) rows.push(g.textContent.replace(/\\n+/g,'|')) }}); return JSON.stringify(rows)})()" 2>/dev/null | tail -1 >> $OUT
  agent-browser keydown Page_Down 2>/dev/null || agent-browser press Page_Down 2>/dev/null
  sleep 1.2
done
wc -l $OUT
