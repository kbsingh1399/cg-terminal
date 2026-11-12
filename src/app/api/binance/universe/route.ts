import { NextResponse } from "next/server";
import { binAssets, getUniverse } from "@/lib/binance/universe";

export const dynamic = "force-dynamic";

/**
 * GET /api/binance/universe — the CURATED 58-perp membership.
 *
 * Fixed list from src/lib/universe/curated.ts (30 crypto + 28 TradFi
 * USDT-M perps), enriched live with exchangeInfo tick/step precision and
 * rolling 24h quote volumes. `ok` is true whenever a list exists (which is
 * always — membership is static; an error state serves defaults, carrying
 * `err` + age so the UI can label it honestly). `delisted` names any curated
 * pair fapi no longer carries as TRADING — flagged, never silently dropped.
 * `rank` is the curated palette position, not a volume rank.
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
      state: a.state,
      kind: a.kind,
      name: a.name,
      category: a.category,
      sub: a.sub,
      ...(a.spotPair ? { spotPair: a.spotPair } : {}),
      punchable: a.punchable,
      origin: a.origin,
      contractType: a.contractType,
      underlyingType: a.underlyingType,
    })),
    serverTime: Date.now(),
  });
}
