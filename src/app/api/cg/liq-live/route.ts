import { NextRequest, NextResponse } from "next/server";
import { ensureLiqCollector, liqLiveSnapshot } from "@/lib/cg/liq-live";
import { anyTerminalSym } from "@/lib/cg/sym-gate";

export const dynamic = "force-dynamic";

/**
 * GET /api/cg/liq-live — LIVE liquidation prints, server-collected across
 * Binance (!forceOrder@arr) + Bybit (allLiquidation) + OKX (liquidation-orders)
 * and persisted per asset (data/cg-liq/<SYM>.jsonl, trailing 24h hydrated).
 *
 *   ?sym=BTC     — per-asset tape + 1h/24h aggregates (long/short split,
 *                  USD notional, largest print, venues seen). Classic cash
 *                  indices return supported:false with the honest reason.
 *   ?limit=80    — tape length (≤400)
 *   no sym       — cross-asset universe tape + per-asset summary table
 *
 * Event-stream freshness contract: `stale` = no live venue connection (or all
 * silent past their heartbeat window) — NEVER "no recent events". A healthy
 * collector in a calm market reports `quiet: true` with zero events; that is
 * the honest state of an episodic feed, not an error.
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const sym = (sp.get("sym") ?? "").trim().toUpperCase();
  if (sym && !(await anyTerminalSym(sym))) {
    return NextResponse.json({ ok: false, error: `unknown asset ${sym}` }, { status: 400 });
  }
  const limitRaw = Number(sp.get("limit"));
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(400, Math.floor(limitRaw)) : undefined;
  const globalLimitRaw = Number(sp.get("globalLimit"));
  const globalLimit = Number.isFinite(globalLimitRaw) && globalLimitRaw > 0 ? Math.min(400, Math.floor(globalLimitRaw)) : undefined;

  // boot the collector on first hit (also booted by the engine)
  ensureLiqCollector();

  return NextResponse.json(
    liqLiveSnapshot({ ...(sym ? { sym } : {}), ...(limit ? { limit } : {}), ...(globalLimit ? { globalLimit } : {}) })
  );
}
