import { NextRequest, NextResponse } from "next/server";
import { cgGet } from "@/lib/cg/client";
import { assetOf, isAsset } from "@/lib/cg/assets";
import { fapiFetch } from "@/lib/live/fapi";

export const dynamic = "force-dynamic";

/**
 * GET /api/cg/live?sym=BTC — fast-fallback REST price.
 *
 * Primary live price is the browser WebSocket (fstream.binance.com
 * bookTicker, real-time). This route is tier 1 of the ladder for clients
 * whose browser cannot hold the WS (geo-block, strict proxies): the SERVER
 * polls Binance USDT-M futures bookTicker — the exact instrument
 * (Binance_<SYM>USDT perp) that leads every Coinglass aggregate in this
 * terminal — with a 250 ms shared TTL, so every tab/agent sees the same
 * sub-second price without hammering upstream (weight 2 per refresh).
 *
 * Tier 2 fallback: Coinglass m1 forming-candle close (the old /api/cg/ticker
 * source). The response always names its source — no silent mixing.
 */

const TTL = Math.max(150, Number(process.env.CG_LIVE_TTL_MS ?? 250) || 250);

interface Entry {
  at: number;
  sym: string;
  source: "binance-fapi" | "coinglass";
  price: number | null;
  bid: number | null;
  ask: number | null;
  err?: string;
  fapiErr?: string; // why tier-1 failed (diagnostics — served with the fallback)
}

const g = globalThis as unknown as { __cgLive?: Map<string, Entry> };
const cache = (g.__cgLive ??= new Map<string, Entry>());

async function refresh(sym: string): Promise<Entry> {
  const base: Entry = { at: Date.now(), sym, source: "binance-fapi", price: null, bid: null, ask: null };
  try {
    const d = (await fapiFetch(`/fapi/v1/ticker/bookTicker?symbol=${sym}USDT`, 4_000)) as {
      bidPrice?: string;
      askPrice?: string;
    };
    const bid = Number(d.bidPrice);
    const ask = Number(d.askPrice);
    if (Number.isFinite(bid) && Number.isFinite(ask) && bid > 0 && ask > 0) {
      const e: Entry = { ...base, bid, ask, price: +(((bid + ask) / 2).toFixed(assetOf(sym)?.priceDecs ?? 2)) };
      cache.set(sym, e);
      return e;
    }
    throw new Error("fapi bad payload");
  } catch (err) {
    const why = err instanceof Error ? err.message : "fetch failed";
    const e2 = await refreshViaCoinglass(sym, base, why);
    return { ...e2, fapiErr: why };
  }
}

async function refreshViaCoinglass(sym: string, base: Entry, why: string): Promise<Entry> {
  // tier 2: Coinglass forming m1 close (same source the charts use)
  try {
    const r = (await cgGet(
      `/api/v2/kline?symbol=${encodeURIComponent(`Binance_${sym}USDT#kline`)}&interval=m1&limit=2&minLimit=false`,
      2_000
    )) as { data?: [number, string | number, ...unknown[]][] } | [number, string | number, ...unknown[]][];
    const rows = Array.isArray(r) ? r : (r.data ?? []);
    const last = rows[rows.length - 1];
    const close = Number(last?.[4]);
    const open = Number(last?.[1]);
    const use = Number.isFinite(close) ? close : Number.isFinite(open) ? open : null;
    const e: Entry = { ...base, source: "coinglass", price: use, bid: null, ask: null };
    cache.set(sym, e);
    return e;
  } catch (err2) {
    const e: Entry = { ...base, err: `${why}; cg: ${err2 instanceof Error ? err2.message : "fetch failed"}` };
    cache.set(sym, e);
    return e;
  }
}

export async function GET(req: NextRequest) {
  const sym = (req.nextUrl.searchParams.get("sym") ?? "BTC").toUpperCase();
  if (!isAsset(sym)) {
    return NextResponse.json({ ok: false, error: `unknown asset ${sym}` }, { status: 400 });
  }
  let e = cache.get(sym);
  const now = Date.now();
  if (!e || now - e.at >= TTL || (e.price == null && !e.err)) {
    e = await refresh(sym);
  }
  const ok = e.price != null;
  return NextResponse.json({
    ok,
    sym,
    price: e.price,
    bid: e.bid,
    ask: e.ask,
    source: e.source,
    fetchedAt: e.at,
    ageMs: Math.max(0, Date.now() - e.at),
    stale: !ok,
    ...(e.fapiErr ? { fapiErr: e.fapiErr } : {}),
    ...(e.err ? { error: e.err } : {}),
    ttlMs: TTL,
  });
}
