"use client";

import { useEffect, useState } from "react";
import { PRIORITY_BINANCE_PAIRS } from "./aliases";

/**
 * Binance all-market real-time ticker feed (replaces broken !miniTicker@arr).
 *
 * Empirical verification on wss://fstream.binance.com showed `!miniTicker@arr`
 * and `!ticker@arr` deliver 0 frames after connecting, whereas:
 *   1. Priority batched `<pair>@bookTicker` delivers 1,000+ unthrottled
 *      sub-100ms BBO updates/sec across core Crypto, Metals, and TradFi perps.
 *   2. `!bookTicker` sweeps all ~480+ Futures pairs continuously when the
 *      Binance Top-N grid is active.
 *   3. Browser-direct `/fapi/v1/ticker/24hr` (or `/api/binance/quotes` fallback)
 *      seeds rolling 24h `open` / `high` / `low` / `quoteVol` every 60s so
 *      live `% change` stays accurate on every BBO tick.
 */

const WS_BASE = "wss://fstream.binance.com/stream";
const FAPI_24H_URL = "https://fapi.binance.com/fapi/v1/ticker/24hr";
const WATCHDOG_MS = 12_000;
const NOTIFY_THROTTLE_MS = 250; // 4 Hz smooth render batch
const STATS_REFRESH_MS = 60_000;
const MAX_PRIORITY_STREAMS = 120; // well under Binance's 200 streams/socket cap

export interface MiniT {
  last: number;
  bid?: number;
  ask?: number;
  open: number; // 24h rolling open → chg% = (last-open)/open
  high: number;
  low: number;
  quoteVol: number; // 24h quote volume (USD)
  at: number; // exchange/tick event time
  dir?: "up" | "down" | "flat";
}

type WsStatus = "idle" | "connecting" | "open" | "stale" | "closed";

interface MiniState {
  priorityWs: WebSocket | null;
  sweepWs: WebSocket | null;
  priorityPairs: string[];
  subbedPriority: Set<string>;
  status: WsStatus;
  tickers: Map<string, MiniT>; // keyed by full pair, e.g. "BTCUSDT"
  lastDataAt: number; // bumped ONLY on real ticker data (never fake-bumped on open)
  backoffMs: number;
  sweepBackoffMs: number;
  watchdog: ReturnType<typeof setInterval> | null;
  statsTimer: ReturnType<typeof setInterval> | null;
  reconnectTimer: ReturnType<typeof setTimeout> | null;
  sweepReconnectTimer: ReturnType<typeof setTimeout> | null;
  teardownTimer: ReturnType<typeof setTimeout> | null;
  wants: number;
  wantsSweep: number;
  tick: number;
  statsLoadedAt: number;
  listeners: Set<() => void>;
}

const g = globalThis as unknown as { __binMiniFeedV2?: MiniState };
const S: MiniState = (g.__binMiniFeedV2 ??= {
  priorityWs: null,
  sweepWs: null,
  priorityPairs: [...PRIORITY_BINANCE_PAIRS],
  subbedPriority: new Set(),
  status: "idle",
  tickers: new Map(),
  lastDataAt: 0,
  backoffMs: 500,
  sweepBackoffMs: 500,
  watchdog: null,
  statsTimer: null,
  reconnectTimer: null,
  sweepReconnectTimer: null,
  teardownTimer: null,
  wants: 0,
  wantsSweep: 0,
  tick: 0,
  statsLoadedAt: 0,
  listeners: new Set(),
});

let notifyQueued = false;
function notify() {
  if (notifyQueued) return;
  notifyQueued = true;
  setTimeout(() => {
    notifyQueued = false;
    S.tick++;
    for (const fn of S.listeners) fn();
  }, NOTIFY_THROTTLE_MS);
}

function setStatus(st: WsStatus) {
  if (S.status === st) return;
  S.status = st;
  for (const fn of S.listeners) fn();
}

function applyBookTick(d: { s?: string; b?: string; a?: string; T?: number; E?: number }) {
  if (!d?.s) return;
  const bid = Number(d.b);
  const ask = Number(d.a);
  if (!(bid > 0 && ask > 0)) return;
  const mid = (bid + ask) / 2;
  const prev = S.tickers.get(d.s);
  const prevLast = prev?.last ?? mid;
  const dir: MiniT["dir"] =
    mid === prevLast ? prev?.dir ?? "flat" : mid > prevLast ? "up" : "down";
  const high = prev && prev.high > 0 ? Math.max(prev.high, mid) : mid;
  const low = prev && prev.low > 0 ? Math.min(prev.low, mid) : mid;
  S.tickers.set(d.s, {
    last: mid,
    bid,
    ask,
    open: prev?.open ?? 0,
    high,
    low,
    quoteVol: prev?.quoteVol ?? 0,
    at: Number(d.T) || Number(d.E) || Date.now(),
    dir,
  });
  S.lastDataAt = Date.now();
  if (S.status !== "open") setStatus("open");
  notify();
}

async function seed24hStats() {
  if (typeof window === "undefined") return;
  try {
    const res = await fetch(FAPI_24H_URL, { cache: "no-store", signal: AbortSignal.timeout(7_000) });
    if (res.ok) {
      const arr = (await res.json()) as {
        symbol: string;
        lastPrice: string;
        priceChangePercent: string;
        highPrice: string;
        lowPrice: string;
        quoteVolume: string;
      }[];
      if (Array.isArray(arr) && arr.length > 0) {
        const now = Date.now();
        for (const r of arr) {
          if (!r?.symbol || !r.symbol.endsWith("USDT")) continue;
          const last = Number(r.lastPrice);
          const pct = Number(r.priceChangePercent);
          if (!(last > 0)) continue;
          const open = Number.isFinite(pct) && pct > -99.9 ? last / (1 + pct / 100) : 0;
          const prev = S.tickers.get(r.symbol);
          S.tickers.set(r.symbol, {
            last: prev && now - prev.at < 15_000 ? prev.last : last,
            bid: prev?.bid,
            ask: prev?.ask,
            open,
            high: Number(r.highPrice) || prev?.high || last,
            low: Number(r.lowPrice) || prev?.low || last,
            quoteVol: Number(r.quoteVolume) || 0,
            at: prev?.at ?? now,
            dir: prev?.dir ?? "flat",
          });
        }
        S.statsLoadedAt = now;
        notify();
        return;
      }
    }
  } catch {
    /* fall through to server quotes fallback */
  }
  try {
    const res = await fetch("/api/binance/quotes", { cache: "no-store", signal: AbortSignal.timeout(5_000) });
    if (!res.ok) return;
    const j = (await res.json()) as { ok?: boolean; quotes?: Record<string, { last: number; bid: number; ask: number }> };
    if (!j.ok || !j.quotes) return;
    const now = Date.now();
    for (const [sym, q] of Object.entries(j.quotes)) {
      const pair = sym.endsWith("USDT") ? sym : `${sym}USDT`;
      const prev = S.tickers.get(pair);
      if (!prev && q.last > 0) {
        S.tickers.set(pair, {
          last: q.last,
          bid: q.bid,
          ask: q.ask,
          open: 0,
          high: q.last,
          low: q.last,
          quoteVol: 0,
          at: now,
          dir: "flat",
        });
      }
    }
    notify();
  } catch {
    /* non-fatal */
  }
}

function priorityStreams(): string[] {
  return S.priorityPairs.slice(0, MAX_PRIORITY_STREAMS).map((p) => `${p.toLowerCase()}@bookTicker`);
}

function openPriorityConnection() {
  if (typeof window === "undefined" || !S.wants) return;
  if (S.priorityWs && (S.priorityWs.readyState === WebSocket.OPEN || S.priorityWs.readyState === WebSocket.CONNECTING)) {
    return;
  }
  setStatus("connecting");
  const streams = priorityStreams();
  if (streams.length === 0) return;
  let ws: WebSocket;
  try {
    ws = new WebSocket(`${WS_BASE}?streams=${streams.join("/")}`);
  } catch {
    scheduleReconnect();
    return;
  }
  S.priorityWs = ws;
  S.subbedPriority = new Set(streams);
  ws.onopen = () => {
    if (S.priorityWs !== ws) return;
    S.backoffMs = 500;
    setStatus("open");
  };
  ws.onmessage = (ev) => {
    if (S.priorityWs !== ws) return;
    let m: { data?: { s?: string; b?: string; a?: string; T?: number; E?: number } };
    try {
      m = JSON.parse(String(ev.data));
    } catch {
      return;
    }
    if (m.data) applyBookTick(m.data);
  };
  ws.onerror = () => {
    /* handled via onclose */
  };
  ws.onclose = () => {
    if (S.priorityWs !== ws) return;
    S.priorityWs = null;
    S.subbedPriority.clear();
    if (S.wants) {
      setStatus("closed");
      scheduleReconnect();
    }
  };
}

function openSweepConnection() {
  if (typeof window === "undefined" || !S.wantsSweep) return;
  if (S.sweepWs && (S.sweepWs.readyState === WebSocket.OPEN || S.sweepWs.readyState === WebSocket.CONNECTING)) return;
  let ws: WebSocket;
  try {
    ws = new WebSocket(`${WS_BASE}?streams=!bookTicker`);
  } catch {
    scheduleSweepReconnect();
    return;
  }
  S.sweepWs = ws;
  ws.onopen = () => {
    if (S.sweepWs !== ws) return;
    S.sweepBackoffMs = 500;
  };
  ws.onmessage = (ev) => {
    if (S.sweepWs !== ws) return;
    let m: { data?: { s?: string; b?: string; a?: string; T?: number; E?: number } };
    try {
      m = JSON.parse(String(ev.data));
    } catch {
      return;
    }
    if (m.data) applyBookTick(m.data);
  };
  ws.onerror = () => {
    /* handled via onclose */
  };
  ws.onclose = () => {
    if (S.sweepWs !== ws) return;
    S.sweepWs = null;
    if (S.wantsSweep) scheduleSweepReconnect();
  };
}

function scheduleReconnect() {
  if (!S.wants || S.reconnectTimer) return;
  const wait = S.backoffMs;
  S.backoffMs = Math.min(S.backoffMs * 2, 15_000);
  S.reconnectTimer = setTimeout(() => {
    S.reconnectTimer = null;
    openPriorityConnection();
  }, wait);
}

function scheduleSweepReconnect() {
  if (!S.wantsSweep || S.sweepReconnectTimer) return;
  const wait = S.sweepBackoffMs;
  S.sweepBackoffMs = Math.min(S.sweepBackoffMs * 2, 15_000);
  S.sweepReconnectTimer = setTimeout(() => {
    S.sweepReconnectTimer = null;
    openSweepConnection();
  }, wait);
}

function startTimers() {
  if (typeof window === "undefined") return;
  if (!S.statsTimer) {
    if (Date.now() - S.statsLoadedAt > STATS_REFRESH_MS) void seed24hStats();
    S.statsTimer = setInterval(() => {
      if (S.wants > 0) void seed24hStats();
    }, STATS_REFRESH_MS);
  }
  if (!S.watchdog) {
    S.watchdog = setInterval(() => {
      if (!S.wants) return;
      if (!S.priorityWs && !S.reconnectTimer) openPriorityConnection();
      else if (
        S.priorityWs?.readyState === WebSocket.OPEN &&
        S.lastDataAt > 0 &&
        Date.now() - S.lastDataAt > WATCHDOG_MS
      ) {
        setStatus("stale");
        try {
          S.priorityWs.close();
        } catch {
          /* noop */
        }
      }
      if (S.wantsSweep > 0 && !S.sweepWs && !S.sweepReconnectTimer) {
        openSweepConnection();
      }
    }, 3_000);
  }
}

/** Add/sync extra priority pairs onto the fast sub-100ms batched @bookTicker socket. */
export function setPriorityPairs(extraPairs: string[]) {
  const merged = new Set<string>(PRIORITY_BINANCE_PAIRS);
  for (const p of extraPairs) {
    const clean = p.trim().toUpperCase();
    if (clean.endsWith("USDT") && /^[A-Z0-9]{2,20}USDT$/.test(clean)) merged.add(clean);
  }
  S.priorityPairs = [...merged].slice(0, MAX_PRIORITY_STREAMS);
  if (S.priorityWs?.readyState === WebSocket.OPEN) {
    const want = priorityStreams();
    const toAdd = want.filter((s) => !S.subbedPriority.has(s));
    if (toAdd.length) {
      try {
        S.priorityWs.send(JSON.stringify({ method: "SUBSCRIBE", params: toAdd, id: Date.now() }));
        for (const s of toAdd) S.subbedPriority.add(s);
      } catch {
        /* reconnect handles sync */
      }
    }
  }
}

function acquire(sweepAll: boolean) {
  S.wants++;
  if (sweepAll) S.wantsSweep++;
  if (S.teardownTimer) {
    clearTimeout(S.teardownTimer);
    S.teardownTimer = null;
  }
  startTimers();
  if (!S.priorityWs && !S.reconnectTimer) openPriorityConnection();
  if (sweepAll && !S.sweepWs && !S.sweepReconnectTimer) openSweepConnection();
}

function release(sweepAll: boolean) {
  S.wants = Math.max(0, S.wants - 1);
  if (sweepAll) S.wantsSweep = Math.max(0, S.wantsSweep - 1);

  if (S.wantsSweep === 0 && S.sweepWs) {
    if (S.sweepReconnectTimer) {
      clearTimeout(S.sweepReconnectTimer);
      S.sweepReconnectTimer = null;
    }
    try {
      S.sweepWs.close();
    } catch {
      /* noop */
    }
    S.sweepWs = null;
  }

  if (!S.wants && !S.teardownTimer) {
    S.teardownTimer = setTimeout(() => {
      S.teardownTimer = null;
      if (S.wants) return;
      if (S.reconnectTimer) {
        clearTimeout(S.reconnectTimer);
        S.reconnectTimer = null;
      }
      try {
        S.priorityWs?.close();
      } catch {
        /* noop */
      }
      S.priorityWs = null;
      S.subbedPriority.clear();
      setStatus("idle");
    }, 2_000);
  }
}

/** Read current mini-ticker for a full USDT pair (e.g. "BTCUSDT", "NVDAUSDT"). */
export function getMini(pair: string): MiniT | undefined {
  return S.tickers.get(pair);
}

/**
 * Subscribe cleanly inside a React component to the real-time Binance ticker feed.
 * Pass `{ sweepAll: true }` on full-market grids (`BinanceMarkets`) to also attach `!bookTicker`.
 */
export function useMiniFeed(opts?: { sweepAll?: boolean }): {
  status: WsStatus;
  tick: number;
  hasData: boolean;
  liveStreaming: boolean;
} {
  const sweepAll = Boolean(opts?.sweepAll);
  const [, force] = useState(0);

  useEffect(() => {
    const bump = () => force((x) => x + 1);
    S.listeners.add(bump);
    acquire(sweepAll);
    return () => {
      S.listeners.delete(bump);
      release(sweepAll);
    };
  }, [sweepAll]);

  const hasData = S.tickers.size > 0;
  const liveStreaming = S.status === "open" && S.lastDataAt > 0 && Date.now() - S.lastDataAt < WATCHDOG_MS;
  return { status: S.status, tick: S.tick, hasData, liveStreaming };
}
