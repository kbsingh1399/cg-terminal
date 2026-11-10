/**
 * Market snapshot builder — the "Overview" data: current price, auction
 * levels (VAL/POC/VAH for session/day/month), Fib-prime EMA 13/89/233,
 * RSI(14) and day-anchored VWAP with ±1σ/2σ/3σ bands.
 *
 * Everything is computed from live Binance-perp klines fetched through the
 * Coinglass API (#kline) — no synthetic values. VWAP anchors at the UTC day
 * open, so it matches every exchange/TradingView convention regardless of
 * the viewer's local timezone (IST or UTC alike).
 */

import { cgGet } from "./client";
import type { KlineRow } from "./types";
import {
  auctionLevels,
  dayVwap,
  emaLast,
  rsiLast,
  utcDayStart,
  utcMonthStart,
  type AuctionSet,
  type VwapResult,
} from "./indicators";
import { assetOf, leadInstr, type AssetCfg } from "./assets";

export interface MarketSnapshot {
  ok: boolean;
  sym: string;
  name: string;
  kind: "crypto" | "metal";
  price: {
    last: number | null;
    prevDayClose: number | null;
    chgDayPct: number | null;
    dayHigh: number | null;
    dayLow: number | null;
    dayVolBase: number | null;
  };
  auction: AuctionSet;
  ema: Record<string, { e13: number | null; e89: number | null; e233: number | null }>;
  rsi: Record<string, number | null>;
  vwap: VwapResult;
  anchorInfo: { dayStart: number; monthStart: number };
  updatedAt: number;
}

/** module cache: sym → {at, snap, err} */
const cache = new Map<string, { at: number; snap?: MarketSnapshot; err?: string }>();
const TTL = Number(process.env.CG_MARKET_TTL_MS ?? 12_000) || 12_000;

async function fetchKlines(instKey: string, itv: string, limit: number): Promise<KlineRow[]> {
  const r = (await cgGet(
    `/api/v2/kline?symbol=${encodeURIComponent(`${instKey}#kline`)}&interval=${itv}&minLimit=false&limit=${limit}`,
    90_000
  )) as { data?: KlineRow[] } | KlineRow[];
  const rows = Array.isArray(r) ? r : (r.data ?? []);
  return rows.filter((x) => x && Number.isFinite(+x[4]));
}

function toCandles(rows: KlineRow[]): { t: number; o: number; h: number; l: number; c: number; v: number }[] {
  return rows.map((r) => ({ t: 1000 * Number(r[0]), o: +r[1], h: +r[2], l: +r[3], c: +r[4], v: +r[5] }));
}

export async function buildMarketSnapshot(symRaw: string): Promise<MarketSnapshot> {
  const sym = symRaw.toUpperCase();
  const hit = cache.get(sym);
  if (hit && Date.now() - hit.at < TTL) {
    if (hit.snap) return hit.snap;
    throw hit.err ?? new Error("snapshot unavailable");
  }
  const cfg: AssetCfg | undefined = assetOf(sym);
  const lead = leadInstr(sym); // centralized (review A2): USO rides an OKX lead
  const [m15Raw, h1Raw, h4Raw, d1Raw] = await Promise.all([
    fetchKlines(lead, "m15", 1000),
    fetchKlines(lead, "h1", 1000),
    fetchKlines(lead, "h4", 500),
    fetchKlines(lead, "d1", 500),
  ]);
  const m15 = toCandles(m15Raw);
  const h1 = toCandles(h1Raw);
  const h4 = toCandles(h4Raw);
  const d1 = toCandles(d1Raw);
  if (!m15.length) throw new Error(`no klines for ${sym}`);
  const now = Date.now();
  const dayStart = utcDayStart(now);

  const last = m15[m15.length - 1];
  // previous UTC day close for day change %
  const prevDayBars = m15.filter((c) => c.t < dayStart);
  const prevDayClose = prevDayBars.length ? prevDayBars[prevDayBars.length - 1].c : null;
  const dayBars = m15.filter((c) => c.t >= dayStart);

  const closesOf = (arr: typeof m15) => arr.map((c) => c.c);
  const emaSet = (arr: typeof m15) => ({
    e13: emaLast(closesOf(arr), 13),
    e89: emaLast(closesOf(arr), 89),
    e233: emaLast(closesOf(arr), 233),
  });

  const snap: MarketSnapshot = {
    ok: true,
    sym,
    name: cfg?.name ?? sym,
    kind: cfg?.kind ?? "crypto",
    price: {
      last: last.c,
      prevDayClose,
      chgDayPct: prevDayClose ? ((last.c - prevDayClose) / prevDayClose) * 100 : null,
      dayHigh: dayBars.length ? Math.max(...dayBars.map((c) => c.h)) : null,
      dayLow: dayBars.length ? Math.min(...dayBars.map((c) => c.l)) : null,
      dayVolBase: dayBars.reduce((s, c) => s + c.v, 0),
    },
    auction: auctionLevels(m15, h1, now),
    ema: {
      m15: emaSet(m15),
      h1: emaSet(h1),
      h4: emaSet(h4),
      d1: emaSet(d1),
    },
    rsi: {
      m15: rsiLast(closesOf(m15)),
      h1: rsiLast(closesOf(h1)),
      h4: rsiLast(closesOf(h4)),
      d1: rsiLast(closesOf(d1)),
    },
    vwap: dayVwap(m15, now),
    anchorInfo: { dayStart, monthStart: utcMonthStart(now) },
    updatedAt: Date.now(),
  };
  cache.set(sym, { at: Date.now(), snap });
  return snap;
}

export function marketCacheInfo() {
  return [...cache.entries()].map(([sym, e]) => ({ sym, ageMs: Date.now() - e.at, ok: !!e.snap }));
}
