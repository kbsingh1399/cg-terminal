"use client";

/**
 * REAL-TIME live feed — Binance USDT-M futures WebSocket, straight from the
 * browser (wss://fstream.binance.com), the same venue that leads every
 * Coinglass aggregate of this terminal.
 *
 * Streams per active asset (all 12 assets incl. XAU/XAG verified listed):
 *  - <sym>usdt@bookTicker → best bid/ask, real-time (updates on every book change)
 *  - <sym>usdt@trade      → every executed trade (taker side, price, qty)
 *    (the raw @trade stream — the aggregated @aggTrade stream stopped
 *    delivering on fstream, @trade carries the identical fields)
 *
 * The manager is a module singleton: ONE connection for the whole page,
 * live SUBSCRIBE/UNSUBSCRIBE on symbol switch (no reconnect churn),
 * exponential-backoff reconnect, a staleness watchdog (5 s without a
 * message → reconnect), and 10 Hz throttled React notifications so 700
 * msg/s of tape can never jank the UI while still being real-time.
 *
 * Fallback ladder (when the browser cannot reach Binance directly, e.g.
 * geo-blocked network): the consumers fall back to /api/cg/live (server-side
 * 250 ms REST) and then to /api/cg/ticker (Coinglass, 3 s) — the UI badge
 * always shows which tier is live.
 */

const WS_URL = "wss://fstream.binance.com/stream";
const WATCHDOG_MS = 5_000;
const NOTIFY_THROTTLE_MS = 100; // 10 Hz — real-time for the human eye

export interface LiveQuote {
  sym: string;
  bid: number;
  ask: number;
  mid: number;
  bidQty: number;
  askQty: number;
  t: number; // exchange event time
}

export interface LiveTrade {
  sym: string;
  p: number; // price
  q: number; // base qty
  buy: boolean; // true = buyer is the taker (aggressive buy)
  t: number; // trade time
}

interface FeedState {
  ws: WebSocket | null;
  status: "idle" | "connecting" | "open" | "stale" | "closed";
  activeSym: string | null;
  /** stream names the current socket is actually subscribed to */
  streams: Set<string>;
  quote: LiveQuote | null;
  lastTrade: LiveTrade | null; // last printed trade (the exchange "last price")
  quoteListeners: Set<() => void>;
  tradeListeners: Set<(tr: LiveTrade) => void>;
  lastMsgAt: number;
  backoffMs: number;
  watchdog: ReturnType<typeof setInterval> | null;
  reconnectTimer: ReturnType<typeof setTimeout> | null;
  wants: number; // refcount of useLiveQuote hooks
}

const g = globalThis as unknown as { __liveFeed?: FeedState };
const S: FeedState = (g.__liveFeed ??= {
  ws: null,
  status: "idle",
  activeSym: null,
  streams: new Set(),
  quote: null,
  lastTrade: null,
  quoteListeners: new Set(),
  tradeListeners: new Set(),
  lastMsgAt: 0,
  backoffMs: 500,
  watchdog: null,
  reconnectTimer: null,
  wants: 0,
});

let notifyQueued = false;
function notifyQuote() {
  if (notifyQueued) return;
  notifyQueued = true;
  setTimeout(() => {
    notifyQueued = false;
    for (const fn of S.quoteListeners) fn();
  }, NOTIFY_THROTTLE_MS);
}

function setStatus(st: FeedState["status"]) {
  S.status = st;
  // status changes are rare — notify immediately so the badge flips fast
  for (const fn of S.quoteListeners) fn();
}

function streamsOf(sym: string): string[] {
  // Binance stream names are the FULL pair, lowercase: btcusdt@bookTicker
  const s = `${sym.toLowerCase()}usdt`;
  return [`${s}@bookTicker`, `${s}@trade`];
}

function openConnection() {
  if (typeof window === "undefined") return; // SSR guard
  if (S.ws && (S.ws.readyState === WebSocket.OPEN || S.ws.readyState === WebSocket.CONNECTING)) return;
  const sym = S.activeSym;
  if (!sym) return;
  setStatus(S.status === "stale" ? "stale" : "connecting");
  let ws: WebSocket;
  try {
    ws = new WebSocket(`${WS_URL}?streams=${streamsOf(sym).join("/")}`);
  } catch {
    scheduleReconnect();
    return;
  }
  S.ws = ws;
  S.streams = new Set(streamsOf(sym));

  ws.onopen = () => {
    S.backoffMs = 500;
    S.lastMsgAt = Date.now();
    setStatus("open");
  };
  ws.onmessage = (ev) => {
    S.lastMsgAt = Date.now();
    if (S.status === "stale" || S.status === "connecting") setStatus("open");
    let m: { stream?: string; data?: Record<string, unknown> };
    try {
      m = JSON.parse(ev.data as string);
    } catch {
      return;
    }
    const d = m.data;
    if (!d) return;
    if (d.e === "bookTicker") {
      S.quote = {
        sym: String(d.s).replace(/USDT$/, ""),
        bid: Number(d.b),
        ask: Number(d.a),
        mid: (Number(d.b) + Number(d.a)) / 2,
        bidQty: Number(d.B),
        askQty: Number(d.A),
        t: Number(d.T) || Date.now(),
      };
      notifyQuote();
    } else if (d.e === "trade") {
      const tr: LiveTrade = {
        sym: String(d.s).replace(/USDT$/, ""),
        p: Number(d.p),
        q: Number(d.q),
        buy: d.m === false, // m=true → buyer is maker → taker sold
        t: Number(d.T) || Date.now(),
      };
      S.lastTrade = tr;
      for (const fn of S.tradeListeners) {
        try {
          fn(tr);
        } catch {
          /* listener errors must never break the tape */
        }
      }
    }
  };
  ws.onerror = () => {
    /* handled via onclose */
  };
  ws.onclose = () => {
    if (S.ws !== ws) return; // superseded by a newer socket — its close must not clobber state
    S.ws = null;
    setStatus("closed");
    scheduleReconnect();
  };
}

function scheduleReconnect() {
  if (!S.wants || !S.activeSym) return; // nobody listening — stay down
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
      // frozen stream (rare): force a reconnect
      setStatus("stale");
      try {
        S.ws.close();
      } catch {
        /* noop */
      }
    }
  }, 2_000);
}

/** switch the single connection to a new symbol (live SUBSCRIBE/UNSUBSCRIBE) */
function setActiveSym(sym: string) {
  const want = streamsOf(sym);
  const carries = want.every((s) => S.streams.has(s));
  if (S.activeSym === sym && carries) return; // already flowing for this sym
  const prev = S.activeSym;
  S.activeSym = sym;
  S.quote = null; // never show the previous symbol's price under the new one
  S.lastTrade = null;
  if (!S.ws || S.ws.readyState !== WebSocket.OPEN) {
    // a CONNECTING socket may still be carrying the PREVIOUS symbol's
    // streams — replace it so the new symbol actually gets subscribed
    if (S.ws && S.ws.readyState === WebSocket.CONNECTING && !carries) {
      try {
        S.ws.close();
      } catch {
        /* noop */
      }
      S.ws = null;
    }
    openConnection(); // (re)connect with the new streams
    return;
  }
  const msg = (method: string, params: string[]) =>
    S.ws?.readyState === WebSocket.OPEN ? S.ws.send(JSON.stringify({ method, params, id: Date.now() })) : undefined;
  if (prev) {
    const off = streamsOf(prev).filter((s) => !want.includes(s));
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
    // re-acquired inside the grace window — keep the connection alive
    clearTimeout(teardownTimer);
    teardownTimer = null;
  }
  startWatchdog();
  if (S.activeSym) {
    if (!S.ws && !S.reconnectTimer) openConnection();
  }
}
function release() {
  S.wants = Math.max(0, S.wants - 1);
  if (!S.wants && !teardownTimer) {
    // grace window: a symbol switch unmounts+remounts the consumer in one
    // commit — tearing down immediately would needlessly reconnect
    teardownTimer = setTimeout(() => {
      teardownTimer = null;
      if (S.wants) return; // re-acquired
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
    }, 1_500);
  }
}

// ---------------------------------------------------------------------------
// React bindings
// ---------------------------------------------------------------------------

import { useEffect, useRef, useState } from "react";

/** Real-time quote for the active symbol (10 Hz updates). */
export function useLiveQuote(sym: string): {
  quote: LiveQuote | null;
  lastTrade: LiveTrade | null;
  live: boolean;
  status: FeedState["status"];
} {
  const [, force] = useState(0);

  useEffect(() => {
    const bump = () => force((x) => x + 1);
    S.quoteListeners.add(bump);
    acquire();
    setActiveSym(sym);
    return () => {
      S.quoteListeners.delete(bump);
      release();
    };
  }, [sym]);

  const mine = !!S.quote && S.quote.sym === sym;
  const tradeMine = !!S.lastTrade && S.lastTrade.sym === sym;
  const live = mine && S.status === "open" && Date.now() - S.lastMsgAt < WATCHDOG_MS;
  return { quote: mine ? S.quote : null, lastTrade: tradeMine ? S.lastTrade : null, live, status: S.status };
}

/**
 * Raw trade tape listener for the active symbol — registers a callback that
 * receives EVERY aggregated trade the moment it prints (no throttling: the
 * accumulation itself is pure JS in refs). Exactly one sym is active at a
 * time; the callback is only invoked for that sym.
 */
export function useTradeTape(sym: string, onTrade: (tr: LiveTrade) => void) {
  const ref = useRef(onTrade);
  useEffect(() => {
    ref.current = onTrade;
  }, [onTrade]);
  useEffect(() => {
    const fn = (tr: LiveTrade) => {
      if (tr.sym === sym) ref.current(tr);
    };
    S.tradeListeners.add(fn);
    return () => {
      S.tradeListeners.delete(fn);
    };
  }, [sym]);
}
