import { NextRequest, NextResponse } from "next/server";
import { buildScreenerPayload } from "@/lib/cg/screener";
import { warmAssetScan } from "@/lib/cg/scan";
import { anyTerminalSym, gateReject } from "@/lib/cg/sym-gate";

export const dynamic = "force-dynamic";

/**
 * GET /api/cg/screener — live cross-asset Alpha Matrix over the canonical
 * Curated-61 (30 crypto perps + 28 TradFi perps + 3 classics) with the
 * narrative radar's M1/M2 state, VWAP σ, RVOL, OI 4h quadrant, OI-weighted
 * funding APR, trailing-5m liquidation cascade USD and honest data-age.
 * Optional `?warm=SYM` triggers an on-demand coalesced scan warm-up for a
 * cold symbol (any terminal symbol — curated or legacy registry).
 */
export async function GET(req: NextRequest) {
  const warm = req.nextUrl.searchParams.get("warm")?.trim().toUpperCase();
  if (warm) {
    if (!(await anyTerminalSym(warm))) {
      return NextResponse.json({ ok: false, error: gateReject(warm) }, { status: 400 });
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
