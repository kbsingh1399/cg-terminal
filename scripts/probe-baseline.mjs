#!/usr/bin/env node
/**
 * PROBE — current terminal baseline through the RUNNING dev server
 * (http://127.0.0.1:3000): status + one-line data summary per endpoint.
 *
 * Usage: node scripts/probe-baseline.mjs
 * Writes /tmp/baseline.json, prints compact report.
 */
import { writeFileSync } from "fs";

const BASE = "http://127.0.0.1:3000";
const out = {};

async function hit(id, path, summarize) {
  const t0 = Date.now();
  try {
    const res = await fetch(BASE + path, { signal: AbortSignal.timeout(90_000) });
    const text = await res.text();
    let body = null;
    try { body = JSON.parse(text); } catch {}
    const line = summarize ? summarize(res.status, body, text) : `${res.status} ${text.slice(0, 140)}`;
    const ms = Date.now() - t0;
    out[id] = { status: res.status, ms, summary: line, body: body ?? text.slice(0, 400) };
    console.log(`[${String(res.status).padStart(3)}] ${id} (${ms}ms) → ${line}`);
  } catch (e) {
    out[id] = { status: -1, error: e.message };
    console.log(`[ERR] ${id} → ${e.message}`);
  }
  return out[id];
}

console.log(`== baseline probes vs ${BASE} ==`);

// universe shape
await hit("universe", "/api/binance/universe", (st, b) => {
  if (!b?.ok) return `not ok: ${JSON.stringify(b).slice(0, 120)}`;
  const assets = b.assets ?? [];
  const inTop = (sym) => assets.find((a) => a.sym === sym);
  const plain = ["NVDA","SNDK","SOXL","SPCX","MU","INTC","CRCL","SKHY","MSTR","KORU","GOOGL","NBIS","TSLA","META","AAPL","DRAM","MSFT","AMZN","AMD","COIN","NFLX","AVGO","TSM","ANTHROPIC","XAU","XAG","CL","TON","BTC","ETH"];
  const members = plain.filter((s) => inTop(s));
  return `ok n=${assets.length} (top=${b.top ?? "?"}, refreshed ${b.fetchedAt ? new Date(b.fetchedAt).toISOString() : "?"}, err=${b.err ?? "none"}) — members among probe syms: ${members.join(",") || "none"}; BTC rank=${inTop("BTC")?.rank}, NVDA rank=${inTop("NVDA")?.rank ?? "-"}, SOXL rank=${inTop("SOXL")?.rank ?? "-"}, XAU rank=${inTop("XAU")?.rank ?? "-"}`;
});

// BTC member probes
await hit("cg.fp.BTC", "/api/cg/fp?sym=BTC&itv=m15&limit=50", (st, b) =>
  b?.ok ? `ok bars=${b.bars?.length} venues=${(b.venues ?? []).join(",")} missing=${(b.missing ?? []).join(",") || "-"}` : `${st} ${JSON.stringify(b).slice(0, 140)}`);
await hit("cg.liqlevels.BTC", "/api/cg/liqlevels?sym=BTC&range=7d", (st, b) =>
  b?.ok ? `ok range=${b.range} perVenue=${JSON.stringify(b.perVenue)} stats.keys=${b.stats ? Object.keys(b.stats).slice(0, 8).join(",") : "-"}` : `${st} ${JSON.stringify(b).slice(0, 140)}`);
await hit("cg.bookwalls.BTC", "/api/cg/bookwalls?sym=BTC&market=futures", (st, b) => {
  if (!b?.ok) return `${st} ${JSON.stringify(b).slice(0, 140)}`;
  const m = b.model ?? {};
  return `ok venues=${(b.venues ?? []).join(",")} walls=${m.walls?.length ?? m.confirmed?.length ?? "?"} covered=${b.covered ? `${b.covered.loPct}%..${b.covered.hiPct}%` : "?"}`;
});
await hit("cg.cvd.BTC", "/api/cg/cvd?sym=BTC&itv=m15&limit=200", (st, b) =>
  b?.ok ? `ok n=${b.n} instruments=${(b.instruments ?? []).map((i) => `${i.venue}:${i.kind}`).join(",")} priceKey=${b.priceKey}` : `${st} ${JSON.stringify(b).slice(0, 140)}`);
await hit("cg.lto.BTC", "/api/cg/lto?symbol=BTC&minVolUsd=1000000", (st, b) =>
  b?.ok ? `ok exchanges=${JSON.stringify(Object.fromEntries(Object.entries(b.perExchange ?? {}).map(([k, v]) => [k, v.openOrders])))} groups=${b.groups?.length}` : `${st} ${JSON.stringify(b).slice(0, 140)}`);
await hit("cg.livebook.BTC", "/api/cg/livebook?sym=BTC", (st, b) => {
  if (!b?.ok) return `${st} ${JSON.stringify(b).slice(0, 140)}`;
  const m = b.model ?? {};
  return `ok grid=${b.grid} band=${b.band} covered=${b.covered?.loPct}%..${b.covered?.hiPct}% walls=${m.walls?.length ?? m.confirmed?.length ?? "?"} minWallUsd=${b.minWallUsd}`;
});

// B-token / gate probes
await hit("cg.fp.NVDAB", "/api/cg/fp?sym=NVDAB&itv=m15&limit=50", (st, b) => `${st} ${JSON.stringify(b).slice(0, 140)}`);
await hit("binance.market.NVDAB", "/api/binance/market?sym=NVDAB", (st, b) => `${st} ${JSON.stringify(b).slice(0, 140)}`);
await hit("cg.livebook.ETH", "/api/cg/livebook?sym=ETH", (st, b) => {
  if (!b?.ok) return `${st} ${JSON.stringify(b).slice(0, 140)}`;
  return `ok (isAsset gate passes for ETH) grid=${b.grid} covered=${b.covered?.loPct}%..${b.covered?.hiPct}%`;
});

// plain-name spot check through current gates (are NVDA/SOXL already Tier-2?)
await hit("cg.fp.NVDA", "/api/cg/fp?sym=NVDA&itv=m15&limit=50", (st, b) =>
  b?.ok ? `ok bars=${b.bars?.length} venues=${(b.venues ?? []).join(",")} missing=${(b.missing ?? []).join(",") || "-"}` : `${st} ${JSON.stringify(b).slice(0, 140)}`);

// classic
await hit("cg.classic.SP500", "/api/cg/classic?sym=SP500&interval=1d&range=1mo", (st, b) =>
  b?.ok ? `ok price=${b.price} nBars=${b.nBars} source=${b.source} live=${b.live?.ok ? b.live.price : "none"}` : `${st} ${JSON.stringify(b).slice(0, 140)}`);
await hit("cg.classic.NDX100", "/api/cg/classic?sym=NDX100&interval=1d&range=1mo", (st, b) =>
  b?.ok ? `ok price=${b.price} nBars=${b.nBars} source=${b.source}` : `${st} ${JSON.stringify(b).slice(0, 140)}`);
await hit("cg.classic.BRENTOIL", "/api/cg/classic?sym=BRENTOIL&interval=1d&range=1mo", (st, b) =>
  b?.ok ? `ok price=${b.price} nBars=${b.nBars} source=${b.source}` : `${st} ${JSON.stringify(b).slice(0, 140)}`);

writeFileSync("/tmp/baseline.json", JSON.stringify(out, null, 2));
console.log("\nwrote /tmp/baseline.json");
