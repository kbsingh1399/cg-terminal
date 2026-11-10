import type { Candle } from "@/components/cg/use-cg-data";
import type { OrderFlowBar, OrderFlowBucket } from "./types";

/**
 * Alternative bar construction — the footprint page computes signals on three
 * different bar types over the SAME market move:
 *
 *   - time bars   (e.g. 15m): one bar per fixed clock interval
 *   - volume bars (e.g. 2.5K BTC): a new bar every time `threshold` base
 *     volume has traded — activity-clocked bars
 *   - range bars  (e.g. 200 pts, renko-style): a new bar every time price
 *     travels `range` points from the bar's anchor price
 *
 * "The same move gives different signals on different bars" — each series is
 * built independently from the 1-minute aggregated flow, then the signal
 * engine runs on each one.
 *
 * All inputs come from the Coinglass API (aggregated 1m order flow + 1m
 * klines over Binance/OKX/Bybit/Hyperliquid); no synthetic data.
 */

export type BarBasis = "time" | "volume" | "range";

export interface AltBarSeries {
  bars: OrderFlowBar[];
  candles: Candle[];
}

function niceStep(range: number, target: number): number {
  const raw = range / target;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const n = raw / mag;
  const mult = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return mult * mag;
}

/** Merge a group of 1m flow bars into ONE alt bar: buckets re-gridded onto a
 *  common price step, volumes summed. Mirrors the server-side aggregation. */
function mergeGroup(group: { ts: number; buckets: OrderFlowBucket[] }[]): OrderFlowBucket[] {
  let lo = Infinity;
  let hi = -Infinity;
  for (const g of group) {
    for (const bk of g.buckets) {
      lo = Math.min(lo, bk[0]);
      hi = Math.max(hi, bk[1]);
    }
  }
  if (!Number.isFinite(lo) || !Number.isFinite(hi) || hi <= lo) return [];
  const step = Math.max(0.5, niceStep(hi - lo, 70));
  const nCells = Math.ceil((hi - lo) / step);
  const cells: OrderFlowBucket[] = Array.from({ length: nCells }, (_, i) => {
    const cLo = Math.round((lo + i * step) / 0.5) * 0.5;
    return [cLo, cLo + step, 0, 0, 0, 0, 0, 0, 0, 0];
  });
  for (const g of group) {
    for (const bk of g.buckets) {
      const width = bk[1] - bk[0];
      if (width <= 0) continue;
      const i0 = Math.max(0, Math.floor((bk[0] - lo) / step));
      const i1 = Math.min(nCells - 1, Math.floor((bk[1] - lo - 1e-9) / step));
      for (let i = i0; i <= i1; i++) {
        const c = cells[i];
        const ov = Math.min(bk[1], c[1]) - Math.max(bk[0], c[0]);
        if (ov <= 0) continue;
        const f = ov / width;
        c[2] += bk[2] * f;
        c[3] += bk[3] * f;
        c[4] += bk[4] * f;
        c[5] += bk[5] * f;
        c[6] += bk[6] * f;
        c[7] += bk[7] * f;
        c[8] += bk[8] * f;
        c[9] += bk[9] * f;
      }
    }
  }
  return cells.filter((c) => c[2] + c[3] > 0);
}

function groupVolume(g: { buckets: OrderFlowBucket[] }[]): number {
  let v = 0;
  for (const b of g) for (const bk of b.buckets) v += bk[2] + bk[3];
  return v;
}

/** Candle skeleton of a group: open = first 1m open, close = last 1m close. */
function groupCandle(group: { ts: number; buckets: OrderFlowBucket[] }[], m1: Map<number, Candle>): Candle | null {
  const first = m1.get(group[0].ts);
  const last = m1.get(group[group.length - 1].ts);
  if (!first || !last) return null;
  let h = -Infinity;
  let l = Infinity;
  for (const g of group) {
    const c = m1.get(g.ts);
    if (c) {
      h = Math.max(h, c.h);
      l = Math.min(l, c.l);
    } else {
      for (const bk of g.buckets) {
        h = Math.max(h, bk[1]);
        l = Math.min(l, bk[0]);
      }
    }
  }
  if (!Number.isFinite(h) || !Number.isFinite(l)) return null;
  return { ts: group[0].ts, o: first.o, h, l, c: last.c, v: groupVolume(group) };
}

function finalize(groups: { ts: number; buckets: OrderFlowBucket[] }[][], m1: Map<number, Candle>): AltBarSeries {
  const bars: OrderFlowBar[] = [];
  const candles: Candle[] = [];
  for (const g of groups) {
    if (!g.length) continue;
    const candle = groupCandle(g, m1);
    if (!candle) continue;
    const buckets = mergeGroup(g);
    if (!buckets.length) continue;
    bars.push({ ts: g[0].ts, buckets });
    candles.push(candle);
  }
  return { bars, candles };
}

/**
 * Volume bars: accumulate consecutive 1m flow bars until the group has traded
 * at least `thresholdBtc` base volume, then close the bar. The closing 1m bar
 * is included in the group (bar boundary snaps to the 1m grid).
 */
export function buildVolumeBars(
  m1Bars: OrderFlowBar[],
  m1Candles: Candle[],
  thresholdBtc: number
): AltBarSeries {
  const m1 = new Map(m1Candles.map((c) => [c.ts, c]));
  const groups: { ts: number; buckets: OrderFlowBucket[] }[][] = [];
  let cur: { ts: number; buckets: OrderFlowBucket[] }[] = [];
  let acc = 0;
  for (const b of m1Bars) {
    if (!b.buckets?.length) continue;
    cur.push(b);
    acc += groupVolume([b]);
    if (acc >= thresholdBtc) {
      groups.push(cur);
      cur = [];
      acc = 0;
    }
  }
  // trailing partial bar kept only if it holds >= 40% of the threshold
  if (cur.length && acc >= 0.4 * thresholdBtc) groups.push(cur);
  return finalize(groups, m1);
}

/**
 * Range bars (renko-style): a bar closes once price travels `rangePts` points
 * from the bar's anchor (the previous bar's close / first 1m open). Up bar
 * closes when high - anchor >= rangePts; down bar when anchor - low >= rangePts.
 */
export function buildRangeBars(
  m1Bars: OrderFlowBar[],
  m1Candles: Candle[],
  rangePts: number
): AltBarSeries {
  const m1 = new Map(m1Candles.map((c) => [c.ts, c]));
  const groups: { ts: number; buckets: OrderFlowBucket[] }[][] = [];
  let cur: { ts: number; buckets: OrderFlowBucket[] }[] = [];
  let anchor: number | null = null;
  let hi = -Infinity;
  let lo = Infinity;
  for (const b of m1Bars) {
    if (!b.buckets?.length) continue;
    const c = m1.get(b.ts);
    let bHi = -Infinity;
    let bLo = Infinity;
    for (const bk of b.buckets) {
      bHi = Math.max(bHi, bk[1]);
      bLo = Math.min(bLo, bk[0]);
    }
    if (c) {
      bHi = Math.max(bHi, c.h);
      bLo = Math.min(bLo, c.l);
    }
    if (!Number.isFinite(bHi) || !Number.isFinite(bLo)) continue;
    if (anchor == null) {
      anchor = c ? c.o : bLo;
      hi = bHi;
      lo = bLo;
    } else {
      hi = Math.max(hi, bHi);
      lo = Math.min(lo, bLo);
    }
    cur.push(b);
    if (hi - anchor >= rangePts || anchor - lo >= rangePts) {
      groups.push(cur);
      cur = [];
      anchor = null;
      hi = -Infinity;
      lo = Infinity;
    }
  }
  // trailing partial bar kept when it already spans >= 40% of the range
  if (cur.length && anchor != null && Math.max(hi - anchor, anchor - lo) >= 0.4 * rangePts) {
    groups.push(cur);
  }
  return finalize(groups, m1);
}

/** Human label for a bar basis ("15m", "Volume 2.5K BTC", "Range 200"). */
export function basisLabel(basis: BarBasis, interval: string, volK: number, rangePts: number): string {
  if (basis === "time") return interval;
  if (basis === "volume") return `Volume ${volK % 1 === 0 ? volK.toFixed(0) : volK.toFixed(1)}K BTC`;
  return `Range ${rangePts}`;
}
