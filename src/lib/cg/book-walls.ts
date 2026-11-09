/**
 * Order-book heatmap walls — EXACT port of the Coinglass
 * /LiquidityHeatmap page engine (chunks of pages/[symbol] bundle):
 *
 *  - NDJSON stream reader (eo): meta/batch/end frames, 503 retry
 *  - ev(): stream row [ts, bids[[p,q]], asks[[p,q]]] → snapshot
 *      { t, g(size grid), k0(min bucket), q(qty per bucket), bb, ba, mid }
 *  - ek(): rebin a snapshot onto a coarser grid (used by wall scan + depth)
 *  - eH (WallScanner): the wall detector — ±3% of mid, threshold
 *      p = max(minUsd, min(6 × median(±1% walls), max(top4)…)), confirm on
 *      f consecutive scans (2 historical), remove after f misses with
 *      fill (price touched) vs pull events
 *  - depthIn(): base + USD depth within ±band% of mid
 *
 * Aggregate mode (their "Futures/Spot aggregate") uses the server-side
 * aggregate stream, which already merges venue books price-by-price with
 * mid-shift alignment — the exact data their page renders.
 */

export interface BookSnapshot {
  t: number; // ms
  g: number; // grid step (price units per bucket)
  k0: number; // min bucket index
  q: Float64Array; // qty per bucket
  bb: number; // best bid
  ba: number; // best ask
  mid: number;
}

/** ev(): decode one stream row. size = meta.size grid step. */
export function decodeRow(row: unknown, size: number): BookSnapshot | null {
  if (!Array.isArray(row) || !(size > 0)) return null;
  const bids = Array.isArray(row[1]) ? (row[1] as [number | string, number | string][]) : [];
  const asks = Array.isArray(row[2]) ? (row[2] as [number | string, number | string][]) : [];
  let bestAsk = Infinity;
  for (const a of asks) {
    const p = +a[0];
    if (+a[1] > 0 && p < bestAsk) bestAsk = p;
  }
  let bestBid = -Infinity;
  for (const b of bids) {
    const p = +b[0];
    if (+b[1] > 0 && p > bestBid && p < bestAsk) bestBid = p;
  }
  if (!(bestBid > 0) && bestAsk === Infinity) return null;
  if (bestBid > 0) {
    /* keep */
  } else bestBid = bestAsk - size;
  if (bestAsk === Infinity) bestAsk = bestBid + size;

  let kMin = Infinity;
  let kMax = -Infinity;
  const flat: number[] = [];
  for (const b of bids) {
    const p = +b[0];
    const q = +b[1];
    if (!(q > 0) || p > bestBid) continue;
    const k = Math.round(p / size);
    flat.push(k, q);
    if (k < kMin) kMin = k;
    if (k > kMax) kMax = k;
  }
  for (const a of asks) {
    const p = +a[0];
    const q = +a[1];
    if (!(q > 0) || p < bestAsk) continue;
    const k = Math.round(p / size);
    flat.push(k, q);
    if (k < kMin) kMin = k;
    if (k > kMax) kMax = k;
  }
  if (!flat.length) return null;
  const q = new Float64Array(kMax - kMin + 1);
  for (let i = 0; i < flat.length; i += 2) q[flat[i] - kMin] += flat[i + 1];
  return { t: 1000 * Number(row[0]), g: size, k0: kMin, q, bb: bestBid, ba: bestAsk, mid: (bestBid + bestAsk) / 2 };
}

/** ek(): rebin snapshot onto grid `grid` for buckets [n, n+count). out is reused. */
export function rebin(s: BookSnapshot, grid: number, n: number, count: number, out: Float64Array): void {
  out.fill(0, 0, count);
  if (!s || !s.q) return;
  const sGrid = s.g;
  if (sGrid <= 1.0000001 * grid) {
    // source finer or equal: sum source buckets into target buckets.
    // target bucket k covers source indices [k*h, (k+1)*h) where h = grid/sGrid.
    const h = grid / sGrid;
    const lo = Math.max(s.k0, Math.floor(n * h + 1e-9));
    const hi = Math.min(s.k0 + s.q.length - 1, Math.ceil((n + count) * h) - 1);
    for (let k = lo; k <= hi; k++) {
      const v = s.q[k - s.k0];
      if (v > 0) {
        const idx = Math.floor(k / h + 1e-9) - n;
        if (idx >= 0 && idx < count) out[idx] += v;
      }
    }
  } else {
    // source coarser: split buckets proportionally
    const h = grid / sGrid;
    for (let i = 0; i < count; i++) {
      const src = Math.floor((n + i) * h + 1e-9);
      const idx = src - s.k0;
      if (idx >= 0 && idx < s.q.length) out[i] += s.q[idx] * h;
    }
  }
}

export interface WallState {
  key: string;
  side: "b" | "a";
  k: number; // bucket index
  p: number; // bucket start price
  G: number; // grid step
  first: number; // ms first seen
  last: number;
  cf: number; // consecutive scans
  miss: number;
  peak: number;
  usd: number;
  qty: number;
  shown: boolean;
  touch: boolean;
}

export interface WallEvent {
  t: number;
  type: "add" | "fill" | "pull";
  side: "b" | "a";
  p: number;
  usd: number;
  qty: number;
}

const SCRATCH = new Float64Array(30000);

/** eH: their wall scanner. */
export class WallScanner {
  private st = new Map<string, WallState>();
  events: WallEvent[] = [];
  seq = 0;

  reset() {
    this.st.clear();
    this.events = [];
    this.seq++;
  }

  current(): WallState[] {
    return [...this.st.values()].filter((w) => w.shown).sort((a, b) => b.usd - a.usd);
  }

  scan(s: BookSnapshot, isLive: boolean, grid: number, minUsd: number, range: [number, number]) {
    if (!(grid > 0) || !s) return;
    const r = s.mid;
    const n = Math.floor((0.97 * r) / grid);
    const count = Math.ceil((1.03 * r) / grid) - n + 1;
    if (count > SCRATCH.length || count < 3) return;
    rebin(s, grid, n, count, SCRATCH);

    // usd value per bucket, median of walls within ±1%, top-4 largest
    const near: number[] = [];
    const top4 = [0, 0, 0, 0];
    for (let i = 0; i < count; i++) {
      const qty = SCRATCH[i];
      if (!(qty > 0)) continue;
      const price = (n + i + 0.5) * grid;
      const usd = qty * price;
      if (Math.abs(price / r - 1) <= 0.01) near.push(usd);
      if (usd > top4[3]) {
        let e = 3;
        while (e > 0 && usd > top4[e - 1]) {
          top4[e] = top4[e - 1];
          e--;
        }
        top4[e] = usd;
      }
    }
    near.sort((a, b) => a - b);
    const median = near.length ? near[near.length >> 1] : Infinity;
    // their c = max(2.5, 6/sqrt(g/g)) = 6 when grids match
    const c = Math.max(2.5, 6 / Math.sqrt(grid / grid));
    const thr = Math.max(minUsd, Math.min(median * c, Math.max(top4[3], 1.5 * median)));
    const confirm = isLive ? 3 : 2;
    const seen = new Set<string>();
    const [loP, hiP] = range;
    const touched = (w: WallState) => (w.side === "b" ? loP < w.p + w.G : hiP >= w.p);

    for (let i = 0; i < count; i++) {
      const qty = SCRATCH[i];
      if (!qty) continue;
      const p = (n + i) * grid;
      const mid = p + grid / 2;
      const usd = qty * mid;
      const side: "b" | "a" = mid < r ? "b" : "a";
      const key = side + (n + i);
      seen.add(key);
      let w = this.st.get(key);
      if (!(usd >= thr) && !(w && usd >= 0.6 * thr)) continue;
      if (!w) {
        w = { key, side, k: n + i, p, G: grid, first: s.t, last: s.t, cf: 0, miss: 0, peak: 0, usd: 0, qty: 0, shown: false, touch: false };
        this.st.set(key, w);
      }
      w.last = s.t;
      w.cf++;
      w.miss = 0;
      w.usd = usd;
      w.qty = qty;
      if (usd > w.peak) w.peak = usd;
      w.touch = touched(w);
      if (!w.shown && w.cf >= confirm) {
        w.shown = true;
        this.pushEvent({ t: w.first, type: "add", side, p, usd, qty });
      }
    }

    for (const [key, w] of this.st) {
      if (!seen.has(key)) {
        if (w.p < 0.97 * r || w.p > 1.03 * r) {
          this.st.delete(key);
          continue;
        }
        if (touched(w)) w.touch = true;
        if (++w.miss >= confirm) {
          this.st.delete(key);
          if (w.shown) {
            this.pushEvent({
              t: s.t,
              type: w.touch ? "fill" : "pull",
              side: w.side,
              p: w.p,
              usd: w.peak,
              qty: w.qty,
            });
          }
        }
      }
    }
  }

  private pushEvent(e: WallEvent) {
    this.events.push(e);
    if (this.events.length > 500) this.events.splice(0, this.events.length - 300);
    this.seq++;
  }
}

export interface DepthResult {
  B: number; // base qty below
  A: number; // base qty above
  Bu: number; // USD below
  Au: number; // USD above
}

/** depthIn(): ±bandPct of mid, on the model grid. */
export function depthIn(s: BookSnapshot, grid: number, bandPct: number): DepthResult | null {
  if (!s || !grid) return null;
  const mid = s.mid;
  const n = Math.floor((mid * (1 - bandPct)) / grid);
  const count = Math.ceil((mid * (1 + bandPct)) / grid) - n + 1;
  if (count > SCRATCH.length || count < 1) return null;
  rebin(s, grid, n, count, SCRATCH);
  let B = 0;
  let A = 0;
  let Bu = 0;
  let Au = 0;
  const lo = mid * (1 - bandPct);
  const hi = mid * (1 + bandPct);
  for (let i = 0; i < count; i++) {
    const qty = SCRATCH[i];
    if (!qty) continue;
    const price = (n + i + 0.5) * grid;
    if (price < lo || price > hi) continue;
    if (price < mid) {
      B += qty;
      Bu += qty * price;
    } else {
      A += qty;
      Au += qty * price;
    }
  }
  return { B, A, Bu, Au };
}

/** Binary search: last index with arr[i].t <= t. */
export function floorIdx(arr: { t: number }[], t: number): number {
  let lo = 0;
  let hi = arr.length - 1;
  let ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (arr[mid].t <= t) {
      ans = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return ans;
}

// ---------------------------------------------------------------------------
// NDJSON aggregate stream reader (eo + er)
// ---------------------------------------------------------------------------

export interface StreamResult {
  rows: unknown[];
  size: number;
  max: number;
}

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

async function readNdjson(url: string, timeoutMs: number): Promise<{ meta: { size: number; max: number; code: string; msg?: string }; rows: unknown[] }> {
  const ctrl = new AbortController();
  const kill = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": UA,
        Origin: "https://www.coinglass.com",
        Referer: "https://www.coinglass.com/",
        Accept: "*/*",
        language: "en",
      },
      signal: ctrl.signal,
      cache: "no-store",
    });
    if (!res.ok) {
      const err = new Error(`HTTP ${res.status}`) as Error & { status?: number };
      err.status = res.status;
      throw err;
    }
    const ct = res.headers.get("content-type") ?? "";
    if (!/ndjson/.test(ct)) {
      const text = await res.text();
      let code = "";
      let msg = "";
      try {
        const j = JSON.parse(text) as { code?: string; msg?: string };
        code = String(j.code ?? "");
        msg = j.msg ?? "";
      } catch {
        /* ignore */
      }
      const err = new Error(`not-ndjson code=${code} ${msg}`) as Error & { status?: number; code?: string };
      err.status = 503;
      err.code = code;
      throw err;
    }
    const reader = res.body!.getReader();
    const dec = new TextDecoder();
    const rows: unknown[] = [];
    let meta: { size: number; max: number; code: string; msg?: string } | null = null;
    let ended = false;
    let buf = "";
    const handle = (line: string) => {
      if (!line) return;
      const f = JSON.parse(line) as {
        type: string;
        code?: string;
        msg?: string;
        size?: string | number;
        max?: number;
        data?: unknown[] | unknown;
      };
      if (f.type === "meta") {
        if (String(f.code) !== "0") throw new Error(`stream code ${f.code}: ${f.msg ?? ""}`);
        meta = { size: Number(f.size), max: Number(f.max ?? 0), code: "0" };
      } else if (f.type === "batch" || f.type === "data") {
        const arr = f.type === "batch" ? (f.data as unknown[]) : [f.data];
        for (const r of arr) rows.push(r);
      } else if (f.type === "end") {
        ended = true;
      } else if (f.type === "error") {
        throw new Error(`stream error ${f.code}: ${f.msg ?? ""}`);
      }
    };
    for (;;) {
      const { done, value } = await reader.read();
      buf += dec.decode(value ?? new Uint8Array(), { stream: !done });
      let nl: number;
      while ((nl = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, nl);
        buf = buf.slice(nl + 1);
        handle(line);
      }
      if (done) break;
    }
    handle(buf.trim());
    if (!ended || !meta) throw new Error("stream ended early");
    return { meta: meta!, rows };
  } finally {
    clearTimeout(kill);
  }
}

/** er(): aggregate stream with their retry policy (3 × 503/service). */
export async function fetchAggregateStream(opts: {
  coin: string;
  exchanges: string[];
  market: "futures" | "spot";
  interval: string;
  limit: number;
  endTime?: number; // unix seconds
}): Promise<StreamResult> {
  const q = new URLSearchParams({
    coin: opts.coin,
    exchanges: opts.exchanges.join(","),
    market: opts.market,
    interval: opts.interval,
    limit: String(opts.limit),
    batchSize: "10",
    endTime: String(opts.endTime ?? Math.floor(Date.now() / 1000)),
  });
  const url = `https://capi.coinglass.com/liquidity-heatmap/api/liquidity/heatmap/aggregate/stream?${q.toString()}`;
  let lastErr: unknown = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const { meta, rows } = await readNdjson(url, 90_000);
      return { rows, size: meta.size, max: meta.max };
    } catch (e) {
      lastErr = e;
      const err = e as Error & { status?: number; code?: string };
      const retryable = err.status === 503 || String(err.code) === "40001";
      if (attempt >= 2 || !retryable) throw e;
      await new Promise((r) => setTimeout(r, 1000 + 1000 * Math.random() * (attempt + 1)));
    }
  }
  throw lastErr;
}

// ---------------------------------------------------------------------------
// Aggregate model built from decoded snapshots
// ---------------------------------------------------------------------------

export const AGG_VENUES: Record<"futures" | "spot", string[]> = {
  futures: ["Binance", "OKX", "Gate", "Bitget", "Hyperliquid"],
  spot: ["Binance", "Coinbase", "OKX", "Bitget", "Gate", "Kraken", "Bitfinex"],
};

/** their `y` map — minimum wall USD per coin */
export const WALL_MIN_USD: Record<string, number> = {
  BTC: 1_500_000,
  ETH: 800_000,
  SOL: 300_000,
  XRP: 300_000,
  BNB: 300_000,
  DOGE: 300_000,
  HYPE: 300_000,
};

export interface WallsModel {
  snapshots: number; // snapshot count
  from: number;
  to: number;
  grid: number;
  last: {
    price: number;
    bid: number;
    ask: number;
  };
  depth: { bandPct: number; bidUsd: number; askUsd: number; bidBase: number; askBase: number } | null;
  imbalance: number | null; // (Bu-Au)/(Bu+Au)
  imbalance5mAgo: number | null;
  walls: {
    side: "b" | "a";
    price: number;
    usd: number;
    qty: number;
    distPct: number;
    firstSeen: number;
    ageMs: number;
    touched: boolean;
  }[];
  events: WallEvent[];
  /** compact heat strip: [ts, mid, [bucketCenterPrice, usd][]] at ±band around latest mid */
  strip: { t: number; mid: number; cells: [number, number][] }[];
  /** price ladder of the latest snapshot (±3%) */
  ladder: { price: number; qty: number; usd: number; side: "b" | "a" }[];
}

export function buildWallsModel(
  snapshots: BookSnapshot[],
  coin: string,
  bandPct: number,
  candles: { ts: number; h: number; l: number }[] = [],
  stepMs = 900_000
): WallsModel | null {
  if (!snapshots.length) return null;
  const sorted = [...snapshots].sort((a, b) => a.t - b.t);
  const grid = sorted[sorted.length - 1].g;
  const minUsd = WALL_MIN_USD[coin] ?? 100_000;
  const scanner = new WallScanner();
  const cByTs = new Map(candles.map((c) => [Math.floor(c.ts / stepMs) * stepMs, c]));
  for (const s of sorted) {
    const near = cByTs.get(Math.floor(s.t / stepMs) * stepMs);
    const range: [number, number] = near
      ? [Math.min(s.bb, near.l), Math.max(s.ba, near.h)]
      : [s.bb, s.ba];
    scanner.scan(s, false, grid, minUsd, range);
  }
  const last = sorted[sorted.length - 1];
  const depth = depthIn(last, grid, bandPct / 100);
  const imbalance = depth && depth.Bu + depth.Au > 0 ? (depth.Bu - depth.Au) / (depth.Bu + depth.Au) : null;

  // 5-min-ago imbalance: nearest snapshot at/just-before now-5m
  let imbalance5mAgo: number | null = null;
  const target = last.t - 300_000;
  let idx = floorIdx(sorted, target);
  if (idx >= 0 && target - sorted[idx].t <= 1.5 * (sorted[1]?.t - sorted[0]?.t || 900_000)) {
    const d5 = depthIn(sorted[idx], grid, bandPct / 100);
    imbalance5mAgo = d5 && d5.Bu + d5.Au > 0 ? (d5.Bu - d5.Au) / (d5.Bu + d5.Au) : null;
  }

  const walls = scanner
    .current()
    .map((w) => ({
      side: w.side,
      price: w.p,
      usd: w.usd,
      qty: w.qty,
      distPct: +(((w.p - last.mid) / last.mid) * 100).toFixed(2),
      firstSeen: w.first,
      ageMs: last.t - w.first,
      touched: w.touch,
    }))
    .sort((a, b) => Math.abs(a.distPct) - Math.abs(b.distPct));

  // heat strip: ±8% of last mid on a coarse grid (grid×5, min grid)
  const stripGrid = grid * 5;
  const lo = Math.floor((last.mid * 0.92) / stripGrid);
  const hi = Math.ceil((last.mid * 1.08) / stripGrid);
  const cnt = hi - lo + 1;
  const strip = sorted.map((s) => {
    const cells: [number, number][] = [];
    const scratch = new Float64Array(cnt);
    rebin(s, stripGrid, lo, cnt, scratch);
    for (let i = 0; i < cnt; i++) {
      const qty = scratch[i];
      if (!(qty > 0)) continue;
      const price = (lo + i) * stripGrid + stripGrid / 2;
      cells.push([+price.toFixed(1), +(qty * price).toFixed(0)]);
    }
    return { t: s.t, mid: s.mid, cells };
  });

  // ladder ±3% on the raw grid
  const ladder: WallsModel["ladder"] = [];
  {
    const n = Math.floor((last.mid * 0.97) / grid);
    const c = Math.ceil((last.mid * 1.03) / grid) - n + 1;
    const scratch = new Float64Array(c);
    rebin(last, grid, n, c, scratch);
    for (let i = 0; i < c; i++) {
      const qty = scratch[i];
      if (!(qty > 0)) continue;
      const p = (n + i) * grid;
      ladder.push({ price: p, qty, usd: qty * (p + grid / 2), side: p < last.mid ? "b" : "a" });
    }
    ladder.sort((a, b) => b.price - a.price);
  }

  return {
    snapshots: sorted.length,
    from: sorted[0].t,
    to: last.t,
    grid,
    last: { price: last.mid, bid: last.bb, ask: last.ba },
    depth: depth
      ? { bandPct, bidUsd: depth.Bu, askUsd: depth.Au, bidBase: depth.B, askBase: depth.A }
      : null,
    imbalance,
    imbalance5mAgo,
    walls,
    events: scanner.events.slice(-60).reverse(),
    strip,
    ladder,
  };
}
