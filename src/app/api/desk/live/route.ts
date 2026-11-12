import { NextResponse } from "next/server";
import { buildDeskLiveSnapshot } from "@/lib/desk/live";

export const dynamic = "force-dynamic";

/**
 * GET /api/desk/live — read-only live bridge over MT5 execution + agent desk rounds.
 */
export async function GET() {
  try {
    const snap = await buildDeskLiveSnapshot();
    return NextResponse.json(snap);
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "desk snapshot failed" },
      { status: 500 }
    );
  }
}
