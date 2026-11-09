import { NextRequest, NextResponse } from "next/server";
import { forceBackfill } from "@/lib/cg/engine";

export const dynamic = "force-dynamic";

/**
 * POST /api/cg/engine/backfill
 * Trigger a gap-fill pass immediately (same logic the engine runs on boot):
 * pages upstream history from each series' last stored timestamp to now.
 */
export async function POST(_req: NextRequest) {
  try {
    const status = await forceBackfill();
    return NextResponse.json({ ok: true, ...status });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "backfill failed" },
      { status: 500 }
    );
  }
}
