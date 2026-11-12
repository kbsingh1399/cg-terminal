import { NextRequest, NextResponse } from "next/server";
import { buildMarketSnapshot } from "@/lib/cg/market";
import { anyTerminalSym } from "@/lib/cg/sym-gate";

export const dynamic = "force-dynamic";

/**
 * GET /api/cg/market?sym=BTC
 *
 * The Overview tab data: live price, auction VAL/POC/VAH (session · day ·
 * month), Fib-prime EMA 13/89/233, RSI(14) — m15/h1/h4/d1 — and day-anchored
 * VWAP ±1σ/2σ/3σ (UTC day open anchor, timezone-independent).
 */
export async function GET(req: NextRequest) {
  const sym = (req.nextUrl.searchParams.get("sym") ?? "BTC").toUpperCase();
  if (!(await anyTerminalSym(sym))) {
    return NextResponse.json({ ok: false, error: `unknown asset ${sym}` }, { status: 400 });
  }
  try {
    const snap = await buildMarketSnapshot(sym);
    return NextResponse.json(snap);
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "fetch failed" }, { status: 502 });
  }
}
