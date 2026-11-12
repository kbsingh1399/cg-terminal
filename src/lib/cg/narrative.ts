/**
 * DETERMINISTIC TRADE NARRATIVE ENGINE — Models 1 & 2 (2026-11-12 directive).
 *
 * Synthesizes every live data point into one strict, non-contradictory
 * trading narrative:
 *   market   : EMAs 13/89/233 (m15..d1), Day VWAP ±1σ/2σ/3σ, auction value
 *              areas (session/day/week/month), RSI, PDH/PDL/PWH/PWL, session
 *              VWAPs, RV/ATR percentile/RVOL, honest candle freshness
 *   fp       : Coinglass-aggregated footprint signals (absorption · strong
 *              divergence · trap · exhaustion) — THE parity-preserving set
 *   cvd      : multi-venue CVD + Bull/Bear divergences (+ Coinbase premium
 *              via /api/cg/quant for majors)
 *   walls    : resting whale orders / book walls (≥$1M or top-5%)
 *   liq      : liquidation clusters (the magnets)
 *   quant    : OI-weighted funding APR, top-trader/global L/S, taker ratio,
 *              OI×price quadrant, spot-perp basis (via /api/cg/quant)
 *   options  : Deribit GEX regime + 25d skew (BTC/ETH, via /api/cg/options)
 *
 * STEP 1 — Regime gate (first principle): TREND_UP · TREND_DOWN ·
 *   RANGE_BALANCE · COMPRESSION_SQUEEZE from H4/D1 EMA stack alignment,
 *   EMA13−89 ATR-normalized spread (slope proxy), ATR percentile, price vs
 *   Day VWAP, and Deribit GEX when available.
 * STEP 2 — Dual-model evaluator: BOTH models scored; the better validated
 *   one wins, vetoes can demote to WAIT_PULLBACK / WATCH_EXHAUSTION.
 * STEP 3 — Conflict resolution, hard vetoes, structured NarrativeVerdict.
 *
 * ZERO fabrication: every threshold comparison carries the measured value
 * into the checklist; any missing feed marks its checklist row "n/a" and
 * lowers confidence — never invents a pass.
 */

import { buildMarketSnapshot, type MarketSnapshot } from "./market";
import { getSignalsSnapshot, getCvdSnapshot, getWhaleSnapshot, getLiqSnapshot, type SignalsSnapshot, type CvdSnapshot, type WhaleSnapshot, type LiqSnapshot } from "./scan";
import { computeCgSignals, type CgSignal } from "./cg-signals";
import { loadFpBars } from "./fp-load";
import { classicOf } from "./classic";
import { fetchBinCandles } from "./fallbacks";
import { resolveCgSym } from "../binance/aliases";
import { isCuratedPerp } from "./assets";

export type Regime = "TREND_UP" | "TREND_DOWN" | "RANGE_BALANCE" | "COMPRESSION_SQUEEZE";
export type ActiveModel = "M1_TREND_PULLBACK" | "M2_MEAN_REVERSION" | "WAIT_PULLBACK" | "WATCH_EXHAUSTION" | "NO_TRADE";
export type Direction = "LONG" | "SHORT" | "NEUTRAL";
export type Grade = "A+" | "A" | "B" | "SKIP";

export interface ChecklistItem {
  key: string;
  label: string;
  pass: boolean | null; // null = feed unavailable (n/a)
  value: string; // exact measured value
}

export interface TargetLevel {
  level: number | null;
  label: string;
  rMultiple: number | null;
}

export interface NarrativePlan {
  entryZone: [number, number] | null;
  triggerRule: string;
  stop: number | null;
  invalidation: string;
  targets: TargetLevel[];
  bestR: number | null;
  vetoes: string[];
}

export interface NarrativeVerdict {
  ok: boolean;
  supported: boolean;
  sym: string;
  name: string;
  kind: string;
  regime: Regime;
  regimeNote: string;
  activeModel: ActiveModel;
  direction: Direction;
  grade: Grade;
  confidence: number; // 0-100
  thesis: string;
  plan: NarrativePlan;
  checklist: ChecklistItem[];
  m1: { status: string; note: string } | null;
  m2: { status: string; note: string } | null;
  freshness: { worstAgeMs: number; staleFields: string[]; dataAt: number; ageMs: number; stale: boolean; source: string };
  /** cross-asset rolling beta (24h/7d, h1 closes vs fapi BTC/QQQ) */
  beta: { vs: string; b24h: number | null; b7d: number | null }[];
  generatedAt: number;
}

// ---------------------------------------------------------------------------
// input plumbing (the quant/options routes are invoked in-process — their
// module caches make this cheap; failures degrade checklist rows to n/a)
// ---------------------------------------------------------------------------

interface QuantLite {
  fundingAprPct: number | null;
  topLs: number | null; // top-trader position L/S (1h)
  globalLs: number | null;
  takerRatio: number | null;
  quadrant1h: string | null;
  quadrant4h: string | null;
  coinbasePremiumBps: number | null;
  basisPct: number | null;
  dataAt: number | null;
}

interface OptionsLite {
  gexRegime: string | null;
  rr25d: number | null;
  dvol: number | null;
  dataAt: number | null;
}

async function fetchQuantLite(sym: string): Promise<QuantLite | null> {
  try {
    const { GET } = await import("../../app/api/cg/quant/route");
    const res = await GET(new Request(`http://local/api/cg/quant?sym=${encodeURIComponent(sym)}`) as never);
    const j = (await res.json()) as {
      ok: boolean;
      supported?: boolean;
      lsRatios?: Record<string, { global?: { ratio?: number } | null; topPositions?: { ratio?: number } | null; taker?: { buySellRatio?: number } | null }>;
      funding?: { annualizedAprPct?: number | null };
      oiQuadrant?: Record<string, { quadrant?: string } | null>;
      basis?: { coinbasePremiumBps?: number | null; basisPct?: number | null };
      dataAt?: number;
    };
    if (j.ok !== true || j.supported === false) return null;
    const ls1h = j.lsRatios?.["1h"];
    return {
      fundingAprPct: j.funding?.annualizedAprPct ?? null,
      topLs: ls1h?.topPositions?.ratio ?? null,
      globalLs: ls1h?.global?.ratio ?? null,
      takerRatio: ls1h?.taker?.buySellRatio ?? null,
      quadrant1h: j.oiQuadrant?.["1h"]?.quadrant ?? null,
      quadrant4h: j.oiQuadrant?.["4h"]?.quadrant ?? null,
      coinbasePremiumBps: j.basis?.coinbasePremiumBps ?? null,
      basisPct: j.basis?.basisPct ?? null,
      dataAt: j.dataAt ?? null,
    };
  } catch {
    return null;
  }
}

async function fetchOptionsLite(sym: string): Promise<OptionsLite | null> {
  try {
    const { GET } = await import("../../app/api/cg/options/route");
    const res = await GET(new Request(`http://local/api/cg/options?sym=${encodeURIComponent(sym)}`) as never);
    const j = (await res.json()) as {
      ok: boolean;
      supported?: boolean;
      gex?: { regime?: string };
      riskReversal25d?: { value?: number };
      dvol?: { value?: number };
      dataAt?: number;
    };
    if (j.ok !== true || j.supported === false) return null;
    return {
      gexRegime: j.gex?.regime ?? null,
      rr25d: j.riskReversal25d?.value ?? null,
      dvol: j.dvol?.value ?? null,
      dataAt: j.dataAt ?? null,
    };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// beta (rolling, h1 closes; fapi is free — 5min module cache)
// ---------------------------------------------------------------------------

const betaCache = new Map<string, { at: number; val: { vs: string; b24h: number | null; b7d: number | null }[] }>();
const BETA_TTL = 300_000;

function closes(c: { t: number; c: number }[]): number[] {
  return c.map((x) => x.c);
}

function betaOf(a: number[], b: number[], windowBars: number): number | null {
  const n = Math.min(a.length, b.length, windowBars);
  if (n < 24) return null;
  const ra: number[] = [];
  const rb: number[] = [];
  for (let i = 1; i < n; i++) {
    const ia = a.length - n + i;
    const ib = b.length - n + i;
    if (!(a[ia - 1] > 0 && b[ib - 1] > 0)) continue;
    ra.push(Math.log(a[ia] / a[ia - 1]));
    rb.push(Math.log(b[ib] / b[ib - 1]));
  }
  if (ra.length < 20) return null;
  const ma = ra.reduce((s, x) => s + x, 0) / ra.length;
  const mb = rb.reduce((s, x) => s + x, 0) / rb.length;
  let cov = 0;
  let vb = 0;
  for (let i = 0; i < ra.length; i++) {
    cov += (ra[i] - ma) * (rb[i] - mb);
    vb += (rb[i] - mb) ** 2;
  }
  return vb > 0 ? cov / vb : null;
}

async function crossAssetBeta(sym: string, isTradfi: boolean): Promise<{ vs: string; b24h: number | null; b7d: number | null }[]> {
  const hit = betaCache.get(sym);
  if (hit && Date.now() - hit.at < BETA_TTL) return hit.val;
  const cg = resolveCgSym(sym);
  const refs = (isTradfi ? ["QQQ", "BTC"] : ["BTC"]).filter((r) => r !== cg);
  const out: { vs: string; b24h: number | null; b7d: number | null }[] = [];
  if (refs.length === 0) return out;
  try {
    const mine = closes(await fetchBinCandles(cg, "h1", 200));
    for (const ref of refs) {
      const theirs = closes(await fetchBinCandles(ref, "h1", 200));
      out.push({ vs: ref, b24h: betaOf(mine, theirs, 24), b7d: betaOf(mine, theirs, 168) });
    }
  } catch {
    for (const ref of refs) out.push({ vs: ref, b24h: null, b7d: null });
  }
  betaCache.set(sym, { at: Date.now(), val: out });
  return out;
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function fmt(v: number | null | undefined, d = 2): string {
  return v == null || !Number.isFinite(v) ? "n/a" : v.toFixed(d);
}

/** stack order of one timeframe's EMAs, e.g. "13>89>233" */
function stackOrder(s: { e13: number | null; e89: number | null; e233: number | null } | undefined): "up" | "down" | "tangled" | "n/a" {
  if (!s || s.e13 == null || s.e89 == null || s.e233 == null) return "n/a";
  if (s.e13 > s.e89 && s.e89 > s.e233) return "up";
  if (s.e13 < s.e89 && s.e89 < s.e233) return "down";
  return "tangled";
}

interface FreshTracker {
  worst: number;
  fields: string[];
}

function trackFresh(ft: FreshTracker, field: string, ageMs: number | null | undefined, maxAgeMs = 120_000) {
  if (ageMs == null || !Number.isFinite(ageMs)) return;
  if (ageMs > ft.worst) ft.worst = ageMs;
  if (ageMs > maxAgeMs) ft.fields.push(field);
}

/** recent footprint signals (last `bars` m15 bars) of given types/side. */
function recentSignals(sets: SignalsSnapshot["sets"] | undefined, bars: number, side?: "buy" | "sell", types?: string[]): CgSignal[] {
  if (!sets) return [];
  const cutoff = (Date.now() - bars * 15 * 60_000) / 1000;
  const out: CgSignal[] = [];
  for (const set of sets) {
    for (const s of set.sigs) {
      if (s.ts < cutoff) continue;
      if (side && s.side !== side) continue;
      if (types && !types.includes(s.t)) continue;
      out.push(s);
    }
  }
  return out;
}

function nearestLevel(price: number, levels: (number | null | undefined)[]): { level: number | null; distPct: number | null } {
  let best: number | null = null;
  let dist = Infinity;
  for (const l of levels) {
    if (l == null || !Number.isFinite(l)) continue;
    const d = Math.abs(l - price);
    if (d < dist) {
      dist = d;
      best = l;
    }
  }
  return { level: best, distPct: best != null ? (dist / price) * 100 : null };
}

// ---------------------------------------------------------------------------
// THE ENGINE
// ---------------------------------------------------------------------------

export async function buildNarrative(symRaw: string): Promise<NarrativeVerdict> {
  const sym = symRaw.trim().toUpperCase();
  const isClassic = !!classicOf(sym) && !isCuratedPerp(sym);
  const fresh: FreshTracker = { worst: 0, fields: [] };
  const vetoes: string[] = [];

  // ---- gather (all optional except market) ----
  let market: MarketSnapshot | null = null;
  try {
    market = await buildMarketSnapshot(sym);
  } catch {
    market = null;
  }
  if (!market) {
    return {
      ok: true,
      supported: false,
      sym,
      name: sym,
      kind: "unknown",
      regime: "RANGE_BALANCE",
      regimeNote: "no market data",
      activeModel: "NO_TRADE",
      direction: "NEUTRAL",
      grade: "SKIP",
      confidence: 0,
      thesis: `No live market snapshot is available for ${sym} right now — the narrative engine refuses to trade blind.`,
      plan: { entryZone: null, triggerRule: "n/a", stop: null, invalidation: "no data", targets: [], bestR: null, vetoes: ["market feed unavailable"] },
      checklist: [{ key: "market", label: "Market feed", pass: false, value: "unavailable" }],
      m1: null,
      m2: null,
      freshness: { worstAgeMs: Number.MAX_SAFE_INTEGER, staleFields: ["market"], dataAt: 0, ageMs: 0, stale: true, source: "none" },
      beta: [],
      generatedAt: Date.now(),
    };
  }
  // the last m15 bar OPENS up to 15 min ago while still forming — honest
  // staleness is the age BEYOND the expected bar close, not from its open.
  const marketAgeBeyondBar = Math.max(0, market.ageMs - 15 * 60_000);
  trackFresh(fresh, "market", marketAgeBeyondBar);
  if (market.stale) fresh.fields.push("market(stale-bar)");

  const price = market.price.last;
  const vwap = market.vwap.vwap;
  const sd1 = market.vwap.bands.sd1;
  const sd2 = market.vwap.bands.sd2;
  const sd3 = market.vwap.bands.sd3;
  const z = price != null && vwap != null && sd1 && sd1 > 0 ? (price - vwap) / sd1 : null;
  const atr = market.vol.atr14H1;
  const atrPct = market.vol.atr14PctRank;

  const signals = getSignalsSnapshot(sym) ?? getSignalsSnapshot(resolveCgSym(sym));
  if (signals) trackFresh(fresh, "signals", Date.now() - signals.updatedAt, 20 * 60_000);
  // cold engine? compute one live footprint pass (m15, 300 bars) — same
  // parity pipeline the Footprint tab uses.
  let liveSets = signals?.sets;
  if (!liveSets) {
    try {
      const timeRes = await loadFpBars(sym, "m15", 300);
      liveSets = [{ bt: "time", label: "15m", sigs: computeCgSignals(timeRes.bars).map((s) => ({ ...s, bt: "time" as const })) }];
    } catch {
      liveSets = undefined;
    }
  }

  const cvd = getCvdSnapshot(sym) ?? getCvdSnapshot(resolveCgSym(sym));
  if (cvd) trackFresh(fresh, "cvd", Date.now() - cvd.updatedAt, 20 * 60_000);
  const whale = getWhaleSnapshot(sym) ?? getWhaleSnapshot(resolveCgSym(sym));
  if (whale) trackFresh(fresh, "walls", Date.now() - whale.updatedAt, 20 * 60_000);
  const liq = getLiqSnapshot(sym) ?? getLiqSnapshot(resolveCgSym(sym));
  if (liq) trackFresh(fresh, "liq", Date.now() - liq.updatedAt, 20 * 60_000);

  const quant = !isClassic ? await fetchQuantLite(sym) : null;
  // L/S ratios are 1h-bucket metrics (bucket-END stamps) — 75 min is the
  // honest freshness bound for the rows this engine consumes.
  if (quant?.dataAt) trackFresh(fresh, "quant", Date.now() - quant.dataAt, 75 * 60_000);
  const options = sym === "BTC" || sym === "ETH" ? await fetchOptionsLite(sym) : null;
  // DVOL is hourly; the chain snapshot is minutes-fresh — 10 min bound.
  if (options?.dataAt) trackFresh(fresh, "options", Date.now() - options.dataAt, 10 * 60_000);

  const beta = await crossAssetBeta(sym, market.kind === "equity" || market.kind === "commodity" || market.kind === "index").catch(() => []);

  // ---- STEP 1: regime ----
  const h4Stack = stackOrder(market.ema.h4);
  const d1Stack = stackOrder(market.ema.d1);
  const h1Stack = stackOrder(market.ema.h1);
  const emaSpreadAtr =
    market.ema.h4.e13 != null && market.ema.h4.e89 != null && atr != null && atr > 0
      ? (market.ema.h4.e13 - market.ema.h4.e89) / atr
      : null;
  const aboveVwap = price != null && vwap != null ? price > vwap : null;
  const gex = options?.gexRegime ?? null;

  let regime: Regime;
  const regimeBits: string[] = [];
  if (atrPct != null && atrPct < 20 && emaSpreadAtr != null && Math.abs(emaSpreadAtr) < 0.8) {
    regime = "COMPRESSION_SQUEEZE";
    regimeBits.push(`ATR pct ${fmt(atrPct, 0)}% < 20th (coil)`, `flat EMA13-89 spread ${fmt(emaSpreadAtr, 2)} ATR`);
    if (liq?.last) regimeBits.push("rising OI awaited — expansion pending");
  } else if (
    (h4Stack === "up" && (d1Stack === "up" || d1Stack === "tangled") && (emaSpreadAtr ?? 0) > 0.5 && aboveVwap) ||
    (h4Stack === "up" && d1Stack === "up" && aboveVwap)
  ) {
    regime = "TREND_UP";
    regimeBits.push(`H4 stack ${h4Stack}`, `D1 stack ${d1Stack}`, `EMA spread ${fmt(emaSpreadAtr, 2)} ATR`, "price holds above Day VWAP");
  } else if (
    (h4Stack === "down" && (d1Stack === "down" || d1Stack === "tangled") && (emaSpreadAtr ?? 0) < -0.5 && aboveVwap === false) ||
    (h4Stack === "down" && d1Stack === "down" && aboveVwap === false)
  ) {
    regime = "TREND_DOWN";
    regimeBits.push(`H4 stack ${h4Stack}`, `D1 stack ${d1Stack}`, `EMA spread ${fmt(emaSpreadAtr, 2)} ATR`, "price holds below Day VWAP");
  } else {
    regime = "RANGE_BALANCE";
    regimeBits.push(
      `H4 stack ${h4Stack} / D1 ${d1Stack}`,
      `EMA spread ${fmt(emaSpreadAtr, 2)} ATR (flat)`,
      price != null && z != null ? `VWAP z ${fmt(z, 2)}σ oscillating` : "VWAP z n/a"
    );
    if (gex === "POSITIVE_PIN") regimeBits.push("Deribit GEX positive pin");
  }
  const regimeNote = regimeBits.join(" · ");

  // ---- shared building blocks ----
  const dayPoc = market.auction.day.poc;
  const dayVah = market.auction.day.vah;
  const dayVal = market.auction.day.val;
  const monthPoc = market.auction.month.poc;
  const monthVah = market.auction.month.vah;
  const monthVal = market.auction.month.val;
  const rsiH1 = market.rsi.h1;
  const rsiM15 = market.rsi.m15;
  const pdh = market.levels.pdh;
  const pdl = market.levels.pdl;

  const bullSig = recentSignals(liveSets, 32, "buy");
  const bearSig = recentSignals(liveSets, 32, "sell");
  const proofTypes = ["exh", "trap", "abs", "sdiv", "div"];
  const bullProof = bullSig.filter((s) => proofTypes.includes(s.t));
  const bearProof = bearSig.filter((s) => proofTypes.includes(s.t));

  const bidWall = whale?.topBids?.[0] ?? null;
  const askWall = whale?.topAsks?.[0] ?? null;
  const liqAbove = liq?.topAbove?.[0]?.price ?? null;
  const liqBelow = liq?.topBelow?.[0]?.price ?? null;

  // ---- STEP 2a: MODEL 1 — trend-following pullback ----
  const m1Dir: Direction | null = regime === "TREND_UP" ? "LONG" : regime === "TREND_DOWN" ? "SHORT" : null;
  let m1: { status: string; note: string } | null = null;
  let m1Plan: NarrativePlan | null = null;
  let m1Grade: Grade = "SKIP";
  let m1Confidence = 0;

  if (m1Dir) {
    const long = m1Dir === "LONG";
    // bias gate — 2-of-3
    const biasVotes = [
      long ? h4Stack === "up" && d1Stack !== "down" : h4Stack === "down" && d1Stack !== "up",
      long ? aboveVwap === true : aboveVwap === false,
      long ? (cvd?.delta24h ?? 0) > 0 : (cvd?.delta24h ?? 0) < 0,
    ];
    const biasCount = biasVotes.filter(Boolean).length;
    const biasOk = biasCount >= 2;

    // chase guard: already > ±2σ from VWAP
    const stretched = z != null && Math.abs(z) > 2.0;

    if (!biasOk) {
      m1 = { status: "BIAS_FAIL", note: `bias gate ${biasCount}/3 — regime says ${regime} but HTF/VWAP/CVD disagree` };
    } else if (stretched) {
      const zoneLo = long ? Math.min(vwap! + (sd1 ?? 0), price! - 0.5 * (atr ?? 0)) : vwap! - (sd2 ?? 0);
      const zoneHi = long ? vwap! + (sd2 ?? 0) : Math.max(vwap! - (sd1 ?? 0), price! + 0.5 * (atr ?? 0));
      m1 = {
        status: "WAIT_PULLBACK",
        note: `price ${fmt(Math.abs(z!), 2)}σ from Day VWAP — do not chase; limit zone set at the trend-side ±1-2σ band`,
      };
      m1Plan = {
        entryZone: [zoneLo, zoneHi],
        triggerRule: `limit fill at the zone + ${long ? "bullish" : "bearish"} footprint confirmation (absorption / strong divergence / trap)`,
        stop: long ? vwap! - (sd3 ?? 0) : vwap! + (sd3 ?? 0),
        invalidation: "Day VWAP 0σ lost (regime flip)",
        targets: [
          { level: long ? price! + 2 * (atr ?? 0) : price! - 2 * (atr ?? 0), label: "trend continuation leg (2 ATR)", rMultiple: null },
        ],
        bestR: null,
        vetoes: ["chase guard: > 2.0σ VWAP extension — wait for the pullback"],
      };
      m1Grade = "B";
      m1Confidence = 45;
    } else {
      // pullback zone: confluence of trend-side VWAP band / POCs / EMA pocket / PDH-PDL flip
      const pocket = long
        ? [market.ema.h1.e13, market.ema.h1.e89].filter((x): x is number => x != null)
        : [market.ema.h1.e89, market.ema.h1.e13].filter((x): x is number => x != null);
      const candidates = [
        long ? vwap : null,
        long ? vwap! + (sd1 ?? 0) : vwap! - (sd1 ?? 0),
        dayPoc,
        monthPoc,
        long ? pdl : pdh,
        ...pocket,
      ].filter((x): x is number => x != null && Number.isFinite(x));
      const zoneLoRaw = Math.max(...candidates) - (atr ?? 0) * 0.25;
      const zoneHiRaw = Math.min(...candidates) + (atr ?? 0) * 0.25;
      // GEOMETRY FIX (2026-11-12): a wide candidate spread (PDH vs POC vs
      // EMA pocket can sit ATRs apart) made zoneLo > zoneHi — an INVERTED
      // zone that also let the structural stop land inside it, overstating
      // R on far fills. Normalize the span; the stop gets clamped outside.
      const zoneLo = Math.min(zoneLoRaw, zoneHiRaw);
      const zoneHi = Math.max(zoneLoRaw, zoneHiRaw);
      const entryMid = (Math.max(...candidates) + Math.min(...candidates)) / 2;

      // order-flow trigger at the zone
      const trigSigs = long ? bullProof : bearProof;
      const trigWall = long ? bidWall : askWall;
      const wallNear = trigWall && price != null && Math.abs(trigWall.price - entryMid) / entryMid < 0.02 && trigWall.usd >= 1_000_000;
      const quadrant = quant?.quadrant4h ?? quant?.quadrant1h ?? null;
      const nonDistribution = long ? quadrant !== "LONG_LIQUIDATION" : quadrant !== "SHORT_COVERING";
      const cvdAgrees = long ? (cvd?.delta24h ?? 0) > 0 : (cvd?.delta24h ?? 0) < 0;
      const triggered = trigSigs.length > 0 || (wallNear && cvdAgrees && nonDistribution);

      // stop: beyond structural invalidation
      const sigZone = trigSigs.length ? (long ? trigSigs[0].lo : trigSigs[0].hi) : null;
      const stopCandidates = [
        sigZone,
        long ? vwap! - (sd2 ?? 0) : vwap! + (sd2 ?? 0),
        long ? zoneLo - (atr ?? 0) * 0.5 : zoneHi + (atr ?? 0) * 0.5,
      ].filter((x): x is number => x != null && Number.isFinite(x));
      let stop = long ? Math.min(...stopCandidates) : Math.max(...stopCandidates);
      // GEOMETRY GUARD (2026-11-12): the stop must sit OUTSIDE the entry
      // zone on the invalidation side — when ATR/σ candidates are missing,
      // the signal-zone stop can collapse inside the pullback zone and
      // invert the risk on fills near the far edge.
      const gBuf = 0.25 * ((atr && atr > 0 ? atr : Math.abs(zoneHi - zoneLo)) || entryMid * 0.002);
      stop = long ? Math.min(stop, zoneLo - gBuf) : Math.max(stop, zoneHi + gBuf);

      // targets
      const t1Candidates = [long ? dayVah : dayVal, long ? vwap! + 1.5 * (sd1 ?? 0) : vwap! - 1.5 * (sd1 ?? 0)].filter(
        (x): x is number => x != null
      );
      const t1 = long ? Math.max(...t1Candidates) : Math.min(...t1Candidates);
      const t2Candidates = [long ? liqAbove : liqBelow, long ? monthVah : monthVal].filter((x): x is number => x != null && x > 0);
      const t2 = t2Candidates.length ? (long ? Math.min(...t2Candidates) : Math.max(...t2Candidates)) : null;
      const t3Candidates = [long ? askWall?.price : bidWall?.price, long ? market.levels.pwh : market.levels.pwl].filter(
        (x): x is number => x != null
      );
      const t3 = t3Candidates.length ? (long ? Math.min(...t3Candidates) : Math.max(...t3Candidates)) : null;

      const risk = stop != null && entryMid > 0 ? Math.abs(entryMid - stop) : null;
      const rOf = (lvl: number | null) => (lvl != null && risk != null && risk > 0 ? Math.abs(lvl - entryMid) / risk : null);
      const r1 = rOf(t1);
      const r2 = rOf(t2);
      const r3 = rOf(t3);
      const bestR = Math.max(...[r1, r2, r3].filter((x): x is number => x != null), 0) || null;

      // hard vetoes
      if (bestR != null && bestR < 1.5) vetoes.push(`M1 R ${fmt(bestR, 2)} < 1.5 — reward does not pay the risk`);
      const blocksT1 =
        long ? askWall != null && t1 != null && askWall.price <= t1 && askWall.usd >= 1_000_000 : bidWall != null && t1 != null && bidWall.price >= t1 && bidWall.usd >= 1_000_000;
      if (blocksT1) vetoes.push(`opposing ${(long ? askWall : bidWall)!.usd >= 1_000_000 ? "$1M+ " : ""}wall at ${fmt((long ? askWall : bidWall)!.price, market.priceDecs)} blocks T1`);
      if (market.stale) vetoes.push("market feed stale — entries disabled until fresh");
      if (!liveSets) vetoes.push("footprint feed cold — order-flow trigger unverifiable");

      m1Plan = {
        entryZone: [zoneLo, zoneHi],
        triggerRule: triggered
          ? `${trigSigs.length ? `footprint ${trigSigs[0].t} fired ${trigSigs[0].side}` : "wall + CVD + OI quadrant aligned"} in ${regime === "TREND_UP" ? "long" : "short"} direction at the zone`
          : `await ${long ? "bullish" : "bearish"} footprint confirmation (absorption / strong divergence / trap) or wall+CVD confluence at ${fmt(zoneLo, market.priceDecs)}-${fmt(zoneHi, market.priceDecs)}`,
        stop,
        invalidation: `structure beyond ${fmt(stop, market.priceDecs)} (signal zone / ±2σ VWAP / 0.5 ATR buffer)`,
        targets: [
          { level: t1, label: "T1 · Day VAH/VAL or ±1.5σ", rMultiple: r1 },
          { level: t2, label: "T2 · same-direction liquidation cluster", rMultiple: r2 },
          { level: t3, label: "T3 · whale wall / PWH-PWL", rMultiple: r3 },
        ],
        bestR,
        vetoes: [],
      };
      m1 = { status: triggered ? "TRIGGERED" : "ARMED", note: `${regime} with pullback into ${fmt(zoneLo, market.priceDecs)}-${fmt(zoneHi, market.priceDecs)}` };
      const checks = [biasOk, !stretched, triggered, bestR == null || bestR >= 1.5, !blocksT1, !market.stale];
      const passed = checks.filter(Boolean).length;
      m1Grade = passed >= 6 ? "A" : passed >= 4 ? "B" : "SKIP";
      if (bestR != null && bestR >= 2 && triggered) m1Grade = "A+";
      m1Confidence = Math.min(92, 35 + passed * 10 + (trigSigs.length ? 8 : 0));
    }
  } else {
    m1 = { status: "OFF", note: `regime ${regime} — M1 needs TREND_UP/TREND_DOWN` };
  }

  // ---- STEP 2b: MODEL 2 — VWAP ±2σ-3σ mean reversion ----
  let m2: { status: string; note: string } | null = null;
  let m2Plan: NarrativePlan | null = null;
  let m2Grade: Grade = "SKIP";
  let m2Confidence = 0;
  let m2Dir: Direction | null = null;

  const stretchedUp = z != null && z >= 2.0;
  const stretchedDown = z != null && z <= -2.0;
  const outsideMonthVA =
    price != null && ((monthVah != null && price > monthVah) || (monthVal != null && price < monthVal));
  const m2Eligible = (stretchedUp || stretchedDown || (outsideMonthVA && regime === "RANGE_BALANCE")) && price != null && vwap != null;

  if (m2Eligible) {
    m2Dir = stretchedUp ? "SHORT" : "LONG";
    const short = m2Dir === "SHORT";
    const peakConviction = z != null && Math.abs(z) >= 2.2;

    // crowding / fuel exhaustion
    const rsiExtreme = short ? (rsiH1 ?? rsiM15 ?? 50) > 72 : (rsiH1 ?? rsiM15 ?? 50) < 28;
    const fundingExtreme = quant?.fundingAprPct != null ? (short ? quant.fundingAprPct > 25 : quant.fundingAprPct < -25) : false;
    const lsExtreme = quant?.topLs != null ? (short ? quant.topLs > 2.2 : quant.topLs < 0.55) : false;
    const nearestCluster = nearestLevel(price, [liqAbove, liqBelow]);
    const sweptCluster = liq != null && nearestCluster.distPct != null && nearestCluster.distPct < 0.5 && nearestCluster.level != null &&
      (short ? nearestCluster.level > price : nearestCluster.level < price);
    const crowded = rsiExtreme || fundingExtreme || lsExtreme || sweptCluster;

    // mandatory reversal proof
    const proofSigs = short ? bearProof : bullProof;
    const opposingWall = short ? bidWall : askWall;
    const wallDefends =
      opposingWall != null && price != null && Math.abs(opposingWall.price - price) / price < 0.0075 && opposingWall.usd >= 1_000_000;
    const cvdDiv = cvd?.divergences?.length ? cvd.divergences[cvd.divergences.length - 1] : null;
    const cvdFades = cvdDiv ? (short ? cvdDiv.dir === "bearish" : cvdDiv.dir === "bullish") : false;
    const proof = proofSigs.length > 0 || (wallDefends && cvdFades);

    if (!crowded) {
      m2 = { status: "WATCH_EXHAUSTION", note: `price ${fmt(Math.abs(z!), 2)}σ from VWAP but no crowding signal yet (RSI ${fmt(rsiH1 ?? rsiM15, 0)}, funding ${fmt(quant?.fundingAprPct, 1)}% APR, top L/S ${fmt(quant?.topLs, 2)})` };
      m2Grade = "B";
      m2Confidence = 35;
    } else if (!proof) {
      m2 = { status: "WATCH_EXHAUSTION", note: `stretched ${fmt(Math.abs(z!), 2)}σ + crowded, but NO reversal proof (no exhaustion/trap/absorption/divergence signal, no defending wall) — knife-catching veto` };
      vetoes.push("M2 anti-knife-catching gate: stretch + crowding without reversal proof");
      m2Grade = "B";
      m2Confidence = 30;
    } else {
      // stop: tight structural beyond ±3σ or 0.3-0.5 ATR past sweep wick / defending wall
      const stopCandidates = [
        short ? vwap + (sd3 ?? 0) : vwap - (sd3 ?? 0),
        short ? Math.max(price + 0.4 * (atr ?? 0), opposingWall?.price ?? price) : Math.min(price - 0.4 * (atr ?? 0), opposingWall?.price ?? price),
      ].filter((x): x is number => x != null && Number.isFinite(x));
      const stop = short ? Math.max(...stopCandidates) : Math.min(...stopCandidates);
      const entryMid = price;

      const t1 = short ? vwap - (sd1 ?? 0) : vwap + (sd1 ?? 0);
      const t2Candidates = [vwap, dayPoc].filter((x): x is number => x != null);
      const t2 = t2Candidates.length ? (short ? Math.max(...t2Candidates) : Math.min(...t2Candidates)) : null;
      const t3Candidates = [short ? dayVal : dayVah, short ? liqBelow : liqAbove].filter((x): x is number => x != null);
      const t3 = t3Candidates.length ? (short ? Math.min(...t3Candidates) : Math.max(...t3Candidates)) : null;

      const risk = Math.abs(entryMid - stop);
      const rOf = (lvl: number | null) => (lvl != null && risk > 0 ? Math.abs(lvl - entryMid) / risk : null);
      const r1 = rOf(t1);
      const r2 = rOf(t2);
      const r3 = rOf(t3);

      // hard veto: R >= 1.2 to T1, R >= 1.5 to T2
      if (r1 != null && r1 < 1.2) vetoes.push(`M2 R to T1 ${fmt(r1, 2)} < 1.2`);
      if (r2 != null && r2 < 1.5) vetoes.push(`M2 R to T2 ${fmt(r2, 2)} < 1.5`);
      // hard veto: accelerating trend with rising CVD + positive coinbase premium + zero exhaustion
      const trendAccel = regime === "TREND_UP" || regime === "TREND_DOWN";
      const cvdRising = short ? (cvd?.delta24h ?? 0) > 0 : (cvd?.delta24h ?? 0) < 0;
      const premiumWith = quant?.coinbasePremiumBps != null ? (short ? quant.coinbasePremiumBps > 5 : quant.coinbasePremiumBps < -5) : false;
      const noExhaustion = (short ? bullProof : bearProof).filter((s) => s.t === "exh" || s.t === "abs").length === 0;
      if (trendAccel && cvdRising && premiumWith && noExhaustion) {
        vetoes.push("M2 vetoed: trend accelerating + CVD with trend + Coinbase premium + zero exhaustion/absorption");
      }

      m2Plan = {
        entryZone: [short ? Math.min(price, price - 0.15 * (atr ?? 0)) : price, short ? price : price + 0.15 * (atr ?? 0)],
        triggerRule: `${proofSigs.length ? `footprint ${proofSigs[0].t} (${proofSigs[0].side})` : "defending wall + CVD divergence"} fading the ${short ? "upside" : "downside"} stretch — enter on the confirmation bar close`,
        stop,
        invalidation: `±3σ VWAP (${fmt(short ? vwap + (sd3 ?? 0) : vwap - (sd3 ?? 0), market.priceDecs)}) or 0.4 ATR past the sweep`,
        targets: [
          { level: t1, label: "T1 · ±1σ VWAP (partial, stop → BE)", rMultiple: r1 },
          { level: t2, label: "T2 · Day VWAP / POC", rMultiple: r2 },
          { level: t3, label: "T3 · Day VAL/VAH or opposite cluster", rMultiple: r3 },
        ],
        bestR: r2 ?? r1,
        vetoes: [],
      };
      m2 = { status: "TRIGGERED", note: `${fmt(Math.abs(z!), 2)}σ stretch ${peakConviction ? "(peak conviction) " : ""}+ ${sweptCluster ? "swept cluster, " : ""}reversal proof: ${proofSigs.length ? proofSigs[0].t : "wall+CVD"}` };
      const checks = [crowded, proof, r1 == null || r1 >= 1.2, r2 == null || r2 >= 1.5, !(trendAccel && cvdRising && premiumWith && noExhaustion)];
      const passed = checks.filter(Boolean).length;
      m2Grade = passed >= 5 ? "A" : passed >= 3 ? "B" : "SKIP";
      if (passed >= 5 && peakConviction) m2Grade = "A+";
      m2Confidence = Math.min(90, 30 + passed * 12);
    }
  } else {
    m2 = { status: "OFF", note: z != null ? `price ${fmt(z, 2)}σ from Day VWAP — M2 needs |z| ≥ 2.0` : "VWAP z unavailable" };
  }

  // ---- STEP 3: conflict resolution & final verdict ----
  let activeModel: ActiveModel = "NO_TRADE";
  let direction: Direction = "NEUTRAL";
  let grade: Grade = "SKIP";
  let confidence = 0;
  let plan: NarrativePlan = { entryZone: null, triggerRule: "n/a", stop: null, invalidation: "no setup", targets: [], bestR: null, vetoes: [] };
  let thesis = "";

  const m1Armed = m1?.status === "TRIGGERED" || m1?.status === "ARMED";
  const m2Armed = m2?.status === "TRIGGERED";

  if (m1?.status === "WAIT_PULLBACK") {
    activeModel = "WAIT_PULLBACK";
    direction = m1Dir ?? "NEUTRAL";
    grade = m1Grade;
    confidence = m1Confidence;
    plan = m1Plan ?? plan;
    thesis = `${regime.replace("_", " ").toLowerCase()} regime (${regimeNote}), but price sits ${fmt(Math.abs(z ?? 0), 2)}σ from the Day VWAP — chasing here pays no edge. Working limit order at the trend-side band ${plan.entryZone ? `${fmt(plan.entryZone[0], market.priceDecs)}-${fmt(plan.entryZone[1], market.priceDecs)}` : "n/a"}; the ${direction === "LONG" ? "bid" : "offer"} is earned when footprint absorption or a strong divergence prints at the zone.`;
  } else if (m1Armed && (!m2Armed || m1Confidence >= m2Confidence)) {
    activeModel = "M1_TREND_PULLBACK";
    direction = m1Dir ?? "NEUTRAL";
    grade = m1Grade;
    confidence = m1Confidence;
    plan = m1Plan ?? plan;
    const t = plan.targets.find((x) => x.rMultiple != null);
    thesis = `${regime.replace("_", " ").toLowerCase()} context (${regimeNote}) set the ${direction} bias. Price pulled back into the confluence zone ${plan.entryZone ? `${fmt(plan.entryZone[0], market.priceDecs)}-${fmt(plan.entryZone[1], market.priceDecs)}` : "n/a"} (VWAP band · POC · EMA pocket${(m1Dir === "LONG" ? pdl : pdh) != null ? " · PDH/PDL flip" : ""})${m1?.status === "TRIGGERED" ? ", where the footprint printed its confirmation" : " — the trigger is still pending"}. Risk is defined beyond ${fmt(plan.stop, market.priceDecs)}; the first objective pays ${t ? `${fmt(t.rMultiple, 2)}R` : "n/a"} at ${t ? fmt(t.level, market.priceDecs) : "n/a"}.`;
  } else if (m2Armed) {
    activeModel = "M2_MEAN_REVERSION";
    direction = m2Dir ?? "NEUTRAL";
    grade = m2Grade;
    confidence = m2Confidence;
    plan = m2Plan ?? plan;
    const t = plan.targets.find((x) => x.rMultiple != null);
    thesis = `Price is stretched ${fmt(Math.abs(z ?? 0), 2)}σ from the Day VWAP with ${m2?.note.includes("cluster") ? "liquidation fuel spent at the sweep" : "crowding exhausted"}; the reversal proof (${m2?.note.split("reversal proof: ")[1] ?? "flow turn"}) says fade it ${direction === "SHORT" ? "back down" : "back up"} toward the mean. Stop sits beyond ±3σ at ${fmt(plan.stop, market.priceDecs)}; T1 at ${t ? fmt(t.level, market.priceDecs) : "n/a"} pays ${t ? fmt(t.rMultiple, 2) : "n/a"}R with the magnet at the 0σ VWAP.`;
  } else if (m2?.status === "WATCH_EXHAUSTION") {
    activeModel = "WATCH_EXHAUSTION";
    direction = m2Dir ?? "NEUTRAL";
    grade = m2Grade;
    confidence = m2Confidence;
    thesis = `${fmt(Math.abs(z ?? 0), 2)}σ VWAP stretch detected, but the anti-knife-catching gate is not satisfied (${m2?.note}). Wait for the footprint to print exhaustion/trap/absorption or a defending wall before fading — or for the ±3σ flush.`;
  } else if (regime === "COMPRESSION_SQUEEZE") {
    activeModel = "NO_TRADE";
    direction = "NEUTRAL";
    grade = "B";
    confidence = 40;
    thesis = `Volatility is coiled (ATR percentile ${fmt(atrPct, 0)}%, EMA spread ${fmt(emaSpreadAtr, 2)} ATR) — the honest play is patience. Do NOT fade the range: compression resolves explosively, and the highest-value action is standing ready with the M1 pullback plan the moment a stack aligns.`;
  } else {
    activeModel = "NO_TRADE";
    direction = "NEUTRAL";
    grade = "SKIP";
    confidence = 20;
    thesis = `${regime.replace("_", " ").toLowerCase()} regime (${regimeNote}) with no validated M1 pullback and no ±2σ M2 stretch — no edge is paying for the risk right now. Re-evaluate on the next footprint signal or a VWAP band touch.`;
  }

  if (grade === "SKIP" && (activeModel === "M1_TREND_PULLBACK" || activeModel === "M2_MEAN_REVERSION")) {
    thesis += " Setup exists but the grade is SKIP — vetoes must clear first.";
  }

  // ---- checklist (exact measured values) ----
  const checklist: ChecklistItem[] = [
    {
      key: "htf-emas",
      label: "HTF EMAs (H4/D1 13×89×233)",
      pass: h4Stack !== "n/a" ? (direction === "LONG" ? h4Stack === "up" : direction === "SHORT" ? h4Stack === "down" : h4Stack === "tangled") : null,
      value: `H4 ${h4Stack} · D1 ${d1Stack} · spread ${fmt(emaSpreadAtr, 2)} ATR`,
    },
    {
      key: "vwap-z",
      label: "VWAP Z-Score",
      pass: z != null ? Math.abs(z) >= 2.0 || Math.abs(z) <= 0.5 : null,
      value: z != null ? `${fmt(z, 2)}σ` : "n/a",
    },
    {
      key: "footprint",
      label: "Footprint Signal",
      pass: liveSets ? (direction === "LONG" ? bullProof.length > 0 : direction === "SHORT" ? bearProof.length > 0 : false) : null,
      value: liveSets
        ? `${bullProof.length + bearProof.length} confirmation signals (8h window)${bullProof[0] ? ` · latest ${bullProof[0].t}@${fmt(bullProof[0].p, market.priceDecs)}` : bearProof[0] ? ` · latest ${bearProof[0].t}@${fmt(bearProof[0].p, market.priceDecs)}` : ""}`
        : "feed cold",
    },
    {
      key: "cvd",
      label: "CVD / Spot Lead",
      pass: cvd ? (direction === "LONG" ? cvd.delta24h > 0 : direction === "SHORT" ? cvd.delta24h < 0 : true) : null,
      value: cvd
        ? `24h Δ ${cvd.delta24h >= 0 ? "+" : ""}$${(cvd.delta24h / 1e6).toFixed(1)}M${cvd.divergences.length ? ` · latest div ${cvd.divergences[cvd.divergences.length - 1].dir}` : ""}${quant?.coinbasePremiumBps != null ? ` · Coinbase ${quant.coinbasePremiumBps > 0 ? "+" : ""}${quant.coinbasePremiumBps.toFixed(1)}bps` : ""}`
        : "n/a",
    },
    {
      key: "walls",
      label: "Walls / Whale",
      pass: whale ? (direction === "LONG" ? (bidWall?.usd ?? 0) >= 1_000_000 : direction === "SHORT" ? (askWall?.usd ?? 0) >= 1_000_000 : true) : null,
      value: whale
        ? `bid ${bidWall ? `$${(bidWall.usd / 1e6).toFixed(1)}M@${fmt(bidWall.price, market.priceDecs)}` : "–"} · ask ${askWall ? `$${(askWall.usd / 1e6).toFixed(1)}M@${fmt(askWall.price, market.priceDecs)}` : "–"}`
        : "n/a",
    },
    {
      key: "liq",
      label: "Liq Magnet",
      pass: liq ? (direction === "LONG" ? liqAbove != null : direction === "SHORT" ? liqBelow != null : true) : null,
      value: liq
        ? `above ${liqAbove ? fmt(liqAbove, market.priceDecs) : "–"} · below ${liqBelow ? fmt(liqBelow, market.priceDecs) : "–"}`
        : "n/a",
    },
    {
      key: "funding-ls",
      label: "Funding / L-S",
      pass: quant ? (quant.fundingAprPct == null ? null : Math.abs(quant.fundingAprPct) <= 25) : null,
      value: quant
        ? `OI-W APR ${fmt(quant.fundingAprPct, 1)}% · top L/S ${fmt(quant.topLs, 2)} · taker ${fmt(quant.takerRatio, 2)}${quant.quadrant4h ? ` · OI 4h ${quant.quadrant4h}` : ""}`
        : "n/a",
    },
    {
      key: "gex",
      label: "GEX / Skew (Deribit)",
      pass: options ? (options.gexRegime === "POSITIVE_PIN" ? regime === "RANGE_BALANCE" : true) : null,
      value: options ? `${options.gexRegime ?? "–"} · RR25d ${fmt(options.rr25d, 1)} · DVOL ${fmt(options.dvol, 0)}` : "BTC/ETH only",
    },
    {
      key: "r",
      label: "R ≥ 1.5",
      pass: plan.bestR != null ? plan.bestR >= 1.5 : activeModel === "WAIT_PULLBACK" || activeModel === "WATCH_EXHAUSTION" ? null : false,
      value: plan.bestR != null ? `bestR ${fmt(plan.bestR, 2)}` : "no measurable R",
    },
    {
      key: "freshness",
      label: "Freshness",
      pass: fresh.fields.length === 0,
      value: fresh.fields.length ? `stale: ${fresh.fields.join(", ")}` : `worst age ${(fresh.worst / 1000).toFixed(0)}s`,
    },
  ];
  if (isClassic) {
    checklist.push({
      key: "classic-note",
      label: "Classic instrument",
      pass: null,
      value: "reduced checklist — no perp order flow / funding / OI feeds exist for cash-CFD indices",
    });
  }

  plan.vetoes = [...plan.vetoes, ...vetoes];

  const worstAge = fresh.worst || market.ageMs;
  return {
    ok: true,
    supported: true,
    sym,
    name: market.name,
    kind: market.kind,
    regime,
    regimeNote,
    activeModel,
    direction,
    grade,
    confidence,
    thesis,
    plan,
    checklist,
    m1,
    m2,
    freshness: {
      worstAgeMs: worstAge,
      staleFields: fresh.fields,
      dataAt: market.dataAt,
      ageMs: market.ageMs,
      stale: fresh.fields.length > 0,
      source: `market:${market.source}${liveSets ? "+fp" : ""}${cvd ? "+cvd" : ""}${whale ? "+walls" : ""}${liq ? "+liq" : ""}${quant ? "+quant" : ""}${options ? "+options" : ""}`,
    },
    beta,
    generatedAt: Date.now(),
  };
}
