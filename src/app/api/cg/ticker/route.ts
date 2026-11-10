import { NextRequest, NextResponse } from "next/server";
import { cgGet } from "@/lib/cg/client";
import { assetOf, isAsset } from "@/lib/cg/assets";

export const dynamic = "force-dynamic";

/**
 * GET /api/cg/ticker?sym=BTC — 1-second-grade live price feed.
 *
 * Client polls this every 1s; the server refreshes from the Coinglass
 * kline API (forming m1 candle close) at most every CG_TICKER_TTL_MS
 * (default 3s) and serves all clients from that shared cache, so any
 * number of tabs/Antigravity agents stay gentle on upstream.
 *
 * Pure API data: Binance-perp lead venue via Coinglass, same source the
 * charts use — no synthetic values.
 */

const TTL = Math.max(1000, Number(process.env.CG_TICKER_TTL_MS ?? 3000) || 3000);

interface TickerEntry {
  at: number;
  sym: string;
  price: number | null;
  candleT: number | null;
  prev: number | null;
  err?: string;
}

const g = globalThis as unknown as { __cgTicker?: Map<string, TickerEntry> };
const cache = (g.__cgTicker ??= new Map<string, TickerEntry>());

async function refresh(sym: string): Promise<TickerEntry> {
  const cfg = assetOf(sym);
  const instKey = cfg ? cfg.leadKey(sym) : `Binance_${sym}USDT`;
  const prev = cache.get(sym)?.price ?? null;
  let entry: TickerEntry;
  try {
    const r = (await cgGet(
      `/api/v2/kline?symbol=${encodeURIComponent(`${instKey}#kline`)}&interval=m1&limit=2&minLimit=false`,
      TTL
    )) as { data?: [number, string | number, ...unknown[]][] } | [number, string | number, ...unknown[]][];
    let rows = Array.isArray(r) ? r : (r.data ?? []);
    if (!rows.length) {
      // OKX-lead assets (USO): the m1 kline can be empty — fall back to the
      // m15 forming close rather than serving a dead ticker (review G3)
      const r15 = (await cgGet(
        `/api/v2/kline?symbol=${encodeURIComponent(`${instKey}#kline`)}&interval=m15&limit=2&minLimit=false`,
        TTL
      )) as { data?: [number, string | number, ...unknown[]][] } | [number, string | number, ...unknown[]][];
      rows = Array.isArray(r15) ? r15 : (r15.data ?? []);
    }
    const last = rows[rows.length - 1];
    // kline row = [t, o, h, l, c, v] — close of the forming candle is the live price
    const close = Number(last?.[4]);
    const open = Number(last?.[1]);
    const use = Number.isFinite(close) ? close : Number.isFinite(open) ? open : null;
    entry = { at: Date.now(), sym, price: use, candleT: last ? 1000 * Number(last[0]) : null, prev };
  } catch (e) {
    entry = { at: Date.now(), sym, price: null, candleT: null, prev, err: e instanceof Error ? e.message : "fetch failed" };
  }
  cache.set(sym, entry);
  return entry;
}

export async function GET(req: NextRequest) {
  const sym = (req.nextUrl.searchParams.get("sym") ?? "BTC").toUpperCase();
  if (!isAsset(sym)) {
    return NextResponse.json({ ok: false, error: `unknown asset ${sym}` }, { status: 400 });
  }
  let e = cache.get(sym);
  const now = Date.now();
  if (!e || now - e.at >= TTL || e.price == null) {
    e = await refresh(sym);
  }
  // serve stale value (marked) instead of failing when upstream hiccups
  const stale = !!e.err || e.price == null;
  const dir = e.price == null || e.prev == null ? "flat" : e.price > e.prev ? "up" : e.price < e.prev ? "down" : "flat";
  return NextResponse.json({
    ok: !stale,
    sym,
    price: e.price,
    dir,
    candleT: e.candleT,
    fetchedAt: e.at,
    ageMs: Math.max(0, Date.now() - e.at),
    stale,
    ...(e.err ? { error: e.err } : {}),
    ttlMs: TTL,
  });
}
