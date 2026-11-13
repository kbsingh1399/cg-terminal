const fs = require('fs');
const http = require('http');

async function fetchJson(path) {
  return new Promise((resolve) => {
    http.get('http://localhost:3000' + path, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve(null);
        }
      });
    }).on('error', (e) => {
      resolve(null);
    });
  });
}

async function run() {
  const mt5 = JSON.parse(fs.readFileSync('desk/mt5.json', 'utf8'));
  const symbols = ['BTC', 'ETH', 'XAU', 'XLM', 'XRP'];
  const results = {};

  for (const sym of symbols) {
    console.log(`\n================ SCANNING ${sym} ================`);
    const [market, narrative, signals, walls, lto, liqs, cvd, options, oi] = await Promise.all([
      fetchJson(`/api/cg/market?symbol=${sym}`),
      fetchJson(`/api/cg/narrative?symbol=${sym}`),
      fetchJson(`/api/cg/signals?symbol=${sym}`),
      fetchJson(`/api/cg/bookwalls?market=${sym}&limit=100`),
      fetchJson(`/api/cg/lto?symbol=${sym}`),
      fetchJson(`/api/cg/liqlevels?symbol=${sym}`),
      fetchJson(`/api/cg/cvd?market=${sym}&limit=50`),
      (sym === 'BTC' || sym === 'ETH') ? fetchJson(`/api/cg/options?symbol=${sym}`) : Promise.resolve(null),
      fetchJson(`/api/cg/oi?symbol=${sym}`)
    ]);

    const brokerKey = sym === 'BTC' ? 'BTCUSD' : sym === 'ETH' ? 'ETHUSD' : sym === 'XAU' ? 'XAUUSD' : sym === 'XLM' ? 'XLMUSD' : 'XRPUSD';
    const brokerSpread = mt5.spreads[brokerKey] || {};

    const price = market?.price?.last || narrative?.market?.price || 0;
    const vwap = narrative?.market?.vwap?.vwap || 0;
    const sd1 = narrative?.market?.vwap?.bands?.sd1 || 1;
    const z = sd1 > 0 ? (price - vwap) / sd1 : 0;

    // Auction profile
    const dayVal = narrative?.market?.auction?.day?.val || 0;
    const dayPoc = narrative?.market?.auction?.day?.poc || 0;
    const dayVah = narrative?.market?.auction?.day?.vah || 0;
    const monthPoc = narrative?.market?.auction?.month?.poc || 0;

    // EMAs
    const emaH4 = narrative?.market?.ema?.h4 || {};
    const emaD1 = narrative?.market?.ema?.d1 || {};
    const h4Trend = (emaH4.e13 && emaH4.e89) ? (emaH4.e13 > emaH4.e89 ? 'BULL' : 'BEAR') : 'UNKNOWN';
    const d1Trend = (emaD1.e13 && emaD1.e89) ? (emaD1.e13 > emaD1.e89 ? 'BULL' : 'BEAR') : 'UNKNOWN';

    // Liquidations ±2%
    let shortLiqAbove2Pct = 0;
    let longLiqBelow2Pct = 0;
    const clusters = liqs?.clusters || liqs?.levels || [];
    for (const c of clusters) {
      const p = c.price || c.p || 0;
      const vol = c.usd || c.vol || c.amount || 0;
      if (price > 0 && p > price && p <= price * 1.02) {
        shortLiqAbove2Pct += vol;
      } else if (price > 0 && p < price && p >= price * 0.98) {
        longLiqBelow2Pct += vol;
      }
    }

    const minLiq = Math.min(shortLiqAbove2Pct, longLiqBelow2Pct) || 1;
    const maxLiq = Math.max(shortLiqAbove2Pct, longLiqBelow2Pct) || 1;
    const lsr = maxLiq / minLiq;
    const dominantSide = shortLiqAbove2Pct >= longLiqBelow2Pct ? 'SHORT_LIQ_ABOVE' : 'LONG_LIQ_BELOW';

    results[sym] = {
      price,
      vwap,
      z,
      dayVal,
      dayPoc,
      dayVah,
      monthPoc,
      h4Trend,
      d1Trend,
      shortLiqAbove2Pct,
      longLiqBelow2Pct,
      lsr,
      dominantSide,
      signalsCount: signals?.signals?.length || 0,
      signals: (signals?.signals || []).slice(-5),
      bookwalls: {
        imbalance: walls?.imbalance || 0,
        bidsUSD: walls?.totalBidUSD || 0,
        asksUSD: walls?.totalAskUSD || 0,
        confirmedWalls: (walls?.walls || []).slice(0, 5)
      },
      options: options ? {
        regime: options.regime || options.gexRegime || 'UNKNOWN',
        gammaFlip: options.gammaFlip || 0,
        maxPain: options.maxPain || 0
      } : null,
      broker: {
        spreadPct: brokerSpread.spreadPct || 0,
        basisPct: brokerSpread.basisPct || 0,
        bid: brokerSpread.bid || 0,
        ask: brokerSpread.ask || 0
      }
    };

    console.log(`Price: ${price} | VWAP: ${vwap.toFixed(2)} | z: ${z.toFixed(2)}σ`);
    console.log(`Day Auction: VAL ${dayVal} | POC ${dayPoc} | VAH ${dayVah} | Month POC ${monthPoc}`);
    console.log(`Trend: H4 ${h4Trend} | D1 ${d1Trend}`);
    console.log(`Liq ±2%: Above $${(shortLiqAbove2Pct/1e6).toFixed(2)}M vs Below $${(longLiqBelow2Pct/1e6).toFixed(2)}M | LSR: ${lsr.toFixed(2)}:1 (${dominantSide})`);
    console.log(`Broker Spread: ${(brokerSpread.spreadPct||0).toFixed(4)}% | Basis: ${(brokerSpread.basisPct||0).toFixed(4)}%`);
  }

  fs.writeFileSync('desk/telemetry_summary.json', JSON.stringify(results, null, 2));
  console.log('\nSaved desk/telemetry_summary.json');
}

run();
