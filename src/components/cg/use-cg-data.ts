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

  const load = useCallback(async () => {
    if (!url) return;
    try {
      const res = await fetch(url);
      const json = (await res.json()) as { ok: boolean; error?: string };
      if (!alive.current) return;
      if (json.ok === false) {
        setError(json.error ?? "request failed");
      } else {
        setError(null);
        setData(json as unknown as T);
        setUpdatedAt(Date.now());
      }
    } catch (e) {
      if (alive.current) setError(e instanceof Error ? e.message : "network error");
    } finally {
      if (alive.current) setLoading(false);
    }
  }, [url]);

  useEffect(() => {
    alive.current = true;
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
  interval: string;
  rows: KlineRow[];
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
