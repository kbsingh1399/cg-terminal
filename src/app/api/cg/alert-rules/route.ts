import { NextRequest, NextResponse } from "next/server";
import { listRules, createRule, updateRule, deleteRule, alertRulesTelemetry, evaluateAlertRules } from "@/lib/cg/alert-rules";

export const dynamic = "force-dynamic";

/**
 * GET  /api/cg/alert-rules — list persistent user rules + telemetry (+ ?eval=1
 *       forces one evaluation pass for testing; the scanner loop also runs it
 *       every 30 s).
 * POST /api/cg/alert-rules — create { kind, name?, syms?, threshold?, level?,
 *       direction?, enabled? }
 * PATCH /api/cg/alert-rules?id=AR-… — toggle/update fields
 * DELETE /api/cg/alert-rules?id=AR-… — remove
 *
 * Rules persist to data/cg-series/alert-rules.json and are evaluated inside
 * the scanner loop against live engine state (radar verdicts, market
 * snapshots, liq-live cascades, radar funding APR, live price hub) — zero
 * extra upstream quota. Fires push [HIGH] notifications (SSE) and optionally
 * POST to ALERT_WEBHOOK_URL.
 */
export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get("eval") === "1") {
    const res = await evaluateAlertRules().catch((e) => ({ evaluated: 0, fired: 0, skippedCooldown: 0, error: String(e) }));
    return NextResponse.json({ ok: true, rules: listRules(), telemetry: alertRulesTelemetry(), evalPass: res });
  }
  return NextResponse.json({
    ok: true,
    rules: listRules(),
    telemetry: alertRulesTelemetry(),
    dataAt: Date.now(),
    ageMs: 0,
    stale: false,
    source: "data/cg-series/alert-rules.json · evaluated in the scanner loop (30 s) · SSE + optional webhook",
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const rule = createRule(body as Parameters<typeof createRule>[0]);
    if ("error" in rule) return NextResponse.json({ ok: false, error: rule.error }, { status: 400 });
    return NextResponse.json({ ok: true, rule });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "bad body" }, { status: 400 });
  }
}

export async function PATCH(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ ok: false, error: "missing id" }, { status: 400 });
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const rule = updateRule(id, body as Parameters<typeof updateRule>[1]);
    if ("error" in rule) return NextResponse.json({ ok: false, error: rule.error }, { status: 404 });
    return NextResponse.json({ ok: true, rule });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "bad body" }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ ok: false, error: "missing id" }, { status: 400 });
  const res = deleteRule(id);
  if ("error" in res) return NextResponse.json({ ok: false, error: res.error }, { status: 404 });
  return NextResponse.json(res);
}
