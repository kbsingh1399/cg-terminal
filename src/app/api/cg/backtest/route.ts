import { NextRequest, NextResponse } from "next/server";
import { ensureBacktest, backtestStatus, runBacktest } from "@/lib/cg/backtest";

export const dynamic = "force-dynamic";

/**
 * GET /api/cg/backtest — walk-forward M1/M2 backtest results + calibration.
 *
 * Serves the persisted last run (data/cg-series/backtest-last.json); when the
 * result is missing or older than 12 h a background re-run is kicked
 * (status.running + progress is reported — the UI polls until done). Params:
 *   ?run=1      — force a fresh background run (409 if one is already running)
 *   ?days=30    — run length for a forced run (7-90)
 *   ?trades=0   — omit the per-trade table (summary only)
 *   ?export=json|csv — download the full result / trades CSV
 *
 * Every number comes from real Binance klines + funding history replayed
 * strictly walk-forward (stop-first intrabar accounting, tiered
 * fees/slippage, historical funding) — see src/lib/cg/backtest.ts.
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const forceRun = sp.get("run") === "1";

  if (forceRun) {
    const st = backtestStatus();
    if (st.running) {
      return NextResponse.json(
        { ok: false, error: "a backtest run is already in progress", status: st },
        { status: 409 }
      );
    }
    const days = Math.max(7, Math.min(90, Number(sp.get("days") ?? 30) || 30));
    // fire-and-forget: the client polls the status through this same route
    void runBacktest({ days }).catch(() => undefined);
    return NextResponse.json({ ok: true, started: true, status: backtestStatus() });
  }

  const { result, status, started } = ensureBacktest();
  const exportFmt = sp.get("export");
  if (result && exportFmt === "csv") {
    const head = "sym,model,tier,side,regime,armedAt,fillAt,exitAt,entry,stop,t1,t2,exit,exitReason,grossR,netR,feeBps,slipBps,fundingR,mfeR,maeR,priorP1,holdH";
    const rows = result.trades
      .map((t) =>
        [
          t.sym, t.model, t.tier, t.side, t.regime,
          new Date(t.armedAt).toISOString(),
          t.fillAt ? new Date(t.fillAt).toISOString() : "",
          t.exitAt ? new Date(t.exitAt).toISOString() : "",
          t.entry ?? "", t.stop, t.t1, t.t2, t.exit ?? "", t.exitReason ?? "",
          t.grossR ?? "", t.netR ?? "", t.feeBps, t.slipBps, t.fundingR ?? "", t.mfeR ?? "", t.maeR ?? "",
          t.priorP1 ?? "", t.holdH ?? "",
        ].join(",")
      )
      .join("\n");
    return new NextResponse(`${head}\n${rows}`, {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="cg-backtest-${result.generatedAt}.csv"`,
      },
    });
  }
  if (result && exportFmt === "json") {
    return new NextResponse(JSON.stringify(result), {
      headers: {
        "content-type": "application/json",
        "content-disposition": `attachment; filename="cg-backtest-${result.generatedAt}.json"`,
      },
    });
  }

  const omitTrades = sp.get("trades") === "0";
  return NextResponse.json({
    started,
    status,
    ...(result
      ? {
          ...result,
          ...(omitTrades ? { trades: undefined } : {}),
        }
      : { ok: true, result: null }),
  });
}
