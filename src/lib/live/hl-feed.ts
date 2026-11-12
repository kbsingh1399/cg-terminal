"use client";

import { useEffect, useState } from "react";

/**
 * Hyperliquid `xyz` HIP-3 WebSocket client (wss://api.hyperliquid.xyz/ws).
 *
 * Drives sub-second real-time mids (`allMids` for `dex: "xyz"`) for index CFDs
 * without 1:1 Binance perp scale (`SPX500` → `xyz:SP500`, `NDX100` → `xyz:XYZ100`,
 * `JP225` → `xyz:JP225`) as well as live `l2Book` snapshots for the active
 * MicrostructurePanel symbol instead of waiting for 15–30s HTTP polls.
 */

const WS_URL = "wss://api.hyperliquid.xyz/ws";
const KEEPALIVE_MS = 25_000;
const WATCHDOG_MS = 45_000;
const NOTIFY_THROTTLE_MS = 250; // 4 Hz smooth UI flush

export interface HlMidTick {
  mid: number;
  prev: number | null;
  dir: "up" | "down" | "flat";
  at: number;
}

export interface HlWsLevel {
  px: number;
  sz: number;
  n: number;
}

export interface HlWsBook {
  coin: string;
  bids: HlWsLevel[];
  asks: HlWsLevel[];
  bestBid: number | null;
  bestAsk: number | null;
  mid: number | null;
  spreadPct: number | null;
  bidNotional: number;
  askNotional: number;
  imbalance20: number | null;
  at: number;
}

interface HlFeedState {
  ws: WebSocket | null;
  status: "idle" | "connecting" | "open" | "closed";
  mids: Map<string, HlMidTick>;
  wantAllMids: number;
  activeBookCoin: string | null;
  wantBook: number;
  subbedAllMids: boolean;
  subbedBookCoin: string | null;
  book: HlWsBook | null;
  lastMsgAt: number;
  backoffMs: number;
  keepaliveTimer: ReturnType<typeof setInterval> | null;
  watchdogTimer: ReturnType<typeof setInterval> | null;
  reconnectTimer: ReturnType<typeof setTimeout> | null;
  teardownTimer: ReturnType<typeof setTimeout> | null;
  listeners: Set<() => void>;
}

const g = globalThis as unknown as { __hlXyzWsFeed?: HlFeedState };
const S: HlFeedState = (g.__hlXyzWsFeed ??= {
  ws: null,
  status: "idle",
  mids: new Map(),
  wantAllMids: 0,
  activeBookCoin: null,
  wantBook: 0,
  subbedAllMids: false,
  subbedBookCoin: null,
  book: null,
  lastMsgAt: 0,
  backoffMs: 500,
  keepaliveTimer: null,
  watchdogTimer: null,
  reconnectTimer: null,
  teardownTimer: null,
  listeners: new Set(),
});

let notifyQueued = false;
function notify() {
  if (notifyQueued) return;
  notifyQueued = true;
  setTimeout(() => {
    notifyQueued = false;
    for (const fn of S.listeners) fn();
  }, NOTIFY_THROTTLE_MS);
}

function setStatus(st: HlFeedState["status"]) {
  if (S.status === st) return;
  S.status = st;
  for (const fn of S.listeners) fn();
}

function sendJson(obj: unknown) {
  if (S.ws?.readyState === WebSocket.OPEN) {
    try {
      S.ws.send(JSON.stringify(obj));
    } catch {
      /* handled on close */
    }
  }
}

function syncSubscriptions() {
  if (S.ws?.readyState !== WebSocket.OPEN) return;
  if (S.wantAllMids > 0 && !S.subbedAllMids) {
    sendJson({ method: "subscribe", subscription: { type: "allMids", dex: "xyz" } });
    S.subbedAllMids = true;
  } else if (S.wantAllMids === 0 && S.subbedAllMids) {
    sendJson({ method: "unsubscribe", subscription: { type: "allMids", dex: "xyz" } });
    S.subbedAllMids = false;
  }

  const targetBook = S.wantBook > 0 ? S.activeBookCoin : null;
  if (S.subbedBookCoin && S.subbedBookCoin !== targetBook) {
    sendJson({ method: "unsubscribe", subscription: { type: "l2Book", coin: S.subbedBookCoin } });
    S.subbedBookCoin = null;
  }
  if (targetBook && S.subbedBookCoin !== targetBook) {
    sendJson({ method: "subscribe", subscription: { type: "l2Book", coin: targetBook } });
    S.subbedBookCoin = targetBook;
  }
}

function parseBookLevels(arr: unknown): HlWsLevel[] {
  if (!Array.isArray(arr)) return [];
  const out: HlWsLevel[] = [];
  for (const lv of arr) {
    if (!lv || typeof lv !== "object") continue;
    const r = lv as { px?: string; sz?: string; n?: number };
    const px = Number(r.px);
    const sz = Number(r.sz);
    if (Number.isFinite(px) && Number.isFinite(sz) && px > 0 && sz > 0) {
      out.push({ px, sz, n: Number(r.n) || 0 });
    }
  }
  return out;
}

function openConnection() {
  if (typeof window === "undefined") return;
  if (S.wantAllMids === 0 && S.wantBook === 0) return;
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
  S.subbedAllMids = false;
  S.subbedBookCoin = null;

  ws.onopen = () => {
    if (S.ws !== ws) return;
    S.backoffMs = 500;
    S.lastMsgAt = Date.now();
    setStatus("open");
    syncSubscriptions();
  };

  ws.onmessage = (ev) => {
    if (S.ws !== ws) return;
    S.lastMsgAt = Date.now();
    let m: { channel?: string; data?: Record<string, unknown> };
    try {
      m = JSON.parse(String(ev.data));
    } catch {
      return;
    }

    if (m.channel === "allMids" && m.data?.mids && typeof m.data.mids === "object") {
      const now = Date.now();
      const mids = m.data.mids as Record<string, string>;
      let changed = false;
      for (const [coin, pxStr] of Object.entries(mids)) {
        const mid = Number(pxStr);
        if (!Number.isFinite(mid) || mid <= 0) continue;
        const old = S.mids.get(coin);
        const prev = old?.mid ?? null;
        const dir: HlMidTick["dir"] =
          prev == null || mid === prev ? old?.dir ?? "flat" : mid > prev ? "up" : "down";
        S.mids.set(coin, { mid, prev, dir, at: now });
        changed = true;
      }
      if (changed) notify();
    } else if (m.channel === "l2Book" && m.data) {
      const coin = String(m.data.coin ?? "");
      if (!coin || coin !== S.activeBookCoin) return;
      const levels = Array.isArray(m.data.levels) ? (m.data.levels as [unknown[], unknown[]]) : null;
      if (!levels) return;
      const bids = parseBookLevels(levels[0]);
      const asks = parseBookLevels(levels[1]);
      const bestBid = bids[0]?.px ?? null;
      const bestAsk = asks[0]?.px ?? null;
      const mid = bestBid != null && bestAsk != null ? (bestBid + bestAsk) / 2 : bestBid ?? bestAsk;
      const spreadPct = bestBid && bestAsk && bestBid > 0 ? +(((bestAsk - bestBid) / bestBid) * 100).toFixed(4) : null;
      const bidNotional = bids.slice(0, 20).reduce((s, l) => s + l.px * l.sz, 0);
      const askNotional = asks.slice(0, 20).reduce((s, l) => s + l.px * l.sz, 0);
      const tot = bidNotional + askNotional;
      S.book = {
        coin,
        bids,
        asks,
        bestBid,
        bestAsk,
        mid,
        spreadPct,
        bidNotional,
        askNotional,
        imbalance20: tot > 0 ? bidNotional / tot : null,
        at: Number(m.data.time) || Date.now(),
      };
      notify();
    }
  };

  ws.onerror = () => {
    /* handled via onclose */
  };

  ws.onclose = () => {
    if (S.ws !== ws) return;
    S.ws = null;
    S.subbedAllMids = false;
    S.subbedBookCoin = null;
    setStatus("closed");
    scheduleReconnect();
  };
}

function scheduleReconnect() {
  if (S.wantAllMids === 0 && S.wantBook === 0) return;
  if (S.reconnectTimer) return;
  const wait = S.backoffMs;
  S.backoffMs = Math.min(S.backoffMs * 2, 15_000);
  S.reconnectTimer = setTimeout(() => {
    S.reconnectTimer = null;
    openConnection();
  }, wait);
}

function ensureTimers() {
  if (typeof window === "undefined") return;
  if (!S.keepaliveTimer) {
    S.keepaliveTimer = setInterval(() => {
      if (S.ws?.readyState === WebSocket.OPEN) {
        sendJson({ method: "ping" });
      }
    }, KEEPALIVE_MS);
  }
  if (!S.watchdogTimer) {
    S.watchdogTimer = setInterval(() => {
      if (S.wantAllMids === 0 && S.wantBook === 0) return;
      if (!S.ws && !S.reconnectTimer) openConnection();
      else if (S.ws?.readyState === WebSocket.OPEN && S.lastMsgAt > 0 && Date.now() - S.lastMsgAt > WATCHDOG_MS) {
        try {
          S.ws.close();
        } catch {
          /* noop */
        }
      }
    }, 5_000);
  }
}

function maybeTeardown() {
  if (S.wantAllMids > 0 || S.wantBook > 0) return;
  if (S.teardownTimer) return;
  S.teardownTimer = setTimeout(() => {
    S.teardownTimer = null;
    if (S.wantAllMids > 0 || S.wantBook > 0) return;
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
    S.subbedAllMids = false;
    S.subbedBookCoin = null;
    setStatus("idle");
  }, 1_500);
}

/** Read current Hyperliquid xyz mid synchronously inside render or effects. */
export function getHlMid(coin: string | null | undefined): HlMidTick | undefined {
  if (!coin) return undefined;
  return S.mids.get(coin);
}

/** Subscribe to live Hyperliquid `xyz` allMids stream (`dex: "xyz"`). */
export function useHlAllMids(enabled = true): {
  status: HlFeedState["status"];
  hasData: boolean;
  tick: number;
} {
  const [tick, force] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    const bump = () => force((x) => x + 1);
    S.listeners.add(bump);
    S.wantAllMids++;
    if (S.teardownTimer) {
      clearTimeout(S.teardownTimer);
      S.teardownTimer = null;
    }
    ensureTimers();
    if (!S.ws && !S.reconnectTimer) openConnection();
    else syncSubscriptions();

    return () => {
      S.listeners.delete(bump);
      S.wantAllMids = Math.max(0, S.wantAllMids - 1);
      syncSubscriptions();
      maybeTeardown();
    };
  }, [enabled]);

  return { status: S.status, hasData: S.mids.size > 0, tick };
}

/** Subscribe to live Hyperliquid `l2Book` frames for a single `xyz:` coin. */
export function useHlBook(coin: string | null | undefined): {
  book: HlWsBook | null;
  status: HlFeedState["status"];
} {
  const [, force] = useState(0);

  useEffect(() => {
    if (!coin) return;
    const bump = () => force((x) => x + 1);
    S.listeners.add(bump);
    S.wantBook++;
    if (S.activeBookCoin !== coin) {
      S.activeBookCoin = coin;
      S.book = null;
    }
    if (S.teardownTimer) {
      clearTimeout(S.teardownTimer);
      S.teardownTimer = null;
    }
    ensureTimers();
    if (!S.ws && !S.reconnectTimer) openConnection();
    else syncSubscriptions();

    return () => {
      S.listeners.delete(bump);
      S.wantBook = Math.max(0, S.wantBook - 1);
      if (S.wantBook === 0) {
        S.activeBookCoin = null;
        S.book = null;
      }
      syncSubscriptions();
      maybeTeardown();
    };
  }, [coin]);

  const mine = S.book && S.book.coin === coin ? S.book : null;
  return { book: mine, status: S.status };
}
