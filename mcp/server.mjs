#!/usr/bin/env node
/**
 * CG Terminal — MCP server for Antigravity (or any MCP client).
 * ---------------------------------------------------------------------------
 * Zero-dependency Model Context Protocol server (JSON-RPC 2.0 over stdio)
 * that plugs the local order-flow terminal directly into the agent:
 *
 *   - market_snapshot   auction VAL/POC/VAH · EMA 13/89/233 · RSI · VWAP bands
 *   - signals           Coinglass-exact footprint signals (3 bar types)
 *   - notifications     the live event feed (cursor-based polling)
 *   - liquidation_levels, whale_orders, book_walls, cvd_state
 *   - stopmap           BTC liquidation-heatmap window (24h, endTime history)
 *   - footprint         aggregated order-flow bars (per-bar delta + POC)
 *   - large_orders       large resting orders AND executed large trades
 *   - kline_series       raw candles / open-interest series per instrument
 *   - analyze_setup     one-call context bundle for trade formulation
 *
 * Every tool exposes the full dimension set of its HTTP route (asset,
 * timeframe, market, band, history endTime) so the agent has access to each
 * data point at each dimension — see the access matrix in the Trade
 * Formulation Playbook.
 *
 * Configure in Antigravity (Settings → MCP → add server):
 *   command: node  /ABSOLUTE/PATH/TO/mcp/server.mjs
 *   env:     TERMINAL_URL=http://localhost:3000
 *
 * The agent wake-up loop (see AGENTS.md):
 *   1. call `notifications` with the stored cursor id
 *   2. for every new HIGH-severity event call `analyze_setup`
 *   3. formulate the entry, stop and targets from the returned data
 */

import readline from "node:readline";
import { readFileSync as fsRead, writeFileSync as fsWrite, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const TERMINAL_URL = (process.env.TERMINAL_URL || "http://localhost:3000").replace(/\/+$/, "");
const CURSOR_FILE = new URL("../data/mcp-cursor.json", import.meta.url);

async function api(path) {
  const res = await fetch(`${TERMINAL_URL}${path}`, { signal: AbortSignal.timeout(120_000) });
  const json = await res.json().catch(() => ({ ok: false, error: `HTTP ${res.status}` }));
  return json;
}

function readCursor() {
  try {
    return JSON.parse(fsRead(fileURLToPath(CURSOR_FILE))).lastId ?? 0;
  } catch {
    return 0;
  }
}
function writeCursor(id) {
  try {
    fsWrite(fileURLToPath(CURSOR_FILE), JSON.stringify({ lastId: id, updatedAt: Date.now() }, null, 2));
  } catch {
    /* non-fatal */
  }
}
function ensureDataDir() {
  try {
    mkdirSync(path.dirname(fileURLToPath(CURSOR_FILE)), { recursive: true });
  } catch {}
}

const fmtP = (v, d = 2) => (v == null || !Number.isFinite(v) ? null : +Number(v).toFixed(d));
const fmtUsd = (v) =>
  v == null || !Number.isFinite(v)
    ? "—"
    : Math.abs(v) >= 1e9
      ? `$${(v / 1e9).toFixed(2)}B`
      : Math.abs(v) >= 1e6
        ? `$${(v / 1e6).toFixed(1)}M`
        : `$${Math.round(v / 1e3)}K`;
const fmtM = (v) => (v == null || !Number.isFinite(v) ? "—" : `$${(v / 1e6).toFixed(1)}M`);
const tsOf = (t) => new Date(t > 1e12 ? t : t * 1000).toISOString().slice(5, 16).replace("T", " ");

// ---- interval vocabularies (keep in lockstep with the routes) ----
// The routes do NOT share one interval vocabulary — verified per route:
//   · orderflow-agg / largeorder / kline validate via src/lib/cg/params.ts
//     parseInterval → m-tokens ONLY: m1 m3 m5 m15 m30 h1 h2 h4 h6 h12 d1 w1
//   · bookwalls accepts page tokens 1m 5m 15m 1h 4h 1d (+ m-token aliases
//     via its NORMALIZE map)
//   · cvd accepts page tokens 1m 5m 15m 30m 1h 4h 1d (+ m-token aliases)
// Historical bug: every MCP tool defaulted to "15m", so the parseInterval
// routes 400'd on each default call ("invalid interval"). Each tool now
// validates against its route's NATIVE vocabulary and accepts the other
// style as an alias — an agent passing "15m" or "m15" always gets the
// duration it asked for, never a silent fallback to the default.
const M_INTERVALS = ["m1", "m3", "m5", "m15", "m30", "h1", "h2", "h4", "h6", "h12", "d1", "w1"];
const PAGE_TO_M = { "1m": "m1", "3m": "m3", "5m": "m5", "15m": "m15", "30m": "m30", "1h": "h1", "2h": "h2", "4h": "h4", "6h": "h6", "12h": "h12", "1d": "d1", "1w": "w1" };
const M_TO_PAGE = { m1: "1m", m5: "5m", m15: "15m", m30: "30m", h1: "1h", h4: "4h", d1: "1d" };
const BOOKWALLS_ITV = ["1m", "5m", "15m", "1h", "4h", "1d"];
const CVD_ITV = ["1m", "5m", "15m", "30m", "1h", "4h", "1d"];
function resolveInterval(v, native, alias, fallback) {
  const s = typeof v === "string" ? v.trim() : "";
  if (native.includes(s)) return s;
  const a = alias[s];
  return a != null && native.includes(a) ? a : fallback;
}

// ---------------------------------------------------------------------------
// Tool implementations — each returns MCP content (text + structured)
// ---------------------------------------------------------------------------

async function toolListAssets() {
  const d = await api("/api/cg/assets");
  // honest failure (adversarial review finding 2): a non-ok route body must
  // surface as an MCP error — `d.assets ?? []` on a 500 would report
  // "0 tradable assets" as SUCCESS, a fabricated answer to the agent.
  if (!d || d.ok === false || !Array.isArray(d.assets)) {
    throw new Error(`assets route unhealthy: ${JSON.stringify(d).slice(0, 200)}`);
  }
  // FULL CURATED-61 (2026-11-12 directive): 58 curated perps (30 crypto +
  // 28 TradFi) + 3 classic (SPX500/UKO/NDX100) — membership live from the
  // route (source of truth: src/lib/universe/curated.ts), never hardcoded.
  const curated = Array.isArray(d.curated) ? d.curated : [];
  const classic = Array.isArray(d.curatedClassic) ? d.curatedClassic : [];
  if (!curated.length) {
    throw new Error("assets route returned no curated list — universe unavailable");
  }
  const crypto = curated.filter((a) => a.kind === "crypto-perp");
  const tradfi = curated.filter((a) => a.kind === "tradfi-perp");
  const lines = [
    `${curated.length + classic.length} assets: ${crypto.length} crypto perps + ${tradfi.length} TradFi perps + ${classic.length} classic — live from the terminal:`,
    "",
    "-- CRYPTO PERPS --",
    ...crypto.map((a) => `${a.sym.padEnd(10)} ${a.name} [${a.sub}]${a.punchable ? "" : " (live-only, no testnet)"}`),
    "-- TRADFI PERPS (Binance plain-name USDT-M) --",
    ...tradfi.map((a) => `${a.sym.padEnd(10)} ${a.name} [${a.sub}]${a.spotPair ? ` · spot ${a.spotPair}` : ""}${a.punchable ? "" : " (live-only)"}`),
    "-- CLASSIC (no perp engine — quotes + bars) --",
    ...classic.map((a) => `${a.sym.padEnd(10)} ${a.name} [${a.sub}]`),
  ];
  return { text: lines.join("\n"), data: { curatedTotal: d.curatedTotal ?? curated.length, classicTotal: classic.length, total: curated.length + classic.length, curated, curatedClassic: classic } };
}

async function toolMarketSnapshot(args) {
  const sym = (args?.sym ?? "BTC").toUpperCase();
  const d = await api(`/api/cg/market?sym=${sym}`);
  if (!d.ok) throw new Error(d.error || "market snapshot failed");
  const a = d.auction;
  const lines = [
    `${d.sym} (${d.name}) — last ${d.price.last} · day ${fmtP(d.price.chgDayPct)}% · H ${d.price.dayHigh} / L ${d.price.dayLow} (UTC day)`,
    `Auction session(8h): VAL ${fmtP(a.session.val)} · POC ${fmtP(a.session.poc)} · VAH ${fmtP(a.session.vah)}`,
    `Auction day (UTC):   VAL ${fmtP(a.day.val)} · POC ${fmtP(a.day.poc)} · VAH ${fmtP(a.day.vah)}`,
    `Auction month (UTC): VAL ${fmtP(a.month.val)} · POC ${fmtP(a.month.poc)} · VAH ${fmtP(a.month.vah)}`,
    `VWAP (day): ${fmtP(d.vwap.vwap)} · +1σ ${fmtP(d.vwap.vwap + d.vwap.bands.sd1)} · +2σ ${fmtP(d.vwap.vwap + d.vwap.bands.sd2)} · +3σ ${fmtP(d.vwap.vwap + d.vwap.bands.sd3)} · −1σ ${fmtP(d.vwap.vwap - d.vwap.bands.sd1)} · −2σ ${fmtP(d.vwap.vwap - d.vwap.bands.sd2)} · −3σ ${fmtP(d.vwap.vwap - d.vwap.bands.sd3)}`,
  ];
  for (const tf of ["m15", "h1", "h4", "d1"]) {
    lines.push(
      `${tf}: EMA13 ${fmtP(d.ema[tf].e13)} · EMA89 ${fmtP(d.ema[tf].e89)} · EMA233 ${fmtP(d.ema[tf].e233)} · 13>89 ${d.ema[tf].e13 > d.ema[tf].e89 ? "BULL" : "BEAR"} · RSI ${fmtP(d.rsi[tf], 1)}`
    );
  }
  return { text: lines.join("\n"), data: d };
}

async function toolSignals(args) {
  const sym = (args?.sym ?? "BTC").toUpperCase();
  const bt = args?.bt ?? "all";
  const d = await api(`/api/cg/signals?sym=${sym}&bt=${bt}`);
  if (!d.ok) throw new Error(d.error || "signals failed");
  const lines = [`${sym} footprint signals — ${d.counts.all} total (${d.counts.bullish} bullish / ${d.counts.bearish} bearish) · thresholds: volume ${d.thresholds.vol} ${sym}, range ${d.thresholds.range}`];
  for (const set of d.sets) {
    lines.push(`\n[${set.label}] ${set.sigs.length} signals`);
    for (const s of set.sigs.slice(-12).reverse()) {
      lines.push(
        `  ${new Date(s.ts * 1000).toISOString().slice(5, 16).replace("T", " ")} ${s.side === "buy" ? "BULL" : "BEAR"} ${s.name ?? s.t} @ ${s.p}${s.main ? " — " + s.main : ""}`
      );
    }
  }
  return { text: lines.join("\n"), data: { sym: d.sym, counts: d.counts, sets: d.sets.map((x) => ({ bt: x.bt, label: x.label, sigs: x.sigs.slice(-30) })) } };
}

async function toolNotifications(args) {
  ensureDataDir();
  const since = args?.since != null ? Number(args.since) : readCursor();
  const limit = Math.min(Math.max(Number(args?.limit ?? 50), 1), 200);
  const p = new URLSearchParams({ since: String(since), limit: String(limit) });
  if (args?.asset) p.set("asset", String(args.asset).toUpperCase());
  if (args?.source) p.set("source", args.source);
  const d = await api(`/api/cg/notifications?${p.toString()}`);
  if (!d.ok) throw new Error(d.error || "notifications failed");
  const lines = d.items.map(
    (n) =>
      `#${n.id} ${new Date(n.ts).toISOString().slice(5, 16).replace("T", " ")} [${n.severity === "high" ? "HIGH" : "info"}] ${n.asset} ${n.dir.toUpperCase()} ${n.source}: ${n.title} — ${n.detail}`
  );
  if (d.items.length) {
    const lastId = Math.max(...d.items.map((n) => n.id));
    if (args?.advance_cursor !== false) writeCursor(lastId);
  }
  return {
    text: (lines.length ? lines.join("\n") : "no new notifications since cursor") + `\n(cursor now ${readCursor()}, ${d.stats.last24h} events/24h)`,
    data: { items: d.items, stats: d.stats, cursor: readCursor() },
  };
}

async function toolLivePrice(args) {
  const sym = (args?.sym ?? "BTC").toUpperCase();
  const d = await api(`/api/cg/ticker?sym=${sym}`);
  if (!d.ok || d.price == null) throw new Error(d.error || "ticker failed");
  const dir = d.dir === "up" ? "▲" : d.dir === "down" ? "▼" : "=";
  const age = d.ageMs != null ? ` · upstream age ${Math.round(d.ageMs)}ms` : "";
  return {
    text: `${sym} ${d.price} ${dir}${age} — 1s-grade feed (forming m1 close via Coinglass)`,
    data: d,
  };
}

async function toolLiquidationLevels(args) {
  const sym = (args?.sym ?? "BTC").toUpperCase();
  const range = ["3d", "7d", "30d"].includes(args?.range) ? args.range : "3d";
  const d = await api(`/api/cg/liqlevels?sym=${sym}&range=${range}&lvR=4`);
  if (!d.ok) throw new Error(d.error || "liquidation levels failed");
  const s = d.stats;
  const lines = [
    `${sym} liquidation clusters (${range}, ±4%, ${d.venues.join("+")}) — price ${s.last}`,
    `est. open liq: shorts(above) ${fmtP(s.totals.shorts, 0)} · longs(below) ${fmtP(s.totals.longs, 0)}`,
    `strongest above: ${s.keyLevels.above.map((l) => `${fmtP(l.price)} (+${fmtP(l.distPct)}%, str ${fmtP(l.strength, 0)}, ${l.lev} lev)`).join(" | ")}`,
    `strongest below: ${s.keyLevels.below.map((l) => `${fmtP(l.price)} (−${fmtP(l.distPct)}%, str ${fmtP(l.strength, 0)}, ${l.lev} lev)`).join(" | ")}`,
  ];
  return { text: lines.join("\n"), data: d };
}

async function toolLiqLive(args) {
  const sym = (args?.sym ?? "").toUpperCase();
  const limit = Math.max(1, Math.min(60, Number(args?.limit ?? 15) || 15));
  const url = sym
    ? `/api/cg/liq-live?sym=${encodeURIComponent(sym)}&limit=${limit}`
    : `/api/cg/liq-live?globalLimit=${limit}`;
  const d = await api(url);
  if (!d.ok) throw new Error(d.error || "live liquidations failed");
  const venues = (d.venues ?? []).map((v) => `${v.venue}:${v.status}(${v.events}ev)`).join(" ");
  const lines = [
    `LIVE liquidations — collector ${d.stale ? "STALE" : d.quiet ? "quiet (healthy, no events)" : "live"} · venues ${venues}`,
    `source: ${d.source}`,
  ];
  if (d.asset) {
    const a = d.asset;
    if (!a.supported) {
      lines.push(`${a.sym}: ${a.reason ?? "no perp venue carries this instrument"}`);
    } else {
      lines.push(
        `${a.sym} 1h: ${a.stats1h.count} prints $${(a.stats1h.usd / 1000).toFixed(1)}K (${a.stats1h.longs}L/${a.stats1h.shorts}S) · 24h: ${a.stats24h.count} prints $${(a.stats24h.usd / 1000).toFixed(1)}K (${a.stats24h.longs}L/${a.stats24h.shorts}S)`
      );
      for (const e of a.events.slice(0, limit)) {
        lines.push(
          `  ${new Date(e.t).toISOString().slice(11, 19)} ${e.venue.toUpperCase()} ${e.side === "long" ? "LONG-LIQ" : "SHORT-LIQ"} ${e.qtyBase ?? "?"} @ ${e.price} ($${e.usd != null ? e.usd.toFixed(0) : "?"})`
        );
      }
      if (!a.events.length) lines.push(`  no prints in the stored 24h window${a.stats24h.lastAt ? ` (last ${Math.round((Date.now() - a.stats24h.lastAt) / 60000)}m ago)` : ""}`);
    }
  }
  if (d.global) {
    const g = d.global;
    lines.push(
      `universe 1h: ${g.universe1h.count} prints $${(g.universe1h.usd / 1000).toFixed(1)}K · 24h: ${g.universe24h.count} prints $${(g.universe24h.usd / 1000).toFixed(1)}K`
    );
    const hot = g.assets.filter((x) => x.count24h > 0).slice(0, 10);
    if (hot.length) lines.push(`hot (24h): ${hot.map((x) => `${x.sym} ${x.count24h}/$${(x.usd24h / 1000).toFixed(0)}K`).join(" · ")}`);
    for (const e of g.tape.slice(0, limit)) {
      lines.push(
        `  ${new Date(e.t).toISOString().slice(11, 19)} ${e.asset} ${e.venue.toUpperCase()} ${e.side === "long" ? "LONG-LIQ" : "SHORT-LIQ"} ${e.qtyBase ?? "?"} @ ${e.price} ($${e.usd != null ? e.usd.toFixed(0) : "?"})`
      );
    }
  }
  return { text: lines.join("\n"), data: d };
}

async function toolWhaleOrders(args) {
  const sym = (args?.sym ?? "BTC").toUpperCase();
  const minUsd = Math.max(0, Number(args?.minUsd ?? 1_000_000));
  const d = await api(`/api/cg/lto?symbol=${sym}&minVolUsd=${minUsd}`);
  if (!d.ok) throw new Error(d.error || "whale orders failed");
  const fmtUsd = (v) => (Math.abs(v) >= 1e9 ? `$${(v / 1e9).toFixed(2)}B` : Math.abs(v) >= 1e6 ? `$${(v / 1e6).toFixed(1)}M` : `$${(v / 1e3).toFixed(0)}K`);
  let bid = 0;
  let ask = 0;
  const rows = [];
  for (const g of d.groups ?? []) {
    for (const o of g.list ?? []) {
      // Coinglass largeTakerOrder side convention (src/lib/cg/types.ts
      // LtoOrder.side): 1 = ask (sell wall), 2 = bid (buy wall) — side is
      // NEVER 0. Verified empirically against live /api/cg/lto BTC data:
      // every side=1 order sits above the live price, every side=2 below.
      // The old `side === 0` test classified ALL whale size as asks.
      if (o.side === 2) bid += o.currentUsd;
      else ask += o.currentUsd;
      rows.push({ ex: g.instrument?.exName, inst: g.instrument?.instrumentId, side: o.side === 2 ? "bid" : "ask", price: o.price, usd: o.currentUsd, filled: o.volUsd });
    }
  }
  rows.sort((a, b) => b.usd - a.usd);
  const imb = bid + ask > 0 ? ((bid - ask) / (bid + ask)) * 100 : 0;
  const lines = [
    `${sym} whale open orders ≥ ${fmtUsd(minUsd)} across ${Object.keys(d.perExchange ?? {}).length} exchanges — ${rows.length} orders`,
    `aggregate: bids ${fmtUsd(bid)} vs asks ${fmtUsd(ask)} · imbalance ${fmtP(imb, 1)}% ${imb > 0 ? "(bid-heavy)" : "(ask-heavy)"}`,
    `top walls:`,
    ...rows.slice(0, 10).map((r) => `  ${r.side.toUpperCase()} ${fmtUsd(r.usd)} @ ${r.price} (${r.ex} ${r.inst})${r.filled ? ` · filled ${fmtUsd(r.filled)}` : ""}`),
  ];
  return { text: lines.join("\n"), data: { sym, bidUsd: bid, askUsd: ask, imbalancePct: fmtP(imb, 1), top: rows.slice(0, 25), perExchange: d.perExchange } };
}

async function toolBookWalls(args) {
  const sym = (args?.sym ?? "BTC").toUpperCase();
  const interval = resolveInterval(args?.interval, BOOKWALLS_ITV, M_TO_PAGE, "15m");
  // limit allowlist mirrors the route exactly (bookwalls route clamps 30-300,
  // verified live — the old 10-500 clamp let MCP advertise ranges the route
  // silently coerced: limit=500 ran as 300, limit=10 as 30) — review finding 5
  const limit = Math.min(Math.max(Number(args?.limit ?? 150) || 150, 30), 300);
  // band allowlist mirrors the route exactly ([0.5, 1, 2, 5], else it silently
  // falls back to 5 server-side) — the old 0.5–20 clamp let MCP advertise
  // bands the route never honored (band=10 silently ran as 5).
  const band = [0.5, 1, 2, 5].includes(Number(args?.band)) ? Number(args?.band) : 5;
  const market = args?.market === "spot" ? "spot" : "futures";
  let endQ = "";
  const endN = Number(args?.endTime);
  if (Number.isFinite(endN) && endN > 0) endQ = `&endTime=${Math.floor(endN)}`;
  const d = await api(`/api/cg/bookwalls?sym=${sym}&market=${market}&interval=${interval}&limit=${limit}&band=${band}${endQ}`);
  if (!d.ok) throw new Error(d.error || "book walls failed");
  const m = d.model;
  const pct = (v) => (v == null || !Number.isFinite(v) ? "—" : `${(v * 100).toFixed(1)}%`);
  const walls = (m.walls ?? []).slice(0, 10);
  const events = (m.events ?? []).slice(0, 8);
  const lines = [
    `${sym} order-book depth ±${band}% (${market} aggregate ${d.venues?.join("+") ?? ""}, ${interval} snapshots, ${m.snapshots} frames) — price ${m.last?.price ?? "—"}`,
    `bid depth ${fmtUsd(m.depth?.bidUsd)} · ask depth ${fmtUsd(m.depth?.askUsd)} · imbalance ${pct(m.imbalance)} (5m ago ${pct(m.imbalance5mAgo)}) · min wall ${fmtUsd(d.minWallUsd)}`,
    walls.length ? `live walls (±3% of mid):` : "no confirmed walls within ±3%",
    ...walls.map(
      (w) =>
        `  ${w.side === "b" ? "BID" : "ASK"} ${fmtUsd(w.usd)} @ ${w.price} (${w.distPct > 0 ? "+" : ""}${w.distPct}%, age ${Math.round((w.ageMs ?? 0) / 60000)}min${w.touched ? ", touched" : ""})`
    ),
  ];
  if (events.length) {
    lines.push("recent wall events (newest first):");
    for (const e of events) {
      lines.push(`  ${tsOf(e.t)} ${String(e.type).toUpperCase()} ${e.side === "b" ? "BID" : "ASK"} ${fmtUsd(e.usd)} @ ${e.p}`);
    }
  }
  return {
    text: lines.join("\n"),
    data: { sym, market, interval, band, depth: m.depth, imbalance: m.imbalance, imbalance5mAgo: m.imbalance5mAgo, walls, events: m.events?.slice(0, 30) },
  };
}

async function toolCvdState(args) {
  const sym = (args?.sym ?? "BTC").toUpperCase();
  const mode = ["perp", "spot", "total"].includes(args?.mode) ? args.mode : "total";
  const itv = resolveInterval(args?.itv, CVD_ITV, M_TO_PAGE, "15m");
  // cvd route clamps limit 300-1500 (verified live) — the old 50-1500 clamp
  // advertised a 50-299 range the route silently ran as 300 — review finding 5
  const limit = Math.min(Math.max(Number(args?.limit ?? 600) || 600, 300), 1500);
  const anchor = ["all", "day", "week"].includes(args?.anchor) ? args.anchor : "all";
  const d = await api(`/api/cg/cvd?sym=${sym}&itv=${itv}&limit=${limit}&mode=${mode}&anchor=${anchor}`);
  if (!d.ok) throw new Error(d.error || "cvd failed");
  const lines = [
    `${sym} CVD (${mode}, ${itv}, ${d.n} bars, anchor ${anchor}) — perp ${fmtM(d.kpis.perpCvd)} · spot ${fmtM(d.kpis.spotCvd)} · buy share ${d.kpis.buyRatio}%`,
    `24h perp taker: buy ${fmtM(d.kpis.perpBuy)} vs sell ${fmtM(d.kpis.perpSell)}`,
    d.divergences.length
      ? `divergences:\n${d.divergences.slice(-6).map((x) => `  ${x.type} @ ${new Date(x.ts).toISOString().slice(5, 16).replace("T", " ")} prices ${x.priceA}→${x.priceB}→${x.priceC} ret12 ${x.ret12}% hit:${x.hit}`).join("\n")}`
      : "no active divergences",
  ];
  return { text: lines.join("\n"), data: { kpis: d.kpis, divergences: d.divergences.slice(-10), n: d.n, itv, anchor } };
}

async function toolStopmap(args) {
  const sym = (args?.sym ?? "BTC").toUpperCase();
  let endQ = "";
  const endN = Number(args?.endTime);
  if (Number.isFinite(endN) && endN > 0) endQ = `&endTime=${Math.floor(endN)}`;
  const d = await api(`/api/cg/stopmap?sym=${sym}${endQ}`);
  if (!d.ok) throw new Error(d.error || "stopmap failed");
  // honest degradation: non-BTC perps serve the rolling liq-snapshot heatmap
  // from archived liqlevels — until the engine's rotation archives that sym,
  // the route returns 200 { supported: false, reason }. Never crash, never 400.
  if (d.supported === false) {
    return { text: `${sym} liquidation heatmap: ${d.reason ?? "rolling liq-snapshot archive not yet available for this perp"}`, data: d };
  }
  const m = d.model;
  if (!m) throw new Error("stopmap returned no model");
  const lines = [
    `${sym} liquidation heatmap (24h window @ 5m bars, ${m.totals?.rows ?? 0} priced rows${endQ ? ", historical" : ""}) — price ${m.lastPrice}`,
    `est. resting liq exposure: ${fmtUsd(m.totals?.below)} below (longs) · ${fmtUsd(m.totals?.above)} above (shorts)`,
    `strongest below (long-liq magnets):`,
    ...(m.clusters?.below ?? []).slice(0, 5).map((c) => `  ${fmtUsd(c.usd)} @ ${c.price} (−${Math.abs(c.distPct)}%, str ${c.strength})`),
    `strongest above (short-liq magnets):`,
    ...(m.clusters?.above ?? []).slice(0, 5).map((c) => `  ${fmtUsd(c.usd)} @ ${c.price} (+${c.distPct}%, str ${c.strength})`),
    `distance bands: ` + (m.bands ?? []).map((b) => `±${b.a}-${b.b}% ↓${fmtUsd(b.below)} ↑${fmtUsd(b.above)}`).join(" · "),
  ];
  return { text: lines.join("\n"), data: { sym, lastPrice: m.lastPrice, totals: m.totals, clusters: m.clusters, bands: m.bands, window: d.window } };
}

async function toolFootprint(args) {
  const sym = (args?.sym ?? "BTC").toUpperCase();
  const interval = resolveInterval(args?.interval, M_INTERVALS, PAGE_TO_M, "m15");
  const limit = Math.min(Math.max(Number(args?.limit ?? 96) || 96, 10), 500);
  const lastN = Math.min(Math.max(Number(args?.last ?? 12) || 12, 1), 48);
  const d = await api(`/api/cg/orderflow-agg?sym=${sym}&interval=${interval}&limit=${limit}`);
  if (!d.ok) throw new Error(d.error || "footprint failed");
  const rows = [];
  for (const bar of (d.bars ?? []).slice(-lastN)) {
    let buy = 0;
    let sell = 0;
    let pocUsd = -1;
    let pocP = null;
    for (const bk of bar.buckets ?? []) {
      const b = Number(bk[4]) || 0;
      const s = Number(bk[5]) || 0;
      buy += b;
      sell += s;
      if (b + s > pocUsd) {
        pocUsd = b + s;
        pocP = +((Number(bk[0]) + Number(bk[1])) / 2).toPrecision(6);
      }
    }
    const delta = buy - sell;
    const dpct = buy + sell > 0 ? (100 * delta) / (buy + sell) : 0;
    rows.push({ ts: bar.ts, buyUsd: Math.round(buy), sellUsd: Math.round(sell), deltaUsd: Math.round(delta), deltaPct: +dpct.toFixed(1), poc: pocP });
  }
  const lines = [
    `${sym} aggregated footprint (${interval}, ${d.venuesOk}/${d.venues} venues ok) — last ${rows.length} bars`,
    ...rows.slice(-12).reverse().map((r) => `  ${tsOf(r.ts)} buy ${fmtM(r.buyUsd)} sell ${fmtM(r.sellUsd)} Δ ${r.deltaPct > 0 ? "+" : ""}${r.deltaPct}% POC ${r.poc ?? "—"}`),
  ];
  return { text: lines.join("\n"), data: { sym, interval, bars: rows } };
}

async function toolLargeOrders(args) {
  const sym = (args?.sym ?? "BTC").toUpperCase();
  const hours = Math.min(Math.max(Number(args?.hours ?? 24) || 24, 1), 720);
  const interval = resolveInterval(args?.interval, M_INTERVALS, PAGE_TO_M, "m15");
  let symbol = String(args?.symbol ?? "");
  if (!/^[A-Za-z0-9_-]{3,48}$/.test(symbol)) symbol = `Binance_${sym}USDT`;
  const d = await api(`/api/cg/largeorder?symbol=${encodeURIComponent(symbol)}&interval=${interval}&hours=${hours}`);
  if (!d.ok) throw new Error(d.error || "large orders failed");
  let restingBid = 0;
  let restingAsk = 0;
  let tradedBuy = 0;
  let tradedSell = 0;
  const resting = [];
  const trades = [];
  for (const g of d.groups ?? []) {
    const ex = g.instrument?.exName ?? "?";
    for (const o of g.list ?? []) {
      const usd = Number(o.quoteVol ?? 0) || 0;
      if (o.turnoverTime) {
        if (o.side === 2) tradedBuy += usd;
        else tradedSell += usd;
        trades.push({ ex, side: o.side === 2 ? "buy" : "sell", price: o.price, usd, fills: o.turnoverNumber ?? 0, at: o.turnoverTime });
      } else {
        if (o.side === 2) restingBid += usd;
        else restingAsk += usd;
        resting.push({ ex, side: o.side === 2 ? "bid" : "ask", price: o.price, usd, remainingUsd: o.volUsd ?? usd, at: o.createTime });
      }
    }
  }
  resting.sort((a, b) => b.usd - a.usd);
  trades.sort((a, b) => b.usd - a.usd);
  const imb = restingBid + restingAsk > 0 ? ((restingBid - restingAsk) / (restingBid + restingAsk)) * 100 : 0;
  const lines = [
    `${symbol} large orders (last ${hours}h, ${interval}) — ${resting.length} resting · ${trades.length} executed`,
    `resting: bids ${fmtUsd(restingBid)} vs asks ${fmtUsd(restingAsk)} · imbalance ${fmtP(imb, 1)}% ${imb > 0 ? "(bid-heavy)" : "(ask-heavy)"}`,
    `executed notional: buys ${fmtUsd(tradedBuy)} vs sells ${fmtUsd(tradedSell)}`,
    resting.length ? `largest resting:` : "no resting walls",
    ...resting.slice(0, 8).map((r) => `  ${r.side.toUpperCase()} ${fmtUsd(r.usd)} @ ${r.price} (${r.ex}) · remaining ${fmtUsd(r.remainingUsd)}`),
  ];
  if (trades.length) {
    lines.push("largest executed:");
    lines.push(...trades.slice(0, 8).map((t) => `  ${t.side.toUpperCase()} ${fmtUsd(t.usd)} @ ${t.price} (${t.ex}, ${t.fills} fills, ${tsOf(t.at)})`));
  }
  return { text: lines.join("\n"), data: { symbol, hours, restingBid, restingAsk, tradedBuy, tradedSell, resting: resting.slice(0, 25), trades: trades.slice(0, 25) } };
}

async function toolKline(args) {
  const sym = (args?.sym ?? "BTC").toUpperCase();
  const type = args?.type === "oi" ? "oi" : "kline";
  const interval = resolveInterval(args?.interval, M_INTERVALS, PAGE_TO_M, "m15");
  const limit = Math.min(Math.max(Number(args?.limit ?? 300) || 300, 10), 1000);
  let symbol = String(args?.symbol ?? "");
  if (!/^[A-Za-z0-9_-]{3,48}$/.test(symbol)) symbol = `Binance_${sym}USDT`;
  const d = await api(`/api/cg/kline?symbol=${encodeURIComponent(symbol)}&type=${type}&interval=${interval}&limit=${limit}`);
  if (!d.ok) throw new Error(d.error || "kline failed");
  const rows = d.rows ?? [];
  const last = rows[rows.length - 1] ?? [];
  const lines = [
    `${symbol} ${type === "oi" ? "open-interest" : "kline"} ${interval} — ${rows.length} rows`,
    `last: ${tsOf(Number(last[0]) || 0)} O ${last[1]} H ${last[2]} L ${last[3]} C ${last[4]}${type === "kline" ? ` V ${last[5]}` : ""}`,
  ];
  return { text: lines.join("\n"), data: { symbol, type, interval, rows: rows.slice(-Math.min(rows.length, 500)) } };
}

async function toolAnalyzeSetup(args) {
  const sym = (args?.sym ?? "BTC").toUpperCase();
  const [market, signals, liq, whale, book, cvd, notif, narrative, quant, options] = await Promise.all([
    toolMarketSnapshot({ sym }).catch(() => null),
    toolSignals({ sym }).catch(() => null),
    toolLiquidationLevels({ sym, range: "3d" }).catch(() => null),
    toolWhaleOrders({ sym }).catch(() => null),
    toolBookWalls({ sym }).catch(() => null),
    toolCvdState({ sym }).catch(() => null),
    api(`/api/cg/notifications?asset=${sym}&limit=15`).catch(() => null),
    api(`/api/cg/narrative?sym=${sym}`).catch(() => null),
    api(`/api/cg/quant?sym=${sym}`).catch(() => null),
    api(`/api/cg/options?sym=${sym}`).catch(() => null),
  ]);
  const parts = [];
  parts.push(`=== ${sym} TRADE CONTEXT (all values live) ===`);
  if (narrative?.ok && narrative.supported !== false) {
    parts.push(
      `\n--- NARRATIVE VERDICT (M1/M2 engine) ---\n` +
        `${narrative.regime} · ${narrative.activeModel} · ${narrative.direction} · grade ${narrative.grade} (conf ${narrative.confidence}/100)\n` +
        `${narrative.thesis}\n` +
        (narrative.plan?.entryZone
          ? `Plan: entry ${narrative.plan.entryZone[0]?.toFixed(2)}-${narrative.plan.entryZone[1]?.toFixed(2)} · stop ${narrative.plan.stop?.toFixed(2)} · bestR ${narrative.plan.bestR?.toFixed(2)}\n` +
            `Targets: ${(narrative.plan.targets || []).filter((t) => t.level != null).map((t) => `${t.label} @ ${t.level.toFixed(2)} (${t.rMultiple?.toFixed(1) ?? "?"}R)`).join(" | ")}\n`
          : "") +
        (narrative.plan?.vetoes?.length ? `Vetoes: ${narrative.plan.vetoes.join("; ")}\n` : "") +
        `Freshness: worstAgeMs ${narrative.freshness?.worstAgeMs ?? "?"}${narrative.freshness?.staleFields?.length ? ` · stale: ${narrative.freshness.staleFields.join(",")}` : ""}`
    );
  }
  if (market) parts.push(`\n--- MARKET ---\n${market.text}`);
  if (signals) parts.push(`\n--- FOOTPRINT SIGNALS ---\n${signals.text}`);
  if (liq) parts.push(`\n--- LIQUIDATION CLUSTERS (sweep magnets) ---\n${liq.text}`);
  if (whale) parts.push(`\n--- WHALE OPEN ORDERS ---\n${whale.text}`);
  if (book) parts.push(`\n--- ORDER-BOOK WALLS ---\n${book.text}`);
  if (cvd) parts.push(`\n--- CVD STATE ---\n${cvd.text}`);
  if (notif?.items?.length) {
    parts.push(
      `\n--- RECENT EVENTS ---\n` +
        notif.items.map((n) => `${new Date(n.ts).toISOString().slice(5, 16).replace("T", " ")} [${n.severity}] ${n.dir.toUpperCase()} ${n.source}: ${n.title}`).join("\n")
    );
  }
  if (quant?.ok && quant.supported !== false) {
    const ls1h = quant.lsRatios?.["1h"] ?? {};
    parts.push(
      `\n--- QUANT POSITIONING ---\n` +
        `OI-weighted funding APR ${quant.funding?.annualizedAprPct?.toFixed(2) ?? "–"}% · spread ${quant.funding?.fundingSpreadBps?.toFixed(2) ?? "–"}bps\n` +
        `L/S 1h: global ${ls1h.global?.ratio?.toFixed(2) ?? "–"} · top-trader positions ${ls1h.topPositions?.ratio?.toFixed(2) ?? "–"} · taker ${ls1h.taker?.buySellRatio?.toFixed(2) ?? "–"}\n` +
        `OI quadrants: 1h ${quant.oiQuadrant?.["1h"]?.quadrant ?? "–"} · 4h ${quant.oiQuadrant?.["4h"]?.quadrant ?? "–"} · 24h ${quant.oiQuadrant?.["24h"]?.quadrant ?? "–"}\n` +
        `Basis ${quant.basis?.basisPct?.toFixed(3) ?? "–"}% · Coinbase premium ${quant.basis?.coinbasePremiumBps?.toFixed(1) ?? "–"}bps`
    );
  }
  if (options?.ok && options.supported !== false) {
    parts.push(
      `\n--- OPTIONS SURFACE (Deribit) ---\n` +
        `DVOL ${options.dvol?.value?.toFixed(1) ?? "–"} (${options.dvol?.changePct24h?.toFixed(1) ?? "–"}% 24h) · ATM IV 7/30/90d ` +
        `${options.termStructure?.["7d"]?.toFixed(1) ?? "–"}/${options.termStructure?.["30d"]?.toFixed(1) ?? "–"}/${options.termStructure?.["90d"]?.toFixed(1) ?? "–"}\n` +
        `RR25d ${options.riskReversal25d?.value?.toFixed(1) ?? "–"} · GEX ${options.gex?.regime ?? "–"} · P/C OI ${options.putCallRatio?.oi?.toFixed(2) ?? "–"}`
    );
  }
  parts.push(
    `\n--- FORMULATION GUIDE ---\n` +
      `Bias: align footprint signal direction (absorption/trap = strongest) with the 4H EMA13×EMA89 trend and position vs day VWAP.\n` +
      `Entry: absorption zone or retest of day/month POC, or the level a fresh HIGH signal attached to.\n` +
      `Stop: beyond the invalidation — other side of the absorption zone / beyond the ±3σ VWAP band / beyond the sweep wick that just took the cluster.\n` +
      `Targets: nearest same-direction liquidation cluster (sweep magnet), day VAH/VAL, whale wall prices. Take profit into clusters, never against them.\n` +
      `Caution: notifications during low-liquidity hours (weekend/Asia) produce weaker sweeps; wait for the 15m close confirmation.`
  );
  return {
    text: parts.join("\n"),
    data: { sym, narrative, market: market?.data, signals: signals?.data, liq: liq?.data, whale: whale?.data, quant, options, notifications: notif?.items ?? [] },
  };
}

async function toolAlphaScreener(args) {
  const sector = args?.sector ? String(args.sector).toLowerCase() : null;
  const d = await api(`/api/cg/screener`);
  if (!d?.ok) throw new Error(d?.error || "screener failed");
  let rows = Array.isArray(d.crypto) ? d.crypto : [];
  if (sector) rows = rows.filter((r) => String(r.sector || "").toLowerCase() === sector);
  rows = [...rows].sort((a, b) => Math.abs(b.confluence?.score ?? 0) - Math.abs(a.confluence?.score ?? 0));
  const lines = [
    `Alpha Screener — ${rows.length} Tier-1 assets (${d.warmCount}/${d.totalCount} warmed) · TradFi core: ${(d.tradfi || []).length}`,
    ...rows.slice(0, 20).map((r) => {
      const conf = r.confluence ? `${r.confluence.bias} ${r.confluence.score} (${r.confluence.readiness})` : "cold";
      const chg = r.chg24hPct != null ? `${r.chg24hPct >= 0 ? "+" : ""}${r.chg24hPct}%` : "–";
      const vw = r.vwapZ != null ? `z=${r.vwapZ}` : "";
      const mag = r.liqMagnet ? `mag:${r.liqMagnet.side}@${r.liqMagnet.distPct}%` : "";
      return `${r.sym.padEnd(9)} px=${r.price ?? "–"} (${chg}) · 4h=${r.ema4h ?? "–"} · ${conf} ${vw} ${mag}`.trim();
    }),
  ];
  return { text: lines.join("\n"), data: d };
}

async function toolTradeNarrative(args) {
  const sym = (args?.sym ?? "BTC").toUpperCase();
  const d = await api(`/api/cg/narrative?sym=${sym}`);
  if (d?.ok === false) throw new Error(d?.error || "narrative failed");
  if (d?.supported === false) {
    return { text: `${sym}: ${d.reason ?? "no narrative available for this instrument"}`, data: d };
  }
  const plan = d.plan ?? {};
  const lines = [
    `${sym} — ${d.regime} · ${d.activeModel} · ${d.direction} · grade ${d.grade} (confidence ${d.confidence}/100)`,
    d.thesis ?? "",
    "",
    `Entry zone: ${plan.entryZone ? `${plan.entryZone[0]} – ${plan.entryZone[1]}` : "n/a"}`,
    `Trigger: ${plan.triggerRule ?? "n/a"}`,
    `Stop: ${plan.stop ?? "n/a"} (${plan.invalidation ?? ""})`,
    ...(plan.targets ?? []).map((t) => `${t.label}: ${t.level ?? "n/a"}${t.rMultiple != null ? ` (${t.rMultiple.toFixed(2)}R)` : ""}`),
    `bestR: ${plan.bestR != null ? plan.bestR.toFixed(2) : "n/a"} (min 1.5)`,
    ...(plan.vetoes?.length ? ["", `Vetoes:`, ...plan.vetoes.map((v) => `- ${v}`)] : []),
    "",
    "Checklist (exact measured values):",
    ...(d.checklist ?? []).map((c) => `- [${c.pass === true ? "PASS" : c.pass === false ? "FAIL" : "N/A"}] ${c.label}: ${c.value}`),
    "",
    `Freshness: worstAgeMs ${d.freshness?.worstAgeMs ?? "?"}${d.freshness?.staleFields?.length ? ` · stale fields: ${d.freshness.staleFields.join(", ")}` : " (all fresh)"}`,
  ];
  return { text: lines.join("\n"), data: d };
}

async function toolQuantPositioning(args) {
  const sym = (args?.sym ?? "BTC").toUpperCase();
  const d = await api(`/api/cg/quant?sym=${sym}`);
  if (d?.ok === false) throw new Error(d?.error || "quant positioning failed");
  if (d?.supported === false) return { text: `${sym}: ${d.reason ?? "no positioning data"}`, data: d };
  const per = (p) => {
    const x = d.lsRatios?.[p] ?? {};
    return `${p}: global ${x.global?.ratio?.toFixed(2) ?? "–"} (${x.global?.longPct?.toFixed(1) ?? "–"}% long) · top accounts ${x.topAccounts?.ratio?.toFixed(2) ?? "–"} · top positions ${x.topPositions?.ratio?.toFixed(2) ?? "–"} · taker ${x.taker?.buySellRatio?.toFixed(3) ?? "–"}`;
  };
  const lines = [
    `${sym} quant positioning (${d.pair}):`,
    per("15m"),
    per("1h"),
    per("4h"),
    "",
    `OI-weighted funding: ${d.funding?.oiWeightedRate8h ?? "–"}%/8h → ${d.funding?.annualizedAprPct?.toFixed(2) ?? "–"}% APR · cross-venue spread ${d.funding?.fundingSpreadBps?.toFixed(2) ?? "–"}bps (${(d.funding?.spreadVenues ?? []).join(" vs ")})`,
    `Venues: ${(d.funding?.venues ?? []).map((v) => `${v.name} ${v.rate8h}%/${v.fundingIntervalHours}h`).join(" · ")}`,
    "",
    `OI×price quadrants: 1h ${d.oiQuadrant?.["1h"]?.quadrant ?? "–"} (Δoi ${d.oiQuadrant?.["1h"]?.oiDeltaPct?.toFixed(2) ?? "–"}%, Δpx ${d.oiQuadrant?.["1h"]?.priceDeltaPct?.toFixed(2) ?? "–"}%) · 4h ${d.oiQuadrant?.["4h"]?.quadrant ?? "–"} · 24h ${d.oiQuadrant?.["24h"]?.quadrant ?? "–"}`,
    `OI/24h-vol ratio: ${d.oiQuadrant?.oiToVolRatio?.toFixed(2) ?? "–"}`,
    `Spot-perp basis: ${d.basis?.basisPct?.toFixed(4) ?? "–"}% (spot ${d.basis?.spotPair ?? "n/a"} @ ${d.basis?.spotPrice ?? "–"}) · Coinbase premium ${d.basis?.coinbasePremiumBps?.toFixed(1) ?? "–"}bps`,
    "",
    `Freshness: dataAt ${d.dataAt} · ageMs ${d.ageMs} · stale ${d.stale} · source ${d.source}`,
    ...(d.notes?.length ? ["", "Notes:", ...d.notes.map((n) => `- ${n}`)] : []),
  ];
  return { text: lines.join("\n"), data: d };
}

async function toolOptionsSurface(args) {
  const sym = (args?.sym ?? "BTC").toUpperCase();
  const d = await api(`/api/cg/options?sym=${sym}`);
  if (d?.ok === false) throw new Error(d?.error || "options surface failed");
  if (d?.supported === false) return { text: `${sym}: ${d.reason ?? "no options data"}`, data: d };
  const lines = [
    `${sym} options surface (Deribit ${d.currency}):`,
    `DVOL ${d.dvol?.value?.toFixed(1) ?? "–"} (${d.dvol?.changePct24h?.toFixed(1) ?? "–"}% 24h)`,
    `ATM IV term structure: 7d ${d.termStructure?.["7d"]?.toFixed(1) ?? "–"}% · 30d ${d.termStructure?.["30d"]?.toFixed(1) ?? "–"}% · 90d ${d.termStructure?.["90d"]?.toFixed(1) ?? "–"}%`,
    `25Δ risk reversal: ${d.riskReversal25d?.value?.toFixed(1) ?? "–"} vol pts (${d.riskReversal25d?.method ?? "–"}, ${d.riskReversal25d?.expiry ?? "–"})`,
    `Max pain: ${(d.maxPain ?? []).map((m) => `${m.expiry} @ ${m.strike}`).join(" · ")}`,
    `Top call OI walls: ${(d.oiWalls?.calls ?? []).slice(0, 3).map((w) => `${w.strike} ($${(w.oiUsd / 1e6).toFixed(1)}M)`).join(" · ")}`,
    `Top put OI walls: ${(d.oiWalls?.puts ?? []).slice(0, 3).map((w) => `${w.strike} ($${(w.oiUsd / 1e6).toFixed(1)}M)`).join(" · ")}`,
    `GEX: ${d.gex?.netGexUsd != null ? `$${(d.gex.netGexUsd / 1e6).toFixed(1)}M` : "–"} → ${d.gex?.regime ?? "–"} (spot ${d.gex?.spot ?? "–"})`,
    `Put/Call: OI ${d.putCallRatio?.oi?.toFixed(2) ?? "–"} · vol24h ${d.putCallRatio?.vol24h?.toFixed(2) ?? "–"}`,
    `Freshness: dataAt ${d.dataAt} · ageMs ${d.ageMs} · stale ${d.stale}`,
    ...(d.notes?.length ? ["", "Notes:", ...d.notes.map((n) => `- ${n}`)] : []),
  ];
  return { text: lines.join("\n"), data: d };
}

async function toolDeskStatus() {
  const d = await api(`/api/desk/live`);
  if (!d?.ok) throw new Error(d?.error || "desk status failed");
  const acc = d.mt5?.account;
  const lines = [
    `Desk ${d.analysis?.lastRound ?? "–"} · MT5 slots ${d.mt5?.slotsUsed ?? 0}/${d.mt5?.maxSlots ?? 4}` +
      (acc ? ` · eq=$${acc.equity} bal=$${acc.balance} pnl=$${acc.profit}` : ""),
    `MT5 positions: ${(d.mt5?.positions || []).length} · pending orders: ${(d.mt5?.orders || []).length}`,
    ...(d.mt5?.orders || []).map((o) => `  #${o.ticket} ${o.sym} ${o.side.toUpperCase()} @ ${o.entry} (live ${o.livePrice ?? "–"}, dist ${o.distToEntryPct ?? "–"}%) SL ${o.sl} TP ${o.tp} R=${o.riskR ?? "–"}`),
  ];
  return { text: lines.join("\n"), data: d };
}

async function toolPaperBook(args) {
  const sym = (args?.sym ?? "").toUpperCase();
  const status = args?.status;
  const limit = args?.limit ?? 30;
  const params = new URLSearchParams();
  if (sym) params.set("sym", sym);
  if (status) params.set("status", String(status).toUpperCase());
  params.set("limit", String(limit));
  const d = await api(`/api/cg/paperbook?${params.toString()}`);
  if (d?.ok === false) throw new Error(d?.error || "paper book failed");
  const statsAll = (d.stats ?? []).find((s) => s.bucket === "ALL");
  const tel = d.telemetry ?? {};
  const lines = [
    `Virtual Book — ${tel.armed ?? 0} armed · ${tel.open ?? 0} open · ${tel.closed ?? 0} closed · sweep ${tel.sweepPos ?? 0}/${tel.universe ?? "?"} of the 61-asset universe`,
    `Scoreboard (ALL): ${statsAll?.filled ?? 0} filled · ${statsAll?.wins ?? 0}W/${statsAll?.losses ?? 0}L` +
      ` · win ${statsAll?.winRatePct != null ? `${statsAll.winRatePct}%` : "–"}` +
      ` · expectancy ${statsAll?.expectancyR != null ? `${statsAll.expectancyR}R` : "–"}` +
      ` · total ${statsAll?.totalR != null ? `${statsAll.totalR}R` : "–"}` +
      ` · avg hold ${statsAll?.avgHoldMin != null ? `${statsAll.avgHoldMin}m` : "–"}`,
    `Freshness: dataAt ${d.freshness?.dataAt} · ageMs ${d.freshness?.ageMs} · stale ${d.freshness?.stale}`,
  ];
  const tickets = d.tickets ?? [];
  if (sym && d.ticket) lines.push(``, `Most relevant ticket for ${sym}: ${d.ticket.status}${d.ticket.outcome ? ` · ${d.ticket.outcome}` : ""} · ${d.ticket.totalR != null ? `${d.ticket.totalR.toFixed(2)}R` : "no R yet"}`);
  if (!tickets.length) {
    lines.push("", "No tickets match the filter — the sweep arms setups as narratives qualify (M1 pullback · M1 wait-zone · M2 stretch).");
  } else {
    lines.push("", "Tickets:");
    for (const t of tickets) {
      const rungStr = (t.targets ?? []).filter((x) => x.level != null).map((x, i) => `${x.hitAt ? "✓" : ""}T${i + 1} ${x.level}`).join(" / ");
      lines.push(
        `  ${t.sym} ${t.model} ${t.direction} ${t.status}${t.outcome ? `·${t.outcome}` : ""}` +
          ` · entry ${t.filledPrice ?? `zone ${t.entryZone?.[0]}–${t.entryZone?.[1]}`}` +
          ` · mark ${t.lastMark ?? "–"} · stop ${t.stop}${t.stopAtBe ? " (BE)" : ""}` +
          ` · R ${t.totalR != null ? t.totalR.toFixed(2) : "–"}` +
          ` · MFE ${t.mfeR.toFixed(2)}/MAE ${t.maeR.toFixed(2)}` +
          (rungStr ? ` · ${rungStr}` : "")
      );
    }
  }
  return { text: lines.join("\n"), data: d };
}

// ---------------------------------------------------------------------------
// MCP protocol plumbing (JSON-RPC 2.0 over stdio, line-delimited)
// ---------------------------------------------------------------------------

const TOOLS = [
  {
    name: "list_assets",
    description: "List the tradable assets with engine + scanner status. Count and membership come live from the terminal (source of truth: src/lib/cg/assets.ts ASSETS) — no hardcoded count.",
    inputSchema: { type: "object", properties: {} },
    handler: toolListAssets,
  },
  {
    name: "market_snapshot",
    description: "Live market snapshot: price, auction VAL/POC/VAH (session 8h / UTC day / UTC month), EMA 13/89/233 and RSI(14) on m15/h1/h4/d1, day VWAP with ±1σ/2σ/3σ bands.",
    inputSchema: {
      type: "object",
      properties: { sym: { type: "string", description: "Asset symbol, e.g. BTC, ETH, XAU" } },
      required: ["sym"],
    },
    handler: toolMarketSnapshot,
  },
  {
    name: "live_price",
    description: "Real-time price tick (1-second-grade feed): forming m1 candle close from Coinglass — the same live number the site charts show. Safe to poll at 1s; the terminal shares one upstream fetch across all callers.",
    inputSchema: {
      type: "object",
      properties: { sym: { type: "string", description: "Asset symbol, e.g. BTC, ETH, XAU" } },
      required: ["sym"],
    },
    handler: toolLivePrice,
  },
  {
    name: "signals",
    description: "Footprint signals (Coinglass-exact engine): Absorption / Divergence / Strong Divergence / Trap / Exhaustion on 15m time bars, auto volume bars and auto range bars.",
    inputSchema: {
      type: "object",
      properties: {
        sym: { type: "string" },
        bt: { type: "string", enum: ["all", "time", "vol", "range"], description: "Bar type filter (default all)" },
      },
      required: ["sym"],
    },
    handler: toolSignals,
  },
  {
    name: "notifications",
    description: "The live notification feed (footprint signals, indicator events, whale walls, liq sweep setups, CVD divergences). Cursor-based: pass `since` (or rely on the stored cursor) to get only new events. Cursor auto-advances.",
    inputSchema: {
      type: "object",
      properties: {
        since: { type: "number", description: "Return events with id > since (default: stored cursor)" },
        asset: { type: "string" },
        source: { type: "string", enum: ["footprint", "indicators", "whale-orders", "liqlevels", "cvd", "paperbook", "engine"] },
        limit: { type: "number" },
        advance_cursor: { type: "boolean", description: "Advance the persistent cursor to the newest id (default true)" },
      },
    },
    handler: toolNotifications,
  },
  {
    name: "liquidation_levels",
    description: "Aggregated liquidation clusters (3d/7d/30d, ±4%, Binance+OKX+Bybit+Hyperliquid) with strongest levels above/below — the sweep magnets.",
    inputSchema: {
      type: "object",
      properties: { sym: { type: "string" }, range: { type: "string", enum: ["3d", "7d", "30d"] } },
      required: ["sym"],
    },
    handler: toolLiquidationLevels,
  },
  {
    name: "liq_live",
    description: "LIVE liquidation prints, server-collected from Binance (!forceOrder@arr) + Bybit (allLiquidation) + OKX (liquidation-orders) and persisted per asset (24h journal). Per-asset: recent prints + 1h/24h aggregates (count, USD, long/short split). No sym = universe-wide tape + hottest assets. Event-stream freshness: quiet (healthy, no events) is reported separately from stale (collector down).",
    inputSchema: {
      type: "object",
      properties: {
        sym: { type: "string", description: "Terminal asset (BTC, 1000PEPE, NVDA...) — omit for the universe-wide view" },
        limit: { type: "number", description: "Max prints returned (default 15, max 60)" },
      },
    },
    handler: toolLiqLive,
  },
  {
    name: "whale_orders",
    description: "Whale resting open orders across all supported exchanges: aggregate bid/ask USD, imbalance and the largest walls (ask/bid wall info like the Liquidity Heatmap page).",
    inputSchema: {
      type: "object",
      properties: { sym: { type: "string" }, minUsd: { type: "number", description: "Minimum order size in USD (default 1,000,000)" } },
      required: ["sym"],
    },
    handler: toolWhaleOrders,
  },
  {
    name: "book_walls",
    description: "Order-book depth walls from the aggregate liquidity-heatmap stream: bid/ask depth, imbalance (now vs 5m ago), confirmed wall list with age/touched state and the add/fill/pull event feed. Full dimension control: market (futures/spot), interval, limit, band %, endTime history.",
    inputSchema: {
      type: "object",
      properties: {
        sym: { type: "string" },
        market: { type: "string", enum: ["futures", "spot"] },
        interval: { type: "string", enum: ["1m", "5m", "15m", "1h", "4h", "1d"], description: "Snapshot interval (m-token aliases m1/m5/m15/h1/h4/d1 also accepted)" },
        limit: { type: "number", description: "Snapshot frames (30-300, default 150 — route clamp)" },
        band: { type: "number", enum: [0.5, 1, 2, 5], description: "Depth band % around mid — route allowlist 0.5/1/2/5, default 5" },
        endTime: { type: "number", description: "Unix seconds — historical window (up to 30 days back)" },
      },
      required: ["sym"],
    },
    handler: toolBookWalls,
  },
  {
    name: "cvd_state",
    description: "Cumulative Volume Delta state: perp/spot CVD, taker buy share, active price/CVD divergences. Timeframe (itv), bar count and KPI anchor (all/day/week) configurable.",
    inputSchema: {
      type: "object",
      properties: {
        sym: { type: "string" },
        mode: { type: "string", enum: ["perp", "spot", "total"] },
        itv: { type: "string", enum: ["1m", "5m", "15m", "30m", "1h", "4h", "1d"] },
        limit: { type: "number", description: "Bars (300-1500, default 600 — route clamp)" },
        anchor: { type: "string", enum: ["all", "day", "week"] },
      },
      required: ["sym"],
    },
    handler: toolCvdState,
  },
  {
    name: "stopmap",
    description: "BTC liquidation heatmap (stops map): the 24h estimated leveraged-position exposure grid — strongest clusters above/below (sweep magnets), distance bands and totals. Anonymous API is BTC-only; pass endTime (unix sec, up to 30 days back) for historical windows.",
    inputSchema: {
      type: "object",
      properties: { sym: { type: "string", description: "BTC only (upstream limitation)" }, endTime: { type: "number", description: "Unix seconds — historical 24h window" } },
      required: ["sym"],
    },
    handler: toolStopmap,
  },
  {
    name: "footprint",
    description: "Aggregated order-flow bars across the deepest perp venues: per-bar taker buy/sell USD, delta %, POC price — the footprint series behind the signal engine. Interval and bar count configurable.",
    inputSchema: {
      type: "object",
      properties: {
        sym: { type: "string" },
        interval: { type: "string", enum: ["m1", "m3", "m5", "m15", "m30", "h1", "h2", "h4", "h6", "h12", "d1", "w1"], description: "Bar interval (route vocabulary; 15m-style page aliases accepted), default m15" },
        limit: { type: "number", description: "Bars to fetch (10-500, default 96)" },
        last: { type: "number", description: "Bars to return in detail (1-48, default 12)" },
      },
      required: ["sym"],
    },
    handler: toolFootprint,
  },
  {
    name: "large_orders",
    description: "Large resting orders AND executed large trades for one instrument (default Binance perp): resting bid/ask walls + executed notional split — the aggressive-whale tape. hours + interval configurable.",
    inputSchema: {
      type: "object",
      properties: {
        sym: { type: "string", description: "Asset symbol — derives the default Binance instrument key" },
        symbol: { type: "string", description: "Explicit instrument key, e.g. OKX_BTC-USDT-SWAP (overrides sym)" },
        hours: { type: "number", description: "Lookback hours (1-720, default 24)" },
        interval: { type: "string", enum: ["m1", "m3", "m5", "m15", "m30", "h1", "h2", "h4", "h6", "h12", "d1", "w1"], description: "Bar interval (route vocabulary; 15m-style page aliases accepted), default m15" },
      },
      required: ["sym"],
    },
    handler: toolLargeOrders,
  },
  {
    name: "kline_series",
    description: "Raw candle or open-interest series for any instrument key (default Binance perp): type kline|oi, any interval, up to 1000 rows — the building block for custom studies.",
    inputSchema: {
      type: "object",
      properties: {
        sym: { type: "string", description: "Asset symbol — derives the default Binance instrument key" },
        symbol: { type: "string", description: "Explicit instrument key, e.g. Hyperliquid_BTC-USD (overrides sym)" },
        type: { type: "string", enum: ["kline", "oi"] },
        interval: { type: "string", enum: ["m1", "m3", "m5", "m15", "m30", "h1", "h2", "h4", "h6", "h12", "d1", "w1"], description: "Bar interval m1…w1 (15m-style page aliases accepted), default m15" },
        limit: { type: "number", description: "Rows (10-1000, default 300)" },
      },
      required: ["sym"],
    },
    handler: toolKline,
  },
  {
    name: "analyze_setup",
    description: "One-call trade-formulation context for an asset: market snapshot + footprint signals + liquidation clusters + whale walls + book walls + CVD state + recent events + the formulation guide (bias / entry / stop / targets).",
    inputSchema: { type: "object", properties: { sym: { type: "string" } }, required: ["sym"] },
    handler: toolAnalyzeSetup,
  },
  {
    name: "trade_narrative",
    description: "The deterministic M1/M2 trade narrative: regime classification (TREND_UP/DOWN · RANGE_BALANCE · COMPRESSION_SQUEEZE), dual-model evaluation (M1 trend-pullback, M2 VWAP ±2σ-3σ mean reversion), hard vetoes, full plan (entry zone · trigger · stop · T1-T3 R-ladder) and the exact-value checklist with freshness (worstAgeMs, staleFields). Works for crypto, TradFi perps and classic (reduced checklist).",
    inputSchema: {
      type: "object",
      properties: { sym: { type: "string", description: "Asset symbol, e.g. BTC, NVDA, SPX500" } },
      required: ["sym"],
    },
    handler: toolTradeNarrative,
  },
  {
    name: "quant_positioning",
    description: "Derivatives positioning: Binance long/short ratios (global accounts, top-trader accounts, top-trader positions, taker buy/sell) at 15m/1h/4h, OI-weighted funding + annualized APR + cross-venue arb spread, OI×price 4-quadrant states (1h/4h/24h), spot-perp basis and Coinbase premium (majors).",
    inputSchema: {
      type: "object",
      properties: { sym: { type: "string", description: "Asset symbol, e.g. BTC, NVDA, 1000PEPE" } },
      required: ["sym"],
    },
    handler: toolQuantPositioning,
  },
  {
    name: "options_surface",
    description: "Deribit options surface (BTC/ETH): DVOL index, ATM IV term structure (7/30/90d), 25-delta risk-reversal skew, max pain (3 monthlies), top call/put OI walls, dealer net gamma (GEX) regime and put/call ratios.",
    inputSchema: {
      type: "object",
      properties: { sym: { type: "string", enum: ["BTC", "ETH"], description: "Deribit lists options only for BTC/ETH" } },
      required: ["sym"],
    },
    handler: toolOptionsSurface,
  },
  {
    name: "alpha_screener",
    description: "Ranked cross-asset screener across all 30 crucial crypto + 3 metals + TradFi core: live price, 24h%, VWAP σ, 4H EMA, footprint signal, liquidation magnet, and multi-factor confluence score.",
    inputSchema: { type: "object", properties: { sector: { type: "string", description: "Optional sector filter (major, l1, defi, ai, l2, meme, privacy, metal)" } } },
    handler: toolAlphaScreener,
  },
  {
    name: "desk_status",
    description: "Read-only live snapshot of MT5 account, open positions, pending limit orders, live distance-to-fill, and recent desk rounds.",
    inputSchema: { type: "object", properties: {} },
    handler: toolDeskStatus,
  },
  {
    name: "paper_book",
    description: "The Virtual Book: live paper-trade outcome tracker for every agent setup (M1 trend-pullback · M1 wait-zone · M2 VWAP ±2σ mean-reversion) across the full 61-asset universe. Tickets carry frozen entry zone/stop/rung ladder, real fills on m1 wicks, live unrealized R, MFE/MAE excursions, and closed outcomes (TP1/TP2/SL/BE/TIME_STOP/FLIP_CLOSE/EXPIRED). Per-model scoreboard: win rate, expectancy in R, total R, fill rate, avg hold.",
    inputSchema: {
      type: "object",
      properties: {
        sym: { type: "string", description: "Optional asset filter, e.g. BTC, NVDA, SPX500 — also returns the most relevant ticket for the symbol" },
        status: { type: "string", enum: ["ARMED", "OPEN", "CLOSED"], description: "Optional status filter (default all)" },
        limit: { type: "number", description: "Max tickets returned (default 30)" },
      },
    },
    handler: toolPaperBook,
  },
];

const rl = readline.createInterface({ input: process.stdin });

function send(obj) {
  process.stdout.write(JSON.stringify(obj) + "\n");
}

rl.on("line", (line) => {
  let msg;
  try {
    msg = JSON.parse(line);
  } catch {
    return;
  }
  const { id, method, params } = msg;
  if (method === "initialize") {
    send({
      jsonrpc: "2.0",
      id,
      result: {
        protocolVersion: params?.protocolVersion ?? "2024-11-05",
        capabilities: { tools: {} },
        serverInfo: { name: "cg-terminal", version: "1.0.0" },
      },
    });
    return;
  }
  if (method === "notifications/initialized" || method?.startsWith("notifications/")) return; // no response
  if (method === "ping") {
    send({ jsonrpc: "2.0", id, result: {} });
    return;
  }
  if (method === "tools/list") {
    send({
      jsonrpc: "2.0",
      id,
      result: {
        tools: TOOLS.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })),
      },
    });
    return;
  }
  if (method === "tools/call") {
    const name = params?.name;
    const tool = TOOLS.find((t) => t.name === name);
    if (!tool) {
      send({ jsonrpc: "2.0", id, result: { content: [{ type: "text", text: `unknown tool ${name}` }], isError: true } });
      return;
    }
    Promise.resolve(tool.handler(params?.arguments ?? {}))
      .then((out) => {
        send({
          jsonrpc: "2.0",
          id,
          result: {
            content: [
              { type: "text", text: out.text },
              ...(out.data ? [{ type: "text", text: "```json\n" + JSON.stringify(out.data).slice(0, 60_000) + "\n```" }] : []),
            ],
          },
        });
      })
      .catch((e) => {
        send({
          jsonrpc: "2.0",
          id,
          result: { content: [{ type: "text", text: `tool ${name} failed: ${e?.message ?? e}` }], isError: true },
        });
      });
    return;
  }
  if (id != null) send({ jsonrpc: "2.0", id, error: { code: -32601, message: `method not found: ${method}` } });
});

process.stderr.write(`[cg-terminal-mcp] ready — terminal at ${TERMINAL_URL}\n`);
