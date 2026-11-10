import { cgGet } from "../cg/client";
import { assetOf, leadInstr } from "../cg/assets";
import { fapiFetch } from "./fapi";

/**
 * Server-side LIVE price — the shared anchor for every server lane.
 *
 * Same tier ladder as /api/cg/live: Binance USDT-M futures bookTicker
 * (250 ms shared TTL, weight 2) with a Coinglass forming-m1-close fallback.
 * The scanner (liq clusters, whale walls) MUST anchor side/distance math to
 * THIS price — never to a candle series embedded in an upstream payload
 * (Coinglass's liquidationLevels embedded candles can lag the live market
 * by minutes, which misassigned cluster sides and fired false
 * "approaching cluster" alerts).
 */

export interface LivePrice {
  sym: string;
  price: number | null;
  bid: number | null;
  ask: number | null;
  source: "binance-fapi" | "coinglass";
  at: number;
  err?: string;
  fapiErr?: string;
}

export const TTL = Math.max(150, Number(process.env.CG_LIVE_TTL_MS ?? 250) || 250);

const g = globalThis as unknown as { __cgLivePrice?: Map<string, LivePrice> };
const cache = (g.__cgLivePrice ??= new Map<string, LivePrice>());

async function refresh(sym: string): Promise<LivePrice> {
  const base: LivePrice = { at: Date.now(), sym, source: "binance-fapi", price: null, bid: null, ask: null };
  try {
    const d = (await fapiFetch(`/fapi/v1/ticker/bookTicker?symbol=${sym}USDT`, 4_000)) as {
      bidPrice?: string;
      askPrice?: string;
    };
    const bid = Number(d.bidPrice);
    const ask = Number(d.askPrice);
    if (Number.isFinite(bid) && Number.isFinite(ask) && bid > 0 && ask > 0) {
      const e: LivePrice = { ...base, bid, ask, price: +(((bid + ask) / 2).toFixed(assetOf(sym)?.priceDecs ?? 2)) };
      cache.set(sym, e);
      return e;
    }
    throw new Error("fapi bad payload");
  } catch (err) {
    const why = err instanceof Error ? err.message : "fetch failed";
    return refreshViaCoinglass(sym, base, why);
  }
}

async function refreshViaCoinglass(sym: string, base: LivePrice, why: string): Promise<LivePrice> {
  try {
    const r = (await cgGet(
      `/api/v2/kline?symbol=${encodeURIComponent(`${leadInstr(sym)}#kline`)}&interval=m1&limit=2&minLimit=false`,
      2_000
    )) as { data?: [number, string | number, ...unknown[]][] } | [number, string | number, ...unknown[]][];
    const rows = Array.isArray(r) ? r : (r.data ?? []);
    const last = rows[rows.length - 1];
    const close = Number(last?.[4]);
    const open = Number(last?.[1]);
    const use = Number.isFinite(close) ? close : Number.isFinite(open) ? open : null;
    const e: LivePrice = { ...base, source: "coinglass", price: use, bid: null, ask: null };
    cache.set(sym, e);
    return e;
  } catch (err2) {
    const e: LivePrice = { ...base, err: `${why}; cg: ${err2 instanceof Error ? err2.message : "fetch failed"}` };
    cache.set(sym, e);
    return e;
  }
}

/** Cached-or-fresh live price for a terminal asset (null price = unavailable). */
export async function getLivePrice(sym: string): Promise<LivePrice> {
  const s = sym.toUpperCase();
  let e = cache.get(s);
  const now = Date.now();
  if (!e || now - e.at >= TTL || (e.price == null && !e.err)) {
    e = await refresh(s);
  }
  return e;
}
