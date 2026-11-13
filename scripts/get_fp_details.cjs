const fs = require('fs');

async function getFootprint() {
  const base = 'http://127.0.0.1:3000';
  for (const s of ['BTC', 'ETH']) {
    console.log(`\n=================== ${s} 15M FOOTPRINT BARS ===================`);
    const fp = await fetch(`${base}/api/cg/footprint?sym=${s}&interval=m15&limit=6`).then(r => r.json()).catch(() => null);
    if (fp?.ok && fp.bars) {
      for (const b of fp.bars) {
        const time = new Date(b.ts).toISOString().slice(11, 16);
        const delta = (b.deltaUsd / 1e6).toFixed(2);
        const buy = (b.buyUsd / 1e6).toFixed(1);
        const sell = (b.sellUsd / 1e6).toFixed(1);
        console.log(`${time} UTC | O:${b.open} H:${b.high} L:${b.low} C:${b.close} | POC:${b.poc} | Vol:$${((b.volUsd||0)/1e6).toFixed(1)}M | Delta:$${delta}M (${b.deltaPct}%) | Buy/Sell: $${buy}M / $${sell}M`);
      }
    }
  }
}

getFootprint().catch(console.error);
