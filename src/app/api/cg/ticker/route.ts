import { NextRequest, NextResponse } from "next/server";
import { cgGet } from "@/lib/cg/client";
import { leadInstr } from "@/lib/cg/assets";
import { anyTerminalSym, knownSym } from "@/lib/cg/sym-gate";
import { hlCoinOf } from "@/lib/binance/aliases";
import { fetchBinCandles, fetchHlCtxAndBook, fetchYahooCandles, resolveClassicYahooTicker } from "@/lib/cg/fallbacks";

export const dynamic = "force-dynamic";

const TTL = Math.max(1000, Number(process.env.CG_TICKER_TTL_MS ?? 3000) || 3000);

interface TickerEntry {
  at: number;
  sym: string;
  price: number | null;
  candleT: number | null;
  prev: number | null;
  source?: string;
  err?: string;
}

const g = globalThis as unknown as { __cgTicker?: Map<string, TickerEntry> };
const cache = (g.__cgTicker ??= new Map<string, TickerEntry>());

async function refresh(sym: string): Promise<TickerEntry> {
  const prev = cache.get(sym)?.price ?? null;
  let price: number | null = null;
  let candleT: number | null = null;
  let source = "coinglass";
  let lastErr: string | undefined;

  if (await knownSym(sym)) {
    const instKey = leadInstr(sym);
    try {
      const r = (await cgGet(
        `/api/v2/kline?symbol=${encodeURIComponent(`${instKey}#kline`)}&interval=m1&limit=2&minLimit=false`,
        TTL
      )) as { data?: [number, string | number, ...unknown[]][] } | [number, string | number, ...unknown[]][];
      let rows = Array.isArray(r) ? r : (r.data ?? []);
      if (!rows.length) {
        const r15 = (await cgGet(
          `/api/v2/kline?symbol=${encodeURIComponent(`${instKey}#kline`)}&interval=m15&limit=2&minLimit=false`,
          TTL
        )) as { data?: [number, string | number, ...unknown[]][] } | [number, string | number, ...unknown[]][];
        rows = Array.isArray(r15) ? r15 : (r15.data ?? []);
      }
      const last = rows[rows.length - 1];
      const close = Number(last?.[4]);
      const open = Number(last?.[1]);
      const use = Number.isFinite(close) ? close : Number.isFinite(open) ? open : null;
      if (use != null && use > 0) {
        price = use;
        candleT = last ? 1000 * Number(last[0]) : null;
      }
    } catch (e) {
      lastErr = e instanceof Error ? e.message : "cg ticker failed";
    }

    // Fallback to direct Binance fapi kline when Coinglass fails/429s
    if (price == null) {
      try {
        const bins = await fetchBinCandles(sym, "m1", 2);
        const bLast = bins[bins.length - 1];
        if (bLast?.c > 0) {
          price = bLast.c;
          candleT = bLast.t;
          source = "binance-fapi";
          lastErr = undefined;
        }
      } catch (e) {
        lastErr = e instanceof Error ? e.message : lastErr;
      }
    }
  }

  // Fallback for Hyperliquid xyz classics (SPX500, NDX100, JP225)
  if (price == null && hlCoinOf(sym)) {
    const hl = await fetchHlCtxAndBook(sym);
    const mark = hl?.ctx?.markPx != null ? Number(hl.ctx.markPx) : null;
    if (mark != null && mark > 0) {
      price = mark;
      candleT = Date.now();
      source = "hl-xyz";
      lastErr = undefined;
    }
  }

  // Fallback for Yahoo classic benchmarks (US30, GER30, VIX)
  if (price == null) {
    const yf = resolveClassicYahooTicker(sym);
    if (yf) {
      try {
        const yc = await fetchYahooCandles(yf.yahoo, "15m", "5d");
        const yLast = yc[yc.length - 1];
        if (yLast?.c > 0) {
          price = yLast.c;
          candleT = yLast.t;
          source = "yahoo";
          lastErr = undefined;
        }
      } catch (e) {
        lastErr = e instanceof Error ? e.message : lastErr;
      }
    }
  }

  const entry: TickerEntry = {
    at: Date.now(),
    sym,
    price,
    candleT,
    prev,
    source,
    ...(price == null ? { err: lastErr ?? "no price" } : {}),
  };
  cache.set(sym, entry);
  return entry;
}

export async function GET(req: NextRequest) {
  const sym = (req.nextUrl.searchParams.get("sym") ?? "BTC").trim().toUpperCase();
  if (!(await anyTerminalSym(sym))) {
    return NextResponse.json({ ok: false, error: `unknown asset ${sym}` }, { status: 400 });
  }
  let e = cache.get(sym);
  const now = Date.now();
  if (!e || now - e.at >= TTL || e.price == null) {
    e = await refresh(sym);
  }
  const stale = !!e.err || e.price == null;
  const dir = e.price == null || e.prev == null ? "flat" : e.price > e.prev ? "up" : e.price < e.prev ? "down" : "flat";
  return NextResponse.json({
    ok: !stale,
    sym,
    source: e.source ?? "coinglass",
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
