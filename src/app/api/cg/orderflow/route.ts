import { NextRequest, NextResponse } from "next/server";
import { cgGet } from "@/lib/cg/client";
import type { OrderFlowBar } from "@/lib/cg/types";

export const dynamic = "force-dynamic";

/**
 * GET /api/cg/orderflow?interval=m15&limit=300
 * Proxies the order-flow (footprint) series. `interval` in m1|m5|m15|m30|h1..., `limit` <= 1000.
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const interval = sp.get("interval") ?? "m15";
  const limit = Math.min(Number(sp.get("limit") ?? 300) || 300, 1000);
  const symbol = sp.get("symbol") ?? "Binance_BTCUSDT";
  try {
    const data = await cgGet(
      `/api/orderFlow?symbol=${encodeURIComponent(`${symbol}#order_flow`)}&interval=${interval}&minLimit=false&limit=${limit}`,
      15_000
    );

    // orderFlow returns { code, msg, data: [[ts, buckets], ...] } as a plain (unencrypted) payload
    let rows: [number, unknown[][]][] = [];
    if (Array.isArray(data)) {
      rows = data as [number, unknown[][]][];
    } else if (data && typeof data === "object" && Array.isArray((data as { data?: unknown }).data)) {
      rows = (data as unknown as { data: [number, unknown[][]][] }).data;
    }
    const bars: OrderFlowBar[] = rows
      .map(([ts, buckets]) => ({ ts, buckets: buckets as OrderFlowBar["buckets"] }))
      .filter((b) => Array.isArray(b.buckets));
    return NextResponse.json({ ok: true, interval, bars });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "fetch failed" }, { status: 502 });
  }
}
