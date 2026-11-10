import { NextResponse } from "next/server";
import { engineStatus, ensureEngine } from "@/lib/cg/engine";

export const dynamic = "force-dynamic";

/**
 * GET /api/cg/engine/status
 * Continuity-engine health: per-series coverage (count, first/last ts,
 * last poll, last error, backfill state), instrument list, kline gaps.
 * Starting the status route also boots the engine if not yet running.
 */
export async function GET() {
  try {
    ensureEngine();
    return NextResponse.json({ ok: true, ...engineStatus() });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "engine error" },
      { status: 500 }
    );
  }
}
