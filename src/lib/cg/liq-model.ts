/**
 * EXACT port of the Coinglass liquidation-levels page model (class R in
 * pages/liquidation-levels/[symbol]-*.js), extended to aggregate the four
 * perp venues the user's aggregated view covers — Binance, OKX, Bybit,
 * Hyperliquid.
 *
 * Their model, verbatim semantics:
 *  - candles come INSIDE the liquidationLevels/v2 response ("prices")
 *  - each level: {x|beginDate, endX|endDate, price, size, level2, side}
 *    → row [startBar, endBar|null, price, size, tier(h1=0/h2=1/h3=2), side(1=long→below, 2=short→above)]
 *  - a level with a valid endBar is "hit" (price reached it) and stops counting
 *  - price grid: 520 rows spanning 0.88×min(low) .. 1.12×max(high)
 *  - keyLevels(lvR): the top-5 unhit rows per side within ±lvR% of the last
 *    price, strength normalized to the strongest row (top = 100)
 *  - leverage tier of a row = the tier with the largest summed size in it
 *    (h1 = High ~100×, h2 = Mid ~50×, h3 = Low ~25×)
 *
 * Aggregation: all four venues' levels are mapped onto ONE grid (the lead
 * venue's candle timeline; bar indices resolved through beginDate/endDate),
 * sizes summed — the natural multi-venue extension of their per-venue model.
 */

export interface RawLiqLevel {
  x?: number | string;
  endX?: number | string;
  beginDate?: number;
  endDate?: number;
  price: number;
  size: number;
  level2?: string; // h1 | h2 | h3
  side: number | string; // 1 = long (below price), 2 = short (above)
}

export interface RawLiqPayload {
  prices: [number, string | number, string | number, string | number, string | number, string | number][];
  data: RawLiqLevel[];
}

/**
 * Parse a decrypted /api/liquidationLevels/v2 response into its level rows.
 *
 * The decrypted payload shape VARIES between calls (live-verified
 * 2026-11-12): sometimes the bare RawLiqPayload `{ prices, data }`,
 * sometimes wrapped `{ data: RawLiqPayload }`, and the anonymous path can
 * even return `{ code, msg, success }` with no data at all (rate-limit
 * shadow). The old engine/archiver code did `for (const lv of r.data ?? [])`
 * — on the wrapped shape `r.data` is an OBJECT, `for..of` throws "not
 * iterable", the catch swallowed it and NOTHING was ever archived (the
 * rolling per-asset heatmap stayed empty on a fresh boot). One shared,
 * shape-proof parser for every consumer.
 */
export function parseLiqLevelsPayload(val: unknown): RawLiqLevel[] {
  if (!val || typeof val !== "object") return [];
  // bare array of levels (legacy shape)
  if (Array.isArray(val)) return val as RawLiqLevel[];
  const v = val as { prices?: unknown; data?: unknown };
  // bare payload: { prices: [...], data: RawLiqLevel[] }
  if (Array.isArray(v.prices)) {
    return Array.isArray(v.data) ? (v.data as RawLiqLevel[]) : [];
  }
  // wrapped payload: { data: { prices: [...], data: RawLiqLevel[] } }
  if (v.data && typeof v.data === "object") {
    const inner = v.data as { prices?: unknown; data?: unknown };
    if (Array.isArray(inner.prices)) return Array.isArray(inner.data) ? (inner.data as RawLiqLevel[]) : [];
    // double-wrapped { data: { data: [...] } }
    if (Array.isArray(inner.data)) return inner.data as RawLiqLevel[];
  }
  return [];
}

const TIER: Record<string, number> = { h1: 0, h2: 1, h3: 2 };
const ROWS = 520;

export interface ModelLevel {
  s: number; // start bar (lead grid)
  hit: boolean;
  price: number;
  size: number;
  tier: number; // 0=High 1=Mid 2=Low
  side: 0 | 1; // 0 = long/below, 1 = short/above
  venue: string;
}

export interface LiqModel {
  n: number;
  ts: number[]; // ms
  c: number[];
  gMin: number;
  dp: number;
  levels: ModelLevel[];
}

function toIdx(v: unknown): number | null {
  if (null == v || v === "") return null;
  const n = Number(v);
  return Number.isInteger(n) ? n : null;
}

/** Their P(): last index with ts[i] <= t. */
function findBar(ts: number[], t: number): number {
  let lo = 0;
  let hi = ts.length - 1;
  if (hi < 0 || t < ts[0]) return -1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (ts[mid] <= t) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

/**
 * Build the aggregated model. `venues` = [{name, payload}] where the FIRST
 * venue's candles define the timeline (Binance = lead, matching the footprint
 * page's lead convention); the grid spans all venues' candle ranges.
 */
export function buildLiqModel(venues: { name: string; payload: RawLiqPayload | null }[]): LiqModel | null {
  const lead = venues.find((v) => v.payload && Array.isArray(v.payload.prices) && v.payload.prices.length >= 10);
  if (!lead || !lead.payload) return null;
  const prices = lead.payload.prices;
  const n = prices.length;
  const ts: number[] = new Array(n);
  const o: number[] = new Array(n);
  const h: number[] = new Array(n);
  const l: number[] = new Array(n);
  const c: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    ts[i] = 1000 * Number(prices[i][0]);
    o[i] = Number(prices[i][1]);
    h[i] = Number(prices[i][2]);
    l[i] = Number(prices[i][3]);
    c[i] = Number(prices[i][4]);
  }

  // grid extremes across ALL venues (so no venue's level falls outside)
  let gLo = Infinity;
  let gHi = -Infinity;
  for (const v of venues) {
    if (!v.payload?.prices) continue;
    for (const row of v.payload.prices) {
      const lo = Number(row[3]);
      const hi = Number(row[2]);
      if (lo > 0 && hi >= lo) {
        gLo = Math.min(gLo, lo);
        gHi = Math.max(gHi, hi);
      }
    }
  }
  if (!isFinite(gLo) || !isFinite(gHi)) {
    // fall back to lead only (their exact rule)
    for (let i = 0; i < n; i++) {
      if (!(l[i] > 0 && h[i] >= l[i])) l[i] = h[i] = o[i] = c[i] = i ? c[i - 1] : 1;
      gLo = Math.min(gLo, l[i]);
      gHi = Math.max(gHi, h[i]);
    }
  }
  const gMin = 0.88 * gLo;
  const dp = (1.12 * gHi - gMin) / ROWS;

  // merge levels from every venue onto the lead timeline
  const levels: ModelLevel[] = [];
  for (const v of venues) {
    if (!v.payload || !Array.isArray(v.payload.data)) continue;
    for (const e of v.payload.data) {
      const price = Number(e.price);
      const size = Number(e.size);
      if (!(price > 0) || !(size > 0)) continue;
      let s = toIdx(e.x);
      if (s == null) s = e.beginDate ? findBar(ts, 1000 * Number(e.beginDate)) : -1;
      let en = toIdx(e.endX);
      if (en == null) en = e.endDate ? findBar(ts, 1000 * Number(e.endDate)) : -1;
      const hit = en != null && en >= s && en < n;
      const tier = TIER[e.level2 ?? ""] ?? 2;
      const side: 0 | 1 = String(e.side) === "1" ? 0 : 1;
      levels.push({ s: s ?? -1, hit, price, size, tier, side, venue: v.name });
    }
  }
  return { n, ts, c, gMin, dp, levels };
}

export interface KeyLevel {
  side: "short" | "long";
  price: number;
  distPct: number;
  lev: "High" | "Mid" | "Low";
  strength: number; // 0..100, top row = 100
  usd: number; // summed level size in the row
  venues: string[];
}

/** Optional live reference for liqStats — see server-price.ts for why the
 *  embedded candle close must NOT be trusted as "current price". */
export interface LiqStatsRef {
  /** live market price — overrides the embedded candle close as the
   *  side/distance reference when finite and > 0 */
  livePrice?: number | null;
  /** cluster-price rounding (asset priceDecs); default 1 (legacy behavior) */
  priceDecs?: number;
}

export interface LiqStats {
  /** the reference price actually used (live when provided) */
  last: number;
  keyLevels: { above: KeyLevel[]; below: KeyLevel[] };
  totals: { shorts: number; longs: number; rows: number };
  bands: { a: number; b: number; up: number; down: number }[]; // strength by distance
  levTiers: { shorts: [number, number, number]; longs: [number, number, number] }; // [high, mid, low]
  counts: { hit: number; open: number; venues: string[] };
}

/** Their keyLevels/bands/levTiers in one pass. gran = 0 keeps every level. */
export function liqStats(model: LiqModel, lvR: number, ref?: LiqStatsRef): LiqStats {
  const gMin = model.gMin;
  const dp = model.dp;
  const rowOf = (p: number) => Math.min(ROWS - 1, Math.max(0, Math.floor((p - gMin) / dp)));
  const priceOfRow = (r: number) => gMin + (r + 0.5) * dp;

  const active = new Float64Array(ROWS);
  const activeLev: number[][] = Array.from({ length: ROWS }, () => [0, 0, 0]);
  const rowVenues: Set<string>[] = Array.from({ length: ROWS }, () => new Set<string>());
  let hitCount = 0;
  for (const lv of model.levels) {
    if (lv.hit) {
      hitCount++;
      continue;
    }
    const r = rowOf(lv.price);
    active[r] += lv.size;
    activeLev[r][lv.tier] += lv.size;
    rowVenues[r].add(lv.venue);
  }

  // Reference price: LIVE market price when provided (the embedded candle
  // close can lag minutes behind — that misassigned above/below sides and
  // fired false "approaching cluster" alerts); embedded close as fallback.
  const live = ref?.livePrice;
  const price = Number.isFinite(live as number) && (live as number) > 0 ? (live as number) : model.c[model.n - 1];
  const decs = ref?.priceDecs ?? 1;
  const a = rowOf(price);
  const rowsWith: number[] = [];
  for (let r = 0; r < ROWS; r++) if (active[r] > 0) rowsWith.push(r);
  const rLo = rowOf(price * (1 - lvR / 100));
  const rHi = rowOf(price * (1 + lvR / 100));
  const above = rowsWith.filter((r) => r > a && r <= rHi).sort((x, y) => active[y] - active[x]).slice(0, 5).sort((x, y) => y - x);
  const below = rowsWith.filter((r) => r >= rLo && r < a).sort((x, y) => active[y] - active[x]).slice(0, 5).sort((x, y) => y - x);
  const mx = Math.max(1, ...above.map((r) => active[r]), ...below.map((r) => active[r]));

  const mk = (r: number, side: "short" | "long"): KeyLevel => {
    const p = priceOfRow(r);
    const lev = activeLev[r][0] >= activeLev[r][1] && activeLev[r][0] >= activeLev[r][2] ? 0 : activeLev[r][1] >= activeLev[r][2] ? 1 : 2;
    return {
      side,
      price: +p.toFixed(decs),
      distPct: +(((p - price) / price) * 100).toFixed(2),
      lev: (["High", "Mid", "Low"] as const)[lev],
      strength: +((100 * active[r]) / mx).toFixed(1),
      usd: active[r],
      venues: [...rowVenues[r]],
    };
  };

  // bands: their ranges 0-1, 1-2, 2-3, 3-5, 5-10 %
  const bands = ([[0, 1], [1, 2], [2, 3], [3, 5], [5, 10]] as [number, number][]).map(([lo, hi]) => {
    const up = rowsWith
      .filter((r) => r > a && r > rowOf(price * (1 + lo / 100)) && r < rowOf(price * (1 + hi / 100)) + 1)
      .reduce((s, r) => s + active[r], 0);
    const down = rowsWith
      .filter((r) => r < a && r >= rowOf(price * (1 - hi / 100)) && r < rowOf(price * (1 - lo / 100)) + 1)
      .reduce((s, r) => s + active[r], 0);
    return { a: lo, b: hi, up, down };
  });

  const levTiers = { shorts: [0, 0, 0] as [number, number, number], longs: [0, 0, 0] as [number, number, number] };
  for (const lv of model.levels) {
    if (lv.hit) continue;
    (lv.side === 1 ? levTiers.shorts : levTiers.longs)[lv.tier] += lv.size;
  }

  let shorts = 0;
  let longs = 0;
  for (const r of rowsWith) {
    if (r > a) shorts += active[r];
    else if (r < a) longs += active[r];
  }

  return {
    last: price,
    keyLevels: { above: above.map((r) => mk(r, "short")), below: below.map((r) => mk(r, "long")) },
    totals: { shorts, longs, rows: rowsWith.length },
    bands,
    levTiers,
    counts: {
      hit: hitCount,
      open: model.levels.length - hitCount,
      venues: [...new Set(model.levels.map((l) => l.venue))],
    },
  };
}
