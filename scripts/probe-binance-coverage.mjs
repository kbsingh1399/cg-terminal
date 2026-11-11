#!/usr/bin/env node
/**
 * PROBE — Binance production coverage for the curated 60-asset universe.
 *
 * Kind A: 33 USDT-M PERP pairs on fapi.binance.com (incl. XAU/XAG/CL)
 * Kind B: 23 B-token spot bases on api.binance.com (+ sample microstructure)
 * Testnet: which kind-A pairs are TRADING on testnet.binancefuture.com
 *
 * Usage: node scripts/probe-binance-coverage.mjs
 * Writes /tmp/binance-coverage.json, prints a compact report.
 */
import { writeFileSync } from "fs";

const A_SYMS = ["BTC","ETH","BNB","SOL","XRP","ADA","DOGE","TRX","LINK","LTC","AVAX","DOT","NEAR","UNI","ATOM","XLM","ETC","FIL","ICP","HBAR","APT","ARB","OP","SUI","SEI","INJ","TIA","1000PEPE","1000SHIB","TON","XAU","XAG","CL"];
const B_SYMS = ["NVDAB","SNDKB","SOXLB","SPCXB","MUB","INTCB","CRCLB","SKHYB","MSTRB","KORUB","GOOGLB","NBISB","TSLAB","METAB","AAPLB","DRAMB","MSFTB","AMZNB","AMDB","COINB","NFLXB","AVGOB","TSMB"];
const B_SAMPLE = ["NVDAB", "MUB", "SOXLB"];

async function getJson(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  const text = await res.text();
  let body;
  try { body = JSON.parse(text); } catch { body = null; }
  return { status: res.status, body, text };
}

const out = { perps: {}, btokens: {}, btokensSample: {}, testnet: {}, _meta: { at: new Date().toISOString() } };

// ---------- Kind A: USDT-M perps (production fapi) ----------
console.log("== KIND A: fapi.binance.com USDT-M perpetuals ==");
{
  const { status, body } = await getJson("https://fapi.binance.com/fapi/v1/exchangeInfo");
  if (status !== 200 || !body?.symbols) {
    console.log(`fapi exchangeInfo HTTP ${status} — ABORT kind A`);
    for (const s of A_SYMS) out.perps[s] = { listed: null, testnet: null };
  } else {
    const bySym = new Map(body.symbols.map((x) => [x.symbol, x]));
    for (const s of A_SYMS) {
      const pair = `${s}USDT`;
      const e = bySym.get(pair);
      // TRADIFI_PERPETUAL (XAU/XAG/CL, onboarded Dec-2025..Apr-2026) is a live
      // perpetual contract type — count any *PERPETUAL with status TRADING.
      const perp = e && /PERPETUAL$/.test(e.contractType ?? "");
      const trading = e && e.status === "TRADING";
      out.perps[s] = {
        pair,
        listed: !!(perp && trading),
        contractType: e?.contractType ?? null,
        status: e?.status ?? null,
        onboardDate: e?.onboardDate ?? null,
      };
      if (!out.perps[s].listed) console.log(`  MISSING/NOT-TRADING: ${pair} -> ${e ? `${e.contractType}/${e.status}` : "not found"}`);
    }
    const nOk = Object.values(out.perps).filter((v) => v.listed).length;
    console.log(`  ${nOk}/${A_SYMS.length} kind-A perps TRADING on production fapi`);
  }
}

// ---------- Kind B: spot B-tokens (production api) ----------
console.log("== KIND B: api.binance.com spot <BASE>USDT ==");
{
  const { status, body } = await getJson("https://api.binance.com/api/v3/exchangeInfo");
  if (status !== 200 || !body?.symbols) {
    console.log(`spot exchangeInfo HTTP ${status} — ABORT kind B`);
    for (const s of B_SYMS) out.btokens[s] = { spot: null };
  } else {
    const bySym = new Map(body.symbols.map((x) => [x.symbol, x]));
    for (const s of B_SYMS) {
      const pair = `${s}USDT`;
      const e = bySym.get(pair);
      out.btokens[s] = {
        pair,
        spot: !!(e && e.status === "TRADING"),
        status: e?.status ?? null,
        baseAsset: e?.baseAsset ?? null,
        quote: e?.quoteAsset ?? null,
        isSpotTradingAllowed: e?.isSpotTradingAllowed ?? null,
        permissions: e?.permissions ?? null,
      };
      if (!out.btokens[s].spot) console.log(`  MISSING/NOT-TRADING: ${pair} -> ${e ? e.status : "not found"}`);
    }
    const nOk = Object.values(out.btokens).filter((v) => v.spot).length;
    console.log(`  ${nOk}/${B_SYMS.length} kind-B spot pairs TRADING on production api`);
  }
}

// ---------- Kind B samples: aggTrades / depth / klines ----------
console.log("== KIND B samples (aggTrades/depth/klines) ==");
for (const base of B_SAMPLE) {
  const sym = `${base}USDT`;
  const rec = {};
  // aggTrades
  {
    const { status, body } = await getJson(`https://api.binance.com/api/v3/aggTrades?symbol=${sym}&limit=1000`);
    rec.aggTrades = {
      http: status,
      ok: status === 200 && Array.isArray(body) && body.length > 0,
      rows: Array.isArray(body) ? body.length : 0,
      firstTs: Array.isArray(body) && body.length ? new Date(body[0].T).toISOString() : null,
      lastTs: Array.isArray(body) && body.length ? new Date(body[body.length - 1].T).toISOString() : null,
      lastPrice: Array.isArray(body) && body.length ? body[body.length - 1].p : null,
      err: status !== 200 ? (body?.msg ?? String(body).slice(0, 120)) : null,
    };
  }
  // depth
  {
    const { status, body } = await getJson(`https://api.binance.com/api/v3/depth?symbol=${sym}&limit=1000`);
    let depth = null;
    if (status === 200 && body?.bids && body?.asks) {
      const bb = +body.bids[0]?.[0] ?? 0;
      const ba = +body.asks[0]?.[0] ?? 0;
      const mid = (bb + ba) / 2;
      const notional = (rows, side) => rows.reduce((a, [p, q]) => a + (+p) * (+q), 0);
      const bidN = notional(body.bids);
      const askN = notional(body.asks);
      depth = {
        bids: body.bids.length,
        asks: body.asks.length,
        bestBid: bb,
        bestAsk: ba,
        mid,
        spreadAbs: +(ba - bb).toFixed(6),
        spreadPct: mid > 0 ? +(((ba - bb) / mid) * 100).toFixed(4) : null,
        bidNotionalUsd: Math.round(bidN),
        askNotionalUsd: Math.round(askN),
        totalNotionalUsd: Math.round(bidN + askN),
      };
    }
    rec.depth = {
      http: status,
      ok: !!depth,
      ...depth,
      err: status !== 200 ? (body?.msg ?? String(body).slice(0, 120)) : null,
    };
  }
  // klines 1m x10
  {
    const { status, body } = await getJson(`https://api.binance.com/api/v3/klines?symbol=${sym}&interval=1m&limit=10`);
    rec.klines1m = {
      http: status,
      ok: status === 200 && Array.isArray(body) && body.length > 0,
      rows: Array.isArray(body) ? body.length : 0,
      lastClose: Array.isArray(body) && body.length ? body[body.length - 1][4] : null,
      err: status !== 200 ? (body?.msg ?? String(body).slice(0, 120)) : null,
    };
  }
  out.btokensSample[base] = rec;
  console.log(
    `  ${base}: aggTrades http=${rec.aggTrades.http} rows=${rec.aggTrades.rows} lastPx=${rec.aggTrades.lastPrice} | depth http=${rec.depth.http} bids=${rec.depth.bids} asks=${rec.depth.asks} spreadPct=${rec.depth.spreadPct} notionalUsd=${rec.depth.totalNotionalUsd} | klines http=${rec.klines1m.http} rows=${rec.klines1m.rows}`
  );
}

// ---------- Testnet: kind-A pairs ----------
console.log("== TESTNET: testnet.binancefuture.com ==");
{
  const { status, body } = await getJson("https://testnet.binancefuture.com/fapi/v1/exchangeInfo");
  if (status !== 200 || !body?.symbols) {
    console.log(`testnet exchangeInfo HTTP ${status} — cannot determine`);
    for (const s of A_SYMS) out.testnet[s] = null;
    for (const s of A_SYMS) if (out.perps[s]) out.perps[s].testnet = null;
  } else {
    const bySym = new Map(body.symbols.map((x) => [x.symbol, x]));
    const missing = [];
    for (const s of A_SYMS) {
      const pair = `${s}USDT`;
      const e = bySym.get(pair);
      const trading = !!(e && e.status === "TRADING" && /PERPETUAL$/.test(e.contractType ?? ""));
      out.testnet[s] = { pair, trading, status: e?.status ?? "NOT_LISTED", contractType: e?.contractType ?? null };
      if (out.perps[s]) out.perps[s].testnet = trading;
      if (!trading) missing.push(`${pair}(${e?.status ?? "not listed"})`);
    }
    const nOk = Object.values(out.testnet).filter((v) => v?.trading).length;
    console.log(`  ${nOk}/${A_SYMS.length} kind-A pairs TRADING on testnet`);
    console.log(`  missing: ${missing.join(", ") || "none"}`);
  }
}

writeFileSync("/tmp/binance-coverage.json", JSON.stringify(out, null, 2));
console.log("\nwrote /tmp/binance-coverage.json");
