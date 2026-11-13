const fs = require('fs');

async function deepDive() {
  const base = 'http://127.0.0.1:3000';
  for (const sym of ['ETH', 'XAU', 'XAG']) {
    console.log(`\n=================== DEEP DIVE: ${sym} ===================`);
    const [mkt, nar, liq, walls, qnt] = await Promise.all([
      fetch(`${base}/api/cg/market?sym=${sym}`).then(r => r.json()),
      fetch(`${base}/api/cg/narrative?sym=${sym}`).then(r => r.json()),
      fetch(`${base}/api/cg/liqlevels?sym=${sym}&range=3d`).then(r => r.json()),
      fetch(`${base}/api/cg/bookwalls?market=Binance_${sym}USDT&interval=m15`).then(r => r.json()).catch(() => null),
      fetch(`${base}/api/cg/quant?sym=${sym}`).then(r => r.json()).catch(() => null),
    ]);

    console.log(`Price: Last ${mkt.price?.last} | Day High: ${mkt.price?.dayHigh} | Day Low: ${mkt.price?.dayLow}`);
    console.log(`H4 EMA13: ${mkt.ema?.h4?.e13?.toFixed(2)} | H4 EMA89: ${mkt.ema?.h4?.e89?.toFixed(2)} | H4 EMA233: ${mkt.ema?.h4?.e233?.toFixed(2)}`);
    console.log(`H1 EMA13: ${mkt.ema?.h1?.e13?.toFixed(2)} | H1 EMA89: ${mkt.ema?.h1?.e89?.toFixed(2)}`);
    console.log(`Auction Day: POC=${mkt.auction?.day?.poc} | VAH=${mkt.auction?.day?.vah} | VAL=${mkt.auction?.day?.val}`);
    console.log(`Auction Session: POC=${mkt.auction?.session?.poc} | VAH=${mkt.auction?.session?.vah} | VAL=${mkt.auction?.session?.val}`);
    if (mkt.vwap?.day) {
      const v = mkt.vwap.day;
      const sd1 = v.bands?.sd1 || 0;
      const sd2 = v.bands?.sd2 || 0;
      console.log(`Day VWAP: ${v.vwap?.toFixed(2)} | +1σ: ${(v.vwap+sd1)?.toFixed(2)} | -1σ: ${(v.vwap-sd1)?.toFixed(2)} | -2σ: ${(v.vwap-sd2)?.toFixed(2)}`);
    }

    if (liq?.stats) {
      console.log(`Liq Top 3 Above:`);
      for (const a of (liq.stats.keyLevels?.above || []).slice(0, 3)) {
        console.log(`  - Px: ${a.price} (+${a.distPct?.toFixed(2)}%) | Str: ${a.strength?.toFixed(0)} | Vol: $${(a.usd/1e3)?.toFixed(2)}M | Venues: ${a.venues?.join(',')}`);
      }
      console.log(`Liq Top 3 Below:`);
      for (const b of (liq.stats.keyLevels?.below || []).slice(0, 3)) {
        console.log(`  - Px: ${b.price} (${b.distPct?.toFixed(2)}%) | Str: ${b.strength?.toFixed(0)} | Vol: $${(b.usd/1e3)?.toFixed(2)}M | Venues: ${b.venues?.join(',')}`);
      }
    }

    if (qnt?.ok && qnt.supported !== false) {
      console.log(`Quant: 8h Funding: ${(qnt.funding?.oiWeightedRate8h*100)?.toFixed(4)}% | L/S 1h: ${qnt.lsRatios?.['1h']?.global?.ratio} | Basis: ${qnt.basis?.basisPct?.toFixed(3)}%`);
    }

    if (walls?.ok && walls.model) {
      console.log(`Walls: Imbalance: ${(walls.model.imbalance*100)?.toFixed(2)}% | Bid: $${(walls.model.depth?.bidUsd/1e6)?.toFixed(1)}M | Ask: $${(walls.model.depth?.askUsd/1e6)?.toFixed(1)}M`);
      console.log(`Top Walls:`);
      for (const w of (walls.model.walls || []).slice(0, 4)) {
        console.log(`  - ${w.side.toUpperCase()} @ ${w.price}: $${(w.notional/1e6)?.toFixed(2)}M`);
      }
    }

    if (nar?.plan?.ladder) {
      console.log(`Engine Ladder:`, nar.plan.ladder);
    }
  }
}

deepDive().catch(console.error);
