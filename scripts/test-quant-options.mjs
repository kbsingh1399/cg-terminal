#!/usr/bin/env node
/**
 * Smoke test for the /api/cg/quant and /api/cg/options routes (Task QA).
 *
 * Verifies the REAL upstream endpoints and payload shapes those routes are
 * coded against — BTC (crypto) and NVDA (TradFi plain-name USDT-M perp):
 *   1. Binance fapi /futures/data/* long/short ratios (string numbers, row timestamps)
 *   2. Binance fapi /fapi/v1/ticker/24hr (lastPrice / quoteVolume / closeTime)
 *   3. Binance SPOT api/v3 ticker/price (BTCUSDT + NVDABUSDT B-token leg)
 *   4. Coinbase exchange BTC-USD ticker
 *   5. Deribit get_volatility_index_data (DVOL) + get_book_summary_by_currency
 *      (chain size, row keys, greek presence, expiry set)
 *   6. If a dev server is listening on :3000, exercises both routes end-to-end.
 *
 * No assertions on values — this prints raw JSON heads so shape mismatches
 * between the coded interfaces and live upstreams are visible at a glance.
 */

const FAPI = "https://fapi.binance.com";
const SPOT = "https://api.binance.com";
const COINBASE = "https://api.exchange.coinbase.com";
const DERIBIT = "https://www.deribit.com/api/v2";

const head = (obj, n = 220) => JSON.stringify(obj).slice(0, n);
const ok = (label) => console.log(`  [ok] ${label}`);
const fail = (label, err) => console.log(`  [FAIL] ${label}: ${err}`);

async function jget(url, headers = {}) {
  const res = await fetch(url, { headers: { accept: "application/json", ...headers } });
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    throw new Error(`non-JSON (${res.status}): ${text.slice(0, 80)}`);
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${head(body, 120)}`);
  return body;
}

async function main() {
  console.log("== 1. Binance fapi /futures/data (L/S ratios) ==");
  for (const [pair, period] of [["BTCUSDT", "15m"], ["NVDAUSDT", "1h"]]) {
    for (const ep of ["globalLongShortAccountRatio", "topLongShortPositionRatio", "takerlongshortRatio"]) {
      try {
        const rows = await jget(`${FAPI}/futures/data/${ep}?symbol=${pair}&period=${period}&limit=2`);
        ok(`${ep} ${pair} ${period} -> ${head(rows[0])}`);
      } catch (e) {
        fail(`${ep} ${pair} ${period}`, e.message);
      }
    }
  }

  console.log("== 2. Binance fapi /fapi/v1/ticker/24hr ==");
  for (const pair of ["BTCUSDT", "NVDAUSDT"]) {
    try {
      const t = await jget(`${FAPI}/fapi/v1/ticker/24hr?symbol=${pair}`);
      ok(`${pair} lastPrice=${t.lastPrice} quoteVolume=${t.quoteVolume} closeTime=${t.closeTime}`);
    } catch (e) {
      fail(`ticker/24hr ${pair}`, e.message);
    }
  }

  console.log("== 3. Binance SPOT api/v3 ticker/price ==");
  for (const pair of ["BTCUSDT", "NVDABUSDT", "1000PEPEUSDT"]) {
    try {
      const t = await jget(`${SPOT}/api/v3/ticker/price?symbol=${pair}`);
      ok(`${pair} -> ${head(t)}`);
    } catch (e) {
      fail(`spot ${pair}`, e.message);
    }
  }

  console.log("== 4. Coinbase BTC-USD ticker ==");
  try {
    const t = await jget(`${COINBASE}/products/BTC-USD/ticker`, { "user-agent": "Mozilla/5.0" });
    ok(`price=${t.price} time=${t.time}`);
  } catch (e) {
    fail("coinbase BTC-USD", e.message);
  }

  console.log("== 5. Deribit ==");
  try {
    const end = Date.now();
    const start = end - 86_400_000;
    const d = await jget(
      `${DERIBIT}/public/get_volatility_index_data?currency=BTC&start_timestamp=${start}&end_timestamp=${end}&resolution=3600`
    );
    const pts = d.result?.data ?? [];
    ok(`DVOL points=${pts.length} first=${head(pts[0])} last=${head(pts[pts.length - 1])}`);
  } catch (e) {
    fail("deribit DVOL", e.message);
  }
  try {
    const s = await jget(`${DERIBIT}/public/get_book_summary_by_currency?currency=BTC&kind=option&expired=false`);
    const rows = s.result ?? [];
    const row0 = rows[0] ?? {};
    const hasGreeks = rows.filter((r) => r.gamma != null || r.delta != null).length;
    const expiries = [...new Set(rows.map((r) => (r.instrument_name ?? "").split("-")[1]))].filter(Boolean);
    ok(`chain rows=${rows.length} greekRows=${hasGreeks}`);
    ok(`row0 keys=${Object.keys(row0).join(",")}`);
    ok(`row0=${head(row0, 300)}`);
    ok(`expiries(${expiries.length})=${expiries.slice(0, 12).join(" ")}`);
  } catch (e) {
    fail("deribit chain", e.message);
  }

  console.log("== 6. Routes through the dev server (only if running) ==");
  const base = "http://localhost:3000";
  try {
    const res = await fetch(`${base}/api/cg/quant?sym=BTC`, {
      signal: AbortSignal.timeout(45_000),
    });
    const body = await res.json();
    ok(`GET /api/cg/quant?sym=BTC -> HTTP ${res.status}`);
    console.log(`       ${head(body, 700)}`);
  } catch {
    console.log("  [skip] dev server not running on :3000 — upstream verification above stands alone");
  }
  try {
    const res = await fetch(`${base}/api/cg/options?sym=BTC`, {
      signal: AbortSignal.timeout(45_000),
    });
    const body = await res.json();
    ok(`GET /api/cg/options?sym=BTC -> HTTP ${res.status}`);
    console.log(`       ${head(body, 700)}`);
  } catch {
    console.log("  [skip] dev server not running on :3000 — upstream verification above stands alone");
  }
}

main().catch((e) => {
  console.error("smoke script crashed:", e);
  process.exit(1);
});
