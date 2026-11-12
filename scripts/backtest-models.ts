/**
 * CLI runner for the walk-forward M1/M2 backtest + calibration engine (WS3).
 *
 * Usage:
 *   bun scripts/backtest-models.ts                          # 30d, all Curated-58 perps
 *   bun scripts/backtest-models.ts --days 90                # 90d sweep
 *   bun scripts/backtest-models.ts --assets BTC,ETH,NVDA    # subset
 *   bun scripts/backtest-models.ts --json /tmp/out.json     # also copy the full result
 *
 * Writes:
 *   data/cg-series/backtest-last.json   (full run: trades, metrics, equity, sensitivity)
 *   data/cg-series/calibration.json     (curves + logit fits — probability.ts reads this)
 *
 * Every number in the output comes from real Binance klines + funding history,
 * replayed strictly walk-forward with stop-first intrabar accounting, tiered
 * fees/slippage and historical 8h funding costs. See src/lib/cg/backtest.ts.
 */

import { runBacktest, type BtRunResult } from "../src/lib/cg/backtest";

function arg(name: string): string | null {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : null;
}

const days = Math.max(7, Math.min(90, Number(arg("days") ?? 30) || 30));
const assets = arg("assets")?.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean) ?? undefined;
const jsonOut = arg("json");

const t0 = Date.now();
console.log(`[backtest-models] days=${days} assets=${assets ? assets.join(",") : "ALL Curated-58"}`);
const result: BtRunResult = await runBacktest({ days, syms: assets });
const dt = ((Date.now() - t0) / 1000).toFixed(1);

const m = result.metricsAll;
const m1 = result.byModel["M1_TREND_PULLBACK"];
const m2 = result.byModel["M2_MEAN_REVERSION"];
console.log(`[backtest-models] done in ${dt}s — ${result.universe.length} assets, ${result.trades.length} trades`);
console.log("");
console.log("== ALL MODELS ==");
console.log(
  `  trades=${m.trades} fill=${m.fillRatePct ?? "–"}% win=${m.winRatePct ?? "–"}% PF=${m.profitFactor ?? "–"} ` +
    `expNet=${m.expectancyNetR ?? "–"}R total=${m.totalNetR}R maxDD=${m.maxDrawdownR}R (${m.maxDrawdownPct ?? "–"}%) ` +
    `sharpe/trade=${m.sharpePerTrade ?? "–"} sortino=${m.sortinoPerTrade ?? "–"}`
);
console.log("== M1 TREND_PULLBACK ==");
console.log(
  `  armed=${m1.armed} fill=${m1.fillRatePct ?? "–"}% win=${m1.winRatePct ?? "–"}% PF=${m1.profitFactor ?? "–"} ` +
    `expNet=${m1.expectancyNetR ?? "–"}R avgHold=${m1.avgHoldH ?? "–"}h MFE p50=${m1.mfe.p50 ?? "–"}R MAE p50=${m1.mae.p50 ?? "–"}R`
);
console.log("== M2 MEAN_REVERSION ==");
console.log(
  `  armed=${m2.armed} fill=${m2.fillRatePct ?? "–"}% win=${m2.winRatePct ?? "–"}% PF=${m2.profitFactor ?? "–"} ` +
    `expNet=${m2.expectancyNetR ?? "–"}R avgHold=${m2.avgHoldH ?? "–"}h MFE p50=${m2.mfe.p50 ?? "–"}R MAE p50=${m2.mae.p50 ?? "–"}R`
);
console.log("== SENSITIVITY GRID ==");
for (const cell of result.sensitivity) {
  console.log(
    `  ${cell.axis}=${cell.value} (${cell.model}): trades=${cell.metrics.trades} win=${cell.metrics.winRatePct ?? "–"}% ` +
      `expNet=${cell.metrics.expectancyNetR ?? "–"}R PF=${cell.metrics.profitFactor ?? "–"}`
  );
}
console.log("== CALIBRATION CURVES ==");
for (const c of result.calibration.filter((x) => x.regime === "all" && x.tier === "all")) {
  console.log(
    `  ${c.model}: n=${c.n} winRate=${c.winRate} avgNetR=${c.avgNetR} fit=${c.logitFit ? `σ(${c.logitFit.intercept} + ${c.logitFit.slope}·logit(prior)) converged=${c.logitFit.converged}` : "n/a"}`
  );
}
console.log("== COVERAGE (assets with < 1200 bars — 12.5d of 15m — were skipped; % is vs the requested window) ==");
for (const c of result.coverage.filter((x) => x.coveragePct < 95)) {
  console.log(`  ${c.sym}: ${c.coveragePct}% bars=${c.bars}/${c.expectedBars} funding=${c.fundingEvents}`);
}
if (result.coverage.every((x) => x.coveragePct >= 95)) console.log("  all assets ≥ 95% coverage");
if (jsonOut) {
  const fs = await import("fs");
  fs.writeFileSync(jsonOut, JSON.stringify(result));
  console.log(`[backtest-models] full result copied to ${jsonOut}`);
}
console.log(`[backtest-models] persisted data/cg-series/backtest-last.json + calibration.json`);
