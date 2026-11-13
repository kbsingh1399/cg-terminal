// Direct invocation of the terminal analysis tools
const base = 'http://127.0.0.1:3000';

async function fetchJson(path) {
  const r = await fetch(`${base}${path}`);
  return r.json();
}

async function main() {
  console.log('=== RUNNING MCP-EQUIVALENT ANALYZE_SETUP FOR BTC, ETH, XAU ===\n');

  for (const sym of ['BTC', 'ETH', 'XAU']) {
    console.log(`\n============================================================`);
    console.log(`                     ${sym} 360° AUDIT                     `);
    console.log(`============================================================`);

    const [narrative, market, quant, options, liq, walls, cvd, fp] = await Promise.all([
      fetchJson(`/api/cg/narrative?sym=${sym}`),
      fetchJson(`/api/cg/market?sym=${sym}`),
      fetchJson(`/api/cg/quant?sym=${sym}`),
      sym === 'BTC' || sym === 'ETH' ? fetchJson(`/api/cg/options?sym=${sym}`) : null,
      fetchJson(`/api/cg/liqlevels?sym=${sym}&range=3d`),
      fetchJson(`/api/cg/bookwalls?market=Binance_${sym}USDT&interval=m15`),
      fetchJson(`/api/cg/cvd?sym=${sym}&itv=15m&limit=30`),
      fetchJson(`/api/cg/orderflow-agg?sym=${sym}&interval=m15&limit=12`),
    ]);

    console.log(`1. REGIME & ENGINE VERDICT:`);
    console.log(`   Regime: ${narrative.regime} (${narrative.regimeNote || ''})`);
    console.log(`   Active Model: ${narrative.activeModel} | Direction: ${narrative.direction} | Grade: ${narrative.grade} | Confidence: ${narrative.confidence}%`);
    console.log(`   Thesis: ${narrative.thesis}`);
    if (narrative.plan) {
      console.log(`   Model Plan: Entry: ${narrative.plan.entry} | Stop: ${narrative.plan.stop} | T1: ${narrative.plan.target1} | R: ${narrative.plan.rMultiple}`);
      if (narrative.plan.ladder) {
        console.log(`   Entry Ladder:`, narrative.plan.ladder);
      }
    }

    console.log(`\n2. MARKET AUCTION & STRUCTURE:`);
    console.log(`   Price: Last ${market.price?.last} | Day High: ${market.price?.dayHigh} | Day Low: ${market.price?.dayLow} | Chg: ${market.price?.chgDayPct?.toFixed(2)}%`);
    console.log(`   H4 EMA: 13=${market.ema?.h4?.e13?.toFixed(2)} / 89=${market.ema?.h4?.e89?.toFixed(2)} / 233=${market.ema?.h4?.e233?.toFixed(2)} (Trend: ${market.ema?.h4?.trend})`);
    console.log(`   H1 EMA: 13=${market.ema?.h1?.e13?.toFixed(2)} / 89=${market.ema?.h1?.e89?.toFixed(2)}`);
    console.log(`   Session Auction: POC=${market.auction?.session?.poc} | VAH=${market.auction?.session?.vah} | VAL=${market.auction?.session?.val}`);
    console.log(`   Day Auction: POC=${market.auction?.day?.poc} | VAH=${market.auction?.day?.vah} | VAL=${market.auction?.day?.val}`);
    if (market.vwap?.day) {
      const v = market.vwap.day;
      const sd1 = v.bands?.sd1 || 0;
      const sd2 = v.bands?.sd2 || 0;
      console.log(`   Day VWAP: ${v.vwap?.toFixed(2)} | +1σ: ${(v.vwap+sd1)?.toFixed(2)} | -1σ: ${(v.vwap-sd1)?.toFixed(2)} | -2σ: ${(v.vwap-sd2)?.toFixed(2)}`);
    }

    if (quant?.ok && quant.supported !== false) {
      console.log(`\n3. QUANT POSITIONING & DERIVATIVES:`);
      console.log(`   OI-Weighted Funding 8h: ${(quant.funding?.oiWeightedRate8h * 100)?.toFixed(4)}% (APR: ${quant.funding?.annualizedAprPct?.toFixed(2)}%)`);
      console.log(`   OI Quadrants: 1h=${quant.oiQuadrant?.['1h']?.quadrant} | 4h=${quant.oiQuadrant?.['4h']?.quadrant} | 24h=${quant.oiQuadrant?.['24h']?.quadrant}`);
      console.log(`   L/S 1h: Global=${quant.lsRatios?.['1h']?.global?.ratio} | Top Positions=${quant.lsRatios?.['1h']?.topPositions?.ratio} | Taker=${quant.lsRatios?.['1h']?.taker?.buySellRatio}`);
      console.log(`   Basis: ${quant.basis?.basisPct?.toFixed(4)}% | Coinbase Premium: ${quant.basis?.coinbasePremiumBps?.toFixed(2)} bps`);
    }

    if (options?.ok && options.supported !== false) {
      console.log(`\n4. OPTIONS VOLATILITY & GEX (Deribit):`);
      console.log(`   GEX Regime: ${options.gex?.regime} | Gamma Flip Price: ${options.gex?.gammaFlipPrice} | Max Pain Strike: ${options.maxPainStrike}`);
      console.log(`   DVOL: ${options.dvol?.value} | 25d Skew (RR): ${options.riskReversal25d?.value} | P/C OI: ${options.putCallRatio?.oi}`);
    }

    if (liq?.ok && liq.stats) {
      console.log(`\n5. LIQUIDATION HEATMAP CLUSTERS:`);
      console.log(`   Total Shorts Above: $${(liq.stats.totals?.shorts / 1e3)?.toFixed(1)}M vs Longs Below: $${(liq.stats.totals?.longs / 1e3)?.toFixed(1)}M (Ratio: ${(liq.stats.totals?.shorts / (liq.stats.totals?.longs || 1)).toFixed(2)}x)`);
      console.log(`   Top 3 Short Clusters Above:`);
      for (const c of (liq.stats.keyLevels?.above || []).slice(0, 3)) {
        console.log(`     - Level: ${c.price} (+${c.distPct?.toFixed(2)}%) | Str: ${c.strength?.toFixed(0)} | Notional: $${(c.usd/1e3)?.toFixed(2)}M | Venues: ${c.venues?.join(',')}`);
      }
      console.log(`   Top 3 Long Clusters Below:`);
      for (const c of (liq.stats.keyLevels?.below || []).slice(0, 3)) {
        console.log(`     - Level: ${c.price} (${c.distPct?.toFixed(2)}%) | Str: ${c.strength?.toFixed(0)} | Notional: $${(c.usd/1e3)?.toFixed(2)}M | Venues: ${c.venues?.join(',')}`);
      }
    }

    if (walls?.ok && walls.model) {
      console.log(`\n6. ORDER BOOK WALLS & DEPTH:`);
      console.log(`   ±5% Depth: Bid $${(walls.model.depth?.bidUsd / 1e6)?.toFixed(1)}M vs Ask $${(walls.model.depth?.askUsd / 1e6)?.toFixed(1)}M | Imbalance: ${(walls.model.imbalance * 100)?.toFixed(2)}%`);
      console.log(`   Active Walls (${walls.model.walls?.length || 0}):`);
      for (const w of (walls.model.walls || []).slice(0, 5)) {
        console.log(`     - ${w.side.toUpperCase()} @ ${w.price}: $${(w.notional/1e6)?.toFixed(2)}M (age: ${w.ageMin?.toFixed(0)}m, touches: ${w.touches})`);
      }
    }

    if (fp?.ok && fp.bars) {
      console.log(`\n7. FOOTPRINT ORDER-FLOW BARS (Last 4 15m Bars):`);
      for (const b of (fp.bars || []).slice(-4).reverse()) {
        const time = new Date(b.ts).toISOString().slice(11, 16);
        let buy = 0, sell = 0, pocP = null, maxVol = 0;
        for (const bk of b.buckets || []) {
          const by = Number(bk[4]) || 0;
          const sl = Number(bk[5]) || 0;
          buy += by; sell += sl;
          if (by + sl > maxVol) { maxVol = by + sl; pocP = ((Number(bk[0]) + Number(bk[1])) / 2); }
        }
        const delta = buy - sell;
        const deltaPct = buy + sell > 0 ? (100 * delta) / (buy + sell) : 0;
        console.log(`     [${time}] Delta: $${(delta/1e6).toFixed(2)}M (${deltaPct.toFixed(1)}%) | POC: ${pocP?.toFixed(1)} | Buy: $${(buy/1e6).toFixed(1)}M | Sell: $${(sell/1e6).toFixed(1)}M`);
      }
    }
  }
}

main().catch(console.error);
