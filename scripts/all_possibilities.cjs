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
  const syms = ['BTC', 'ETH', 'XLM', 'XAG', 'XAU'];
  const results = {};

  for (const s of syms) {
    const [m, bw, liq, cvd, oi] = await Promise.all([
      get('/api/cg/market?sym=' + s),
      get('/api/cg/bookwalls?sym=' + s),
      get('/api/cg/liqlevels?sym=' + s),
      get('/api/cg/cvd?sym=' + s + '&itv=m15&limit=4'),
      get('/api/cg/oi?sym=' + s + '&itv=m15&limit=4')
    ]);

    const price = m?.price?.last || 0;
    const vwap = m?.vwap?.vwap || 0;
    const sd1 = m?.vwap?.bands?.sd1 || 0;
    const sd2 = m?.vwap?.bands?.sd2 || 0;
    const sd3 = m?.vwap?.bands?.sd3 || 0;

    // Walls
    const walls = bw?.model?.walls || [];
    const asks = walls.filter(w => w.side === 'a' || w.side === 'ask');
    const bids = walls.filter(w => w.side === 'b' || w.side === 'bid');
    const askVol = asks.reduce((a,c) => a + (c.usd || 0), 0);
    const bidVol = bids.reduce((a,c) => a + (c.usd || 0), 0);

    // Liquidations
    const clusters = liq?.data?.clusters || liq?.clusters || [];
    const aboveClusters = clusters.filter(c => c.price > price);
    const belowClusters = clusters.filter(c => c.price < price);
    const liqAboveUsd = aboveClusters.reduce((a,c) => a + (c.usd || c.volUsd || 0), 0);
    const liqBelowUsd = belowClusters.reduce((a,c) => a + (c.usd || c.volUsd || 0), 0);

    results[s] = {
      price,
      vwap,
      sd1,
      sd2,
      sd3,
      val: m?.auction?.val,
      poc: m?.auction?.poc,
      vah: m?.auction?.vah,
      askVol,
      bidVol,
      topAsks: asks.slice(0, 3).map(w => ({ p: w.price, usd: (w.usd/1e6).toFixed(2) + 'M', age: (w.ageMs/3600000).toFixed(1) + 'h' })),
      topBids: bids.slice(0, 3).map(w => ({ p: w.price, usd: (w.usd/1e6).toFixed(2) + 'M', age: (w.ageMs/3600000).toFixed(1) + 'h' })),
      liqAboveCount: aboveClusters.length,
      liqAboveUsd: (liqAboveUsd/1e6).toFixed(2) + 'M',
      liqBelowCount: belowClusters.length,
      liqBelowUsd: (liqBelowUsd/1e6).toFixed(2) + 'M',
      oiSummary: oi?.summary || oi?.data?.slice(-1)[0] || 'N/A',
      cvdMode: cvd?.summary || cvd?.divergence || 'N/A'
    };
  }

  console.log(JSON.stringify(results, null, 2));
}

run();
