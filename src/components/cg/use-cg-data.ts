"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLiveQuote } from "@/lib/live/feed";
import { hlCoinOf } from "@/lib/binance/aliases";
import { getHlMid, useHlAllMids } from "@/lib/live/hl-feed";
import type {
  KlineRow,
  OiKlineRow,
  OrderFlowBar,
  LargeOrderGroup,
  LiquidationLevel,
  LtoGroup,
  LtoSupport,
} from "@/lib/cg/types";

/** Generic polling fetch hook with live indicator. */
export function usePolling<T>(url: string | null, intervalMs: number) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(url));
  const [updatedAt, setUpdatedAt] = useState<number>(0);
  const [prevUrl, setPrevUrl] = useState<string | null>(url);
  if (url !== prevUrl) {
    setPrevUrl(url);
    setData(null);
    setError(null);
    setLoading(Boolean(url));
  }
  const alive = useRef(true);
  // fetch generation: only the latest request may commit state, so a slow
  // response for a previous URL (e.g. the old symbol) can never clobber it
  const gen = useRef(0);

  const load = useCallback(async () => {
    if (!url) return;
    const myGen = ++gen.current;
    try {
      const res = await fetch(url);
      const json = (await res.json()) as { ok: boolean; error?: string };
      if (!alive.current || myGen !== gen.current) return; // superseded → discard
      if (json.ok === false) {
        setError(json.error ?? "request failed");
        setData(null); // never keep the previous symbol's data on failure
      } else {
        setError(null);
        setData(json as unknown as T);
        setUpdatedAt(Date.now());
      }
    } catch (e) {
      if (alive.current && myGen === gen.current) {
        setError(e instanceof Error ? e.message : "network error");
        setData(null);
      }
    } finally {
      if (alive.current && myGen === gen.current) setLoading(false);
    }
  }, [url]);

  useEffect(() => {
    alive.current = true;
    const init = setTimeout(() => {
      void load();
    }, 0);
    const t = setInterval(load, intervalMs);
    return () => {
      alive.current = false;
      clearTimeout(init);
      clearInterval(t);
    };
  }, [load, intervalMs]);

  return { data, error, loading, updatedAt, refresh: load };
}

export interface KlinePayload {
  ok: boolean;
  symbol?: string; // instrument key echoed by the route (payload guard)
  interval: string;
  rows: KlineRow[];
}

export interface TickerPayload {
  ok: boolean;
  sym: string;
  price: number | null;
  bid?: number | null;
  ask?: number | null;
  source?: "binance-fapi" | "coinglass";
  dir?: "up" | "down" | "flat";
  candleT?: number | null;
  fetchedAt?: number;
  ageMs?: number;
  stale?: boolean;
  ttlMs?: number;
}

export type TickerSource = "ws" | "hl-ws" | "rest" | "rest-cg" | null;

const HL_INDEX_SYMS = new Set(["SPX500", "SP500", "NDX100", "JP225"]);

/**
 * REAL-TIME price — fastest tier wins:
 *
 *  1. Hyperliquid `xyz` WebSocket (`allMids`) for index CFDs (SPX500/NDX100/JP225).
 *  2. Binance USDT-M futures WebSocket (browser → fstream, bookTicker + aggTrade)
 *     for all crypto, metals, and Binance TRADIFI_PERPETUAL contracts.
 *  3. /api/cg/live — server-side Binance futures bookTicker at 250 ms TTL.
 *  4. Coinglass m1 forming-candle close (~3 s) — last resort.
 */
export function useTicker(sym: string, restIntervalMs = 500) {
  const cleanSym = sym.trim().toUpperCase();
  const hlCoin = cleanSym && HL_INDEX_SYMS.has(cleanSym) ? hlCoinOf(cleanSym) : undefined;
  const binSym = !cleanSym || hlCoin ? "" : cleanSym;

  const { quote, lastTrade, live: wsLive, status } = useLiveQuote(binSym);
  const hlMids = useHlAllMids(Boolean(hlCoin));
  const hlTick = hlCoin ? getHlMid(hlCoin) : undefined;

  const wsUsable = Boolean(binSym && wsLive && quote);
  const hlUsable = Boolean(hlCoin && hlTick && hlTick.mid > 0);
  // REST fallback only runs while Binance WS is down (and never for empty or HL-index symbols)
  const q = usePolling<TickerPayload>(
    !binSym || wsUsable ? null : `/api/cg/live?sym=${encodeURIComponent(binSym)}`,
    restIntervalMs
  );

  const priceWs = lastTrade?.p ?? quote?.mid ?? null;
  const priceRest = q.data?.sym === binSym ? q.data?.price ?? null : null;
  const price = hlCoin ? (hlTick?.mid ?? null) : wsUsable ? priceWs : binSym ? priceRest : null;
  const source: TickerSource = hlUsable
    ? "hl-ws"
    : wsUsable
      ? "ws"
      : q.data?.source === "coinglass"
        ? "rest-cg"
        : q.data?.source
          ? "rest"
          : null;

  // Track previous price + tier without reading refs during render.
  const [tickTrack, setTickTrack] = useState<{
    src: TickerSource;
    seenPrice: number | null;
    lastNonNull: number | null;
    dir: "up" | "down" | "flat";
  }>({
    src: source,
    seenPrice: price,
    lastNonNull: price,
    dir: "flat",
  });
  if (tickTrack.src !== source || tickTrack.seenPrice !== price) {
    const sameSrc = tickTrack.src === source;
    const prevPrice = sameSrc ? tickTrack.lastNonNull : null;
    const nextDir: "up" | "down" | "flat" =
      price == null || prevPrice == null || price === prevPrice
        ? "flat"
        : price > prevPrice
          ? "up"
          : "down";
    setTickTrack({
      src: source,
      seenPrice: price,
      lastNonNull: price ?? prevPrice,
      dir: nextDir,
    });
  }
  const dir = hlUsable && hlTick ? hlTick.dir : tickTrack.dir;

  const fetchedAt = hlUsable ? hlTick?.at ?? null : wsUsable ? quote?.t ?? null : q.updatedAt || null;
  const ageMs = hlUsable
    ? Math.max(0, Date.now() - (hlTick?.at ?? Date.now()))
    : wsUsable
      ? Math.max(0, Date.now() - (lastTrade?.t ?? quote?.t ?? Date.now()))
      : q.data?.ageMs ?? null;
  const live =
    price != null &&
    (hlUsable ||
      wsUsable ||
      (q.data?.ok === true && q.data?.sym === binSym && source === "rest" && !q.error));

  return {
    price,
    bid: wsUsable ? quote?.bid ?? null : binSym && q.data?.sym === binSym ? q.data?.bid ?? null : null,
    ask: wsUsable ? quote?.ask ?? null : binSym && q.data?.sym === binSym ? q.data?.ask ?? null : null,
    dir,
    live,
    source,
    wsStatus: hlCoin ? hlMids.status : status,
    ageMs,
    fetchedAt,
    error: hlCoin || wsUsable ? null : q.error,
    updatedAt: q.updatedAt,
  };
}

export interface OiPayload {
  ok: boolean;
  interval: string;
  rows: OiKlineRow[];
}

export interface OrderFlowPayload {
  ok: boolean;
  interval: string;
  bars: OrderFlowBar[];
}

export interface LargeOrderPayload {
  ok: boolean;
  groups: LargeOrderGroup[];
}

export interface LtoPayload {
  ok: boolean;
  supported?: boolean;
  symbol: string;
  minVolUsd: number;
  support: LtoSupport;
  perExchange: Record<string, { market: string; instruments: number; openOrders: number; hasData: boolean }>;
  groups: LtoGroup[];
  hlFallback?: {
    coin: string;
    bids: { price: number; usd: number; sz: number }[];
    asks: { price: number; usd: number; sz: number }[];
    recentTrades: { time: number; px: number; sz: number; usd: number; side: "buy" | "sell" }[];
  } | null;
  updatedAt: number;
}

export interface OrderFlowAggPayload extends OrderFlowPayload {
  venues: number;
  venuesOk: number;
}

export interface LiqLevelsPayload {
  ok: boolean;
  range: string;
  levels: LiquidationLevel[];
  venues?: string[];
  venuesOk?: number;
  rawCount?: number;
}

export interface Candle {
  ts: number;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

export function rowsToCandles(rows: KlineRow[] | undefined): Candle[] {
  if (!rows) return [];
  return rows
    .map((r) => ({ ts: r[0], o: Number(r[1]), h: Number(r[2]), l: Number(r[3]), c: Number(r[4]), v: Number(r[5]) }))
    .filter((c) => Number.isFinite(c.o) && Number.isFinite(c.c));
}
