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
    await new Promise(r => setTimeout(r, 400));
  }
  return { ok: false, error: 'Failed after ' + retries + ' attempts' };
}

async function main() {
  console.log('--- Step 1: Fresh Narrative Sweep (31 TradFi Assets) ---');
  const narratives = {};
  for (const sym of syms) {
    narratives[sym] = await fetchJson(`http://127.0.0.1:3000/api/cg/narrative?sym=${sym}`);
  }

  console.log('--- Step 2: Fresh Liqlevels Sweep & Exact ±2% LSR ---');
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
    let lsrRatio = 1.0;
    let lsrDesc = 'n/a';
    let dominant = 'none';

    if (liq.ok && liq.stats) {
      const above = (liq.stats.keyLevels?.above || []).filter(l => Math.abs(l.distPct) <= 2.0);
      const below = (liq.stats.keyLevels?.below || []).filter(l => Math.abs(l.distPct) <= 2.0);
      shortUsd2 = Math.round(above.reduce((s, l) => s + (l.usd || 0), 0));
      longUsd2 = Math.round(below.reduce((s, l) => s + (l.usd || 0), 0));

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

    const regime = narr.regime || 'RANGE_BALANCE';
    const direction = narr.direction || 'NEUTRAL';
    const grade = narr.grade || 'SKIP';
    const conf = narr.confidence ?? narr.conf ?? 20;
    const m1 = narr.m1?.status || 'OFF';
    const m2 = narr.m2?.status || 'OFF';
    const vwapZ = narr.context?.vwapZ ?? 0;
    const vetoes = narr.plan?.vetoes || [];

    // Qualification Criteria:
    // Grade A/A+, or conf >= 80 + triggered, or LSR >= 2.5 magnet, or |score| >= 2.0
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
      qualifyReason.push(`LSR Magnet ${lsrDesc} ($${Math.round((shortUsd2 + longUsd2)/1000)}k)`);
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
      vetoes: vetoes.length > 0 ? vetoes.join('; ') : 'None',
      shortUsd2,
      longUsd2,
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

  // Build Markdown report
  let md = '# TradFi & Classic Benchmarks (31 Assets) — Tier A & Tier B Telemetry Report\n\n';
  md += `*Generated at: ${outputData.generatedAt}*\n\n`;

  md += '## 1. Tier A Full Universe Summary Table (31 Assets)\n\n';
  md += '| Symbol | Regime | Bias | Grade | Conf | M1 Status | M2 Status | VWAP Z | ±2% Short Liq | ±2% Long Liq | ±2% LSR | Active Vetoes | Tier B Qual? |\n';
  md += '| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |\n';

  for (const a of tierASummary) {
    const shortStr = a.shortUsd2 > 0 ? '$' + Math.round(a.shortUsd2/1000) + 'k' : '$0';
    const longStr = a.longUsd2 > 0 ? '$' + Math.round(a.longUsd2/1000) + 'k' : '$0';
    const vetoText = a.vetoes === 'None' ? 'None' : (a.vetoes.length > 55 ? a.vetoes.slice(0, 52) + '...' : a.vetoes);
    md += `| **${a.sym}** | ${a.regime} | ${a.direction} | ${a.grade} | ${a.conf}% | ${a.m1} | ${a.m2} | ${a.vwapZ}σ | ${shortStr} | ${longStr} | ${a.lsrDesc} | ${vetoText} | ${a.isQualifier ? '**QUALIFIED**' : 'No'} |\n`;
  }

  md += '\n---\n\n## 2. Tier B Deep Telemetry & Qualifier Audits\n\n';

  for (const sym of qualifiers) {
    const dt = deepTelemetry[sym];
    const narr = dt.narrative || {};
    const liq = dt.liqlevels;

    let shortUsd = 0;
    let longUsd = 0;
    if (liq && liq.stats) {
      const above = (liq.stats.keyLevels?.above || []).filter(l => Math.abs(l.distPct) <= 2.0);
      const below = (liq.stats.keyLevels?.below || []).filter(l => Math.abs(l.distPct) <= 2.0);
      shortUsd = above.reduce((acc, l) => acc + (l.usd || 0), 0);
      longUsd = below.reduce((acc, l) => acc + (l.usd || 0), 0);
    }

    let lsrRatio = 1.0;
    let dominantSide = 'balanced';
    if (longUsd >= shortUsd) {
      lsrRatio = shortUsd > 0 ? (longUsd / shortUsd) : (longUsd > 0 ? 999 : 1.0);
      dominantSide = 'longs_below';
    } else {
      lsrRatio = longUsd > 0 ? (shortUsd / longUsd) : (shortUsd > 0 ? 999 : 1.0);
      dominantSide = 'shorts_above';
    }

    const confVal = narr.confidence ?? narr.conf ?? 0;

    md += `### ${sym} — ${narr.direction} (Grade ${narr.grade}, Conf ${confVal}%) · Model: ${narr.activeModel || 'n/a'}\n\n`;
    md += `- **Price**: ${narr.context?.price?.toFixed ? narr.context.price.toFixed(2) : narr.context?.price} | **VWAP Z-Score**: ${narr.context?.vwapZ?.toFixed ? narr.context.vwapZ.toFixed(2) : narr.context?.vwapZ}σ | **Regime**: ${narr.regime}\n`;
    md += `- **M1 Status**: ${narr.m1?.status} (${narr.m1?.note || 'n/a'})\n`;
    md += `- **M2 Status**: ${narr.m2?.status} (${narr.m2?.note || 'n/a'})\n`;
    md += `- **Vetoes**: ${narr.plan?.vetoes?.length > 0 ? narr.plan.vetoes.join('; ') : 'None'}\n`;
    
    const entryStr = narr.plan?.entryZone ? '[' + narr.plan.entryZone.map(x => x.toFixed(2)).join(', ') + ']' : 'n/a';
    const stopStr = narr.plan?.stop ? narr.plan.stop.toFixed(2) : 'n/a';
    const rStr = narr.plan?.bestR ? narr.plan.bestR.toFixed(2) : 'n/a';
    md += `- **Plan Details**: Entry Zone: ${entryStr} | Structural Stop: ${stopStr} | Best R: ${rStr}\n`;
    md += `- **Targets**: ${(narr.plan?.targets || []).map(t => t.label + ' @ ' + t.level?.toFixed(2) + ' (' + (t.rMultiple ? t.rMultiple.toFixed(2) + 'R' : '') + ')').join(' · ')}\n`;
    md += `- **±2% Liquidation Skew (LSR)**: Shorts above $${Math.round(shortUsd).toLocaleString()} vs Longs below $${Math.round(longUsd).toLocaleString()} → **${lsrRatio >= 999 ? '∞' : lsrRatio.toFixed(2)}:1 (${dominantSide})** | Magnet Gate (>=2.5:1): **${lsrRatio >= 2.5 ? 'TRIGGERED (Active Magnet)' : 'Pass (Gate Open)'}**\n`;
    
    // MT5 execution check
    if (outputData.mt5Executables[sym]) {
      const sp = outputData.mt5Executables[sym];
      md += `- **MT5 Broker Executability**: **YES (${sym}USD)** | Spread: ${sp.spreadPct?.toFixed(4)}% (${sp.spreadPct < 0.15 ? 'PASS' : 'VETO > 0.15%'}) | Basis: ${sp.basisPct?.toFixed(4)}%\n`;
    } else {
      md += `- **MT5 Broker Executability**: NO (USDT-M Perp / Binance execution venue)\n`;
    }

    md += '\n';
  }

  fs.writeFileSync('./desk/tradfi_tier_report.md', md);
  console.log('Finished writing desk/tradfi_scan_results.json and desk/tradfi_tier_report.md');
}

main().catch(console.error);
