"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
  dir?: "up" | "down" | "flat";
  candleT?: number | null;
  fetchedAt?: number;
  ageMs?: number;
  stale?: boolean;
  ttlMs?: number;
}

/**
 * 1-second live price ticker (shared server cache → Coinglass kline).
 * Falls back to `null` price on error so callers can degrade gracefully.
 */
export function useTicker(sym: string, intervalMs = 1_000) {
  const q = usePolling<TickerPayload>(`/api/cg/ticker?sym=${encodeURIComponent(sym)}`, intervalMs);
  // defense-in-depth: only trust the payload when it belongs to this symbol
  const mine = q.data?.sym === sym;
  return {
    price: mine ? q.data?.price ?? null : null,
    dir: mine ? q.data?.dir ?? "flat" : "flat",
    live: mine && !!q.data?.ok && !q.data?.stale && q.data?.price != null && !q.error,
    ageMs: mine ? q.data?.ageMs ?? null : null,
    fetchedAt: mine ? q.data?.fetchedAt ?? null : null,
    error: q.error,
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
