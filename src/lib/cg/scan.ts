/**
 * Signal scanner — the notification engine.
 *
 * Runs server-side on a staggered schedule per asset and turns every tab's
 * data into live notifications:
 *
 *   footprint  — Absorption / Divergence / Strong-div / Trap / Exhaustion on
 *                all three bar types (15m time · auto volume · auto range),
 *                the exact Coinglass client algorithm (cg-signals.ts)
 *   indicators — RSI OB/OS, day-VWAP ±2σ/±3σ band crosses, day POC/VAH/VAL
 *                crosses, EMA13×EMA89 crosses, day high/low breakouts
 *   whale      — new ≥$10M resting orders, aggregate bid/ask imbalance flips
 *   liqlevels  — price entering a strong liquidation cluster (sweep setup)
 *   cvd        — price/CVD pivot divergences (aggregated perp taker flows)
 *
 * First scan per asset only primes state (no event spam); after that every
 * new signal emits exactly once. All upstream reads go through the cached
 * cgGet client / fp-load snapshot cache.
 */

import { cgGet, FAPI } from "./client";
import {
  autoThreshold,
  buildDerivedBars,
  computeCgSignals,
  cgSigName,
  cgSigText,
  type CgSignal,
  type FpBar,
} from "./cg-signals";
import { loadFpBars } from "./fp-load";
import { buildMarketSnapshot, type MarketSnapshot } from "./market";
import { buildLiqModel, liqStats, type RawLiqPayload, type KeyLevel } from "./liq-model";
import { ASSETS, assetOf, leadInstr, liqVenues } from "./assets";
import { getLivePrice } from "../live/server-price";
import { emit, type CgNotification } from "./notify";
import { fmtAssetPrice } from "./assets";

export interface SignalSetInfo {
  bt: "time" | "vol" | "range";
  label: string;
  sigs: CgSignal[];
}

export interface SignalsSnapshot {
  sym: string;
  sets: SignalSetInfo[];
  counts: { all: number; bullish: number; bearish: number };
  thresholds: { vol: number; range: number };
  bars: number;
  updatedAt: number;
}

export interface WhaleSnapshot {
  sym: string;
  bidUsd: number;
  askUsd: number;
  orders: number;
  exchanges: number;
  topBids: { price: number; usd: number }[];
  topAsks: { price: number; usd: number }[];
  bigNew: { price: number; usd: number; side: "bid" | "ask"; ex: string }[];
  updatedAt: number;
}

export interface LiqSnapshot {
  sym: string;
  last: number;
  topAbove: KeyLevel[];
  topBelow: KeyLevel[];
  totals: { shorts: number; longs: number };
  updatedAt: number;
}

export interface CvdSnapshot {
  sym: string;
  cvd: number;
  delta24h: number;
  divergences: { dir: "bullish" | "bearish"; from: number; to: number; p0: number; p1: number; d0: number; d1: number }[];
  updatedAt: number;
}

interface ScanState {
  primed: boolean; // footprint signals
  marketPrimed: boolean;
  whalePrimed: boolean;
  liqPrimed: boolean;
  cvdPrimed: boolean;
  seenSig: Set<string>;
  prevRsi: { m15: number | null; h1: number | null };
  prevBand: number | null; // signed VWAP band index (±1, ±2, ±3, 0)
  prevVa: number | null; // -1 below VAL · 0 inside · +1 above VAH
  prevEmaCross: { m15: number | null; h1: number | null };
  prevDayHigh: number | null;
  prevDayLow: number | null;
  whaleSeen: Set<number>;
  prevWhaleImb: number | null;
  liqNotified: Map<string, number>;
  cvdNotified: Set<string>;
}

interface ScanGlobal {
  states: Map<string, ScanState>;
  signals: Map<string, SignalsSnapshot>;
  whale: Map<string, WhaleSnapshot>;
  liq: Map<string, LiqSnapshot>;
  cvd: Map<string, CvdSnapshot>;
  started: boolean;
  ticks: number;
}

const g = globalThis as unknown as { __cgScanner?: ScanGlobal };
const S: ScanGlobal = (g.__cgScanner ??= { states: new Map(), signals: new Map(), whale: new Map(), liq: new Map(), cvd: new Map(), started: false, ticks: 0 });

function stateOf(sym: string): ScanState {
  let st = S.states.get(sym);
  if (!st) {
    st = {
      primed: false,
      marketPrimed: false,
      whalePrimed: false,
      liqPrimed: false,
      cvdPrimed: false,
      seenSig: new Set(),
      prevRsi: { m15: null, h1: null },
      prevBand: null,
      prevVa: null,
      prevEmaCross: { m15: null, h1: null },
      prevDayHigh: null,
      prevDayLow: null,
      whaleSeen: new Set(),
      prevWhaleImb: null,
      liqNotified: new Map(),
      cvdNotified: new Set(),
    };
    S.states.set(sym, st);
  }
  return st;
}

// ---------------------------------------------------------------------------
// Footprint signals (exact Coinglass engine, three bar types)
// ---------------------------------------------------------------------------

async function scanFootprint(sym: string) {
  const st = stateOf(sym);
  const timeRes = await loadFpBars(sym, "m15", 300, false, 120_000);
  const m1Res = await loadFpBars(sym, "m1", 1000, false, 300_000);
  const timeBars = timeRes.bars;
  const m1Bars = m1Res.bars;

  const volThr = autoThreshold(m1Bars, "vol");
  const rangeThr = autoThreshold(m1Bars, "range");
  const sets: SignalSetInfo[] = [];
  const seriesByBt = new Map<string, FpBar[]>([["time", timeBars]]);
  const timeSigs = computeCgSignals(timeBars).map((s) => ({ ...s, bt: "time" as const }));
  sets.push({ bt: "time", label: "15m", sigs: timeSigs });
  if (volThr > 0 && m1Bars.length) {
    const bars = buildDerivedBars(m1Bars, "vol", volThr);
    seriesByBt.set("vol", bars);
    sets.push({ bt: "vol", label: `Volume ${volThr.toLocaleString("en-US")} ${sym}`, sigs: computeCgSignals(bars).map((s) => ({ ...s, bt: "vol" as const })) });
  }
  if (rangeThr > 0 && m1Bars.length) {
    const bars = buildDerivedBars(m1Bars, "range", rangeThr);
    seriesByBt.set("range", bars);
    sets.push({ bt: "range", label: `Range ${rangeThr}`, sigs: computeCgSignals(bars).map((s) => ({ ...s, bt: "range" as const })) });
  }

  let bullish = 0;
  let bearish = 0;
  for (const set of sets) {
    for (const sig of set.sigs) {
      if (sig.side === "buy") bullish++;
      else bearish++;
    }
  }
  S.signals.set(sym, {
    sym,
    sets,
    counts: { all: bullish + bearish, bullish, bearish },
    thresholds: { vol: volThr, range: rangeThr },
    bars: timeBars.length,
    updatedAt: Date.now(),
  });

  // emit new signals (last 60 per set is plenty; older were seen before)
  for (const set of sets) {
    const recent = set.sigs.slice(-60);
    const seriesBars = seriesByBt.get(set.bt) ?? timeBars;
    for (const sig of recent) {
      const key = `${set.bt}|${sig.ts}|${sig.t}|${sig.side}|${Math.round(sig.p * 1e6)}`;
      if (st.seenSig.has(key)) continue;
      st.seenSig.add(key);
      if (!st.primed) continue;
      if (Date.now() / 1000 - sig.ts > 45 * 60) continue; // too old — history, not live
      const [main, sub] = cgSigText(sig, seriesBars as FpBar[], "usd");
      const dir = sig.side === "buy" ? "bullish" : "bearish";
      emit({
        ts: Date.now(),
        asset: sym,
        source: "footprint",
        kind: sig.t,
        dir,
        severity: sig.t === "abs" || sig.t === "trap" || sig.t === "sdiv" ? "high" : "info",
        title: `${sym} ${cgSigName(sig)} · ${set.label}`,
        detail: `${main} — ${sub}`,
        price: sig.p,
        barTs: sig.ts,
        barType: set.bt,
        meta: { r: sig.r, q: sig.q, u: sig.u },
      });
    }
  }
  if (st.seenSig.size > 4000) st.seenSig = new Set([...st.seenSig].slice(-2000));
  st.primed = true;
}

// ---------------------------------------------------------------------------
// Indicator events (auction / VWAP / EMA / RSI)
// ---------------------------------------------------------------------------

function bandIndexOf(price: number, vwap: number, sd1: number): number {
  if (!Number.isFinite(price) || !Number.isFinite(vwap) || !(sd1 > 0)) return 0;
  const d = (price - vwap) / sd1;
  const a = Math.abs(d);
  const lvl = a >= 3 ? 3 : a >= 2 ? 2 : a >= 1 ? 1 : 0;
  return Math.sign(d) * lvl;
}

async function scanMarket(sym: string) {
  const st = stateOf(sym);
  const snap: MarketSnapshot = await buildMarketSnapshot(sym);
  const p = snap.price.last;
  if (null == p) return;

  // RSI OB/OS (m15 + h1)
  for (const tf of ["m15", "h1"] as const) {
    const v = snap.rsi[tf];
    const prev = st.prevRsi[tf];
    st.prevRsi[tf] = v;
    if (null == v || null == prev || !st.primed) continue;
    if (prev < 70 && v >= 70) {
      emit({ ts: Date.now(), asset: sym, source: "indicators", kind: "rsi_ob", dir: "bearish", severity: "info",
        title: `${sym} RSI overbought (${tf})`, detail: `RSI(14) ${v.toFixed(1)} on ${tf} — stretched, watch for exhaustion`, price: p });
    } else if (prev > 30 && v <= 30) {
      emit({ ts: Date.now(), asset: sym, source: "indicators", kind: "rsi_os", dir: "bullish", severity: "info",
        title: `${sym} RSI oversold (${tf})`, detail: `RSI(14) ${v.toFixed(1)} on ${tf} — stretched, watch for absorption`, price: p });
    } else if (prev >= 70 && v < 70 && v >= 55) {
      emit({ ts: Date.now(), asset: sym, source: "indicators", kind: "rsi_ob_exit", dir: "bearish", severity: "info",
        title: `${sym} RSI left overbought (${tf})`, detail: `RSI(14) ${v.toFixed(1)} rolling down from OB`, price: p });
    } else if (prev <= 30 && v > 30 && v <= 45) {
      emit({ ts: Date.now(), asset: sym, source: "indicators", kind: "rsi_os_exit", dir: "bullish", severity: "info",
        title: `${sym} RSI left oversold (${tf})`, detail: `RSI(14) ${v.toFixed(1)} turning up from OS`, price: p });
    }
  }

  // VWAP band crosses (±2σ / ±3σ only — the tradeable bands)
  if (snap.vwap.vwap != null && snap.vwap.bands.sd1 > 0) {
    const band = bandIndexOf(p, snap.vwap.vwap, snap.vwap.bands.sd1);
    const prev = st.prevBand;
    st.prevBand = band;
    if (st.marketPrimed && prev != null && Math.abs(band) >= 2 && band !== prev) {
      const dirSign = band > 0 ? "above" : "below";
      const sgn = Math.abs(band);
      const dir: "bullish" | "bearish" = band > 0 ? "bearish" : "bullish"; // extended beyond band = fade risk
      emit({ ts: Date.now(), asset: sym, source: "indicators", kind: `vwap_band_${sgn}`, dir, severity: sgn >= 3 ? "high" : "info",
        title: `${sym} crossed VWAP ${dirSign} ${sgn}σ`, detail: `price ${fmtAssetPrice(p, sym)} vs day VWAP ${fmtAssetPrice(snap.vwap.vwap, sym)} — ${sgn >= 3 ? "3σ extension: mean-reversion / exhaustion zone" : "2σ band cross"}`,
        price: p, meta: { vwap: snap.vwap.vwap, sd: snap.vwap.bands.sd1 } });
    }
  }

  // Day value-area crosses (POC / VAH / VAL)
  const dayP = snap.auction.day;
  if (dayP.poc != null && dayP.vah != null && dayP.val != null) {
    let va = 0;
    if (p > dayP.vah) va = 1;
    else if (p < dayP.val) va = -1;
    const prev = st.prevVa;
    st.prevVa = va;
    if (st.marketPrimed && prev != null && va !== prev) {
      if (va === 1) {
        emit({ ts: Date.now(), asset: sym, source: "indicators", kind: "vah_break", dir: "bullish", severity: "info",
          title: `${sym} broke above day VAH`, detail: `price ${fmtAssetPrice(p, sym)} > VAH ${fmtAssetPrice(dayP.vah, sym)} — acceptance above value is bullish`, price: p, meta: { vah: dayP.vah, poc: dayP.poc } });
      } else if (va === -1) {
        emit({ ts: Date.now(), asset: sym, source: "indicators", kind: "val_break", dir: "bearish", severity: "info",
          title: `${sym} broke below day VAL`, detail: `price ${fmtAssetPrice(p, sym)} < VAL ${fmtAssetPrice(dayP.val, sym)} — acceptance below value is bearish`, price: p, meta: { val: dayP.val, poc: dayP.poc } });
      } else if (prev !== 0) {
        emit({ ts: Date.now(), asset: sym, source: "indicators", kind: "va_reject", dir: prev > 0 ? "bearish" : "bullish", severity: "info",
          title: `${sym} rejected back into day value area`, detail: `price ${fmtAssetPrice(p, sym)} back inside VAL ${fmtAssetPrice(dayP.val, sym)}–VAH ${fmtAssetPrice(dayP.vah, sym)} — failed auction outside value`, price: p });
      }
    }
  }

  // EMA13 × EMA89 crosses (m15 + h1)
  for (const tf of ["m15", "h1"] as const) {
    const e = snap.ema[tf];
    if (null == e.e13 || null == e.e89) continue;
    const x = e.e13 > e.e89 ? 1 : -1;
    const prev = st.prevEmaCross[tf];
    st.prevEmaCross[tf] = x;
    if (st.marketPrimed && prev != null && x !== prev) {
      emit({ ts: Date.now(), asset: sym, source: "indicators", kind: `ema_cross_${tf}`, dir: x > 0 ? "bullish" : "bearish", severity: "info",
        title: `${sym} EMA13 ${x > 0 ? "crossed above" : "crossed below"} EMA89 (${tf})`, detail: `13-EMA ${fmtAssetPrice(e.e13, sym)} vs 89-EMA ${fmtAssetPrice(e.e89, sym)} — trend shift on ${tf}`, price: p });
    }
  }

  // day high/low breakouts
  if (st.marketPrimed && st.prevDayHigh != null && snap.price.dayHigh != null && snap.price.dayHigh > st.prevDayHigh * 1.0008) {
    emit({ ts: Date.now(), asset: sym, source: "indicators", kind: "day_high_break", dir: "bullish", severity: "info",
      title: `${sym} new UTC day high`, detail: `day high extended to ${fmtAssetPrice(snap.price.dayHigh, sym)} — stops above prior high likely swept`, price: snap.price.dayHigh });
  }
  if (st.marketPrimed && st.prevDayLow != null && snap.price.dayLow != null && snap.price.dayLow < st.prevDayLow * 0.9992) {
    emit({ ts: Date.now(), asset: sym, source: "indicators", kind: "day_low_break", dir: "bearish", severity: "info",
      title: `${sym} new UTC day low`, detail: `day low extended to ${fmtAssetPrice(snap.price.dayLow, sym)} — stops below prior low likely swept`, price: snap.price.dayLow });
  }
  st.prevDayHigh = snap.price.dayHigh;
  st.prevDayLow = snap.price.dayLow;
  st.marketPrimed = true;
}

// ---------------------------------------------------------------------------
// Whale open orders
// ---------------------------------------------------------------------------

interface LtoRawGroup {
  instrument?: { exName?: string; instrumentId?: string };
  list?: { id: number; price: number; side: number; currentUsd: number; currentAmount?: number }[];
}

async function scanWhale(sym: string) {
  const st = stateOf(sym);
  const support = (await cgGet(`/api/largeTakerOrder/support/v3?symbol=${encodeURIComponent(sym)}`, 10 * 60_000, FAPI).catch(() => null)) as {
    futures?: { exchange: string }[];
    spot?: { exchange: string }[];
  } | null;
  const exchanges = [...new Set([...(support?.futures ?? []), ...(support?.spot ?? [])].map((s) => s.exchange))];
  if (!exchanges.length) return;
  const settled = await Promise.allSettled(
    exchanges.map((ex) => cgGet(`/api/largeTakerOrder/v3?exchange=${encodeURIComponent(ex)}&symbol=${encodeURIComponent(sym)}&market=all&limit=3000&minVolUsd=1000000`, 5 * 60_000, FAPI))
  );
  const at = Date.now();
  // Live market price — the plausibility anchor: a RESTING ask must sit at or
  // above the market, a RESTING bid at or below (±0.5% tolerance for venue/
  // spot-vs-perp drift). The upstream feed also carries already-filled or
  // cancelled orders far from market (e.g. "ask walls" 15% BELOW price) —
  // those are stale and must not become alerts or skew the imbalance.
  const liveP = (await getLivePrice(sym).catch(() => null))?.price ?? null;
  // Side convention (types.ts LtoOrder.side, verified empirically live
  // 2026-11-11 on /api/cg/lto?sym=BTC: all 672 side=1 orders rest ABOVE the
  // live price, all 613 side=2 orders BELOW it, side is never 0):
  //   1 = ask (sell wall), 2 = bid (buy wall)
  // The pre-fix code tested `side === 0` for bids — with real 1|2 data every
  // order landed in the ask branch, inverting the whole bid/ask math.
  const isBid = (side: number) => side === 2;
  const plausible = (side: number, price: number): boolean => {
    if (liveP == null || !(price > 0)) return true; // no reference — legacy behavior
    const rel = (price - liveP) / liveP;
    // a RESTING bid sits at or below the market (≤ +0.5% venue drift, ≥ −10%),
    // a RESTING ask at or above it — anything else is a stale/cancelled order
    return isBid(side) ? rel <= 0.005 && rel >= -0.1 : rel >= -0.005 && rel <= 0.1;
  };
  let bidUsd = 0;
  let askUsd = 0;
  let orders = 0;
  let exOk = 0;
  const bidBins = new Map<number, number>();
  const askBins = new Map<number, number>();
  const bigNew: WhaleSnapshot["bigNew"] = [];
  let firstPrice: number | null = null;
  settled.forEach((r) => {
    if (r.status !== "fulfilled" || !Array.isArray(r.value)) return;
    exOk++;
    for (const grp of r.value as LtoRawGroup[]) {
      for (const o of grp.list ?? []) {
        if (!(o.currentUsd >= 1_000_000)) continue;
        if (!plausible(o.side, o.price)) continue; // stale/impossible resting order
        if (firstPrice == null) firstPrice = o.price;
        orders++;
        if (isBid(o.side)) bidUsd += o.currentUsd;
        else askUsd += o.currentUsd;
        // price bins 0.2% wide for walls — anchored to the LIVE price when
        // available (deterministic), else the first observed order price
        const anchor = liveP ?? firstPrice;
        const bin = anchor != null ? Math.round((Math.log(o.price / anchor) / Math.log(1.002))) : Math.round(o.price);
        const m = isBid(o.side) ? bidBins : askBins;
        m.set(bin, (m.get(bin) ?? 0) + o.currentUsd);
        if (o.currentUsd >= 10_000_000) {
          if (!st.whaleSeen.has(o.id)) {
            st.whaleSeen.add(o.id);
            if (st.whalePrimed) bigNew.push({ price: o.price, usd: o.currentUsd, side: isBid(o.side) ? "bid" : "ask", ex: grp.instrument?.exName ?? "?" });
          }
        } else if (!st.whaleSeen.has(o.id)) {
          st.whaleSeen.add(o.id);
        }
      }
    }
  });
  if (st.whaleSeen.size > 8000) st.whaleSeen = new Set([...st.whaleSeen].slice(-4000));
  if (!orders || firstPrice == null) return;

  const topOf = (m: Map<number, number>, k: number) =>
    [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, k).map(([bin, usd]) => ({ price: (liveP ?? firstPrice!) * Math.pow(1.002, bin), usd }));
  const topBids = topOf(bidBins, 3);
  const topAsks = topOf(askBins, 3);

  S.whale.set(sym, { sym, bidUsd, askUsd, orders, exchanges: exOk, topBids, topAsks, bigNew, updatedAt: at });
  st.whalePrimed = true; // per-lane priming: a footprint failure must not silence whale alerts

  for (const w of bigNew) {
    emit({ ts: at, asset: sym, source: "whale-orders", kind: "whale_wall", dir: w.side === "bid" ? "bullish" : "bearish", severity: "high",
      title: `${sym} whale ${w.side} wall ${fmtUsd(w.usd)} @ ${fmtAssetPrice(w.price, sym)}`, detail: `new resting ${w.side} order ≥ $10M on ${w.ex} — magnet / defense level`, price: w.price, meta: { ex: w.ex, side: w.side } });
  }
  const imb = bidUsd + askUsd > 0 ? (bidUsd - askUsd) / (bidUsd + askUsd) : 0;
  const prevImb = st.prevWhaleImb;
  st.prevWhaleImb = imb;
  if (st.whalePrimed && prevImb != null && Math.abs(imb) >= 0.25 && Math.sign(imb) !== Math.sign(prevImb || 0)) {
    emit({ ts: at, asset: sym, source: "whale-orders", kind: "whale_imb_flip", dir: imb > 0 ? "bullish" : "bearish", severity: "info",
      title: `${sym} whale order imbalance flipped ${imb > 0 ? "bid-heavy" : "ask-heavy"}`, detail: `open orders: bids ${fmtUsd(bidUsd)} vs asks ${fmtUsd(askUsd)} — imbalance ${(imb * 100).toFixed(0)}%`, price: firstPrice });
  }
}

function fmtUsd(v: number): string {
  if (Math.abs(v) >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (Math.abs(v) >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  if (Math.abs(v) >= 1e3) return `$${(v / 1e3).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
}

// ---------------------------------------------------------------------------
// Liquidation clusters (sweep setups)
// ---------------------------------------------------------------------------

async function scanLiq(sym: string) {
  const st = stateOf(sym);
  const venues = liqVenues(sym);
  const results = await Promise.allSettled(
    venues.map((v) => cgGet(`/api/liquidationLevels/v2?symbol=${encodeURIComponent(v.key)}&limit=4000&range=3d`, 5 * 60_000))
  );
  const vs: { name: string; payload: RawLiqPayload | null }[] = [];
  results.forEach((r, i) => {
    let payload: RawLiqPayload | null = null;
    if (r.status === "fulfilled" && r.value) {
      const val = r.value as RawLiqPayload | { data?: RawLiqPayload };
      payload = (Array.isArray((val as RawLiqPayload)?.prices) ? (val as RawLiqPayload) : ((val as { data?: RawLiqPayload }).data ?? null)) as RawLiqPayload | null;
    }
    vs.push({ name: venues[i].name, payload });
  });
  const model = buildLiqModel(vs);
  if (!model) return;
  // Anchor sides/distances to the LIVE price — the payload's embedded candle
  // close can lag minutes behind (false "approaching cluster" alerts).
  const live = await getLivePrice(sym).catch(() => null);
  const stats = liqStats(model, 4, { livePrice: live?.price ?? null, priceDecs: assetOf(sym)?.priceDecs });
  S.liq.set(sym, { sym, last: stats.last, topAbove: stats.keyLevels.above, topBelow: stats.keyLevels.below, totals: stats.totals, updatedAt: Date.now() });

  if (!st.liqPrimed) {
    st.liqPrimed = true; // per-lane priming (see whalePrimed)
    return;
  }
  // sweep setup: price within 1.2% of a ≥60-strength cluster
  for (const lv of [...stats.keyLevels.above.slice(0, 3), ...stats.keyLevels.below.slice(0, 3)]) {
    if (lv.strength < 60 || lv.distPct > 1.2) continue;
    const key = `${sym}|${lv.side}|${lv.price.toFixed(assetOf(sym)?.priceDecs ?? 1)}`;
    const lastN = st.liqNotified.get(key) ?? 0;
    if (Date.now() - lastN < 2 * 3_600_000) continue;
    st.liqNotified.set(key, Date.now());
    emit({ ts: Date.now(), asset: sym, source: "liqlevels", kind: "sweep_setup", dir: lv.side === "long" ? "bullish" : "bearish", severity: "high",
      title: `${sym} approaching ${lv.side === "long" ? "long" : "short"} liq cluster @ ${fmtAssetPrice(lv.price, sym)}`,
      detail: `${lv.distPct.toFixed(2)}% away · strength ${lv.strength.toFixed(0)} · ${fmtUsd(lv.usd)} est. liquidations · ${lv.venues.join("+")} — sweep magnet`,
      price: lv.price, meta: { distPct: lv.distPct, usd: lv.usd, lev: lv.lev } });
  }
  if (st.liqNotified.size > 400) {
    const cutoff = Date.now() - 2 * 3_600_000;
    for (const [k, t] of st.liqNotified) if (t < cutoff) st.liqNotified.delete(k);
  }
}

// ---------------------------------------------------------------------------
// CVD divergences (aggregated perp taker flows)
// ---------------------------------------------------------------------------

async function scanCvd(sym: string) {
  const st = stateOf(sym);
  const venues = liqVenues(sym);
  const [klineR, ...flowRs] = await Promise.all([
    cgGet(`/api/v2/kline?symbol=${encodeURIComponent(`${leadInstr(sym)}#kline`)}&interval=m15&minLimit=false&limit=200`, 5 * 60_000) as Promise<unknown>,
    ...venues.map((v) => cgGet(`/api/v2/kline?symbol=${encodeURIComponent(`${v.key}#bs_usd`)}&interval=m15&minLimit=false&limit=200`, 5 * 60_000).catch(() => null)),
  ]);
  const kr = Array.isArray(klineR) ? klineR : ((klineR as { data?: unknown[] }).data ?? []);
  const ts: number[] = [];
  const close: number[] = [];
  for (const row of kr as unknown[][]) {
    if (!row || null == row[0]) continue;
    ts.push(1000 * Number(row[0]));
    close.push(Number(row[4]));
  }
  if (ts.length < 60) return;
  const perVenue: Map<number, number>[] = [];
  for (const fr of flowRs) {
    if (!fr) continue;
    const rows = Array.isArray(fr) ? fr : ((fr as { data?: unknown[] }).data ?? []);
    const m = new Map<number, number>();
    for (const row of rows as unknown[][]) {
      if (!row || null == row[0]) continue;
      m.set(1000 * Number(row[0]), Number(row[1]) - Number(row[2]));
    }
    perVenue.push(m);
  }
  const delta: number[] = [];
  let cvd = 0;
  for (let i = 0; i < ts.length; i++) {
    let d = 0;
    for (const m of perVenue) d += m.get(ts[i]) ?? 0;
    cvd += d;
    delta.push(cvd);
  }
  // pivots: local extremes with k=3
  const k = 3;
  const pivHigh: number[] = [];
  const pivLow: number[] = [];
  for (let i = k; i < ts.length - k; i++) {
    let isH = true;
    let isL = true;
    for (let j = i - k; j <= i + k; j++) {
      if (j === i) continue;
      if (close[j] >= close[i]) isH = false;
      if (close[j] <= close[i]) isL = false;
    }
    if (isH) pivHigh.push(i);
    if (isL) pivLow.push(i);
  }
  const divs: CvdSnapshot["divergences"] = [];
  const checkPair = (idx: number[], type: "high" | "low") => {
    if (idx.length < 2) return;
    const i1 = idx[idx.length - 2];
    const i2 = idx[idx.length - 1];
    if (ts.length - 1 - i2 > 12) return; // only fresh divergences
    if (type === "high" && close[i2] > close[i1] && delta[i2] < delta[i1]) {
      divs.push({ dir: "bearish", from: ts[i1], to: ts[i2], p0: close[i1], p1: close[i2], d0: delta[i1], d1: delta[i2] });
    }
    if (type === "low" && close[i2] < close[i1] && delta[i2] > delta[i1]) {
      divs.push({ dir: "bullish", from: ts[i1], to: ts[i2], p0: close[i1], p1: close[i2], d0: delta[i1], d1: delta[i2] });
    }
  };
  checkPair(pivHigh, "high");
  checkPair(pivLow, "low");
  const cvd24 = delta.length > 96 ? delta[delta.length - 1] - delta[delta.length - 1 - 96] : null;
  S.cvd.set(sym, { sym, cvd: delta[delta.length - 1] ?? 0, delta24h: cvd24 ?? 0, divergences: divs, updatedAt: Date.now() });
  if (!st.cvdPrimed) {
    st.cvdPrimed = true; // per-lane priming (see whalePrimed)
    return;
  }
  for (const d of divs) {
    const key = `${d.dir}|${Math.round(d.to / 1000)}`;
    if (st.cvdNotified.has(key)) continue;
    st.cvdNotified.add(key);
    emit({ ts: Date.now(), asset: sym, source: "cvd", kind: "cvd_div", dir: d.dir, severity: "info",
      title: `${sym} CVD ${d.dir === "bullish" ? "bullish" : "bearish"} divergence (m15)`,
      detail: `price ${d.dir === "bullish" ? "LL" : "HH"} ${fmtAssetPrice(d.p0, sym)}→${fmtAssetPrice(d.p1, sym)} while aggregated CVD ${d.dir === "bullish" ? "HL" : "LH"} — ${d.dir === "bullish" ? "sellers exhausting" : "buyers exhausting"}`,
      price: d.p1, barTs: Math.round(d.to / 1000) });
  }
  if (st.cvdNotified.size > 500) st.cvdNotified = new Set([...st.cvdNotified].slice(-250));
}

// ---------------------------------------------------------------------------
// Orchestration
// ---------------------------------------------------------------------------

async function scanAssetAll(sym: string) {
  await scanFootprint(sym).catch(() => undefined);
  await scanMarket(sym).catch(() => undefined);
}

export function getSignalsSnapshot(sym: string): SignalsSnapshot | null {
  return S.signals.get(sym.toUpperCase()) ?? null;
}

export function getWhaleSnapshot(sym: string): WhaleSnapshot | null {
  return S.whale.get(sym.toUpperCase()) ?? null;
}

export function getLiqSnapshot(sym: string): LiqSnapshot | null {
  return S.liq.get(sym.toUpperCase()) ?? null;
}

export function getCvdSnapshot(sym: string): CvdSnapshot | null {
  return S.cvd.get(sym.toUpperCase()) ?? null;
}

export function scannerStatus() {
  const assets = (process.env.CG_SCAN_ASSETS ?? "").split(",").map((s) => s.trim().toUpperCase()).filter(Boolean);
  return {
    enabled: process.env.CG_SCAN !== "off",
    started: S.started,
    ticks: S.ticks,
    scanAssets: assets.length ? assets : ASSETS.map((a) => a.sym),
    signalsCached: [...S.signals.keys()],
    whaleCached: [...S.whale.keys()],
    liqCached: [...S.liq.keys()],
    cvdCached: [...S.cvd.keys()],
  };
}

/** Start the staggered scan loops. Idempotent. */
export function startScanner() {
  if (S.started || process.env.CG_SCAN === "off") return;
  S.started = true;
  const assets = (process.env.CG_SCAN_ASSETS ?? "").split(",").map((s) => s.trim().toUpperCase()).filter(Boolean);
  const list = (assets.length ? ASSETS.filter((a) => assets.includes(a.sym)) : ASSETS).map((a) => a.sym);
  const fastList = list.filter((s) => assetOf(s)?.tier === "fast");
  const slowList = list.filter((s) => assetOf(s)?.tier !== "fast");
  // round-robin lane over its OWN asset list — no shared index, no skip ticks.
  // Overlap guard (engine.ts poller pattern): a scan that outlives its
  // interval (slow upstream, 429 backoffs) must NOT stack a second concurrent
  // pass on the same lane — the pileup amplifies rate-limit episodes. Skip the
  // tick instead; the next tick re-covers the asset.
  const t = (lane: string[], ms: number, firstDelay: number, fn: (sym: string) => Promise<void>) => {
    if (!lane.length) return;
    let i = 0;
    let busy = false;
    const first = setTimeout(() => {
      const id = setInterval(() => {
        if (busy) return; // previous pass still in flight — skip this tick
        const sym = lane[i % lane.length];
        i++;
        S.ticks++;
        busy = true;
        fn(sym)
          .catch(() => undefined)
          .finally(() => {
            busy = false;
          });
      }, ms);
      id.unref?.();
    }, firstDelay);
    first.unref?.();
  };
  // footprint + market, per-tier lanes with the intended cadence:
  //   fast tier (BTC/ETH/SOL): every 60 s over 3 assets → each ~every 3 min
  //   slow tier (13 alts/metals incl. XPT/USO): every 90 s → each ~every 19.5 min (2026-11-11 expansion)
  // combined work rate ≈ 1.67 scans/min — identical to the previous schedule,
  // but the primary trading assets now refresh 6× more often (they used to be
  // the SLOWER tier: 18 min vs the alts' 6 min, an inverted design).
  t(slowList, 90_000, 20_000, async (sym) => {
    await scanAssetAll(sym);
  });
  t(fastList, 60_000, 25_000, async (sym) => {
    await scanAssetAll(sym);
  });
  // whale: slow round-robin every 90s over the full list ≈ every ~18 min per asset
  t(list, 90_000, 60_000, async (sym) => {
    await scanWhale(sym).catch(() => undefined);
  });
  // liq clusters + cvd: 3 assets per 5-min tick, rotating through the full
  // list — same upstream load as before, but every asset gets covered
  // (a full pass over 12 assets ≈ 20 min) instead of only BTC/ETH/SOL.
  // Same overlap guard as the lanes above, per-symbol: a slow liq/cvd pass
  // for one sym must not stack with the next tick's pass for that sym.
  let laneI = 0;
  const laneBusy = new Set<string>();
  const laneTimer = setInterval(() => {
    if (!list.length) return;
    for (let k = 0; k < 3; k++) {
      const sym = list[(laneI + k) % list.length];
      if (laneBusy.has(sym)) continue; // previous pass for this sym still in flight
      laneBusy.add(sym);
      Promise.allSettled([scanLiq(sym), scanCvd(sym)]).finally(() => laneBusy.delete(sym));
    }
    laneI = (laneI + 3) % list.length;
  }, 5 * 60_000);
  laneTimer.unref?.();
  // initial pass: prime the fast lane + first slow asset immediately
  setTimeout(() => {
    scanAssetAll("BTC").catch(() => undefined);
    scanLiq("BTC").catch(() => undefined);
    scanCvd("BTC").catch(() => undefined);
    scanWhale("BTC").catch(() => undefined);
  }, 8_000).unref?.();
}
