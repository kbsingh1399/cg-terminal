import { NextResponse } from "next/server";
import { buildPortfolioRisk } from "@/lib/cg/portfolio-risk";

export const dynamic = "force-dynamic";

/**
 * GET /api/cg/risk — portfolio correlation & heat engine (WS4).
 *
 * Cross-surface exposure (MT5 positions/orders + desk directives + Binance
 * testnet + Virtual Book open tickets) with rolling 24h/7d return
 * correlations, net beta vs BTC/QQQ, cluster exposure, N_eff, portfolio heat
 * (% equity at stop risk) and correlation-guard warnings. Every number comes
 * from the real position files / signed accounts / fapi klines — missing
 * surfaces are skipped honestly, never invented.
 */
export async function GET() {
  try {
    const view = await buildPortfolioRisk();
    return NextResponse.json(view);
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "portfolio risk build failed" },
      { status: 502 }
    );
  }
}
