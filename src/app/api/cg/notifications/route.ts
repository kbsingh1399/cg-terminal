import { NextRequest, NextResponse } from "next/server";
import { listFeed, feedStats } from "@/lib/cg/notify";

export const dynamic = "force-dynamic";

/**
 * GET /api/cg/notifications?since=<id>&asset=BTC&source=footprint&dir=bullish&limit=200
 *
 * The live notification feed — every event from every tab (footprint
 * signals, indicator events, whale walls, liquidation sweep setups, CVD
 * divergences, engine backfills). `since` enables incremental polling
 * (Antigravity MCP keeps its cursor here).
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const since = sp.get("since");
  const items = listFeed({
    sinceId: since != null && since !== "" ? Number(since) : undefined,
    asset: sp.get("asset") ?? undefined,
    source: sp.get("source") ?? undefined,
    dir: sp.get("dir") ?? undefined,
    limit: Number(sp.get("limit") ?? 200) || 200,
  });
  return NextResponse.json({
    ok: true,
    count: items.length,
    items,
    stats: feedStats(),
    serverTime: Date.now(),
  });
}
