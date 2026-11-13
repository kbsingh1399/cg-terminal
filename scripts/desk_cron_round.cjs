/**
 * desk_cron_round.cjs — Automated Institutional Round Execution
 *
 * Runs on every 15-minute clock quarter.
 * 1. Syncs MT5 broker snapshot (account, positions, orders, spreads).
 * 2. Monitors active trades against the Critical Realism Protocol (+1.0R Breakeven trigger).
 * 3. Monitors pending limit orders for fill status and structural validity.
 * 4. Screens the universe for fresh high-confluence candidates across all 10 terminal telemetry layers.
 */

const { execSync } = require('child_process');
const fs = require('fs');

const BASE_URL = 'http://127.0.0.1:3000';

async function fetchJson(url) {
  try {
    const res = await fetch(url);
    return await res.json();
  } catch (e) {
    return null;
  }
}

async function runRound() {
  const ts = new Date().toISOString();
  console.log(`\n===============================================================`);
  console.log(`[DESK CRON ROUND] Active at ${ts}`);
  console.log(`===============================================================`);

  // 1. Sync MT5 snapshot via mt5_report.py
  try {
    execSync('python scripts/mt5_report.py', { stdio: 'inherit' });
  } catch (e) {
    console.error('Failed to run mt5_report.py:', e.message);
  }

  // Read fresh mt5.json
  let mt5 = {};
  try {
    mt5 = JSON.parse(fs.readFileSync('desk/mt5.json', 'utf8'));
  } catch (e) {
    console.error('Failed to read mt5.json:', e.message);
  }

  const account = mt5.account || {};
  const positions = mt5.positions || [];
  const orders = mt5.orders || [];
  const spreads = mt5.spreads || {};

  console.log(`\n[1. MT5 DESK HEALTH]`);
  console.log(`Account Equity: $${account.equity?.toFixed(2)} | Balance: $${account.balance?.toFixed(2)} | Open Positions: ${positions.length} | Pending Orders: ${orders.length}`);

  // 2. Audit Open Positions
  console.log(`\n[2. OPEN POSITION AUDIT & RISK MANAGEMENT]`);
  if (!positions.length) {
    console.log(`No open positions active.`);
  } else {
    for (const pos of positions) {
      const sym = pos.asset;
      const mkt = await fetchJson(`${BASE_URL}/api/cg/market?sym=${sym}`);
      const spotPrice = mkt?.price?.last || pos.current;
      const profitR = pos.side === 'sell'
        ? (pos.open - spotPrice) / Math.abs(pos.sl - pos.open)
        : (spotPrice - pos.open) / Math.abs(pos.open - pos.sl);

      console.log(`- Position #${pos.ticket} (${pos.symbol} ${pos.side.toUpperCase()} ${pos.volume} lots):`);
      console.log(`  Entry: ${pos.open} | Current: ${spotPrice} | SL: ${pos.sl} | TP: ${pos.tp}`);
      console.log(`  Floating PnL: $${pos.profit?.toFixed(2)} | Excursion: ${profitR.toFixed(2)}R`);

      // +1.0R Breakeven Trigger Check
      if (profitR >= 1.0) {
        console.log(`  >>> [ACTION TRIGGER]: Price reached +1.0R (${profitR.toFixed(2)}R)! Move SL to Breakeven (${pos.open}) to eliminate tail risk!`);
      } else {
        console.log(`  Status: In flight, holding with original structural stop.`);
      }
    }
  }

  // 3. Audit Pending Orders
  console.log(`\n[3. PENDING LIMIT ORDERS AUDIT]`);
  if (!orders.length) {
    console.log(`No pending limit orders standing.`);
  } else {
    for (const ord of orders) {
      const sym = ord.asset;
      const mkt = await fetchJson(`${BASE_URL}/api/cg/market?sym=${sym}`);
      const spot = mkt?.price?.last;
      const distPct = spot ? ((ord.price - spot) / spot * 100).toFixed(2) : 'N/A';
      console.log(`- Order #${ord.ticket} (${ord.symbol} ${ord.type.toUpperCase()} ${ord.volume} lots @ ${ord.price}):`);
      console.log(`  Spot: ${spot} | Distance to Fill: ${distPct}% | SL: ${ord.sl} | TP: ${ord.tp}`);
    }
  }

  // 4. Universal 360° Candidate Screener
  console.log(`\n[4. 360° HIGH CONFLUENCE CANDIDATE RADAR]`);
  const candidates = ['BTC', 'ETH', 'XAU', 'XLM', 'XRP', 'SOL', 'CL'];
  const screened = [];

  for (const sym of candidates) {
    const mt5Sym = sym === 'XAU' ? 'XAUUSD' : sym === 'ETH' ? 'ETHUSD' : sym === 'BTC' ? 'BTCUSD' : sym === 'CL' ? 'USOUSD' : `${sym}USD`;
    const spreadInfo = spreads[mt5Sym];

    if (!spreadInfo || !spreadInfo.ok || !spreadInfo.tradeAllowed) {
      continue; // Skip if no viable MT5 execution
    }

    const spreadPct = (spreadInfo.spreadPct || 0).toFixed(3);
    if (parseFloat(spreadPct) > 0.15) {
      continue; // Disqualify if spread exceeds 0.15%
    }

    const [mkt, sig, liq, cvd, opt] = await Promise.all([
      fetchJson(`${BASE_URL}/api/cg/market?sym=${sym}`),
      fetchJson(`${BASE_URL}/api/cg/signals?sym=${sym}`),
      fetchJson(`${BASE_URL}/api/cg/liqlevels?sym=${sym}`),
      fetchJson(`${BASE_URL}/api/cg/cvd?sym=${sym}&itv=15m`),
      (sym === 'BTC' || sym === 'ETH') ? fetchJson(`${BASE_URL}/api/cg/options?sym=${sym}`) : Promise.resolve(null)
    ]);

    const spot = mkt?.price?.last;
    const vwap = mkt?.vwap?.vwap;
    const vwapDiff = (spot && vwap) ? ((spot - vwap) / vwap * 100).toFixed(2) : '0';
    const cvdQuad = cvd?.kpis?.quadrant || 'N/A';
    const topLiq = (liq?.stats?.keyLevels?.above || [])[0]?.price || 'N/A';
    const btmLiq = (liq?.stats?.keyLevels?.below || [])[0]?.price || 'N/A';

    screened.push({
      sym,
      mt5Sym,
      spot,
      vwapDiff: `${vwapDiff}%`,
      spread: `${spreadPct}%`,
      signals: `${sig?.counts?.bullish || 0}B / ${sig?.counts?.bearish || 0}S`,
      cvdQuad,
      optionsGex: opt?.gex?.regime || 'N/A',
      liqTarget: btmLiq
    });
  }

  console.table(screened);
  console.log(`[DESK CRON ROUND] Complete.\n`);
}

runRound().catch(console.error);
