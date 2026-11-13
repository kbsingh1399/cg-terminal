const fs = require('fs');

async function checkAssets() {
  const base = 'http://127.0.0.1:3000';
  const syms = ['ETH', 'SOL', 'XAU', 'DOGE', 'XRP'];
  
  for (const s of syms) {
    console.log(`\n=================== ${s} ===================`);
    const m = await fetch(`${base}/api/cg/market?sym=${s}`).then(r => r.json()).catch(() => null);
    const l = await fetch(`${base}/api/cg/liqlevels?sym=${s}&range=3d`).then(r => r.json()).catch(() => null);
    const n = await fetch(`${base}/api/cg/narrative?sym=${s}`).then(r => r.json()).catch(() => null);
    
    if (m?.ok) {
      const v = m.vwap?.day;
      const sd1 = v?.bands?.sd1 || 0;
      console.log(`Price: ${m.price?.last} | Day VWAP: ${v?.vwap?.toFixed(2)} | -1σ: ${(v?.vwap - sd1)?.toFixed(2)} | +1σ: ${(v?.vwap + sd1)?.toFixed(2)}`);
      console.log(`H4 EMA13: ${m.ema?.h4?.e13?.toFixed(2)} | H4 EMA89: ${m.ema?.h4?.e89?.toFixed(2)} | Regime: ${n?.regime} (${n?.direction}, Grade: ${n?.grade})`);
    }
    if (l?.ok && l.stats) {
      console.log(`Liq Totals: Shorts Above $${(l.stats.totals?.shorts || 0).toFixed(0)}K vs Longs Below $${(l.stats.totals?.longs || 0).toFixed(0)}K`);
      const topAbove = (l.stats.keyLevels?.above || []).slice(0, 2);
      const topBelow = (l.stats.keyLevels?.below || []).slice(0, 2);
      console.log(`Top Shorts Above: ${topAbove.map(x => x.price + ' (+' + x.distPct?.toFixed(1) + '%, str:' + x.strength?.toFixed(0) + ')').join(' | ')}`);
      console.log(`Top Longs Below: ${topBelow.map(x => x.price + ' (' + x.distPct?.toFixed(1) + '%, str:' + x.strength?.toFixed(0) + ')').join(' | ')}`);
    }
  }
}

checkAssets().catch(console.error);
