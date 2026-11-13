const http = require('http');

async function get(path) {
  return new Promise((resolve) => {
    http.get('http://127.0.0.1:3000' + path, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch(e) { resolve(null); }
      });
    }).on('error', () => resolve(null));
  });
}

async function run() {
  const syms = ['ETH', 'BTC', 'XLM', 'XAU', 'XRP', 'SOL', 'DOGE', 'SUI', 'ADA', 'BNB'];
  for (const s of syms) {
    const m = await get('/api/cg/market?sym=' + s);
    const bw = await get('/api/cg/bookwalls?sym=' + s + '&market=futures&band=5');
    const lto = await get('/api/cg/lto?symbol=' + s + '&minVolUsd=50000');
    const price = m?.price || m?.data?.price || 0;

    console.log(`\n=================== ${s} (Spot: ${price}) ===================`);
    if (bw && (bw.ok || bw.data)) {
      const data = bw.data || bw;
      const imb = data.imbalance != null ? (data.imbalance * 100).toFixed(1) + '%' : 'N/A';
      console.log(`BookWalls: Imbalance=${imb} | BidDepth=$${((data.bidDepthUsd || 0)/1e6).toFixed(2)}M | AskDepth=$${((data.askDepthUsd || 0)/1e6).toFixed(2)}M`);
      
      const asks = (data.walls?.asks || data.asks || []).slice(0, 6).map(a => {
        const p = a.price;
        const dist = price ? (((p - price)/price)*100).toFixed(2) + '%' : '?';
        const val = ((a.usdValue || a.notional || 0)/1e6).toFixed(2);
        const age = a.ageHours != null ? a.ageHours.toFixed(1) + 'h' : (a.ageMinutes != null ? (a.ageMinutes/60).toFixed(1) + 'h' : '?');
        return `@${p} ($${val}M, +${dist}, age:${age})`;
      });
      const bids = (data.walls?.bids || data.bids || []).slice(0, 6).map(b => {
        const p = b.price;
        const dist = price ? (((price - p)/price)*100).toFixed(2) + '%' : '?';
        const val = ((b.usdValue || b.notional || 0)/1e6).toFixed(2);
        const age = b.ageHours != null ? b.ageHours.toFixed(1) + 'h' : (b.ageMinutes != null ? (b.ageMinutes/60).toFixed(1) + 'h' : '?');
        return `@${p} ($${val}M, -${dist}, age:${age})`;
      });
      console.log('  Top Confirmed Ask Walls (Whale Resistance):', asks.length ? asks.join(' | ') : 'none');
      console.log('  Top Confirmed Bid Walls (Whale Support):   ', bids.length ? bids.join(' | ') : 'none');
    } else {
      console.log('  BookWalls: None or error', bw?.error || bw?.reason);
    }

    if (lto && (lto.ok || lto.groups || lto.data)) {
      const groups = lto.groups || lto.data?.groups || [];
      console.log(`LTO (Large Resting Limit Orders): ${groups.length} groups found`);
      groups.slice(0, 6).forEach(g => {
        const p = g.price;
        const dist = price ? (((p - price)/price)*100).toFixed(2) + '%' : '?';
        const notional = ((g.notional || g.totalUsd || 0)/1e6).toFixed(2);
        console.log(`    [${g.side || 'ORDER'}] @${p} ($${notional}M, dist:${dist}, venues:${g.venues?.join(',') || g.exchange || 'Agg'})`);
      });
    } else {
      console.log('  LTO: None or error', lto?.error);
    }
  }
}

run();
