/**
 * CVD (Cumulative Volume Delta) — EXACT port of the Coinglass /cvd/BTC page
 * engine (pages chunk "[symbol]" of the cvd route):
 *
 *  - instrument discovery via /api/select/coins/tickers (FUTURES + SPOT),
 *    venue whitelist and per-venue highest-volume pick (their `er`)
 *  - price candles from /api/v2/kline <key>#kline
 *  - per-instrument taker flow from /api/v2/kline <key>#bs_usd
 *    (rows [ts, buyUsd, sellUsd])
 *  - class K time-grid model + recompute (their pB/pS/sB/sS, Pp/Ps/Pt)
 *  - divergence detector — their exact algorithm:
 *      swing high: H[e-s] < H[e] && H[e+s] <= H[e] for s in 1..5
 *      swing low:  L[e-s] > L[e] && L[e+s] >= L[e]
 *      bear div: consecutive swing highs 4..60 bars apart,
 *                H[b] > H[a] && CVD[b+1] < CVD[a+1]
 *      bull div: consecutive swing lows 4..60 bars apart,
 *                L[b] < L[a] && CVD[b+1] > CVD[a+1]
 *      confirm bar c = b + 5 (no repaint), hit-rate = move over the
 *      next 12 bars after c
 */

export interface CvdInstrument {
  key: string; // e.g. Binance_BTCUSDT / Binance_SPOT_BTCUSDT
  venue: string;
  kind: "perp" | "spot";
  instrumentId: string;
  volUsd: number;
  price: number;
}

export interface TickerRow {
  instrument?: {
    exName?: string;
    instrumentId?: string;
    baseAsset?: string;
    type?: number;
  };
  volUsd?: number | string;
  price?: number;
  [k: string]: unknown;
}

const PERP_VENUES = ["Binance", "OKX", "Bybit", "Gate", "Bitget", "Deribit", "MEXC", "Hyperliquid", "BingX", "Kraken", "HTX", "KuCoin", "Bitfinex"];
const SPOT_VENUES = ["Binance", "Coinbase", "OKX", "Bybit", "Bitget", "Gate", "Kraken", "Bitfinex", "Crypto.com"];

/** their `er()` instrument discovery (per-venue best instrument). */
export function pickInstruments(futures: TickerRow[], spot: TickerRow[], coin = "BTC"): { inst: CvdInstrument[]; priceKey: string } {
  const byId = new Map<string, CvdInstrument[]>();
  const add = (t: TickerRow, kind: "perp" | "spot") => {
    const s = t.instrument;
    if (!s || s.baseAsset !== coin) return;
    if (kind === "perp" && Number(s.type) !== 1) return;
    if (kind === "spot" && Number(s.type) !== 10) return;
    const ex = s.exName ?? "";
    const ok = kind === "perp" ? PERP_VENUES.includes(ex) : SPOT_VENUES.includes(ex);
    if (!ok) return;
    const key = `${ex}_${kind === "spot" ? "SPOT_" : ""}${s.instrumentId}`;
    const arr = byId.get(`${ex}|${kind}`) ?? [];
    arr.push({ key, venue: ex, kind, instrumentId: s.instrumentId ?? "", volUsd: +(t.volUsd ?? 0) || 0, price: +(t.price ?? 0) || 0 });
    byId.set(`${ex}|${kind}`, arr);
  };
  for (const t of futures) add(t, "perp");
  for (const t of spot) add(t, "spot");

  // their ordering: venue list order, highest-vol instrument per venue
  const inst: CvdInstrument[] = [];
  for (const ex of PERP_VENUES) {
    const arr = (byId.get(`${ex}|perp`) ?? []).sort((a, b) => b.volUsd - a.volUsd);
    if (arr.length) inst.push(arr[0]);
  }
  for (const ex of SPOT_VENUES) {
    const arr = (byId.get(`${ex}|spot`) ?? []).sort((a, b) => b.volUsd - a.volUsd);
    if (arr.length) inst.push(arr[0]);
  }
  const perps = inst.filter((i) => i.kind === "perp").sort((a, b) => b.volUsd - a.volUsd);
  const priceKey =
    perps.find((p) => p.key === `Binance_${coin}USDT`)?.key ?? perps[0]?.key ?? inst[0]?.key ?? `Binance_${coin}USDT`;
  return { inst, priceKey };
}

export interface FlowRow {
  t: number; // ms
  b: number; // buy USD
  s: number; // sell USD
}

/** class K: unified time grid with OHLC + per-instrument flows. */
export class FlowGrid {
  step: number;
  keys: string[];
  n = 0;
  T: number[] = [];
  O: number[] = [];
  H: number[] = [];
  L: number[] = [];
  C: number[] = [];
  idx = new Map<number, number>();
  /** per instrument: interleaved [b0,s0,b1,s1,...] */
  private flows: Float64Array[] = [];

  constructor(step: number, keys: string[]) {
    this.step = step;
    this.keys = keys;
  }

  setCandles(rows: [number, string | number, string | number, string | number, string | number][]) {
    for (const r of rows) this.appendBar(1000 * Number(r[0]), +r[1], +r[2], +r[3], +r[4]);
  }

  private appendBar(t: number, o: number, h: number, l: number, c: number) {
    this.T.push(t);
    this.O.push(o);
    this.H.push(h);
    this.L.push(l);
    this.C.push(c);
    this.idx.set(t, this.n);
    this.n++;
  }

  /** merge flow rows for instrument i (buy/sell USD per bar; bars must exist). */
  mergeFlow(i: number, rows: FlowRow[]) {
    if (!this.flows[i]) this.flows[i] = new Float64Array(this.n * 2);
    const arr = this.flows[i];
    for (const r of rows) {
      const k = this.idx.get(r.t);
      if (k == null || k * 2 + 1 >= arr.length) continue;
      arr[k * 2] = r.b;
      arr[k * 2 + 1] = r.s;
    }
  }

  getFlow(i: number): { b: Float64Array; s: Float64Array } {
    const n = this.n;
    const b = new Float64Array(n);
    const s = new Float64Array(n);
    const arr = this.flows[i];
    if (arr) {
      for (let k = 0; k < n; k++) {
        b[k] = arr[k * 2] ?? 0;
        s[k] = arr[k * 2 + 1] ?? 0;
      }
    }
    return { b, s };
  }
}

export interface CvdSeries {
  n: number;
  ts: number[];
  o: number[];
  h: number[];
  l: number[];
  c: number[];
  pB: Float64Array; // per-bar perp buy USD
  pS: Float64Array;
  sB: Float64Array; // spot
  sS: Float64Array;
  perp: Float64Array; // cumulative CVD, length n+1, [0]=0
  spot: Float64Array;
  total: Float64Array;
  delta: Float64Array; // total per-bar delta
  ratio: Float64Array; // per-bar taker buy share
}

export function recompute(grid: FlowGrid, inst: CvdInstrument[]): CvdSeries | null {
  const n = grid.n;
  if (!n) return null;
  const perpIdx: number[] = [];
  const spotIdx: number[] = [];
  inst.forEach((v, i) => (v.kind === "perp" ? perpIdx : spotIdx).push(i));
  const flows = inst.map((_, i) => grid.getFlow(i));

  const pB = new Float64Array(n);
  const pS = new Float64Array(n);
  const sB = new Float64Array(n);
  const sS = new Float64Array(n);
  for (let e = 0; e < n; e++) {
    for (const i of perpIdx) {
      pB[e] += flows[i].b[e];
      pS[e] += flows[i].s[e];
    }
    for (const i of spotIdx) {
      sB[e] += flows[i].b[e];
      sS[e] += flows[i].s[e];
    }
  }
  const perp = new Float64Array(n + 1);
  const spot = new Float64Array(n + 1);
  const total = new Float64Array(n + 1);
  const delta = new Float64Array(n);
  const ratio = new Float64Array(n);
  for (let e = 0; e < n; e++) {
    perp[e + 1] = perp[e] + pB[e] - pS[e];
    spot[e + 1] = spot[e] + sB[e] - sS[e];
    total[e + 1] = perp[e + 1] + spot[e + 1];
    delta[e] = pB[e] + sB[e] - pS[e] - sS[e];
    const buy = pB[e] + sB[e];
    const all = buy + pS[e] + sS[e];
    ratio[e] = all > 0 ? buy / all : NaN;
  }
  return { n, ts: grid.T, o: grid.O, h: grid.H, l: grid.L, c: grid.C, pB, pS, sB, sS, perp, spot, total, delta, ratio };
}

export interface Divergence {
  t: "bull" | "bear";
  a: number; // first swing bar
  b: number; // second swing bar
  c: number; // confirm bar (b + 5)
  ts: number; // confirm timestamp
  priceA: number;
  priceB: number;
  priceC: number;
  r?: number; // 12-bar return after confirm
  hit?: boolean;
}

/** their divs() — exact port. cvd = the selected CVD array (Pp/Ps/Pt). */
export function detectDivergences(s: CvdSeries, cvd: Float64Array): Divergence[] {
  const out: Divergence[] = [];
  const n = s.n;
  const l = n - 2;
  const swingHighs: number[] = [];
  const swingLows: number[] = [];
  const H = s.h;
  const L = s.l;
  for (let e = 5; e + 5 <= l; e++) {
    let isHigh = true;
    let isLow = true;
    for (let k = 1; k <= 5 && (isHigh || isLow); k++) {
      if (H[e - k] >= H[e] || H[e + k] > H[e]) isHigh = false;
      if (L[e - k] <= L[e] || L[e + k] < L[e]) isLow = false;
    }
    if (isHigh) swingHighs.push(e);
    if (isLow) swingLows.push(e);
  }
  for (let i = 1; i < swingHighs.length; i++) {
    const a = swingHighs[i - 1];
    const b = swingHighs[i];
    if (b - a >= 4 && b - a <= 60 && H[b] > H[a] && cvd[b + 1] < cvd[a + 1]) out.push(mk("bear", a, b));
  }
  for (let i = 1; i < swingLows.length; i++) {
    const a = swingLows[i - 1];
    const b = swingLows[i];
    if (b - a >= 4 && b - a <= 60 && L[b] < L[a] && cvd[b + 1] > cvd[a + 1]) out.push(mk("bull", a, b));
  }
  function mk(t: "bull" | "bear", a: number, b: number): Divergence {
    const c = b + 5;
    const d: Divergence = {
      t,
      a,
      b,
      c,
      ts: s.ts[Math.min(c, n - 1)] ?? s.ts[n - 1],
      priceA: t === "bear" ? H[a] : L[a],
      priceB: t === "bear" ? H[b] : L[b],
      priceC: s.c[Math.min(c, n - 1)] ?? s.c[n - 1],
    };
    return d;
  }
  out.sort((x, y) => x.c - y.c);
  for (const d of out) {
    if (d.c + 12 <= n - 2) {
      d.r = s.c[d.c + 12] / s.c[d.c] - 1;
      d.hit = d.t === "bear" ? d.r < 0 : d.r > 0;
    }
  }
  return out;
}

export interface CvdKpis {
  scope: string;
  fromBar: number;
  toBar: number;
  perpBuy: number;
  perpSell: number;
  spotBuy: number;
  spotSell: number;
  perpCvd: number;
  spotCvd: number;
  buyRatio: number;
  quadrant: "both-buying" | "both-selling" | "spot-bid" | "perp-driven" | "partial";
  latestDiv: Divergence | null;
  hitRate: { hits: number; total: number } | null;
}

/** their KPI block over the anchored range. */
export function cvdKpis(s: CvdSeries, scope: "all" | "day" | "week", divs: Divergence[]): CvdKpis {
  const n = s.n;
  let f = 0;
  if (scope === "day") f = Math.max(0, n - Math.ceil(86_400_000 / (s.ts[1] - s.ts[0] || 900_000)));
  if (scope === "week") f = Math.max(0, n - Math.ceil((7 * 86_400_000) / (s.ts[1] - s.ts[0] || 900_000)));
  const v = n - 1;
  let pB = 0;
  let pS = 0;
  let sB = 0;
  let sS = 0;
  for (let e = f; e <= v; e++) {
    pB += s.pB[e];
    pS += s.pS[e];
    sB += s.sB[e];
    sS += s.sS[e];
  }
  const perpCvd = pB - pS;
  const spotCvd = sB - sS;
  const buy = pB + sB;
  const sell = pS + sS;
  const buyRatio = buy + sell > 0 ? buy / (buy + sell) : NaN;
  let quadrant: CvdKpis["quadrant"] = "partial";
  if (perpCvd >= 0 && spotCvd >= 0) quadrant = "both-buying";
  else if (perpCvd < 0 && spotCvd < 0) quadrant = "both-selling";
  else if (spotCvd >= 0) quadrant = "spot-bid";
  else quadrant = "perp-driven";
  const scored = divs.filter((d) => d.hit !== undefined);
  const lastDiv = divs.length ? divs[divs.length - 1] : null;
  return {
    scope,
    fromBar: f,
    toBar: v,
    perpBuy: pB,
    perpSell: pS,
    spotBuy: sB,
    spotSell: sS,
    perpCvd,
    spotCvd,
    buyRatio,
    quadrant,
    latestDiv: lastDiv,
    hitRate: scored.length ? { hits: scored.filter((d) => d.hit).length, total: scored.length } : null,
  };
}

/** map #bs_usd rows onto the grid (their mergeFlow does idx lookup only). */
export function flowRows(raw: [number, string | number, string | number][]): FlowRow[] {
  return raw
    .map((r) => ({ t: 1000 * Number(r[0]), b: Number(r[1]) || 0, s: Number(r[2]) || 0 }))
    .filter((r) => Number.isFinite(r.t));
}
