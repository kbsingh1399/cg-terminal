import fs from 'node:fs';

const BASE_URL = 'http://127.0.0.1:3000';

const CRYPTO_30 = [
  { sym: 'BTC', name: 'Bitcoin', sub: 'Store of Value' },
  { sym: 'ETH', name: 'Ethereum', sub: 'Smart Contract L1' },
  { sym: 'BNB', name: 'BNB', sub: 'Exchange Token' },
  { sym: 'SOL', name: 'Solana', sub: 'Smart Contract L1' },
  { sym: 'XRP', name: 'XRP', sub: 'Payments' },
  { sym: 'ADA', name: 'Cardano', sub: 'Smart Contract L1' },
  { sym: 'DOGE', name: 'Dogecoin', sub: 'Meme' },
  { sym: 'TRX', name: 'TRON', sub: 'Smart Contract L1' },
  { sym: 'LINK', name: 'Chainlink', sub: 'Oracle' },
  { sym: 'LTC', name: 'Litecoin', sub: 'Payments' },
  { sym: 'AVAX', name: 'Avalanche', sub: 'Smart Contract L1' },
  { sym: 'DOT', name: 'Polkadot', sub: 'Interoperability' },
  { sym: 'NEAR', name: 'NEAR Protocol', sub: 'Smart Contract L1' },
  { sym: 'UNI', name: 'Uniswap', sub: 'DeFi DEX' },
  { sym: 'ATOM', name: 'Cosmos', sub: 'Interoperability' },
  { sym: 'XLM', name: 'Stellar', sub: 'Payments' },
  { sym: 'ETC', name: 'Ethereum Classic', sub: 'Smart Contract L1' },
  { sym: 'FIL', name: 'Filecoin', sub: 'Storage' },
  { sym: 'ICP', name: 'Internet Computer', sub: 'Smart Contract L1' },
  { sym: 'HBAR', name: 'Hedera', sub: 'Enterprise L1' },
  { sym: 'APT', name: 'Aptos', sub: 'Smart Contract L1' },
  { sym: 'ARB', name: 'Arbitrum', sub: 'Ethereum L2' },
  { sym: 'OP', name: 'Optimism', sub: 'Ethereum L2' },
  { sym: 'SUI', name: 'Sui', sub: 'Smart Contract L1' },
  { sym: 'SEI', name: 'Sei', sub: 'Smart Contract L1' },
  { sym: 'INJ', name: 'Injective', sub: 'DeFi L1' },
  { sym: 'TIA', name: 'Celestia', sub: 'Modular DA' },
  { sym: 'VET', name: 'VeChain', sub: 'Supply Chain' },
  { sym: '1000PEPE', name: 'Pepe (1000x perp)', sub: 'Meme' },
  { sym: '1000SHIB', name: 'Shiba Inu (1000x perp)', sub: 'Meme' }
];

async function fetchJson(url, timeoutMs = 12000, retries = 2) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(id);
      if (!res.ok) {
        if (attempt === retries) return null;
      } else {
        return await res.json();
      }
    } catch (e) {
      clearTimeout(id);
      if (attempt === retries) return null;
    }
    await new Promise((r) => setTimeout(r, 350));
  }
  return null;
}

async function runBatch(items, fn, concurrency = 5) {
  const results = [];
  for (let i = 0; i < items.length; i += concurrency) {
    const chunk = items.slice(i, i + concurrency);
    const res = await Promise.all(chunk.map(fn));
    results.push(...res);
  }
  return results;
}

async function main() {
  console.log(`Starting Round 6 Crypto Sweep for 30 Assets at ${new Date().toISOString()}`);

  // Load MT5 state
  let mt5 = { account: { balance: 4643.54, equity: 4645.26 }, spreads: {} };
  try {
    mt5 = JSON.parse(fs.readFileSync('desk/mt5.json', 'utf8'));
  } catch (e) {}
  const spreads = mt5.spreads || {};

  // Step 1: Narrative & Liqlevels Sweep
  console.log('Fetching narrative and liqlevels for 30 crypto assets...');
  const tierAData = await runBatch(
    CRYPTO_30,
    async (asset) => {
      const [narr, liq] = await Promise.all([
        fetchJson(`${BASE_URL}/api/cg/narrative?sym=${asset.sym}`),
        fetchJson(`${BASE_URL}/api/cg/liqlevels?sym=${asset.sym}`)
      ]);
      return { asset, narr, liq };
    },
    6
  );

  const tierARows = [];
  const qualifiers = [];

  for (const item of tierAData) {
    const { asset, narr, liq } = item;
    const sym = asset.sym;

    const regime = narr?.regime || 'RANGE_BALANCE';
    const direction = narr?.direction || 'NEUTRAL';
    const grade = narr?.grade || 'SKIP';
    const conf = narr?.confidence ?? narr?.conf ?? 20;
    const m1Status = narr?.m1?.status || 'OFF';
    const m2Status = narr?.m2?.status || 'OFF';
    const vwapZ = narr?.context?.vwapZ ?? 0;
    const price = narr?.context?.price ?? 0;
    const vetoes = narr?.plan?.vetoes || [];

    // Calculate exact +-2% LSR
    let shortsUp2pct = 0;
    let longsDown2pct = 0;
    if (liq && liq.stats) {
      const bands = liq.stats.bands || [];
      for (const b of bands) {
        if (b.b <= 2) {
          shortsUp2pct += b.up || 0;
          longsDown2pct += b.down || 0;
        }
      }
      if (shortsUp2pct === 0 && longsDown2pct === 0 && liq.stats.keyLevels) {
        const above = (liq.stats.keyLevels.above || []).filter((l) => Math.abs(l.distPct) <= 2.0);
        const below = (liq.stats.keyLevels.below || []).filter((l) => Math.abs(l.distPct) <= 2.0);
        shortsUp2pct = above.reduce((s, l) => s + (l.usd || 0), 0);
        longsDown2pct = below.reduce((s, l) => s + (l.usd || 0), 0);
      }
    }

    shortsUp2pct = Math.round(shortsUp2pct);
    longsDown2pct = Math.round(longsDown2pct);

    let lsrRatio = 1.0;
    let dominantSide = 'BALANCED';
    let lsrDesc = '1.0:1 (BAL)';

    if (shortsUp2pct > 0 || longsDown2pct > 0) {
      if (longsDown2pct >= shortsUp2pct) {
        lsrRatio = shortsUp2pct > 0 ? longsDown2pct / shortsUp2pct : 999.0;
        dominantSide = 'LONG_BELOW';
        lsrDesc = `${lsrRatio >= 999 ? '∞' : lsrRatio.toFixed(1)}:1 (LB)`;
      } else {
        lsrRatio = longsDown2pct > 0 ? shortsUp2pct / longsDown2pct : 999.0;
        dominantSide = 'SHORT_ABOVE';
        lsrDesc = `${lsrRatio >= 999 ? '∞' : lsrRatio.toFixed(1)}:1 (SA)`;
      }
    }

    // Broker spread info
    let mt5Sym = sym === 'BTC' ? 'BTCUSD' : sym === 'ETH' ? 'ETHUSD' : `${sym}USD`;
    if (sym === 'DOGE') mt5Sym = 'DOGUSD';
    if (sym === 'LINK') mt5Sym = 'LNKUSD';
    const spreadInfo = spreads[mt5Sym];

    let spreadVerdict = 'No MT5 Venue';
    let spreadPct = null;
    let isBrokerDisqualified = false;

    if (spreadInfo && spreadInfo.ok) {
      spreadPct = spreadInfo.spreadPct;
      if (spreadPct < 0.15) {
        spreadVerdict = `${spreadPct.toFixed(4)}% (PASS)`;
      } else {
        spreadVerdict = `${spreadPct.toFixed(4)}% (VETO)`;
        isBrokerDisqualified = true;
      }
    }

    // Qualification check:
    // Grade A/A+, OR Confidence >= 80% with M1/M2 Triggered, OR LSR >= 2.5:1 magnet, OR |Composite Score| >= 2.0 (or |VWAP z| >= 2.0), OR Core Tier-1 (BTC, ETH, SOL)
    let isQualifier = false;
    const qualifyReasons = [];

    if (['BTC', 'ETH', 'SOL'].includes(sym)) {
      isQualifier = true;
      qualifyReasons.push('Core Tier-1 Macro Benchmark');
    }
    if (grade === 'A' || grade === 'A+') {
      isQualifier = true;
      qualifyReasons.push(`Grade ${grade}`);
    }
    if (conf >= 80 && (m1Status === 'TRIGGERED' || m2Status === 'TRIGGERED')) {
      isQualifier = true;
      qualifyReasons.push(`Conf ${conf}% + ${m1Status === 'TRIGGERED' ? 'M1' : 'M2'} Triggered`);
    }
    if (lsrRatio >= 2.5 && (shortsUp2pct + longsDown2pct >= 50000)) {
      isQualifier = true;
      qualifyReasons.push(`LSR Magnet ${lsrDesc} ($${Math.round((shortsUp2pct + longsDown2pct) / 1000)}k)`);
    }
    if (Math.abs(vwapZ) >= 2.0) {
      isQualifier = true;
      qualifyReasons.push(`VWAP Stretch ${vwapZ.toFixed(2)}σ`);
    }

    const row = {
      sym,
      name: asset.name,
      sub: asset.sub,
      price,
      regime,
      direction,
      grade,
      conf,
      m1Status,
      m2Status,
      vwapZ,
      shortsUp2pct,
      longsDown2pct,
      lsrRatio,
      dominantSide,
      lsrDesc,
      spreadPct,
      spreadVerdict,
      isBrokerDisqualified,
      vetoes,
      isQualifier,
      qualifyReasons
    };

    tierARows.push(row);
    if (isQualifier) {
      qualifiers.push(row);
    }
  }

  console.log(`Tier A complete: 30 assets processed. ${qualifiers.length} qualifiers identified.`);

  // Step 2: Deep Telemetry for Qualifiers
  console.log(`Fetching deep telemetry for ${qualifiers.length} qualifying assets...`);
  const deepResults = await runBatch(
    qualifiers,
    async (q) => {
      const sym = q.sym;
      const [mkt, sig, cvd, bw, lto, opt, fp] = await Promise.all([
        fetchJson(`${BASE_URL}/api/cg/market?sym=${sym}`),
        fetchJson(`${BASE_URL}/api/cg/signals?sym=${sym}`),
        fetchJson(`${BASE_URL}/api/cg/cvd?sym=${sym}`),
        fetchJson(`${BASE_URL}/api/cg/bookwalls?sym=${sym}`),
        fetchJson(`${BASE_URL}/api/cg/lto?symbol=${sym}`),
        (sym === 'BTC' || sym === 'ETH') ? fetchJson(`${BASE_URL}/api/cg/options?sym=${sym}`) : Promise.resolve(null),
        fetchJson(`${BASE_URL}/api/cg/fp?sym=${sym}`)
      ]);

      return {
        sym,
        summary: q,
        mkt,
        sig,
        cvd,
        bw,
        lto,
        opt,
        fp
      };
    },
    4
  );

  // Save intermediate output to disk
  fs.writeFileSync('scripts/crypto_domain_sweep_data_round6.json', JSON.stringify({ tierARows, deepResults }, null, 2));
  console.log('Saved data to scripts/crypto_domain_sweep_data_round6.json');
}

main().catch(console.error);
