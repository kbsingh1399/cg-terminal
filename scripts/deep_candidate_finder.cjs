const fs = require('fs');
const http = require('http');

async function fetchJson(path) {
  return new Promise((resolve) => {
    http.get('http://127.0.0.1:3000' + path, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve(null);
        }
      });
    }).on('error', () => resolve(null));
  });
}

async function run() {
  const mt5 = JSON.parse(fs.readFileSync('desk/mt5.json', 'utf8'));
  const spreads = mt5.spreads || {};

  // Qualified broker assets
  const targetAssets = ['BTC', 'ETH', 'XAU', 'XAG', 'USO', 'XRP', 'XLM', 'XMR'];
  console.log(`Scanning target broker-qualified assets: ${targetAssets.join(', ')}...\n`);

  const reports = [];

  for (const sym of targetAssets) {
    const brokerKey = sym === 'XAU' ? 'XAUUSD' : sym === 'ETH' ? 'ETHUSD' : sym === 'BTC' ? 'BTCUSD' : sym === 'USO' ? 'USOUSD' : sym === 'XAG' ? 'XAGUSD' : `${sym}USD`;
    const spreadInfo = spreads[brokerKey] || {};

    if (!spreadInfo.ok || !spreadInfo.tradeAllowed) {
      console.log(`[SKIP ${sym}] Broker instrument not tradable.`);
      continue;
    }

    const spreadPct = parseFloat((spreadInfo.spreadPct || 0).toFixed(4));
    if (spreadPct > 0.15) {
      console.log(`[VETO ${sym}] Spread ${spreadPct}% > 0.15% limit.`);
      continue;
    }

    // Pull full telemetry
    const [mkt, nrt, sig, liq, cvd, bw, lto, opt] = await Promise.all([
      fetchJson(`/api/cg/market?sym=${sym}`),
      fetchJson(`/api/cg/narrative?sym=${sym}`),
      fetchJson(`/api/cg/signals?sym=${sym}`),
      fetchJson(`/api/cg/liqlevels?sym=${sym}`),
      fetchJson(`/api/cg/cvd?market=${sym}&limit=30`),
      fetchJson(`/api/cg/bookwalls?market=${sym}&limit=20`),
      fetchJson(`/api/cg/lto?sym=${sym}`),
      (sym === 'BTC' || sym === 'ETH') ? fetchJson(`/api/cg/options?sym=${sym}`) : Promise.resolve(null)
    ]);

    const spot = mkt?.price?.last || nrt?.market?.price || 0;
    if (!spot) continue;

    // D1: Basis
    const basisPct = spreadInfo.basisPct || 0;

    // D2: Auction profile
    const dayVal = mkt?.auction?.day?.val || 0;
    const dayPoc = mkt?.auction?.day?.poc || 0;
    const dayVah = mkt?.auction?.day?.vah || 0;
    const monthPoc = mkt?.auction?.month?.poc || 0;

    // D3: VWAP & Bands
    const vwap = mkt?.vwap?.vwap || 0;
    const sd1 = mkt?.vwap?.bands?.sd1 || 1;
    const sd2 = mkt?.vwap?.bands?.sd2 || 2;
    const z = sd1 > 0 ? (spot - vwap) / sd1 : 0;

    // D4: EMA Trends
    const h4 = mkt?.ema?.h4 || {};
    const d1 = mkt?.ema?.d1 || {};
    const h4Trend = (h4.e13 && h4.e89) ? (h4.e13 > h4.e89 ? 'BULL' : 'BEAR') : 'UNKNOWN';
    const d1Trend = (d1.e13 && d1.e89) ? (d1.e13 > d1.e89 ? 'BULL' : 'BEAR') : 'UNKNOWN';
    const emaAligned = h4Trend === d1Trend && h4Trend !== 'UNKNOWN';

    // D5: RSI
    const rsiM15 = mkt?.rsi?.m15 || 50;
    const rsiH1 = mkt?.rsi?.h1 || 50;
    const rsiH4 = mkt?.rsi?.h4 || 50;

    // D7: Signals
    const recentSignals = (sig?.signals || []).slice(-5);
    const hasAbsorption = recentSignals.some(s => s.type === 'abs' || s.type === 'sdiv');

    // D8: CVD
    const cvdQuad = cvd?.kpis?.quadrant || 'UNKNOWN';
    const takerBuyShare = cvd?.kpis?.takerBuyPct || 50;

    // D9: BookWalls
    const bidDepth = bw?.totalBidUSD || 0;
    const askDepth = bw?.totalAskUSD || 0;
    const wallImbalance = bw?.imbalance || 0;

    // D11 & D12: Liquidations & Magnet Gate
    const bands = liq?.stats?.bands || [];
    const b01 = bands[0] || {};
    const b12 = bands[1] || {};
    const shortsAbove = (b01.up || 0) + (b12.up || 0);
    const longsBelow = (b01.down || 0) + (b12.down || 0);
    const lsr = Math.max(shortsAbove, longsBelow) / Math.max(1, Math.min(shortsAbove, longsBelow));
    const dominantLiq = shortsAbove >= longsBelow ? 'SHORTS_ABOVE' : 'LONGS_BELOW';

    // Table 7 Confluence Scoring (Max 11.5)
    let score = 0;
    const scoreBreakdown = {};

    // 1. Trend (Max 2.0)
    if (emaAligned) {
      score += 2.0;
      scoreBreakdown.trend = 2.0;
    } else if (h4Trend !== 'UNKNOWN') {
      score += 1.0;
      scoreBreakdown.trend = 1.0;
    } else {
      scoreBreakdown.trend = 0.0;
    }

    // Determine candidate direction based on trend & regime
    const dir = h4Trend === 'BEAR' ? 'SHORT' : h4Trend === 'BULL' ? 'LONG' : (z < 0 ? 'LONG' : 'SHORT');

    // 2. Regime (Max 1.5) - Long in discount (z < 0), Short in premium (z > 0 or pullback to VWAP)
    if (dir === 'SHORT' && z >= -0.5) {
      score += 1.5;
      scoreBreakdown.regime = 1.5;
    } else if (dir === 'LONG' && z <= 0.5) {
      score += 1.5;
      scoreBreakdown.regime = 1.5;
    } else {
      scoreBreakdown.regime = 0.5;
      score += 0.5;
    }

    // 3. Footprint signal (Max 2.0)
    if (hasAbsorption) {
      score += 2.0;
      scoreBreakdown.signal = 2.0;
    } else if (recentSignals.length > 0) {
      score += 1.0;
      scoreBreakdown.signal = 1.0;
    } else {
      scoreBreakdown.signal = 0.0;
    }

    // 4. Whale Wall Backstop (Max 1.5)
    if (dir === 'SHORT' && askDepth > bidDepth) {
      score += 1.0;
      scoreBreakdown.wall = 1.0;
    } else if (dir === 'LONG' && bidDepth > askDepth) {
      score += 1.0;
      scoreBreakdown.wall = 1.0;
    } else {
      scoreBreakdown.wall = 0.5;
      score += 0.5;
    }

    // 5. CVD Divergence / Alignment (Max 1.0)
    if (dir === 'SHORT' && (cvdQuad === 'both-selling' || cvdQuad === 'spot-selling')) {
      score += 1.0;
      scoreBreakdown.cvd = 1.0;
    } else if (dir === 'LONG' && (cvdQuad === 'both-buying' || cvdQuad === 'spot-buying')) {
      score += 1.0;
      scoreBreakdown.cvd = 1.0;
    } else {
      scoreBreakdown.cvd = 0.0;
    }

    // 6. Liquidation Magnet Gate (Max 1.5)
    // If short and longs below dominate OR if long and shorts above dominate: trade aligns with magnet
    if ((dir === 'SHORT' && dominantLiq === 'LONGS_BELOW') || (dir === 'LONG' && dominantLiq === 'SHORTS_ABOVE')) {
      score += 1.5;
      scoreBreakdown.gate = 1.5;
    } else if (lsr < 2.0) {
      score += 1.0;
      scoreBreakdown.gate = 1.0;
    } else {
      scoreBreakdown.gate = 0.0;
    }

    // 7. Options GEX (Max 1.0)
    if (opt) {
      score += 1.0;
      scoreBreakdown.gex = 1.0;
    } else {
      scoreBreakdown.gex = 0.0; // honest n/a
    }

    // 8. Broker Spread Drag (Max 1.0)
    if (spreadPct < 0.05) {
      score += 1.0;
      scoreBreakdown.spread = 1.0;
    } else if (spreadPct <= 0.10) {
      score += 0.5;
      scoreBreakdown.spread = 0.5;
    } else {
      scoreBreakdown.spread = 0.0;
    }

    // Grade
    const grade = score >= 7.0 ? 'Grade A' : (score >= 5.0 ? 'Grade B' : 'VETO (<5.0)');

    // Veto checks
    const activeVetoes = [];
    if (dir === 'SHORT' && dominantLiq === 'SHORTS_ABOVE' && lsr >= 2.5) {
      activeVetoes.push(`LSR_MAGNET_GATE (LSR ${lsr.toFixed(2)}:1 shorts above — passive short banned)`);
    }
    if (dir === 'LONG' && dominantLiq === 'LONGS_BELOW' && lsr >= 2.5) {
      activeVetoes.push(`LSR_MAGNET_GATE (LSR ${lsr.toFixed(2)}:1 longs below — passive long banned)`);
    }

    reports.push({
      sym,
      brokerKey,
      spot,
      dir,
      score: score.toFixed(1),
      grade,
      scoreBreakdown,
      activeVetoes,
      lsr: `${lsr.toFixed(2)}:1 (${dominantLiq})`,
      spreadPct: `${spreadPct}%`,
      basisPct: `${basisPct.toFixed(4)}%`,
      z: `${z.toFixed(2)}σ`,
      h4Trend,
      d1Trend,
      vwap,
      dayVal,
      dayPoc,
      dayVah,
      monthPoc
    });
  }

  // Sort by score descending
  reports.sort((a, b) => parseFloat(b.score) - parseFloat(a.score));

  console.log(`\n=================== INSTITUTIONAL CANDIDATE RANKING ===================`);
  for (const r of reports) {
    console.log(`\n[${r.grade.toUpperCase()}] ${r.sym} (${r.brokerKey}) · Bias: ${r.dir} · Score: ${r.score}/11.5`);
    console.log(`  Spot: ${r.spot} | Day VWAP: ${r.vwap.toFixed(2)} (${r.z}) | Spread: ${r.spreadPct} | Basis: ${r.basisPct}`);
    console.log(`  Auction: VAL ${r.dayVal} | POC ${r.dayPoc} | VAH ${r.dayVah} | Month POC ${r.monthPoc}`);
    console.log(`  Trends: H4 ${r.h4Trend} | D1 ${r.d1Trend} | Magnet: ${r.lsr}`);
    console.log(`  Score Details:`, JSON.stringify(r.scoreBreakdown));
    if (r.activeVetoes.length) {
      console.log(`  >>> ACTIVE VETOES:`, r.activeVetoes.join(', '));
    }
  }

  fs.writeFileSync('desk/candidate_ranking.json', JSON.stringify(reports, null, 2));
}

run();
