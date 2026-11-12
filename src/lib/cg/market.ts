/**
 * Market snapshot builder — the "Overview" data: current price, auction
 * levels (VAL/POC/VAH for session/day/week/month), Fib-prime EMA 13/89/233,
 * RSI(14), day-anchored VWAP with ±1σ/2σ/3σ bands, realized volatility
 * (7d/30d), ATR(14) percentile, RVOL, and structural levels (PDH/PDL/
 * PWH/PWL + Asia/London/NY session VWAPs).
 *
 * Everything is computed from live Binance-perp klines fetched through the
 * Coinglass API (#kline) — no synthetic values. VWAP anchors at the UTC day
 * open, so it matches every exchange/TradingView convention regardless of
 * the viewer's local timezone (IST or UTC alike).
 *
 * FRESHNESS (2026-11-12 directive): the response reports the EXACT last
 * candle timestamp (`candleAt`) and its age — the TTL cache never masks a
 * stale upstream tail with a fake `updatedAt: Date.now()`.
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
import { assetOf, isAsset, leadInstr, symDecs, type AssetCfg } from "./assets";
import { hlCoinOf, resolveCgSym } from "../binance/aliases";
import { classicOf } from "./classic";
import { getUniverse, isBinanceSym } from "../binance/universe";
import { fetchBinCandles, fetchHlCandles, fetchYahooCandles, resolveClassicYahooTicker, type OHLCVCandle } from "./fallbacks";

export interface MarketSnapshot {
  ok: boolean;
  sym: string;
  name: string;
  kind: "crypto" | "metal" | "equity" | "commodity" | "index";
  source?: string;
  priceDecs?: number;
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
  /** structural reference levels (previous day/week high+low) */
  levels: {
    pdh: number | null;
    pdl: number | null;
    pwh: number | null;
    pwl: number | null;
    /** session VWAPs over the trailing UTC 8h blocks: Asia 00-08, London 08-16, NY 16-24 */
    sessionVwaps: { asia: number | null; london: number | null; ny: number | null };
  };
  /** realized volatility + ATR percentile + relative volume */
  vol: {
    rv7dPct: number | null;
    rv30dPct: number | null;
    atr14H1: number | null;
    atr14PctRank: number | null;
    atrState: "squeeze" | "normal" | "expansion" | null;
    rvolHour: number | null;
    rvolBar15m: number | null;
  };
  anchorInfo: { dayStart: number; monthStart: number };
  /** EXACT last-candle timestamp (ms) — the honest data age */
  candleAt: number;
  /** epoch ms when this snapshot was built */
  dataAt: number;
  /** Date.now() - candleAt at build time (bar age) */
  ageMs: number;
  /** true when the bar age exceeds 3× the m15 interval (upstream tail stalled) */
  stale: boolean;
  /** epoch ms when this snapshot was built (legacy alias of dataAt) */
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

function toCandles(rows: KlineRow[]): OHLCVCandle[] {
  return rows.map((r) => ({ t: 1000 * Number(r[0]), o: +r[1], h: +r[2], l: +r[3], c: +r[4], v: +r[5] }));
}

function rollupCandles(bars: OHLCVCandle[], stepMs: number): OHLCVCandle[] {
  const buckets = new Map<number, OHLCVCandle>();
  for (const b of bars) {
    const k = Math.floor(b.t / stepMs) * stepMs;
    const prev = buckets.get(k);
    if (!prev) {
      buckets.set(k, { t: k, o: b.o, h: b.h, l: b.l, c: b.c, v: b.v });
    } else {
      prev.h = Math.max(prev.h, b.h);
      prev.l = Math.min(prev.l, b.l);
      prev.c = b.c;
      prev.v += b.v;
    }
  }
  return [...buckets.values()].sort((a, b) => a.t - b.t);
}

function utcWeekStart(tsMs: number): number {
  const d = new Date(utcDayStart(tsMs));
  const dow = (d.getUTCDay() + 6) % 7; // Monday = 0
  return d.getTime() - dow * 86_400_000;
}

/** annualized realized volatility (%) from close-to-close log returns. */
function realizedVolPct(candles: OHLCVCandle[], barsPerYear: number): number | null {
  const closes = candles.map((c) => c.c).filter((x) => Number.isFinite(x) && x > 0);
  if (closes.length < 20) return null;
  const rets: number[] = [];
  for (let i = 1; i < closes.length; i++) rets.push(Math.log(closes[i] / closes[i - 1]));
  const n = rets.length;
  const mean = rets.reduce((s, r) => s + r, 0) / n;
  const varr = rets.reduce((s, r) => s + (r - mean) ** 2, 0) / Math.max(1, n - 1);
  return Math.sqrt(varr) * Math.sqrt(barsPerYear) * 100;
}

/** ATR(14) on the given series plus its percentile rank vs the trailing window. */
function atrStats(candles: OHLCVCandle[]) {
  if (candles.length < 40) return { atr: null as number | null, pctRank: null as number | null };
  const trs: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    const c = candles[i];
    const p = candles[i - 1];
    trs.push(Math.max(c.h - c.l, Math.abs(c.h - p.c), Math.abs(c.l - p.c)));
  }
  // Wilder ATR(14) over the last 90 TRs + percentile of the current ATR
  const win = trs.slice(-90);
  if (win.length < 30) return { atr: null, pctRank: null };
  const atrOf = (arr: number[]) => {
    let a = arr.slice(0, 14).reduce((s, x) => s + x, 0) / 14;
    for (let i = 14; i < arr.length; i++) a = (a * 13 + arr[i]) / 14;
    return a;
  };
  const curAtr = atrOf(win);
  const ranked = win.map((_, i) => (i + 14 <= win.length ? atrOf(win.slice(0, i + 14)) : null)).filter((x): x is number => x != null);
  const pctRank = ranked.length >= 20 ? (ranked.filter((x) => x <= curAtr).length / ranked.length) * 100 : null;
  return { atr: curAtr, pctRank };
}

/** RVOL: latest bar volume vs the trailing 20-bar median (>=1 = elevated). */
function rvol(candles: OHLCVCandle[]): number | null {
  if (candles.length < 22) return null;
  const hist = candles.slice(-21, -1).map((c) => c.v).sort((a, b) => a - b);
  const median = hist[Math.floor(hist.length / 2)];
  if (!(median > 0)) return null;
  return candles[candles.length - 1].v / median;
}

/** VWAP over an explicit [from,to) UTC window. */
function windowVwap(candles: OHLCVCandle[], fromMs: number, toMs: number): number | null {
  let pv = 0;
  let vv = 0;
  for (const c of candles) {
    if (c.t < fromMs || c.t >= toMs) continue;
    const tp = (c.h + c.l + c.c) / 3;
    pv += tp * c.v;
    vv += c.v;
  }
  return vv > 0 ? pv / vv : null;
}

export async function buildMarketSnapshot(symRaw: string): Promise<MarketSnapshot> {
  const sym = symRaw.trim().toUpperCase();
  const hit = cache.get(sym);
  if (hit && Date.now() - hit.at < TTL) {
    if (hit.snap) return hit.snap;
    throw hit.err ?? new Error("snapshot unavailable");
  }
  const cgSym = resolveCgSym(sym);
  const cfg: AssetCfg | undefined = assetOf(cgSym) ?? assetOf(sym);
  const classicCfg = classicOf(sym);
  await getUniverse();
  const hasBin = isAsset(cgSym) || isBinanceSym(cgSym) || !!classicCfg?.binPair;

  let m15: OHLCVCandle[] = [];
  let h1: OHLCVCandle[] = [];
  let h4: OHLCVCandle[] = [];
  let d1: OHLCVCandle[] = [];
  let source = "coinglass";

  // 1) Coinglass primary for any Binance-listed perpetual
  if (hasBin) {
    const lead = leadInstr(sym);
    try {
      const [m15Raw, h1Raw, h4Raw, d1Raw] = await Promise.all([
        fetchKlines(lead, "m15", 1000),
        fetchKlines(lead, "h1", 1000),
        fetchKlines(lead, "h4", 500),
        fetchKlines(lead, "d1", 500),
      ]);
      m15 = toCandles(m15Raw);
      h1 = toCandles(h1Raw);
      h4 = toCandles(h4Raw);
      d1 = toCandles(d1Raw);
    } catch {
      m15 = [];
    }
    // 2) Fallback directly to Binance USDT-M klines if Coinglass omits/rate-limits
    if (!m15.length) {
      try {
        [m15, h1, h4, d1] = await Promise.all([
          fetchBinCandles(sym, "m15", 1000),
          fetchBinCandles(sym, "h1", 1000),
          fetchBinCandles(sym, "h4", 500),
          fetchBinCandles(sym, "d1", 500),
        ]);
        if (m15.length) source = "binance-fapi";
      } catch {
        m15 = [];
      }
    }
  }

  // 3) Hyperliquid xyz fallback (indices: SPX500, NDX100, JP225, etc.)
  const hlCoin = hlCoinOf(sym);
  if (!m15.length && hlCoin) {
    try {
      [m15, h1, h4, d1] = await Promise.all([
        fetchHlCandles(hlCoin, "m15", 800),
        fetchHlCandles(hlCoin, "h1", 800),
        fetchHlCandles(hlCoin, "h4", 400),
        fetchHlCandles(hlCoin, "d1", 300),
      ]);
      if (m15.length) source = "hl-xyz";
    } catch {
      m15 = [];
    }
  }

  // 4) Yahoo Finance fallback for classic benchmarks without crypto rail (US30, VIX, GER30...)
  const yfInfo = resolveClassicYahooTicker(sym);
  if (!m15.length && yfInfo) {
    try {
      const [ym15, yh1, yd1] = await Promise.all([
        fetchYahooCandles(yfInfo.yahoo, "15m", "5d"),
        fetchYahooCandles(yfInfo.yahoo, "1h", "1mo"),
        fetchYahooCandles(yfInfo.yahoo, "1d", "2y"),
      ]);
      m15 = ym15;
      h1 = yh1.length ? yh1 : ym15;
      h4 = yh1.length ? rollupCandles(yh1, 4 * 3_600_000) : [];
      d1 = yd1;
      if (m15.length) source = "yahoo";
    } catch {
      m15 = [];
    }
  }

  if (!m15.length) throw new Error(`no klines for ${sym}`);
  const now = Date.now();
  const dayStart = utcDayStart(now);
  const weekStart = utcWeekStart(now);

  const last = m15[m15.length - 1];
  const prevDayBars = m15.filter((c) => c.t < dayStart);
  const prevDayClose = prevDayBars.length ? prevDayBars[prevDayBars.length - 1].c : null;
  const dayBars = m15.filter((c) => c.t >= dayStart);

  // previous day / week highs+llows from the daily series (d1 has full history
  // even when the intraday window doesn't reach back a full day)
  const prevD1 = d1.length >= 2 ? d1[d1.length - 2] : null;
  const prevWeekD1 = (() => {
    const pw = d1.filter((c) => c.t < weekStart);
    return pw.length ? pw[pw.length - 1] : null;
  })();

  // session VWAPs — trailing UTC 8h blocks (Asia 00-08 · London 08-16 · NY 16-24)
  const todayH1 = h1.length ? h1 : m15;
  const dayOf = (ts: number) => utcDayStart(ts);
  const sessionVwapFor = (block: 0 | 1 | 2) => {
    const b0 = dayOf(now) + block * 8 * 3_600_000;
    const b1 = b0 + 8 * 3_600_000;
    let v = windowVwap(todayH1, b0, b1);
    if (v == null) {
      // yesterday's same block when today's hasn't printed yet
      const y0 = b0 - 86_400_000;
      v = windowVwap(todayH1, y0, y0 + 8 * 3_600_000);
    }
    return v;
  };

  const closesOf = (arr: OHLCVCandle[]) => arr.map((c) => c.c);
  const emaSet = (arr: OHLCVCandle[]) => ({
    e13: emaLast(closesOf(arr), 13),
    e89: emaLast(closesOf(arr), 89),
    e233: emaLast(closesOf(arr), 233),
  });

  // volatility block — h1 ATR(14)/RV, h1 7d (168 bars) & 30d (720) realized vol
  const atrH1 = atrStats(h1.length >= 40 ? h1 : m15);
  const atrState =
    atrH1.pctRank == null ? null : atrH1.pctRank < 20 ? ("squeeze" as const) : atrH1.pctRank > 80 ? ("expansion" as const) : ("normal" as const);
  const rvH1 = realizedVolPct(h1, 24 * 365);

  const candleAt = last.t;
  const ageMs = now - candleAt;
  const stale = ageMs > 3 * 15 * 60_000;

  const snap: MarketSnapshot = {
    ok: true,
    sym,
    name: cfg?.name ?? classicCfg?.name ?? sym,
    kind: cfg?.kind ?? classicCfg?.klass ?? "crypto",
    source,
    priceDecs: symDecs(sym, last.c),
    price: {
      last: last.c,
      prevDayClose,
      chgDayPct: prevDayClose ? ((last.c - prevDayClose) / prevDayClose) * 100 : null,
      dayHigh: dayBars.length ? Math.max(...dayBars.map((c) => c.h)) : null,
      dayLow: dayBars.length ? Math.min(...dayBars.map((c) => c.l)) : null,
      dayVolBase: dayBars.reduce((s, c) => s + c.v, 0),
    },
    auction: auctionLevels(m15, h1.length ? h1 : m15, now),
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
    levels: {
      pdh: prevD1?.h ?? (prevDayBars.length ? Math.max(...prevDayBars.map((c) => c.h)) : null),
      pdl: prevD1?.l ?? (prevDayBars.length ? Math.min(...prevDayBars.map((c) => c.l)) : null),
      pwh: prevWeekD1?.h ?? null,
      pwl: prevWeekD1?.l ?? null,
      sessionVwaps: { asia: sessionVwapFor(0), london: sessionVwapFor(1), ny: sessionVwapFor(2) },
    },
    vol: {
      rv7dPct: rvH1 == null ? null : realizedVolPct(h1.slice(-168), 24 * 365) ?? rvH1,
      rv30dPct: realizedVolPct(h1.slice(-720), 24 * 365),
      atr14H1: atrH1.atr,
      atr14PctRank: atrH1.pctRank,
      atrState,
      rvolHour: rvol(h1.length >= 22 ? h1 : rollupCandles(m15, 3_600_000)),
      rvolBar15m: rvol(m15),
    },
    anchorInfo: { dayStart, monthStart: utcMonthStart(now) },
    candleAt,
    dataAt: now,
    ageMs,
    stale,
    updatedAt: now,
  };
  cache.set(sym, { at: Date.now(), snap });
  return snap;
}

export function marketCacheInfo() {
  return [...cache.entries()].map(([sym, e]) => ({ sym, ageMs: Date.now() - e.at, ok: !!e.snap }));
}
