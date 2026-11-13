import { NextRequest } from "next/server";
import { anyTerminalSym } from "@/lib/cg/sym-gate";

export const dynamic = "force-dynamic";

/**
 * POST /api/cg/narrative/ai — STRICTLY INERT (dual-agent architecture).
 *
 * The web terminal is a PURE DATA & MATH ENGINE: zero external AI/LLM API
 * calls happen anywhere in the terminal runtime — no NVIDIA/OpenAI fetches,
 * no API keys, no token cost, no rate-limit failures, sub-100ms deterministic
 * feeds only.
 *
 * All AI reasoning and narrative formulation happen NATIVELY inside the
 * Antigravity execution agent (the Institutional Trading Committee), which
 * pulls grounded telemetry through the local MCP server (mcp/server.mjs →
 * `narrative_ai_brief`, a deterministic brief kit assembled from the
 * verified NarrativeVerdict + quant + options routes).
 *
 * This route remains mounted so existing clients get an instant, honest,
 * deterministic answer instead of a 404. The verified deterministic verdict
 * itself is always available at /api/cg/narrative.
 */
export async function POST(req: NextRequest) {
  let sym = "BTC";
  try {
    const body = (await req.json().catch(() => ({}))) as { sym?: string };
    sym = (body.sym ?? "BTC").trim().toUpperCase();
  } catch {
    /* default sym */
  }
  if (!(await anyTerminalSym(sym))) {
    return Response.json({ ok: false, error: `unknown asset ${sym}` }, { status: 400 });
  }
  return Response.json({
    ok: false,
    inert: true,
    sym,
    architecture: "dual-agent",
    reason:
      "AI narrative is disabled in the terminal runtime — zero external LLM APIs by design. " +
      "All AI reasoning happens natively in the Antigravity execution agent via the local MCP interface " +
      "(tool: narrative_ai_brief — deterministic brief kit). The verified deterministic verdict is served at /api/cg/narrative.",
  });
}
