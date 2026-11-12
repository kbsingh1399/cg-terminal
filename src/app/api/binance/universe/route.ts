import { NextResponse } from "next/server";
import { binAssets, getUniverse } from "@/lib/binance/universe";

export const dynamic = "force-dynamic";

/**
 * GET /api/binance/universe — the top-N liquidity universe.
 *
 * Ranked by rolling 24h quote volume over every TRADING USDT perpetual on
 * Binance USDT-M futures; refreshed every 4h (see src/lib/binance/universe.ts).
 * `ok` is true whenever a list exists (an error state with a stale list
 * still serves, carrying `err` + age so the UI can label it honestly).
 */
export async function GET() {
  const st = await getUniverse();
  const ok = binAssets().length > 0;
  return NextResponse.json({
    ok,
    ...st,
    assets: binAssets().map((a) => ({
      sym: a.sym,
      pair: a.pair,
      rank: a.rank,
      quoteVol24h: a.quoteVol24h,
      priceDecs: a.priceDecs,
      qtyDecs: a.qtyDecs,
      contractType: a.contractType,
      underlyingType: a.underlyingType,
    })),
    serverTime: Date.now(),
  });
}
