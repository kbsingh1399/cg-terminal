import { NextRequest, NextResponse } from "next/server";
import { fapiFetch } from "@/lib/live/fapi";
import { binAssetOf, getUniverse } from "@/lib/binance/universe";

export const dynamic = "force-dynamic";

interface MarketCacheEntry {
  at: number;
  body: Record<string, unknown>;
}

const g = globalThis as unknown as { __binMarket?: Map<string, MarketCacheEntry> };
const cache = (g.__binMarket ??= new Map<string, MarketCacheEntry>());
const TTL_MS = 3_000;
const MAX_ENTRIES = 256;

/**
 * GET /api/binance/market?sym=1000PEPE — the per-symbol stats block.
 *
 * Three cheap weight-1 fapi calls, served concurrently: 24h ticker (last /
 * chg% / high / low / quote volume), premiumIndex (mark + index + funding
 * rate + next funding time) and openInterest (contracts → USD notional at
 * last). Each section degrades honestly — a missing section is absent,
 * never fabricated. 3s per-symbol cache.
 */
export async function GET(req: NextRequest) {
  const sym = (req.nextUrl.searchParams.get("sym") ?? "").trim().toUpperCase();
  if (!sym) return NextResponse.json({ ok: false, error: "missing ?sym" }, { status: 400 });
  if (!/^[A-Z0-9]{2,20}$/.test(sym)) {
    return NextResponse.json({ ok: false, error: `bad symbol shape ${sym}` }, { status: 400 });
  }
  await getUniverse();
  const a = binAssetOf(sym);
  if (!a) {
    return NextResponse.json(
      { ok: false, error: `${sym} is not in the Binance top-liquidity universe` },
      { status: 400 }
    );
  }
  const hit = cache.get(sym);
  if (hit && Date.now() - hit.at < TTL_MS) {
    return NextResponse.json({ ...hit.body, cached: true });
  }
  const [t24, prem, oi] = await Promise.allSettled([
    fapiFetch(`/fapi/v1/ticker/24hr?symbol=${a.pair}`, 5_000),
    fapiFetch(`/fapi/v1/premiumIndex?symbol=${a.pair}`, 5_000),
    fapiFetch(`/fapi/v1/openInterest?symbol=${a.pair}`, 5_000),
  ]);
  const errs: string[] = [];
  let ticker: Record<string, unknown> | undefined;
  let mark: Record<string, unknown> | undefined;
  let oib: Record<string, unknown> | undefined;
  if (t24.status === "fulfilled" && t24.value && typeof t24.value === "object") {
    const d = t24.value as Record<string, string>;
    const last = Number(d.lastPrice);
    if (Number.isFinite(last) && last > 0) {
      ticker = {
        last,
        chgPct: Number(d.priceChangePercent) || 0,
        high: Number(d.highPrice) || 0,
        low: Number(d.lowPrice) || 0,
        quoteVol: Number(d.quoteVolume) || 0,
        vwap: Number(d.weightedAvgPrice) || 0,
        nTrades: Number(d.count) || 0,
      };
    }
  } else if (t24.status === "rejected") {
    errs.push(`ticker: ${t24.reason instanceof Error ? t24.reason.message : "failed"}`);
  }
  if (prem.status === "fulfilled" && prem.value && typeof prem.value === "object") {
    const d = prem.value as Record<string, string>;
    const mp = Number(d.markPrice);
    if (Number.isFinite(mp) && mp > 0) {
      mark = {
        markPrice: mp,
        indexPrice: Number(d.indexPrice) || 0,
        fundingRatePct: (Number(d.lastFundingRate) || 0) * 100,
        nextFundingMs: Number(d.nextFundingTime) || 0,
      };
    }
  } else if (prem.status === "rejected") {
    errs.push(`premium: ${prem.reason instanceof Error ? prem.reason.message : "failed"}`);
  }
  if (oi.status === "fulfilled" && oi.value && typeof oi.value === "object") {
    const d = oi.value as Record<string, string>;
    const contracts = Number(d.openInterest);
    if (Number.isFinite(contracts) && contracts >= 0) {
      const last = (ticker?.last as number) ?? (mark?.markPrice as number) ?? 0;
      oib = { contracts, usd: last > 0 ? contracts * last : null };
    }
  } else if (oi.status === "rejected") {
    errs.push(`oi: ${oi.reason instanceof Error ? oi.reason.message : "failed"}`);
  }
  const ok = !!(ticker || mark || oib);
  if (!ok) {
    return NextResponse.json(
      { ok: false, sym, pair: a.pair, error: errs.join("; ") || "all upstream sections failed" },
      { status: 502 }
    );
  }
  const body = {
    ok: true as const,
    sym,
    pair: a.pair,
    rank: a.rank,
    at: Date.now(),
    ...(ticker ? { ticker } : {}),
    ...(mark ? { mark } : {}),
    ...(oib ? { oi: oib } : {}),
    ...(errs.length ? { partial: errs } : {}),
  };
  if (cache.size >= MAX_ENTRIES) {
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
  cache.set(sym, { at: Date.now(), body: body as unknown as Record<string, unknown> });
  return NextResponse.json(body);
}
