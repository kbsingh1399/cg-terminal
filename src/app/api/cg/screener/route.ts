import { NextRequest, NextResponse } from "next/server";
import { buildScreenerPayload } from "@/lib/cg/screener";
import { warmAssetScan } from "@/lib/cg/scan";
import { isAsset } from "@/lib/cg/assets";

export const dynamic = "force-dynamic";

/**
 * GET /api/cg/screener — live cross-asset Alpha Matrix (Top 30 Crypto + 3 Metals + Curated TradFi Core).
 * Optional `?warm=HYPE` triggers an on-demand coalesced scan warm-up for a cold symbol.
 */
export async function GET(req: NextRequest) {
  const warm = req.nextUrl.searchParams.get("warm")?.trim().toUpperCase();
  if (warm) {
    if (!isAsset(warm)) {
      return NextResponse.json({ ok: false, error: `unknown tier-1 asset ${warm}` }, { status: 400 });
    }
    await warmAssetScan(warm).catch(() => undefined);
  }
  try {
    const payload = await buildScreenerPayload();
    return NextResponse.json(payload);
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "screener failed" },
      { status: 500 }
    );
  }
}
