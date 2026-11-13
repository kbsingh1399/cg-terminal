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

async function fetchAssetProfile(sym) {
  const [market, bookwalls, lto, signals, liqlevels] = await Promise.all([
    get('/api/cg/market?sym=' + sym),
    get('/api/cg/bookwalls?sym=' + sym),
    get('/api/cg/lto?symbol=' + sym + '&minVolUsd=100000'),
    get('/api/cg/signals?sym=' + sym),
    get('/api/cg/liqlevels?sym=' + sym)
  ]);

  const price = market?.price?.last || 0;
  const vwap = market?.vwap?.vwap || 0;
  const bands = market?.vwap?.bands || {};
  const poc = market?.auction?.poc || 0;
  const vah = market?.auction?.vah || 0;
  const val = market?.auction?.val || 0;
  const rsi = market?.rsi?.h1 || 50;

  // Book walls
  const walls = bookwalls?.model?.walls || [];
  const askWalls = walls.filter(w => w.side === 'a' || w.side === 'ask').sort((a,b) => b.usd - a.usd);
  const bidWalls = walls.filter(w => w.side === 'b' || w.side === 'bid').sort((a,b) => b.usd - a.usd);
  const imbalance = bookwalls?.model?.imbalance != null ? bookwalls.model.imbalance : 0;

  // LTO large resting orders
  let ltoBids = [];
  let ltoAsks = [];
  if (lto?.groups) {
    for (const g of lto.groups) {
      if (g.list) {
        for (const item of g.list) {
          if (item.side === 1) { // Ask / Sell
            ltoAsks.push(item);
          } else if (item.side === 2) { // Bid / Buy
            ltoBids.push(item);
          }
        }
      }
    }
  }
  ltoAsks.sort((a,b) => (b.currentUsd || 0) - (a.currentUsd || 0));
  ltoBids.sort((a,b) => (b.currentUsd || 0) - (a.currentUsd || 0));

  // Signals
  const sigList = signals?.signals || [];
  const buySigs = sigList.filter(s => s.bias === 'BUY' || s.bias === 'LONG').length;
  const sellSigs = sigList.filter(s => s.bias === 'SELL' || s.bias === 'SHORT').length;

  // Liquidation clusters
  const clusters = liqlevels?.data?.clusters || liqlevels?.clusters || [];

  return {
    sym,
    price,
    vwap,
    bands,
    poc,
    vah,
    val,
    rsi,
    imbalance,
    askWalls,
    bidWalls,
    ltoAsks,
    ltoBids,
    buySigs,
    sellSigs,
    clusters
  };
}

async function main() {
  console.log('========================================================================');
  console.log('INSTITUTIONAL WHALE ORDER & CONFLUENCE SCANNER — ' + new Date().toISOString());
  console.log('========================================================================\n');

  // 1. Audit active MT5 assets first
  const activeSyms = ['ETH', 'BTC', 'XLM', 'XAU'];
  console.log('>>> [PART 1: AUDITING ACTIVE MT5 POSITIONS & PENDING LIMITS]');
  for (const sym of activeSyms) {
    const prof = await fetchAssetProfile(sym);
    console.log(`\n-------------------------------------------------------------`);
    console.log(`ASSET: ${prof.sym} | SPOT: ${prof.price} | DAY VWAP: ${prof.vwap ? prof.vwap.toFixed(2) : 'N/A'}`);
    console.log(`Auction: VAL=${prof.val} | POC=${prof.poc} | VAH=${prof.vah} | RSI(1H)=${prof.rsi?.toFixed(1) || 'N/A'}`);
    console.log(`Book Depth Imbalance: ${(prof.imbalance * 100).toFixed(2)}% | Signals: ${prof.buySigs} Bullish / ${prof.sellSigs} Bearish`);

    console.log('\n  TOP RESTING BOOKWALLS (Whale Barriers):');
    console.log('    Top Ask Walls (Resistance):');
    prof.askWalls.slice(0, 4).forEach(w => {
      const dist = prof.price ? (((w.price - prof.price)/prof.price)*100).toFixed(2) : '?';
      console.log(`      - @${w.price} | $${(w.usd/1e6).toFixed(2)}M | Dist: +${dist}% | Age: ${(w.ageMs/3600000).toFixed(1)}h | Touched: ${w.touched}`);
    });
    console.log('    Top Bid Walls (Support):');
    prof.bidWalls.slice(0, 4).forEach(w => {
      const dist = prof.price ? (((prof.price - w.price)/prof.price)*100).toFixed(2) : '?';
      console.log(`      - @${w.price} | $${(w.usd/1e6).toFixed(2)}M | Dist: -${dist}% | Age: ${(w.ageMs/3600000).toFixed(1)}h | Touched: ${w.touched}`);
    });

    console.log('\n  TOP LTO LARGE RESTING WHALE ORDERS:');
    console.log('    Large Sell/Ask Orders:');
    prof.ltoAsks.slice(0, 4).forEach(o => {
      const dist = prof.price ? (((o.price - prof.price)/prof.price)*100).toFixed(2) : '?';
      console.log(`      - @${o.price} | $${((o.currentUsd || 0)/1e6).toFixed(2)}M | Dist: +${dist}%`);
    });
    console.log('    Large Buy/Bid Orders:');
    prof.ltoBids.slice(0, 4).forEach(o => {
      const dist = prof.price ? (((prof.price - o.price)/prof.price)*100).toFixed(2) : '?';
      console.log(`      - @${o.price} | $${((o.currentUsd || 0)/1e6).toFixed(2)}M | Dist: -${dist}%`);
    });
  }

  // 2. Scan universe for high confluence candidates
  console.log('\n\n========================================================================');
  console.log('>>> [PART 2: SCREENING UNIVERSE FOR NEW HIGH CONFLUENCE SETUPS (S1-S8)]');
  console.log('========================================================================');
  const universe = ['XRP', 'SOL', 'DOGE', 'ADA', 'BNB', 'SUI', 'AVAX', 'LINK', 'NEAR', 'CL'];
  
  for (const sym of universe) {
    const prof = await fetchAssetProfile(sym);
    if (!prof.price) continue;

    // Check if there is significant whale wall concentration (>= $5M total in top walls)
    const topAskTotal = prof.askWalls.slice(0, 3).reduce((acc, w) => acc + w.usd, 0);
    const topBidTotal = prof.bidWalls.slice(0, 3).reduce((acc, w) => acc + w.usd, 0);

    const hasSignificantWhale = (topAskTotal >= 2e6 || topBidTotal >= 2e6 || prof.ltoAsks.length > 5 || prof.ltoBids.length > 5);
    
    // Evaluate Setup S3 (Whale Wall Defense) / S2 (Value Area Edge) / S5 (VWAP Band)
    console.log(`\n-------------------------------------------------------------`);
    console.log(`ASSET: ${prof.sym} | SPOT: ${prof.price} | VWAP: ${prof.vwap ? prof.vwap.toFixed(4) : 'N/A'}`);
    console.log(`Top Ask Walls Vol: $${(topAskTotal/1e6).toFixed(2)}M | Top Bid Walls Vol: $${(topBidTotal/1e6).toFixed(2)}M`);
    console.log(`LTO Resting: ${prof.ltoAsks.length} Large Asks / ${prof.ltoBids.length} Large Bids`);
    console.log(`Signals: ${prof.buySigs} Bullish / ${prof.sellSigs} Bearish | Imbalance: ${(prof.imbalance*100).toFixed(1)}%`);

    if (topAskTotal > topBidTotal * 1.5 && prof.sellSigs > prof.buySigs) {
      console.log(`  ==> BEARISH BIAS CANDIDATE: Whale Ask Defense (S3) + Orderflow Trend`);
      const nearestAsk = prof.askWalls[0];
      if (nearestAsk) {
        console.log(`      Recommended Entry: Just front-running wall @ ${nearestAsk.price * 0.999}`);
        console.log(`      Wall Protection: $${(nearestAsk.usd/1e6).toFixed(2)}M @ ${nearestAsk.price}`);
      }
    } else if (topBidTotal > topAskTotal * 1.5 && prof.buySigs > prof.sellSigs) {
      console.log(`  ==> BULLISH BIAS CANDIDATE: Whale Bid Defense (S3) + Orderflow Trend`);
      const nearestBid = prof.bidWalls[0];
      if (nearestBid) {
        console.log(`      Recommended Entry: Just front-running wall @ ${nearestBid.price * 1.001}`);
        console.log(`      Wall Protection: $${(nearestBid.usd/1e6).toFixed(2)}M @ ${nearestBid.price}`);
      }
    } else {
      console.log(`  ==> NEUTRAL / BALANCED: Ask Vol and Bid Vol balanced; awaiting breakout.`);
    }

    if (prof.askWalls.length > 0) {
      console.log(`  Top Ask Wall: @${prof.askWalls[0].price} ($${(prof.askWalls[0].usd/1e6).toFixed(2)}M, dist: +${prof.price ? (((prof.askWalls[0].price-prof.price)/prof.price)*100).toFixed(2) : '?'}%)`);
    }
    if (prof.bidWalls.length > 0) {
      console.log(`  Top Bid Wall: @${prof.bidWalls[0].price} ($${(prof.bidWalls[0].usd/1e6).toFixed(2)}M, dist: -${prof.price ? (((prof.price-prof.bidWalls[0].price)/prof.price)*100).toFixed(2) : '?'}%)`);
    }
  }
}

main();
