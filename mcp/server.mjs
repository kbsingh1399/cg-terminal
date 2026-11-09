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
 *   - analyze_setup     one-call context bundle for trade formulation
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

// ---------------------------------------------------------------------------
// Tool implementations — each returns MCP content (text + structured)
// ---------------------------------------------------------------------------

async function toolListAssets() {
  const d = await api("/api/cg/assets");
  return {
    text: d.assets.map((a) => `${a.sym.padEnd(5)} ${a.name}${a.kind === "metal" ? " (metal perp)" : ""}`).join("\n"),
    data: d,
  };
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
      if (o.side === 0) bid += o.currentUsd;
      else ask += o.currentUsd;
      rows.push({ ex: g.instrument?.exName, inst: g.instrument?.instrumentId, side: o.side === 0 ? "bid" : "ask", price: o.price, usd: o.currentUsd, filled: o.volUsd });
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
  const d = await api(`/api/cg/bookwalls?sym=${sym}&market=futures&interval=m15&limit=150&band=5`);
  if (!d.ok) throw new Error(d.error || "book walls failed");
  const m = d.model;
  const fmtUsd = (v) => (Math.abs(v) >= 1e9 ? `$${(v / 1e9).toFixed(2)}B` : Math.abs(v) >= 1e6 ? `$${(v / 1e6).toFixed(1)}M` : `$${Math.round(v / 1e3)}K`);
  const lines = [
    `${sym} order-book depth ±5% (aggregate ${d.venues.join("+")}, m15 snapshots) — price ${m.last ?? m.price ?? ""}`,
    `bid depth ${fmtUsd(m.depth?.bidUsd ?? 0)} · ask depth ${fmtUsd(m.depth?.askUsd ?? 0)} · imbalance ${fmtP(((m.depth?.imbalance ?? 0) * 100), 1)}%`,
    m.kpis ? `largest bid wall ${fmtUsd(m.kpis.maxBid?.usd ?? 0)} @ ${m.kpis.maxBid?.price} · largest ask wall ${fmtUsd(m.kpis.maxAsk?.usd ?? 0)} @ ${m.kpis.maxAsk?.price}` : "",
  ].filter(Boolean);
  return { text: lines.join("\n"), data: m };
}

async function toolCvdState(args) {
  const sym = (args?.sym ?? "BTC").toUpperCase();
  const mode = ["perp", "spot", "total"].includes(args?.mode) ? args.mode : "total";
  const d = await api(`/api/cg/cvd?sym=${sym}&itv=m15&limit=600&mode=${mode}`);
  if (!d.ok) throw new Error(d.error || "cvd failed");
  const fmtM = (v) => (v == null ? null : `${(v / 1000).toFixed(1)}M`);
  const lines = [
    `${sym} CVD (${mode}, m15, ${d.n} bars) — perp ${fmtM(d.kpis.perpCvd)} · spot ${fmtM(d.kpis.spotCvd)} · buy share ${d.kpis.buyRatio}%`,
    `24h perp taker: buy ${fmtM(d.kpis.perpBuy)} vs sell ${fmtM(d.kpis.perpSell)}`,
    d.divergences.length
      ? `divergences:\n${d.divergences.slice(-6).map((x) => `  ${x.type} @ ${new Date(x.ts).toISOString().slice(5, 16).replace("T", " ")} prices ${x.priceA}→${x.priceB}→${x.priceC} ret12 ${x.ret12}% hit:${x.hit}`).join("\n")}`
      : "no active divergences",
  ];
  return { text: lines.join("\n"), data: { kpis: d.kpis, divergences: d.divergences.slice(-10), n: d.n } };
}

async function toolAnalyzeSetup(args) {
  const sym = (args?.sym ?? "BTC").toUpperCase();
  const [market, signals, liq, whale, notif] = await Promise.all([
    toolMarketSnapshot({ sym }).catch(() => null),
    toolSignals({ sym }).catch(() => null),
    toolLiquidationLevels({ sym, range: "3d" }).catch(() => null),
    toolWhaleOrders({ sym }).catch(() => null),
    api(`/api/cg/notifications?asset=${sym}&limit=15`).catch(() => null),
  ]);
  const parts = [];
  parts.push(`=== ${sym} TRADE CONTEXT (all values live from the Coinglass API) ===`);
  if (market) parts.push(`\n--- MARKET ---\n${market.text}`);
  if (signals) parts.push(`\n--- FOOTPRINT SIGNALS ---\n${signals.text}`);
  if (liq) parts.push(`\n--- LIQUIDATION CLUSTERS (sweep magnets) ---\n${liq.text}`);
  if (whale) parts.push(`\n--- WHALE OPEN ORDERS ---\n${whale.text}`);
  if (notif?.items?.length) {
    parts.push(
      `\n--- RECENT EVENTS ---\n` +
        notif.items.map((n) => `${new Date(n.ts).toISOString().slice(5, 16).replace("T", " ")} [${n.severity}] ${n.dir.toUpperCase()} ${n.source}: ${n.title}`).join("\n")
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
    data: { sym, market: market?.data, signals: signals?.data, liq: liq?.data, whale: whale?.data, notifications: notif?.items ?? [] },
  };
}

// ---------------------------------------------------------------------------
// MCP protocol plumbing (JSON-RPC 2.0 over stdio, line-delimited)
// ---------------------------------------------------------------------------

const TOOLS = [
  {
    name: "list_assets",
    description: "List the 12 tradable assets (10 crypto + gold/silver) with engine + scanner status.",
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
        source: { type: "string", enum: ["footprint", "indicators", "whale-orders", "liqlevels", "cvd", "engine"] },
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
    description: "Order-book depth walls (±5%) from the aggregate liquidity-heatmap stream: bid/ask depth, imbalance, largest walls.",
    inputSchema: { type: "object", properties: { sym: { type: "string" } }, required: ["sym"] },
    handler: toolBookWalls,
  },
  {
    name: "cvd_state",
    description: "Cumulative Volume Delta state: perp/spot CVD, taker buy share and the active price/CVD divergences.",
    inputSchema: {
      type: "object",
      properties: { sym: { type: "string" }, mode: { type: "string", enum: ["perp", "spot", "total"] } },
      required: ["sym"],
    },
    handler: toolCvdState,
  },
  {
    name: "analyze_setup",
    description: "One-call trade-formulation context for an asset: market snapshot + footprint signals + liquidation clusters + whale walls + recent events + the formulation guide (bias / entry / stop / targets).",
    inputSchema: { type: "object", properties: { sym: { type: "string" } }, required: ["sym"] },
    handler: toolAnalyzeSetup,
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
