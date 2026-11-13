import { NextRequest, NextResponse } from "next/server";
import {
  ensurePaperBook,
  paperBookSnapshot,
  paperTicketOfSym,
  resetPaperBook,
} from "@/lib/cg/paperbook";
import { anyTerminalSym } from "@/lib/cg/sym-gate";

export const dynamic = "force-dynamic";

/**
 * GET /api/cg/paperbook — the Virtual Book: live paper-trade outcome
 * tracker for every agent setup (M1 trend-pullback · M1 wait-zone ·
 * M2 VWAP ±2σ mean-reversion) across the full 61-asset universe.
 *
 *   ?sym=BTC        — most relevant ticket for the symbol + its history
 *   ?status=ARMED|OPEN|CLOSED
 *   ?limit=200      — cap on returned tickets
 *
 * Response: tickets (with live unrealized R, MFE/MAE, hit rungs), per-model
 * stats (win rate · expectancy · total R · fill rate · avg hold), engine
 * telemetry (sweep position, last pass), and the honest freshness envelope
 * { dataAt, ageMs, stale, source } — tracking is engine-driven (60 s pass,
 * 90 s sweep), this route is read-only.
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const sym = (sp.get("sym") ?? "").trim().toUpperCase();
  if (sym && !(await anyTerminalSym(sym))) {
    return NextResponse.json({ ok: false, error: `unknown asset ${sym}` }, { status: 400 });
  }
  const statusRaw = (sp.get("status") ?? "").trim().toUpperCase();
  const status = statusRaw === "ARMED" || statusRaw === "OPEN" || statusRaw === "CLOSED" ? (statusRaw as "ARMED" | "OPEN" | "CLOSED") : undefined;
  const limitRaw = Number(sp.get("limit"));
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(500, Math.floor(limitRaw)) : undefined;

  // boot the tracker even when the wider engine is not yet started
  ensurePaperBook();

  const snap = paperBookSnapshot({ ...(sym ? { sym } : {}), ...(status ? { status } : {}), ...(limit ? { limit } : {}) });
  return NextResponse.json({
    ...snap,
    ...(sym ? { ticket: paperTicketOfSym(sym) } : {}),
  });
}

/**
 * POST /api/cg/paperbook {"action":"reset"} — clear the virtual book
 * (ops/testing). Mutating POSTs are already host-gated by src/proxy.ts;
 * the action allowlist keeps the surface to exactly one op.
 */
export async function POST(req: NextRequest) {
  let body: { action?: string } = {};
  try {
    body = (await req.json()) as { action?: string };
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json body" }, { status: 400 });
  }
  if (body.action !== "reset") {
    return NextResponse.json({ ok: false, error: "unknown action — allowed: reset" }, { status: 400 });
  }
  resetPaperBook();
  return NextResponse.json({ ok: true, reset: true, at: Date.now() });
}
