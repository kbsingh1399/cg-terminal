/**
 * Cross-asset Alpha Matrix compiler (`GET /api/cg/screener`) — WS2 rebuild
 * (2026-11-12): powered by the CANONICAL Curated-61 (30 crypto perps + 28
 * TradFi perps + 3 classics), zero legacy-registry rows.
 *
 * Zero duplicate upstream polling: one cached Binance `/fapi/v1/ticker/24hr`
 * batch + one cached Coinglass `/api/fundingRate/v2/home` map + scanner state
 * (`S.market`, `S.signals`, `S.liq`, `S.cvd`, `S.whale`) + the narrative
 * radar's progressive M1/M2 verdict sweep (12 s/asset over the same 61) +
 * liq-live trailing-5m cascade windows (in-memory rings, zero quota) +
 * read-only MT5/desk overlay.
 *
 * Every radar-attached field is honest about warmth: `m1m2`/`oi` are null
 * until the radar's first pass reaches that asset (≈ 12 min cold-start),
 * `liq5m` is null when no print landed in the trailing 5 minutes, and the
 * payload carries the standard { dataAt, ageMs, stale, source } telemetry.
 */

import { cgGet } from "./client";
import { cgSigName } from "./cg-signals";
import { getDeskIndex } from "../desk/live";
import { fapiFetch } from "../live/fapi";
import { getLivePrice } from "../live/server-price";
import {
  getCvdSnapshot,
  getLiqSnapshot,
  getMarketSnapshot,
  getSignalsSnapshot,
  getWhaleSnapshot,
} from "./scan";
import { liqWindows5m } from "./liq-live";
import { ensureNarrativeRadar, narrativeRadarStates, narrativeRadarStatus } from "./narrative";
import { symDecs } from "./assets";
import { CURATED, type CuratedKind } from "@/lib/universe/curated";

export type ScreenerKind = CuratedKind;

export interface ScreenerRow {
  sym: string;
  name: string;
  kind: ScreenerKind;
  category: "Crypto" | "TradFi";
  sub: string;
  /** Binance USD-M perp pair (null for the 3 classics) */
  pair: string | null;
  priceDecs: number;
  // ── live market (fapi 24h batch + scanner snapshots) ──
  price: number | null;
  chg24hPct: number | null;
  vol24hUsd: number | null;
  vwap: number | null;
  vwapZ: number | null;
  rvol: number | null;
  ema4h: "bull" | "bear" | null;
  ema1h: "bull" | "bear" | null;
  rsi15m: number | null;
  rsi1h: number | null;
  poc: number | null;
  funding8hPct: number | null;
  signal: {
    title: string;
    side: "buy" | "sell";
    bt: string;
    ts: number;
  } | null;
  liqMagnet: {
    side: "short" | "long";
    price: number;
    distPct: number;
    usd: number;
    strength: number;
  } | null;
  whaleImbPct: number | null;
  cvd24h: number | null;
  cvdDiv: "bullish" | "bearish" | null;
  confluence: {
    score: number;
    bias: "BULL" | "BEAR" | "NEUTRAL";
    readiness: "A+" | "A" | "B" | "WAIT";
    factors: string[];
  } | null;
  // ── narrative radar (M1/M2 live state — null while warming) ──
  m1m2: {
    regime: string;
    activeModel: string;
    direction: "LONG" | "SHORT" | "NEUTRAL";
    grade: string;
    confidence: number;
    bestR: number | null;
    pFill: number | null;
    pT1: number | null;
    evR: number | null;
    pMeanRevert: number | null;
    /** seconds since this verdict was built */
    ageS: number;
  } | null;
  /** OI×price quadrant + OI-weighted funding from /api/cg/quant (via radar) */
  oi: { quadrant4h: string | null; delta4hPct: number | null; fundingAprPct: number | null } | null;
  /** liq-live trailing-5-minute cascade (in-memory rings — zero quota) */
  liq5m: { usd: number; count: number; side: "long" | "short" | "mixed" } | null;
  deskBadge: { badge: string; tone: "pos" | "limit" | "suggested" } | null;
  warm: boolean;
  scanAgeS: number | null;
}

export interface ScreenerPayload {
  ok: boolean;
  ts: number;
  warmCount: number;
  totalCount: number;
  rows: ScreenerRow[];
  /** narrative radar liveness (progressive sweep telemetry) */
  radar: ReturnType<typeof narrativeRadarStatus>;
  fapiOk: boolean;
  /** standard freshness telemetry */
  dataAt: number;
  ageMs: number;
  stale: boolean;
  source: string;
}

interface RawFapi24h {
  symbol: string;
  lastPrice: string;
  priceChangePercent: string;
  quoteVolume: string;
}

interface RawFundingHome {
  symbol?: string;
  uMarginList?: { exchangeName: string; rate?: number; fundingIntervalHours?: number; status?: number }[];
  cMarginList?: { exchangeName: string; rate?: number; fundingIntervalHours?: number; status?: number }[];
}

const g = globalThis as unknown as {
  __screenerFapi?: { at: number; map: Map<string, RawFapi24h> };
};

async function fetchFapi24hMap(): Promise<{ ok: boolean; map: Map<string, RawFapi24h> }> {
  const prev = g.__screenerFapi;
  if (prev && Date.now() - prev.at < 5_000) return { ok: true, map: prev.map };
  try {
    const arr = (await fapiFetch("/fapi/v1/ticker/24hr", 6_000)) as RawFapi24h[];
    const map = new Map<string, RawFapi24h>();
    for (const r of Array.isArray(arr) ? arr : []) map.set(r.symbol, r);
    g.__screenerFapi = { at: Date.now(), map };
    return { ok: true, map };
  } catch {
    return { ok: false, map: prev?.map ?? new Map() };
  }
}

async function fetchFundingMap(): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  try {
    const raw = (await cgGet("/api/fundingRate/v2/home", 30_000)) as RawFundingHome[];
    const keyNames = new Set(["Binance", "OKX", "Bybit", "Hyperliquid"]);
    for (const item of Array.isArray(raw) ? raw : []) {
      const sym = item.symbol?.toUpperCase();
      if (!sym) continue;
      const list = item.uMarginList ?? item.cMarginList ?? [];
      const key = list.filter((v) => keyNames.has(v.exchangeName) && (v.status ?? 1) === 1);
      const pool = key.length ? key : list.filter((v) => (v.status ?? 1) === 1);
      if (!pool.length) continue;
      const sum = pool.reduce((acc, v) => {
        const iv = v.fundingIntervalHours && v.fundingIntervalHours > 0 ? v.fundingIntervalHours : 8;
        return acc + (v.rate ?? 0) * (8 / iv);
      }, 0);
      out.set(sym, Number((sum / pool.length).toFixed(5)));
    }
  } catch {
    /* non-fatal: returns sparse map */
  }
  return out;
}

function scoreConfluence(params: {
  ema4h: "bull" | "bear" | null;
  vwapZ: number | null;
  rsi1h: number | null;
  signal: ScreenerRow["signal"];
  cvdDiv: "bullish" | "bearish" | null;
  funding8hPct: number | null;
}): ScreenerRow["confluence"] | null {
  const { ema4h, vwapZ, rsi1h, signal, cvdDiv, funding8hPct } = params;
  if (ema4h == null && vwapZ == null && signal == null) return null;

  let score = 0;
  const factors: string[] = [];

  if (ema4h === "bull") {
    score += 1;
    factors.push("4H EMA+");
  } else if (ema4h === "bear") {
    score -= 1;
    factors.push("4H EMA-");
  }

  if (vwapZ != null) {
    if (vwapZ > 0.15) {
      score += 0.75;
      factors.push(vwapZ >= 2 ? "VWAP +2σ" : "Above VWAP");
    } else if (vwapZ < -0.15) {
      score -= 0.75;
      factors.push(vwapZ <= -2 ? "VWAP -2σ" : "Below VWAP");
    }
  }

  if (signal && Date.now() / 1000 - signal.ts <= 3 * 3600) {
    const majorSig = /abs|trap|sdiv/i.test(signal.title);
    const w = majorSig ? 1.5 : 0.75;
    score += signal.side === "buy" ? w : -w;
    factors.push(`${signal.side === "buy" ? "BULL" : "BEAR"} ${signal.title.split(" ")[0]}`);
  }

  if (rsi1h != null) {
    if (rsi1h <= 30) {
      score += 0.75;
      factors.push("RSI1H OS");
    } else if (rsi1h >= 70) {
      score -= 0.75;
      factors.push("RSI1H OB");
    }
  }

  if (cvdDiv === "bullish") {
    score += 0.5;
    factors.push("CVD +Div");
  } else if (cvdDiv === "bearish") {
    score -= 0.5;
    factors.push("CVD -Div");
  }

  if (funding8hPct != null && Math.abs(funding8hPct) >= 0.03) {
    // Extremely positive funding favors downside squeeze; deeply negative favors short squeeze
    score += funding8hPct > 0 ? -0.5 : 0.5;
    factors.push(funding8hPct > 0 ? "Crowd Long" : "Neg Carry");
  }

  const rounded = Number(score.toFixed(2));
  const abs = Math.abs(rounded);
  const bias: "BULL" | "BEAR" | "NEUTRAL" = rounded >= 1.0 ? "BULL" : rounded <= -1.0 ? "BEAR" : "NEUTRAL";
  const readiness: "A+" | "A" | "B" | "WAIT" = abs >= 3.0 ? "A+" : abs >= 2.0 ? "A" : abs >= 1.25 ? "B" : "WAIT";
  return { score: rounded, bias, readiness, factors: factors.slice(0, 4) };
}

export async function buildScreenerPayload(): Promise<ScreenerPayload> {
  ensureNarrativeRadar(); // the radar boots with the first screener poll even if the engine never did
  const [fapi, fundingMap] = await Promise.all([fetchFapi24hMap(), fetchFundingMap()]);
  const deskIdx = getDeskIndex();
  const radarStates = narrativeRadarStates();
  const now = Date.now();

  // liq-live trailing-5m windows: sym → cascade USD/count/side (in-memory)
  const liq5mBySym = new Map<string, { usd: number; count: number; side: "long" | "short" | "mixed" }>();
  for (const w of liqWindows5m()) {
    const totalUsd = w.longUsd + w.shortUsd;
    const longShare = totalUsd > 0 ? w.longUsd / totalUsd : 0.5;
    const side: "long" | "short" | "mixed" = Math.max(longShare, 1 - longShare) >= 0.75 ? (longShare >= 0.5 ? "long" : "short") : "mixed";
    liq5mBySym.set(w.sym, { usd: Math.round(totalUsd), count: w.count, side });
  }

  // classic rows have no perp pair — their live price comes from the server
  // price hub (Yahoo/tradeXYZ legs the terminal already maintains)
  const classicPriceP = new Map<string, { price: number | null }>();
  await Promise.all(
    CURATED.filter((c) => c.kind === "classic").map(async (c) => {
      try {
        const lp = await getLivePrice(c.sym);
        classicPriceP.set(c.sym, { price: Number.isFinite(lp.price ?? NaN) && (lp.price ?? 0) > 0 ? lp.price : null });
      } catch {
        classicPriceP.set(c.sym, { price: null });
      }
    })
  );

  let warmCount = 0;
  const rows: ScreenerRow[] = CURATED.map((a) => {
    const mkt = getMarketSnapshot(a.sym);
    const sigSnap = getSignalsSnapshot(a.sym);
    const liq = getLiqSnapshot(a.sym);
    const cvd = getCvdSnapshot(a.sym);
    const whale = getWhaleSnapshot(a.sym);
    const radar = radarStates.get(a.sym);

    const f = a.pair ? fapi.map.get(a.pair) : undefined;
    const fPrice = f ? Number(f.lastPrice) : NaN;
    const classic = a.kind === "classic" ? classicPriceP.get(a.sym) : undefined;
    const price =
      Number.isFinite(fPrice) && fPrice > 0 ? fPrice : classic?.price != null ? classic.price : mkt?.price.last ?? null;
    const chg24hPct = f ? Number(f.priceChangePercent) : mkt?.price.chgDayPct ?? null;
    const vol24hUsd = f ? Number(f.quoteVolume) : null;

    const vwap = mkt?.vwap.vwap ?? null;
    const sd1 = mkt?.vwap.bands.sd1 ?? null;
    const vwapZ =
      price != null && vwap != null && sd1 != null && sd1 > 0 ? Number(((price - vwap) / sd1).toFixed(2)) : null;

    const ema4h = mkt?.ema.h4?.e13 != null && mkt?.ema.h4?.e89 != null ? (mkt.ema.h4.e13 > mkt.ema.h4.e89 ? "bull" : "bear") : null;
    const ema1h = mkt?.ema.h1?.e13 != null && mkt?.ema.h1?.e89 != null ? (mkt.ema.h1.e13 > mkt.ema.h1.e89 ? "bull" : "bear") : null;

    let latestSig: ScreenerRow["signal"] = null;
    if (sigSnap?.sets?.length) {
      for (const set of sigSnap.sets) {
        for (const s of set.sigs) {
          if (!latestSig || s.ts > latestSig.ts) {
            latestSig = {
              title: cgSigName(s),
              side: s.side,
              bt: set.bt,
              ts: s.ts,
            };
          }
        }
      }
    }

    let liqMagnet: ScreenerRow["liqMagnet"] = null;
    if (liq) {
      const candidates = [
        ...liq.topAbove.slice(0, 2).map((l) => ({ ...l, dirSide: "short" as const })),
        ...liq.topBelow.slice(0, 2).map((l) => ({ ...l, dirSide: "long" as const })),
      ].sort((x, y) => x.distPct - y.distPct);
      const top = candidates[0];
      if (top) {
        liqMagnet = {
          side: top.dirSide,
          price: top.price,
          distPct: Number(top.distPct.toFixed(2)),
          usd: top.usd,
          strength: Math.round(top.strength),
        };
      }
    }

    const whaleImbPct =
      whale && whale.bidUsd + whale.askUsd > 0
        ? Math.round(((whale.bidUsd - whale.askUsd) / (whale.bidUsd + whale.askUsd)) * 100)
        : null;

    const funding8hPct = fundingMap.get(a.sym) ?? null;
    const cvdDiv = cvd?.divergences?.[0]?.dir ?? null;
    const warm = Boolean(mkt || sigSnap || (a.kind === "classic" && price != null));
    if (warm) warmCount++;
    const latestUpdate = Math.max(mkt?.updatedAt ?? 0, sigSnap?.updatedAt ?? 0, liq?.updatedAt ?? 0);
    const liq5m = liq5mBySym.get(a.sym) ?? null;

    return {
      sym: a.sym,
      name: a.name,
      kind: a.kind,
      category: a.category,
      sub: a.sub,
      pair: a.pair ?? null,
      priceDecs: symDecs(a.sym, price),
      price,
      chg24hPct: Number.isFinite(chg24hPct) ? Number(chg24hPct!.toFixed(2)) : null,
      vol24hUsd: Number.isFinite(vol24hUsd) ? vol24hUsd : null,
      vwap,
      vwapZ,
      rvol: mkt?.vol.rvolHour != null ? Number(mkt.vol.rvolHour.toFixed(2)) : radar?.rvol ?? null,
      ema4h,
      ema1h,
      rsi15m: mkt?.rsi.m15 != null ? Number(mkt.rsi.m15.toFixed(1)) : null,
      rsi1h: mkt?.rsi.h1 != null ? Number(mkt.rsi.h1.toFixed(1)) : null,
      poc: mkt?.auction.day.poc ?? null,
      funding8hPct,
      signal: latestSig,
      liqMagnet,
      whaleImbPct,
      cvd24h: cvd ? Math.round(cvd.delta24h) : null,
      cvdDiv,
      confluence: scoreConfluence({
        ema4h,
        vwapZ,
        rsi1h: mkt?.rsi.h1 ?? null,
        signal: latestSig,
        cvdDiv,
        funding8hPct,
      }),
      m1m2: radar
        ? {
            regime: radar.regime,
            activeModel: radar.activeModel,
            direction: radar.direction,
            grade: radar.grade,
            confidence: radar.confidence,
            bestR: radar.bestR,
            pFill: radar.pFill,
            pT1: radar.pT1,
            evR: radar.evR,
            pMeanRevert: radar.pMeanRevert,
            ageS: Math.max(0, Math.round((now - radar.generatedAt) / 1000)),
          }
        : null,
      oi:
        radar && (radar.oiQuadrant4h != null || radar.oiDelta4hPct != null || radar.fundingAprPct != null)
          ? { quadrant4h: radar.oiQuadrant4h, delta4hPct: radar.oiDelta4hPct, fundingAprPct: radar.fundingAprPct }
          : null,
      liq5m,
      deskBadge: deskIdx.get(a.sym) ?? null,
      warm,
      scanAgeS: latestUpdate > 0 ? Math.max(0, Math.round((now - latestUpdate) / 1000)) : null,
    };
  });

  const radar = narrativeRadarStatus();
  const newestScan = rows.reduce((m, r) => Math.max(m, r.scanAgeS != null ? now - r.scanAgeS * 1000 : 0), 0);
  const dataAt = Math.max(newestScan, radar.lastTickAt ?? 0, fapi.ok ? now - 5_000 : 0);
  return {
    ok: true,
    ts: now,
    warmCount,
    totalCount: rows.length,
    rows,
    radar,
    fapiOk: fapi.ok,
    dataAt,
    ageMs: now - dataAt,
    stale: !fapi.ok && radar.lastTickAt == null,
    source: `binance-fapi/ticker24h+scan-lanes+narrative-radar(${radar.statesCached}/${radar.universeSize} swept)+liq-live-rings${deskIdx.size ? "+desk" : ""}`,
  };
}
