import { NextRequest, NextResponse } from "next/server";
import { fapiFetch } from "@/lib/live/fapi";
import { binAssetOf } from "@/lib/binance/universe";
import { CURATED_BY_SYM } from "@/lib/universe/curated";
import { premOf } from "@/lib/binance/market-batch";
import { cgGet, FAPI } from "@/lib/cg/client";
import { emaLast, emaSeries, rsiLast } from "@/lib/cg/indicators";
import {
  detectDivergences,
  flowRows,
  FlowGrid,
  pickInstruments,
  recompute,
  type CvdInstrument,
  type TickerRow,
} from "@/lib/cg/cvd";
import { aggVenues, liqVenues, pinCvdInstruments, symDecs } from "@/lib/cg/assets";
import { buildLiqModel, liqStats, type KeyLevel, type RawLiqPayload } from "@/lib/cg/liq-model";
import { buildWallsModel, decodeRow, fetchAggregateWithDiscovery, type BookSnapshot } from "@/lib/cg/book-walls";
import { getLivePrice } from "@/lib/live/server-price";
import { BoundedMap } from "@/lib/cg/bounded";
import type { KlineRow, LtoGroup, LtoSupport } from "@/lib/cg/types";

export const dynamic = "force-dynamic";

/**
 * GET /api/cg/oracle?sym=BTC — ATHENA ORACLE, the confluence panel (Quant × Divine).
 *
 * Six mythologically-named factors, every number derived from REAL data the
 * terminal already serves (no fabricated signals — a factor whose source fails
 * scores a neutral 50 with detail "source unavailable" and is listed in
 * partial[], NEVER faked):
 *
 *   apollo   (0.25) Trend & Momentum      — Binance 15m/1h klines (the klines
 *                                            route's fapi path): EMA20/50/200
 *                                            stack, RSI14 regime, EMA50 slope,
 *                                            1h confirmation
 *   poseidon (0.20) Order-Flow Tide       — the /api/cg/cvd data path verbatim
 *                                            (m15 × 1500, same instrument
 *                                            discovery/pinning): CVD slope over
 *                                            the last 24 bars + divergence flag
 *   hades    (0.15) Liquidation Gravity   — the liqlevels route's builder
 *                                            (range 7d): distance/size of the
 *                                            largest long cluster below vs short
 *                                            cluster above (magnet effect)
 *   zeus     (0.15) Whale Strikes         — the lto route's data path: net
 *                                            resting large-order notional
 *                                            (bid vs ask, ≥$1M orders)
 *   atlas    (0.15) Wall Pressure         — the bookwalls builder (futures
 *                                            aggregate stream, m15 × 150,
 *                                            band 5): dominant wall side
 *                                            within ±2% of price
 *   nemesis  (0.10) Funding Reversion     — market-batch premOf (shared
 *                                            all-symbol premiumIndex batch):
 *                                            funding percentile vs the typical
 *                                            band (crowded longs = reversion
 *                                            risk, crowded shorts = squeeze
 *                                            fuel)
 *
 * Upstream politeness: ONE sym per request, every upstream call goes through
 * the same cached libs/URLs the dedicated routes use (cgGet TTL cache,
 * market-batch shared batches, book-walls venue-discovery cache), and the
 * whole verdict is cached per sym for 60s (BoundedMap, max 128) with
 * in-flight coalescing. Gate: curated Binance PERP members only — the classic
 * 3 have no perp data and get an honest 400.
 */

type FactorId = "apollo" | "poseidon" | "hades" | "zeus" | "atlas" | "nemesis";
type IconName = "sun" | "waves" | "skull" | "zap" | "mountain" | "scale";
type Regime = "trend" | "range" | "squeeze";

interface OracleFactor {
  id: FactorId;
  name: string;
  icon: IconName;
  score: number; // 0-100, higher = more bullish
  weight: number;
  detail: string; // one line, plain English
}

interface OracleBody {
  ok: true;
  sym: string;
  at: number;
  score: number;
  verdict: string;
  factors: OracleFactor[];
  regime: Regime | null;
  partial?: string[];
}

const WEIGHTS: Record<FactorId, number> = {
  apollo: 0.25,
  poseidon: 0.2,
  hades: 0.15,
  zeus: 0.15,
  atlas: 0.15,
  nemesis: 0.1,
};

const NAMES: Record<FactorId, string> = {
  apollo: "Trend & Momentum",
  poseidon: "Order-Flow Tide",
  hades: "Liquidation Gravity",
  zeus: "Whale Strikes",
  atlas: "Wall Pressure",
  nemesis: "Funding Reversion",
};

const ICONS: Record<FactorId, IconName> = {
  apollo: "sun",
  poseidon: "waves",
  hades: "skull",
  zeus: "zap",
  atlas: "mountain",
  nemesis: "scale",
};

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
const clampScore = (x: number) => clamp(Math.round(x), 2, 98);

/** $ compact formatter for details. */
function fmtUsd(v: number): string {
  if (Math.abs(v) >= 1_000_000_000) return `$${(v / 1_000_000_000).toFixed(1)}B`;
  if (Math.abs(v) >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (Math.abs(v) >= 1_000) return `$${Math.round(v / 1_000)}k`;
  return `$${v.toFixed(0)}`;
}

/** Per-factor budget so a hung upstream degrades one god, not the panel. */
function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<never>((_, rej) => {
      setTimeout(() => rej(new Error(`${label} timed out`)), ms);
    }),
  ]);
}

// ---------------------------------------------------------------------------
// Binance klines (the /api/binance/klines route's fetch shape)
// ---------------------------------------------------------------------------

type BinKlineRow = [number, number, number, number, number, number, number];

async function fetchKlines(pair: string, interval: "15m" | "1h", limit: number): Promise<BinKlineRow[]> {
  const raw = (await fapiFetch(
    `/fapi/v1/klines?symbol=${pair}&interval=${interval}&limit=${limit}`,
    8_000
  )) as (string | number)[][];
  if (!Array.isArray(raw)) throw new Error("klines: bad payload");
  return raw
    .map(
      (r): BinKlineRow => [
        Number(r[0]),
        Number(r[1]),
        Number(r[2]),
        Number(r[3]),
        Number(r[4]),
        Number(r[5]),
        Number(r[6]),
      ]
    )
    .filter((r) => Number.isFinite(r[0]) && Number.isFinite(r[4]));
}

// ---------------------------------------------------------------------------
// APOLLO — Trend & Momentum (+ the regime read, same klines)
// ---------------------------------------------------------------------------

async function buildApollo(pair: string): Promise<{ score: number; detail: string; regime: Regime }> {
  const [k15, k1h] = await Promise.all([fetchKlines(pair, "15m", 200), fetchKlines(pair, "1h", 100)]);
  if (k15.length < 60) throw new Error("not enough 15m bars");

  const c15 = k15.map((r) => r[4]);
  const h15 = k15.map((r) => r[2]);
  const l15 = k15.map((r) => r[3]);
  const last = c15[c15.length - 1];
  if (!(last > 0)) throw new Error("bad close");

  const e20 = emaLast(c15, 20);
  const e50s = emaSeries(c15, 50);
  const e50 = e50s[e50s.length - 1] ?? null;
  const e200 = c15.length >= 200 ? emaLast(c15, 200) : null;
  const rsi = rsiLast(c15, 14);
  if (e20 == null || e50 == null || rsi == null) throw new Error("indicator seed failed");

  // EMA stack: 0..denom bullish conditions → ±35 points
  const conds: boolean[] = [e20 > e50, last > e50];
  if (e200 != null) {
    conds.push(e50 > e200, last > e200);
  }
  const cnt = conds.filter(Boolean).length;
  const stackPts = -35 + (70 * cnt) / conds.length;
  let stackLabel: string;
  if (e200 != null) {
    stackLabel = e20 > e50 && e50 > e200 ? "EMA20>50>200" : e20 < e50 && e50 < e200 ? "EMA20<50<200" : "EMA stack mixed";
  } else {
    stackLabel = e20 > e50 ? "EMA20>50" : "EMA20<50";
  }

  // RSI14 regime → ±15
  const rsiPts = clamp((rsi - 50) * 2, -15, 15);

  // EMA50 slope over the last 12 bars (~3h on 15m) → ±12
  const iBack = Math.max(0, c15.length - 13);
  const e50back = e50s[iBack];
  const slopePct = e50back != null && e50back > 0 ? ((e50 - e50back) / e50back) * 100 : 0;
  const slopePts = clamp(slopePct * 25, -12, 12);

  // 1h higher-timeframe confirmation → ±8
  let htfPts = 0;
  const c1h = k1h.map((r) => r[4]).filter((c) => Number.isFinite(c));
  if (c1h.length >= 55) {
    const e50h = emaSeries(c1h, 50);
    const eh = e50h[c1h.length - 1] ?? null;
    const ehBack = e50h[Math.max(0, c1h.length - 11)] ?? null;
    if (eh != null) {
      htfPts += c1h[c1h.length - 1] > eh ? 5 : -5;
      if (ehBack != null) htfPts += eh >= ehBack ? 3 : -3;
    }
  }

  const score = clampScore(50 + stackPts + rsiPts + slopePts + htfPts);
  const slopeTxt = `${slopePct >= 0 ? "+" : "-"}${Math.abs(slopePct).toFixed(2)}%/3h`;
  const detail = `${stackLabel}, RSI ${rsi.toFixed(0)}, EMA50 ${slopeTxt}`;

  // ---- regime: EMA spread vs volatility (ATR proxy) + range compression ----
  const trs: number[] = [];
  for (let i = 1; i < k15.length; i++) {
    const tr = Math.max(h15[i] - l15[i], Math.abs(h15[i] - c15[i - 1]), Math.abs(l15[i] - c15[i - 1]));
    if (Number.isFinite(tr) && tr >= 0) trs.push(tr);
  }
  const win = Math.min(14, trs.length);
  const atr14 = win > 0 ? trs.slice(-win).reduce((s, x) => s + x, 0) / win : 0;
  const atrAll = trs.length ? trs.reduce((s, x) => s + x, 0) / trs.length : 0;
  const atrPct = (atr14 / last) * 100;
  const compression = atrAll > 0 ? atr14 / atrAll : 1;
  const spreadPct = ((e200 != null ? Math.abs(e20 - e200) : Math.abs(e20 - e50)) / last) * 100;
  let regime: Regime;
  if (compression < 0.7 && atrPct > 0) regime = "squeeze";
  else if (atrPct > 0 && spreadPct > 2.5 * atrPct) regime = "trend";
  else regime = "range";

  return { score, detail, regime };
}

// ---------------------------------------------------------------------------
// POSEIDON — Order-Flow Tide (the /api/cg/cvd route's data path, m15 × 1500)
// ---------------------------------------------------------------------------

async function mapLimit<T, R>(items: T[], limit: number, fn: (t: T) => Promise<R>): Promise<(R | null)[]> {
  const out: (R | null)[] = new Array(items.length).fill(null);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      try {
        out[i] = await fn(items[i]);
      } catch {
        out[i] = null;
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

async function buildPoseidon(sym: string): Promise<{ score: number; detail: string }> {
  // instruments — TRADFI: pinned keys; CRYPTO: the route's keyword discovery
  const pinned = pinCvdInstruments(sym);
  let inst: CvdInstrument[];
  let priceKey: string;
  if (pinned) {
    inst = pinned.map((p) => ({ key: p.key, venue: p.venue, kind: p.kind, instrumentId: p.key, volUsd: 0, price: 0 }));
    priceKey = pinned[0]?.key ?? `Binance_${sym}USDT`;
  } else {
    const [fut, spot] = await Promise.all([
      cgGet(`/api/select/coins/tickers?type=FUTURES&keyword=${encodeURIComponent(sym)}`, 120_000) as Promise<
        TickerRow[] | { data: TickerRow[] }
      >,
      cgGet(`/api/select/coins/tickers?type=SPOT&keyword=${encodeURIComponent(sym)}`, 120_000)
        .then((d) => d as TickerRow[] | { data: TickerRow[] })
        .catch(() => [] as TickerRow[]),
    ]);
    const futRows = Array.isArray(fut) ? fut : ((fut as { data?: TickerRow[] }).data ?? []);
    const spotRows = Array.isArray(spot) ? spot : ((spot as { data?: TickerRow[] }).data ?? []);
    ({ inst, priceKey } = pickInstruments(futRows, spotRows, sym));
  }
  if (!inst.length || !priceKey) throw new Error("no CVD instruments");

  const kl = (await cgGet(
    `/api/v2/kline?symbol=${encodeURIComponent(priceKey + "#kline")}&interval=m15&limit=1500&minLimit=false`,
    60_000
  )) as { data?: KlineRow[] } | KlineRow[];
  const klRows = (Array.isArray(kl) ? kl : (kl.data ?? [])).filter((r) => r && Number.isFinite(+r[4]));
  if (!klRows.length) throw new Error("no price kline");

  const grid = new FlowGrid(900_000, inst.map((i) => i.key));
  grid.setCandles(klRows as unknown as [number, string | number, string | number, string | number, string | number][]);
  const flows = await mapLimit(inst, 6, async (v: CvdInstrument) => {
    const r = (await cgGet(
      `/api/v2/kline?symbol=${encodeURIComponent(v.key + "#bs_usd")}&interval=m15&limit=1500&minLimit=false`,
      60_000
    )) as { data?: [number, string | number, string | number][] } | [number, string | number, string | number][];
    return (Array.isArray(r) ? r : (r.data ?? [])) as [number, string | number, string | number][];
  });
  let loaded = 0;
  flows.forEach((rows, i) => {
    if (Array.isArray(rows) && rows.length > 0) {
      loaded++;
      grid.mergeFlow(i, flowRows(rows));
    }
  });
  if (!loaded) throw new Error("no #bs_usd flows loaded");

  const series = recompute(grid, inst);
  if (!series) throw new Error("recompute failed");
  const n = series.n;
  if (n < 40) throw new Error("CVD series too short");

  // CVD slope over the last ~24 bars, normalized by the flow magnitude in the
  // window → pure [-1, 1] bias independent of symbol scale
  const w = Math.min(24, n - 10);
  const cvd = series.total;
  const slope = cvd[n] - cvd[n - w];
  let mag = 0;
  for (let i = n - w; i < n; i++) mag += Math.abs(series.delta[i]);
  const slopeNorm = mag > 0 ? slope / mag : 0;
  let score = 50 + slopeNorm * 45;

  // divergence flag — their exact detector, recent confirmations only
  const divs = detectDivergences(series, cvd);
  const lastDiv = divs.length ? divs[divs.length - 1] : null;
  let divTxt = ", no divergence";
  if (lastDiv && lastDiv.c >= n - 24) {
    if (lastDiv.t === "bear") {
      score -= 12;
      divTxt = `, bear div ${Math.max(1, n - 1 - lastDiv.b)} bars ago`;
    } else {
      score += 12;
      divTxt = `, bull div ${Math.max(1, n - 1 - lastDiv.b)} bars ago`;
    }
  }

  const dir = slopeNorm > 0.05 ? "CVD rising" : slopeNorm < -0.05 ? "CVD falling" : "CVD flat";
  return { score: clampScore(score), detail: `${dir}${divTxt}` };
}

// ---------------------------------------------------------------------------
// HADES — Liquidation Gravity (the liqlevels route's builder, range 7d)
// ---------------------------------------------------------------------------

async function buildHades(sym: string): Promise<{ score: number; detail: string }> {
  const VENUES = liqVenues(sym);
  const results = await Promise.allSettled(
    VENUES.map((v) =>
      cgGet(`/api/liquidationLevels/v2?symbol=${encodeURIComponent(v.key)}&limit=4000&range=7d`, 30_000)
    )
  );
  const venues: { name: string; payload: RawLiqPayload | null }[] = [];
  results.forEach((r, i) => {
    let payload: RawLiqPayload | null = null;
    if (r.status === "fulfilled" && r.value) {
      const val = r.value as RawLiqPayload | { data?: RawLiqPayload };
      payload = (Array.isArray((val as RawLiqPayload)?.prices)
        ? (val as RawLiqPayload)
        : ((val as { data?: RawLiqPayload }).data ?? null)) as RawLiqPayload | null;
    }
    venues.push({ name: VENUES[i].name, payload });
  });
  if (!venues.some((v) => v.payload)) throw new Error("no liquidation-level data from any venue");

  const model = buildLiqModel(venues);
  if (!model) throw new Error("no usable price series");
  const live = await getLivePrice(sym).catch(() => null);
  const stats = liqStats(model, 4, {
    livePrice: live?.price ?? null,
    priceDecs: symDecs(sym, live?.price),
  });

  // largest cluster per side (USD summed in the price row)
  const strongest = (arr: KeyLevel[]): KeyLevel | null =>
    arr.reduce<KeyLevel | null>((a, b) => (!a || b.usd > a.usd ? b : a), null);
  const below = strongest(stats.keyLevels.below); // long liquidations — sell-cascade magnet
  const above = strongest(stats.keyLevels.above); // short liquidations — squeeze-up fuel
  if (!below && !above) return { score: 50, detail: "no open liq clusters within ±4%" };

  const pull = below ? below.usd / (Math.abs(below.distPct) + 0.5) : 0;
  const push = above ? above.usd / (Math.abs(above.distPct) + 0.5) : 0;
  const bias = pull + push > 0 ? (push - pull) / (push + pull) : 0;
  const score = clampScore(50 + bias * 40);
  const parts: string[] = [];
  if (below) parts.push(`long liq ${fmtUsd(below.usd)} ${below.distPct.toFixed(1)}% below`);
  if (above) parts.push(`short liq ${fmtUsd(above.usd)} +${above.distPct.toFixed(1)}% above`);
  return { score, detail: parts.join(" · ") || "no clusters in range" };
}

// ---------------------------------------------------------------------------
// ZEUS — Whale Strikes (the lto route's data path, ≥$1M resting orders)
// ---------------------------------------------------------------------------

async function buildZeus(sym: string): Promise<{ score: number; detail: string }> {
  const support = (await cgGet(
    `/api/largeTakerOrder/support/v3?symbol=${encodeURIComponent(sym)}`,
    10 * 60_000,
    FAPI
  )) as LtoSupport | null;

  const exchanges = new Set<string>();
  for (const s of support?.futures ?? []) if (s?.exchange) exchanges.add(s.exchange);
  for (const s of support?.spot ?? []) if (s?.exchange) exchanges.add(s.exchange);
  if (!exchanges.size) return { score: 50, detail: "no large-order flow" };

  const settled = await Promise.allSettled(
    [...exchanges].map((ex) =>
      cgGet(
        `/api/largeTakerOrder/v3?exchange=${encodeURIComponent(ex)}&symbol=${encodeURIComponent(
          sym
        )}&market=all&limit=3000&minVolUsd=1000000`,
        30_000,
        FAPI
      )
    )
  );
  let buyUsd = 0;
  let sellUsd = 0;
  for (const r of settled) {
    if (r.status !== "fulfilled" || !Array.isArray(r.value)) continue;
    for (const g of r.value as LtoGroup[]) {
      for (const it of g.list ?? []) {
        if (typeof it.price !== "number" || !(it.currentUsd >= 1_000_000)) continue;
        if (it.side === 2) buyUsd += it.currentUsd; // bid / buy side
        else if (it.side === 1) sellUsd += it.currentUsd; // ask / sell side
      }
    }
  }
  const tot = buyUsd + sellUsd;
  if (!(tot > 0)) return { score: 50, detail: "no large-order flow" };

  const bias = (buyUsd - sellUsd) / tot;
  const score = clampScore(50 + bias * 45);
  const net = buyUsd - sellUsd;
  return {
    score,
    detail: `net ${net >= 0 ? "+" : "-"}${fmtUsd(Math.abs(net))} resting whales (${fmtUsd(buyUsd)} bid / ${fmtUsd(sellUsd)} ask)`,
  };
}

// ---------------------------------------------------------------------------
// ATLAS — Wall Pressure (the bookwalls builder, futures aggregate m15 × 150)
// ---------------------------------------------------------------------------

async function buildAtlas(sym: string): Promise<{ score: number; detail: string }> {
  const candidates = aggVenues(sym, "futures");
  if (!candidates.length) return { score: 50, detail: "no book-wall data for this asset" };

  const { result: stream } = await fetchAggregateWithDiscovery({
    coin: sym,
    exchanges: candidates,
    market: "futures",
    interval: "m15",
    limit: 150,
  });
  if (!(stream.size > 0) || !stream.rows.length) throw new Error("aggregate stream returned no rows");

  const snapshots: BookSnapshot[] = [];
  for (const row of stream.rows) {
    const s = decodeRow(row, stream.size);
    if (s) snapshots.push(s);
  }
  const model = buildWallsModel(snapshots, sym, 5, [], 900_000);
  if (!model) throw new Error("no decodable snapshots");

  // dominant confirmed wall per side within ±2% of mid
  const byUsd = model.walls.filter((w) => Math.abs(w.distPct) <= 2).sort((a, b) => b.usd - a.usd);
  const bid = byUsd.find((w) => w.side === "b") ?? null;
  const ask = byUsd.find((w) => w.side === "a") ?? null;
  if (!bid && !ask) return { score: 50, detail: "no walls within ±2%" };

  const bUsd = bid?.usd ?? 0;
  const aUsd = ask?.usd ?? 0;
  const bias = bUsd + aUsd > 0 ? (bUsd - aUsd) / (bUsd + aUsd) : 0;
  const score = clampScore(50 + bias * 40);
  const parts: string[] = [];
  if (bid) parts.push(`bid wall ${fmtUsd(bid.usd)} ${bid.distPct.toFixed(1)}%`);
  if (ask) parts.push(`ask wall ${fmtUsd(ask.usd)} +${ask.distPct.toFixed(1)}%`);
  return { score, detail: parts.join(" · ") };
}

// ---------------------------------------------------------------------------
// NEMESIS — Funding Reversion (shared premiumIndex batch — zero extra fan-out)
// ---------------------------------------------------------------------------

async function buildNemesis(pair: string): Promise<{ score: number; detail: string }> {
  const prem = await premOf(pair);
  if (!prem) throw new Error("premiumIndex unavailable");
  const fPct = (Number(prem.lastFundingRate) || 0) * 100; // % per 8h
  if (!Number.isFinite(fPct)) throw new Error("bad funding field");

  // extreme positive = crowded longs = bearish reversion risk (low score);
  // extreme negative = crowded shorts = squeeze fuel (high score)
  const score = clampScore(50 - fPct * 700);
  const a = Math.abs(fPct);
  const band = a < 0.005 ? "cool" : a < 0.015 ? "warm" : a < 0.03 ? "hot" : a < 0.06 ? "very hot" : "extreme";
  const crowd = fPct >= 0.03 ? ", longs crowded" : fPct <= -0.03 ? ", shorts crowded" : "";
  return { score, detail: `funding ${fPct >= 0 ? "+" : "-"}${a.toFixed(3)}%/8h, ${band}${crowd}` };
}

// ---------------------------------------------------------------------------
// Verdict + orchestration
// ---------------------------------------------------------------------------

function verdictText(score: number, factors: OracleFactor[]): string {
  const byId = new Map(factors.map((f) => [f.id, f] as const));
  const phrases: string[] = [];
  const push = (id: FactorId, hi: string, lo: string) => {
    const f = byId.get(id);
    if (!f) return;
    if (f.score >= 65) phrases.push(hi);
    else if (f.score <= 35) phrases.push(lo);
  };
  push("apollo", "trend aligned", "trend broken");
  push("poseidon", "flow confirming", "flow fading");
  push("hades", "squeeze fuel overhead", "liq magnets below");
  push("zeus", "whales bidding", "whales offering");
  push("atlas", "bid-wall floor", "ask-wall ceiling");
  push("nemesis", "funding still cool", "funding crowded");

  const band =
    score >= 70
      ? "Strong bullish confluence"
      : score >= 55
        ? "Constructive bullish lean"
        : score > 45
          ? "Neutral equilibrium"
          : score >= 30
            ? "Cautious bearish lean"
            : "Strong bearish confluence";
  const drv = phrases.length ? phrases.slice(0, 3).join(", ") : "signals mixed, no dominant driver";
  return `${band} ${score}/100 — ${drv}`;
}

async function computeOracle(sym: string, pair: string): Promise<OracleBody> {
  const [apolloR, poseidonR, hadesR, zeusR, atlasR, nemesisR] = await Promise.allSettled([
    withTimeout(buildApollo(pair), 20_000, "apollo"),
    withTimeout(buildPoseidon(sym), 25_000, "poseidon"),
    withTimeout(buildHades(sym), 25_000, "hades"),
    withTimeout(buildZeus(sym), 25_000, "zeus"),
    withTimeout(buildAtlas(sym), 30_000, "atlas"),
    withTimeout(buildNemesis(pair), 10_000, "nemesis"),
  ]);

  const partial: string[] = [];
  const factors: OracleFactor[] = [];
  let regime: Regime | null = null;

  const mk = (id: FactorId, score: number, detail: string): void => {
    factors.push({ id, name: NAMES[id], icon: ICONS[id], score, weight: WEIGHTS[id], detail });
  };

  const runs: readonly [FactorId, PromiseSettledResult<{ score: number; detail: string; regime?: Regime }>][] = [
    ["apollo", apolloR],
    ["poseidon", poseidonR],
    ["hades", hadesR],
    ["zeus", zeusR],
    ["atlas", atlasR],
    ["nemesis", nemesisR],
  ];
  for (const [id, r] of runs) {
    if (r.status === "fulfilled") {
      mk(id, r.value.score, r.value.detail);
      if (id === "apollo" && r.value.regime) regime = r.value.regime;
    } else {
      // honest degradation: neutral 50, never a fabricated number
      const why = r.reason instanceof Error ? r.reason.message : String(r.reason);
      mk(id, 50, process.env.ORACLE_DEBUG ? `source unavailable (${why})` : "source unavailable");
      partial.push(id);
    }
  }
  if (!regime) partial.push("regime");

  const score = clamp(Math.round(factors.reduce((s, f) => s + f.score * f.weight, 0)), 0, 100);
  return {
    ok: true,
    sym,
    at: Date.now(),
    score,
    verdict: verdictText(score, factors),
    factors,
    regime,
    ...(partial.length ? { partial } : {}),
  };
}

// 60s per-sym cache (BoundedMap, max 128) + in-flight coalescing
interface CacheEntry {
  at: number;
  body: OracleBody;
}
const g = globalThis as unknown as {
  __oracleCache?: BoundedMap<CacheEntry>;
  __oracleInflight?: Map<string, Promise<OracleBody>>;
};
const cache = (g.__oracleCache ??= new BoundedMap<CacheEntry>(128));
const inflight = (g.__oracleInflight ??= new Map<string, Promise<OracleBody>>());
const TTL_MS = 60_000;

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const sym = (sp.get("sym") ?? "").trim().toUpperCase();
  if (!sym) return NextResponse.json({ ok: false, error: "missing ?sym" }, { status: 400 });
  if (!/^[A-Z0-9]{2,20}$/.test(sym)) {
    return NextResponse.json({ ok: false, error: `bad symbol shape ${sym}` }, { status: 400 });
  }
  // gate: curated Binance PERP members only (classic 3 have no perp data)
  if (CURATED_BY_SYM.get(sym)?.kind === "classic") {
    return NextResponse.json(
      { ok: false, error: "classic asset — oracle covers Binance perps only" },
      { status: 400 }
    );
  }
  const asset = binAssetOf(sym);
  if (!asset) {
    return NextResponse.json(
      { ok: false, error: `unknown asset ${sym} — oracle covers the curated Binance perps` },
      { status: 400 }
    );
  }

  const hit = cache.get(sym);
  if (hit && Date.now() - hit.at < TTL_MS) {
    return NextResponse.json(hit.body);
  }
  const running = inflight.get(sym);
  if (running) {
    try {
      return NextResponse.json(await running);
    } catch {
      // fall through to a fresh compute below
    }
  }

  const p = computeOracle(sym, asset.pair).finally(() => inflight.delete(sym));
  inflight.set(sym, p);
  try {
    const body = await p;
    cache.set(sym, { at: Date.now(), body });
    return NextResponse.json(body);
  } catch (e) {
    return NextResponse.json(
      { ok: false, sym, error: e instanceof Error ? e.message : "oracle compute failed" },
      { status: 502 }
    );
  }
}
