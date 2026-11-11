"use client";

/**
 * Browser-direct Binance fapi fallbacks (CORS is open:
 * access-control-allow-origin: *).
 *
 * The Binance tier's server routes (universe / klines / market) run on the
 * terminal host's egress IP — a cloud sandbox IP can carry recurring fapi
 * weight bans (418) that have nothing to do with the user. These helpers
 * fetch the SAME public endpoints straight from the browser (the user's own
 * IP — the one already holding the fstream WebSockets), so a banned host
 * degrades to "browser-direct" instead of "error".
 *
 * Ladder: server route (cached, shared) → these direct calls → honest "–".
 * Every helper returns null on any failure — callers never fake data.
 */

export interface DirectMarket {
  ticker?: { last: number; chgPct: number; high: number; low: number; quoteVol: number; vwap: number; nTrades: number };
  mark?: { markPrice: number; indexPrice: number; fundingRatePct: number; nextFundingMs: number };
  oi?: { contracts: number; usd: number | null };
}

const FAPI = "https://fapi.binance.com";

async function jget(path: string, timeoutMs = 6_000): Promise<unknown | null> {
  try {
    const res = await fetch(`${FAPI}${path}`, { cache: "no-store", signal: AbortSignal.timeout(timeoutMs) });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/** The /api/binance/market payload, fetched browser-side. */
export async function fetchMarketDirect(pair: string): Promise<DirectMarket | null> {
  const [t24, prem, oi] = await Promise.all([
    jget(`/fapi/v1/ticker/24hr?symbol=${pair}`),
    jget(`/fapi/v1/premiumIndex?symbol=${pair}`),
    jget(`/fapi/v1/openInterest?symbol=${pair}`),
  ]);
  const out: DirectMarket = {};
  if (t24 && typeof t24 === "object" && "lastPrice" in t24) {
    const d = t24 as Record<string, string>;
    const last = Number(d.lastPrice);
    if (last > 0) {
      out.ticker = {
        last,
        chgPct: Number(d.priceChangePercent) || 0,
        high: Number(d.highPrice) || 0,
        low: Number(d.lowPrice) || 0,
        quoteVol: Number(d.quoteVolume) || 0,
        vwap: Number(d.weightedAvgPrice) || 0,
        nTrades: Number(d.count) || 0,
      };
    }
  }
  if (prem && typeof prem === "object" && "markPrice" in prem) {
    const d = prem as Record<string, string>;
    const mp = Number(d.markPrice);
    if (mp > 0) {
      out.mark = {
        markPrice: mp,
        indexPrice: Number(d.indexPrice) || 0,
        fundingRatePct: (Number(d.lastFundingRate) || 0) * 100,
        nextFundingMs: Number(d.nextFundingTime) || 0,
      };
    }
  }
  if (oi && typeof oi === "object" && "openInterest" in oi) {
    const contracts = Number((oi as Record<string, string>).openInterest);
    if (Number.isFinite(contracts)) {
      const last = out.ticker?.last ?? out.mark?.markPrice ?? 0;
      out.oi = { contracts, usd: last > 0 ? contracts * last : null };
    }
  }
  return Object.keys(out).length ? out : null;
}

/** Kline rows [openTime, o, h, l, c, v, closeTime], fetched browser-side. */
export async function fetchKlinesDirect(
  pair: string,
  interval: string,
  limit: number
): Promise<[number, number, number, number, number, number, number][] | null> {
  const raw = (await jget(`/fapi/v1/klines?symbol=${pair}&interval=${interval}&limit=${limit}`, 10_000)) as
    | (string | number)[][]
    | null;
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const rows = raw
    .map(
      (r): [number, number, number, number, number, number, number] => [
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
  return rows.length ? rows : null;
}

/** Coarse decimal count from a live price (universe-fallback only — the
 *  authoritative tick/step precision comes from the server's exchangeInfo
 *  registry and is used for order rounding). */
function decsHeuristic(p: number): number {
  const a = Math.abs(p);
  if (a >= 1000) return 1;
  if (a >= 100) return 2;
  if (a >= 1) return 3;
  if (a >= 0.01) return 5;
  return 7;
}

export interface DirectUniverseAsset {
  sym: string;
  pair: string;
  rank: number;
  quoteVol24h: number;
  priceDecs: number;
  qtyDecs: number;
}

/**
 * Universe fallback, browser-side: one /fapi/v1/ticker/24hr call (all
 * symbols). Perpetual filter approximates the server's exchangeInfo gate
 * (USDT quote, no "_" delivery contracts); re-ranked by quote volume.
 */
export async function fetchUniverseDirect(n: number): Promise<DirectUniverseAsset[] | null> {
  const all = (await jget("/fapi/v1/ticker/24hr", 15_000)) as { symbol?: string; quoteVolume?: string; lastPrice?: string }[] | null;
  if (!Array.isArray(all) || all.length === 0) return null;
  const rows = all
    .filter((t) => typeof t.symbol === "string" && t.symbol.endsWith("USDT") && !t.symbol.includes("_"))
    .map((t) => ({ pair: t.symbol as string, vol: Number(t.quoteVolume) || 0, last: Number(t.lastPrice) || 0 }))
    .sort((a, b) => b.vol - a.vol)
    .slice(0, n);
  if (rows.length === 0) return null;
  return rows.map((r, i) => ({
    sym: r.pair.replace(/USDT$/, ""),
    pair: r.pair,
    rank: i + 1,
    quoteVol24h: r.vol,
    priceDecs: decsHeuristic(r.last),
    qtyDecs: 3,
  }));
}
