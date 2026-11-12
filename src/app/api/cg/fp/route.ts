import { NextRequest, NextResponse } from "next/server";
import { loadFpBars } from "@/lib/cg/fp-load";
import { anyTerminalSym } from "@/lib/cg/sym-gate";
import { parseInterval } from "@/lib/cg/params";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const sym = (sp.get("sym") ?? "BTC").trim().toUpperCase();
  if (!(await anyTerminalSym(sym))) {
    return NextResponse.json({ ok: false, error: `unknown asset ${sym}` }, { status: 400 });
  }
  const itv = parseInterval(sp.get("itv"));
  if (!itv) {
    return NextResponse.json({ ok: false, error: "invalid interval" }, { status: 400 });
  }
  const live = sp.get("live") === "1";
  const limit = live
    ? Math.min(Math.max(Number(sp.get("limit") ?? 8) || 8, 2), 12)
    : Math.min(Math.max(Number(sp.get("limit") ?? 300) || 300, 1), 1000);
  const withOi = sp.get("oi") === "1";
  try {
    const res = await loadFpBars(sym, itv, limit, withOi, live ? 8_000 : 45_000);
    return NextResponse.json(res);
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "fetch failed" }, { status: 502 });
  }
}
