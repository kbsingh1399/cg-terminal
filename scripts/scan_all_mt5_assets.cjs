const fs = require('fs');

async function scanAllMt5Assets() {
  const base = 'http://127.0.0.1:3000';
  const mt5 = JSON.parse(fs.readFileSync('desk/mt5.json'));
  const validSyms = [];
  
  for (const [sym, data] of Object.entries(mt5.spreads || {})) {
    if (data.ok && data.tradeAllowed !== false) {
      // Exclude extreme spreads > 1.0%
      if ((data.spreadPct || 0) < 0.5) {
        validSyms.push({ mt5Sym: sym, asset: data.asset, spreadPct: data.spreadPct, basisPct: data.basisPct, bid: data.bid, ask: data.ask });
      }
    }
  }

  console.log(`Auditing ${validSyms.length} viable MT5 instruments with spread < 0.5%:\n`);

  const results = [];

  for (const item of validSyms) {
    const sym = item.asset;
    try {
      const [nar, mkt, liq, qnt] = await Promise.all([
        fetch(`${base}/api/cg/narrative?sym=${sym}`).then(r => r.json()).catch(() => null),
        fetch(`${base}/api/cg/market?sym=${sym}`).then(r => r.json()).catch(() => null),
        fetch(`${base}/api/cg/liqlevels?sym=${sym}&range=3d`).then(r => r.json()).catch(() => null),
        fetch(`${base}/api/cg/quant?sym=${sym}`).then(r => r.json()).catch(() => null),
      ]);

      if (!nar?.ok) continue;

      const lastPx = mkt?.price?.last || item.bid;
      const chgDay = mkt?.price?.chgDayPct || 0;
      const h4Ema13 = mkt?.ema?.h4?.e13;
      const h4Ema89 = mkt?.ema?.h4?.e89;
      const h4Trend = (h4Ema13 && h4Ema89) ? (h4Ema13 > h4Ema89 ? 'UP' : 'DOWN') : 'FLAT';
      
      const liqStats = liq?.stats || {};
      const shortsAbove = liqStats.totals?.shorts || 0;
      const longsBelow = liqStats.totals?.longs || 0;
      const liqRatio = longsBelow > 0 ? (shortsAbove / longsBelow) : 1;

      const opt = (sym === 'BTC' || sym === 'ETH') ? await fetch(`${base}/api/cg/options?sym=${sym}`).then(r => r.json()).catch(() => null) : null;

      results.push({
        asset: sym,
        mt5Sym: item.mt5Sym,
        spreadPct: item.spreadPct,
        basisPct: item.basisPct,
        price: lastPx,
        chgDay,
        regime: nar.regime,
        direction: nar.direction,
        grade: nar.grade,
        confidence: nar.confidence,
        m1Status: nar.m1?.status,
        m2Status: nar.m2?.status,
        h4Trend,
        liqRatio: liqRatio.toFixed(2),
        shortsAboveM: (shortsAbove / 1e3).toFixed(1),
        longsBelowM: (longsBelow / 1e3).toFixed(1),
        gexRegime: opt?.gex?.regime || 'n/a',
        gammaFlip: opt?.gex?.gammaFlipPrice || null,
        plan: nar.plan,
        checklist: nar.checklist
      });
    } catch (err) {
      console.error(`Error auditing ${sym}:`, err.message);
    }
  }

  // Sort by confidence / grade
  results.sort((a,b) => (b.confidence || 0) - (a.confidence || 0));

  for (const r of results) {
    console.log(`--------------------------------------------------------------------------------`);
    console.log(`[${r.asset.padEnd(5)} / ${r.mt5Sym.padEnd(7)}] ${r.direction.padEnd(5)} | Grade: ${r.grade.padEnd(4)} | Conf: ${String(r.confidence).padStart(3)}% | Regime: ${r.regime.padEnd(16)} | Spread: ${r.spreadPct.toFixed(3)}%`);
    console.log(`   Price: ${r.price} (Day: ${r.chgDay.toFixed(2)}%) | H4 Trend: ${r.h4Trend} | M1: ${r.m1Status} | M2: ${r.m2Status}`);
    console.log(`   Liq Asymmetry: ${r.liqRatio}x (Shorts: $${r.shortsAboveM}M above vs Longs: $${r.longsBelowM}M below)`);
    if (r.gexRegime !== 'n/a') {
      console.log(`   Options GEX: ${r.gexRegime} (Flip: ${r.gammaFlip})`);
    }
    if (r.plan) {
      console.log(`   Plan: Entry: ${r.plan.entry} | Stop: ${r.plan.stop?.toFixed(2)} | Target: ${r.plan.target1?.toFixed(2)} | R: ${r.plan.rMultiple}`);
    }
  }

  fs.writeFileSync('scripts/mt5_full_scan.json', JSON.stringify(results, null, 2));
}

scanAllMt5Assets().catch(console.error);
