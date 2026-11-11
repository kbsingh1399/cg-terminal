"use client";

import { useEffect, useState } from "react";

/**
 * Binance all-market mini-ticker feed — the REAL-TIME engine of the
 * top-200 markets grid.
 *
 * ONE WebSocket stream (`!miniTicker@arr` on fstream.binance.com) pushes a
 * batch of 24h rolling-window mini tickers for EVERY futures symbol every
 * 1000ms — the whole 200-asset grid updates at 1 Hz with zero server weight
 * and zero per-symbol subscriptions. This is the same venue the perp live
 * feed (src/lib/live/feed.ts) already uses, so geo/network behaviour is
 * identical.
 *
 * Fallback ladder: when the browser cannot hold the WS, the grid consumers
 * poll /api/binance/quotes (server REST, 5s) — the badge always names the
 * live tier. Manager patterns (singleton, refcount, backoff, watchdog)
 * mirror feed.ts.
 */

const WS_URL = "wss://fstream.binance.com/stream?streams=!miniTicker@arr";
const WATCHDOG_MS = 15_000;
const NOTIFY_THROTTLE_MS = 500;

export interface MiniT {
  last: number;
  open: number; // 24h rolling open → chg% = (last-open)/open
  high: number;
  low: number;
  quoteVol: number; // 24h quote volume (USD)
  at: number; // exchange event time
}

interface MiniState {
  ws: WebSocket | null;
  status: "idle" | "connecting" | "open" | "stale" | "closed";
  tickers: Map<string, MiniT>; // keyed by full pair, e.g. "BTCUSDT"
  lastMsgAt: number;
  backoffMs: number;
  watchdog: ReturnType<typeof setInterval> | null;
  reconnectTimer: ReturnType<typeof setTimeout> | null;
  wants: number;
  tick: number; // bumped on every applied batch
  listeners: Set<() => void>;
}

const g = globalThis as unknown as { __binMiniFeed?: MiniState };
const S: MiniState = (g.__binMiniFeed ??= {
  ws: null,
  status: "idle",
  tickers: new Map(),
  lastMsgAt: 0,
  backoffMs: 500,
  watchdog: null,
  reconnectTimer: null,
  wants: 0,
  tick: 0,
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

function setStatus(st: MiniState["status"]) {
  if (S.status === st) return;
  S.status = st;
  for (const fn of S.listeners) fn();
}

function openConnection() {
  if (typeof window === "undefined") return;
  if (S.ws && (S.ws.readyState === WebSocket.OPEN || S.ws.readyState === WebSocket.CONNECTING)) return;
  setStatus("connecting");
  let ws: WebSocket;
  try {
    ws = new WebSocket(WS_URL);
  } catch {
    scheduleReconnect();
    return;
  }
  S.ws = ws;
  ws.onopen = () => {
    S.backoffMs = 500;
    S.lastMsgAt = Date.now();
    setStatus("open");
  };
  ws.onmessage = (ev) => {
    S.lastMsgAt = Date.now();
    if (S.status !== "open") setStatus("open");
    let m: { data?: { s?: string; c?: string; o?: string; h?: string; l?: string; q?: string; E?: number }[] };
    try {
      m = JSON.parse(ev.data as string);
    } catch {
      return;
    }
    const arr = m.data;
    if (!Array.isArray(arr) || arr.length === 0) return;
    for (const e of arr) {
      if (!e?.s) continue;
      const last = Number(e.c);
      if (!Number.isFinite(last) || last <= 0) continue;
      S.tickers.set(e.s, {
        last,
        open: Number(e.o) || 0,
        high: Number(e.h) || 0,
        low: Number(e.l) || 0,
        quoteVol: Number(e.q) || 0,
        at: Number(e.E) || Date.now(),
      });
    }
    notify();
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
  if (!S.wants) return; // nobody listening — stay down
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

/** Sync read of the freshest mini ticker for a full pair (e.g. "BTCUSDT"). */
export function getMini(pair: string): MiniT | null {
  return S.tickers.get(pair) ?? null;
}

let teardownTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * React binding — re-renders the caller on every applied batch (≤2 Hz) and
 * on status changes. Read values via getMini(pair) during render.
 */
export function useMiniFeed(): { status: MiniState["status"]; tick: number } {
  const [, force] = useState(0);
  useEffect(() => {
    const bump = () => force((x) => x + 1);
    S.listeners.add(bump);
    S.wants++;
    if (teardownTimer) {
      clearTimeout(teardownTimer);
      teardownTimer = null;
    }
    startWatchdog();
    if (!S.ws && !S.reconnectTimer) openConnection();
    return () => {
      S.listeners.delete(bump);
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
          setStatus("idle");
        }, 3_000);
      }
    };
  }, []);
  return { status: S.status, tick: S.tick };
}
