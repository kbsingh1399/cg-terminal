#!/usr/bin/env node
/**
 * verify-micro-map.mjs — LIVE verification of the MICRO_MAP against the real
 * exchanges (QB, 2026-11-12). This script is the evidence that ZERO instrument
 * ids are fabricated:
 *
 *  (a) fetches Hyperliquid metaAndAssetCtxs for BOTH dexes (main + xyz) and
 *      prints whether every MICRO_MAP hl coin actually exists there, plus that
 *      the MICRO_UNMAPPED_NOTES syms (VET/QQQ/ANTHROPIC) are genuinely absent;
 *  (b) probes the BBO venues (Binance bookTicker / OKX USDT-SWAP ticker /
 *      Bybit linear tickers / Coinbase spot ticker) for 5 sample curated syms
 *      (BTC, NVDA, 1000PEPE, GOOGL, CL), printing ok/fail per venue.
 *
 * The map is parsed straight out of src/lib/cg/micro.ts (line-based entry
 * scanner) so the script can never drift from the shipped source.
 *
 * Run: node scripts/verify-micro-map.mjs
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

// ---------------------------------------------------------------------------
// 1) parse MICRO_MAP + MICRO_UNMAPPED_NOTES out of the shipped source
// ---------------------------------------------------------------------------

function parseMicroMap(src) {
  const start = src.indexOf("export const MICRO_MAP");
  if (start < 0) throw new Error("MICRO_MAP not found in micro.ts");
  const end = src.indexOf("\n};", start);
  const block = src.slice(start, end);
  const entries = []; // { key, coin }
  let cur = null;
  const flush = () => {
    if (cur) {
      entries.push(cur);
      cur = null;
    }
  };
  for (const line of block.split("\n")) {
    const open = line.match(/^ {2}"?([A-Za-z0-9]+)"?: \{/);
    if (open) {
      flush(); // a single-line entry has no closer line — the next opener flushes it
      cur = { key: open[1], coin: null };
    } else if (cur && /^ {2}\},?$/.test(line)) {
      flush();
      continue;
    }
    // scan EVERY line of the entry (opener included) for its hl coin
    if (cur) {
      const c = line.match(/coin: "([^"]+)"/);
      if (c && !cur.coin) cur.coin = c[1];
    }
  }
  flush();
  return entries;
}

function parseUnmappedNotes(src) {
  const start = src.indexOf("export const MICRO_UNMAPPED_NOTES");
  if (start < 0) return [];
  const end = src.indexOf("\n};", start);
  return [...src.slice(start, end).matchAll(/^ {2}([A-Za-z0-9]+):/gm)].map((m) => m[1]);
}

const microSrc = readFileSync(path.join(ROOT, "src/lib/cg/micro.ts"), "utf8");
const entries = parseMicroMap(microSrc);
const unmapped = parseUnmappedNotes(microSrc);
const hlEntries = entries.filter((e) => e.coin);
console.log(`parsed MICRO_MAP: ${entries.length} keys, ${hlEntries.length} with an hl coin; unmapped notes: [${unmapped.join(", ")}]\n`);

// ---------------------------------------------------------------------------
// 2) fetch both Hyperliquid dex universes and verify every mapped coin
// ---------------------------------------------------------------------------

async function hlUniverse(body) {
  const res = await fetch("https://api.hyperliquid.xyz/info", {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`HL HTTP ${res.status}`);
  const [meta, ctxs] = await res.json();
  const set = new Set((meta?.universe ?? []).map((u) => u.name));
  const mark = {};
  (meta?.universe ?? []).forEach((u, i) => {
    if (u?.name && ctxs?.[i]?.markPx != null) mark[u.name] = ctxs[i].markPx;
  });
  return { set, mark };
}

const [main, xyz] = await Promise.all([
  hlUniverse({ type: "metaAndAssetCtxs" }), // main dex (no dex param)
  hlUniverse({ type: "metaAndAssetCtxs", dex: "xyz" }), // xyz HIP-3 dex
]);

console.log(`HL main dex universe: ${main.set.size} coins · HL xyz dex universe: ${xyz.set.size} markets\n`);
console.log("(a) MICRO_MAP hl coins vs the live dexes:");
let bad = 0;
for (const e of hlEntries) {
  const dex = e.coin.startsWith("xyz:") ? "xyz" : "main";
  const uni = dex === "xyz" ? xyz : main;
  const exists = uni.set.has(e.coin);
  if (!exists) bad += 1;
  console.log(
    `  ${e.key.padEnd(9)} -> ${e.coin.padEnd(13)} [${dex}]  ${exists ? "EXISTS (mark " + uni.mark[e.coin] + ")" : "!!! MISSING !!!"}`
  );
}
for (const key of unmapped) {
  const inMain = main.set.has(key) || main.set.has("xyz:" + key);
  const inXyz = xyz.set.has(key) || xyz.set.has("xyz:" + key);
  const clean = !inMain && !inXyz;
  if (!clean) bad += 1;
  console.log(
    `  ${key.padEnd(9)} -> (unmapped)          ${clean ? "CORRECTLY ABSENT from both dexes" : "!!! UNEXPECTEDLY PRESENT !!!"}`
  );
}
console.log(bad === 0 ? "  => all mapped coins verified live, all noted absences hold\n" : `  => ${bad} PROBLEM(S)\n`);

// ---------------------------------------------------------------------------
// 3) BBO venue probes for 5 sample curated syms
// ---------------------------------------------------------------------------

const SAMPLES = [
  { sym: "BTC", binance: "BTCUSDT", okx: "BTC-USDT-SWAP", bybit: "BTCUSDT", coinbase: "BTC-USD" },
  { sym: "NVDA", binance: "NVDAUSDT", okx: "NVDA-USDT-SWAP", bybit: "NVDAUSDT", coinbase: null },
  { sym: "1000PEPE", binance: "1000PEPEUSDT", okx: "1000PEPE-USDT-SWAP", bybit: "1000PEPEUSDT", coinbase: null },
  { sym: "GOOGL", binance: "GOOGLUSDT", okx: "GOOGL-USDT-SWAP", bybit: "GOOGLUSDT", coinbase: null },
  { sym: "CL", binance: "CLUSDT", okx: "CL-USDT-SWAP", bybit: "CLUSDT", coinbase: null },
];

async function probeBinance(pair) {
  const r = await fetch(`https://fapi.binance.com/fapi/v1/ticker/bookTicker?symbol=${pair}`, {
    headers: { "User-Agent": UA, accept: "application/json" },
    signal: AbortSignal.timeout(10000),
  });
  const j = await r.json();
  if (r.status !== 200 || !j.bidPrice) return { ok: false, why: `HTTP ${r.status} ${j.msg ?? ""}`.trim() };
  return { ok: true, bid: j.bidPrice, ask: j.askPrice };
}
async function probeOkx(instId) {
  const r = await fetch(`https://www.okx.com/api/v5/market/ticker?instId=${encodeURIComponent(instId)}`, {
    headers: { "User-Agent": UA, accept: "application/json" },
    signal: AbortSignal.timeout(10000),
  });
  const j = await r.json();
  if (j.code !== "0" || !j.data?.length) return { ok: false, why: `code ${j.code}: ${j.msg ?? "no data"}` };
  return { ok: true, bid: j.data[0].bidPx, ask: j.data[0].askPx };
}
async function probeBybit(symbol) {
  const r = await fetch(`https://api.bybit.com/v5/market/tickers?category=linear&symbol=${encodeURIComponent(symbol)}`, {
    headers: { "User-Agent": UA, accept: "application/json" },
    signal: AbortSignal.timeout(10000),
  });
  const j = await r.json();
  if (j.retCode !== 0 || !j.result?.list?.length) return { ok: false, why: `${j.retCode}: ${j.retMsg ?? "no data"}` };
  return { ok: true, bid: j.result.list[0].bid1Price, ask: j.result.list[0].ask1Price };
}
async function probeCoinbase(product) {
  if (!product) return { ok: false, why: "n/a (majors only)" };
  const r = await fetch(`https://api.exchange.coinbase.com/products/${product}/ticker`, {
    headers: { "User-Agent": UA, accept: "application/json" },
    signal: AbortSignal.timeout(10000),
  });
  const j = await r.json();
  if (r.status !== 200 || !j.bid) return { ok: false, why: `HTTP ${r.status} ${j.message ?? ""}`.trim() };
  return { ok: true, bid: j.bid, ask: j.ask };
}

console.log("(b) BBO venue probes for 5 sample curated syms (ok/fail per venue):");
for (const s of SAMPLES) {
  const [b, o, y, c] = await Promise.all([
    probeBinance(s.binance).catch((e) => ({ ok: false, why: String(e.message ?? e) })),
    probeOkx(s.okx).catch((e) => ({ ok: false, why: String(e.message ?? e) })),
    probeBybit(s.bybit).catch((e) => ({ ok: false, why: String(e.message ?? e) })),
    probeCoinbase(s.coinbase).catch((e) => ({ ok: false, why: String(e.message ?? e) })),
  ]);
  const fmt = (r) => (r.ok ? `ok ${r.bid}/${r.ask}` : `FAIL (${r.why})`);
  console.log(`  ${s.sym.padEnd(9)} binance ${fmt(b).padEnd(26)} okx ${fmt(o).padEnd(46)} bybit ${fmt(y).padEnd(26)} coinbase ${fmt(c)}`);
}
console.log("\nDone. 1000PEPE okx FAIL is EXPECTED: OKX lists spot-scale PEPE-USDT-SWAP (1/1000 of the");
console.log("terminal quote scale) — the route serves it as {ok:false, reason, note} instead of a mixed-scale quote.");
