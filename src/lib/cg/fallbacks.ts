/**
 * Live exchange & market fallback helpers for symbols or endpoints where
 * Coinglass upstream is unavailable, rate-limited (429), or omits new
 * TradFi perpetuals / Hyperliquid xyz / Yahoo Finance benchmarks.
 *
 * ZERO synthetic/mock data: every helper queries real exchange feeds
 * (Binance USDT-M Futures API, Hyperliquid xyz DEX, Yahoo Finance v8).
 */

import { fapiFetch } from "../live/fapi";
import { hlCoinOf, resolveBinPair, resolveCgSym } from "../binance/aliases";
import { classicOf } from "./classic";
import { hlBook, hlXyzSnapshot, type HlCtx, type HlLevel } from "./micro";

export interface OHLCVCandle {
  t: number; // ms epoch
  o: number;
  h: number;
  l: number;
  c: number;
  v: number; // base volume
  q?: number; // quote USD volume
  tbq?: number; // taker buy quote USD volume (Binance klines col 10)
  tbb?: number; // taker buy base volume (Binance klines col 9)
}

const CG_TO_BIN_ITV: Record<string, string> = {
  m1: "1m",
  m5: "5m",
  m15: "15m",
  m30: "30m",
  h1: "1h",
  h4: "4h",
  d1: "1d",
  "1m": "1m",
  "5m": "5m",
  "15m": "15m",
  "30m": "30m",
  "1h": "1h",
  "4h": "4h",
  "1d": "1d",
};

const CG_TO_HL_ITV: Record<string, { itv: string; ms: number }> = {
  m1: { itv: "1m", ms: 60_000 },
  m5: { itv: "5m", ms: 300_000 },
  m15: { itv: "15m", ms: 900_000 },
  m30: { itv: "30m", ms: 1_800_000 },
  h1: { itv: "1h", ms: 3_600_000 },
  h4: { itv: "4h", ms: 14_400_000 },
  d1: { itv: "1d", ms: 86_400_000 },
};

const HL_POST_CACHE = new Map<string, { at: number; data: unknown }>();

async function postHlInfo<T>(body: Record<string, unknown>, ttlMs = 8_000): Promise<T> {
  const key = JSON.stringify(body);
  const hit = HL_POST_CACHE.get(key);
  if (hit && Date.now() - hit.at < ttlMs) return hit.data as T;
  const res = await fetch("https://api.hyperliquid.xyz/info", {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: key,
    cache: "no-store",
    signal: AbortSignal.timeout(8_000),
  });
  if (!res.ok) throw new Error(`HL HTTP ${res.status}`);
  const data = (await res.json()) as T;
  HL_POST_CACHE.set(key, { at: Date.now(), data });
  if (HL_POST_CACHE.size > 256) {
    const first = HL_POST_CACHE.keys().next().value;
    if (first) HL_POST_CACHE.delete(first);
  }
  return data;
}

/** Real Binance USDT-M klines (includes taker buy base/quote volumes). */
export async function fetchBinCandles(sym: string, cgItv: string, limit = 500): Promise<OHLCVCandle[]> {
  const binItv = CG_TO_BIN_ITV[cgItv] ?? "15m";
  const pair = resolveBinPair(sym);
  const safeLimit = Math.min(Math.max(limit, 10), 1500);
  const rows = (await fapiFetch(
    `/fapi/v1/klines?symbol=${encodeURIComponent(pair)}&interval=${binItv}&limit=${safeLimit}`,
    6_000
  )) as (string | number)[][];
  if (!Array.isArray(rows)) return [];
  const out: OHLCVCandle[] = [];
  for (const r of rows) {
    const t = Number(r[0]);
    const o = Number(r[1]);
    const h = Number(r[2]);
    const l = Number(r[3]);
    const c = Number(r[4]);
    const v = Number(r[5]);
    const q = Number(r[7]);
    const tbb = Number(r[9]);
    const tbq = Number(r[10]);
    if (Number.isFinite(t) && Number.isFinite(c) && c > 0) {
      out.push({ t, o, h, l, c, v, q, tbb, tbq });
    }
  }
  return out;
}

/** Real Hyperliquid xyz candleSnapshot (stocks/indices/commodities). */
export async function fetchHlCandles(coin: string, cgItv: string, limit = 300): Promise<OHLCVCandle[]> {
  const cfg = CG_TO_HL_ITV[cgItv] ?? CG_TO_HL_ITV.m15;
  const endTime = Date.now();
  const startTime = endTime - Math.min(limit, 1000) * cfg.ms;
  const raw = await postHlInfo<{ t: number; o: string; h: string; l: string; c: string; v: string }[]>(
    { type: "candleSnapshot", req: { coin, interval: cfg.itv, startTime, endTime } },
    15_000
  );
  if (!Array.isArray(raw)) return [];
  return raw
    .map((r) => ({
      t: Number(r.t),
      o: Number(r.o),
      h: Number(r.h),
      l: Number(r.l),
      c: Number(r.c),
      v: Number(r.v),
      q: Number(r.v) * Number(r.c),
    }))
    .filter((c) => Number.isFinite(c.t) && Number.isFinite(c.c) && c.c > 0)
    .sort((a, b) => a.t - b.t);
}

/** Real Hyperliquid recent trades (up to latest fills returned by HL). */
export async function fetchHlRecentTrades(
  coin: string
): Promise<{ time: number; px: number; sz: number; usd: number; side: "buy" | "sell"; tid?: number }[]> {
  const raw = await postHlInfo<{ coin: string; side: string; px: string; sz: string; time: number; tid?: number }[]>(
    { type: "recentTrades", coin },
    5_000
  );
  if (!Array.isArray(raw)) return [];
  return raw
    .map((t) => {
      const px = Number(t.px);
      const sz = Number(t.sz);
      return {
        time: Number(t.time),
        px,
        sz,
        usd: px * sz,
        side: (t.side === "B" ? "buy" : "sell") as "buy" | "sell",
        tid: t.tid,
      };
    })
    .filter((t) => Number.isFinite(t.px) && t.px > 0 && Number.isFinite(t.sz));
}

/** Real Yahoo Finance v8 OHLCV candles for classic benchmarks (SPX500, US30, VIX, etc.). */
export async function fetchYahooCandles(
  ticker: string,
  interval: "15m" | "1h" | "1d",
  range: "5d" | "1mo" | "1y" | "2y"
): Promise<OHLCVCandle[]> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=${interval}&range=${range}&includePrePost=true`;
  const res = await fetch(url, {
    headers: {
      "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      accept: "application/json",
    },
    cache: "no-store",
    signal: AbortSignal.timeout(8_000),
  });
  if (!res.ok) throw new Error(`Yahoo HTTP ${res.status}`);
  const json = (await res.json()) as {
    chart?: {
      result?: {
        timestamp?: number[];
        indicators?: {
          quote?: {
            open?: (number | null)[];
            high?: (number | null)[];
            low?: (number | null)[];
            close?: (number | null)[];
            volume?: (number | null)[];
          }[];
        };
      }[];
    };
  };
  const r = json.chart?.result?.[0];
  const ts = r?.timestamp ?? [];
  const q = r?.indicators?.quote?.[0];
  if (!ts.length || !q?.close) return [];
  const out: OHLCVCandle[] = [];
  for (let i = 0; i < ts.length; i++) {
    const c = q.close[i];
    if (c == null || !Number.isFinite(c) || c <= 0) continue;
    const o = q.open?.[i] ?? c;
    const h = q.high?.[i] ?? c;
    const l = q.low?.[i] ?? c;
    const v = q.volume?.[i] ?? 0;
    out.push({
      t: ts[i] * 1000,
      o: Number.isFinite(o) ? Number(o) : c,
      h: Number.isFinite(h) ? Number(h) : c,
      l: Number.isFinite(l) ? Number(l) : c,
      c,
      v: Number.isFinite(v) ? Math.max(0, Number(v)) : 0,
    });
  }
  return out;
}

export interface BinFundingFallback {
  ratePct8h: number;
  nextFundingTime: number;
  markPrice: number;
  indexPrice: number;
}

export async function fetchBinFunding(sym: string): Promise<BinFundingFallback | null> {
  try {
    const pair = resolveBinPair(sym);
    const d = (await fapiFetch(`/fapi/v1/premiumIndex?symbol=${encodeURIComponent(pair)}`, 4_500)) as {
      lastFundingRate?: string;
      nextFundingTime?: number;
      markPrice?: string;
      indexPrice?: string;
    };
    const rate = Number(d.lastFundingRate);
    if (!Number.isFinite(rate)) return null;
    return {
      ratePct8h: Number((rate * 100).toFixed(6)),
      nextFundingTime: Number(d.nextFundingTime ?? 0),
      markPrice: Number(d.markPrice ?? 0),
      indexPrice: Number(d.indexPrice ?? 0),
    };
  } catch {
    return null;
  }
}

export interface BinOiFallback {
  oiUsd: number;
  contracts: number;
  oiDelta1hPct: number | null;
  oiDelta4hPct: number | null;
  oiDelta24hPct: number | null;
  series: { ts: number; oiUsd: number; price: number | null }[];
}

export async function fetchBinOi(sym: string): Promise<BinOiFallback | null> {
  const pair = resolveBinPair(sym);
  try {
    const [oiRaw, premRaw, histRaw] = await Promise.all([
      fapiFetch(`/fapi/v1/openInterest?symbol=${encodeURIComponent(pair)}`, 4_500) as Promise<{ openInterest?: string }>,
      fapiFetch(`/fapi/v1/premiumIndex?symbol=${encodeURIComponent(pair)}`, 4_500) as Promise<{ markPrice?: string }>,
      fapiFetch(`/futures/data/openInterestHist?symbol=${encodeURIComponent(pair)}&period=1h&limit=30`, 5_000).catch(() => []) as Promise<
        { timestamp?: number; sumOpenInterestValue?: string }[]
      >,
    ]);
    const contracts = Number(oiRaw?.openInterest);
    const mark = Number(premRaw?.markPrice);
    if (!Number.isFinite(contracts) || !Number.isFinite(mark) || mark <= 0) return null;
    const oiUsd = Math.round(contracts * mark);
    const series = Array.isArray(histRaw)
      ? histRaw
          .map((h) => ({
            ts: Number(h.timestamp ?? 0),
            oiUsd: Math.round(Number(h.sumOpenInterestValue ?? 0)),
            price: null,
          }))
          .filter((p) => p.ts > 0 && p.oiUsd > 0)
      : [];
    const lastIdx = series.length - 1;
    const pct = (ago: number): number | null => {
      if (lastIdx < ago) return null;
      const prev = series[lastIdx - ago]?.oiUsd;
      if (!prev) return null;
      return Number((((oiUsd - prev) / prev) * 100).toFixed(2));
    };
    return {
      oiUsd,
      contracts,
      oiDelta1hPct: pct(1),
      oiDelta4hPct: pct(4),
      oiDelta24hPct: pct(24),
      series,
    };
  } catch {
    return null;
  }
}

export async function fetchHlCtxAndBook(sym: string): Promise<{
  coin: string;
  ctx?: HlCtx;
  book?: { bids: HlLevel[]; asks: HlLevel[] };
} | null> {
  const coin = hlCoinOf(sym);
  if (!coin) return null;
  try {
    const [snap, book] = await Promise.all([hlXyzSnapshot(), hlBook(coin)]);
    return { coin, ctx: snap[coin], book };
  } catch {
    return null;
  }
}

/**
 * Resolve ticker metadata for classic-only / fallback market lookups.
 */
export function resolveClassicYahooTicker(sym: string): { yahoo: string; name: string; isFuture: boolean } | null {
  const c = classicOf(sym);
  if (!c) return null;
  const yahoo = c.futYahoo ?? c.yahoo;
  return { yahoo, name: c.name, isFuture: !!c.futYahoo };
}

export function cleanGridStep(mid: number): number {
  if (!(mid > 0)) return 0.01;
  const raw = mid / 2000;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const n = raw / mag;
  const mult = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return Number((mult * mag).toPrecision(6));
}

export function fallbackSymLabel(sym: string): string {
  const up = sym.trim().toUpperCase();
  const c = classicOf(up);
  if (c) return c.name;
  const cg = resolveCgSym(up);
  return cg !== up ? `${up} (${cg})` : up;
}
