import { NextRequest, NextResponse } from "next/server";
import { forceBackfill } from "@/lib/cg/engine";

export const dynamic = "force-dynamic";

/**
 * POST /api/cg/engine/backfill
 * Trigger a gap-fill pass immediately (same logic the engine runs on boot):
 * pages upstream history from each series' last stored timestamp to now.
 *
 * Two guards beyond the middleware same-origin check:
 *  - cooldown (30 s): a double-click or a stuck client must not fan out
 *    hundreds of upstream requests in a loop
 *  - single-flight: a second call while one is running returns its status
 *    instead of stacking a parallel pass
 */
const g = globalThis as unknown as { __cgBackfillAt?: number; __cgBackfillBusy?: boolean };
const COOLDOWN_MS = 30_000;

export async function POST(_req: NextRequest) {
  const last = g.__cgBackfillAt ?? 0;
  if (Date.now() - last < COOLDOWN_MS) {
    return NextResponse.json(
      { ok: false, error: `backfill already triggered ${Math.round((Date.now() - last) / 1000)}s ago — cooldown ${COOLDOWN_MS / 1000}s` },
      { status: 429 }
    );
  }
  if (g.__cgBackfillBusy) {
    return NextResponse.json({ ok: false, error: "backfill already running" }, { status: 409 });
  }
  g.__cgBackfillAt = Date.now();
  g.__cgBackfillBusy = true;
  try {
    const status = await forceBackfill();
    return NextResponse.json({ ok: true, ...status });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "backfill failed" },
      { status: 500 }
    );
  } finally {
    g.__cgBackfillBusy = false;
  }
}
