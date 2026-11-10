/**
 * Institution-standard indicator suite, computed 100% from live API klines
 * (Binance perp lead venue). No synthetic inputs.
 *
 *  - EMA  (Fib prime set 13 / 89 / 233)      — multi-timeframe
 *  - RSI  (Wilder 14)                        — multi-timeframe
 *  - Day VWAP ±1σ/2σ/3σ                      — anchored at the UTC day open
 *    (exchange convention — identical for every viewer regardless of local
 *    timezone: IST, UTC, anything)
 *  - Auction / market-profile VAL-POC-VAH    — session (trailing 8h),
 *    day (UTC calendar day) and month (UTC calendar month) volume profiles
 *    (70% value area, TPO-style expansion from the POC)
 */

export interface Candle {
  t: number; // ms
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

// ---------------------------------------------------------------------------
// EMA
// ---------------------------------------------------------------------------

/** Classic EMA seeded with the SMA of the first `period` values. */
export function emaSeries(values: number[], period: number): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null);
  if (!values.length || period <= 0 || values.length < period) return out;
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

export function emaLast(values: number[], period: number): number | null {
  const s = emaSeries(values, period);
  for (let i = s.length - 1; i >= 0; i--) if (null != s[i]) return s[i];
  return null;
}

// ---------------------------------------------------------------------------
// RSI (Wilder)
// ---------------------------------------------------------------------------

export function rsiSeries(closes: number[], period = 14): (number | null)[] {
  const out: (number | null)[] = new Array(closes.length).fill(null);
  if (closes.length <= period) return out;
  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= period; i++) {
    const d = closes[i] - closes[i - 1];
    if (d >= 0) gain += d;
    else loss -= d;
  }
  let avgG = gain / period;
  let avgL = loss / period;
  out[period] = avgL === 0 ? 100 : 100 - 100 / (1 + avgG / avgL);
  for (let i = period + 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    const g = d > 0 ? d : 0;
    const l = d < 0 ? -d : 0;
    avgG = (avgG * (period - 1) + g) / period;
    avgL = (avgL * (period - 1) + l) / period;
    out[i] = avgL === 0 ? 100 : 100 - 100 / (1 + avgG / avgL);
  }
  return out;
}

export function rsiLast(closes: number[], period = 14): number | null {
  const s = rsiSeries(closes, period);
  for (let i = s.length - 1; i >= 0; i--) if (null != s[i]) return s[i];
  return null;
}

// ---------------------------------------------------------------------------
// Day VWAP + σ bands (UTC anchor)
// ---------------------------------------------------------------------------

export interface VwapResult {
  anchorTs: number; // UTC day open ts (ms)
  vwap: number | null;
  bands: { sd1: number; sd2: number; sd3: number }; // ±σ offsets from vwap
  open: number | null;
  high: number | null;
  low: number | null;
  bars: number;
}

/** UTC day start of a timestamp (ms). */
export function utcDayStart(tsMs: number): number {
  const d = new Date(tsMs);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/**
 * VWAP of the current UTC day with volume-weighted σ bands.
 * σ² = Σ(v·p²)/Σv − vwap²  (the TradingView band convention).
 */
export function dayVwap(candles: Candle[], nowMs = Date.now()): VwapResult {
  const dayStart = utcDayStart(nowMs);
  const bars = candles.filter((c) => c.t >= dayStart && c.v > 0);
  if (!bars.length) {
    return { anchorTs: dayStart, vwap: null, bands: { sd1: 0, sd2: 0, sd3: 0 }, open: null, high: null, low: null, bars: 0 };
  }
  let sv = 0;
  let svp = 0;
  let svp2 = 0;
  let hi = -Infinity;
  let lo = Infinity;
  for (const c of bars) {
    const tp = (c.h + c.l + c.c) / 3;
    sv += c.v;
    svp += c.v * tp;
    svp2 += c.v * tp * tp;
    if (c.h > hi) hi = c.h;
    if (c.l < lo) lo = c.l;
  }
  const vwap = svp / sv;
  const variance = Math.max(0, svp2 / sv - vwap * vwap);
  const sd = Math.sqrt(variance);
  return {
    anchorTs: dayStart,
    vwap,
    bands: { sd1: sd, sd2: 2 * sd, sd3: 3 * sd },
    open: bars[0].o,
    high: hi,
    low: lo,
    bars: bars.length,
  };
}

// ---------------------------------------------------------------------------
// Volume profile (VAL / POC / VAH)
// ---------------------------------------------------------------------------

export interface Profile {
  poc: number | null;
  vah: number | null;
  val: number | null;
  high: number | null;
  low: number | null;
  volume: number;
  bins: number;
}

/**
 * Volume-at-price histogram with 70% value area.
 * Each candle spreads its volume uniformly across the price bins it spans
 * (the standard approximation when only OHLCV is available).
 */
export function volumeProfile(candles: Candle[], binCount = 60): Profile {
  const bars = candles.filter((c) => Number.isFinite(c.h) && Number.isFinite(c.l) && c.v > 0);
  const empty: Profile = { poc: null, vah: null, val: null, high: null, low: null, volume: 0, bins: 0 };
  if (bars.length < 2) return empty;
  let hi = -Infinity;
  let lo = Infinity;
  for (const c of bars) {
    if (c.h > hi) hi = c.h;
    if (c.l < lo) lo = c.l;
  }
  if (!Number.isFinite(hi) || !Number.isFinite(lo) || hi <= lo) return empty;
  const n = Math.max(10, Math.min(binCount, 240));
  const step = (hi - lo) / n;
  const bins = new Float64Array(n);
  for (const c of bars) {
    const a = Math.max(0, Math.floor((c.l - lo) / step));
    const b = Math.min(n - 1, Math.floor((c.h - lo) / step));
    const span = b - a + 1;
    if (span <= 0) continue;
    const per = c.v / span;
    for (let i = a; i <= b; i++) bins[i] += per;
  }
  let pocIdx = 0;
  for (let i = 1; i < n; i++) if (bins[i] > bins[pocIdx]) pocIdx = i;
  // 70% value area: expand up/down from POC greedily (larger side first)
  const total = bins.reduce((s, x) => s + x, 0);
  const target = 0.7 * total;
  let acc = bins[pocIdx];
  let up = pocIdx;
  let dn = pocIdx;
  while (acc < target && (up < n - 1 || dn > 0)) {
    const upVol = up < n - 1 ? bins[up + 1] : -1;
    const dnVol = dn > 0 ? bins[dn - 1] : -1;
    if (upVol >= dnVol && upVol >= 0) {
      up++;
      acc += Math.max(0, upVol);
    } else if (dnVol >= 0) {
      dn--;
      acc += Math.max(0, dnVol);
    } else break;
  }
  const priceOf = (i: number) => lo + (i + 0.5) * step;
  return {
    poc: priceOf(pocIdx),
    vah: priceOf(up),
    val: priceOf(dn),
    high: hi,
    low: lo,
    volume: total,
    bins: n,
  };
}

/** UTC month start of a timestamp (ms). */
export function utcMonthStart(tsMs: number): number {
  const d = new Date(tsMs);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
}

export interface AuctionSet {
  session: Profile; // trailing 8h intraday auction
  day: Profile; // current UTC calendar day
  month: Profile; // current UTC calendar month
}

/** All three auction profiles from one m15/h1 candle set. */
export function auctionLevels(m15: Candle[], h1: Candle[], nowMs = Date.now()): AuctionSet {
  const sessionStart = nowMs - 8 * 3_600_000;
  const dayStart = utcDayStart(nowMs);
  const monthStart = utcMonthStart(nowMs);
  return {
    session: volumeProfile(m15.filter((c) => c.t >= sessionStart)),
    day: volumeProfile(m15.filter((c) => c.t >= dayStart)),
    month: volumeProfile(h1.filter((c) => c.t >= monthStart), 120),
  };
}
