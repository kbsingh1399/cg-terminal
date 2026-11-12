import { NextResponse } from "next/server";
import { ASSETS } from "@/lib/cg/assets";
import { CURATED, curatedClassic, curatedPerps } from "@/lib/universe/curated";
import { engineStatus } from "@/lib/cg/engine";
import { scannerStatus } from "@/lib/cg/scan";
import { feedStats } from "@/lib/cg/notify";

export const dynamic = "force-dynamic";

/**
 * GET /api/cg/assets — the tradable universe + engine/scanner/feed status.
 * Single entry point for MCP consumers and the terminal header.
 *
 * 2026-11-12 consolidation: `assets` keeps the LEGACY Tier-1 registry shape
 * (src/lib/cg/assets.ts — the MCP list_assets contract is untouched); the
 * terminal's actual universe is exposed alongside as `curated` (58 perps,
 * full metadata: kind/category/sub/spotPair/punchable) and `curatedClassic`
 * (3). `scanner.scanAssets` now names the curated perp list the engine
 * actually scans.
 */
export async function GET() {
  return NextResponse.json({
    ok: true,
    assets: ASSETS.map((a) => ({ sym: a.sym, name: a.name, kind: a.kind, sector: a.sector, tier: a.tier, hyperliquid: a.hl })),
    curatedTotal: CURATED.length,
    curated: curatedPerps().map((a) => ({
      sym: a.sym,
      pair: a.pair,
      spotPair: a.spotPair ?? null,
      kind: a.kind,
      category: a.category,
      name: a.name,
      sub: a.sub,
      punchable: a.punchable,
      origin: a.origin,
    })),
    curatedClassic: curatedClassic().map((a) => ({ sym: a.sym, name: a.name, sub: a.sub })),
    engine: engineStatus(),
    scanner: scannerStatus(),
    feed: feedStats(),
    serverTime: Date.now(),
  });
}
