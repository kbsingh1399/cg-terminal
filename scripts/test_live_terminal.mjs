async function testAll() {
  const routes = [
    { name: 'Root UI (HTML Overview)', url: 'http://127.0.0.1:3000/?sym=BTC&view=terminal&tab=overview' },
    { name: 'Health Status', url: 'http://127.0.0.1:3000/api/health' },
    { name: 'Curated Assets Registry', url: 'http://127.0.0.1:3000/api/cg/assets' },
    { name: 'Market Snapshot (BTC)', url: 'http://127.0.0.1:3000/api/cg/market?sym=BTC' },
    { name: 'Signals Engine (BTC)', url: 'http://127.0.0.1:3000/api/cg/signals?sym=BTC' },
    { name: 'Notifications Feed', url: 'http://127.0.0.1:3000/api/cg/notifications?limit=5' },
    { name: 'Liquidation Levels (BTC)', url: 'http://127.0.0.1:3000/api/cg/liqlevels?sym=BTC' },
    { name: 'Large Orders / Walls (BTC)', url: 'http://127.0.0.1:3000/api/cg/largeorder?sym=BTC' },
    { name: 'Book Walls Multi-Venue (BTC)', url: 'http://127.0.0.1:3000/api/cg/bookwalls?sym=BTC' },
    { name: 'CVD Multi-Venue (BTC)', url: 'http://127.0.0.1:3000/api/cg/cvd?sym=BTC' },
    { name: 'Stopmap Heatmap (BTC)', url: 'http://127.0.0.1:3000/api/cg/stopmap?sym=BTC' },
    { name: 'Footprint Bars / Delta (BTC)', url: 'http://127.0.0.1:3000/api/cg/fp?sym=BTC' },
    { name: 'LTO Institutional Limits (BTC)', url: 'http://127.0.0.1:3000/api/cg/lto?sym=BTC' },
    { name: 'Quant Engine (BTC)', url: 'http://127.0.0.1:3000/api/cg/quant?sym=BTC' },
    { name: 'Options GEX & Gamma Flip (BTC)', url: 'http://127.0.0.1:3000/api/cg/options?sym=BTC' },
    { name: 'Screener Matrix (All 61)', url: 'http://127.0.0.1:3000/api/cg/screener' },
    { name: 'Narrative Engine (BTC)', url: 'http://127.0.0.1:3000/api/cg/narrative?sym=BTC' },
    { name: 'Live Binance Ticker (BTC)', url: 'http://127.0.0.1:3000/api/cg/live?sym=BTC' },
    { name: 'Live 1000-Depth Book (BTC)', url: 'http://127.0.0.1:3000/api/cg/livebook?sym=BTC' },
    { name: 'Kline Candles Series (BTC)', url: 'http://127.0.0.1:3000/api/cg/kline?interval=m15&symbol=Binance_BTCUSDT&limit=5' },
    { name: 'Open Interest Series (BTC)', url: 'http://127.0.0.1:3000/api/cg/oi?sym=BTC' },
    { name: 'Funding Rates (BTC)', url: 'http://127.0.0.1:3000/api/cg/funding?sym=BTC' },
    { name: 'Microstructure Flow (BTC)', url: 'http://127.0.0.1:3000/api/cg/micro?sym=BTC' },
    { name: 'Orderflow Aggregate (BTC)', url: 'http://127.0.0.1:3000/api/cg/orderflow-agg?sym=BTC' },
    { name: 'Perp Depth Profile (USO)', url: 'http://127.0.0.1:3000/api/cg/perpdepth?sym=USO' },
    { name: 'Classic Benchmark (SPX500)', url: 'http://127.0.0.1:3000/api/cg/classic?sym=SPX500' }
  ];

  console.log('='.repeat(96));
  console.log('LIVE PRODUCTION SERVER TELEMETRY & UI HEALTH AUDIT');
  console.log('Target: http://127.0.0.1:3000 | Engine: Next.js Standalone');
  console.log('='.repeat(96));

  const results = [];

  for (const r of routes) {
    const t0 = Date.now();
    try {
      const res = await fetch(r.url, { signal: AbortSignal.timeout(15000) });
      const dt = Date.now() - t0;
      const status = res.status;
      let preview = '';
      const ct = res.headers.get('content-type') || '';
      if (ct.includes('application/json')) {
        const j = await res.json();
        if (Array.isArray(j)) {
          preview = `Array(${j.length}) items`;
        } else if (typeof j === 'object' && j !== null) {
          const keys = Object.keys(j).slice(0, 5).join(', ');
          preview = `{ ${keys}... }`;
        } else {
          preview = String(j);
        }
      } else {
        const txt = await res.text();
        preview = txt.slice(0, 60).replace(/\s+/g, ' ');
      }
      results.push({ name: r.name, status, dt, ok: res.ok, preview, url: r.url });
      console.log(`[${res.ok ? 'PASS' : 'FAIL'}] ${r.name.padEnd(32)} | HTTP ${status} | ${String(dt).padStart(4)}ms | ${preview}`);
    } catch (e) {
      console.log(`[ERR ] ${r.name.padEnd(32)} | TIMEOUT/ERR | ${e.message}`);
      results.push({ name: r.name, status: 'ERR', dt: -1, ok: false, preview: e.message, url: r.url });
    }
  }

  console.log('='.repeat(96));
  const passCount = results.filter(r => r.ok).length;
  console.log(`TOTAL AUDIT RESULT: ${passCount} / ${results.length} PASSED (${((passCount / results.length) * 100).toFixed(1)}%)`);
  console.log('='.repeat(96));

  return results;
}

testAll();
