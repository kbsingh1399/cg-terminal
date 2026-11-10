import type { OrderFlowBar } from "./types";
import type { BarBasis } from "./altbars";

/**
 * Footprint signal engine — mirrors the signal classes annotated on the
 * Coinglass footprint page. Signals are computed independently on each bar
 * type (time bars like 15m, volume bars like 2.5K BTC, range bars like
 * 200 pts): "The same move gives different signals on different bars."
 *
 * Signal classes (with their attached data points, as on Coinglass):
 *   - Absorption  "Low sells absorbed"  — 571 sells (30%) but close near high
 *                 "High buys absorbed"  — heavy buys into highs, close near low
 *   - Bear div    "Higher highs but cumulative delta lower"
 *   - Bull div    "Lower lows but cumulative delta higher"
 *   - Divergence  "Rally without buys" / "Decline without sells"
 *   - Exhaustion  "Seller exhaustion" / "Buyer exhaustion"
 *
 * All gates are percentile-based against a rolling window so the same rules
 * fire on 15m, volume and range bars alike.
 */

export interface FlowBar {
  ts: number;
  buy: number;
  sell: number;
  vol: number;
  delta: number;
  lowZoneSell: number; // sell volume in the bottom 30% of the bar range
  highZoneBuy: number; // buy volume in the top 30% of the bar range
  lowZoneSellCnt: number; // sell trade count in the low zone
  highZoneBuyCnt: number; // buy trade count in the high zone
  buyCnt: number;
  sellCnt: number;
  closePos: number; // (c - l) / (h - l), 0..1
  o: number;
  h: number;
  l: number;
  c: number;
}

export type SignalType = "absorption" | "bear_div" | "bull_div" | "divergence" | "exhaustion";
export type SignalDir = "bullish" | "bearish";

export interface Signal {
  id: string;
  ts: number;
  basis: BarBasis; // bar type the signal was computed on
  label: string; // "15m" | "Volume 2.5K BTC" | "Range 200"
  type: SignalType;
  name: string; // display name: Absorption / Bear div / Bull div / Divergence / Exhaustion
  dir: SignalDir;
  text: string; // short description, e.g. "Low sells absorbed"
  detail: string; // attached data points
  strength: number; // 0..100
  price: number; // bar close where the signal fired
}

export interface SignalParams {
  basis: BarBasis;
  label: string;
  window?: number; // rolling percentile window in bars (default 60)
}

/** Fold raw order-flow buckets into per-bar flow metrics. */
export function barsToFlow(
  bars: OrderFlowBar[],
  candles?: { ts: number; o: number; h: number; l: number; c: number }[]
): FlowBar[] {
  const candleByTs = new Map<number, { ts: number; o: number; h: number; l: number; c: number }>();
  if (candles) for (const c of candles) candleByTs.set(c.ts, c);
  const out: FlowBar[] = [];
  for (const b of bars) {
    if (!Array.isArray(b.buckets) || !b.buckets.length) continue;
    let buy = 0;
    let sell = 0;
    let buyCnt = 0;
    let sellCnt = 0;
    let lo = Infinity;
    let hi = -Infinity;
    for (const bk of b.buckets) {
      lo = Math.min(lo, bk[0]);
      hi = Math.max(hi, bk[1]);
      buy += bk[2];
      sell += bk[3];
      buyCnt += bk[8];
      sellCnt += bk[9];
    }
    const range = hi - lo || 1;
    // weight each bucket's volume/count by its overlap with the bottom/top 30% zone
    let lowZoneSell = 0;
    let highZoneBuy = 0;
    let lowZoneSellCnt = 0;
    let highZoneBuyCnt = 0;
    for (const bk of b.buckets) {
      const bLo = bk[0];
      const bHi = bk[1];
      const w = bHi - bLo || 1;
      const ovLow = Math.max(0, Math.min(bHi, lo + 0.3 * range) - bLo) / w;
      const ovHigh = Math.max(0, bHi - Math.max(bLo, hi - 0.3 * range)) / w;
      lowZoneSell += bk[3] * ovLow;
      lowZoneSellCnt += bk[9] * ovLow;
      highZoneBuy += bk[2] * ovHigh;
      highZoneBuyCnt += bk[8] * ovHigh;
    }
    const kc = candleByTs.get(b.ts);
    let closePos: number;
    let o: number;
    let c: number;
    if (kc && kc.h > kc.l) {
      closePos = Math.min(1, Math.max(0, (kc.c - kc.l) / (kc.h - kc.l)));
      lo = Math.min(lo, kc.l);
      hi = Math.max(hi, kc.h);
      o = kc.o;
      c = kc.c;
    } else {
      let wSum = 0;
      let wPos = 0;
      for (const bk of b.buckets) {
        const mid = (bk[0] + bk[1]) / 2;
        const w = bk[2] + bk[3];
        wSum += w;
        wPos += mid * w;
      }
      closePos = wSum ? (wPos / wSum - lo) / range : 0.5;
      o = lo;
      c = lo + closePos * range;
    }
    out.push({
      ts: b.ts,
      buy,
      sell,
      vol: buy + sell,
      delta: buy - sell,
      lowZoneSell,
      highZoneBuy,
      lowZoneSellCnt,
      highZoneBuyCnt,
      buyCnt,
      sellCnt,
      closePos,
      o,
      h: hi,
      l: lo,
      c,
    });
  }
  return out;
}

/** Percentile of v within values (0..1). */
function pctOf(values: number[], v: number): number {
  if (!values.length) return 0;
  let below = 0;
  for (const x of values) if (x <= v) below++;
  return below / values.length;
}

function fmtK(n: number): string {
  const a = Math.abs(n);
  if (a >= 1000) return `${(n / 1000).toFixed(1)}K`;
  if (a >= 10) return n.toFixed(0);
  return n.toFixed(1);
}

function hhmm(ts: number): string {
  const d = new Date(ts * 1000);
  return `${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")} ${String(
    d.getUTCHours()
  ).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}

const NAMES: Record<SignalType, string> = {
  absorption: "Absorption",
  bear_div: "Bear div",
  bull_div: "Bull div",
  divergence: "Divergence",
  exhaustion: "Exhaustion",
};

/**
 * Compute signals over a flow series (one bar type). Deterministic and
 * lookahead-limited: a bar may reference at most the next 2 bars for the
 * absorption hold-check, exactly like the annotated history settles once the
 * following bars exist.
 */
export function computeSignals(flow: FlowBar[], params: SignalParams): Signal[] {
  const { basis, label } = params;
  const win = params.window ?? 60;
  const signals: Signal[] = [];
  const n = flow.length;
  if (n < 12) return signals;

  // cumulative delta series
  const cvd: number[] = new Array(n).fill(0);
  for (let i = 0; i < n; i++) cvd[i] = (i ? cvd[i - 1] : 0) + flow[i].delta;

  const lastOf: Record<string, number> = {};
  const push = (
    i: number,
    s: Omit<Signal, "id" | "ts" | "basis" | "label" | "name" | "price"> & { name?: string }
  ) => {
    const key = `${s.type}|${s.dir}`;
    if (lastOf[key] !== undefined && i - lastOf[key] < 5) return;
    lastOf[key] = i;
    const b = flow[i];
    signals.push({
      ...s,
      ts: b.ts,
      id: `${basis}-${b.ts}-${s.type}-${s.dir}`,
      basis,
      label,
      name: s.name ?? NAMES[s.type],
      price: b.c,
    } as Signal);
  };

  for (let i = 4; i < n; i++) {
    const b = flow[i];
    const wStart = Math.max(0, i - win);
    const w = flow.slice(wStart, i + 1);
    const range = b.h - b.l || 1;

    const winVol = w.map((x) => x.vol);
    const winLowSell = w.map((x) => x.lowZoneSell);
    const winHighBuy = w.map((x) => x.highZoneBuy);
    const winSell = w.map((x) => x.sell);
    const winBuy = w.map((x) => x.buy);

    // ---------- Absorption ----------
    // bullish: heavy selling into the lows, price recovers and holds
    const lowShare = b.vol > 0 ? b.lowZoneSell / b.vol : 0;
    const lowSellRel = pctOf(winLowSell, b.lowZoneSell);
    if (lowShare >= 0.2 && lowSellRel >= 0.8 && b.closePos >= 0.6) {
      const next = flow.slice(i + 1, i + 3);
      const held = next.length ? next.every((x) => x.l > b.l - 0.25 * range) : true;
      if (held) {
        const pct = Math.round(lowShare * 100);
        const sells = b.lowZoneSellCnt >= 1 ? `${Math.round(b.lowZoneSellCnt)} sells` : `${fmtK(b.lowZoneSell)} BTC sold`;
        push(i, {
          type: "absorption",
          dir: "bullish",
          text: "Low sells absorbed",
          detail: `${sells} (${pct}%) but close near high`,
          strength: Math.round(Math.min(100, 45 + lowSellRel * 40 + (b.closePos - 0.6) * 60)),
        });
      }
    }
    // bearish: heavy buying into the highs, price rejects
    const highShare = b.vol > 0 ? b.highZoneBuy / b.vol : 0;
    const highBuyRel = pctOf(winHighBuy, b.highZoneBuy);
    if (highShare >= 0.2 && highBuyRel >= 0.8 && b.closePos <= 0.4) {
      const next = flow.slice(i + 1, i + 3);
      const held = next.length ? next.every((x) => x.h < b.h + 0.25 * range) : true;
      if (held) {
        const pct = Math.round(highShare * 100);
        const buys = b.highZoneBuyCnt >= 1 ? `${Math.round(b.highZoneBuyCnt)} buys` : `${fmtK(b.highZoneBuy)} BTC bought`;
        push(i, {
          type: "absorption",
          dir: "bearish",
          text: "High buys absorbed",
          detail: `${buys} (${pct}%) but close near low`,
          strength: Math.round(Math.min(100, 45 + highBuyRel * 40 + (0.4 - b.closePos) * 60)),
        });
      }
    }

    // ---------- Cumulative-delta divergence ----------
    // prior pivot high (local max of a ±3 neighborhood, at least 4 bars back)
    let pj = -1;
    for (let j = i - 4; j >= wStart; j--) {
      const nb = flow.slice(Math.max(0, j - 3), Math.min(n, j + 4));
      if (flow[j].h >= Math.max(...nb.map((x) => x.h))) {
        pj = j;
        break;
      }
    }
    if (pj >= 0 && b.h >= flow[pj].h && cvd[i] < cvd[pj]) {
      const gap = (cvd[pj] - cvd[i]) / (Math.abs(cvd[pj]) + Math.abs(cvd[i]) + 1e-9);
      if (gap > 0.05) {
        push(i, {
          type: "bear_div",
          dir: "bearish",
          text: "Higher highs but cumulative delta lower",
          detail: `high ${b.h.toFixed(1)} vs ${flow[pj].h.toFixed(1)} · CVD ${fmtK(cvd[i])} < ${fmtK(cvd[pj])} (${hhmm(flow[pj].ts)})`,
          strength: Math.round(Math.min(100, 40 + gap * 120)),
        });
      }
    }
    // prior pivot low
    let qj = -1;
    for (let j = i - 4; j >= wStart; j--) {
      const nb = flow.slice(Math.max(0, j - 3), Math.min(n, j + 4));
      if (flow[j].l <= Math.min(...nb.map((x) => x.l))) {
        qj = j;
        break;
      }
    }
    if (qj >= 0 && b.l <= flow[qj].l && cvd[i] > cvd[qj]) {
      const gap = (cvd[i] - cvd[qj]) / (Math.abs(cvd[qj]) + Math.abs(cvd[i]) + 1e-9);
      if (gap > 0.05) {
        push(i, {
          type: "bull_div",
          dir: "bullish",
          text: "Lower lows but cumulative delta higher",
          detail: `low ${b.l.toFixed(1)} vs ${flow[qj].l.toFixed(1)} · CVD ${fmtK(cvd[i])} > ${fmtK(cvd[qj])} (${hhmm(flow[qj].ts)})`,
          strength: Math.round(Math.min(100, 40 + gap * 120)),
        });
      }
    }

    // ---------- Divergence: one-sided flow against the bar's direction ----------
    const upMove = b.c > b.o && b.closePos >= 0.6;
    const volRel = pctOf(winVol, b.vol);
    if (upMove && b.delta < 0 && volRel >= 0.45) {
      const buyShare = b.vol > 0 ? b.buy / b.vol : 0;
      push(i, {
        type: "divergence",
        dir: "bearish",
        text: "Rally without buys",
        detail: `close ${b.c.toFixed(1)} (+${(((b.c - b.o) / b.o) * 100).toFixed(2)}%) on only ${fmtK(b.buy)} BTC buys vs ${fmtK(b.sell)} sells (${Math.round(buyShare * 100)}% buys)`,
        strength: Math.round(Math.min(100, 40 + (0.5 - buyShare) * 120 + volRel * 20)),
      });
    }
    const downMove = b.c < b.o && b.closePos <= 0.4;
    if (downMove && b.delta > 0 && volRel >= 0.45) {
      const sellShare = b.vol > 0 ? b.sell / b.vol : 0;
      push(i, {
        type: "divergence",
        dir: "bullish",
        text: "Decline without sells",
        detail: `close ${b.c.toFixed(1)} (${(((b.c - b.o) / b.o) * 100).toFixed(2)}%) while delta +${fmtK(b.delta)} BTC (${Math.round(sellShare * 100)}% sells)`,
        strength: Math.round(Math.min(100, 40 + (sellShare - 0.5) * 120 + volRel * 20)),
      });
    }

    // ---------- Exhaustion ----------
    const prev20 = flow.slice(Math.max(0, i - 20), i);
    if (prev20.length >= 8) {
      const maxH = Math.max(...prev20.map((x) => x.h));
      const minL = Math.min(...prev20.map((x) => x.l));
      // seller exhaustion: fresh low on drying-up sell flow
      if (b.l <= minL) {
        const sellRel = pctOf(winSell, b.sell);
        if (sellRel <= 0.3) {
          push(i, {
            type: "exhaustion",
            dir: "bullish",
            text: "Seller exhaustion",
            detail: `new low ${b.l.toFixed(1)} on only ${fmtK(b.sell)} BTC sold (p${Math.round(sellRel * 100)} of window)`,
            strength: Math.round(Math.min(100, 45 + (0.3 - sellRel) * 150)),
          });
        }
      }
      // buyer exhaustion: fresh high on drying-up buy flow
      if (b.h >= maxH) {
        const buyRel = pctOf(winBuy, b.buy);
        if (buyRel <= 0.3) {
          push(i, {
            type: "exhaustion",
            dir: "bearish",
            text: "Buyer exhaustion",
            detail: `new high ${b.h.toFixed(1)} on only ${fmtK(b.buy)} BTC bought (p${Math.round(buyRel * 100)} of window)`,
            strength: Math.round(Math.min(100, 45 + (0.3 - buyRel) * 150)),
          });
        }
      }
    }
  }

  return signals;
}
