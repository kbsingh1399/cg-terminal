const fs = require('fs');

async function run() {
  const base = 'http://127.0.0.1:3000';
  
  console.log('=== STEP 1: POLLING NOTIFICATIONS & RECENT HIGH-SEVERITY EVENTS ===');
  const notifs = await fetch(`${base}/api/cg/notifications`).then(r => r.json()).catch(() => ({ items: [] }));
  const items = notifs.items || [];
  const highEvents = items.filter(e => e.sev === 'HIGH' || e.sev === 'high' || (e.tags && e.tags.includes('high')));
  console.log(`Total live notifications: ${items.length}, HIGH severity: ${highEvents.length}`);
  for (const h of highEvents.slice(0, 10)) {
    console.log(`[HIGH] [${h.source || h.category}] ${h.sym} - ${h.title}: ${h.detail || h.msg || ''}`);
  }

  console.log('\n=== STEP 2: ALPHA SCREENER (61 CURATED ASSETS) ===');
  const scr = await fetch(`${base}/api/cg/screener`).then(r => r.json()).catch(() => ({ rows: [] }));
  const rows = scr.rows || [];
  console.log(`Curated assets in screener: ${rows.length} (warm: ${scr.warmCount})`);
  
  // Sort by absolute score or 24h change
  const sorted = [...rows].sort((a,b) => Math.abs(b.radarScore || b.score || 0) - Math.abs(a.radarScore || a.score || 0));
  console.log('Top 15 assets by radar conviction:');
  for (const a of sorted.slice(0, 15)) {
    const sc = a.radarScore !== undefined ? a.radarScore : a.score;
    const px = a.price !== undefined ? a.price : a.last;
    const chg = a.chgDayPct !== undefined ? a.chgDayPct : a.change24h;
    console.log(`- ${a.sym.padEnd(8)} score:${String(sc).padStart(4)} px:${String(px).padStart(9)} chg:${(chg || 0).toFixed(2)}% rvol:${(a.rvol || 1).toFixed(1)} reg:${a.regime || 'n/a'}`);
  }

  console.log('\n=== STEP 3: DEEP 360° TELEMETRY AUDIT FOR PRIMARY LIQUIDS ===');
  const primary = ['BTC', 'ETH', 'SOL', 'XAU', 'DOGE'];
  const deepResults = {};

  for (const sym of primary) {
    console.log(`\n------------------------------------------------------------`);
    console.log(`>>> ANALYZING 360° TELEMETRY: ${sym} <<<`);
    console.log(`------------------------------------------------------------`);

    // 1. Narrative & Engine Model
    const nar = await fetch(`${base}/api/cg/narrative?sym=${sym}`).then(r => r.json()).catch(() => null);
    
    // 2. Market Snapshot (EMA, VWAP, ATR)
    const mkt = await fetch(`${base}/api/cg/market?sym=${sym}`).then(r => r.json()).catch(() => null);

    // 3. Quant (OI, Funding, L/S)
    const qnt = await fetch(`${base}/api/cg/quant?sym=${sym}`).then(r => r.json()).catch(() => null);

    // 4. Options Surface (Deribit GEX, Max Pain)
    const opt = (sym === 'BTC' || sym === 'ETH') ? await fetch(`${base}/api/cg/options?sym=${sym}`).then(r => r.json()).catch(() => null) : null;

    // 5. Footprint (15m bars, delta, POC)
    const fp = await fetch(`${base}/api/cg/footprint?sym=${sym}&itv=m15&limit=10`).then(r => r.json()).catch(() => null);

    // 6. Book Walls (Depth, imbalance, confirmed walls)
    const walls = await fetch(`${base}/api/cg/bookwalls?market=Binance_${sym}USDT&interval=m15`).then(r => r.json()).catch(() => null);

    // 7. Liquidation Levels (Clusters, sweep magnets)
    const liq = await fetch(`${base}/api/cg/liqlevels?sym=${sym}&range=3d`).then(r => r.json()).catch(() => null);

    // 8. CVD
    const cvd = await fetch(`${base}/api/cg/cvd?sym=${sym}&itv=15m&limit=30`).then(r => r.json()).catch(() => null);

    deepResults[sym] = { nar, mkt, qnt, opt, fp, walls, liq, cvd };

    // Print concise summary for each
    console.log(`[Narrative] Direction: ${nar?.direction} | Grade: ${nar?.grade} | Conf: ${nar?.confidence}% | Regime: ${nar?.regime}`);
    console.log(`[M1/M2] M1 Status: ${nar?.m1?.status} | M2 Status: ${nar?.m2?.status}`);
    if (nar?.plan) {
      console.log(`[Model Plan] Entry: ${nar.plan.entry} | Stop: ${nar.plan.stop} | T1: ${nar.plan.target1} | R: ${nar.plan.rMultiple}`);
    }
    if (mkt?.ok) {
      console.log(`[Market] Price: ${mkt.price} | Day VWAP: ${mkt.vwap?.day?.vwap} | σ1: ${mkt.vwap?.day?.upper1}/${mkt.vwap?.day?.lower1} | H4 EMA13: ${mkt.ema?.h4?.e13} H4 EMA89: ${mkt.ema?.h4?.e89}`);
    }
    if (qnt?.ok) {
      console.log(`[Quant] Funding 8h: ${(qnt.funding?.rate8h * 100).toFixed(4)}% | OI: $${(qnt.oi?.oiUsd / 1e9).toFixed(2)}B (1h: ${qnt.oi?.delta1hPct}%, 24h: ${qnt.oi?.delta24hPct}%) | L/S: ${qnt.ls?.globalRatio} (Top: ${qnt.ls?.topTraderRatio})`);
    }
    if (opt?.ok) {
      console.log(`[Options GEX] Gamma Flip: ${opt.gex?.gammaFlipPrice} | Max Pain: ${opt.maxPainStrike} | Regime: ${opt.gex?.regime}`);
    }
    if (walls?.ok && walls.model) {
      console.log(`[Walls] Bid Depth: $${(walls.model.depth?.bidUsd / 1e6).toFixed(1)}M | Ask Depth: $${(walls.model.depth?.askUsd / 1e6).toFixed(1)}M | Imbalance: ${(walls.model.imbalance * 100).toFixed(2)}% | Walls Count: ${walls.model.walls?.length}`);
    }
    if (liq?.ok) {
      const clusters = liq.clusters || [];
      const above = clusters.filter(c => c.price > (mkt?.price || 0)).slice(0, 3);
      const below = clusters.filter(c => c.price < (mkt?.price || 0)).slice(0, 3);
      console.log(`[Liq Magnets Above]: ${above.map(c => `${c.price} ($${(c.volUsd/1e6).toFixed(1)}M)`).join(', ')}`);
      console.log(`[Liq Magnets Below]: ${below.map(c => `${c.price} ($${(c.volUsd/1e6).toFixed(1)}M)`).join(', ')}`);
    }
    if (fp?.ok && fp.bars) {
      const last3 = fp.bars.slice(-3);
      console.log(`[Footprint Last 3 Bars]:`);
      for (const b of last3) {
        console.log(`   ts:${b.ts ? new Date(b.ts).toISOString().slice(11,16) : 'n/a'} delta:${(b.deltaUsd/1e6).toFixed(2)}M delta%:${b.deltaPct}% poc:${b.poc} buy:${(b.buyUsd/1e6).toFixed(1)}M sell:${(b.sellUsd/1e6).toFixed(1)}M`);
      }
    }
    if (cvd?.ok) {
      console.log(`[CVD] Taker Buy Share: ${(cvd.buySharePct || cvd.takerBuyShare || 0).toFixed(1)}% | Active Div: ${cvd.divergence || 'none'}`);
    }
  }

  fs.writeFileSync('scripts/deep_telemetry_360.json', JSON.stringify(deepResults, null, 2));
  console.log('\n>>> Complete 360° telemetry bundle saved to scripts/deep_telemetry_360.json <<<');
}

run().catch(console.error);
