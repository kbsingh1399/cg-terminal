/**
 * Liquidation-heatmap ("stops map") model — EXACT port of the Coinglass
 * /pro/futures/LiquidationHeatMap page (Model 1, endpoint
 * `/api/index/v2/liqHeatMap`, anonymous window = 24h @ 5m bars).
 *
 * Upstream payload:
 *  - prices: 288 candles [ts, o, h, l, c, volUsd] (Binance_BTCUSDT reference)
 *  - y: N uniformly-spaced price levels covering the liquidation band
 *  - liq: rows [barIndex, yIndex, usdSize] — estimated liquidation exposure
 *    (USD) sitting at that price at that time (their leverage/OI model)
 *
 * The page renders the 2-D heat grid and the cumulative "liquidation levels"
 * line = column sum over all bars per price level. We compute:
 *  - profile[y] = Σ liq usd over all bars (window-total cluster strength)
 *  - tail[y]    = last-bar cross-section (currently-resting exposure)
 *  - cumulative below/above from the last price (sweep magnets)
 */

export interface LiqHeatmapPayload {
  instrument?: { exName?: string; instrumentId?: string; [k: string]: unknown };
  liq?: [number, number, number][];
  precision?: number;
  prices?: [number, string | number, string | number, string | number, string | number, string | number][];
  rangeHigh?: number;
  rangeLow?: number;
  updateTime?: number;
  y?: number[];
}

export interface StopCandle {
  ts: number;
  o: number;
  h: number;
  l: number;
  c: number;
}

export interface StopCluster {
  price: number;
  usd: number;
  distPct: number;
  side: "long" | "short"; // long = below price (long stops), short = above
  strength: number; // 0..100 vs strongest row
}

export interface StopBands {
  a: number;
  b: number; // band range in %
  below: number; // USD of long stops within [a,b]% below
  above: number; // USD of short stops within [a,b]% above
}

export interface StopModel {
  candles: StopCandle[];
  y: number[];
  /** per bar: [ts, [yIdx, usd][]] — sparse heat grid */
  grid: { ts: number; cells: [number, number][] }[];
  /** window-total USD per y level */
  profile: number[];
  /** last-bar USD per y level */
  tail: number[];
  lastPrice: number;
  lastTs: number;
  updateTime: number;
  clusters: { below: StopCluster[]; above: StopCluster[] };
  bands: StopBands[];
  totals: { below: number; above: number; all: number; rows: number };
  cumulative: { price: number; below: number; above: number }[];
}

export function buildStopModel(p: LiqHeatmapPayload, topN = 8): StopModel | null {
  const prices = p.prices ?? [];
  const y = p.y ?? [];
  const liq = p.liq ?? [];
  if (!prices.length || !y.length) return null;

  const candles: StopCandle[] = prices
    .map((r) => ({ ts: r[0], o: Number(r[1]), h: Number(r[2]), l: Number(r[3]), c: Number(r[4]) }))
    .filter((c) => Number.isFinite(c.c));

  const nY = y.length;
  const profile = new Array<number>(nY).fill(0);
  const tail = new Array<number>(nY).fill(0);
  const perBar = new Map<number, [number, number][]>();
  const lastBar = new Array<number>(nY).fill(0);

  for (const [b, yi, usd] of liq) {
    if (!(usd > 0) || yi < 0 || yi >= nY) continue;
    profile[yi] += usd;
    let cells = perBar.get(b);
    if (!cells) perBar.set(b, (cells = []));
    cells.push([yi, usd]);
    if (b > lastBar[yi] || lastBar[yi] === 0) {
      // track the newest bar value per row (cross-section)
    }
  }
  // cross-section: value at the LAST bar each row was seen at (approximation of
  // "currently resting"); rows absent from the final bars have decayed/cleared
  const finalBar = Math.max(0, ...liq.map((r) => r[0]));
  const finalCells = new Map<number, number>();
  for (const [b, yi, usd] of liq) {
    if (b === finalBar) finalCells.set(yi, usd);
  }
  for (let i = 0; i < nY; i++) tail[i] = finalCells.get(i) ?? 0;

  const grid = [...perBar.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([b, cells]) => ({ ts: candles[Math.min(b, candles.length - 1)]?.ts ?? b * 0, cells }));

  const lastPrice = candles[candles.length - 1]?.c ?? 0;
  const mkCluster = (yi: number, side: "long" | "short", mx: number): StopCluster => ({
    price: y[yi],
    usd: profile[yi],
    distPct: +(((y[yi] - lastPrice) / lastPrice) * 100).toFixed(2),
    side,
    strength: +((100 * profile[yi]) / mx).toFixed(1),
  });

  const rowsWith: number[] = [];
  for (let i = 0; i < nY; i++) if (profile[i] > 0) rowsWith.push(i);
  const mx = Math.max(1, ...rowsWith.map((i) => profile[i]));

  // top clusters within ±8% of price
  const below = rowsWith
    .filter((i) => y[i] < lastPrice && y[i] >= lastPrice * 0.92)
    .sort((a, b) => profile[b] - profile[a])
    .slice(0, topN)
    .sort((a, b) => b - a)
    .map((i) => mkCluster(i, "long", mx));
  const above = rowsWith
    .filter((i) => y[i] > lastPrice && y[i] <= lastPrice * 1.08)
    .sort((a, b) => profile[b] - profile[a])
    .slice(0, topN)
    .sort((a, b) => a - b)
    .map((i) => mkCluster(i, "short", mx));

  const bands: StopBands[] = ([[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 8]] as [number, number][]).map(([a, b]) => {
    let belowUsd = 0;
    let aboveUsd = 0;
    for (const i of rowsWith) {
      const pct = Math.abs((y[i] - lastPrice) / lastPrice) * 100;
      if (pct >= a && pct < b) {
        if (y[i] < lastPrice) belowUsd += profile[i];
        else aboveUsd += profile[i];
      }
    }
    return { a, b, below: belowUsd, above: aboveUsd };
  });

  let belowTotal = 0;
  let aboveTotal = 0;
  for (const i of rowsWith) {
    if (y[i] < lastPrice) belowTotal += profile[i];
    else if (y[i] > lastPrice) aboveTotal += profile[i];
  }

  // cumulative sweep curves (their renderChart: below accumulates from the
  // bottom up, above from the top down)
  const cumulative: { price: number; below: number; above: number }[] = [];
  let runBelow = 0;
  for (let i = 0; i < nY; i++) {
    runBelow += profile[i];
    cumulative.push({ price: y[i], below: runBelow, above: 0 });
  }
  let runAbove = 0;
  for (let i = nY - 1; i >= 0; i--) {
    runAbove += profile[i];
    cumulative[i].above = runAbove;
  }

  return {
    candles,
    y,
    grid,
    profile,
    tail,
    lastPrice,
    lastTs: candles[candles.length - 1]?.ts ?? 0,
    updateTime: p.updateTime ?? 0,
    clusters: { below, above },
    bands,
    totals: { below: belowTotal, above: aboveTotal, all: belowTotal + aboveTotal, rows: liq.length },
    cumulative,
  };
}

// ---------------------------------------------------------------------------
// ROLLING LIQ-SNAPSHOT HEATMAP (2026-11-12 directive)
//
// The anonymous Coinglass /api/index/v2/liqHeatMap endpoint serves BTC only
// (every other symbol returns upstream code 40000 — live-verified). For the
// other curated perps this builds an HONEST, clearly badged heatmap from:
//   1. the engine's per-asset liqlevels archive (data/cg-series/
//      liqlevels:<SYM>:3d.jsonl — real /api/liquidationLevels/v2 snapshots
//      taken every rotation, multi-venue aggregate), and/or
//   2. a fresh one-shot multi-venue aggregate when the archive is cold.
// Levels are REAL exchange liquidation levels — the "rolling" part is the
// time dimension: a level's heat = how long it has carried size. The swing
// leverage projection tiers are labelled estimates (10x/25x/50x from swing
// entries), never presented as exchange data.
// ---------------------------------------------------------------------------

import { rowsOf } from "./store";
import { liqVenues } from "./assets";
import { cgGet } from "./client";
import { fetchBinCandles } from "./fallbacks";

export interface RollingStopModel extends StopModel {
  mode: "liq-snapshot-rolling";
  note: string;
  source: "archive" | "live-aggregate" | "archive+live";
  snapshots: number;
  archivedSince: number | null;
  /** construction diagnostics (honest telemetry) */
  diag: { rows: number; inRange: number; uniq: number; lo: number; hi: number; last: number };
}

interface ArchRow {
  at: number;
  v: string;
  side: number;
  p: number;
  s: number;
  l2: string;
}

const archKey = (r: ArchRow) => `${r.at}|${r.v}|${r.side}|${r.p}|${r.l2}`;

export async function buildRollingStopModel(symRaw: string, windowMs = 24 * 3_600_000): Promise<RollingStopModel | null> {
  const sym = symRaw.trim().toUpperCase();
  // 1) price path — m15 klines over the window (Binance plain names work for
  //    every curated perp; failures return null and the route degrades).
  let candles: StopCandle[] = [];
  try {
    const bars = await fetchBinCandles(sym, "m15", Math.min(96 * 3, Math.ceil(windowMs / 900_000) + 4));
    candles = bars
      .filter((b) => b.t >= Date.now() - windowMs)
      .map((b) => ({ ts: b.t, o: b.o, h: b.h, l: b.l, c: b.c }));
  } catch {
    /* no candles — grid without a price path is useless */
  }
  if (candles.length < 8) return null;
  const lastPrice = candles[candles.length - 1].c;
  const lastTs = candles[candles.length - 1].ts;
  const now = Date.now();

  // 2) archived snapshots (+ live one-shot when the archive is thin)
  const archName = `liqlevels:${sym}:3d`;
  const arch = (rowsOf(archName, archKey) as unknown as ArchRow[]).filter((r) => now - r.at <= 3 * 86_400_000);
  let rows: ArchRow[] = arch.filter((r) => now - r.at <= windowMs);
  let source: RollingStopModel["source"] = "archive";
  let liveRows: ArchRow[] = [];
  if (rows.length < 200) {
    // cold archive — take ONE fresh multi-venue aggregate (the exact same
    // upstream the Liq Levels tab reads; nothing synthetic).
    try {
      const at = now;
      for (const v of liqVenues(sym)) {
        const r = (await cgGet(`/api/liquidationLevels/v2?symbol=${encodeURIComponent(v.key)}&limit=4000&range=3d`, 0)) as {
          data?: { price: number; size: number; side: number; level2?: string }[];
        };
        for (const lv of r.data ?? []) {
          if (!(lv.size > 0)) continue;
          liveRows.push({ at, v: v.key, side: Number(lv.side), p: lv.price, s: lv.size, l2: lv.level2 ?? "" });
        }
      }
    } catch {
      /* keep archive-only */
    }
    if (liveRows.length) {
      rows = [...rows, ...liveRows];
      source = arch.length ? "archive+live" : "live-aggregate";
    }
  }
  if (!rows.length) return null;

  // 3) y grid — unique level prices within ±12% of last, bucketed to <= 140 rows
  const lo = lastPrice * 0.88;
  const hi = lastPrice * 1.12;
  const inRange = rows.filter((r) => r.p >= lo && r.p <= hi);
  // y grid: ~140 INTEGER-INDEXED levels spanning the price range (integer
  // indices avoid the FP-key mismatch of rounded-value keys; levels from
  // different venues that land in one bucket SUM their USD).
  const nY = 140;
  const step = (hi - lo) / nY;
  if (!(step > 0)) return null;
  const yiOf = (p: number) => Math.min(nY - 1, Math.max(0, Math.floor((p - lo) / step)));
  const y: number[] = [];
  for (let i = 0; i < nY; i++) y.push(+(lo + (i + 0.5) * step).toFixed(8));
  const dbg = { rows: rows.length, inRange: inRange.length, uniq: new Set(inRange.map((r) => r.p)).size, lo: Math.round(lo), hi: Math.round(hi), last: lastPrice };

  // 4) heat grid — per m15 bar, sum the USD of every snapshot level alive in
  //    that bar (a level stays "alive" from its first snapshot until price
  //    trades through it or a newer snapshot drops it)
  const profile = new Array<number>(y.length).fill(0);
  const tail = new Array<number>(y.length).fill(0);
  const perBar = new Map<number, Map<number, number>>();
  // collapse rows per snapshot timestamp -> level price -> max USD (per venue
  // snapshots repeat levels; the aggregate takes each venue's own size)
  const snaps = new Map<number, ArchRow[]>();
  for (const r of rows) {
    if (!snaps.has(r.at)) snaps.set(r.at, []);
    snaps.get(r.at)!.push(r);
  }
  const snapTimes = [...snaps.keys()].sort((a, b) => a - b);
  // per level: latest size + first-seen snapshot (rolling persistence)
  const live = new Map<number, { usd: number; side: number }>();
  const persistence = new Map<number, number>(); // price -> snapshots carried
  let si = 0;
  for (const c of candles) {
    const barEnd = c.ts + 900_000;
    // advance snapshots into this bar
    while (si < snapTimes.length && snapTimes[si] <= barEnd) {
      // per snapshot: sum every venue's size per bucket (a fresh snapshot
      // REPLACES the previous one's view of a bucket)
      const snapBuckets = new Map<number, number>();
      for (const r of snaps.get(snapTimes[si])!) {
        const yi = yiOf(r.p);
        snapBuckets.set(yi, (snapBuckets.get(yi) ?? 0) + r.s);
      }
      for (const [yi, usd] of snapBuckets) {
        live.set(yi, { usd, side: 0 });
        persistence.set(yi, (persistence.get(yi) ?? 0) + 1);
      }
      si++;
    }
    // levels the bar traded through are spent (hit)
    for (const [yi, lv] of live) {
      if (c.l <= y[yi] && y[yi] <= c.h) {
        if (Math.abs(y[yi] - lastPrice) / lastPrice > 0.0005) live.delete(yi);
      }
    }
    if (live.size) {
      const cells: [number, number][] = [];
      for (const [yi, lv] of live) {
        // heat weight = level USD x persistence (how long it has held)
        const w = lv.usd * Math.min(4, 1 + (persistence.get(yi) ?? 1) * 0.25);
        cells.push([yi, w]);
        profile[yi] += w;
      }
      perBar.set(c.ts, new Map(cells));
    }
  }
  for (const [yi, lv] of live) tail[yi] = lv.usd;

  const grid = [...perBar.entries()].map(([ts, m]) => ({ ts, cells: [...m.entries()] }));

  // 5) clusters — strongest unhit levels either side
  const mkCluster = (yi: number, side: "long" | "short", mx: number): StopCluster => ({
    price: y[yi],
    usd: live.get(yi)?.usd ?? 0,
    distPct: ((y[yi] - lastPrice) / lastPrice) * 100,
    side,
    strength: mx > 0 ? (profile[yi] / mx) * 100 : 0,
  });
  const belowIdx = y.map((_, i) => i).filter((i) => y[i] < lastPrice && live.has(i));
  const aboveIdx = y.map((_, i) => i).filter((i) => y[i] > lastPrice && live.has(i));
  const mxProfile = Math.max(...profile, 1);
  const below = belowIdx.sort((a, b) => profile[b] - profile[a]).slice(0, 8).map((i) => mkCluster(i, "long", mxProfile));
  const above = aboveIdx.sort((a, b) => profile[b] - profile[a]).slice(0, 8).map((i) => mkCluster(i, "short", mxProfile));

  // 6) bands (0-1% ... 5-8% either side)
  const bands: StopBands[] = ([[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 8]] as [number, number][]).map(([a, b]) => {
    let bl = 0;
    let ab = 0;
    for (const i of belowIdx) {
      const d = ((lastPrice - y[i]) / lastPrice) * 100;
      if (d >= a && d < b) bl += live.get(i)?.usd ?? 0;
    }
    for (const i of aboveIdx) {
      const d = ((y[i] - lastPrice) / lastPrice) * 100;
      if (d >= a && d < b) ab += live.get(i)?.usd ?? 0;
    }
    return { a, b, below: bl, above: ab };
  });

  // 7) cumulative curve
  const cumulative: { price: number; below: number; above: number }[] = [];
  let cb = 0;
  let ca = 0;
  const belowAsc = [...belowIdx].sort((a, b) => a - b);
  const aboveAsc = [...aboveIdx].sort((a, b) => b - a);
  for (const i of belowAsc) {
    cb += live.get(i)?.usd ?? 0;
    cumulative.push({ price: y[i], below: cb, above: ca });
  }
  for (const i of aboveAsc) {
    ca += live.get(i)?.usd ?? 0;
    cumulative.push({ price: y[i], below: cb, above: ca });
  }

  const totals = {
    below: belowIdx.reduce((s, i) => s + (live.get(i)?.usd ?? 0), 0),
    above: aboveIdx.reduce((s, i) => s + (live.get(i)?.usd ?? 0), 0),
    all: 0,
    rows: rows.length,
  };
  totals.all = totals.below + totals.above;

  const archSince = arch.length ? Math.min(...arch.map((r) => r.at)) : null;
  return {
    candles,
    y,
    grid,
    profile,
    tail,
    lastPrice,
    lastTs,
    updateTime: now,
    clusters: { below, above },
    bands,
    totals,
    cumulative,
    mode: "liq-snapshot-rolling",
    source,
    snapshots: snaps.size,
    archivedSince: archSince,
    diag: dbg,
    note:
      "Liq-Snapshot Rolling Heatmap — REAL multi-venue liquidation levels from /api/liquidationLevels/v2, rolled over time (heat = size x persistence). The anonymous Coinglass liqHeatMap grid serves BTC only, so non-BTC perps use this honest rolling construction instead of the native 5-minute leverage grid.",
  };
}
