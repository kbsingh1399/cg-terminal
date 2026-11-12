import { ASSETS, type CryptoSector } from "./assets";
import { TRADFI_CORE_ASSETS } from "./classic";
import { cgGet } from "./client";
import { cgSigName } from "./cg-signals";
import { hlXyzSnapshot, MICRO_MAP } from "./micro";
import {
  getCvdSnapshot,
  getLiqSnapshot,
  getMarketSnapshot,
  getSignalsSnapshot,
  getWhaleSnapshot,
} from "./scan";
import { fapiFetch } from "../live/fapi";
import { resolveBinPair } from "../binance/aliases";
import { getDeskIndex } from "../desk/live";

/**
 * Cross-asset Alpha Matrix compiler (`GET /api/cg/screener`).
 *
 * Zero duplicate upstream polling: combines one cached Binance `/fapi/v1/ticker/24hr`
 * batch + one cached Coinglass `/api/fundingRate/v2/home` map + scanner state
 * (`S.market`, `S.signals`, `S.liq`, `S.cvd`, `S.whale`) + live HL `xyz` TradFi
 * snapshot + read-only MT5/desk overlay.
 */

export interface ScreenerCryptoRow {
  sym: string;
  name: string;
  kind: "crypto" | "metal";
  sector: CryptoSector;
  tier: "fast" | "slow";
  priceDecs: number;
  price: number | null;
  chg24hPct: number | null;
  vol24hUsd: number | null;
  vwap: number | null;
  vwapZ: number | null;
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
  deskBadge: { badge: string; tone: "pos" | "limit" | "suggested" } | null;
  warm: boolean;
  scanAgeS: number | null;
}

export interface ScreenerTradFiRow {
  sym: string;
  name: string;
  klass: string;
  broker: string | null;
  binPair: string | null;
  binLast: number | null;
  binChg24hPct: number | null;
  binVol24hUsd: number | null;
  hlCoin: string | null;
  mark: number | null;
  oracle: number | null;
  dislocationPct: number | null;
  vol24hUsd: number | null;
  oiNotionalUsd: number | null;
  fundingAprPct: number | null;
  thin: boolean;
  note: string | null;
}

export interface ScreenerPayload {
  ok: boolean;
  ts: number;
  warmCount: number;
  totalCount: number;
  crypto: ScreenerCryptoRow[];
  tradfi: ScreenerTradFiRow[];
  fapiOk: boolean;
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
  __screenerHl?: { at: number; map: Record<string, { dayNtlVlm?: string; funding?: string; markPx?: string; openInterest?: string; oraclePx?: string }> };
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

async function fetchHlTradFiCached() {
  const prev = g.__screenerHl;
  if (prev && Date.now() - prev.at < 12_000) return prev.map;
  try {
    const snap = await hlXyzSnapshot();
    g.__screenerHl = { at: Date.now(), map: snap };
    return snap;
  } catch {
    return prev?.map ?? {};
  }
}

function scoreConfluence(params: {
  ema4h: "bull" | "bear" | null;
  vwapZ: number | null;
  rsi1h: number | null;
  signal: ScreenerCryptoRow["signal"];
  cvdDiv: "bullish" | "bearish" | null;
  funding8hPct: number | null;
}): ScreenerCryptoRow["confluence"] | null {
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
  const [fapi, fundingMap, hlSnap] = await Promise.all([
    fetchFapi24hMap(),
    fetchFundingMap(),
    fetchHlTradFiCached(),
  ]);
  const deskIdx = getDeskIndex();
  const now = Date.now();

  let warmCount = 0;
  const crypto: ScreenerCryptoRow[] = ASSETS.map((a) => {
    const f = fapi.map.get(`${a.sym}USDT`);
    const mkt = getMarketSnapshot(a.sym);
    const sigSnap = getSignalsSnapshot(a.sym);
    const liq = getLiqSnapshot(a.sym);
    const cvd = getCvdSnapshot(a.sym);
    const whale = getWhaleSnapshot(a.sym);

    const fPrice = f ? Number(f.lastPrice) : NaN;
    const price = Number.isFinite(fPrice) && fPrice > 0 ? fPrice : mkt?.price.last ?? null;
    const chg24hPct = f ? Number(f.priceChangePercent) : mkt?.price.chgDayPct ?? null;
    const vol24hUsd = f ? Number(f.quoteVolume) : null;

    const vwap = mkt?.vwap.vwap ?? null;
    const sd1 = mkt?.vwap.bands.sd1 ?? null;
    const vwapZ = price != null && vwap != null && sd1 != null && sd1 > 0 ? Number(((price - vwap) / sd1).toFixed(2)) : null;

    const ema4h = mkt?.ema.h4?.e13 != null && mkt?.ema.h4?.e89 != null ? (mkt.ema.h4.e13 > mkt.ema.h4.e89 ? "bull" : "bear") : null;
    const ema1h = mkt?.ema.h1?.e13 != null && mkt?.ema.h1?.e89 != null ? (mkt.ema.h1.e13 > mkt.ema.h1.e89 ? "bull" : "bear") : null;

    let latestSig: ScreenerCryptoRow["signal"] = null;
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

    let liqMagnet: ScreenerCryptoRow["liqMagnet"] = null;
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
    const warm = Boolean(mkt || sigSnap);
    if (warm) warmCount++;
    const latestUpdate = Math.max(mkt?.updatedAt ?? 0, sigSnap?.updatedAt ?? 0, liq?.updatedAt ?? 0);

    return {
      sym: a.sym,
      name: a.name,
      kind: a.kind,
      sector: a.sector,
      tier: a.tier,
      priceDecs: a.priceDecs,
      price,
      chg24hPct: Number.isFinite(chg24hPct) ? Number(chg24hPct!.toFixed(2)) : null,
      vol24hUsd: Number.isFinite(vol24hUsd) ? vol24hUsd : null,
      vwap,
      vwapZ,
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
      deskBadge: deskIdx.get(a.sym) ?? null,
      warm,
      scanAgeS: latestUpdate > 0 ? Math.max(0, Math.round((now - latestUpdate) / 1000)) : null,
    };
  });

  const tradfi: ScreenerTradFiRow[] = TRADFI_CORE_ASSETS.map((a) => {
    const micro = MICRO_MAP[a.sym];
    const hlCoin = micro?.hl?.coin ?? null;
    const ctx = hlCoin ? hlSnap[hlCoin] : undefined;
    const candidatePair = a.klass === "index" ? null : (a.binPair ?? resolveBinPair(a.sym));
    const bf = candidatePair ? fapi.map.get(candidatePair) : undefined;
    const binPair = bf ? candidatePair : null;
    const binLastRaw = bf ? Number(bf.lastPrice) : NaN;
    const binChgRaw = bf ? Number(bf.priceChangePercent) : NaN;
    const binVolRaw = bf ? Number(bf.quoteVolume) : NaN;
    const binLast = Number.isFinite(binLastRaw) && binLastRaw > 0 ? binLastRaw : null;
    const binChg24hPct = Number.isFinite(binChgRaw) ? binChgRaw : null;
    const binVol24hUsd = Number.isFinite(binVolRaw) && binVolRaw > 0 ? Math.round(binVolRaw) : null;
    const mark = ctx?.markPx != null ? Number(ctx.markPx) : null;
    const oracle = ctx?.oraclePx != null ? Number(ctx.oraclePx) : null;
    const vol24hUsd = ctx?.dayNtlVlm != null ? Math.round(Number(ctx.dayNtlVlm)) : null;
    const oiBase = ctx?.openInterest != null ? Number(ctx.openInterest) : null;
    const oiNotionalUsd = mark != null && oiBase != null ? Math.round(mark * oiBase) : null;
    const funding1h = ctx?.funding != null ? Number(ctx.funding) * 100 : null;
    const fundingAprRaw = funding1h != null ? Number((funding1h * 8760).toFixed(2)) : null;
    const fundingAprPct = fundingAprRaw != null && Math.abs(fundingAprRaw) <= 500 ? fundingAprRaw : null;
    const dislocationPct = mark != null && oracle && oracle > 0 ? Number((((mark - oracle) / oracle) * 100).toFixed(3)) : null;
    const thin = (vol24hUsd != null && vol24hUsd < 5_000_000) && (binVol24hUsd == null || binVol24hUsd < 5_000_000);

    return {
      sym: a.sym,
      name: a.name,
      klass: a.klass,
      broker: a.broker,
      binPair,
      binLast,
      binChg24hPct,
      binVol24hUsd,
      hlCoin,
      mark: mark && Number.isFinite(mark) ? mark : null,
      oracle: oracle && Number.isFinite(oracle) ? oracle : null,
      dislocationPct,
      vol24hUsd,
      oiNotionalUsd,
      fundingAprPct,
      thin,
      note: a.note ?? null,
    };
  });

  return {
    ok: true,
    ts: now,
    warmCount,
    totalCount: crypto.length,
    crypto,
    tradfi,
    fapiOk: fapi.ok,
  };
}
