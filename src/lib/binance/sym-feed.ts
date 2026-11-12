"use client";

import { useEffect, useRef, useState } from "react";
import { resolveBinPair } from "./aliases";

/**
 * Binance per-symbol real-time feed — the "all levels" engine of the
 * Binance-tier symbol view.
 *
 * ONE WebSocket to fstream.binance.com carries, for the active symbol's
 * full pair:
 *   - <pair>@depth20@100ms  → partial book depth (20 levels/side, push
 *                             snapshots — no REST sync needed) = true L2
 *   - <pair>@kline_<iv>     → the live forming candle (updates on every
 *                             trade, `x:true` when it closes)
 *   - <pair>@forceOrder     → liquidation prints (order-flow context)
 *
 * Live SUBSCRIBE/UNSUBSCRIBE on symbol/interval switch, exponential
 * backoff, 15s staleness watchdog, refcounted teardown — all manager
 * patterns mirror src/lib/live/feed.ts. Consumers subscribe per kind
 * (depth / bar / liquidations) so a 10 Hz book never re-renders the chart
 * and a rare liquidation never re-renders the ladder.
 */

const WS_URL = "wss://fstream.binance.com/stream";
const WATCHDOG_MS = 15_000;
const DEPTH_THROTTLE_MS = 100; // depth pushes @100ms → render at 10 Hz max

export interface DepthL2 {
  bids: [number, number][]; // [price, qty] — best first
  asks: [number, number][];
  at: number;
}

export interface LiveBar {
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
  final: boolean;
}

export interface LiqEvent {
  side: "long" | "short"; // which side got liquidated
  qty: number;
  price: number;
  at: number;
  pair: string;
}

type Status = "idle" | "connecting" | "open" | "stale" | "closed";

interface SymState {
  ws: WebSocket | null;
  status: Status;
  activeSym: string | null; // base asset, e.g. "1000PEPE"
  activeIv: string | null;
  streams: Set<string>;
  depth: DepthL2 | null;
  bar: LiveBar | null;
  liqs: LiqEvent[];
  lastMsgAt: number;
  backoffMs: number;
  watchdog: ReturnType<typeof setInterval> | null;
  reconnectTimer: ReturnType<typeof setTimeout> | null;
  wants: number;
  depthListeners: Set<() => void>;
  barListeners: Set<(b: LiveBar) => void>;
  liqListeners: Set<() => void>;
}

const g = globalThis as unknown as { __binSymFeed?: SymState };
const S: SymState = (g.__binSymFeed ??= {
  ws: null,
  status: "idle",
  activeSym: null,
  activeIv: null,
  streams: new Set(),
  depth: null,
  bar: null,
  liqs: [],
  lastMsgAt: 0,
  backoffMs: 500,
  watchdog: null,
  reconnectTimer: null,
  wants: 0,
  depthListeners: new Set(),
  barListeners: new Set(),
  liqListeners: new Set(),
});

let depthNotifyQueued = false;
function notifyDepth() {
  if (depthNotifyQueued) return;
  depthNotifyQueued = true;
  setTimeout(() => {
    depthNotifyQueued = false;
    for (const fn of S.depthListeners) fn();
  }, DEPTH_THROTTLE_MS);
}

function setStatus(st: Status) {
  if (S.status === st) return;
  S.status = st;
  for (const fn of S.depthListeners) fn();
  for (const fn of S.liqListeners) fn();
}

function streamsOf(sym: string, iv: string): string[] {
  const p = resolveBinPair(sym).toLowerCase();
  return [`${p}@depth20@100ms`, `${p}@kline_${iv}`, `${p}@forceOrder`];
}

function applyFrame(d: Record<string, unknown>) {
  S.lastMsgAt = Date.now();
  if (S.status !== "open") setStatus("open");
  // partial book depth (futures payload: b / a arrays of [price, qty])
  if (Array.isArray(d.b) && Array.isArray(d.a)) {
    const bids: [number, number][] = [];
    for (const r of d.b as string[][]) {
      const p = Number(r[0]);
      const q = Number(r[1]);
      if (p > 0 && q > 0) bids.push([p, q]);
    }
    const asks: [number, number][] = [];
    for (const r of d.a as string[][]) {
      const p = Number(r[0]);
      const q = Number(r[1]);
      if (p > 0 && q > 0) asks.push([p, q]);
    }
    if (bids.length && asks.length) {
      S.depth = { bids, asks, at: Number(d.T) || Number(d.E) || Date.now() };
      notifyDepth();
    }
    return;
  }
  const e = d.e as string | undefined;
  if (e === "kline" && d.k && typeof d.k === "object") {
    const k = d.k as Record<string, string | number | boolean>;
    const t = Number(k.t);
    const c = Number(k.c);
    if (Number.isFinite(t) && Number.isFinite(c)) {
      S.bar = {
        t,
        o: Number(k.o) || c,
        h: Number(k.h) || c,
        l: Number(k.l) || c,
        c,
        v: Number(k.v) || 0,
        final: k.x === true,
      };
      for (const fn of S.barListeners) {
        try {
          fn(S.bar);
        } catch {
          /* listener errors must never break the stream */
        }
      }
    }
    return;
  }
  if (e === "forceOrder" && d.o && typeof d.o === "object") {
    const o = d.o as Record<string, string>;
    const qty = Number(o.q);
    const price = Number(o.ap) || Number(o.p);
    if (qty > 0 && price > 0) {
      const ev: LiqEvent = {
        side: o.S === "SELL" ? "long" : "short", // SELL order = a LONG position was force-closed
        qty,
        price,
        at: Number(o.T) || Date.now(),
        pair: String(o.s ?? ""),
      };
      S.liqs = [ev, ...S.liqs].slice(0, 30);
      for (const fn of S.liqListeners) fn();
    }
  }
}

function openConnection() {
  if (typeof window === "undefined") return;
  if (S.ws && (S.ws.readyState === WebSocket.OPEN || S.ws.readyState === WebSocket.CONNECTING)) return;
  if (!S.activeSym || !S.activeIv) return;
  setStatus("connecting");
  const streams = streamsOf(S.activeSym, S.activeIv);
  let ws: WebSocket;
  try {
    ws = new WebSocket(`${WS_URL}?streams=${streams.join("/")}`);
  } catch {
    scheduleReconnect();
    return;
  }
  S.ws = ws;
  S.streams = new Set(streams);
  ws.onopen = () => {
    S.backoffMs = 500;
    S.lastMsgAt = Date.now();
    setStatus("open");
  };
  ws.onmessage = (ev) => {
    let m: { stream?: string; data?: Record<string, unknown> };
    try {
      m = JSON.parse(ev.data as string);
    } catch {
      return;
    }
    if (m.data) applyFrame(m.data);
  };
  ws.onerror = () => {
    /* handled via onclose */
  };
  ws.onclose = () => {
    if (S.ws !== ws) return;
    S.ws = null;
    setStatus("closed");
    scheduleReconnect();
  };
}

function scheduleReconnect() {
  if (!S.wants || !S.activeSym) return;
  if (S.reconnectTimer) return;
  const wait = S.backoffMs;
  S.backoffMs = Math.min(S.backoffMs * 2, 15_000);
  S.reconnectTimer = setTimeout(() => {
    S.reconnectTimer = null;
    openConnection();
  }, wait);
}

function startWatchdog() {
  if (S.watchdog || typeof window === "undefined") return;
  S.watchdog = setInterval(() => {
    if (!S.wants) return;
    if (!S.ws && !S.reconnectTimer) openConnection();
    else if (S.ws?.readyState === WebSocket.OPEN && Date.now() - S.lastMsgAt > WATCHDOG_MS) {
      setStatus("stale");
      try {
        S.ws.close();
      } catch {
        /* noop */
      }
    }
  }, 3_000);
}

function setActive(sym: string, iv: string) {
  if (S.activeSym === sym && S.activeIv === iv && S.streams.size > 0) return;
  const prevSym = S.activeSym;
  const prevIv = S.activeIv;
  S.activeSym = sym;
  S.activeIv = iv;
  S.depth = null;
  S.bar = null;
  S.liqs = [];
  if (!S.ws || S.ws.readyState !== WebSocket.OPEN) {
    if (S.ws && S.ws.readyState === WebSocket.CONNECTING && prevSym !== sym) {
      try {
        S.ws.close();
      } catch {
        /* noop */
      }
      S.ws = null;
    }
    openConnection();
    return;
  }
  const want = streamsOf(sym, iv);
  const msg = (method: string, params: string[]) =>
    S.ws?.readyState === WebSocket.OPEN ? S.ws.send(JSON.stringify({ method, params, id: Date.now() })) : undefined;
  if (prevSym && prevIv) {
    const off = streamsOf(prevSym, prevIv).filter((s) => !want.includes(s));
    if (off.length) {
      msg("UNSUBSCRIBE", off);
      for (const s of off) S.streams.delete(s);
    }
  }
  const on = want.filter((s) => !S.streams.has(s));
  if (on.length) {
    msg("SUBSCRIBE", on);
    for (const s of on) S.streams.add(s);
  }
  S.lastMsgAt = Date.now();
}

let teardownTimer: ReturnType<typeof setTimeout> | null = null;

function acquire() {
  S.wants++;
  if (teardownTimer) {
    clearTimeout(teardownTimer);
    teardownTimer = null;
  }
  startWatchdog();
  if (S.activeSym && !S.ws && !S.reconnectTimer) openConnection();
}

function release() {
  S.wants = Math.max(0, S.wants - 1);
  if (!S.wants && !teardownTimer) {
    teardownTimer = setTimeout(() => {
      teardownTimer = null;
      if (S.wants) return;
      if (S.reconnectTimer) {
        clearTimeout(S.reconnectTimer);
        S.reconnectTimer = null;
      }
      try {
        S.ws?.close();
      } catch {
        /* noop */
      }
      S.ws = null;
      S.activeSym = null;
      S.activeIv = null;
      S.streams.clear();
      setStatus("idle");
    }, 1_500);
  }
}

/** Live 20-level depth ladder for the active symbol (≤10 Hz re-render). */
export function useDepth20(sym: string): { depth: DepthL2 | null; status: Status } {
  const [, force] = useState(0);
  useEffect(() => {
    const bump = () => force((x) => x + 1);
    S.depthListeners.add(bump);
    acquire();
    setActive(sym, S.activeIv ?? "15m");
    return () => {
      S.depthListeners.delete(bump);
      release();
    };
  }, [sym]);
  const mine = S.depth; // only the active symbol's book is ever stored
  return { depth: mine, status: S.status };
}

/** Live forming candle for (sym, interval) — callback per kline push. */
export function useLiveBar(sym: string, interval: string, onBar: (b: LiveBar) => void) {
  const ref = useRef(onBar);
  useEffect(() => {
    ref.current = onBar;
  }, [onBar]);
  useEffect(() => {
    const fn = (b: LiveBar) => {
      if (S.activeSym === sym && S.activeIv === interval) ref.current(b);
    };
    S.barListeners.add(fn);
    acquire();
    setActive(sym, interval);
    return () => {
      S.barListeners.delete(fn);
      release();
    };
  }, [sym, interval]);
}

/** Recent liquidation prints for the active symbol (forceOrder stream). */
export function useLiquidations(sym: string): { liqs: LiqEvent[]; status: Status } {
  const [, force] = useState(0);
  useEffect(() => {
    const bump = () => force((x) => x + 1);
    S.liqListeners.add(bump);
    acquire();
    setActive(sym, S.activeIv ?? "15m");
    return () => {
      S.liqListeners.delete(bump);
      release();
    };
  }, [sym]);
  return { liqs: S.liqs, status: S.status };
}
