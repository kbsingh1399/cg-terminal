import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/health — liveness + resource telemetry for the terminal.
 *
 * Used by the deploy verification (scripts/verify-live.sh) and by uptime
 * monitoring: a 200 here means the Next.js server answers on the public
 * path. rss/heap numbers make memory regressions visible from outside
 * (the 2026-11-11 OOM postmortem: servers died silently at ~2GB).
 * Deliberately minimal — no pid/runtime fingerprinting.
 */
export async function GET() {
  const m = process.memoryUsage();
  return NextResponse.json({
    ok: true,
    ts: Date.now(),
    uptimeSec: Math.round(process.uptime()),
    rssMb: Math.round(m.rss / 1048576),
    heapUsedMb: Math.round(m.heapUsed / 1048576),
    heapTotalMb: Math.round(m.heapTotal / 1048576),
    externalMb: Math.round(m.external / 1048576),
  });
}
