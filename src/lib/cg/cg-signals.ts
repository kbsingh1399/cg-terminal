import type { OrderFlowBucket } from "./types";

/**
 * EXACT port of the Coinglass footprint page's client-side signal engine
 * (reverse-engineered line-by-line from their published page bundle
 * `pages/footprint/[symbol]-*.js`, functions eT/eu/ea/eg/ef/q/ey).
 *
 * Coinglass computes signals in the BROWSER from the aggregated orderFlow API
 * (there is no server "signals" endpoint) — so exact parity requires running
 * the exact same algorithm on the exact same data. That is what this module
 * does: no re-invention, a 1:1 semantic port.
 *
 * Data model (identical to theirs):
 *   Fp   — a bar's footprint rows on a price grid: {tick, lo, b[], s[], bc[], sc[]}
 *   FpBar — one bar: ts + OHLC (lead venue kline) + fp rows + optional OI
 *
 * Bar types: time bars (15m…), volume bars (auto = 10× avg 1m volume,
 * q-rounded to the 1/2/2.5/5/10 ladder), range bars (auto = 0.25% of last
 * close, same ladder).
 */

export interface Fp {
  tick: number; // price step per row
  lo: number; // price of row 0's low edge
  b: number[]; // taker buy base volume per row
  s: number[]; // taker sell base volume per row
  bc: number[]; // buy trade count per row
  sc: number[]; // sell trade count per row
}

export interface FpBar {
  ts: number; // unix seconds
  o: number;
  h: number;
  l: number;
  c: number;
  fp: Fp | null;
  oio?: number | null; // open interest at bar open (aggregated)
  oic?: number | null; // open interest at bar close
}

export interface FpSeries {
  bars: FpBar[];
}

// ---------------------------------------------------------------------------
// ea — footprint object from raw arrays (their ea)
// ---------------------------------------------------------------------------

/** Their `ea(tick, lo, b, s, bc, sc)`. */
export function fpFromArrays(
  tick: number,
  lo: number,
  b: number[] | null,
  s: number[] | null,
  bc: number[] | null,
  sc: number[] | null
): Fp | null {
  if (!(tick > 0 && b && b.length)) return null;
  const r = b.length;
  const zeros = () => Array(r).fill(0) as number[];
  return {
    tick,
    lo,
    b: b.slice(),
    s: s && s.length === r ? s.slice() : zeros(),
    bc: bc && bc.length === r ? bc.slice() : zeros(),
    sc: sc && sc.length === r ? sc.slice() : zeros(),
  };
}

// ---------------------------------------------------------------------------
// eT — one venue-bar's buckets → Fp rows (their eT)
// ---------------------------------------------------------------------------

/**
 * Their `eT(buckets)`: grid anchored at the lowest bucket edge, tick = the
 * first non-zero bucket width, row = round((minEdge - lo) / tick). Base
 * volumes (cols 2,3) and trade counts (cols 8,9) are kept — USD cols are not
 * part of their signal grid.
 */
export function fpFromBuckets(buckets: OrderFlowBucket[] | unknown): Fp | null {
  if (!Array.isArray(buckets) || !buckets.length) return null;
  const bkArr = buckets as (number | string)[][];
  let lo = Infinity;
  let tick = 0;
  for (const bk of bkArr) {
    const e = Number(bk[0]);
    const l = Number(bk[1]);
    const a = Math.min(e, l);
    if (a < lo) lo = a;
    if (!tick && Math.abs(l - e) > 0) tick = Math.abs(l - e);
  }
  if (!(tick > 0) || !isFinite(lo)) return null;
  let n = 0;
  const rows: [number, (number | string)[]][] = [];
  for (const bk of bkArr) {
    const idx = Math.round((Math.min(Number(bk[0]), Number(bk[1])) - lo) / tick);
    if (idx + 1 > n) n = idx + 1;
    rows.push([idx, bk]);
  }
  const b = Array(Math.max(1, n)).fill(0) as number[];
  const s = Array(Math.max(1, n)).fill(0) as number[];
  const bc = Array(Math.max(1, n)).fill(0) as number[];
  const sc = Array(Math.max(1, n)).fill(0) as number[];
  for (const [idx, bk] of rows) {
    b[idx] += Number(bk[2]) || 0;
    s[idx] += Number(bk[3]) || 0;
    bc[idx] += Number(bk[8]) || 0;
    sc[idx] += Number(bk[9]) || 0;
  }
  return { tick: +tick.toPrecision(10), lo, b, s, bc, sc };
}

// ---------------------------------------------------------------------------
// eu — merge several Fps onto the coarsest tick grid (their eu)
// ---------------------------------------------------------------------------

/**
 * Their `eu(fs)`: merged tick = max of member ticks; each member row lands in
 * floor(rowCenterPrice / tick); volumes/counts sum; lo = minRow × tick.
 */
export function mergeFp(fs: (Fp | null)[]): Fp | null {
  const list = fs.filter((f): f is Fp => !!f);
  if (!list.length) return null;
  let tick = -Infinity;
  for (const f of list) if (f.tick > tick) tick = f.tick;
  const map = new Map<number, [number, number, number, number]>();
  let lo = Infinity;
  let hi = -Infinity;
  for (const f of list) {
    for (let e = 0; e < f.b.length; e++) {
      if (!(f.b[e] || f.s[e])) continue;
      const r = Math.floor((f.lo + (e + 0.5) * f.tick) / tick + 1e-9);
      let cell = map.get(r);
      if (!cell) {
        cell = [0, 0, 0, 0];
        map.set(r, cell);
      }
      cell[0] += f.b[e];
      cell[1] += f.s[e];
      cell[2] += f.bc[e];
      cell[3] += f.sc[e];
      if (r < lo) lo = r;
      if (r > hi) hi = r;
    }
  }
  if (!map.size) return null;
  const len = hi - lo + 1;
  const b = Array(len).fill(0) as number[];
  const s = Array(len).fill(0) as number[];
  const bc = Array(len).fill(0) as number[];
  const sc = Array(len).fill(0) as number[];
  for (const [r, cell] of map) {
    const i = r - lo;
    b[i] = cell[0];
    s[i] = cell[1];
    bc[i] = cell[2];
    sc[i] = cell[3];
  }
  return { tick, lo: +(lo * tick).toPrecision(12), b, s, bc, sc };
}

// ---------------------------------------------------------------------------
// q / ef — threshold ladder + auto bar thresholds (their q / ef)
// ---------------------------------------------------------------------------

/** Their `q(e)`: round to the {1, 2, 2.5, 5, 10} × 10^k ladder. */
export function roundThr(e: number): number {
  if (!(e > 0)) return 1;
  const t = Math.pow(10, Math.floor(Math.log10(e)));
  const s = e / t;
  return (s <= 1 ? 1 : s <= 2 ? 2 : s <= 2.5 ? 2.5 : s <= 5 ? 5 : 10) * t;
}

/**
 * Their `ef(S, bt)`: auto threshold for volume / range bars.
 *  vol:   10 × average bar volume over the last 240 m1 bars, ladder-rounded
 *  range: 0.25% of the last close, ladder-rounded
 */
export function autoThreshold(bars: FpBar[], bt: "vol" | "range"): number {
  if (!bars.length) return 1;
  if (bt === "vol") {
    let sum = 0;
    let cnt = 0;
    for (let i = Math.max(0, bars.length - 240); i < bars.length; i++) {
      const f = bars[i].fp;
      if (f) {
        for (let e = 0; e < f.b.length; e++) sum += f.b[e] + f.s[e];
        cnt++;
      }
    }
    return roundThr((sum / Math.max(1, cnt)) * 10);
  }
  return roundThr(0.0025 * bars[bars.length - 1].c);
}

// ---------------------------------------------------------------------------
// eg — derived (volume / range) bars from an m1 series (their eg)
// ---------------------------------------------------------------------------

interface DerivedBar {
  si: number;
  ts: number;
  o: number;
  h: number;
  l: number;
  c: number;
  fs: Fp[];
  oo: number | null;
  oc: number | null;
  v: number;
  j1: number;
}

/**
 * Their `eg(S, from, to, bt, thr)`: accumulate consecutive m1 bars until the
 * group traded ≥ thr volume (vol bars) or spans ≥ thr price (range bars); the
 * closing m1 bar is included. The trailing partial group IS kept (matches
 * their live behavior — but signals never fire on the very last bar).
 */
export function buildDerivedBars(S: FpBar[], bt: "vol" | "range", thr: number): FpBar[] {
  const groups: DerivedBar[] = [];
  let cur: DerivedBar | null = null;
  for (let i = 0; i < S.length; i++) {
    const hi = S[i].h;
    const lo = S[i].l;
    if (cur) {
      if (hi > cur.h) cur.h = hi;
      if (lo < cur.l) cur.l = lo;
      cur.c = S[i].c;
      if (S[i].oic != null) cur.oc = S[i].oic ?? null;
      if (cur.oo == null) cur.oo = S[i].oio ?? null;
    } else {
      cur = {
        si: i,
        ts: S[i].ts,
        o: S[i].o,
        h: hi,
        l: lo,
        c: S[i].c,
        fs: [],
        oo: S[i].oio ?? null,
        oc: S[i].oic ?? null,
        v: 0,
        j1: -1,
      };
    }
    const g: DerivedBar = cur;
    const f = S[i].fp;
    if (f) {
      g.fs.push(f);
      for (let e = 0; e < f.b.length; e++) g.v += f.b[e] + f.s[e];
    }
    if (bt === "vol" ? g.v >= thr : g.h - g.l >= thr) {
      g.j1 = i;
      groups.push(g);
      cur = null;
    }
  }
  if (cur) {
    cur.j1 = S.length - 1;
    groups.push(cur);
  }
  const out: FpBar[] = [];
  for (const g of groups) {
    const fp = mergeFp(g.fs);
    if (!fp) continue;
    out.push({ ts: g.ts, o: g.o, h: g.h, l: g.l, c: g.c, fp, oio: g.oo, oic: g.oc });
  }
  return out;
}

// ---------------------------------------------------------------------------
// ey — THE signal engine (their ey, verbatim semantics)
// ---------------------------------------------------------------------------

export type CgSigType = "div" | "sdiv" | "abs" | "trap" | "exh";
export type CgSigSide = "buy" | "sell";

export interface CgSignal {
  i: number; // bar index in its series
  t: CgSigType;
  side: CgSigSide;
  p: number; // attached price (bar high/low)
  r?: number; // div: delta / bar volume
  q?: number; // abs/trap: zone volume (base units)
  u?: number; // abs/trap: zone USD value (q × bar mid)
  lo?: number; // zone low price
  hi?: number; // zone high price
  j?: number; // trap: confirmation bar index
  i0?: number; // sdiv: prior pivot bar index
  p0?: number; // sdiv: prior pivot price
  dc?: number; // sdiv: CVD change (cvd[i] − cvd[i0])
  ts: number; // bar timestamp (unix seconds) — added by us for the UI
  bt?: "time" | "vol" | "range"; // set by the caller
}

/**
 * Their `ey(X)`. Deterministic; signals on bars 5..n−2 only. All thresholds
 * are exact: 0.8× median(prior ≤20 bar volumes), |δ| ≥ 15% for div, 30% zone
 * share + 1.2× opposing zone + close position for abs, 2% extreme volume for
 * exh, 1.5× + 5-bar extreme + ≤3-bar reversal for trap, ±3 pivot swing
 * divergence with CVD gap > 25% of median volume within 40 bars for sdiv.
 */
export function computeCgSignals(X: FpBar[]): CgSignal[] {
  const t = X.length;
  const s: CgSignal[] = [];
  // i[] — per-bar total volume
  const vol = new Float64Array(t);
  for (let k = 0; k < t; k++) {
    const f = X[k].fp;
    if (!f) continue;
    let v = 0;
    for (let e = 0; e < f.b.length; e++) v += f.b[e] + f.s[e];
    vol[k] = v;
  }

  for (let l = 5; l < t - 1; l++) {
    const a = X[l].fp;
    if (!a || !vol[l]) continue;
    const r: number[] = [];
    for (let e = Math.max(0, l - 20); e < l; e++) if (vol[e]) r.push(vol[e]);
    if (r.length < 5) continue;
    r.sort((x, y) => x - y);
    if (vol[l] < 0.8 * r[r.length >> 1]) continue;

    const n = a.b.length;
    const o = vol[l];
    let h = 0; // bar delta
    let d = 0; // total buys
    let c = 0; // total sells
    let p = -1; // top row with volume
    let u = -1; // bottom row with volume
    for (let e = 0; e < n; e++) {
      const tt = a.b[e] + a.s[e];
      h += a.b[e] - a.s[e];
      d += a.b[e];
      c += a.s[e];
      if (tt > 0) {
        if (u < 0) u = e;
        p = e;
      }
    }
    if (p < 0) continue;
    const f = X[l].o;
    const g = X[l].h;
    const m = X[l].l;
    const b = X[l].c;
    const v = g - m;
    const x = v > 0 ? (b - m) / v : 0.5;
    const y = (g + m) / 2;
    const w = p - u + 1;
    const k = (e: number) => a.lo + e * a.tick;

    // ---- div: single-bar divergence ----
    if (b > f && h < 0 && -h >= 0.15 * o) {
      s.push({ i: l, t: "div", side: "sell", p: g, r: h / o, ts: X[l].ts });
    }
    if (b < f && h > 0 && h >= 0.15 * o) {
      s.push({ i: l, t: "div", side: "buy", p: m, r: h / o, ts: X[l].ts });
    }
    if (w < 5 || v <= 0) continue;

    // zone = bottom/top 20% of active rows (min 2)
    const _ = Math.max(2, Math.round(0.2 * w));
    let T = 0; // buys in top zone
    let S = 0; // sells in top zone
    let j = 0; // buys in bottom zone
    let C = 0; // sells in bottom zone
    for (let e = p - _ + 1; e <= p; e++) {
      T += a.b[e];
      S += a.s[e];
    }
    for (let e = u; e < u + _; e++) {
      j += a.b[e];
      C += a.s[e];
    }

    // ---- abs: absorption ----
    if (c && C / c >= 0.3 && C > 1.2 * j && x >= 0.6) {
      s.push({ i: l, t: "abs", side: "buy", p: m, q: C, u: C * y, lo: k(u), hi: k(u + _), ts: X[l].ts });
    }
    if (d && T / d >= 0.3 && T > 1.2 * S && x <= 0.4) {
      s.push({ i: l, t: "abs", side: "sell", p: g, q: T, u: T * y, lo: k(p - _ + 1), hi: k(p + 1), ts: X[l].ts });
    }

    // ---- exh: exhaustion (10-bar extreme, 10% zone, ≤2% volume) ----
    let N = -Infinity;
    let M = Infinity;
    for (let e = Math.max(0, l - 10); e < l; e++) {
      if (X[e].h > N) N = X[e].h;
      if (X[e].l < M) M = X[e].l;
    }
    const D = Math.max(1, Math.round(0.1 * w));
    let O = 0;
    let B = 0;
    for (let e = p - D + 1; e <= p; e++) O += a.b[e] + a.s[e];
    for (let e = u; e < u + D; e++) B += a.b[e] + a.s[e];
    if (g > N && O <= 0.02 * o && x <= 0.5) {
      s.push({ i: l, t: "exh", side: "sell", p: g, ts: X[l].ts });
    }
    if (m < M && B <= 0.02 * o && x >= 0.5) {
      s.push({ i: l, t: "exh", side: "buy", p: m, ts: X[l].ts });
    }

    // ---- trap: trapped traders (5-bar extreme, ≤3-bar reversal) ----
    let P = -Infinity;
    let A = Infinity;
    for (let e = Math.max(0, l - 5); e < l; e++) {
      if (X[e].h > P) P = X[e].h;
      if (X[e].l < A) A = X[e].l;
    }
    if (g > P && d && T / d >= 0.3 && T > 1.5 * S) {
      for (let i2 = l + 1; i2 <= Math.min(l + 3, t - 2) && !(X[i2].h > g); i2++) {
        if (X[i2].c <= m + 0.25 * v) {
          s.push({
            i: l,
            t: "trap",
            side: "sell",
            p: g,
            j: i2,
            q: T,
            u: T * y,
            lo: k(p - _ + 1),
            hi: k(p + 1),
            ts: X[l].ts,
          });
          break;
        }
      }
    }
    if (m < A && c && C / c >= 0.3 && C > 1.5 * j) {
      for (let i2 = l + 1; i2 <= Math.min(l + 3, t - 2) && !(X[i2].l < m); i2++) {
        if (X[i2].c >= g - 0.25 * v) {
          s.push({
            i: l,
            t: "trap",
            side: "buy",
            p: m,
            j: i2,
            q: C,
            u: C * y,
            lo: k(u),
            hi: k(u + _),
            ts: X[l].ts,
          });
          break;
        }
      }
    }
  }

  // ---- sdiv: swing divergence on cumulative delta ----
  const cvd = new Float64Array(t);
  {
    let acc = 0;
    for (let k = 0; k < t; k++) {
      const f = X[k].fp;
      if (f) for (let e = 0; e < f.b.length; e++) acc += f.b[e] - f.s[e];
      cvd[k] = acc;
    }
  }
  let r = -1; // last swing-high index
  let n2 = -1; // last swing-low index
  for (let a = 3; a <= t - 2 - 3; a++) {
    let isHigh = true;
    let isLow = true;
    for (let e = a - 3; e <= a + 3 && (isHigh || isLow); e++) {
      if (e === a) continue;
      if (e < a ? X[e].h >= X[a].h : X[e].h > X[a].h) isHigh = false;
      if (e < a ? X[e].l <= X[a].l : X[e].l < X[a].l) isLow = false;
    }
    if (!isHigh && !isLow) continue;
    const h: number[] = [];
    for (let e = Math.max(0, a - 20); e < a; e++) if (vol[e]) h.push(vol[e]);
    h.sort((x, y) => x - y);
    const d = 0.25 * (h.length ? h[h.length >> 1] : 0);
    if (isHigh) {
      if (r >= 0 && a - r <= 40 && X[a].h > X[r].h && cvd[r] - cvd[a] > d) {
        s.push({
          i: a,
          t: "sdiv",
          side: "sell",
          p: X[a].h,
          i0: r,
          p0: X[r].h,
          dc: cvd[a] - cvd[r],
          ts: X[a].ts,
        });
      }
      r = a;
    }
    if (isLow) {
      if (n2 >= 0 && a - n2 <= 40 && X[a].l < X[n2].l && cvd[a] - cvd[n2] > d) {
        s.push({
          i: a,
          t: "sdiv",
          side: "buy",
          p: X[a].l,
          i0: n2,
          p0: X[n2].l,
          dc: cvd[a] - cvd[n2],
          ts: X[a].ts,
        });
      }
      n2 = a;
    }
  }

  s.sort((x, y) => x.i - y.i);
  return s;
}

// ---------------------------------------------------------------------------
// Exact formatting helpers (their J, Q, K, $, z, X)
// ---------------------------------------------------------------------------

/** Their `J(e)` — compact base-quantity format. */
export function fmtQty(e: number | null | undefined): string {
  if (null == e || !isFinite(e as number)) return "—";
  const v = e as number;
  const s = Math.abs(v);
  if (!s) return "0";
  return (
    (v < 0 ? "−" : "") +
    (s >= 1e6
      ? (s / 1e6).toFixed(s >= 1e7 ? 0 : 1) + "M"
      : s >= 1e4
        ? (s / 1e3).toFixed(0) + "K"
        : s >= 1e3
          ? (s / 1e3).toFixed(1) + "K"
          : s >= 100
            ? s.toFixed(0)
            : s >= 10
              ? s.toFixed(1)
              : s >= 0.01
                ? s.toFixed(2)
                : "<.01")
  );
}

/** Their USD value format (`fmtU` for usd unit). */
export function fmtUsdVal(e: number | null | undefined): string {
  if (null == e || !isFinite(e as number)) return "—";
  const v = e as number;
  const s = Math.abs(v);
  const body = s >= 1e9 ? (s / 1e9).toFixed(s >= 1e11 ? 1 : 2) + "B" : s >= 1e6 ? (s / 1e6).toFixed(s >= 1e8 ? 1 : 2) + "M" : s >= 1e3 ? (s / 1e3).toFixed(s >= 1e5 ? 0 : 1) + "K" : s.toFixed(0);
  return (v < 0 && body !== "0" ? "−" : "") + body;
}

/** Their `Q(e)` — compact integer count. */
export function fmtCnt(e: number | null | undefined): string {
  if (null == e || !isFinite(e as number)) return "—";
  const v = Math.round(e as number);
  return v >= 1e6 ? (v / 1e6).toFixed(1) + "M" : v >= 1e4 ? (v / 1e3).toFixed(0) + "K" : v >= 1e3 ? (v / 1e3).toFixed(1) + "K" : String(v);
}

/** Their `K(e, t)` — signed percentage. */
export function fmtPctSigned(e: number | null | undefined, t = 2): string {
  if (!isFinite(e as number)) return "—";
  const v = e as number;
  return (v > 0 ? "+" : v < 0 ? "−" : "") + Math.abs(100 * v).toFixed(t) + "%";
}

/** Their `$ (e, t)` — price with fixed decimals. */
export function fmtPriceDec(e: number | null | undefined, t: number): string {
  if (null == e || !isFinite(e as number)) return "—";
  return (e as number).toLocaleString("en-US", { minimumFractionDigits: t, maximumFractionDigits: t });
}

/** Their `z(e)` — decimals of a number. */
export function decOf(e: number): number {
  const t = String(+(+e).toPrecision(10));
  const s = t.indexOf(".");
  return s < 0 ? 0 : t.length - s - 1;
}

/** Their `dp` — price decimals from the last close. */
export function priceDecimals(lastClose: number | null | undefined): number {
  const e = lastClose ?? 0;
  return e >= 1e3 ? 1 : e >= 100 ? 2 : e >= 10 ? 3 : e >= 1 ? 4 : e >= 0.01 ? 5 : 7;
}

/** Their `X(tsMs, withDate)` — accepts seconds here. */
export function fmtTs(tsSec: number, withDate: boolean): string {
  const d = new Date(tsSec * 1000);
  const p = (x: number) => String(x).padStart(2, "0");
  const hm = p(d.getHours()) + ":" + p(d.getMinutes());
  return withDate ? p(d.getMonth() + 1) + "-" + p(d.getDate()) + " " + hm : hm;
}

// ---------------------------------------------------------------------------
// Exact signal naming + text (their sigName / sigText)
// ---------------------------------------------------------------------------

export function cgSigName(g: CgSignal): string {
  const bull = g.side === "buy";
  switch (g.t) {
    case "div":
      return "Divergence";
    case "sdiv":
      return bull ? "Bull div" : "Bear div";
    case "abs":
      return "Absorption";
    case "trap":
      return bull ? "Trapped shorts" : "Trapped longs";
    default:
      return "Exhaustion";
  }
}

export type SigUnit = "qty" | "usd";

/** Their `sigText(g, X)` — [title, detail] with the exact live wording. */
export function cgSigText(g: CgSignal, X: FpBar[], unit: SigUnit): [string, string] {
  const bull = g.side === "buy";
  const fmtV = (q?: number, u?: number) => (unit === "usd" ? fmtUsdVal(u ?? 0) : fmtQty(q ?? 0));
  switch (g.t) {
    case "div":
      return bull
        ? ["Drop without taker selling", `Closed down on positive Delta (${fmtPctSigned(g.r, 0)}), bullish`]
        : ["Rally without taker buying", `Closed up on negative Delta (${fmtPctSigned(g.r, 0)}), bearish`];
    case "abs":
      return bull
        ? [
            "Selling absorbed at the low",
            `${fmtV(g.q, g.u)} of taker selling at the low (30%+ of the bar's selling), yet closed near the high, bullish`,
          ]
        : [
            "Buying absorbed at the high",
            `${fmtV(g.q, g.u)} of taker buying at the high (30%+ of the bar's buying), yet closed near the low, bearish`,
          ];
    case "trap":
      return bull
        ? [
            "Failed breakdown",
            `Broke the 5-bar low on ${fmtV(g.q, g.u)} of taker selling at the bottom, then rallied back into the upper part of the bar ${g.j! - g.i} bars later. Breakdown sellers trapped, bullish`,
          ]
        : [
            "Failed breakout",
            `Broke the 5-bar high on ${fmtV(g.q, g.u)} of taker buying at the top, then fell back into the lower part of the bar ${g.j! - g.i} bars later. Breakout buyers trapped, bearish`,
          ];
    case "sdiv": {
      const c = X[g.i]?.c ?? 0;
      const a = Math.abs(g.dc ?? 0);
      const t0 = fmtTs(X[g.i0 ?? 0]?.ts ?? 0, true);
      const v = unit === "usd" ? fmtUsdVal(a * c) : fmtQty(a);
      return bull
        ? [
            "Lower low, higher Cumulative Delta",
            `Lower low than ${t0}, yet Cumulative Delta rose ${v} over the swing. Sellers aren't following through, bullish`,
          ]
        : [
            "Higher high, lower Cumulative Delta",
            `Higher high than ${t0}, yet Cumulative Delta fell ${v} over the swing. Buyers aren't following through, bearish`,
          ];
    }
    default:
      return bull
        ? ["Seller exhaustion", "New 10-bar low with almost no volume in the bottom 10% of the bar, closed in the upper half, bullish"]
        : ["Buyer exhaustion", "New 10-bar high with almost no volume in the top 10% of the bar, closed in the lower half, bearish"];
  }
}

// ---------------------------------------------------------------------------
// Diagonal imbalances (their definition: buys vs sells one level below,
// sells vs buys one level above)
// ---------------------------------------------------------------------------

export interface ImbRow {
  price: number; // row mid price
  buy: number;
  sell: number;
  diagBuy: number; // opposing diagonal value
  ratio: number;
  side: "buy" | "sell";
}

export function diagonalImbalances(fp: Fp, ratio: number): { buy: ImbRow[]; sell: ImbRow[] } {
  const buy: ImbRow[] = [];
  const sell: ImbRow[] = [];
  for (let i = 0; i < fp.b.length; i++) {
    const price = fp.lo + (i + 0.5) * fp.tick;
    const diagSell = i > 0 ? fp.s[i - 1] : 0; // sells one level below
    const diagBuy = i + 1 < fp.b.length ? fp.b[i + 1] : 0; // buys one level above
    if (fp.b[i] > 0 && fp.b[i] >= ratio * diagSell && diagSell >= 0 && fp.b[i] / Math.max(diagSell, 1e-9) >= ratio) {
      buy.push({ price, buy: fp.b[i], sell: fp.s[i], diagBuy: diagSell, ratio: fp.b[i] / Math.max(diagSell, 1e-9), side: "buy" });
    }
    if (fp.s[i] > 0 && fp.s[i] >= ratio * diagBuy && fp.s[i] / Math.max(diagBuy, 1e-9) >= ratio) {
      sell.push({ price, buy: fp.b[i], sell: fp.s[i], diagBuy, ratio: fp.s[i] / Math.max(diagBuy, 1e-9), side: "sell" });
    }
  }
  buy.sort((a, b) => b.price - a.price);
  sell.sort((a, b) => b.price - a.price);
  return { buy, sell };
}
