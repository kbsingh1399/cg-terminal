"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLiveQuote } from "@/lib/live/feed";
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
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState<number>(0);
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
    // url changed (symbol/mode/interval switch): drop the previous payload
    // immediately so it can never render under the new selection
    setData(null);
    setError(null);
    setLoading(true);
    load();
    const t = setInterval(load, intervalMs);
    return () => {
      alive.current = false;
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

export type TickerSource = "ws" | "rest" | "rest-cg" | null;

/**
 * REAL-TIME price — 3-tier ladder, fastest tier wins:
 *
 *  1. Binance USDT-M futures WebSocket (browser → fstream, bookTicker +
 *     aggTrade): sub-100 ms — the price the exchange itself shows.
 *  2. /api/cg/live — server-side Binance futures bookTicker at 250 ms
 *     shared TTL (kicked in when the browser cannot hold the WS).
 *  3. Coinglass m1 forming-candle close (inside the same route, ~3 s) —
 *     the legacy source, last resort.
 *
 * The returned `source` always names the tier currently driving the price —
 * no silent mixing. `dir` is computed tick-to-tick from the live tape.
 */
export function useTicker(sym: string, restIntervalMs = 500) {
  const { quote, lastTrade, live: wsLive, status } = useLiveQuote(sym);
  const wsUsable = wsLive && !!quote;
  // REST fallback only runs while the WS is down — zero upstream cost when live
  const q = usePolling<TickerPayload>(wsUsable ? null : `/api/cg/live?sym=${encodeURIComponent(sym)}`, restIntervalMs);

  // tick-to-tick direction from whichever tier is feeding us.
  // The refs are READ during render but WRITTEN post-commit (effect) —
  // mutating them during render would let a discarded concurrent render
  // advance the baseline and flip the next committed tick's color.
  const prevRef = useRef<number | null>(null);
  const prevSrcRef = useRef<TickerSource>(null);
  const priceWs = lastTrade?.p ?? quote?.mid ?? null;
  const priceRest = q.data?.sym === sym ? q.data?.price ?? null : null;
  const price = wsUsable ? priceWs : priceRest;
  const source: TickerSource = wsUsable ? "ws" : q.data?.source === "coinglass" ? "rest-cg" : q.data?.source ? "rest" : null;
  // tier switch (or a null-price gap across one) → no bogus flash: never
  // compare prices across tiers
  const prevPrice = prevSrcRef.current !== source ? null : prevRef.current;
  const dir =
    price == null || prevPrice == null || price === prevPrice
      ? "flat"
      : price > prevPrice
        ? "up"
        : "down";
  useEffect(() => {
    if (price != null) prevRef.current = price;
    prevSrcRef.current = source;
  }, [price, source]);

  const fetchedAt = wsUsable ? quote?.t ?? null : q.updatedAt || null;
  const ageMs = wsUsable ? Math.max(0, Date.now() - (lastTrade?.t ?? quote?.t ?? Date.now())) : q.data?.ageMs ?? null;
  const live =
    price != null &&
    (wsUsable || (q.data?.ok === true && q.data?.sym === sym && source === "rest" && !q.error));

  return {
    price,
    bid: wsUsable ? quote?.bid ?? null : (q.data?.sym === sym ? q.data?.bid ?? null : null),
    ask: wsUsable ? quote?.ask ?? null : (q.data?.sym === sym ? q.data?.ask ?? null : null),
    dir,
    live,
    source,
    wsStatus: status,
    ageMs,
    fetchedAt,
    error: wsUsable ? null : q.error,
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
  symbol: string;
  minVolUsd: number;
  support: LtoSupport;
  perExchange: Record<string, { market: string; instruments: number; openOrders: number; hasData: boolean }>;
  groups: LtoGroup[];
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
