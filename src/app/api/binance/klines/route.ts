import { NextRequest, NextResponse } from "next/server";
import { fapiFetch } from "@/lib/live/fapi";
import { binAssetOf, getUniverse } from "@/lib/binance/universe";
import { clampLimit } from "@/lib/cg/params";

export const dynamic = "force-dynamic";

/** Binance-native interval names (NOT the cg m15-style names). */
const INTERVALS = new Set(["1m", "3m", "5m", "15m", "30m", "1h", "2h", "4h", "6h", "12h", "1d"]);

interface KlineCacheEntry {
  at: number;
  rows: [number, number, number, number, number, number, number][];
}

const g = globalThis as unknown as { __binKlines?: Map<string, KlineCacheEntry> };
const cache = (g.__binKlines ??= new Map<string, KlineCacheEntry>());
const TTL_MS = 3_000;
const MAX_ENTRIES = 96;

/**
 * GET /api/binance/klines?sym=1000PEPE&interval=15m&limit=300
 *
 * Server proxy for Binance USDT-M futures klines, restricted to the
 * top-N universe (symbol shape + membership gate — no arbitrary upstream
 * symbols), interval allowlist, limit clamped to 1000. 3s per-key cache
 * (a hot chart poller can never exceed ~weight-5 per 3s per view).
 * Rows: [openTime, open, high, low, close, volume, closeTime] — numbers.
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const sym = (sp.get("sym") ?? "").trim().toUpperCase();
  const iv = (sp.get("interval") ?? "15m").trim();
  const limit = clampLimit(sp.get("limit"), 300, 1000);
  if (!sym) return NextResponse.json({ ok: false, error: "missing ?sym" }, { status: 400 });
  if (!/^[A-Z0-9]{2,20}$/.test(sym)) {
    return NextResponse.json({ ok: false, error: `bad symbol shape ${sym}` }, { status: 400 });
  }
  if (!INTERVALS.has(iv)) {
    return NextResponse.json({ ok: false, error: `bad interval ${iv} (allowlist: ${[...INTERVALS].join(" ")})` }, { status: 400 });
  }
  await getUniverse();
  const a = binAssetOf(sym);
  if (!a) {
    return NextResponse.json(
      { ok: false, error: `${sym} is not in the Binance top-${200} liquidity universe` },
      { status: 400 }
    );
  }
  const key = `${a.pair}|${iv}|${limit}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) {
    return NextResponse.json({ ok: true, sym, pair: a.pair, interval: iv, rows: hit.rows, at: hit.at, cached: true });
  }
  try {
    const raw = (await fapiFetch(
      `/fapi/v1/klines?symbol=${a.pair}&interval=${iv}&limit=${limit}`,
      8_000
    )) as (string | number)[][];
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
    if (cache.size >= MAX_ENTRIES) {
      // evict the stalest entry (small fixed cache, never unbounded)
      let oldestKey: string | null = null;
      let oldestAt = Infinity;
      for (const [k, v] of cache) {
        if (v.at < oldestAt) {
          oldestAt = v.at;
          oldestKey = k;
        }
      }
      if (oldestKey) cache.delete(oldestKey);
    }
    cache.set(key, { at: Date.now(), rows });
    return NextResponse.json({ ok: true, sym, pair: a.pair, interval: iv, rows, at: Date.now(), cached: false });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "klines fetch failed" },
      { status: 502 }
    );
  }
}
