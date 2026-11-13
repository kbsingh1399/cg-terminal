const http = require('http');

async function get(path) {
  return new Promise(resolve => {
    http.get('http://127.0.0.1:3000' + path, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve(JSON.parse(d)); } catch(e) { resolve(null); }
      });
    }).on('error', () => resolve(null));
  });
}

async function run() {
  const syms = ['BTC', 'ETH', 'SOL', 'XRP', 'CL', 'XAU'];
  const candidates = [];

  for (const s of syms) {
    const [m, bw, liq, cvd, sig] = await Promise.all([
      get('/api/cg/market?sym=' + s),
      get('/api/cg/bookwalls?sym=' + s),
      get('/api/cg/liqlevels?sym=' + s),
      get('/api/cg/cvd?sym=' + s + '&itv=m15&limit=4'),
      get('/api/cg/signals?sym=' + s)
    ]);

    const price = m?.price?.last || 0;
    if (!price) continue;

    const vwap = m?.vwap?.vwap || 0;
    const sd1 = m?.vwap?.bands?.sd1 || 0;
    const sd2 = m?.vwap?.bands?.sd2 || 0;

    // Walls
    const walls = bw?.model?.walls || [];
    const asks = walls.filter(w => w.side === 'a' || w.side === 'ask');
    const bids = walls.filter(w => w.side === 'b' || w.side === 'bid');

    // Liquidation Skew
    const clusters = liq?.data?.clusters || liq?.clusters || [];
    const above = clusters.filter(c => c.price > price);
    const below = clusters.filter(c => c.price < price);
    const aboveUsd = above.reduce((a,c) => a + (c.usd || c.volUsd || 0), 0);
    const belowUsd = below.reduce((a,c) => a + (c.usd || c.volUsd || 0), 0);
    const lsr = belowUsd > 0 ? (aboveUsd / belowUsd) : (aboveUsd > 0 ? 99 : 1.0);

    // Signals
    const sigList = sig?.signals || [];
    const buySigs = sigList.filter(x => x.bias === 'BUY' || x.bias === 'LONG').length;
    const sellSigs = sigList.filter(x => x.bias === 'SELL' || x.bias === 'SHORT').length;

    candidates.push({
      sym: s,
      price,
      vwap,
      lsr: lsr.toFixed(2),
      aboveUsd: (aboveUsd/1e6).toFixed(1) + 'M',
      belowUsd: (belowUsd/1e6).toFixed(1) + 'M',
      topAsk: asks[0] ? `@${asks[0].price} ($${(asks[0].usd/1e6).toFixed(1)}M, age:${(asks[0].ageMs/3600000).toFixed(1)}h)` : 'none',
      topBid: bids[0] ? `@${bids[0].price} ($${(bids[0].usd/1e6).toFixed(1)}M, age:${(bids[0].ageMs/3600000).toFixed(1)}h)` : 'none',
      buySigs,
      sellSigs,
      cvdMode: cvd?.summary || cvd?.divergence || 'N/A'
    });
  }

  console.log(JSON.stringify(candidates, null, 2));
}

run();
