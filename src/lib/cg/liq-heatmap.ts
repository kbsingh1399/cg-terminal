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
