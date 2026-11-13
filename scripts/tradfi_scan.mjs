import fs from 'fs';

const syms = [
  'XAU', 'NVDA', 'SNDK', 'SOXL', 'SPCX', 'GOOGL', 'MU', 'SKHY',
  'XAG', 'CL', 'INTC', 'CRCL', 'MSTR', 'QQQ', 'ANTHROPIC', 'AAPL',
  'TSLA', 'DRAM', 'KORU', 'META', 'NBIS', 'MSFT', 'AMZN', 'AMD',
  'COIN', 'NFLX', 'AVGO', 'TSM', 'SPX500', 'UKO', 'NDX100'
];

async function fetchJson(url, timeoutMs = 15000, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timer);
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      clearTimeout(timer);
    }
    // brief delay before retry
    await new Promise(r => setTimeout(r, 500));
  }
  return { ok: false, error: 'Failed after ' + retries + ' attempts' };
}

async function main() {
  console.log('--- Step 1: Pulling Narrative for 31 TradFi Assets ---');
  const narratives = {};
  for (const sym of syms) {
    narratives[sym] = await fetchJson(`http://127.0.0.1:3000/api/cg/narrative?sym=${sym}`);
  }

  console.log('--- Step 2: Pulling Liqlevels & Computing LSR (±2%) ---');
  const liqData = {};
  for (const sym of syms) {
    liqData[sym] = await fetchJson(`http://127.0.0.1:3000/api/cg/liqlevels?sym=${sym}`);
  }

  const tierASummary = [];
  const qualifiers = new Set();

  for (const sym of syms) {
    const narr = narratives[sym] || {};
    const liq = liqData[sym] || {};

    let shortUsd2 = 0;
    let longUsd2 = 0;
    let lsrRatio = 0;
    let lsrDesc = 'n/a';
    let dominant = 'none';

    if (liq.ok && liq.stats) {
      const above = (liq.stats.keyLevels?.above || []).filter(l => Math.abs(l.distPct) <= 2.0);
      const below = (liq.stats.keyLevels?.below || []).filter(l => Math.abs(l.distPct) <= 2.0);
      shortUsd2 = above.reduce((s, l) => s + (l.usd || 0), 0);
      longUsd2 = below.reduce((s, l) => s + (l.usd || 0), 0);

      if (shortUsd2 > 0 || longUsd2 > 0) {
        if (longUsd2 >= shortUsd2) {
          lsrRatio = shortUsd2 > 0 ? (longUsd2 / shortUsd2) : (longUsd2 > 0 ? 999.0 : 1.0);
          dominant = 'longs_below';
          lsrDesc = `${lsrRatio >= 999 ? '∞' : lsrRatio.toFixed(2)}:1 (Longs)`;
        } else {
          lsrRatio = longUsd2 > 0 ? (shortUsd2 / longUsd2) : (shortUsd2 > 0 ? 999.0 : 1.0);
          dominant = 'shorts_above';
          lsrDesc = `${lsrRatio >= 999 ? '∞' : lsrRatio.toFixed(2)}:1 (Shorts)`;
        }
      }
    }

    const regime = narr.regime || 'UNKNOWN';
    const direction = narr.direction || 'NEUTRAL';
    const grade = narr.grade || 'SKIP';
    const conf = narr.confidence ?? 0;
    const m1 = narr.m1?.status || 'OFF';
    const m2 = narr.m2?.status || 'OFF';
    const vwapZ = narr.context?.vwapZ ?? 0;
    const vetoes = narr.plan?.vetoes || [];

    // Qualification check:
    // Grade A/A+, or conf >= 80 + triggered, or LSR >= 2.5 magnet (with substantial liq >= $100k), or |score| >= 2.0
    let isQualifier = false;
    let qualifyReason = [];

    if (grade === 'A' || grade === 'A+') {
      isQualifier = true;
      qualifyReason.push(`Grade ${grade}`);
    }
    if (conf >= 80 && (m1 === 'TRIGGERED' || m2 === 'TRIGGERED')) {
      isQualifier = true;
      qualifyReason.push(`Conf ${conf}% + Triggered`);
    }
    if (Math.abs(vwapZ) >= 2.0) {
      isQualifier = true;
      qualifyReason.push(`|vwapZ| ${Math.abs(vwapZ).toFixed(2)} >= 2.0`);
    }
    if (lsrRatio >= 2.5 && (shortUsd2 + longUsd2 >= 100000)) {
      isQualifier = true;
      qualifyReason.push(`LSR Magnet ${lsrDesc} (Pool $${((shortUsd2 + longUsd2)/1000).toFixed(0)}k)`);
    }

    if (isQualifier) qualifiers.add(sym);

    tierASummary.push({
      sym,
      regime,
      direction,
      grade,
      conf,
      m1,
      m2,
      vwapZ: vwapZ ? vwapZ.toFixed(2) : '0.00',
      vetoes: vetoes.length > 0 ? vetoes.join('; ') : 'none',
      shortUsd2: Math.round(shortUsd2),
      longUsd2: Math.round(longUsd2),
      lsrRatio: lsrRatio >= 999 ? '∞' : lsrRatio.toFixed(2),
      dominant,
      lsrDesc,
      isQualifier,
      qualifyReason: qualifyReason.join(', ')
    });
  }

  console.log(`\nQualifiers identified (${qualifiers.size}):`, Array.from(qualifiers).join(', '));

  console.log('\n--- Step 3: Pulling Deep Telemetry for Qualifiers ---');
  const deepTelemetry = {};
  for (const sym of qualifiers) {
    console.log(`Fetching deep telemetry for ${sym}...`);
    const [market, signals, liqlevels, bookwalls, cvd] = await Promise.all([
      fetchJson(`http://127.0.0.1:3000/api/cg/market?sym=${sym}`),
      fetchJson(`http://127.0.0.1:3000/api/cg/signals?sym=${sym}`),
      fetchJson(`http://127.0.0.1:3000/api/cg/liqlevels?sym=${sym}`),
      fetchJson(`http://127.0.0.1:3000/api/cg/bookwalls?sym=${sym}`),
      fetchJson(`http://127.0.0.1:3000/api/cg/cvd?sym=${sym}`)
    ]);
    deepTelemetry[sym] = {
      narrative: narratives[sym],
      market,
      signals,
      liqlevels,
      bookwalls,
      cvd
    };
  }

  // Load MT5 Spreads
  let mt5 = {};
  try {
    mt5 = JSON.parse(fs.readFileSync('./desk/mt5.json', 'utf8'));
  } catch(e) {}

  const outputData = {
    generatedAt: new Date().toISOString(),
    tierASummary,
    qualifiers: Array.from(qualifiers),
    deepTelemetry,
    mt5Executables: {
      XAU: mt5.spreads?.XAUUSD || null,
      XAG: mt5.spreads?.XAGUSD || null,
      UKO: mt5.spreads?.UKOUSD || null,
      USO: mt5.spreads?.USOUSD || null
    }
  };

  fs.writeFileSync('./desk/tradfi_scan_results.json', JSON.stringify(outputData, null, 2));
  console.log('Results written to ./desk/tradfi_scan_results.json');
}

main().catch(console.error);
