import { NextResponse } from "next/server";
import { ASSETS } from "@/lib/cg/assets";
import { engineStatus } from "@/lib/cg/engine";
import { scannerStatus } from "@/lib/cg/scan";
import { feedStats } from "@/lib/cg/notify";

export const dynamic = "force-dynamic";

/**
 * GET /api/cg/assets — the tradable universe + engine/scanner/feed status.
 * Single entry point for MCP consumers and the terminal header.
 */
export async function GET() {
  return NextResponse.json({
    ok: true,
    assets: ASSETS.map((a) => ({ sym: a.sym, name: a.name, kind: a.kind, sector: a.sector, tier: a.tier, hyperliquid: a.hl })),
    engine: engineStatus(),
    scanner: scannerStatus(),
    feed: feedStats(),
    serverTime: Date.now(),
  });
}
