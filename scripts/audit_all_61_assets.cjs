/**
 * scripts/audit_all_61_assets.cjs
 * Comprehensive universe audit across all 61 assets at http://127.0.0.1:3000/
 * Grounded in Canonical Trade Formulation Manual (SOP) v1.1.0
 */
const fs = require('fs');

const BASE_URL = 'http://127.0.0.1:3000';

async function fetchJson(url, timeoutMs = 8000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(id);
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    clearTimeout(id);
    return null;
  }
}

async function main() {
  console.log('Fetching screener for all 61 assets...');
  const screener = await fetchJson(`${BASE_URL}/api/cg/screener`);
  if (!screener || !screener.rows) {
    console.error('Failed to fetch screener');
    process.exit(1);
  }

  let mt5 = {};
  try {
    mt5 = JSON.parse(fs.readFileSync('desk/mt5.json', 'utf8'));
  } catch (e) {}
  const spreads = mt5.spreads || {};
  const account = mt5.account || { equity: 4643.7 };

  const rows = screener.rows;
  console.log(`Loaded ${rows.length} assets from screener.`);

  // Audit each asset with concurrency limit of 5
  const results = [];
  const chunkSize = 5;

  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const chunkPromises = chunk.map(async (row) => {
      const sym = row.sym;
      const [mkt, narr, sig, liq, walls, cvd, quant] = await Promise.all([
        fetchJson(`${BASE_URL}/api/cg/market?sym=${sym}`),
        fetchJson(`${BASE_URL}/api/cg/narrative?sym=${sym}`),
        fetchJson(`${BASE_URL}/api/cg/signals?sym=${sym}`),
        fetchJson(`${BASE_URL}/api/cg/liqlevels?sym=${sym}`),
        fetchJson(`${BASE_URL}/api/cg/bookwalls?sym=${sym}`),
        fetchJson(`${BASE_URL}/api/cg/cvd?sym=${sym}`),
        fetchJson(`${BASE_URL}/api/cg/quant?sym=${sym}`)
      ]);

      let opt = null;
      if (sym === 'BTC' || sym === 'ETH') {
        opt = await fetchJson(`${BASE_URL}/api/cg/options?sym=${sym}`);
      }

      // Map MT5 symbol
      let mt5Sym = sym === 'XAU' ? 'XAUUSD' : sym === 'ETH' ? 'ETHUSD' : sym === 'BTC' ? 'BTCUSD' : sym === 'CL' ? 'USOUSD' : `${sym}USD`;
      if (sym === 'DOGE') mt5Sym = 'DOGUSD';
      if (sym === 'LINK') mt5Sym = 'LNKUSD';
      const spreadInfo = spreads[mt5Sym];

      // Compute LSR
      const bands = liq?.stats?.bands || [];
      const b01 = bands[0] || {};
      const b12 = bands[1] || {};
      const shortsAbove = (b01.up || 0) + (b12.up || 0);
      const longsBelow = (b01.down || 0) + (b12.down || 0);
      const maxSide = Math.max(shortsAbove, longsBelow);
      const minSide = Math.max(1, Math.min(shortsAbove, longsBelow));
      const lsr = Number((maxSide / minSide).toFixed(2));
      const dominantSide = shortsAbove >= longsBelow ? 'SHORT_LIQ_ABOVE' : 'LONG_LIQ_BELOW';

      return {
        sym,
        name: row.name,
        kind: row.kind,
        category: row.category,
        sub: row.sub,
        price: row.price,
        vwapZ: row.vwapZ,
        ema4h: row.ema4h,
        ema1h: row.ema1h,
        m1m2: row.m1m2,
        signal: row.signal,
        confluenceSummary: row.confluence,
        lsr,
        dominantSide,
        shortsAbove,
        longsBelow,
        spreadInfo,
        mkt,
        narr,
        sig,
        liq,
        walls,
        cvd,
        quant,
        opt
      };
    });

    const chunkResults = await Promise.all(chunkPromises);
    results.push(...chunkResults);
    process.stdout.write(`Processed ${results.length}/${rows.length} assets...\r`);
  }

  console.log(`\nCompleted fetching all ${results.length} assets.`);

  // Write full raw results to a scratch json file for analysis
  fs.writeFileSync('desk/audit_full_universe.json', JSON.stringify(results, null, 2));
  console.log('Saved raw audit to desk/audit_full_universe.json');
}

main().catch(console.error);
