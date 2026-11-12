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
import { ensureLiqCollector, liqWindows5m } from "./liq-live";
import { fetchBinOi } from "./fallbacks";
import { ASSETS, assetOf, curatedAssetOf, leadInstr, liqVenues } from "./assets";
import { curatedPerps } from "@/lib/universe/curated";
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
  market: Map<string, MarketSnapshot>;
  signals: Map<string, SignalsSnapshot>;
  whale: Map<string, WhaleSnapshot>;
  liq: Map<string, LiqSnapshot>;
  cvd: Map<string, CvdSnapshot>;
  warming: Map<string, Promise<void>>;
  started: boolean;
  ticks: number;
}

const g = globalThis as unknown as { __cgScanner?: ScanGlobal };
const S: ScanGlobal = (g.__cgScanner ??= {
  states: new Map(),
  market: new Map(),
  signals: new Map(),
  whale: new Map(),
  liq: new Map(),
  cvd: new Map(),
  warming: new Map(),
  started: false,
  ticks: 0,
});
// dev hot-reload safety: ensure new maps exist on recycled global singleton
S.market ??= new Map();
S.warming ??= new Map();

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
  S.market.set(sym, snap);
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
    trackHotSignal(sym);
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
// Liquidation cascades (2026-11-12 directive) — liq-live 5-minute rolling
// windows → tier/OI-normalized HIGH-severity alerts.
//
// Trigger matrix (NOT a flat $1M — normalization by market tier and OI):
//   majors (BTC/ETH/SOL): ≥ $1.5M / 5m, or ≥ $500k when single-side ≥ 80%
//                         with ≥ 5 prints (concentrated cascade)
//   alts + TradFi perps : (≥ $200k / 5m OR ≥ 0.15% of OI) with ≥ 75%
//                         single-side → long_cascade vs short_cascade
//
// Data sources: the trailing-5m windows come from liq-live's in-memory rings
// (ZERO Coinglass quota); OI is fetched only for near-threshold alt windows
// via Binance fapi (free public API, 10-min cache) — never Coinglass. The
// M1/M2 context reuses this scanner's own market snapshots (EMA stacks for
// the M1 pullback gate, day-VWAP σ for the M2 ±2σ exhaustion zone) and the
// cascade's own print price, so no extra upstream call is made. Dedupe is
// per asset+side on 5-minute wall-clock buckets (Math.floor(now/300_000)).
// ---------------------------------------------------------------------------

const LIQ_CASCADE_MAJORS = new Set(["BTC", "ETH", "SOL"]);
const LIQ_MAJOR_ABS_USD = 1_500_000;
const LIQ_MAJOR_CONC_USD = 500_000;
const LIQ_MAJOR_CONC_SHARE = 0.8;
const LIQ_MAJOR_CONC_COUNT = 5;
const LIQ_ALT_ABS_USD = 200_000;
const LIQ_ALT_SHARE = 0.75;
const LIQ_ALT_OI_PCT = 0.0015;
/** alt windows below this never fetch OI (0.15% of OI ≥ $50k → OI ≥ $33M) */
const LIQ_ALT_OI_FETCH_FLOOR_USD = 50_000;
/** OI-relative path floor on print count — a single print is noise at OI scale */
const LIQ_ALT_OI_MIN_COUNT = 3;

interface CascadeState {
  /** "sym|side|bucket" → bucket ms — one alert max per asset+side per 5m bucket */
  notified: Map<string, number>;
  /** sym → { at, oiUsd } — Binance fapi OI, 10-min TTL */
  oi: Map<string, { at: number; oiUsd: number }>;
  oiBusy: Set<string>;
  /** honest liveness telemetry for the /api/cg/assets scanner status */
  lastScanAt: number | null;
  windowsSeen: number;
}

const gCas = globalThis as unknown as { __cgLiqCascade?: CascadeState };
const CAS: CascadeState = (gCas.__cgLiqCascade ??= { notified: new Map(), oi: new Map(), oiBusy: new Set(), lastScanAt: null, windowsSeen: 0 });

function fmtUsdK(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "n/a";
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(n >= 1e5 ? 0 : 1)}k`;
  return `$${n.toFixed(0)}`;
}

/** OI in USD for the OI-relative alt path — Binance fapi (free), cached
 *  10 min, fetched only for windows that could actually qualify. */
async function oiUsdOf(sym: string): Promise<number | null> {
  const hit = CAS.oi.get(sym);
  if (hit && Date.now() - hit.at < 10 * 60_000) return hit.oiUsd;
  if (CAS.oiBusy.has(sym)) return hit?.oiUsd ?? null;
  CAS.oiBusy.add(sym);
  try {
    const bo = await fetchBinOi(sym);
    if (bo && bo.oiUsd > 0) {
      CAS.oi.set(sym, { at: Date.now(), oiUsd: bo.oiUsd });
      return bo.oiUsd;
    }
    return null;
  } catch {
    return null;
  } finally {
    CAS.oiBusy.delete(sym);
  }
}

/** nearest M1 pullback / M2 ±2σ exhaustion context from the scanner's own
 *  market snapshot (zero extra upstream calls). The z-score uses the
 *  cascade's own latest print price — the day-anchored VWAP is stable, the
 *  print price is the cascade-time price. */
function cascadeSetupContext(sym: string, lastPrice: number | null, domSide: "long" | "short" | "mixed"): string {
  const m = S.market.get(sym);
  if (!m || lastPrice == null) return "M1/M2 context n/a (scan snapshot cold)";
  const bits: string[] = [];
  const vwap = m.vwap?.vwap;
  const sd1 = m.vwap?.bands?.sd1;
  if (vwap != null && sd1 != null && sd1 > 0) {
    const z = (lastPrice - vwap) / sd1;
    if (Math.abs(z) >= 2) {
      const zone = z >= 0 ? "above" : "below";
      let triage = "M2 mean-reversion triage";
      if (domSide === "long" && z <= -2) triage = "long capitulation into −2σ support — M2 mean-reversion LONG triage";
      else if (domSide === "short" && z >= 2) triage = "short squeeze at +2σ resistance — M2 mean-reversion SHORT triage";
      bits.push(`M2: ${z >= 0 ? "+" : ""}${z.toFixed(2)}σ ${zone} day VWAP (±2σ exhaustion zone) — ${triage}`);
    } else {
      bits.push(`M2: ${z >= 0 ? "+" : ""}${z.toFixed(2)}σ from day VWAP (inside bands — not stretched)`);
    }
  }
  const h4 = m.ema?.h4;
  const d1 = m.ema?.d1;
  if (h4?.e13 != null && h4?.e89 != null && h4?.e233 != null && d1?.e13 != null && d1?.e89 != null && d1?.e233 != null) {
    const up = h4.e13 > h4.e89 && h4.e89 > h4.e233 && d1.e13 > d1.e89;
    const down = h4.e13 < h4.e89 && h4.e89 < h4.e233 && d1.e13 < d1.e89;
    if (up) bits.push("M1: H4+D1 EMA stack up — trend-pullback watch");
    else if (down) bits.push("M1: H4+D1 EMA stack down — trend-pullback watch");
    else bits.push("M1: H4/D1 EMA stacks mixed — regime gate off");
  }
  const ageMin = m.dataAt ? Math.round((Date.now() - m.dataAt) / 60_000) : null;
  const suffix = ageMin != null && ageMin > 15 ? ` (context snapshot ${ageMin}m old)` : "";
  return (bits.length ? bits.join(" · ") : "M1/M2 context n/a") + suffix;
}

async function scanLiqCascades() {
  const windows = liqWindows5m();
  CAS.lastScanAt = Date.now();
  CAS.windowsSeen = windows.length;
  if (!windows.length) return;
  const bucketMs = Math.floor(Date.now() / 300_000) * 300_000;
  if (CAS.notified.size > 600) {
    for (const [k, at] of CAS.notified) if (Date.now() - at > 20 * 60_000) CAS.notified.delete(k);
  }
  for (const w of windows) {
    const totalUsd = w.longUsd + w.shortUsd;
    if (totalUsd <= 0) continue; // no computable notional — cannot tier (honest skip)
    const longShare = w.longUsd / totalUsd;
    const domShare = Math.max(longShare, 1 - longShare);
    const domSide: "long" | "short" | "mixed" = domShare >= 0.55 ? (longShare >= 0.5 ? "long" : "short") : "mixed";
    const key = `${w.sym}|${domSide}|${bucketMs}`;
    if (CAS.notified.has(key)) continue;

    const isMajor = LIQ_CASCADE_MAJORS.has(w.sym);
    let triggered = false;
    let threshold = "";
    let oiUsd: number | null = null;
    if (isMajor) {
      if (totalUsd >= LIQ_MAJOR_ABS_USD) {
        triggered = true;
        threshold = "major ≥$1.5M/5m";
      } else if (totalUsd >= LIQ_MAJOR_CONC_USD && domShare >= LIQ_MAJOR_CONC_SHARE && w.count >= LIQ_MAJOR_CONC_COUNT) {
        triggered = true;
        threshold = `major concentrated ≥$500k + ${Math.round(LIQ_MAJOR_CONC_SHARE * 100)}% single-side + ${LIQ_MAJOR_CONC_COUNT} prints`;
      }
    } else if (domShare >= LIQ_ALT_SHARE) {
      if (totalUsd >= LIQ_ALT_ABS_USD) {
        triggered = true;
        threshold = `alt ≥$200k/5m + ${Math.round(LIQ_ALT_SHARE * 100)}% single-side`;
      } else if (totalUsd >= LIQ_ALT_OI_FETCH_FLOOR_USD && w.count >= LIQ_ALT_OI_MIN_COUNT) {
        // OI-relative path — free fapi fetch, 10-min cache, only when plausible
        oiUsd = await oiUsdOf(w.sym);
        if (oiUsd != null && totalUsd >= oiUsd * LIQ_ALT_OI_PCT) {
          triggered = true;
          threshold = `alt ≥0.15% of OI (${fmtUsdK(oiUsd)} OI) + ${Math.round(LIQ_ALT_SHARE * 100)}% single-side`;
        }
      }
    }
    if (!triggered) continue;
    CAS.notified.set(key, Date.now());

    // dominant venue + largest print
    let dominantVenue: string | null = null;
    let venueUsd = 0;
    for (const [v, u] of Object.entries(w.venueUsd)) {
      if (u > venueUsd) {
        venueUsd = u;
        dominantVenue = v;
      }
    }
    const venueSharePct = dominantVenue ? Math.round((venueUsd / totalUsd) * 100) : null;
    const sideLabel = domSide === "mixed" ? "mixed-side liquidation cascade" : domSide === "long" ? "LONG liquidation cascade" : "SHORT-SQUEEZE liquidation cascade";
    const ge = w.unknownUsdPrints > 0 ? "≥ " : "";
    emit({
      ts: Date.now(),
      asset: w.sym,
      source: "liq-live",
      kind: domSide === "mixed" ? "liq_cascade_mixed" : domSide === "long" ? "long_cascade" : "short_cascade",
      dir: domSide === "long" ? "bearish" : domSide === "short" ? "bullish" : "neutral",
      severity: "high",
      title: `${w.sym} ${sideLabel} — ${ge}${fmtUsdK(totalUsd)} / 5m`,
      detail: `${ge}${fmtUsdK(totalUsd)} liquidated in 5m across ${w.count} prints (${Math.round(domShare * 100)}% ${
        domSide === "mixed" ? "split" : domSide
      }) · dominant venue ${dominantVenue ?? "n/a"}${venueSharePct != null ? ` (${venueSharePct}%)` : ""} · largest print ${fmtUsdK(
        w.largestUsd
      )}${w.largestPrice != null ? ` @ ${fmtAssetPrice(w.largestPrice, w.sym)}` : ""} · ${cascadeSetupContext(
        w.sym,
        w.lastPrice,
        domSide
      )} · trigger: ${threshold}${w.unknownUsdPrints ? ` (${w.unknownUsdPrints} prints without venue notional — true total is higher)` : ""}`,
      price: w.lastPrice,
      barTs: Math.floor(bucketMs / 1000),
      barType: "time",
      meta: {
        usd5m: Math.round(totalUsd),
        count: w.count,
        domShare: +domShare.toFixed(3),
        side: domSide,
        dominantVenue,
        venueSharePct,
        largestUsd: w.largestUsd,
        largestPrice: w.largestPrice,
        unknownUsdPrints: w.unknownUsdPrints,
        ...(oiUsd != null ? { oiUsd, oiPctOfLiq: +(totalUsd / oiUsd).toFixed(5) } : {}),
        threshold,
      },
    });
    trackHotSignal(w.sym); // a live cascade is top priority for the hot lane
  }
}

// ---------------------------------------------------------------------------
// Orchestration
// ---------------------------------------------------------------------------

async function scanAssetAll(sym: string) {
  await scanFootprint(sym).catch(() => undefined);
  await scanMarket(sym).catch(() => undefined);
}

export function getMarketSnapshot(sym: string): MarketSnapshot | null {
  return S.market.get(sym.toUpperCase()) ?? null;
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

/** On-demand coalesced warm-up for any registered asset (populates Market, Signals, Liq, CVD). */
export async function warmAssetScan(symRaw: string): Promise<void> {
  const sym = symRaw.toUpperCase();
  if (!assetOf(sym)) return;
  const inflight = S.warming.get(sym);
  if (inflight) return inflight;
  const p = Promise.allSettled([
    scanAssetAll(sym),
    scanLiq(sym),
    scanCvd(sym),
  ])
    .then(() => undefined)
    .finally(() => {
      S.warming.delete(sym);
    });
  S.warming.set(sym, p);
  return p;
}

// ---------------------------------------------------------------------------
// PRIORITY CONTINUITY (2026-11-12 directive): the currently-viewed asset,
// top-RVOL movers and assets with a recent HIGH-severity signal are scanned
// on a hot lane (<= 2 min loop) while the background lanes rotate politely
// inside the upstream rate budget.
// ---------------------------------------------------------------------------

interface HotState {
  /** last time each sym was viewed (route hit) */
  viewedAt: Map<string, number>;
  /** recent HIGH-severity signals: sym -> last emit ts */
  hotSignalAt: Map<string, number>;
}

const gHot = globalThis as unknown as { __cgHotLane?: HotState };
const HOT: HotState = (gHot.__cgHotLane ??= { viewedAt: new Map(), hotSignalAt: new Map() });

/** Mark a sym as currently viewed — routes call this on every hit so the
 *  hot lane keeps its fp/market/cvd state <= 2 min fresh. */
export function markViewed(sym: string) {
  if (!sym) return;
  HOT.viewedAt.set(sym.toUpperCase(), Date.now());
}

function trackHotSignal(sym: string) {
  HOT.hotSignalAt.set(sym.toUpperCase(), Date.now());
}

/** hot set: viewed in the last 10 min, or a HIGH-signal in the last 30 min,
 *  or top RVOL from the freshest market snapshots. */
function hotSet(): string[] {
  const now = Date.now();
  const out = new Set<string>();
  for (const [sym, at] of HOT.viewedAt) {
    if (now - at < 10 * 60_000) out.add(sym);
    else HOT.viewedAt.delete(sym);
  }
  for (const [sym, at] of HOT.hotSignalAt) {
    if (now - at < 30 * 60_000) out.add(sym);
    else HOT.hotSignalAt.delete(sym);
  }
  // top RVOL movers from the scanner's own market snapshots (real measured
  // vol.rvolHour — falls back to nothing on a cold engine)
  const rvolRanked = [...S.market.values()]
    .filter((m) => m.vol?.rvolHour != null && Number.isFinite(m.vol.rvolHour))
    .sort((a, b) => (b.vol!.rvolHour ?? 0) - (a.vol!.rvolHour ?? 0))
    .slice(0, 5);
  for (const m of rvolRanked) out.add(m.sym.toUpperCase());
  return [...out];
}

export function scannerStatus() {
  const assets = (process.env.CG_SCAN_ASSETS ?? "").split(",").map((s) => s.trim().toUpperCase()).filter(Boolean);
  return {
    enabled: process.env.CG_SCAN !== "off",
    started: S.started,
    ticks: S.ticks,
    scanAssets: assets.length ? assets : scanList().map((a) => a.sym),
    signalsCached: [...S.signals.keys()],
    whaleCached: [...S.whale.keys()],
    liqCached: [...S.liq.keys()],
    cvdCached: [...S.cvd.keys()],
    /** liquidation-cascade detector liveness (30 s tick over liq-live rings) */
    liqCascade: {
      lastScanAt: CAS.lastScanAt,
      lastScanAgeMs: CAS.lastScanAt != null ? Date.now() - CAS.lastScanAt : null,
      windowsSeen: CAS.windowsSeen,
      notifiedBuckets: CAS.notified.size,
      oiCached: CAS.oi.size,
    },
  };
}

/** The scanner's asset list: the 58 curated perps (crypto + TradFi), plus
 * any legacy Tier-1 registry sym that is not curated (XPT) so Tier-1 code
 * paths keep their coverage. CG_SCAN_ASSETS restricts to a subset. */
function scanList(): { sym: string }[] {
  const env = (process.env.CG_SCAN_ASSETS ?? "").split(",").map((s) => s.trim().toUpperCase()).filter(Boolean);
  const curated = curatedPerps().map((c) => ({ sym: c.sym }));
  const legacy = ASSETS.filter((a) => !curated.some((c) => c.sym === a.sym)).map((a) => ({ sym: a.sym }));
  const all = [...curated, ...legacy];
  return env.length ? all.filter((a) => env.includes(a.sym.toUpperCase())) : all;
}

/** Start the staggered scan loops. Idempotent. */
export function startScanner() {
  if (S.started || process.env.CG_SCAN === "off") return;
  S.started = true;
  // the cascade detector reads liq-live's in-memory rings — boot the
  // collector with the scanner so alerts work before the first route hit
  ensureLiqCollector();
  const list = scanList().map((a) => a.sym);
  // Curated cadence lanes (2026-11-12 consolidation, "no gaps" budget):
  //   fast  — BTC/ETH/SOL, a 60 s tick → each asset ~every 3 min
  //   mid   — other crypto (27), a 90 s tick → each ~every 40 min
  //   slow  — TradFi (28), a 120 s tick → each ~every 56 min
  // Footprint is the Coinglass aggregate (fpVenues: Binance+OKX+Bybit+HL for
  // crypto, 3 venues for TradFi), so a scan costs up to 4 orderFlow + 2
  // kline pages — the fast lane peaks at ~18 upstream calls/min and the
  // mid/slow lanes amortize to <2/min, well inside the upstream budget.
  const FAST = ["BTC", "ETH", "SOL"];
  const fastList = list.filter((s) => FAST.includes(s));
  const midList = list.filter((s) => !FAST.includes(s) && curatedAssetOf(s)?.kind !== "tradfi-perp");
  const slowList = list.filter((s) => curatedAssetOf(s)?.kind === "tradfi-perp");
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
  t(slowList, 120_000, 20_000, async (sym) => {
    await scanAssetAll(sym);
  });
  t(midList, 90_000, 25_000, async (sym) => {
    await scanAssetAll(sym);
  });
  t(fastList, 60_000, 30_000, async (sym) => {
    await scanAssetAll(sym);
  });
  // whale: round-robin every 90s over the full list ≈ every ~87 min per asset
  t(list, 90_000, 60_000, async (sym) => {
    await scanWhale(sym).catch(() => undefined);
  });
  // liq clusters + cvd: 4 assets per 4-min tick, rotating through the full
  // list (a full pass over 58 ≈ 60 min) — same upstream load shape as the
  // old 12-asset schedule, scaled for the curated universe.
  // Same overlap guard as the lanes above, per-symbol: a slow liq/cvd pass
  // for one sym must not stack with the next tick's pass for that sym.
  let laneI = 0;
  const laneBusy = new Set<string>();
  const laneTimer = setInterval(() => {
    if (!list.length) return;
    for (let k = 0; k < 4; k++) {
      const sym = list[(laneI + k) % list.length];
      if (laneBusy.has(sym)) continue; // previous pass for this sym still in flight
      laneBusy.add(sym);
      Promise.allSettled([scanLiq(sym), scanCvd(sym)]).finally(() => laneBusy.delete(sym));
    }
    laneI = (laneI + 4) % list.length;
  }, 4 * 60_000);
  laneTimer.unref?.();
  // HOT lane (priority continuity): viewed + top-RVOL + recent-HIGH-signal
  // assets re-scan every 110 s — the user's "<= 2 min loop for hot assets".
  // Empty hot set costs one no-op interval.
  const hotBusy = new Set<string>();
  const hotTimer = setInterval(() => {
    for (const sym of hotSet()) {
      if (!list.includes(sym) && !curatedAssetOf(sym)) continue; // curated members only
      if (hotBusy.has(sym)) continue;
      hotBusy.add(sym);
      scanAssetAll(sym)
        .catch(() => undefined)
        .finally(() => hotBusy.delete(sym));
    }
  }, 110_000);
  hotTimer.unref?.();

  // liquidation cascades: tier/OI-normalized HIGH alerts from liq-live's
  // 5m rolling windows (in-memory rings — zero Coinglass quota; OI only via
  // free Binance fapi for near-threshold alt windows, 10-min cache). 30 s
  // tick for prompt detection; 5-minute bucket dedupe caps the alert rate.
  // Overlap guard: a slow OI fetch must not stack the next 30 s pass.
  let cascadeBusy = false;
  const cascadeTimer = setInterval(() => {
    if (cascadeBusy) return;
    cascadeBusy = true;
    scanLiqCascades()
      .catch(() => undefined)
      .finally(() => {
        cascadeBusy = false;
      });
  }, 30_000);
  cascadeTimer.unref?.();

  // custom user alert rules (WS5): evaluated against live engine state every
  // 30 s — radar verdicts (grades), market snapshots (VWAP σ), liq-live 5m
  // cascades, radar funding APR and the live price hub. Fires push [HIGH]
  // notifications + optional webhook. Dynamic import: alert-rules reads this
  // module's snapshots (a static import would close a cycle).
  let rulesBusy = false;
  const rulesTimer = setInterval(() => {
    if (rulesBusy) return;
    rulesBusy = true;
    import("./alert-rules")
      .then(({ evaluateAlertRules }) => evaluateAlertRules())
      .catch(() => undefined)
      .finally(() => {
        rulesBusy = false;
      });
  }, 30_000);
  rulesTimer.unref?.();

  // initial pass: prime the fast lane immediately
  setTimeout(() => {
    warmAssetScan("BTC").catch(() => undefined);
    scanWhale("BTC").catch(() => undefined);
    setTimeout(() => warmAssetScan("ETH").catch(() => undefined), 2_500).unref?.();
    setTimeout(() => warmAssetScan("SOL").catch(() => undefined), 5_000).unref?.();
    setTimeout(() => warmAssetScan("HYPE").catch(() => undefined), 7_500).unref?.();
  }, 8_000).unref?.();
}
