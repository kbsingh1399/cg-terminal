/**
 * HISTORICAL WALK-FORWARD BACKTEST & CALIBRATION ENGINE (WS3, 2026-11-12).
 *
 * Replays REAL historical Binance USDT-M klines (15m execution + rolled h4/d1
 * context) and funding-rate history across the Curated-58 perps, simulating
 * BOTH narrative models strictly walk-forward:
 *
 *   M1_TREND_PULLBACK — arm a limit zone when the H4 EMA stack (13>89>233)
 *     and D1 EMA13×89 agree on trend and price sits within reach of the value
 *     zone (max(Day VWAP, H4 EMA89)); fill on the touch, stop at structural
 *     invalidation, 48 h TTL.
 *   M2_MEAN_REVERSION — market entry when close exits Day-VWAP ±σMult·σ with
 *     an exhaustion/reversal proof (RSI(h1) extreme or high-volume wick
 *     rejection — kline-honest proxies for the live footprint gate), stop
 *     beyond ±3σ, 18 h TTL.
 *
 * ZERO LOOK-AHEAD: higher-TF EMAs only use COMPLETED h4/d1 bars; the day VWAP
 * is cumulative within the UTC day up to the signal bar; signals fire on bar
 * close and execute from the NEXT bar; funding is charged at the historical
 * 8 h funding events that fall inside the holding window.
 *
 * HONEST EXECUTION ACCOUNTING (conservative by construction):
 *   - intrabar stop-first: if a bar contains both stop and target, the STOP
 *     wins (documented worst-case; no optimistic same-bar target fills);
 *   - taker fee 4.5 bps/side, maker fee 2 bps/side (M1 entry + all target
 *     exits are maker; market entries, stops and TTL closes are taker);
 *   - slippage = venue-tier spread (major 2 / crypto-alt 4 / TradFi 6 bps)
 *     + 0.05 × ATR% (ATR-scaled impact), applied adversely on every
 *     non-maker execution;
 *   - funding: the real historical 8 h rate at each event inside the hold,
 *     paid by the long side when positive (mirrored for shorts).
 *
 * Outputs: per-model / per-regime / per-tier metrics (fill rate, win rate,
 * profit factor, net expectancy R, Sharpe/Sortino, max drawdown, MFE/MAE
 * percentiles), a parameter sensitivity grid, and empirical calibration
 * curves + a 1-D logit fit (outcome ~ σ(a + b·logit(prior))) persisted to
 * data/cg-series/calibration.json — the bridge probability.ts blends in with
 * Bayesian shrinkage w_emp = n / (n + 30).
 */

import fs from "fs";
import path from "path";
import { fapiFetch } from "../live/fapi";
import { resolveDataRoot } from "./store";
import { curatedPerps, type CuratedPerp } from "@/lib/universe/curated";

// ---------------------------------------------------------------------------
// types
// ---------------------------------------------------------------------------

export interface BtCandle {
  t: number; // bar OPEN time (ms)
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
  /** taker buy base volume (bar-level footprint proxy) */
  tb: number;
}

export type BtSide = "long" | "short";
export type BtModel = "M1_TREND_PULLBACK" | "M2_MEAN_REVERSION";
export type BtTier = "crypto-major" | "crypto-alt" | "tradfi";

export interface BtTrade {
  sym: string;
  model: BtModel;
  tier: BtTier;
  side: BtSide;
  regime: "TREND_UP" | "TREND_DOWN" | "STRETCH";
  armedAt: number;
  fillAt: number | null;
  exitAt: number | null;
  entry: number | null;
  stop: number;
  t1: number;
  t2: number;
  exit: number | null;
  exitReason: "T1" | "T2" | "STOP" | "TTL" | "UNFILLED" | null;
  grossR: number | null;
  netR: number | null;
  feeBps: number;
  slipBps: number;
  fundingR: number | null;
  mfeR: number | null;
  maeR: number | null;
  /** driftless geometric prior P(T1 first) the probability engine would quote */
  priorP1: number | null;
  holdH: number | null;
}

export interface BtParams {
  days: number;
  /** M1: minimum R to T1 (sensitivity axis) */
  m1RFilter: number;
  /** M1: pullback zone reach (ATR multiples) */
  m1ZoneReachAtr: number;
  /** M2: VWAP stretch threshold in σ (sensitivity axis) */
  m2Sigma: number;
  takerFeeBps: number;
  makerFeeBps: number;
  majorSpreadBps: number;
  altSpreadBps: number;
  tradfiSpreadBps: number;
  /** slippage = spread + atrImpactFactor × ATR% (bps) */
  atrImpactFactor: number;
  m1TtlH: number;
  m2TtlH: number;
}

export const DEFAULT_BT_PARAMS: BtParams = {
  days: 30,
  m1RFilter: 1.5,
  m1ZoneReachAtr: 1.5,
  m2Sigma: 2.0,
  takerFeeBps: 4.5,
  makerFeeBps: 2.0,
  majorSpreadBps: 2,
  altSpreadBps: 4,
  tradfiSpreadBps: 6,
  atrImpactFactor: 0.05,
  m1TtlH: 48,
  m2TtlH: 18,
};

export interface BtMetrics {
  trades: number;
  armed: number;
  filled: number;
  fillRatePct: number | null;
  wins: number;
  losses: number;
  winRatePct: number | null;
  profitFactor: number | null;
  expectancyGrossR: number | null;
  expectancyNetR: number | null;
  totalNetR: number;
  sharpePerTrade: number | null;
  sortinoPerTrade: number | null;
  maxDrawdownR: number;
  maxDrawdownPct: number | null;
  mfe: { p25: number | null; p50: number | null; p75: number | null };
  mae: { p25: number | null; p50: number | null; p75: number | null };
  avgHoldH: number | null;
}

export interface BtCalibBin {
  priorBin: string;
  n: number;
  empiricalWinRate: number | null;
  avgNetR: number | null;
}

export interface BtCalibCurve {
  model: BtModel;
  regime: string;
  tier: string;
  n: number;
  fillRate: number | null;
  winRate: number | null;
  avgNetR: number | null;
  /** 1-D logistic fit: P(T1 first) ≈ σ(intercept + slope·logit(prior)) */
  logitFit: { slope: number; intercept: number; n: number; converged: boolean } | null;
  bins: BtCalibBin[];
}

export interface BtAssetCoverage {
  sym: string;
  bars: number;
  firstBar: number | null;
  lastBar: number | null;
  expectedBars: number;
  coveragePct: number;
  fundingEvents: number;
}

export interface BtSensCell {
  axis: "m2Sigma" | "m1RFilter";
  value: number;
  model: BtModel;
  metrics: BtMetrics;
}

export interface BtRunResult {
  ok: boolean;
  generatedAt: number;
  params: BtParams;
  universe: string[];
  coverage: BtAssetCoverage[];
  trades: BtTrade[];
  equity: { t: number; cumNetR: number }[];
  metricsAll: BtMetrics;
  byModel: Record<string, BtMetrics>;
  byRegime: Record<string, BtMetrics>;
  byTier: Record<string, BtMetrics>;
  byMonth: Record<string, BtMetrics>;
  sensitivity: BtSensCell[];
  calibration: BtCalibCurve[];
  /** standard freshness telemetry */
  dataAt: number;
  ageMs: number;
  stale: boolean;
  source: string;
}

// ---------------------------------------------------------------------------
// persistence locations
// ---------------------------------------------------------------------------

const ROOT = resolveDataRoot();
const KLINE_DIR = path.join(path.dirname(ROOT), "cg-backtest", "klines");
const RESULT_FILE = path.join(ROOT, "backtest-last.json");
const CALIB_FILE = path.join(ROOT, "calibration.json");

export function calibrationPath(): string {
  return CALIB_FILE;
}

// ---------------------------------------------------------------------------
// historical data loading (paginated fapi + disk cache)
// ---------------------------------------------------------------------------

const ITV_MS: Record<string, number> = { "15m": 900_000, "1h": 3_600_000, "4h": 14_400_000, "1d": 86_400_000 };

async function fetchKlinesPaged(pair: string, interval: "15m" | "4h" | "1h" | "1d", startTime: number, endTime: number): Promise<BtCandle[]> {
  const out: BtCandle[] = [];
  let cursor = startTime;
  for (let page = 0; page < 40; page++) {
    const rows = (await fapiFetch(
      `/fapi/v1/klines?symbol=${encodeURIComponent(pair)}&interval=${interval}&startTime=${cursor}&endTime=${endTime}&limit=1500`,
      15_000
    )) as (string | number)[][];
    if (!Array.isArray(rows) || !rows.length) break;
    for (const r of rows) {
      const t = Number(r[0]);
      const c = Number(r[4]);
      if (!Number.isFinite(t) || !Number.isFinite(c) || c <= 0) continue;
      out.push({ t, o: Number(r[1]), h: Number(r[2]), l: Number(r[3]), c, v: Number(r[5]) || 0, tb: Number(r[9]) || 0 });
    }
    const lastOpen = Number(rows[rows.length - 1][0]);
    const next = lastOpen + (ITV_MS[interval] ?? 900_000);
    if (next >= endTime || rows.length < 1500) break;
    cursor = next;
  }
  return out;
}

interface KlineCache {
  fetchedAt: number;
  from: number;
  to: number;
  candles: BtCandle[];
}

const KL_TTL = 12 * 3600_000; // historical tails barely move — refresh 12 h

async function loadKlines(a: CuratedPerp, interval: "15m" | "4h" | "1h" | "1d", from: number, to: number): Promise<BtCandle[]> {
  fs.mkdirSync(KLINE_DIR, { recursive: true });
  const f = path.join(KLINE_DIR, `${a.pair}-${interval}.json`);
  let cache: KlineCache | null = null;
  try {
    cache = JSON.parse(fs.readFileSync(f, "utf8")) as KlineCache;
  } catch {
    cache = null;
  }
  if (cache && Date.now() - cache.fetchedAt < KL_TTL && cache.from <= from && cache.to >= to - ITV_MS[interval]) {
    return cache.candles.filter((c) => c.t >= from && c.t < to);
  }
  const candles = await fetchKlinesPaged(a.pair, interval, from, to);
  if (candles.length) {
    const merged = [...(cache && cache.from < from ? cache.candles.filter((c) => c.t < from) : []), ...candles];
    const body: KlineCache = { fetchedAt: Date.now(), from: Math.min(from, cache?.from ?? from), to, candles: merged };
    try {
      fs.writeFileSync(f, JSON.stringify(body));
    } catch {
      /* cache write is best-effort */
    }
  }
  return candles;
}

/** historical 8 h funding events in [from, to) — /fapi/v1/fundingRate */
export async function loadFundingHistory(pair: string, from: number, to: number): Promise<{ t: number; rate: number }[]> {
  const out: { t: number; rate: number }[] = [];
  let cursor = from;
  for (let page = 0; page < 10; page++) {
    const rows = (await fapiFetch(
      `/fapi/v1/fundingRate?symbol=${encodeURIComponent(pair)}&startTime=${cursor}&endTime=${to}&limit=1000`,
      15_000
    )) as { fundingTime?: number; fundingRate?: string }[];
    if (!Array.isArray(rows) || !rows.length) break;
    for (const r of rows) {
      const t = Number(r.fundingTime);
      const rate = Number(r.fundingRate);
      if (Number.isFinite(t) && Number.isFinite(rate)) out.push({ t, rate });
    }
    const last = Number(rows[rows.length - 1]?.fundingTime ?? 0);
    if (!last || rows.length < 1000 || last >= to) break;
    cursor = last + 1;
  }
  return out.sort((a, b) => a.t - b.t);
}

// ---------------------------------------------------------------------------
// indicators (identical conventions to src/lib/cg/indicators.ts)
// ---------------------------------------------------------------------------

function emaArr(values: number[], period: number): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null);
  if (values.length < period || period <= 0) return out;
  const k = 2 / (period + 1);
  let sum = 0;
  for (let i = 0; i < period; i++) sum += values[i];
  let prev = sum / period;
  out[period - 1] = prev;
  for (let i = period; i < values.length; i++) {
    prev = values[i] * k + prev * (1 - k);
    out[i] = prev;
  }
  return out;
}

/** Wilder ATR(14) series over candles */
function atrSeries(c: BtCandle[], period = 14): (number | null)[] {
  const out: (number | null)[] = new Array(c.length).fill(null);
  if (c.length <= period) return out;
  const tr: number[] = [0];
  for (let i = 1; i < c.length; i++) {
    tr.push(Math.max(c[i].h - c[i].l, Math.abs(c[i].h - c[i - 1].c), Math.abs(c[i].l - c[i - 1].c)));
  }
  let a = tr.slice(1, period + 1).reduce((s, x) => s + x, 0) / period;
  out[period] = a;
  for (let i = period + 1; i < c.length; i++) {
    a = (a * (period - 1) + tr[i]) / period;
    out[i] = a;
  }
  return out;
}

function rsiOf(closes: number[], period = 14): number | null {
  if (closes.length <= period) return null;
  let gain = 0;
  let loss = 0;
  for (let i = closes.length - period; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    if (d >= 0) gain += d;
    else loss -= d;
  }
  let avgG = gain / period;
  let avgL = loss / period;
  // Wilder smoothing over the remaining history (walk back period by period is
  // unnecessary for a threshold check — the simple mean over the window is the
  // documented backtest proxy; live narrative RSI uses the full Wilder series)
  return avgL === 0 ? 100 : 100 - 100 / (1 + avgG / avgL);
}

function utcDayStart(tsMs: number): number {
  const d = new Date(tsMs);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

// ---------------------------------------------------------------------------
// context arrays (strictly completed-bar, no look-ahead)
// ---------------------------------------------------------------------------

interface HtEma {
  /** close time of the completed HTF bar → ema value */
  at: number;
  e13: number;
  e89: number;
  e233: number | null;
}

/** roll 15m candles up to `stepMs` bars and compute EMA 13/89/233 series,
 *  indexed by the CLOSE time of each completed rollup bar */
function rollupEmas(m15: BtCandle[], stepMs: number): HtEma[] {
  const buckets = new Map<number, BtCandle>();
  for (const b of m15) {
    const k = Math.floor(b.t / stepMs) * stepMs;
    const prev = buckets.get(k);
    if (!prev) buckets.set(k, { t: k, o: b.o, h: b.h, l: b.l, c: b.c, v: b.v, tb: b.tb });
    else {
      prev.h = Math.max(prev.h, b.h);
      prev.l = Math.min(prev.l, b.l);
      prev.c = b.c;
      prev.v += b.v;
      prev.tb += b.tb;
    }
  }
  const bars = [...buckets.values()].sort((a, b) => a.t - b.t);
  const closes = bars.map((b) => b.c);
  const e13 = emaArr(closes, 13);
  const e89 = emaArr(closes, 89);
  const e233 = emaArr(closes, 233);
  const out: HtEma[] = [];
  for (let i = 0; i < bars.length; i++) {
    if (e13[i] == null || e89[i] == null) continue;
    out.push({ at: bars[i].t + stepMs, e13: e13[i] as number, e89: e89[i] as number, e233: e233[i] });
  }
  return out;
}

/** binary search: latest entry with `at` <= t (completed HTF bar at time t) */
function latestBefore(arr: HtEma[], t: number): HtEma | null {
  let lo = 0;
  let hi = arr.length - 1;
  let best: HtEma | null = null;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (arr[mid].at <= t) {
      best = arr[mid];
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return best;
}

/** cumulative day VWAP + σ for every 15m bar, using only that day's bars up to
 *  and including the signal bar (walk-forward). σ² = Σv·p²/Σv − vwap². */
interface DayVwapAt {
  vwap: number;
  sd: number;
  bars: number;
}
function dayVwapSeries(m15: BtCandle[]): (DayVwapAt | null)[] {
  const out: (DayVwapAt | null)[] = new Array(m15.length).fill(null);
  let day = -1;
  let sv = 0;
  let svp = 0;
  let svp2 = 0;
  let bars = 0;
  for (let i = 0; i < m15.length; i++) {
    const b = m15[i];
    const d = utcDayStart(b.t);
    if (d !== day) {
      day = d;
      sv = 0;
      svp = 0;
      svp2 = 0;
      bars = 0;
    }
    if (b.v > 0) {
      const tp = (b.h + b.l + b.c) / 3;
      sv += b.v;
      svp += b.v * tp;
      svp2 += b.v * tp * tp;
      bars++;
    }
    if (sv > 0 && bars >= 8) {
      const vwap = svp / sv;
      const sd = Math.sqrt(Math.max(0, svp2 / sv - vwap * vwap));
      out[i] = { vwap, sd, bars };
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// execution simulator (both models, shared exit accounting)
// ---------------------------------------------------------------------------

function tierOf(sym: string, kind: string): BtTier {
  if (kind === "tradfi-perp") return "tradfi";
  return sym === "BTC" || sym === "ETH" || sym === "SOL" ? "crypto-major" : "crypto-alt";
}

function spreadBps(tier: BtTier, p: BtParams): number {
  return tier === "crypto-major" ? p.majorSpreadBps : tier === "crypto-alt" ? p.altSpreadBps : p.tradfiSpreadBps;
}

/** 1-D logistic fit y ∈ {0,1} ~ σ(a + b·x), Newton–Raphson with ridge guard */
export function logitFit(xs: number[], ys: number[]): { slope: number; intercept: number; n: number; converged: boolean } {
  const n = xs.length;
  if (n < 30) return { slope: 1, intercept: 0, n, converged: false };
  let b = 0;
  let a = Math.log(Math.min(0.999, Math.max(0.001, ys.reduce((s, y) => s + y, 0) / n)) / (1 - Math.min(0.999, Math.max(0.001, ys.reduce((s, y) => s + y, 0) / n))));
  let converged = false;
  for (let iter = 0; iter < 60; iter++) {
    let gA = 0;
    let gB = 0;
    let hAA = 1e-6;
    let hBB = 1e-6;
    let hAB = 0;
    for (let i = 0; i < n; i++) {
      const p = 1 / (1 + Math.exp(-(a + b * xs[i])));
      const w = p * (1 - p) + 1e-9;
      gA += ys[i] - p;
      gB += xs[i] * (ys[i] - p);
      hAA += w;
      hBB += w * xs[i] * xs[i];
      hAB += w * xs[i];
    }
    const det = hAA * hBB - hAB * hAB;
    if (!Number.isFinite(det) || Math.abs(det) < 1e-12) break;
    const dA = (hBB * gA - hAB * gB) / det;
    const dB = (hAA * gB - hAB * gA) / det;
    a += Math.max(-1, Math.min(1, dA));
    b += Math.max(-1, Math.min(1, dB));
    if (Math.abs(dA) < 1e-8 && Math.abs(dB) < 1e-8) {
      converged = true;
      break;
    }
  }
  return { slope: Number(b.toFixed(4)), intercept: Number(a.toFixed(4)), n, converged };
}

interface SimExit {
  exit: number;
  exitAt: number;
  exitReason: "T1" | "T2" | "STOP" | "TTL";
  grossR: number;
  fundingR: number;
  mfeR: number;
  maeR: number;
  holdH: number;
}

/**
 * Shared post-fill accounting. Walks bars strictly after the fill bar.
 * STOP-FIRST: a bar containing both stop and any target resolves as STOP.
 * Funding is charged at each historical 8 h event inside (fillAt, exitAt].
 */
function simulateExit(args: {
  m15: BtCandle[];
  fromIdx: number;
  side: BtSide;
  entry: number;
  stop: number;
  t1: number;
  t2: number;
  ttlMs: number;
  fillAt: number;
  funding: { t: number; rate: number }[];
  fundingFromIdx: number;
}): SimExit | null {
  const { m15, fromIdx, side, entry, stop, t1, t2, ttlMs, fillAt, funding } = args;
  const long = side === "long";
  const risk = Math.abs(entry - stop);
  if (!(risk > 0)) return null;
  const deadline = fillAt + ttlMs;
  let mfe = 0;
  let mae = 0;
  let fundR = 0;
  let fIdx = args.fundingFromIdx;
  for (let i = fromIdx; i < m15.length; i++) {
    const b = m15[i];
    if (b.t >= deadline) {
      // TTL close at this bar's open (mark), taker
      const exit = b.o;
      const grossR = long ? (exit - entry) / risk : (entry - exit) / risk;
      return { exit, exitAt: b.t, exitReason: "TTL", grossR, fundingR: fundR, mfeR: mfe, maeR: mae, holdH: (b.t - fillAt) / 3_600_000 };
    }
    // funding events inside (prevBarOpen, thisBarOpen]
    while (fIdx < funding.length && funding[fIdx].t <= b.t) {
      const ev = funding[fIdx];
      if (ev.t > fillAt) {
        // long pays positive funding; short receives it
        const px = m15[Math.max(0, i - 1)].c;
        fundR += ((long ? -1 : 1) * ev.rate * px) / risk;
      }
      fIdx++;
    }
    const favR = (long ? b.h - entry : entry - b.l) / risk;
    const advR = (long ? b.l - entry : entry - b.h) / risk;
    if (favR > mfe) mfe = favR;
    if (advR < mae) mae = advR;
    const stopHit = long ? b.l <= stop : b.h >= stop;
    const t1Hit = long ? b.h >= t1 : b.l <= t1;
    const t2Hit = long ? b.h >= t2 : b.l <= t2;
    if (stopHit) {
      // STOP FIRST — conservative: if both stop and target lie inside this
      // bar, the stop wins unless the bar's O→C path resolves it unambiguously
      // (open beyond target and close beyond target with stop never crossed).
      const unambigT = long ? b.o >= t1 && b.c >= t1 && b.l > stop : b.o <= t1 && b.c <= t1 && b.h < stop;
      if (t1Hit && unambigT) {
        return { exit: t1, exitAt: b.t, exitReason: "T1", grossR: Math.abs(t1 - entry) / risk, fundingR: fundR, mfeR: mfe, maeR: mae, holdH: (b.t - fillAt) / 3_600_000 };
      }
      return { exit: stop, exitAt: b.t, exitReason: "STOP", grossR: -1, fundingR: fundR, mfeR: mfe, maeR: mae, holdH: (b.t - fillAt) / 3_600_000 };
    }
    if (t2Hit) {
      return { exit: t2, exitAt: b.t, exitReason: "T2", grossR: Math.abs(t2 - entry) / risk, fundingR: fundR, mfeR: mfe, maeR: mae, holdH: (b.t - fillAt) / 3_600_000 };
    }
    if (t1Hit) {
      return { exit: t1, exitAt: b.t, exitReason: "T1", grossR: Math.abs(t1 - entry) / risk, fundingR: fundR, mfeR: mfe, maeR: mae, holdH: (b.t - fillAt) / 3_600_000 };
    }
  }
  const last = m15[m15.length - 1];
  return { exit: last.c, exitAt: last.t, exitReason: "TTL", grossR: (long ? last.c - entry : entry - last.c) / risk, fundingR: fundR, mfeR: mfe, maeR: mae, holdH: (last.t - fillAt) / 3_600_000 };
}

// ---------------------------------------------------------------------------
// M1 + M2 walk-forward simulators
// ---------------------------------------------------------------------------

interface SimArgs {
  sym: string;
  tier: BtTier;
  m15: BtCandle[];
  /** native 4h candles (≥ 260 bars — EMA233 warmup), close-time indexed */
  h4: BtCandle[];
  /** native 1d candles (≥ 120 bars — EMA89 warmup), close-time indexed */
  d1: BtCandle[];
  funding: { t: number; rate: number }[];
  params: BtParams;
  /** override knobs (sensitivity grid) */
  m1RFilter?: number;
  m2Sigma?: number;
}

/** EMA 13/89/233 over NATIVE higher-TF candle closes, indexed by bar close time */
function nativeHtfEmas(candles: BtCandle[], stepMs: number): HtEma[] {
  const closes = candles.map((c) => c.c);
  const e13 = emaArr(closes, 13);
  const e89 = emaArr(closes, 89);
  const e233 = emaArr(closes, 233);
  const out: HtEma[] = [];
  for (let i = 0; i < candles.length; i++) {
    if (e13[i] == null || e89[i] == null) continue;
    out.push({ at: candles[i].t + stepMs, e13: e13[i] as number, e89: e89[i] as number, e233: e233[i] });
  }
  return out;
}

function simulateM1(args: SimArgs): BtTrade[] {
  const { sym, tier, m15, funding, params } = args;
  const rFilter = args.m1RFilter ?? params.m1RFilter;
  const h4 = nativeHtfEmas(args.h4, 4 * 3_600_000);
  const d1 = nativeHtfEmas(args.d1, 86_400_000);
  const atr15 = atrSeries(m15, 14); // 15m ATR for structural stop refinement
  const dv = dayVwapSeries(m15);
  const trades: BtTrade[] = [];
  const slipBps = spreadBps(tier, params); // ATR-scaled impact is added per-arm below
  const ttlMs = params.m1TtlH * 3_600_000;

  type Armed = {
    side: BtSide;
    entry: number;
    stop: number;
    t1: number;
    t2: number;
    armedAt: number;
    expiresAt: number;
    armedIdx: number;
    priorP1: number;
    atrPctBps: number;
  };
  let armed: Armed | null = null;

  for (let i = 200; i < m15.length; i++) {
    const b = m15[i];

    // ── manage the armed ticket first (execution from bars AFTER the arm) ──
    if (armed) {
      const a = armed;
      if (b.t > a.expiresAt) {
        trades.push({
          sym, model: "M1_TREND_PULLBACK", tier, side: a.side, regime: a.side === "long" ? "TREND_UP" : "TREND_DOWN",
          armedAt: a.armedAt, fillAt: null, exitAt: b.t, entry: null, stop: a.stop, t1: a.t1, t2: a.t2,
          exit: null, exitReason: "UNFILLED", grossR: null, netR: null,
          feeBps: 0, slipBps: 0, fundingR: null, mfeR: null, maeR: null, priorP1: a.priorP1, holdH: null,
        });
        armed = null;
      } else {
        const long = a.side === "long";
        const touched = long ? b.l <= a.entry : b.h >= a.entry;
        if (touched) {
          const risk = Math.abs(a.entry - a.stop);
          // fill at the zone (maker); conservative same-bar stop check after fill
          const slipFrac = (slipBps + params.atrImpactFactor * a.atrPctBps) / 10_000;
          const fillPx = long ? a.entry * (1 - slipFrac) : a.entry * (1 + slipFrac);
          let exitRes: SimExit | null;
          const stopSameBar = long ? b.l <= a.stop : b.h >= a.stop;
          if (stopSameBar) {
            exitRes = { exit: a.stop, exitAt: b.t, exitReason: "STOP", grossR: -1, fundingR: 0, mfeR: 0, maeR: -1, holdH: (b.t - a.armedAt) / 3_600_000 };
          } else {
            exitRes = simulateExit({ m15, fromIdx: i + 1, side: a.side, entry: fillPx, stop: a.stop, t1: a.t1, t2: a.t2, ttlMs, fillAt: b.t, funding, fundingFromIdx: 0 });
          }
          const fEntry = params.makerFeeBps / 10_000; // resting limit = maker
          const fExit = exitRes?.exitReason === "T1" || exitRes?.exitReason === "T2" ? params.makerFeeBps / 10_000 : params.takerFeeBps / 10_000;
          const slipExit = exitRes && exitRes.exitReason !== "T1" && exitRes.exitReason !== "T2" ? (slipBps + params.atrImpactFactor * a.atrPctBps) / 10_000 : 0;
          if (exitRes) {
            // fee/slippage/funding in R: bps on notional converted via the real risk distance
            const feeR = ((fEntry + fExit) * fillPx + slipExit * exitRes.exit) / risk;
            const netR = exitRes.grossR - feeR - exitRes.fundingR;
            trades.push({
              sym, model: "M1_TREND_PULLBACK", tier, side: a.side, regime: a.side === "long" ? "TREND_UP" : "TREND_DOWN",
              armedAt: a.armedAt, fillAt: b.t, exitAt: exitRes.exitAt, entry: fillPx, stop: a.stop, t1: a.t1, t2: a.t2,
              exit: exitRes.exit, exitReason: exitRes.exitReason, grossR: exitRes.grossR, netR,
              feeBps: Math.round((fEntry + fExit) * 10_000), slipBps: Math.round(slipExit * 10_000),
              fundingR: Number(exitRes.fundingR.toFixed(4)), mfeR: exitRes.mfeR, maeR: exitRes.maeR, priorP1: a.priorP1, holdH: exitRes.holdH,
            });
          }
          armed = null;
        }
      }
    }

    // ── arm a new ticket (signal on bar close, no position yet) ──
    if (armed || i >= m15.length - 1) continue;
    const h4e = latestBefore(h4, b.t + 900_000);
    const d1e = latestBefore(d1, b.t + 900_000);
    if (!h4e || h4e.e233 == null || !d1e) continue;
    const atr = atr15[i];
    const vwap = dv[i];
    if (atr == null || !vwap || vwap.sd <= 0) continue;
    const up = h4e.e13 > h4e.e89 && h4e.e89 > (h4e.e233 as number) && d1e.e13 > d1e.e89;
    const down = h4e.e13 < h4e.e89 && h4e.e89 < (h4e.e233 as number) && d1e.e13 < d1e.e89;
    if (!up && !down) continue;
    const long = up;
    // value zone: max(Day VWAP, H4 EMA89) below price (long) / min(...) above (short)
    const zone = long ? Math.max(vwap.vwap, h4e.e89) : Math.min(vwap.vwap, h4e.e89);
    const distToZone = long ? b.c - zone : zone - b.c;
    if (!(distToZone > 0) || distToZone > params.m1ZoneReachAtr * atr) continue;
    // structural stop: below/above the 20-bar swing + 0.5 ATR buffer
    const swing = long ? Math.min(...m15.slice(i - 20, i + 1).map((x) => x.l)) : Math.max(...m15.slice(i - 20, i + 1).map((x) => x.h));
    const stop = long ? Math.min(swing - 0.1 * atr, zone - 0.5 * atr) : Math.max(swing + 0.1 * atr, zone + 0.5 * atr);
    const entry = zone;
    const risk = Math.abs(entry - stop);
    if (!(risk > 0) || risk / entry > 0.25) continue; // garbage guard (25%)
    const t1 = long ? entry + rFilter * risk : entry - rFilter * risk;
    const t2 = long ? entry + 2 * risk : entry - 2 * risk;
    // driftless geometric prior (gambler's ruin from the fill frame)
    const span = Math.abs(t1 - stop);
    const priorP1 = span > 0 ? Math.min(0.98, Math.max(0.02, risk / span)) : 0.5;
    armed = {
      side: long ? "long" : "short", entry, stop, t1, t2, armedAt: b.t + 900_000, expiresAt: b.t + 900_000 + ttlMs, armedIdx: i,
      priorP1, atrPctBps: (atr / b.c) * 10_000,
    };
  }
  return trades;
}

function simulateM2(args: SimArgs): BtTrade[] {
  const { sym, tier, m15, funding, params } = args;
  const sigmaMult = args.m2Sigma ?? params.m2Sigma;
  const h1Rollo = rollupEmas(m15, 3_600_000); // h1 closes for the RSI exhaustion proxy
  const dv = dayVwapSeries(m15);
  const trades: BtTrade[] = [];
  const slipBps = spreadBps(tier, params);
  const ttlMs = params.m2TtlH * 3_600_000;
  let cooldownUntil = 0; // one M2 ticket at a time per symbol

  for (let i = 200; i < m15.length - 1; i++) {
    const b = m15[i];
    if (b.t < cooldownUntil) continue;
    const v = dv[i];
    if (!v || v.sd <= 0 || v.bars < 20) continue; // σ needs a mature day
    const z = (b.c - v.vwap) / v.sd;
    const long = z <= -sigmaMult;
    const short = z >= sigmaMult;
    if (!long && !short) continue;
    // exhaustion/reversal proof (kline-honest proxies for the live footprint gate):
    //  (a) RSI(h1 closes, 14) extreme against the stretch, OR
    //  (b) high-volume wick rejection: vol ≥ 1.5× trailing-20 median AND the
    //      bar closes back through its mid-range against the stretch
    const h1e = latestBefore(h1Rollo, b.t + 900_000);
    const h1Closes: number[] = [];
    if (h1e) {
      // rebuild closes of completed h1 bars up to now from m15 (cheap: 96 bars)
      const start = Math.max(0, i - 96);
      let prevKey = -1;
      for (let j = start; j <= i; j++) {
        const k = Math.floor(m15[j].t / 3_600_000) * 3_600_000;
        if (k !== prevKey) {
          h1Closes.push(m15[j].c);
          prevKey = k;
        } else h1Closes[h1Closes.length - 1] = m15[j].c;
      }
    }
    const rsi = rsiOf(h1Closes, 14);
    const hist = m15.slice(Math.max(0, i - 20), i).map((x) => x.v).sort((a, c) => a - c);
    const med = hist[Math.floor(hist.length / 2)] || 0;
    const volSpike = med > 0 && b.v >= 1.5 * med;
    const range = b.h - b.l;
    const closePos = range > 0 ? (b.c - b.l) / range : 0.5;
    const wickRej = volSpike && (long ? closePos >= 0.6 : closePos <= 0.4);
    const rsiExh = rsi != null && (long ? rsi <= 30 : rsi >= 70);
    if (!rsiExh && !wickRej) continue;

    // plan geometry (mirror of the narrative M2)
    const stop = long ? v.vwap - 3 * v.sd : v.vwap + 3 * v.sd;
    const t1 = long ? v.vwap - v.sd : v.vwap + v.sd;
    const t2 = v.vwap;
    const entry = m15[i + 1].o; // market entry at the NEXT bar open — zero look-ahead
    const risk = Math.abs(entry - stop);
    if (!(risk > 0) || risk / entry > 0.25) continue;
    const r1 = Math.abs(t1 - entry) / risk;
    const r2 = Math.abs(t2 - entry) / risk;
    if (r1 < 1.2 || r2 < 1.5) continue; // the narrative's hard R vetoes
    const span = Math.abs(t1 - stop);
    const priorP1 = span > 0 ? Math.min(0.98, Math.max(0.02, risk / span)) : null;

    const slipFrac = (slipBps + params.atrImpactFactor * ((v.sd / b.c) * 10_000)) / 10_000;
    const fillPx = long ? entry * (1 + slipFrac) : entry * (1 - slipFrac);
    const exitRes = simulateExit({ m15, fromIdx: i + 2, side: long ? "long" : "short", entry: fillPx, stop, t1, t2, ttlMs, fillAt: m15[i + 1].t, funding, fundingFromIdx: 0 });
    if (!exitRes) continue;
    const riskReal = Math.abs(fillPx - stop);
    const fEntry = params.takerFeeBps / 10_000;
    const fExit = exitRes.exitReason === "T1" || exitRes.exitReason === "T2" ? params.makerFeeBps / 10_000 : params.takerFeeBps / 10_000;
    const slipExit = exitRes.exitReason === "T1" || exitRes.exitReason === "T2" ? 0 : slipFrac;
    const feeR = (fEntry * fillPx + fExit * exitRes.exit + slipExit * exitRes.exit) / riskReal;
    const netR = exitRes.grossR - feeR - exitRes.fundingR;
    cooldownUntil = m15[i + 1].t + ttlMs;
    trades.push({
      sym, model: "M2_MEAN_REVERSION", tier, side: long ? "long" : "short", regime: "STRETCH",
      armedAt: b.t + 900_000, fillAt: m15[i + 1].t, exitAt: exitRes.exitAt,
      entry: fillPx, stop, t1, t2, exit: exitRes.exit, exitReason: exitRes.exitReason,
      grossR: exitRes.grossR, netR, feeBps: Math.round((fEntry + fExit) * 10_000), slipBps: Math.round(slipFrac * 20_000) / 2,
      fundingR: Number(exitRes.fundingR.toFixed(4)), mfeR: exitRes.mfeR, maeR: exitRes.maeR, priorP1, holdH: exitRes.holdH,
    });
  }
  return trades;
}

// ---------------------------------------------------------------------------
// metrics
// ---------------------------------------------------------------------------

function pct(values: number[], p: number): number | null {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const idx = Math.min(s.length - 1, Math.max(0, Math.round((p / 100) * (s.length - 1))));
  return s[idx];
}

export function computeMetrics(trades: BtTrade[]): BtMetrics {
  const armed = trades.length;
  const filled = trades.filter((t) => t.fillAt != null);
  const closed = filled.filter((t) => t.netR != null);
  const netRs = closed.map((t) => t.netR as number);
  const grossRs = closed.map((t) => t.grossR as number);
  const wins = netRs.filter((r) => r > 0).length;
  const losses = netRs.filter((r) => r <= 0).length;
  const grossWin = grossRs.filter((r) => r > 0).reduce((s, r) => s + r, 0);
  const grossLoss = Math.abs(grossRs.filter((r) => r <= 0).reduce((s, r) => s + r, 0));
  const mean = netRs.length ? netRs.reduce((s, r) => s + r, 0) / netRs.length : null;
  const std = netRs.length > 1 ? Math.sqrt(netRs.reduce((s, r) => s + (r - (mean as number)) ** 2, 0) / (netRs.length - 1)) : null;
  const downside = netRs.filter((r) => r < 0);
  const dstd = downside.length ? Math.sqrt(downside.reduce((s, r) => s + r * r, 0) / downside.length) : null;
  // equity curve (1% risk per trade compounding) → max drawdown R & %
  let cumR = 0;
  let peakR = 0;
  let maxDDr = 0;
  let eq = 1;
  let eqPeak = 1;
  let maxDDpct = 0;
  for (const r of netRs) {
    cumR += r;
    peakR = Math.max(peakR, cumR);
    maxDDr = Math.max(maxDDr, peakR - cumR);
    eq *= 1 + r * 0.01;
    eqPeak = Math.max(eqPeak, eq);
    maxDDpct = Math.max(maxDDpct, (eqPeak - eq) / eqPeak);
  }
  const mfe = closed.map((t) => t.mfeR).filter((x): x is number => x != null);
  const mae = closed.map((t) => t.maeR).filter((x): x is number => x != null);
  return {
    trades: closed.length,
    armed,
    filled: filled.length,
    fillRatePct: armed > 0 ? Number(((filled.length / armed) * 100).toFixed(1)) : null,
    wins,
    losses,
    winRatePct: closed.length ? Number(((wins / closed.length) * 100).toFixed(1)) : null,
    profitFactor: grossLoss > 0 ? Number((grossWin / grossLoss).toFixed(3)) : grossWin > 0 ? Infinity : null,
    expectancyGrossR: grossRs.length ? Number((grossRs.reduce((s, r) => s + r, 0) / grossRs.length).toFixed(4)) : null,
    expectancyNetR: mean != null ? Number(mean.toFixed(4)) : null,
    totalNetR: Number(cumR.toFixed(2)),
    sharpePerTrade: mean != null && std && std > 0 ? Number((mean / std).toFixed(3)) : null,
    sortinoPerTrade: mean != null && dstd && dstd > 0 ? Number((mean / dstd).toFixed(3)) : null,
    maxDrawdownR: Number(maxDDr.toFixed(2)),
    maxDrawdownPct: maxDDpct > 0 ? Number((maxDDpct * 100).toFixed(2)) : null,
    mfe: { p25: pct(mfe, 25), p50: pct(mfe, 50), p75: pct(mfe, 75) },
    mae: { p25: pct(mae, 25), p50: pct(mae, 50), p75: pct(mae, 75) },
    avgHoldH: closed.length ? Number((closed.reduce((s, t) => s + (t.holdH ?? 0), 0) / closed.length).toFixed(1)) : null,
  };
}

// ---------------------------------------------------------------------------
// calibration curves
// ---------------------------------------------------------------------------

export function calibrationCurves(trades: BtTrade[]): BtCalibCurve[] {
  const out: BtCalibCurve[] = [];
  const filled = trades.filter((t) => t.fillAt != null && t.netR != null && t.priorP1 != null);
  const groups = new Map<string, BtTrade[]>();
  for (const t of filled) {
    for (const key of [`${t.model}|all|all`, `${t.model}|${t.regime}|all`, `${t.model}|all|${t.tier}`, `${t.model}|${t.regime}|${t.tier}`]) {
      const arr = groups.get(key) ?? [];
      arr.push(t);
      groups.set(key, arr);
    }
  }
  for (const [key, arr] of groups) {
    if (arr.length < 10) continue;
    const [model, regime, tier] = key.split("|");
    const wins = arr.filter((t) => (t.grossR as number) > 0).length;
    const xs = arr.map((t) => Math.log((t.priorP1 as number) / (1 - (t.priorP1 as number))));
    const ys = arr.map((t) => ((t.grossR as number) > 0 ? 1 : 0));
    const bins: BtCalibBin[] = [];
    for (let lo = 0; lo < 1; lo += 0.2) {
      const inBin = arr.filter((t) => (t.priorP1 as number) >= lo && (t.priorP1 as number) < lo + 0.2);
      if (!inBin.length) continue;
      const bWins = inBin.filter((t) => (t.grossR as number) > 0).length;
      bins.push({
        priorBin: `${lo.toFixed(1)}-${(lo + 0.2).toFixed(1)}`,
        n: inBin.length,
        empiricalWinRate: Number((bWins / inBin.length).toFixed(3)),
        avgNetR: Number((inBin.reduce((s, t) => s + (t.netR as number), 0) / inBin.length).toFixed(3)),
      });
    }
    out.push({
      model: model as BtModel,
      regime,
      tier,
      n: arr.length,
      fillRate: null,
      winRate: Number((wins / arr.length).toFixed(3)),
      avgNetR: Number((arr.reduce((s, t) => s + (t.netR as number), 0) / arr.length).toFixed(3)),
      logitFit: logitFit(xs, ys),
      bins,
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// the runner
// ---------------------------------------------------------------------------

export interface BtRunOpts {
  days?: number;
  syms?: string[];
  params?: Partial<BtParams>;
}

interface BtRunState {
  running: boolean;
  startedAt: number | null;
  doneAt: number | null;
  progress: { total: number; done: number; current: string | null };
  lastError: string | null;
  params: BtParams | null;
}

const gBt = globalThis as unknown as { __cgBacktestRun?: BtRunState };
const BT: BtRunState = (gBt.__cgBacktestRun ??= { running: false, startedAt: null, doneAt: null, progress: { total: 0, done: 0, current: null }, lastError: null, params: null });

export function backtestStatus() {
  return {
    running: BT.running,
    startedAt: BT.startedAt,
    doneAt: BT.doneAt,
    progress: BT.progress,
    lastError: BT.lastError,
    params: BT.params,
    resultFile: fs.existsSync(RESULT_FILE) ? RESULT_FILE : null,
    resultAgeMs: fs.existsSync(RESULT_FILE) ? Date.now() - fs.statSync(RESULT_FILE).mtimeMs : null,
  };
}

function readLastResult(): BtRunResult | null {
  try {
    return JSON.parse(fs.readFileSync(RESULT_FILE, "utf8")) as BtRunResult;
  } catch {
    return null;
  }
}

/** serve the persisted last run; kick a background run when missing/stale */
export function ensureBacktest(maxAgeMs = 12 * 3600_000): { result: BtRunResult | null; status: ReturnType<typeof backtestStatus>; started: boolean } {
  const last = readLastResult();
  const status = backtestStatus();
  const fresh = last && Date.now() - last.generatedAt < maxAgeMs;
  let started = false;
  if (!BT.running && !fresh) {
    started = true;
    void runBacktest({ days: last?.params.days ?? DEFAULT_BT_PARAMS.days }).catch(() => undefined);
  }
  return { result: last, status: backtestStatus(), started };
}

export async function runBacktest(opts: BtRunOpts = {}): Promise<BtRunResult> {
  if (BT.running) throw new Error("backtest already running");
  BT.running = true;
  BT.startedAt = Date.now();
  BT.lastError = null;
  const params: BtParams = { ...DEFAULT_BT_PARAMS, ...opts.params, days: opts.days ?? opts.params?.days ?? DEFAULT_BT_PARAMS.days };
  BT.params = params;
  try {
    const perps = curatedPerps().filter((p) => (opts.syms?.length ? opts.syms.includes(p.sym) : true));
    BT.progress = { total: perps.length, done: 0, current: null };
    const to = Date.now();
    const from = to - params.days * 86_400_000;
    const trades: BtTrade[] = [];
    const coverage: BtAssetCoverage[] = [];
    const expectedBars = Math.floor((params.days * 86_400_000) / 900_000);
    // warmup windows for the higher-TF EMA stacks: h4 EMA233 needs 233 bars
    // (≈ 39 d), d1 EMA89 needs 89 bars — native h4/d1 klines are fetched so the
    // 15m series only needs 3 d of lead-in for the M2 day-VWAP/RSI context
    const H4_WARMUP_MS = 45 * 86_400_000;
    const D1_WARMUP_MS = 140 * 86_400_000;
    const M15_WARMUP_MS = 3 * 86_400_000;

    for (const a of perps) {
      BT.progress.current = a.sym;
      try {
        const [m15, h4, d1, funding] = await Promise.all([
          loadKlines(a, "15m", from - M15_WARMUP_MS, to),
          loadKlines(a, "4h", from - H4_WARMUP_MS, to),
          loadKlines(a, "1d", from - D1_WARMUP_MS, to),
          loadFundingHistory(a.pair, from, to).catch(() => [] as { t: number; rate: number }[]),
        ]);
        const hist = m15.filter((c) => c.t >= from);
        coverage.push({
          sym: a.sym,
          bars: hist.length,
          firstBar: hist[0]?.t ?? null,
          lastBar: hist[hist.length - 1]?.t ?? null,
          expectedBars,
          coveragePct: expectedBars > 0 ? Number(((hist.length / expectedBars) * 100).toFixed(1)) : 0,
          fundingEvents: funding.length,
        });
        if (hist.length < 1200) continue; // < 12.5 days of 15m bars — not enough for honest stats (coverage% still reported per asset)
        if (!h4.length || !d1.length) continue; // no HTF warmup — M1 cannot arm honestly
        const tier = tierOf(a.sym, a.kind);
        const simArgs: SimArgs = { sym: a.sym, tier, m15, h4, d1, funding, params };
        trades.push(...simulateM1(simArgs));
        trades.push(...simulateM2(simArgs));
      } catch (e) {
        coverage.push({ sym: a.sym, bars: 0, firstBar: null, lastBar: null, expectedBars, coveragePct: 0, fundingEvents: 0 });
        BT.lastError = `${a.sym}: ${e instanceof Error ? e.message : String(e)}`; // honest per-asset error, run continues
      }
      BT.progress.done++;
      // pacing: keep the sequential asset loop under the fapi weight ceiling
      await new Promise((r) => setTimeout(r, 120));
    }

    trades.sort((a, b) => (a.fillAt ?? a.armedAt) - (b.fillAt ?? b.armedAt));

    // sensitivity grid (same data, in-memory re-simulation — cheap)
    const sens: BtSensCell[] = [];
    const sensAssets = perps.slice(0, 20); // representative subset keeps the grid fast
    const sensData: { a: CuratedPerp; m15: BtCandle[]; h4: BtCandle[]; d1: BtCandle[]; funding: { t: number; rate: number }[] }[] = [];
    for (const a of sensAssets) {
      try {
        const [m15, h4, d1, funding] = await Promise.all([
          loadKlines(a, "15m", from - M15_WARMUP_MS, to),
          loadKlines(a, "4h", from - H4_WARMUP_MS, to),
          loadKlines(a, "1d", from - D1_WARMUP_MS, to),
          loadFundingHistory(a.pair, from, to).catch(() => [] as { t: number; rate: number }[]),
        ]);
        sensData.push({ a, m15, h4, d1, funding });
      } catch {
        /* cell skips missing assets */
      }
    }
    for (const sigma of [2.0, 2.2, 2.5]) {
      const cellTrades: BtTrade[] = [];
      for (const s of sensData) {
        cellTrades.push(
          ...simulateM2({ sym: s.a.sym, tier: tierOf(s.a.sym, s.a.kind), m15: s.m15, h4: s.h4, d1: s.d1, funding: s.funding, params, m2Sigma: sigma })
        );
      }
      sens.push({ axis: "m2Sigma", value: sigma, model: "M2_MEAN_REVERSION", metrics: computeMetrics(cellTrades) });
    }
    for (const rF of [1.5, 2.0]) {
      const cellTrades: BtTrade[] = [];
      for (const s of sensData) {
        cellTrades.push(
          ...simulateM1({ sym: s.a.sym, tier: tierOf(s.a.sym, s.a.kind), m15: s.m15, h4: s.h4, d1: s.d1, funding: s.funding, params, m1RFilter: rF })
        );
      }
      sens.push({ axis: "m1RFilter", value: rF, model: "M1_TREND_PULLBACK", metrics: computeMetrics(cellTrades) });
    }

    // aggregate blocks
    const byModel: Record<string, BtMetrics> = {};
    const byRegime: Record<string, BtMetrics> = {};
    const byTier: Record<string, BtMetrics> = {};
    const byMonth: Record<string, BtMetrics> = {};
    for (const model of ["M1_TREND_PULLBACK", "M2_MEAN_REVERSION"] as BtModel[]) {
      byModel[model] = computeMetrics(trades.filter((t) => t.model === model));
    }
    for (const regime of ["TREND_UP", "TREND_DOWN", "STRETCH"]) {
      byRegime[regime] = computeMetrics(trades.filter((t) => t.regime === regime));
    }
    for (const tier of ["crypto-major", "crypto-alt", "tradfi"] as BtTier[]) {
      byTier[tier] = computeMetrics(trades.filter((t) => t.tier === tier));
    }
    const months = new Set(trades.map((t) => new Date((t.fillAt ?? t.armedAt)).toISOString().slice(0, 7)));
    for (const m of months) {
      byMonth[m] = computeMetrics(trades.filter((t) => new Date((t.fillAt ?? t.armedAt)).toISOString().slice(0, 7) === m));
    }

    // equity curve (downsampled to ≤ 2000 points)
    let cum = 0;
    const eqFull = trades
      .filter((t) => t.netR != null)
      .map((t) => {
        cum += t.netR as number;
        return { t: t.exitAt ?? t.armedAt, cumNetR: Number(cum.toFixed(4)) };
      });
    const step = Math.max(1, Math.ceil(eqFull.length / 2000));
    const equity = eqFull.filter((_, i) => i % step === 0 || i === eqFull.length - 1);

    const calibration = calibrationCurves(trades);
    const result: BtRunResult = {
      ok: true,
      generatedAt: Date.now(),
      params,
      universe: perps.map((p) => p.sym),
      coverage,
      trades,
      equity,
      metricsAll: computeMetrics(trades),
      byModel,
      byRegime,
      byTier,
      byMonth,
      sensitivity: sens,
      calibration,
      dataAt: Date.now(),
      ageMs: 0,
      stale: false,
      source: `binance-fapi klines (${params.days}d, walk-forward) + /fapi/v1/fundingRate · stop-first · taker ${params.takerFeeBps}bps / maker ${params.makerFeeBps}bps + tier spread & ATR slippage`,
    };
    fs.mkdirSync(path.dirname(RESULT_FILE), { recursive: true });
    fs.writeFileSync(RESULT_FILE, JSON.stringify(result));
    fs.writeFileSync(CALIB_FILE, JSON.stringify({ generatedAt: result.generatedAt, params, curves: calibration }, null, 2));
    BT.doneAt = Date.now();
    return result;
  } finally {
    BT.running = false;
    BT.progress.current = null;
  }
}
