import { NextRequest, NextResponse } from "next/server";
import { cgGet } from "@/lib/cg/client";
import { parseInterval, instrumentKeyOK } from "@/lib/cg/params";
import type { LargeOrderGroup } from "@/lib/cg/types";

export const dynamic = "force-dynamic";

/**
 * GET /api/cg/largeorder?hours=24
 * Returns large resting orders and large trades per venue (futures + spot).
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const hours = Math.min(Math.max(Number(sp.get("hours") ?? 24) || 24, 1), 24 * 30);
  const interval = parseInterval(sp.get("interval"));
  if (!interval) {
    return NextResponse.json({ ok: false, error: "invalid interval" }, { status: 400 });
  }
  const symbol = sp.get("symbol") ?? "Binance_BTCUSDT";
  // instrument-key shape validation (see kline route)
  if (!instrumentKeyOK(symbol)) {
    return NextResponse.json({ ok: false, error: `invalid symbol ${symbol}` }, { status: 400 });
  }
  const end = Math.floor(Date.now() / 1000);
  const start = end - hours * 3600;
  try {
    const groups = (await cgGet(
      `/api/largeOrder?symbol=${encodeURIComponent(symbol)}&interval=${interval}&startTime=${start}&endTime=${end}&minLimit=false`,
      30_000
    )) as LargeOrderGroup[] | null;
    return NextResponse.json({ ok: true, groups: groups ?? [] });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "fetch failed" }, { status: 502 });
  }
}
