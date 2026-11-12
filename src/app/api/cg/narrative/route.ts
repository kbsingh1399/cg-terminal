import { NextRequest, NextResponse } from "next/server";
import { buildNarrative } from "@/lib/cg/narrative";
import { anyTerminalSym } from "@/lib/cg/sym-gate";
import { markViewed } from "@/lib/cg/scan";

export const dynamic = "force-dynamic";

/**
 * GET /api/cg/narrative?sym=BTC — the deterministic M1/M2 trade narrative.
 *
 * Regime gate → dual-model evaluation (M1 trend-pullback, M2 VWAP ±2σ-3σ
 * mean reversion) → conflict resolution with hard vetoes → NarrativeVerdict
 * { activeModel, direction, grade, confidence, regime, thesis, plan,
 * checklist (exact measured values), freshness { worstAgeMs, staleFields } }.
 *
 * Classic instruments get an honest REDUCED checklist (no perp order-flow
 * feeds exist) — never a dead 400/502. Short module cache (20s) keeps the
 * Overview card live without hammering upstreams (inner builders cache too),
 * and a failed rebuild serves the last verdict instead of a 502.
 */
const cache = new Map<string, { at: number; body: unknown }>();
const TTL = 20_000;

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const sym = (sp.get("sym") ?? "BTC").trim().toUpperCase();
  if (!sym) return NextResponse.json({ ok: false, error: "missing sym" }, { status: 400 });
  if (!(await anyTerminalSym(sym))) {
    return NextResponse.json({ ok: false, error: `unknown asset ${sym}` }, { status: 400 });
  }
  markViewed(sym); // priority continuity: keep the viewed asset on the hot scan lane
  const hit = cache.get(sym);
  if (hit && Date.now() - hit.at < TTL) {
    return NextResponse.json(hit.body);
  }
  try {
    const verdict = await buildNarrative(sym);
    cache.set(sym, { at: Date.now(), body: verdict });
    return NextResponse.json(verdict);
  } catch (e) {
    // stale-while-revalidate: serve the last verdict rather than a 502
    if (hit) return NextResponse.json(hit.body);
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "narrative build failed" },
      { status: 502 }
    );
  }
}
