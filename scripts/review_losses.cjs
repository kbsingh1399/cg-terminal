const http = require('http');

async function get(path) {
  return new Promise(resolve => {
    http.get('http://127.0.0.1:3000' + path, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve(JSON.parse(d)); } catch(e) { resolve(null); }
      });
    }).on('error', () => resolve(null));
  });
}

async function run() {
  console.log('===============================================================');
  console.log('FORENSIC TRADE POST-MORTEM & LOSS REVIEW');
  console.log('===============================================================\n');

  console.log('1. BTC FOOTPRINT MICROSTRUCTURE (M15 BARS AROUND SWEEP):');
  const fp = await get('/api/cg/fp?sym=BTC&interval=m15&limit=8');
  (fp?.bars || []).slice(-6).forEach(b => {
    const ts = new Date(b.ts * 1000).toISOString();
    let buyVol = 0, sellVol = 0;
    if (b.fp) {
      buyVol = (b.fp.b || []).reduce((a,c) => a + c, 0);
      sellVol = (b.fp.s || []).reduce((a,c) => a + c, 0);
    }
    const delta = buyVol - sellVol;
    const deltaSign = delta > 0 ? '+' : '';
    console.log(`  Bar ${ts} | O:${b.o} H:${b.h} L:${b.l} C:${b.c} | Delta: ${deltaSign}${delta.toFixed(2)} BTC (Buys: ${buyVol.toFixed(1)}, Sells: ${sellVol.toFixed(1)})`);
  });

  console.log('\n2. ETH FOOTPRINT MICROSTRUCTURE (M15 BARS AROUND SWEEP):');
  const fpEth = await get('/api/cg/fp?sym=ETH&interval=m15&limit=8');
  (fpEth?.bars || []).slice(-6).forEach(b => {
    const ts = new Date(b.ts * 1000).toISOString();
    let buyVol = 0, sellVol = 0;
    if (b.fp) {
      buyVol = (b.fp.b || []).reduce((a,c) => a + c, 0);
      sellVol = (b.fp.s || []).reduce((a,c) => a + c, 0);
    }
    const delta = buyVol - sellVol;
    const deltaSign = delta > 0 ? '+' : '';
    console.log(`  Bar ${ts} | O:${b.o} H:${b.h} L:${b.l} C:${b.c} | Delta: ${deltaSign}${delta.toFixed(2)} ETH (Buys: ${buyVol.toFixed(1)}, Sells: ${sellVol.toFixed(1)})`);
  });

  console.log('\n3. LIQUIDATION CLUSTERS & SWEEP METRICS:');
  const liqBtc = await get('/api/cg/liqlevels?sym=BTC');
  const liqEth = await get('/api/cg/liqlevels?sym=ETH');
  console.log('  BTC Liq Clusters remaining:', (liqBtc?.clusters || liqBtc?.data?.clusters || []).length);
  console.log('  ETH Liq Clusters remaining:', (liqEth?.clusters || liqEth?.data?.clusters || []).length);
}

run();
