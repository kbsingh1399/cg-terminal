import { NextRequest, NextResponse } from "next/server";
import { cgGet } from "@/lib/cg/client";
import type { KlineRow, OiKlineRow } from "@/lib/cg/types";

export const dynamic = "force-dynamic";

/**
 * GET /api/cg/kline?type=kline|oi&interval=m15&limit=300
 * Returns decrypted candle (or open-interest) rows.
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const type = sp.get("type") === "oi" ? "oi_kline" : "kline";
  const interval = sp.get("interval") ?? "m15";
  const limit = Math.min(Number(sp.get("limit") ?? 300) || 300, 2880);
  const symbol = sp.get("symbol") ?? "Binance_BTCUSDT";
  try {
    const rows = (await cgGet(
      `/api/v2/kline?symbol=${encodeURIComponent(`${symbol}#${type}`)}&interval=${interval}&minLimit=false&limit=${limit}`,
      15_000
    )) as KlineRow[] | OiKlineRow[] | null;
    if (!Array.isArray(rows)) {
      return NextResponse.json({ ok: true, interval, rows: [] });
    }
    return NextResponse.json({ ok: true, interval, type, rows });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "fetch failed" }, { status: 502 });
  }
}
