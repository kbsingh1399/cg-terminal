import { NextRequest, NextResponse } from "next/server";
import { binAssetOf, getUniverse } from "@/lib/binance/universe";
import { t24Of, premOf, oiOf } from "@/lib/binance/market-batch";

export const dynamic = "force-dynamic";

/**
 * GET /api/binance/market?sym=NVDA — the per-symbol stats block.
 *
 * Served from shared ALL-SYMBOL batch caches (see src/lib/binance/market-batch.ts):
 * one weight-40 ticker/24hr + one weight-10 premiumIndex fetch cover the whole
 * curated universe per 4s window; openInterest stays per-symbol (10s TTL).
 * A 58-asset grid poller therefore costs ~2 shared requests per cycle instead
 * of 3 × 58 — the 2026-11-12 429 storms on the shared egress IP came from the
 * old per-symbol fan-out. Each section degrades honestly — a missing section
 * is absent, never fabricated.
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
      { ok: false, error: `${sym} is not in the curated universe` },
      { status: 400 }
    );
  }
  const [t24, prem] = await Promise.allSettled([t24Of(a.pair), premOf(a.pair)]);

  const errs: string[] = [];
  let ticker: Record<string, unknown> | undefined;
  let mark: Record<string, unknown> | undefined;
  let oib: { contracts: number; usd: number | null } | null = null;

  if (t24.status === "fulfilled" && t24.value) {
    const d = t24.value;
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
  if (prem.status === "fulfilled" && prem.value) {
    const d = prem.value;
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
  // OI needs a price to convert contracts → USD; use ticker last, else mark.
  const priceForUsd = (ticker?.last as number) ?? (mark?.markPrice as number) ?? 0;
  if (priceForUsd > 0) {
    oib = await oiOf(a.pair, priceForUsd);
  }
  const ok = !!(ticker || mark || oib);
  if (!ok) {
    return NextResponse.json(
      { ok: false, sym, pair: a.pair, error: errs.join("; ") || "all upstream sections failed" },
      { status: 502 }
    );
  }
  return NextResponse.json({
    ok: true as const,
    sym,
    pair: a.pair,
    rank: a.rank,
    at: Date.now(),
    ...(ticker ? { ticker } : {}),
    ...(mark ? { mark } : {}),
    ...(oib ? { oi: oib } : {}),
    ...(errs.length ? { partial: errs } : {}),
  });
}
