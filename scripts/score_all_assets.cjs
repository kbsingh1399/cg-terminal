/**
 * scripts/score_all_assets.cjs
 * Analyzes the full universe of 61 assets against the Canonical Trade Formulation Manual (SOP).
 */
const fs = require('fs');

const raw = JSON.parse(fs.readFileSync('desk/audit_full_universe.json', 'utf8'));

console.log(`Analyzing ${raw.length} assets...`);

function evaluateAsset(asset) {
  const {
    sym, name, kind, category, sub, price, vwapZ, ema4h, ema1h,
    lsr, dominantSide, shortsAbove, longsBelow, spreadInfo,
    mkt, narr, sig, liq, walls, cvd, quant, opt
  } = asset;

  if (!mkt || !mkt.price || !price) {
    return { sym, status: 'DATA_UNAVAILABLE', reason: 'Missing market data' };
  }

  const spot = mkt.price.last || price;
  const vwap = mkt.vwap?.vwap;
  const sd1 = mkt.vwap?.bands?.sd1;
  const sd2 = mkt.vwap?.bands?.sd2;
  const sd3 = mkt.vwap?.bands?.sd3;

  // Auction Profile
  const dayPoc = mkt.auction?.day?.poc;
  const dayVah = mkt.auction?.day?.vah;
  const dayVal = mkt.auction?.day?.val;
  const monthPoc = mkt.auction?.month?.poc;
  const sessionPoc = mkt.auction?.session?.poc;

  // EMAs
  const emaH4_13 = mkt.ema?.h4?.e13;
  const emaH4_89 = mkt.ema?.h4?.e89;
  const emaD1_13 = mkt.ema?.d1?.e13;
  const emaD1_89 = mkt.ema?.d1?.e89;
  const emaM15_13 = mkt.ema?.m15?.e13;
  const emaM15_89 = mkt.ema?.m15?.e89;

  const h4Trend = (emaH4_13 && emaH4_89) ? (emaH4_13 > emaH4_89 ? 'bull' : 'bear') : null;
  const d1Trend = (emaD1_13 && emaD1_89) ? (emaD1_13 > emaD1_89 ? 'bull' : 'bear') : null;
  const m15Trend = (emaM15_13 && emaM15_89) ? (emaM15_13 > emaM15_89 ? 'bull' : 'bear') : null;

  // RSI
  const rsiM15 = mkt.rsi?.m15;
  const rsiH1 = mkt.rsi?.h1;
  const rsiH4 = mkt.rsi?.h4;

  // CVD
  const cvdQuadrant = cvd?.kpis?.quadrant;
  const perpCvd = cvd?.kpis?.perpCvd;
  const spotCvd = cvd?.kpis?.spotCvd;
  const takerBuyRatio = cvd?.kpis?.buyRatio;
  const latestDiv = cvd?.kpis?.latestDiv;

  // Signals
  const recentSignals = [];
  if (sig && sig.sets) {
    for (const set of sig.sets) {
      for (const s of (set.sigs || [])) {
        recentSignals.push({ ...s, bt: set.bt });
      }
    }
  }
  recentSignals.sort((a, b) => b.ts - a.ts);
  const latestSig = recentSignals[0] || null;

  // BookWalls
  const bookWalls = walls?.model?.walls || [];
  const askWalls = bookWalls.filter(w => w.side === 'a');
  const bidWalls = bookWalls.filter(w => w.side === 'b');
  const depthImbalance = walls?.model?.imbalance;

  // Liquidation Clusters
  const keyAbove = liq?.stats?.keyLevels?.above || [];
  const keyBelow = liq?.stats?.keyLevels?.below || [];

  // Options GEX (BTC/ETH only)
  const gexRegime = opt?.gex?.regime; // 'POSITIVE_GAMMA_DAMPENING' or 'NEGATIVE_GAMMA_EXPANSION'
  const gammaFlip = opt?.gex?.gammaFlipPrice;

  // Broker Spread
  const spreadPct = spreadInfo?.ok ? spreadInfo.spreadPct : null;
  const basisPct = spreadInfo?.ok ? spreadInfo.basisPct : 0;
  const brokerTradeAllowed = spreadInfo?.ok && spreadInfo.tradeAllowed;

  // 1. Establish Bias via 2-of-3 rule:
  // (a) Footprint signal direction
  // (b) H4 trend
  // (c) Price vs Day VWAP (above = premium/bullish bias, below = discount/bearish bias)
  let bullVotes = 0;
  let bearVotes = 0;

  if (h4Trend === 'bull') bullVotes++;
  if (h4Trend === 'bear') bearVotes++;

  if (vwap && spot > vwap) bullVotes++;
  if (vwap && spot < vwap) bearVotes++;

  if (latestSig) {
    if (latestSig.side === 'buy') bullVotes++;
    if (latestSig.side === 'sell') bearVotes++;
  }

  const establishedBias = bullVotes >= 2 ? 'LONG' : bearVotes >= 2 ? 'SHORT' : 'NEUTRAL';

  // Evaluate Setups S1 to S8
  const candidateSetups = [];

  // --- S7: High-Volume Absorption Continuation (Trend Pullback) ---
  if (establishedBias !== 'NEUTRAL' && h4Trend === (establishedBias === 'LONG' ? 'bull' : 'bear')) {
    // Continuation direction
    const isLong = establishedBias === 'LONG';
    const trendAligned = (h4Trend === (isLong ? 'bull' : 'bear')) && (d1Trend === (isLong ? 'bull' : 'bear'));
    const threeTfAligned = trendAligned && (m15Trend === (isLong ? 'bull' : 'bear'));

    // Check stretch guard: |z| < 2.0
    const absZ = Math.abs(vwapZ || 0);
    if (absZ < 2.0) {
      // Entry zone: retest of absorbed high-volume node (Day POC / VWAP ±1σ)
      let entry = isLong ? (dayPoc && dayPoc < spot ? dayPoc : (vwap - sd1)) : (dayPoc && dayPoc > spot ? dayPoc : (vwap + sd1));
      if (!entry) entry = spot;

      // Stop: other side of zone
      let stop = isLong ? (entry - (sd1 || (spot * 0.015))) : (entry + (sd1 || (spot * 0.015)));
      const stopDist = Math.abs(entry - stop);

      // Targets: 40% T1 (Day VAH/VAL), 40% T2 (Month/Session POC), 20% T3 (Liq cluster)
      const t1 = isLong ? dayVah : dayVal;
      const t2 = isLong ? (monthPoc && monthPoc > entry ? monthPoc : sessionPoc) : (monthPoc && monthPoc < entry ? monthPoc : sessionPoc);
      const nearestOppLiq = isLong ? keyAbove[0]?.price : keyBelow[0]?.price;
      const t3 = nearestOppLiq || (isLong ? entry + stopDist * 3 : entry - stopDist * 3);

      const r1 = t1 && stopDist > 0 ? Math.abs(t1 - entry) / stopDist : 0;
      const r2 = t2 && stopDist > 0 ? Math.abs(t2 - entry) / stopDist : 0;
      const r3 = t3 && stopDist > 0 ? Math.abs(t3 - entry) / stopDist : 0;

      candidateSetups.push({
        setupCode: 'S7',
        setupName: 'High-Volume Absorption Continuation',
        direction: establishedBias,
        entry,
        stop,
        stopDist,
        t1, r1,
        t2, r2,
        t3, r3,
        rComposite: (r1 * 0.4) + (r2 * 0.4) + (r3 * 0.2),
        threeTfAligned,
        trendAligned
      });
    }
  }

  // --- S1: Liquidation Sweep Reversal ---
  // When LSR >= 2.0:1 or swept cluster
  if (lsr >= 2.0) {
    const sweepSide = dominantSide === 'SHORT_LIQ_ABOVE' ? 'SHORT' : 'LONG'; // If short liq above, sweep goes up, then reverses SHORT
    const sweepLong = dominantSide === 'LONG_LIQ_BELOW'; // longs wiped below, then reverses LONG
    const revDir = sweepLong ? 'LONG' : 'SHORT';

    // Entry after sweep of the dominant stops
    const targetCluster = sweepLong ? keyBelow[0] : keyAbove[0];
    if (targetCluster) {
      const entry = targetCluster.price;
      const stopBuffer = Math.abs(entry * 0.006);
      const stop = revDir === 'LONG' ? entry - stopBuffer : entry + stopBuffer;
      const stopDist = Math.abs(entry - stop);

      const t1 = revDir === 'LONG' ? dayPoc : dayPoc;
      const t2 = revDir === 'LONG' ? dayVah : dayVal;
      const t3 = revDir === 'LONG' ? (keyAbove[0]?.price || entry + stopDist * 3) : (keyBelow[0]?.price || entry - stopDist * 3);

      const r1 = t1 && stopDist > 0 ? Math.abs(t1 - entry) / stopDist : 0;
      const r2 = t2 && stopDist > 0 ? Math.abs(t2 - entry) / stopDist : 0;
      const r3 = t3 && stopDist > 0 ? Math.abs(t3 - entry) / stopDist : 0;

      candidateSetups.push({
        setupCode: 'S1',
        setupName: 'Liquidation Sweep Reversal',
        direction: revDir,
        entry,
        stop,
        stopDist,
        t1, r1,
        t2, r2,
        t3, r3,
        rComposite: (r1 * 0.4) + (r2 * 0.4) + (r3 * 0.2),
        lsr,
        dominantSide
      });
    }
  }

  // --- S5: VWAP Band Mean Reversion ---
  if (Math.abs(vwapZ || 0) >= 1.8 && vwap) {
    const revDir = vwapZ > 0 ? 'SHORT' : 'LONG';
    const entry = spot;
    const stopBuffer = (sd1 || spot * 0.01) * 0.5;
    const stop = revDir === 'SHORT' ? (vwap + (sd3 || sd1 * 3) + stopBuffer) : (vwap - (sd3 || sd1 * 3) - stopBuffer);
    const stopDist = Math.abs(entry - stop);

    const t1 = sessionPoc || dayPoc;
    const t2 = vwap;
    const t3 = revDir === 'SHORT' ? (vwap - (sd1 || 0)) : (vwap + (sd1 || 0));

    const r1 = t1 && stopDist > 0 ? Math.abs(t1 - entry) / stopDist : 0;
    const r2 = t2 && stopDist > 0 ? Math.abs(t2 - entry) / stopDist : 0;
    const r3 = t3 && stopDist > 0 ? Math.abs(t3 - entry) / stopDist : 0;

    candidateSetups.push({
      setupCode: 'S5',
      setupName: 'VWAP Band Mean Reversion',
      direction: revDir,
      entry,
      stop,
      stopDist,
      t1, r1,
      t2, r2,
      t3, r3,
      rComposite: (r1 * 0.4) + (r2 * 0.4) + (r3 * 0.2),
      vwapZ
    });
  }

  // --- S2: Value Area Edge Fade ---
  if (dayVah && dayVal && dayPoc) {
    const distToVahPct = Math.abs(spot - dayVah) / spot * 100;
    const distToValPct = Math.abs(spot - dayVal) / spot * 100;
    if (distToVahPct <= 0.4 || distToValPct <= 0.4) {
      const isShort = distToVahPct <= distToValPct;
      const revDir = isShort ? 'SHORT' : 'LONG';
      const entry = isShort ? dayVah : dayVal;
      const stop = isShort ? (vwap ? vwap + (sd2 || sd1 * 2) : entry * 1.01) : (vwap ? vwap - (sd2 || sd1 * 2) : entry * 0.99);
      const stopDist = Math.abs(entry - stop);

      const t1 = dayPoc;
      const t2 = sessionPoc || (isShort ? dayVal : dayVah);
      const t3 = isShort ? dayVal : dayVah;

      const r1 = t1 && stopDist > 0 ? Math.abs(t1 - entry) / stopDist : 0;
      const r2 = t2 && stopDist > 0 ? Math.abs(t2 - entry) / stopDist : 0;
      const r3 = t3 && stopDist > 0 ? Math.abs(t3 - entry) / stopDist : 0;

      candidateSetups.push({
        setupCode: 'S2',
        setupName: 'Value Area Edge Fade',
        direction: revDir,
        entry,
        stop,
        stopDist,
        t1, r1,
        t2, r2,
        t3, r3,
        rComposite: (r1 * 0.4) + (r2 * 0.4) + (r3 * 0.2)
      });
    }
  }

  // --- S3: Whale Wall Defense / Front-Run ---
  // Look for confirmed resting wall >= $5M (age > 1h)
  const qualifiedBids = bidWalls.filter(w => w.usd >= 5e6 && w.ageMs >= 3600000 && !w.touched);
  const qualifiedAsks = askWalls.filter(w => w.usd >= 5e6 && w.ageMs >= 3600000 && !w.touched);

  if (qualifiedBids.length > 0) {
    const wall = qualifiedBids[0];
    const entry = wall.price * 1.0008; // 0.08% front-run
    const stop = wall.price * 0.994; // behind wall + buffer
    const stopDist = Math.abs(entry - stop);
    const t1 = dayPoc || (entry + stopDist * 2);
    const t2 = dayVah || (entry + stopDist * 3);
    const t3 = keyAbove[0]?.price || (entry + stopDist * 4);

    const r1 = t1 && stopDist > 0 ? Math.abs(t1 - entry) / stopDist : 0;
    const r2 = t2 && stopDist > 0 ? Math.abs(t2 - entry) / stopDist : 0;
    const r3 = t3 && stopDist > 0 ? Math.abs(t3 - entry) / stopDist : 0;

    candidateSetups.push({
      setupCode: 'S3',
      setupName: 'Whale Wall Defense / Front-Run',
      direction: 'LONG',
      entry,
      stop,
      stopDist,
      t1, r1,
      t2, r2,
      t3, r3,
      rComposite: (r1 * 0.4) + (r2 * 0.4) + (r3 * 0.2),
      wallUsd: wall.usd,
      wallPrice: wall.price
    });
  }

  if (qualifiedAsks.length > 0) {
    const wall = qualifiedAsks[0];
    const entry = wall.price * 0.9992; // 0.08% front-run
    const stop = wall.price * 1.006; // behind wall + buffer
    const stopDist = Math.abs(entry - stop);
    const t1 = dayPoc || (entry - stopDist * 2);
    const t2 = dayVal || (entry - stopDist * 3);
    const t3 = keyBelow[0]?.price || (entry - stopDist * 4);

    const r1 = t1 && stopDist > 0 ? Math.abs(t1 - entry) / stopDist : 0;
    const r2 = t2 && stopDist > 0 ? Math.abs(t2 - entry) / stopDist : 0;
    const r3 = t3 && stopDist > 0 ? Math.abs(t3 - entry) / stopDist : 0;

    candidateSetups.push({
      setupCode: 'S3',
      setupName: 'Whale Wall Defense / Front-Run',
      direction: 'SHORT',
      entry,
      stop,
      stopDist,
      t1, r1,
      t2, r2,
      t3, r3,
      rComposite: (r1 * 0.4) + (r2 * 0.4) + (r3 * 0.2),
      wallUsd: wall.usd,
      wallPrice: wall.price
    });
  }

  // Now Score and Check Vetoes for Each Candidate Setup
  const evaluatedSetups = candidateSetups.map(s => {
    let score = 0;
    const scoringBreakdown = {};
    const vetoes = [];

    // 1. Directional Trend (2.0 max): H4 & D1 alignment in trade direction
    const trendAligned = (h4Trend === (s.direction === 'LONG' ? 'bull' : 'bear')) &&
                         (d1Trend === (s.direction === 'LONG' ? 'bull' : 'bear'));
    if (trendAligned) {
      score += 2.0;
      scoringBreakdown.trend = 2.0;
    } else if (h4Trend === (s.direction === 'LONG' ? 'bull' : 'bear')) {
      score += 1.0;
      scoringBreakdown.trend = 1.0;
    } else {
      scoringBreakdown.trend = 0.0;
    }

    // 2. Auction / VWAP Regime (1.5 max): Long in Discount (below VWAP) / Short in Premium (above VWAP)
    const inDiscount = vwap && spot < vwap;
    const inPremium = vwap && spot > vwap;
    if ((s.direction === 'LONG' && inDiscount) || (s.direction === 'SHORT' && inPremium)) {
      score += 1.5;
      scoringBreakdown.regime = 1.5;
    } else {
      scoringBreakdown.regime = 0.0;
    }

    // 3. Footprint Signal (2.0 max): Strong Divergence or Absorption at entry zone
    const hasSignal = latestSig && (
      (s.direction === 'LONG' && latestSig.side === 'buy' && /abs|sdiv/i.test(latestSig.t || latestSig.title)) ||
      (s.direction === 'SHORT' && latestSig.side === 'sell' && /abs|sdiv/i.test(latestSig.t || latestSig.title))
    );
    if (hasSignal) {
      score += 2.0;
      scoringBreakdown.signal = 2.0;
    } else if (latestSig && ((s.direction === 'LONG' && latestSig.side === 'buy') || (s.direction === 'SHORT' && latestSig.side === 'sell'))) {
      score += 1.0;
      scoringBreakdown.signal = 1.0;
    } else {
      scoringBreakdown.signal = 0.0;
    }

    // 4. Whale Wall Backstop (1.5 max): Entry protected by confirmed resting wall >= $5M (age > 1h)
    const wallProtect = s.direction === 'LONG' ? qualifiedBids.length > 0 : qualifiedAsks.length > 0;
    if (wallProtect) {
      score += 1.5;
      scoringBreakdown.wall = 1.5;
    } else {
      scoringBreakdown.wall = 0.0;
    }

    // 5. CVD Divergence (1.0 max): CVD diverging from price swing
    const cvdDivMatches = latestDiv && (
      (s.direction === 'LONG' && latestDiv.type === 'bull') ||
      (s.direction === 'SHORT' && latestDiv.type === 'bear')
    );
    if (cvdDivMatches) {
      score += 1.0;
      scoringBreakdown.cvd = 1.0;
    } else {
      scoringBreakdown.cvd = 0.0;
    }

    // 6. Liquidation Magnet Gate (1.5 max): Liquidation skew favors trade direction (LSR aligned)
    // If trade is SHORT, and longs are below (meaning long stops below are fuel), that favors SHORT
    // If trade is LONG, and shorts are above (short stops above are fuel), that favors LONG
    const lsrAligned = (s.direction === 'SHORT' && dominantSide === 'LONG_LIQ_BELOW') ||
                       (s.direction === 'LONG' && dominantSide === 'SHORT_LIQ_ABOVE');
    if (lsrAligned) {
      score += 1.5;
      scoringBreakdown.gate = 1.5;
    } else {
      scoringBreakdown.gate = 0.0;
    }

    // 7. Options GEX Context (1.0 max): Gamma confirms setup (Positive for S2/S5; Negative for S1/S8)
    if (gexRegime) {
      if ((gexRegime.includes('POSITIVE') && (s.setupCode === 'S2' || s.setupCode === 'S5')) ||
          (gexRegime.includes('NEGATIVE') && (s.setupCode === 'S1' || s.setupCode === 'S8' || s.setupCode === 'S7'))) {
        score += 1.0;
        scoringBreakdown.gex = 1.0;
      } else {
        scoringBreakdown.gex = 0.0;
      }
    } else {
      scoringBreakdown.gex = 0.0; // honest n/a
    }

    // 8. Broker Spread Drag (1.0 max):
    if (spreadPct != null) {
      if (spreadPct < 0.05) {
        score += 1.0;
        scoringBreakdown.spread = 1.0;
      } else if (spreadPct <= 0.10) {
        score += 0.5;
        scoringBreakdown.spread = 0.5;
      } else if (spreadPct <= 0.15) {
        scoringBreakdown.spread = 0.0;
      } else {
        vetoes.push(`Spread ${spreadPct}% > 0.15% (Disqualified broker spread)`);
        scoringBreakdown.spread = 0.0;
      }
    } else {
      scoringBreakdown.spread = 0.0;
    }

    // Check Hard Vetoes:
    // Veto 1: LSR >= 2.5:1 -> all passive entries into magnet path banned
    if (lsr >= 2.5) {
      if (s.setupCode === 'S3' || s.setupCode === 'S2') {
        vetoes.push(`LSR ${lsr}:1 >= 2.5:1 — passive entry into magnet path BANNED (must wait for S1 sweep)`);
      }
    }

    // Veto 2: Opposing magnet str >= 50 within 1.2R
    const oppClusters = s.direction === 'LONG' ? keyBelow : keyAbove;
    for (const c of oppClusters) {
      if (c.strength >= 50) {
        const distR = Math.abs(c.price - s.entry) / s.stopDist;
        if (distR <= 1.2) {
          vetoes.push(`Opposing liquidation magnet @ ${c.price} (str ${c.strength}) within ${distR.toFixed(1)}R < 1.2R hazard`);
        }
      }
    }

    // Veto 3: Target R-standard: continuation >= 2.0R to T1; reversion >= 1.2R T1 + >= 1.5R T2
    if (s.setupCode === 'S7' || s.setupCode === 'S4' || s.setupCode === 'S8') {
      if (s.r1 < 1.5) { // Terminal allow 1.5 composite floor, human mandate >= 2.0 to T1
        vetoes.push(`Continuation T1 R ${s.r1.toFixed(2)} < 1.5R`);
      }
    } else if (s.setupCode === 'S5') {
      if (s.r1 < 1.2 || s.r2 < 1.5) {
        vetoes.push(`Reversion T1 R ${s.r1.toFixed(2)} < 1.2R or T2 R ${s.r2.toFixed(2)} < 1.5R`);
      }
    }

    // Veto 4: Opposing whale wall >= $5M within 1.5R
    const oppWalls = s.direction === 'LONG' ? askWalls : bidWalls;
    for (const w of oppWalls) {
      if (w.usd >= 5e6) {
        const distR = Math.abs(w.price - s.entry) / s.stopDist;
        if (distR <= 1.5) {
          vetoes.push(`Opposing whale wall $${(w.usd/1e6).toFixed(1)}M @ ${w.price} within ${distR.toFixed(1)}R < 1.5R`);
        }
      }
    }

    // Veto 5: Spread/Stop-distance > 20%
    if (spreadPct != null && s.stopDist > 0) {
      const stopDistPct = (s.stopDist / s.entry) * 100;
      const dragRatio = spreadPct / stopDistPct;
      if (dragRatio > 0.20) {
        vetoes.push(`Spread drag ${(dragRatio*100).toFixed(1)}% > 20% of stop distance`);
      }
    }

    // Final Grade
    let grade = 'NO_TRADE';
    if (score >= 7.0 && vetoes.length === 0) grade = 'GRADE_A';
    else if (score >= 5.0 && vetoes.length === 0) grade = 'GRADE_B';

    return {
      ...s,
      totalScore: Number(score.toFixed(1)),
      scoringBreakdown,
      vetoes,
      grade,
      riskPct: grade === 'GRADE_A' ? 1.0 : grade === 'GRADE_B' ? 0.5 : 0
    };
  });

  return {
    sym,
    name,
    kind,
    category,
    sub,
    spot,
    vwapZ,
    h4Trend,
    d1Trend,
    lsr,
    dominantSide,
    spreadPct,
    establishedBias,
    evaluatedSetups
  };
}

const evaluatedUniverse = raw.map(evaluateAsset);

// Extract Grade A and Grade B setups
const validTrades = [];
for (const a of evaluatedUniverse) {
  for (const s of (a.evaluatedSetups || [])) {
    if (s.grade === 'GRADE_A' || s.grade === 'GRADE_B') {
      validTrades.push({ asset: a, setup: s });
    }
  }
}

console.log(`\n========================================================================`);
console.log(`TOTAL ASSETS EVALUATED: ${evaluatedUniverse.length}`);
console.log(`VALID GRADE A/B TRADES FOUND: ${validTrades.length}`);
console.log(`========================================================================\n`);

if (validTrades.length > 0) {
  for (const t of validTrades) {
    console.log(`>>> ${t.asset.sym} · ${t.setup.setupCode} (${t.setup.setupName}) · ${t.setup.direction} · ${t.setup.grade} (Score: ${t.setup.totalScore}/11.5)`);
    console.log(`    Entry: ${t.setup.entry.toFixed(2)} | SL: ${t.setup.stop.toFixed(2)} | Dist: ${t.setup.stopDist.toFixed(2)} (${((t.setup.stopDist/t.setup.entry)*100).toFixed(2)}%)`);
    console.log(`    T1: ${t.setup.t1?.toFixed(2)} (R: ${t.setup.r1?.toFixed(2)}) | T2: ${t.setup.t2?.toFixed(2)} (R: ${t.setup.r2?.toFixed(2)}) | T3: ${t.setup.t3?.toFixed(2)} (R: ${t.setup.r3?.toFixed(2)})`);
    console.log(`    Scoring:`, t.setup.scoringBreakdown);
    console.log(`------------------------------------------------------------------------`);
  }
} else {
  console.log(`No Grade A or B setups passed all Table 7 criteria and hard vetoes across the entire universe.`);
  console.log(`Tape is currently quiet / veto-locked. Showing near-misses and developing setups:`);
}

// Show top 10 near misses (score >= 4.0 or setups with 1 veto)
const nearMisses = [];
for (const a of evaluatedUniverse) {
  for (const s of (a.evaluatedSetups || [])) {
    if (s.totalScore >= 4.0 || s.vetoes.length > 0) {
      nearMisses.push({ sym: a.sym, name: a.name, setup: s.setupCode, dir: s.direction, score: s.totalScore, vetoes: s.vetoes, r1: s.r1 });
    }
  }
}
nearMisses.sort((x, y) => y.score - x.score);
console.log(`\nTOP 15 SETUP CANDIDATES & VETO AUDITS:`);
console.table(nearMisses.slice(0, 15));

fs.writeFileSync('desk/evaluated_universe.json', JSON.stringify(evaluatedUniverse, null, 2));
console.log('\nWrote complete evaluated universe to desk/evaluated_universe.json');
