#!/usr/bin/env node
/**
 * CURATED-61 COVERAGE MATRIX PROBE (resumable).
 *
 * Probes the running terminal (127.0.0.1:3000) for every curated asset x
 * every applicable tab endpoint, appends one JSON line per (asset,endpoint)
 * to download/coverage_matrix_raw.jsonl, and rebuilds
 * download/coverage_matrix_build.json. Skips pairs already recorded OK, so
 * it can resume across server restarts.
 *
 * Usage: node scripts/probe_curated_matrix.mjs [--full]
 *   --full  re-probe everything (ignore previous OK results)
 */
import { readFileSync, writeFileSync, existsSync, appendFileSync } from "node:fs";

const BASE = "http://127.0.0.1:3000";
const RAW = "/home/z/my-project/download/coverage_matrix_raw.jsonl";
const OUT = "/home/z/my-project/download/coverage_matrix_build.json";

const CRYPTO = ["BTC","ETH","BNB","SOL","XRP","ADA","DOGE","TRX","LINK","LTC","AVAX","DOT","NEAR","UNI","ATOM","XLM","ETC","FIL","ICP","HBAR","APT","ARB","OP","SUI","SEI","INJ","TIA","VET","1000PEPE","1000SHIB"];
const TRADFI = ["XAU","NVDA","SNDK","SOXL","SPCX","GOOGL","MU","SKHY","XAG","CL","INTC","CRCL","MSTR","QQQ","ANTHROPIC","AAPL","TSLA","DRAM","KORU","META","NBIS","MSFT","AMZN","AMD","COIN","NFLX","AVGO","TSM"];
const CLASSIC = ["SPX500","UKO","NDX100"];

const PERP_ENDPOINTS = [
  { id: "market",    url: (s) => `/api/binance/market?sym=${s}`,                 ok: (d) => d?.ok !== false && d?.ticker?.last != null },
  { id: "klines",    url: (s) => `/api/binance/klines?sym=${s}&interval=15m&limit=50`, ok: (d) => Array.isArray(d?.rows) && d.rows.length > 0 },
  { id: "live",      url: (s) => `/api/cg/live?sym=${s}`,                        ok: (d) => d?.ok !== false && d?.price != null },
  { id: "livebook",  url: (s) => `/api/cg/livebook?sym=${s}`,                    ok: (d) => d?.ok === true && d?.model != null },
  { id: "fp",        url: (s) => `/api/cg/fp?sym=${s}&itv=m15&limit=50`,         ok: (d) => (d?.bars?.length ?? 0) > 0 },
  { id: "lto",       url: (s) => `/api/cg/lto?symbol=${s}&minVolUsd=1000000`,    ok: (d) => d?.ok !== false && ((d?.support?.futures?.length ?? 0) > 0 || (d?.support?.spot?.length ?? 0) > 0) },
  { id: "liqlevels", url: (s) => `/api/cg/liqlevels?sym=${s}&range=7d`,          ok: (d) => d?.ok !== false && ((d?.levels?.length ?? 0) > 0 || (d?.rows?.length ?? 0) > 0 || (d?.venues?.length ?? 0) > 0) },
  { id: "bookwalls", url: (s) => `/api/cg/bookwalls?sym=${s}&market=futures`,    ok: (d) => d?.ok !== false && ((d?.walls?.length ?? 0) > 0 || (d?.venues?.length ?? 0) > 0) },
  { id: "cvd",       url: (s) => `/api/cg/cvd?sym=${s}&itv=m15&limit=300`,       ok: (d) => d?.ok !== false && ((d?.series?.length ?? d?.bars?.length ?? 0) > 0 || (d?.instruments?.length ?? 0) > 0) },
];
const CLASSIC_ENDPOINTS = [
  { id: "classic", url: (s) => `/api/cg/classic?sym=${s}&interval=1d&range=1mo`, ok: (d) => d?.ok !== false && ((d?.bars?.length ?? 0) > 0 || (d?.points?.length ?? 0) > 0) },
];

const args = process.argv.slice(2);
const FULL = args.includes("--full");

const done = new Map(); // "sym|ep" -> {ok:boolean,...}
if (existsSync(RAW) && !FULL) {
  for (const line of readFileSync(RAW, "utf8").split("\n")) {
    if (!line.trim()) continue;
    try {
      const r = JSON.parse(line);
      if (r.ok) done.set(`${r.sym}|${r.ep}`, r); // only skip previous SUCCESSES
    } catch {}
  }
}

async function probeOnce(sym, ep) {
  const t0 = Date.now();
  try {
    const res = await fetch(BASE + ep.url(sym), { signal: AbortSignal.timeout(45_000) });
    const code = res.status;
    let body = null;
    try { body = await res.json(); } catch {}
    const dataOk = code === 200 && ep.ok(body);
    return { sym, ep: ep.id, ok: dataOk, code, ms: Date.now() - t0,
            note: dataOk ? undefined : JSON.stringify(body).slice(0, 140),
            ban: dataOk ? false : (code === 502 && /ban/i.test(JSON.stringify(body))) };
  } catch (e) {
    return { sym, ep: ep.id, ok: false, code: 0, ms: Date.now() - t0, note: String(e).slice(0, 120), ban: false };
  }
}

async function probe(sym, ep) {
  const key = `${sym}|${ep.id}`;
  if (done.has(key)) return done.get(key);
  let rec = await probeOnce(sym, ep);
  // shared-egress flappy ban windows: back off 65s and retry (max 2 retries)
  for (let r = 0; r < 2 && rec.ban; r++) {
    await sleep(65_000);
    rec = await probeOnce(sym, ep);
  }
  appendFileSync(RAW, JSON.stringify(rec) + "\n");
  return rec;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function runQueue(jobs, conc) {
  const results = [];
  let i = 0;
  const workers = Array.from({ length: conc }, async () => {
    while (i < jobs.length) {
      const j = jobs[i++];
      results.push(await j());
      await sleep(150);
    }
  });
  await Promise.all(workers);
  return results;
}

// livebook opens a weight-20 depth ring PER SYMBOL (2.5s poll) — probing all
// 58 at once = ~28k weight/min vs Binance's 2400/min budget (that is what
// tripped the IP ban on the first run). The code path is symbol-agnostic, so
// an 8-symbol representative sample (both kinds, thin and thick books)
// verifies it; the rest are verified by code-path identity.
const LIVEBOOK_SAMPLE = new Set(["BTC", "VET", "1000PEPE", "XAU", "NVDA", "CL", "ANTHROPIC", "SOXL"]);

// Stage 1 (cheap Binance-native), Stage 2 (single-venue fp), Stage 3 (heavy CG)
const perps = [...CRYPTO, ...TRADFI];
const stage1 = [], stage2 = [], stage3 = [];
for (const s of perps) {
  for (const ep of PERP_ENDPOINTS) {
    if (ep.id === "livebook" && !LIVEBOOK_SAMPLE.has(s)) continue;
    const j = () => probe(s, ep);
    if (["market", "klines", "live"].includes(ep.id)) stage1.push(j);
    else if (ep.id === "fp" || ep.id === "livebook") stage2.push(j);
    else stage3.push(j);
  }
}
const stageC = CLASSIC.map((s) => () => probe(s, CLASSIC_ENDPOINTS[0]));

console.log(`jobs: stage1=${stage1.length} stage2=${stage2.length} stage3=${stage3.length} classic=${stageC.length} (already-ok skipped: ${done.size})`);
const t0 = Date.now();
await runQueue(stage1, 3);
console.log(`stage1 done @${((Date.now()-t0)/1000).toFixed(0)}s`);
await runQueue(stage2, 3);
console.log(`stage2 done @${((Date.now()-t0)/1000).toFixed(0)}s`);
await runQueue(stageC, 2);
console.log(`classic done @${((Date.now()-t0)/1000).toFixed(0)}s`);
await runQueue(stage3, 3);
console.log(`stage3 done @${((Date.now()-t0)/1000).toFixed(0)}s`);

// ── rebuild matrix ─────────────────────────────────────────────────────
const all = {};
for (const line of readFileSync(RAW, "utf8").split("\n")) {
  if (!line.trim()) continue;
  try { const r = JSON.parse(line); all[`${r.sym}|${r.ep}`] = r; } catch {}
}
const matrix = {};
const summary = { perps: {}, classic: {}, failures: [] };
for (const s of perps) {
  matrix[s] = {};
  let okCount = 0;
  for (const ep of PERP_ENDPOINTS) {
    if (ep.id === "livebook" && !LIVEBOOK_SAMPLE.has(s)) continue; // sampled by design
    const r = all[`${s}|${ep.id}`];
    matrix[s][ep.id] = r ? { ok: r.ok, code: r.code, ms: r.ms } : { ok: null };
    if (r?.ok) okCount++;
    else if (r) summary.failures.push(`${s}/${ep.id} code=${r.code} ${r.note ?? ""}`.trim());
    else summary.failures.push(`${s}/${ep.id} NOT_PROBED`);
  }
  summary.perps[s] = `${okCount}/${LIVEBOOK_SAMPLE.has(s) ? 9 : 8}`;
}
for (const s of CLASSIC) {
  matrix[s] = {};
  const r = all[`${s}|classic`];
  matrix[s].classic = r ? { ok: r.ok, code: r.code } : { ok: null };
  summary.classic[s] = r?.ok ? "ok" : "FAIL";
  if (!r?.ok) summary.failures.push(`${s}/classic ${r?.code ?? "NOT_PROBED"}`);
}
writeFileSync(OUT, JSON.stringify({ generatedAt: new Date().toISOString(), summary, matrix }, null, 2));

const full = Object.entries(summary.perps).filter(([s, v]) => v === (LIVEBOOK_SAMPLE.has(s) ? "9/9" : "8/8")).length;
console.log(`\n=== MATRIX: ${full}/58 perps fully covered ===`);
const partial = Object.entries(summary.perps).filter(([s, v]) => v !== (LIVEBOOK_SAMPLE.has(s) ? "9/9" : "8/8"));
if (partial.length) console.log("partial:", partial.map(([k, v]) => `${k}:${v}`).join(" "));
console.log("classic:", JSON.stringify(summary.classic));
console.log(`failures: ${summary.failures.length}`);
console.log(`saved -> ${OUT}`);
