import { NextRequest, NextResponse } from "next/server";
import { cgGet } from "@/lib/cg/client";
import { anyTerminalSym, gateReject, knownSym } from "@/lib/cg/sym-gate";
import { resolveBinPair, resolveCgSym } from "@/lib/binance/aliases";
import { fapiFetch } from "@/lib/live/fapi";
import { CURATED_BY_SYM } from "@/lib/universe/curated";

export const dynamic = "force-dynamic";

/**
 * GET /api/cg/quant?sym=BTC
 *
 * "Quant Positioning" aggregate — every number comes from a real upstream
 * payload, never synthesized:
 *
 *   a) Long/short ratios  : Binance USDT-M /futures/data/* (global accounts,
 *      top-trader accounts, top-trader positions, taker buy/sell flow) for
 *      15m / 1h / 4h. Works for crypto AND the TradFi plain-name perps
 *      (NVDAUSDT & friends are all USDT-M contracts — verified live).
 *   b) OI-weighted funding + cross-venue arb: Coinglass
 *      /api/fundingRate/v2/home (per-venue rate/interval, rate is PERCENT
 *      per interval — verified against /fapi/v1/premiumIndex) weighted by
 *      per-venue USD OI from /api/openInterest/v3/chart dataMap.
 *   c) OI x price 4-quadrant map from the same OI chart (hourly dateList /
 *      priceList / per-venue OI series) at now-1h/4h/24h.
 *   d) Spot-perp basis (Binance spot vs perp last price) and the
 *      BTC/ETH/SOL Coinbase USD premium.
 *
 * Freshness telemetry reports the OLDEST contributing payload timestamp;
 * Coinglass payloads carry no data timestamp, so those are stamped with the
 * moment WE received them (never later than truth) via the local TTL cache.
 */

// ───────────────────────── local TTL cache + coalescing ─────────────────────

interface FetchPayload<T> {
  data: T;
  /** epoch ms of the data inside this payload (row timestamp, closeTime, …) */
  dataAt: number;
}

interface CacheEntry {
  at: number;
  dataAt: number;
  data: unknown;
}

const g = globalThis as unknown as {
  __quantRouteCache?: Map<string, CacheEntry>;
  __quantRouteInflight?: Map<string, Promise<FetchPayload<unknown> | null>>;
};
const cache = (g.__quantRouteCache ??= new Map());
const inflight = (g.__quantRouteInflight ??= new Map());

async function cachedUpstream<T>(
  key: string,
  ttlMs: number,
  fetcher: () => Promise<FetchPayload<T>>
): Promise<FetchPayload<T> | null> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < ttlMs) {
    return { data: hit.data as T, dataAt: hit.dataAt };
  }
  const running = inflight.get(key);
  if (running) return (await running) as FetchPayload<T> | null;
  const p = (async (): Promise<FetchPayload<unknown> | null> => {
    try {
      const r = await fetcher();
      if (cache.size > 128) {
        const oldest = cache.keys().next().value;
        if (oldest) cache.delete(oldest);
      }
      cache.set(key, { at: Date.now(), dataAt: r.dataAt, data: r.data });
      return r as FetchPayload<unknown>;
    } catch {
      return null; // never cache failures — next request retries honestly
    } finally {
      inflight.delete(key);
    }
  })();
  inflight.set(key, p);
  return p as unknown as FetchPayload<T> | null;
}

// ───────────────────────────── upstream shapes ──────────────────────────────

/** /futures/data/* rows — numbers arrive as strings, ascending by timestamp. */
interface LsRow {
  longShortRatio?: string;
  longAccount?: string;
  shortAccount?: string;
  buySellRatio?: string;
  buyVol?: string;
  sellVol?: string;
  timestamp?: number;
}

interface Ticker24h {
  lastPrice?: string;
  quoteVolume?: string;
  closeTime?: number;
}

interface CgFundingVenueRaw {
  exchangeName?: string;
  /** percent per the venue's funding interval (e.g. 0.005366 = 0.005366%/8h) */
  rate?: number;
  fundingIntervalHours?: number;
  nextFundingTime?: number;
  status?: number;
}

interface CgFundingHomeItem {
  symbol?: string;
  uMarginList?: CgFundingVenueRaw[];
}

interface CgOiChart {
  dataMap?: Record<string, number[]>;
  dateList?: number[];
  priceList?: number[];
}

// ───────────────────────────── response types ───────────────────────────────

interface LsMetric {
  ratio: number;
  longPct: number | null;
  shortPct: number | null;
  chgPct: number | null;
}

interface TakerMetric {
  buySellRatio: number;
  buyVolUsd: number | null;
  sellVolUsd: number | null;
}

interface LsPeriod {
  global: LsMetric | null;
  topAccounts: LsMetric | null;
  topPositions: LsMetric | null;
  taker: TakerMetric | null;
}

type Quadrant = "NEW_LONGS" | "SHORT_COVERING" | "NEW_SHORTS" | "LONG_LIQUIDATION";

interface QuadrantSlot {
  quadrant: Quadrant;
  oiDeltaPct: number;
  priceDeltaPct: number;
}

interface FundingVenueOut {
  name: string;
  rate: number;
  rate8h: number;
  nextFundingTime: number | null;
  fundingIntervalHours: number;
}

interface FundingSection {
  venues: FundingVenueOut[];
  oiWeightedRate8h: number | null;
  annualizedAprPct: number | null;
  fundingSpreadBps: number | null;
  spreadVenues: [string, string] | null;
  reason?: string;
}

interface OiQuadrantSection {
  "1h": QuadrantSlot | null;
  "4h": QuadrantSlot | null;
  "24h": QuadrantSlot | null;
  oiToVolRatio: number | null;
  reason?: string;
}

interface BasisSection {
  spotPair: string | null;
  spotPrice: number | null;
  perpPrice: number | null;
  basisPct: number | null;
  fundingImpliedAprPct: number | null;
  coinbasePremiumBps: number | null;
  reason?: string;
  coinbaseReason?: string;
}

interface Telemetry {
  dataAt: number | null;
  ageMs: number | null;
  stale: boolean;
  source: string;
}

const COINBASE_SYMS = new Set(["BTC", "ETH", "SOL"]);
const PERIODS = ["15m", "1h", "4h"] as const;
type PeriodKey = (typeof PERIODS)[number];
const PERIOD_MS: Record<string, number> = { "15m": 900_000, "1h": 3_600_000, "4h": 14_400_000 };
const LS_ENDPOINTS = {
  global: "globalLongShortAccountRatio",
  topAccounts: "topLongShortAccountRatio",
  topPositions: "topLongShortPositionRatio",
  taker: "takerlongshortRatio",
} as const;
type LsKey = keyof typeof LS_ENDPOINTS;

function telemetryOf(stamps: number[], source: string): Telemetry {
  const dataAt = stamps.length > 0 ? Math.min(...stamps) : null;
  const ageMs = dataAt != null ? Date.now() - dataAt : null;
  return { dataAt, ageMs, stale: ageMs != null ? ageMs > 60_000 : false, source };
}

function classifyQuadrant(oiUp: boolean, pxUp: boolean): Quadrant {
  if (oiUp && pxUp) return "NEW_LONGS";
  if (!oiUp && pxUp) return "SHORT_COVERING";
  if (oiUp && !pxUp) return "NEW_SHORTS";
  return "LONG_LIQUIDATION";
}

function toLsMetric(rows: LsRow[] | undefined | null): LsMetric | null {
  if (!rows || rows.length === 0) return null;
  const sorted = [...rows].sort((a, b) => Number(a.timestamp ?? 0) - Number(b.timestamp ?? 0));
  const last = sorted[sorted.length - 1];
  const ratio = Number(last?.longShortRatio);
  if (!Number.isFinite(ratio) || ratio <= 0) return null;
  const long = Number(last?.longAccount);
  const short = Number(last?.shortAccount);
  let chgPct: number | null = null;
  if (sorted.length >= 2) {
    const prev = Number(sorted[sorted.length - 2]?.longShortRatio);
    if (Number.isFinite(prev) && prev > 0) {
      chgPct = Number((((ratio - prev) / prev) * 100).toFixed(2));
    }
  }
  return {
    ratio: Number(ratio.toFixed(4)),
    longPct: Number.isFinite(long) ? Number((long * 100).toFixed(2)) : null,
    shortPct: Number.isFinite(short) ? Number((short * 100).toFixed(2)) : null,
    chgPct,
  };
}

function toTakerMetric(rows: LsRow[] | undefined | null, perpPrice: number | null): TakerMetric | null {
  if (!rows || rows.length === 0) return null;
  const sorted = [...rows].sort((a, b) => Number(a.timestamp ?? 0) - Number(b.timestamp ?? 0));
  const last = sorted[sorted.length - 1];
  const bsr = Number(last?.buySellRatio);
  if (!Number.isFinite(bsr) || bsr <= 0) return null;
  const buyVol = Number(last?.buyVol);
  const sellVol = Number(last?.sellVol);
  return {
    buySellRatio: Number(bsr.toFixed(4)),
    buyVolUsd:
      Number.isFinite(buyVol) && perpPrice != null && perpPrice > 0
        ? Math.round(buyVol * perpPrice)
        : null,
    sellVolUsd:
      Number.isFinite(sellVol) && perpPrice != null && perpPrice > 0
        ? Math.round(sellVol * perpPrice)
        : null,
  };
}

// ─────────────────────────────────── route ──────────────────────────────────

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const sym = (sp.get("sym") ?? "BTC").trim().toUpperCase();

  if (!(await anyTerminalSym(sym))) {
    return NextResponse.json({ ok: false, error: gateReject(sym) }, { status: 400 });
  }
  if (!(await knownSym(sym))) {
    // classic instruments (SPX500 / NDX100 / UKO) — honest no-perp answer
    return NextResponse.json({
      ok: true,
      supported: false,
      sym,
      reason: `classic instrument ${sym} has no perpetual positioning data`,
      ...telemetryOf([], "none"),
    });
  }

  try {
    const cgSym = resolveCgSym(sym);
    const pair = resolveBinPair(sym);
    const notes: string[] = [];

    // ── kick off every upstream concurrently (all failures resolve null) ──

    const lsPayloads = new Map<string, Promise<FetchPayload<LsRow[]> | null>>();
    for (const [metric, endpoint] of Object.entries(LS_ENDPOINTS) as [LsKey, string][]) {
      for (const period of PERIODS) {
        lsPayloads.set(
          `${metric}:${period}`,
          cachedUpstream<LsRow[]>(`quant:ls:${endpoint}:${pair}:${period}`, 30_000, async () => {
            const rows = (await fapiFetch(
              `/futures/data/${endpoint}?symbol=${encodeURIComponent(pair)}&period=${period}&limit=2`,
              6_000
            )) as LsRow[];
            if (!Array.isArray(rows) || rows.length === 0) throw new Error(`empty ${endpoint}`);
            // Rows are stamped at bucket START (the 4h taker row stamped 04:00
            // covers 04:00-08:00), so the data-as-of is the bucket END —
            // clamped to now for the still-forming bucket. This never claims
            // fresher than the data's own clock and never calls a just-closed
            // bucket "4h stale" either.
            const lastTs = Number(rows[rows.length - 1]?.timestamp ?? 0);
            const windowEnd = lastTs > 0 ? lastTs + (PERIOD_MS[period] ?? 0) : Date.now();
            return { data: rows, dataAt: Math.min(windowEnd, Date.now()) };
          })
        );
      }
    }

    const tickerP = cachedUpstream<Ticker24h>(`quant:ticker24h:${pair}`, 30_000, async () => {
      const t0 = Date.now();
      const t = (await fapiFetch(
        `/fapi/v1/ticker/24hr?symbol=${encodeURIComponent(pair)}`,
        6_000
      )) as Ticker24h;
      const closeTime = Number(t?.closeTime ?? 0);
      return { data: t, dataAt: closeTime > 0 ? closeTime : t0 };
    });

    // Coinglass payloads carry no data timestamp — fetch them UNCACHED from
    // cgGet (ttl 0) and stamp dataAt with the moment WE received them, so the
    // local TTL cache below keeps telemetry honest instead of cgGet's opaque
    // internal cache.
    const fundingHomeP = cachedUpstream<CgFundingHomeItem[]>(
      "quant:cg:funding-home",
      30_000,
      async () => {
        const t0 = Date.now();
        const home = (await cgGet("/api/fundingRate/v2/home", 0)) as CgFundingHomeItem[] | null;
        if (!Array.isArray(home)) throw new Error("funding home is not an array");
        return { data: home, dataAt: t0 };
      }
    );

    const oiChartP = cachedUpstream<CgOiChart>(`quant:cg:oi-chart:${cgSym}`, 30_000, async () => {
      const raw = (await cgGet(
        `/api/openInterest/v3/chart?symbol=${encodeURIComponent(cgSym)}&type=0&timeType=2`,
        0
      )) as CgOiChart | null;
      const dl = Array.isArray(raw?.dateList) ? (raw?.dateList as number[]) : [];
      if (dl.length === 0) throw new Error("oi chart empty");
      const last = dl[dl.length - 1] ?? 0;
      return { data: raw as CgOiChart, dataAt: last > 0 ? last : Date.now() };
    });

    // Spot leg: curated TradFi uses the pinned B-token (NVDABUSDT / XAUTUSDT);
    // crypto uses the perp pair itself; TradFi without a spot leg is honestly null.
    const curated = CURATED_BY_SYM.get(cgSym);
    let spotPair: string | null = null;
    let spotReason: string | undefined;
    if (curated?.spotPair) {
      spotPair = curated.spotPair;
    } else if (curated?.kind === "tradfi-perp") {
      spotReason = `no Binance spot pair listed for ${cgSym}`;
    } else {
      spotPair = pair;
    }

    const spotP: Promise<FetchPayload<{ price: number }> | null> = spotPair
      ? cachedUpstream<{ price: number }>(`quant:spot:${spotPair}`, 30_000, async () => {
          const t0 = Date.now();
          const res = await fetch(
            `https://api.binance.com/api/v3/ticker/price?symbol=${encodeURIComponent(spotPair as string)}`,
            { cache: "no-store", signal: AbortSignal.timeout(5_000), headers: { accept: "application/json" } }
          );
          if (!res.ok) throw new Error(`spot HTTP ${res.status}`);
          const j = (await res.json().catch(() => null)) as { price?: string } | null;
          const px = Number(j?.price);
          if (!Number.isFinite(px) || px <= 0) throw new Error("spot price invalid");
          return { data: { price: px }, dataAt: t0 };
        })
      : Promise.resolve(null);

    const coinbaseP: Promise<FetchPayload<{ price: number }> | null> = COINBASE_SYMS.has(cgSym)
      ? cachedUpstream<{ price: number }>(`quant:coinbase:${cgSym}`, 30_000, async () => {
          const t0 = Date.now();
          const res = await fetch(
            `https://api.exchange.coinbase.com/products/${cgSym}-USD/ticker`,
            {
              cache: "no-store",
              signal: AbortSignal.timeout(5_000),
              headers: { accept: "application/json", "user-agent": "Mozilla/5.0" },
            }
          );
          if (!res.ok) throw new Error(`coinbase HTTP ${res.status}`);
          const j = (await res.json().catch(() => null)) as { price?: string; time?: string } | null;
          const px = Number(j?.price);
          if (!Number.isFinite(px) || px <= 0) throw new Error("coinbase price invalid");
          const tradeT = j?.time ? Date.parse(j.time) : NaN;
          return { data: { price: px }, dataAt: Number.isFinite(tradeT) ? tradeT : t0 };
        })
      : Promise.resolve(null);

    // ── await everything, then assemble ──

    const [ticker, fundingHome, oiChart, spot, coinbase] = await Promise.all([
      tickerP,
      fundingHomeP,
      oiChartP,
      spotP,
      coinbaseP,
    ]);
    const ls: Record<string, FetchPayload<LsRow[]> | null> = {};
    for (const key of [...lsPayloads.keys()]) {
      ls[key] = await (lsPayloads.get(key) as Promise<FetchPayload<LsRow[]> | null>);
    }

    const perpPrice = (() => {
      const p = Number(ticker?.data?.lastPrice);
      return Number.isFinite(p) && p > 0 ? p : null;
    })();

    // (a) Long/short ratios -------------------------------------------------

    const lsRatios: Record<PeriodKey, LsPeriod> = {
      "15m": { global: null, topAccounts: null, topPositions: null, taker: null },
      "1h": { global: null, topAccounts: null, topPositions: null, taker: null },
      "4h": { global: null, topAccounts: null, topPositions: null, taker: null },
    };
    for (const period of PERIODS) {
      const p = lsRatios[period];
      p.global = toLsMetric(ls[`global:${period}`]?.data);
      p.topAccounts = toLsMetric(ls[`topAccounts:${period}`]?.data);
      p.topPositions = toLsMetric(ls[`topPositions:${period}`]?.data);
      p.taker = toTakerMetric(ls[`taker:${period}`]?.data, perpPrice);
    }
    if (Object.values(ls).every((x) => !x)) {
      notes.push("lsRatios: all Binance /futures/data endpoints failed for this pair");
    }
    notes.push(
      "taker buyVolUsd/sellVolUsd = Binance base-asset taker volume converted at the perp last price"
    );

    // (b) OI-weighted funding + cross-venue arb ------------------------------

    // per-venue latest USD OI from the chart dataMap (keys: "Binance","OKX",…)
    const oiByName = new Map<string, number>();
    if (oiChart) {
      for (const [name, vals] of Object.entries(oiChart.data.dataMap ?? {})) {
        if (!Array.isArray(vals)) continue;
        for (let i = vals.length - 1; i >= 0; i--) {
          const v = vals[i];
          if (typeof v === "number" && Number.isFinite(v) && v > 0) {
            oiByName.set(name.toLowerCase(), v);
            break;
          }
        }
      }
    }

    const funding: FundingSection = {
      venues: [],
      oiWeightedRate8h: null,
      annualizedAprPct: null,
      fundingSpreadBps: null,
      spreadVenues: null,
    };
    if (fundingHome) {
      const item = fundingHome.data.find((x) => x.symbol?.toUpperCase() === cgSym);
      const rawList = Array.isArray(item?.uMarginList) ? (item?.uMarginList ?? []) : [];
      const venueRows = rawList
        .filter((r) => r && r.exchangeName && typeof r.rate === "number" && Number.isFinite(r.rate))
        .filter((r) => (r.status ?? 1) === 1)
        .map((r) => {
          const interval =
            typeof r.fundingIntervalHours === "number" && (r.fundingIntervalHours as number) > 0
              ? (r.fundingIntervalHours as number)
              : 8;
          return {
            name: r.exchangeName as string,
            rate: r.rate as number,
            rate8h: Number(((r.rate as number) * (8 / interval)).toFixed(8)),
            interval,
            nextFundingTime: typeof r.nextFundingTime === "number" ? r.nextFundingTime : null,
            oi: oiByName.get((r.exchangeName as string).toLowerCase()) ?? null,
          };
        });

      if (venueRows.length > 0) {
        const ois = venueRows.map((v) => v.oi).filter((v): v is number => v != null && v > 0);
        if (ois.length > 0) {
          const meanOi = ois.reduce((a, b) => a + b, 0) / ois.length;
          let num = 0;
          let den = 0;
          for (const v of venueRows) {
            const w = v.oi ?? meanOi;
            num += v.rate8h * w;
            den += w;
          }
          if (den > 0) funding.oiWeightedRate8h = Number((num / den).toFixed(8));
          if (ois.length < venueRows.length) {
            notes.push(
              "funding: venues missing from the OI chart were weighted at the mean OI of matched venues"
            );
          }
        } else {
          funding.oiWeightedRate8h = Number(
            (venueRows.reduce((a, b) => a + b.rate8h, 0) / venueRows.length).toFixed(8)
          );
          notes.push("funding: no per-venue OI available — oiWeightedRate8h is the equal-weight mean");
        }
        if (funding.oiWeightedRate8h != null) {
          funding.annualizedAprPct = Number((funding.oiWeightedRate8h * 3 * 365).toFixed(4));
        }
        if (venueRows.length >= 2) {
          let maxV = venueRows[0];
          let minV = venueRows[0];
          for (const v of venueRows) {
            if (v.rate8h > maxV.rate8h) maxV = v;
            if (v.rate8h < minV.rate8h) minV = v;
          }
          funding.fundingSpreadBps = Number(((maxV.rate8h - minV.rate8h) * 100).toFixed(2));
          funding.spreadVenues = [maxV.name, minV.name];
        }
        funding.venues = venueRows.map((v) => ({
          name: v.name,
          rate: Number(v.rate.toFixed(8)),
          rate8h: v.rate8h,
          nextFundingTime: v.nextFundingTime,
          fundingIntervalHours: v.interval,
        }));
      } else {
        funding.reason = "coinglass fundingRate home has no live venue for this symbol";
      }
    } else {
      funding.reason = "coinglass fundingRate home unavailable";
    }
    notes.push(
      "funding rates are percent per interval; annualizedAprPct = oiWeightedRate8h(%) x 3 x 365"
    );

    // (c) OI x price 4-quadrant ----------------------------------------------

    const oiQuadrant: OiQuadrantSection = {
      "1h": null,
      "4h": null,
      "24h": null,
      oiToVolRatio: null,
    };
    let latestTotalOi: number | null = null;
    if (oiChart) {
      const dl = oiChart.data.dateList ?? [];
      const pl = oiChart.data.priceList ?? [];
      const venueSeries = Object.values(oiChart.data.dataMap ?? {}).filter(
        (v): v is number[] => Array.isArray(v)
      );
      const n = dl.length;
      if (n >= 2 && venueSeries.length > 0) {
        const latestIdx = n - 1;
        const latestTs = dl[latestIdx] ?? 0;
        const totalOiAt = (idx: number): number => {
          let s = 0;
          for (const vals of venueSeries) {
            const v = vals[idx];
            if (typeof v === "number" && Number.isFinite(v)) s += v;
          }
          return s;
        };
        const idxNearest = (target: number): number => {
          let best = 0;
          let bestAbs = Infinity;
          for (let i = 0; i < n; i++) {
            const d = Math.abs((dl[i] ?? 0) - target);
            if (d < bestAbs) {
              bestAbs = d;
              best = i;
            }
          }
          return best;
        };
        const nowOi = totalOiAt(latestIdx);
        const nowPx = typeof pl[latestIdx] === "number" ? (pl[latestIdx] as number) : null;
        latestTotalOi = nowOi > 0 ? nowOi : null;

        for (const [slot, agoMs] of [
          ["1h", 3_600_000],
          ["4h", 14_400_000],
          ["24h", 86_400_000],
        ] as const) {
          const idx = idxNearest(latestTs - agoMs);
          const baseOi = totalOiAt(idx);
          const basePx = typeof pl[idx] === "number" ? (pl[idx] as number) : null;
          const oiDelta =
            baseOi > 0 && nowOi > 0 ? ((nowOi - baseOi) / baseOi) * 100 : null;
          const pxDelta =
            basePx != null && basePx > 0 && nowPx != null && nowPx > 0
              ? ((nowPx - basePx) / basePx) * 100
              : null;
          if (oiDelta == null || pxDelta == null) continue;
          oiQuadrant[slot] = {
            quadrant: classifyQuadrant(oiDelta > 0, pxDelta > 0),
            oiDeltaPct: Number(oiDelta.toFixed(2)),
            priceDeltaPct: Number(pxDelta.toFixed(2)),
          };
        }
      }
      const qv = Number(ticker?.data?.quoteVolume);
      if (latestTotalOi != null && Number.isFinite(qv) && qv > 0) {
        oiQuadrant.oiToVolRatio = Number((latestTotalOi / qv).toFixed(3));
      }
    } else {
      oiQuadrant.reason = "coinglass open-interest chart unavailable";
    }

    // (d) Spot-perp basis + Coinbase premium ----------------------------------

    const basis: BasisSection = {
      spotPair,
      spotPrice: null,
      perpPrice: null,
      basisPct: null,
      fundingImpliedAprPct: null,
      coinbasePremiumBps: null,
    };
    if (perpPrice != null) basis.perpPrice = perpPrice;
    if (spotReason) {
      basis.reason = spotReason;
    } else if (spot) {
      basis.spotPrice = spot.data.price;
      if (perpPrice != null) {
        basis.basisPct = Number((((perpPrice - spot.data.price) / spot.data.price) * 100).toFixed(4));
      }
    } else if (spotPair) {
      basis.reason = `Binance spot ${spotPair} unavailable`;
    }
    basis.fundingImpliedAprPct = funding.annualizedAprPct;
    if (!COINBASE_SYMS.has(cgSym)) {
      basis.coinbaseReason = "Coinbase premium tracked for BTC/ETH/SOL only";
    } else if (coinbase && spot) {
      basis.coinbasePremiumBps = Number(
        (((spot.data.price - coinbase.data.price) / coinbase.data.price) * 10_000).toFixed(2)
      );
    } else {
      basis.coinbaseReason = coinbase
        ? "Binance spot price unavailable"
        : "Coinbase ticker unavailable";
    }
    notes.push(
      "fundingImpliedAprPct is the funding-implied carry (oiWeightedRate8h annualized) — NOT a basis APR"
    );

    // ── freshness telemetry: oldest contributing payload ──

    const stamps: number[] = [];
    for (const p of Object.values(ls)) if (p) stamps.push(p.dataAt);
    if (ticker) stamps.push(ticker.dataAt);
    if (fundingHome) stamps.push(fundingHome.dataAt);
    if (oiChart) stamps.push(oiChart.dataAt);
    if (spot) stamps.push(spot.dataAt);
    if (coinbase) stamps.push(coinbase.dataAt);

    const srcParts: string[] = [];
    if (Object.values(ls).some((x) => x)) srcParts.push("binance-fapi/ls-ratios");
    if (ticker) srcParts.push("binance-fapi/ticker24h");
    if (fundingHome) srcParts.push("coinglass/funding-home");
    if (oiChart) srcParts.push("coinglass/oi-chart");
    if (spot) srcParts.push("binance-spot");
    if (coinbase) srcParts.push("coinbase");

    return NextResponse.json({
      ok: true,
      supported: true,
      sym,
      cgSym,
      pair,
      lsRatios,
      funding,
      oiQuadrant,
      basis,
      notes,
      ...telemetryOf(stamps, srcParts.length > 0 ? srcParts.join("+") : "none"),
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "quant positioning fetch failed" },
      { status: 502 }
    );
  }
}
