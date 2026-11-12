/**
 * LIVE LIQUIDATION COLLECTOR — server-side, multi-venue, per-asset (2026-11-12).
 *
 * "Live liquidation doesn't work" root cause (verified live from this host):
 * the old UI subscribed the BROWSER to the per-pair fstream forceOrder stream —
 * (a) per-pair liquidation prints are EPISODIC (most alts print a few times a
 * day; a calm market prints nothing anywhere for minutes), so a session-only
 * feed looks dead even when it is perfectly healthy;
 * (b) from rate-limited hosts (shared preview IPs) fstream accepts the
 * handshake but never pushes a single frame — silent death;
 * (c) nothing was ever persisted, so even a healthy session started empty.
 *
 * This module owns ONE server-side collector per process:
 *   Binance  wss://fstream.binance.com/stream?streams=!forceOrder@arr/btcusdt@bookTicker
 *            — all-market liquidation prints. The btcusdt@bookTicker leg is a
 *              HEARTBEAT: it pushes ~1/s whenever the connection is alive, so
 *              a silent-but-open socket is detected as dead within 30 s and
 *              reconnected (a quiet forceOrder stream alone cannot prove
 *              liveness — liquidations legitimately stop for minutes).
 *   Bybit    wss://stream.bybit.com/v5/public/linear — allLiquidation.<SYM>
 *            per symbol (resolved through instruments-info; Bybit renames
 *            1000-multiples, e.g. 1000SHIB → SHIB1000USDT). Server text-pings
 *              are answered with "pong" (heartbeat).
 *   OKX      wss://ws.okx.com/ws/v5/public — liquidation-orders (instType
 *            SWAP, global push). Client text-pings every 20 s; "pong" is the
 *            heartbeat. Notional needs the swap contract value (ctVal), loaded
 *            from /api/v5/public/instruments once per boot.
 *
 * Every print is normalized to { t, venue, asset, pair, side, price, qtyBase, usd }
 * and APPENDED to data/cg-liq/<SYM>.jsonl (per-asset journal, the user's
 * "store live liquidation as per asset" directive). On boot the journals are
 * replayed (trailing 24 h) so the feed, the 1h/24h aggregates and the per-asset
 * tape are warm immediately — a restart never resets history to "quiet book".
 *
 * Honesty rules (P1 contract):
 *   - an event stream's "stale" is NOT "no recent events" — quiet books are
 *     normal. stale = no venue connection alive, or every alive connection
 *     silent past its heartbeat window. `quiet` (healthy, eventless) is
 *     reported separately and never shown as an error.
 *   - each event carries its venue; nothing is aggregated away or invented;
 *     legs that cannot run (no WebSocket runtime, unreachable venue) surface
 *     in telemetry with the exact reason.
 */

import fs from "fs";
import path from "path";
import { CURATED } from "@/lib/universe/curated";
import { ASSETS } from "./assets";
import { resolveDataRoot } from "./store";

// ---------------------------------------------------------------------------
// types
// ---------------------------------------------------------------------------

export type LiqVenue = "binance" | "bybit" | "okx";

export interface LiqPrint {
  /** event time (venue trade time), ms */
  t: number;
  venue: LiqVenue;
  /** terminal asset symbol (e.g. BTC, 1000PEPE, NVDA) */
  asset: string;
  /** venue-native pair (BTCUSDT / SHIB1000USDT / NVDA-USDT-SWAP) */
  pair: string;
  /** which side got liquidated */
  side: "long" | "short";
  /** execution / bankruptcy price (venue-native units) */
  price: number;
  /** base-coin quantity (OKX: sz × ctVal; null when ctVal unknown) */
  qtyBase: number | null;
  /** USD notional at the liquidation price (null when not computable) */
  usd: number | null;
}

export interface LiqStatsWin {
  count: number;
  longs: number;
  shorts: number;
  usd: number;
  largestUsd: number | null;
  lastAt: number | null;
}

export interface LiqVenueTelemetry {
  venue: LiqVenue;
  status: "connecting" | "open" | "reconnecting" | "dead" | "unavailable";
  connectedAt: number | null;
  lastFrameAt: number | null;
  lastEventAt: number | null;
  frames: number;
  events: number;
  reconnects: number;
  lastError: string | null;
  /** bybit: topic subscribe acks */
  subsOk: number;
  subsFailed: number;
}

export interface LiqAssetView {
  sym: string;
  supported: boolean;
  reason?: string;
  events: LiqPrint[];
  stats1h: LiqStatsWin;
  stats24h: LiqStatsWin;
  venuesSeen: LiqVenue[];
}

export interface LiqGlobalView {
  tape: LiqPrint[];
  assets: { sym: string; count1h: number; count24h: number; usd24h: number; lastAt: number | null }[];
  universe1h: { count: number; usd: number; longs: number; shorts: number };
  universe24h: { count: number; usd: number; longs: number; shorts: number };
}

// ---------------------------------------------------------------------------
// symbol maps (Binance pair / Bybit symbol / OKX instId → terminal asset)
// ---------------------------------------------------------------------------

/** curated perps (58) + legacy Tier-1 registry assets — the addressable set */
const TERMINAL_PERP_ASSETS: { sym: string; kind: "curated-perp" | "registry" }[] = (() => {
  const out: { sym: string; kind: "curated-perp" | "registry" }[] = [];
  const seen = new Set<string>();
  for (const c of CURATED) {
    if (c.kind === "classic") continue;
    if (seen.has(c.sym)) continue;
    seen.add(c.sym);
    out.push({ sym: c.sym, kind: "curated-perp" });
  }
  for (const a of ASSETS) {
    if (seen.has(a.sym)) continue;
    seen.add(a.sym);
    out.push({ sym: a.sym, kind: "registry" });
  }
  return out;
})();

const BINANCE_PAIR_TO_ASSET = new Map<string, string>();
const BYBIT_CANDIDATES = new Map<string, string[]>(); // asset → candidate symbols
const OKX_CANDIDATES = new Map<string, string[]>(); // asset → candidate instIds
for (const { sym } of TERMINAL_PERP_ASSETS) {
  BINANCE_PAIR_TO_ASSET.set(`${sym}USDT`, sym);
  const stripped = sym.startsWith("1000") ? sym.slice(4) : null;
  // Bybit: both k-unit conventions exist per coin (1000PEPEUSDT, SHIB1000USDT)
  const by = [`${sym}USDT`];
  if (stripped) by.push(`${stripped}1000USDT`, `${stripped}USDT`);
  BYBIT_CANDIDATES.set(sym, by);
  // OKX: 1000-prefixed instIds are the norm for k-unit coins
  const ok = [`${sym}-USDT-SWAP`];
  if (stripped) ok.push(`${stripped}-USDT-SWAP`);
  OKX_CANDIDATES.set(sym, ok);
}

const SUPPORTED_ASSETS = new Set(TERMINAL_PERP_ASSETS.map((a) => a.sym));

// ---------------------------------------------------------------------------
// persistence (data/cg-liq/<SYM>.jsonl — mirrors the cg-series conventions)
// ---------------------------------------------------------------------------

const CG_LIQ_DIR = path.join(path.dirname(resolveDataRoot()), "cg-liq");
const JOURNAL_MAX_ROWS = 20_000;
const JOURNAL_COMPACT_TO = 10_000;
const RING_MAX = 3_000;
const HYDRATE_WINDOW_MS = 24 * 3600_000;

function journalFile(asset: string) {
  return path.join(CG_LIQ_DIR, `${asset.replace(/[^A-Za-z0-9_.\-]/g, "_")}.jsonl`);
}

// ---------------------------------------------------------------------------
// collector state (globalThis — one per process, dev-bundle safe)
// ---------------------------------------------------------------------------

interface VenueLeg extends LiqVenueTelemetry {
  ws: WebSocket | null;
  backoffMs: number;
  reconnectTimer: ReturnType<typeof setTimeout> | null;
  keepaliveTimer: ReturnType<typeof setInterval> | null;
  silenceTimer: ReturnType<typeof setTimeout> | null;
}

interface CollectorState {
  booted: boolean;
  bootAt: number;
  hydrated: boolean;
  hydrating: boolean;
  legs: Record<LiqVenue, VenueLeg>;
  /** asset → ring (newest last) */
  rings: Map<string, LiqPrint[]>;
  /** cross-asset tape (newest first), universe assets only */
  tape: LiqPrint[];
  /** recent dedupe keys (venue|asset|side|t|px|qty) */
  seen: Map<string, number>;
  /** bybit symbol map (asset → resolved symbol) + okx ctVal (instId → ctVal×ctMult) */
  bybitSymbols: Map<string, string>;
  okxCtVal: Map<string, number>;
  universeEvents: number;
  otherEvents: number;
  writeWarned: boolean;
}

type G = CollectorState & { __brand?: never };
const gCol = globalThis as unknown as { __cgLiqLive?: G };

function freshLeg(venue: LiqVenue): VenueLeg {
  return {
    venue,
    status: "dead",
    ws: null,
    connectedAt: null,
    lastFrameAt: null,
    lastEventAt: null,
    frames: 0,
    events: 0,
    reconnects: 0,
    lastError: null,
    subsOk: 0,
    subsFailed: 0,
    backoffMs: 500,
    reconnectTimer: null,
    keepaliveTimer: null,
    silenceTimer: null,
  };
}

function col(): G {
  if (!gCol.__cgLiqLive) {
    gCol.__cgLiqLive = {
      booted: false,
      bootAt: 0,
      hydrated: false,
      hydrating: false,
      legs: { binance: freshLeg("binance"), bybit: freshLeg("bybit"), okx: freshLeg("okx") },
      rings: new Map(),
      tape: [],
      seen: new Map(),
      bybitSymbols: new Map(),
      okxCtVal: new Map(),
      universeEvents: 0,
      otherEvents: 0,
      writeWarned: false,
    };
  }
  return gCol.__cgLiqLive;
}

// ---------------------------------------------------------------------------
// event ingest (normalize → dedupe → rings → journal)
// ---------------------------------------------------------------------------

function dedupeKey(p: LiqPrint): string {
  return `${p.venue}|${p.asset}|${p.side}|${p.t}|${p.price.toFixed(8)}|${p.qtyBase != null ? p.qtyBase.toFixed(6) : "?"}`;
}

function ingest(p: LiqPrint) {
  const S = col();
  const key = dedupeKey(p);
  const now = Date.now();
  if (S.seen.has(key)) return;
  S.seen.set(key, now);
  if (S.seen.size > 8_000) {
    for (const [k, at] of S.seen) if (now - at > 10 * 60_000) S.seen.delete(k);
  }

  if (!SUPPORTED_ASSETS.has(p.asset)) {
    S.otherEvents++;
    return; // out-of-universe prints are counted, never stored
  }
  S.universeEvents++;

  let ring = S.rings.get(p.asset);
  if (!ring) S.rings.set(p.asset, (ring = []));
  ring.push(p);
  if (ring.length > RING_MAX) ring.splice(0, ring.length - RING_MAX);
  S.tape.unshift(p);
  if (S.tape.length > 1_000) S.tape.length = 1_000;

  // per-asset append-only journal (bounded compaction, same convention as
  // cg-series: rewrite atomically past 1.2× cap, keep the newest tail)
  try {
    fs.mkdirSync(CG_LIQ_DIR, { recursive: true });
    const f = journalFile(p.asset);
    let rows = 1;
    try {
      rows = 1 + fs.readFileSync(f, "utf8").split("\n").filter((l) => l.trim()).length;
    } catch {
      /* first row */
    }
    if (rows > JOURNAL_MAX_ROWS * 1.2) {
      const ringText = ring.map((r) => JSON.stringify(r)).join("\n") + "\n";
      const tmp = `${f}.tmp`;
      fs.writeFileSync(tmp, ringText, "utf8");
      fs.renameSync(tmp, f);
    } else {
      fs.appendFileSync(f, `${JSON.stringify(p)}\n`, "utf8");
    }
  } catch (e) {
    if (!S.writeWarned) {
      S.writeWarned = true;
      console.warn("[liq-live] journal write failed:", e instanceof Error ? e.message : e);
    }
  }
}

/** hydrate the trailing 24h of every per-asset journal (hot restart warmth) */
async function hydrate() {
  const S = col();
  if (S.hydrated || S.hydrating) return;
  S.hydrating = true;
  await new Promise((r) => setTimeout(r, 0)); // never block the booting request
  try {
    const cutoff = Date.now() - HYDRATE_WINDOW_MS;
    let files: string[] = [];
    try {
      files = fs.readdirSync(CG_LIQ_DIR).filter((f) => f.endsWith(".jsonl"));
    } catch {
      files = [];
    }
    for (const f of files) {
      const asset = f.replace(/\.jsonl$/, "");
      if (!SUPPORTED_ASSETS.has(asset)) continue;
      let text = "";
      try {
        text = fs.readFileSync(path.join(CG_LIQ_DIR, f), "utf8");
      } catch {
        continue;
      }
      const lines = text.split("\n");
      const start = Math.max(0, lines.length - JOURNAL_MAX_ROWS);
      const ring: LiqPrint[] = [];
      for (const line of lines.slice(start)) {
        if (!line.trim()) continue;
        try {
          const p = JSON.parse(line) as LiqPrint;
          if (p.t >= cutoff) ring.push(p);
        } catch {
          /* skip corrupt line */
        }
      }
      if (ring.length) {
        ring.sort((a, b) => a.t - b.t);
        S.rings.set(asset, ring.length > RING_MAX ? ring.slice(-RING_MAX) : ring);
      }
    }
    // rebuild the cross-asset tape from the hydrated rings
    const all: LiqPrint[] = [];
    for (const ring of S.rings.values()) all.push(...ring.slice(-80));
    all.sort((a, b) => b.t - a.t);
    S.tape = all.slice(0, 1_000);
    S.hydrated = true;
  } finally {
    S.hydrating = false;
  }
}

// ---------------------------------------------------------------------------
// venue legs
// ---------------------------------------------------------------------------

function jitter(ms: number): number {
  return Math.round(ms * (0.85 + 0.3 * Math.random()));
}

function scheduleReconnect(venue: LiqVenue, why: string) {
  const S = col();
  const leg = S.legs[venue];
  if (leg.reconnectTimer) return;
  leg.reconnects++;
  leg.lastError = why;
  leg.status = "reconnecting";
  teardownLeg(venue);
  const wait = jitter(leg.backoffMs);
  leg.backoffMs = Math.min(leg.backoffMs * 2, 30_000);
  leg.reconnectTimer = setTimeout(() => {
    leg.reconnectTimer = null;
    openLeg(venue);
  }, wait);
}

function teardownLeg(venue: LiqVenue) {
  const leg = col().legs[venue];
  if (leg.keepaliveTimer) {
    clearInterval(leg.keepaliveTimer);
    leg.keepaliveTimer = null;
  }
  if (leg.silenceTimer) {
    clearTimeout(leg.silenceTimer);
    leg.silenceTimer = null;
  }
  if (leg.ws) {
    try {
      leg.ws.onclose = null;
      leg.ws.close();
    } catch {
      /* noop */
    }
    leg.ws = null;
  }
}

/** arm the heartbeat-silence watchdog: if no frame (incl. heartbeats) lands
 *  within `ms`, the socket is silently dead → reconnect */
function armSilence(venue: LiqVenue, ms: number) {
  const leg = col().legs[venue];
  if (leg.silenceTimer) clearTimeout(leg.silenceTimer);
  leg.silenceTimer = setTimeout(() => {
    if (leg.ws) scheduleReconnect(venue, `no frames for ${Math.round(ms / 1000)}s (heartbeat silence)`);
  }, ms);
}

function onFrame(venue: LiqVenue) {
  const leg = col().legs[venue];
  leg.frames++;
  leg.lastFrameAt = Date.now();
  leg.backoffMs = 500;
  if (leg.status !== "open") leg.status = "open";
}

function openLeg(venue: LiqVenue) {
  const S = col();
  const leg = S.legs[venue];
  if (typeof WebSocket !== "function") {
    leg.status = "unavailable";
    leg.lastError = "no WebSocket runtime (Node >= 21 required)";
    return;
  }
  teardownLeg(venue);
  leg.status = "connecting";
  let url: string;
  if (venue === "binance") {
    // !forceOrder@arr = all-market liquidations; btcusdt@bookTicker = heartbeat
    url = "wss://fstream.binance.com/stream?streams=!forceOrder@arr/btcusdt@bookTicker";
  } else if (venue === "bybit") {
    url = "wss://stream.bybit.com/v5/public/linear";
  } else {
    url = "wss://ws.okx.com/ws/v5/public";
  }
  let ws: WebSocket;
  try {
    ws = new WebSocket(url);
  } catch (e) {
    scheduleReconnect(venue, `connect failed: ${e instanceof Error ? e.message : "error"}`);
    return;
  }
  leg.ws = ws;
  leg.connectedAt = Date.now();

  ws.onopen = () => {
    onFrame(venue); // open counts as the first liveness proof
    if (venue === "bybit") {
      // the server text-pings us every ~20s; we answer "pong" (see
      // onmessage) and the silence watchdog guards against silent death
      leg.subsOk = 0;
      leg.subsFailed = 0;
      const subs = [...S.bybitSymbols.values()];
      const args: string[] = [];
      for (const sym of subs) args.push(`allLiquidation.${sym}`);
      for (let i = 0; i < args.length; i += 20) {
        try {
          ws.send(JSON.stringify({ op: "subscribe", args: args.slice(i, i + 20) }));
        } catch {
          /* handled on close */
        }
      }
      armSilence(venue, 75_000);
    } else if (venue === "okx") {
      leg.keepaliveTimer = setInterval(() => {
        try {
          ws.send("ping");
        } catch {
          /* handled on close */
        }
      }, 20_000);
      try {
        ws.send(JSON.stringify({ op: "subscribe", args: [{ channel: "liquidation-orders", instType: "SWAP" }] }));
      } catch {
        /* handled on close */
      }
      armSilence(venue, 75_000);
    } else {
      armSilence(venue, 45_000); // bookTicker heartbeat pushes ~1/s
    }
  };

  ws.onmessage = (ev: MessageEvent) => {
    const raw = typeof ev.data === "string" ? ev.data : "";
    if (!raw) return;
    if (venue === "bybit" && raw === "ping") {
      onFrame(venue);
      try {
        ws.send("pong");
      } catch {
        /* noop */
      }
      armSilence(venue, 75_000);
      return;
    }
    if (venue === "okx" && raw === "pong") {
      onFrame(venue);
      armSilence(venue, 75_000);
      return;
    }
    let msg: unknown;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }
    if (venue === "binance") {
      const m = msg as { stream?: string; data?: Record<string, unknown> };
      if (!m.data) return;
      onFrame(venue);
      armSilence(venue, 45_000);
      if (m.stream === "!forceOrder@arr" || (m.data as { e?: string }).e === "forceOrder") {
        const o = (m.data as { o?: Record<string, string> }).o;
        if (!o) return;
        const qty = Number(o.z) || Number(o.q) || 0;
        const px = Number(o.ap) || Number(o.p) || 0;
        const pair = String(o.s ?? "");
        const asset = BINANCE_PAIR_TO_ASSET.get(pair);
        if (qty > 0 && px > 0 && asset) {
          leg.events++;
          leg.lastEventAt = Date.now();
          ingest({ t: Number(o.T) || Date.now(), venue: "binance", asset, pair, side: o.S === "SELL" ? "long" : "short", price: px, qtyBase: qty, usd: qty * px });
        }
      }
      return; // bookTicker heartbeat frames only refreshed liveness
    }
    if (venue === "bybit") {
      const m = msg as { topic?: string; op?: string; success?: boolean; ret_msg?: string; type?: string; data?: { T?: number; s?: string; S?: string; v?: string; p?: string }[] };
      if (!m.topic) {
        // subscribe acks: {op:"subscribe", success:true|false, ret_msg}
        if (m.op === "subscribe") {
          onFrame(venue);
          armSilence(venue, 75_000);
          if (m.success === true) leg.subsOk++;
          else if (m.success === false) leg.subsFailed++;
        }
        return;
      }
      onFrame(venue);
      armSilence(venue, 75_000);
      if (!m.topic.startsWith("allLiquidation") || !Array.isArray(m.data)) return;
      for (const d of m.data) {
        const qty = Number(d.v) || 0;
        const px = Number(d.p) || 0;
        const pair = String(d.s ?? "");
        const resolved = BINANCE_PAIR_TO_ASSET.get(pair) ?? resolveBybitAsset(pair);
        if (qty > 0 && px > 0 && resolved) {
          leg.events++;
          leg.lastEventAt = Date.now();
          ingest({ t: Number(d.T) || Date.now(), venue: "bybit", asset: resolved, pair, side: d.S === "Buy" ? "long" : "short", price: px, qtyBase: qty, usd: qty * px });
        }
      }
      return;
    }
    // okx
    const m = msg as { arg?: { channel?: string }; data?: { instId?: string; details?: { bkPx?: string; sz?: string; side?: string; posSide?: string; ts?: string }[] }[] };
    if (!m.data) return;
    onFrame(venue);
    armSilence(venue, 75_000);
    if (m.arg?.channel !== "liquidation-orders") return;
    for (const row of m.data) {
      const instId = String(row.instId ?? "");
      const asset = resolveOkxAsset(instId);
      for (const d of row.details ?? []) {
        const px = Number(d.bkPx) || 0;
        const sz = Number(d.sz) || 0;
        const ctVal = S.okxCtVal.get(instId);
        const qtyBase = ctVal != null ? sz * ctVal : null;
        if (px > 0 && sz > 0 && asset) {
          leg.events++;
          leg.lastEventAt = Date.now();
          ingest({
            t: Number(d.ts) || Date.now(),
            venue: "okx",
            asset,
            pair: instId,
            // posSide names the liquidated POSITION side; fallback: a sell
            // order closes a long
            side: d.posSide === "short" || (!d.posSide && d.side === "buy") ? "short" : "long",
            price: px,
            qtyBase,
            usd: qtyBase != null ? qtyBase * px : null,
          });
        }
      }
    }
  };

  ws.onerror = () => {
    /* close follows */
  };
  ws.onclose = () => {
    if (leg.ws === ws) scheduleReconnect(venue, "connection closed");
  };
}

/** bybit pair → asset through the resolved symbol map (reverse lookup) */
function resolveBybitAsset(pair: string): string | undefined {
  const S = col();
  for (const [asset, sym] of S.bybitSymbols) if (sym === pair) return asset;
  return undefined;
}

/** okx instId → asset (1000-forms + plain forms) */
function resolveOkxAsset(instId: string): string | undefined {
  if (!instId.endsWith("-USDT-SWAP")) return undefined;
  const base = instId.slice(0, -"-USDT-SWAP".length);
  const direct = TERMINAL_PERP_ASSETS.find((a) => a.sym === base);
  if (direct) return direct.sym;
  if (base.startsWith("1000")) {
    const stripped = base.slice(4);
    const hit = TERMINAL_PERP_ASSETS.find((a) => a.sym === stripped);
    if (hit) return hit.sym;
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// boot
// ---------------------------------------------------------------------------

async function loadVenueMaps() {
  const S = col();
  // Bybit instruments (linear) — resolve exact symbols for our assets
  try {
    const res = await fetch("https://api.bybit.com/v5/market/instruments-info?category=linear&limit=1000", {
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    const j = (await res.json()) as { retCode?: number; result?: { list?: { symbol?: string; baseCoin?: string; quoteCoin?: string; status?: string }[] } };
    const list = (j.result?.list ?? []).filter((x) => x.quoteCoin === "USDT" && x.status === "Trading");
    const byBase = new Map<string, string>();
    for (const x of list) if (x.baseCoin && x.symbol) byBase.set(x.baseCoin, x.symbol);
    for (const { sym } of TERMINAL_PERP_ASSETS) {
      const cands = BYBIT_CANDIDATES.get(sym) ?? [];
      // direct symbol hit first, then baseCoin forms (SHIB → SHIB1000USDT)
      let hit = cands.find((c) => list.some((x) => x.symbol === c));
      if (!hit) {
        const stripped = sym.startsWith("1000") ? sym.slice(4) : sym;
        const viaBase = byBase.get(sym) ?? byBase.get(stripped);
        if (viaBase) hit = viaBase;
      }
      if (hit) S.bybitSymbols.set(sym, hit);
    }
  } catch {
    // map stays empty → bybit leg subscribes nothing; telemetry shows subsOk=0
  }
  // OKX instruments (SWAP) — ctVal for USD notional conversion
  try {
    const res = await fetch("https://www.okx.com/api/v5/public/instruments?instType=SWAP", {
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    const j = (await res.json()) as { data?: { instId?: string; ctVal?: string; ctMult?: string }[] };
    for (const d of j.data ?? []) {
      if (d.instId) S.okxCtVal.set(d.instId, Number(d.ctVal) * (Number(d.ctMult) || 1));
    }
  } catch {
    // ctVal stays empty → okx events carry qtyBase/usd null (honest)
  }
}

/** boot the collector (idempotent — engine boot + API routes call this) */
export function ensureLiqCollector(): { started: boolean } {
  const S = col();
  if (S.booted) return { started: false };
  S.booted = true;
  S.bootAt = Date.now();
  void hydrate();
  void loadVenueMaps()
    .catch(() => undefined)
    .then(() => {
      // legs start once venue maps resolved (bybit symbols, okx ctVal)
      openLeg("binance");
      openLeg("bybit");
      openLeg("okx");
    });
  return { started: true };
}

// ---------------------------------------------------------------------------
// read model
// ---------------------------------------------------------------------------

function winStats(ring: LiqPrint[], sinceMs: number): LiqStatsWin {
  const out: LiqStatsWin = { count: 0, longs: 0, shorts: 0, usd: 0, largestUsd: null, lastAt: null };
  for (let i = ring.length - 1; i >= 0; i--) {
    const p = ring[i];
    if (p.t < sinceMs) break;
    out.count++;
    if (p.side === "long") out.longs++;
    else out.shorts++;
    if (p.usd != null) {
      out.usd += p.usd;
      if (p.usd > (out.largestUsd ?? 0)) out.largestUsd = p.usd;
    }
    if (out.lastAt == null) out.lastAt = p.t;
  }
  return out;
}

function venueTelemetry(): LiqVenueTelemetry[] {
  const S = col();
  return (["binance", "bybit", "okx"] as LiqVenue[]).map((v) => {
    const l = S.legs[v];
    return {
      venue: l.venue,
      status: l.status,
      connectedAt: l.connectedAt,
      lastFrameAt: l.lastFrameAt,
      lastEventAt: l.lastEventAt,
      frames: l.frames,
      events: l.events,
      reconnects: l.reconnects,
      lastError: l.lastError,
      subsOk: l.subsOk,
      subsFailed: l.subsFailed,
    };
  });
}

function freshness() {
  const S = col();
  const tel = venueTelemetry();
  const live = tel.filter((t) => t.status === "open");
  const lastEventAt = tel.reduce((m, t) => Math.max(m, t.lastEventAt ?? 0), 0);
  const dataAt = lastEventAt || S.bootAt;
  const anyOpen = live.length > 0;
  const allSilent = anyOpen && live.every((t) => t.lastFrameAt == null || Date.now() - t.lastFrameAt > 10 * 60_000);
  const stale = !anyOpen || allSilent;
  const quiet = !stale && Date.now() - lastEventAt > 15 * 60_000;
  return {
    dataAt,
    ageMs: Date.now() - dataAt,
    stale,
    quiet,
    source: `live WS ${tel.filter((t) => t.status === "open").map((t) => t.venue).join("+") || "none"} · per-asset journal data/cg-liq`,
    hydrated: S.hydrated,
  };
}

/** per-asset view for the API/UI */
export function liqAssetView(symRaw: string, limit = 60): LiqAssetView {
  const S = col();
  const sym = symRaw.trim().toUpperCase();
  if (!SUPPORTED_ASSETS.has(sym)) {
    return {
      sym,
      supported: false,
      reason: "no perpetual venue carries liquidation events for this instrument (cash-index CFDs are broker-internal)",
      events: [],
      stats1h: { count: 0, longs: 0, shorts: 0, usd: 0, largestUsd: null, lastAt: null },
      stats24h: { count: 0, longs: 0, shorts: 0, usd: 0, largestUsd: null, lastAt: null },
      venuesSeen: [],
    };
  }
  const ring = S.rings.get(sym) ?? [];
  const events = ring.slice(-Math.min(limit, 400)).reverse();
  const venuesSeen = [...new Set(ring.slice(-400).map((p) => p.venue))];
  return {
    sym,
    supported: true,
    events,
    stats1h: winStats(ring, Date.now() - 3600_000),
    stats24h: winStats(ring, Date.now() - HYDRATE_WINDOW_MS),
    venuesSeen,
  };
}

/** global cross-asset view for the API/UI */
export function liqGlobalView(limit = 80): LiqGlobalView {
  const S = col();
  const now = Date.now();
  const assets: LiqGlobalView["assets"] = [];
  let u1 = { count: 0, usd: 0, longs: 0, shorts: 0 };
  let u24 = { count: 0, usd: 0, longs: 0, shorts: 0 };
  for (const { sym } of TERMINAL_PERP_ASSETS) {
    const ring = S.rings.get(sym) ?? [];
    if (!ring.length) continue;
    const s1 = winStats(ring, now - 3600_000);
    const s24 = winStats(ring, now - HYDRATE_WINDOW_MS);
    assets.push({ sym, count1h: s1.count, count24h: s24.count, usd24h: +s24.usd.toFixed(0), lastAt: s24.lastAt });
    u1 = { count: u1.count + s1.count, usd: u1.usd + s1.usd, longs: u1.longs + s1.longs, shorts: u1.shorts + s1.shorts };
    u24 = { count: u24.count + s24.count, usd: u24.usd + s24.usd, longs: u24.longs + s24.longs, shorts: u24.shorts + s24.shorts };
  }
  assets.sort((a, b) => b.count24h - a.count24h || (b.lastAt ?? 0) - (a.lastAt ?? 0));
  return {
    tape: S.tape.slice(0, Math.min(limit, 400)),
    assets,
    universe1h: { count: u1.count, usd: +u1.usd.toFixed(0), longs: u1.longs, shorts: u1.shorts },
    universe24h: { count: u24.count, usd: +u24.usd.toFixed(0), longs: u24.longs, shorts: u24.shorts },
  };
}

/** full snapshot for the API route */
export function liqLiveSnapshot(opts?: { sym?: string; limit?: number; globalLimit?: number }) {
  const S = col();
  const fresh = freshness();
  const base = {
    ok: true as const,
    bootAt: S.bootAt,
    universeEventsStored: S.universeEvents,
    otherVenueEventsSeen: S.otherEvents,
    bybitSymbolsResolved: S.bybitSymbols.size,
    okxCtValLoaded: S.okxCtVal.size,
    venues: venueTelemetry(),
    ...fresh,
  };
  if (opts?.sym) {
    return { ...base, asset: liqAssetView(opts.sym, opts.limit ?? 60) };
  }
  return { ...base, global: liqGlobalView(opts?.globalLimit ?? 80) };
}
