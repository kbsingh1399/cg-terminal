"use client";

import { useCallback, useMemo, useState } from "react";
import { usePolling } from "./use-cg-data";
import type { BtMetrics, BtRunResult } from "@/lib/cg/backtest";

/**
 * BacktestTool (WS3, 2026-11-12) — walk-forward M1/M2 analytics tab.
 *
 * Equity curve (cumulative net R), per-model / per-regime / per-tier / monthly
 * breakdowns, MFE/MAE scatter, parameter sensitivity grid (M2 σ threshold ×
 * M1 R filter) and CSV/JSON export — everything served by /api/cg/backtest
 * from REAL historical Binance klines replayed strictly walk-forward with
 * stop-first accounting, tiered fees/slippage and historical funding.
 */

type BtPayload = BtRunResult & {
  ok: boolean;
  started?: boolean;
  status?: { running: boolean; progress: { total: number; done: number; current: string | null }; lastError: string | null };
};

function fmtNum(v: number | null | undefined, d = 2): string {
  if (v == null || !Number.isFinite(v)) return "–";
  return v.toFixed(d);
}

function metricsLine(label: string, m: BtMetrics | undefined): string {
  if (!m) return `${label}: n/a`;
  return `${label}: trades ${m.trades} · fill ${m.fillRatePct ?? "–"}% · win ${m.winRatePct ?? "–"}% · PF ${m.profitFactor ?? "–"} · expNet ${fmtNum(m.expectancyNetR)}R · DD ${m.maxDrawdownR}R`;
}

/** inline SVG equity curve — cumulative net R over trade exits */
function EquityCurve({ points }: { points: { t: number; cumNetR: number }[] }) {
  const W = 900;
  const H = 220;
  const P = { l: 44, r: 10, t: 12, b: 20 };
  if (points.length < 2) {
    return <div className="flex h-[220px] items-center justify-center text-xs text-neutral-600">not enough closed trades for an equity curve</div>;
  }
  const xs = points.map((p) => p.t);
  const ys = points.map((p) => p.cumNetR);
  const x0 = Math.min(...xs);
  const x1 = Math.max(...xs);
  const y0 = Math.min(0, ...ys);
  const y1 = Math.max(...ys);
  const sx = (t: number) => P.l + ((t - x0) / Math.max(1, x1 - x0)) * (W - P.l - P.r);
  const sy = (v: number) => H - P.b - ((v - y0) / Math.max(1e-9, y1 - y0)) * (H - P.t - P.b);
  const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${sx(p.t).toFixed(1)},${sy(p.cumNetR).toFixed(1)}`).join(" ");
  const zeroY = sy(0);
  const last = points[points.length - 1];
  const up = last.cumNetR >= 0;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="cumulative net R equity curve">
      <line x1={P.l} y1={zeroY} x2={W - P.r} y2={zeroY} stroke="#404040" strokeDasharray="4 3" strokeWidth="1" />
      <path d={`${path} L${sx(last.t).toFixed(1)},${zeroY} L${sx(points[0].t).toFixed(1)},${zeroY} Z`} fill={up ? "rgba(16,185,129,0.10)" : "rgba(244,63,94,0.10)"} />
      <path d={path} fill="none" stroke={up ? "#10b981" : "#f43f5e"} strokeWidth="1.6" />
      <text x={4} y={P.t + 4} fontSize="10" fill="#a3a3a3">{y1.toFixed(1)}R</text>
      <text x={4} y={H - P.b} fontSize="10" fill="#a3a3a3">{y0.toFixed(1)}R</text>
      <text x={P.l} y={H - 6} fontSize="9" fill="#737373">{new Date(x0).toISOString().slice(0, 10)}</text>
      <text x={W - P.r - 80} y={H - 6} fontSize="9" fill="#737373">{new Date(x1).toISOString().slice(0, 10)}</text>
      <text x={W - P.r - 90} y={P.t + 4} fontSize="11" fill={up ? "#10b981" : "#f43f5e"} fontWeight="bold">
        {last.cumNetR >= 0 ? "+" : ""}{last.cumNetR.toFixed(1)}R net
      </text>
    </svg>
  );
}

/** inline SVG MFE/MAE scatter — every closed trade's excursion pair (in R) */
function MfeMaeScatter({ trades }: { trades: NonNullable<BtPayload["trades"]> }) {
  const W = 420;
  const H = 300;
  const P = { l: 34, r: 8, t: 10, b: 26 };
  const pts = trades.filter((t) => t.mfeR != null && t.maeR != null);
  if (!pts.length) return <div className="flex h-[300px] items-center justify-center text-xs text-neutral-600">no closed trades</div>;
  const mfeMax = Math.max(1, ...pts.map((t) => t.mfeR as number));
  const maeMin = Math.min(-1, ...pts.map((t) => t.maeR as number));
  const sx = (v: number) => P.l + ((v - maeMin) / (mfeMax - maeMin)) * (W - P.l - P.r);
  const sy = (v: number) => H - P.b - (v / mfeMax) * (H - P.t - P.b);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="MFE vs MAE scatter (R units)">
      <line x1={P.l} y1={sy(0)} x2={W - P.r} y2={sy(0)} stroke="#404040" strokeWidth="1" />
      <line x1={sx(0)} y1={P.t} x2={sx(0)} y2={H - P.b} stroke="#404040" strokeDasharray="3 3" strokeWidth="1" />
      {pts.map((t, i) => {
        const win = (t.netR ?? 0) > 0;
        return <circle key={i} cx={sx(t.maeR as number)} cy={sy(t.mfeR as number)} r="2.6" fill={win ? "#10b981" : "#f43f5e"} fillOpacity="0.55" />;
      })}
      <text x={4} y={P.t + 8} fontSize="9" fill="#a3a3a3">MFE +{mfeMax.toFixed(1)}R</text>
      <text x={4} y={H - P.b - 2} fontSize="9" fill="#a3a3a3">0</text>
      <text x={P.l} y={H - 10} fontSize="9" fill="#a3a3a3">MAE {maeMin.toFixed(1)}R</text>
      <text x={W - P.r - 30} y={H - 10} fontSize="9" fill="#a3a3a3">0</text>
      <text x={W - P.r - 60} y={P.t + 8} fontSize="9" fill="#737373">green = net win</text>
    </svg>
  );
}

function MetricsTable({ rows }: { rows: { label: string; m: BtMetrics | undefined }[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-neutral-800 bg-[#11151a]">
      <table className="w-full min-w-[820px] border-collapse text-left text-[11px]">
        <thead>
          <tr className="border-b border-neutral-800 bg-[#0d1117] text-[10px] uppercase tracking-wider text-neutral-500">
            <th className="px-3 py-2">Bucket</th>
            <th className="px-2 py-2 text-right">Trades</th>
            <th className="px-2 py-2 text-right">Fill %</th>
            <th className="px-2 py-2 text-right">Win %</th>
            <th className="px-2 py-2 text-right">PF</th>
            <th className="px-2 py-2 text-right">Exp Net R</th>
            <th className="px-2 py-2 text-right">Total R</th>
            <th className="px-2 py-2 text-right">MaxDD R</th>
            <th className="px-2 py-2 text-right">Sharpe</th>
            <th className="px-2 py-2 text-right">MFE p50</th>
            <th className="px-2 py-2 text-right">MAE p50</th>
            <th className="px-2 py-2 text-right">Hold h</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-800/60 font-mono tabular-nums">
          {rows.map(({ label, m }) => (
            <tr key={label} className="hover:bg-neutral-800/40">
              <td className="px-3 py-1.5 font-sans font-medium text-neutral-200">{label}</td>
              <td className="px-2 py-1.5 text-right">{m?.trades ?? "–"}</td>
              <td className="px-2 py-1.5 text-right">{m?.fillRatePct ?? "–"}</td>
              <td className="px-2 py-1.5 text-right">{m?.winRatePct ?? "–"}</td>
              <td className={`px-2 py-1.5 text-right ${(m?.profitFactor ?? 0) >= 1 ? "text-emerald-400" : "text-rose-400"}`}>{m?.profitFactor ?? "–"}</td>
              <td className={`px-2 py-1.5 text-right ${(m?.expectancyNetR ?? 0) > 0 ? "text-emerald-400" : "text-rose-400"}`}>{fmtNum(m?.expectancyNetR)}</td>
              <td className={`px-2 py-1.5 text-right ${(m?.totalNetR ?? 0) >= 0 ? "text-emerald-400" : "text-rose-400"}`}>{fmtNum(m?.totalNetR, 1)}</td>
              <td className="px-2 py-1.5 text-right">{m?.maxDrawdownR ?? "–"}</td>
              <td className="px-2 py-1.5 text-right">{m?.sharpePerTrade ?? "–"}</td>
              <td className="px-2 py-1.5 text-right">{fmtNum(m?.mfe.p50)}</td>
              <td className="px-2 py-1.5 text-right">{fmtNum(m?.mae.p50)}</td>
              <td className="px-2 py-1.5 text-right">{m?.avgHoldH ?? "–"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function BacktestTool({ sym: _sym }: { sym: string }) {
  const running = false; // placeholder to keep hooks order stable if we add local state later
  void running;
  const [runDays, setRunDays] = useState(30);
  const [runMsg, setRunMsg] = useState<string | null>(null);
  const q = usePolling<BtPayload>("/api/cg/backtest?trades=1", 15_000);
  const data = q.data;
  const status = data?.status;
  const isRunning = Boolean(status?.running);

  const triggerRun = useCallback(async () => {
    setRunMsg(null);
    try {
      const res = await fetch(`/api/cg/backtest?run=1&days=${runDays}`);
      const j = (await res.json()) as { ok: boolean; error?: string; started?: boolean };
      setRunMsg(j.ok ? `run started (${runDays}d sweep across the Curated-58 — progress below)` : (j.error ?? "run failed"));
    } catch (e) {
      setRunMsg(e instanceof Error ? e.message : "run request failed");
    }
  }, [runDays]);

  const monthRows = useMemo(
    () =>
      Object.entries(data?.byMonth ?? {})
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([label, m]) => ({ label, m })),
    [data?.byMonth]
  );

  if (q.error && !data) {
    return (
      <div className="rounded-lg border border-rose-900/50 bg-rose-950/30 px-4 py-3 text-xs text-rose-300">
        Backtest feed failed: {q.error}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* header / controls */}
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-neutral-800 bg-[#11151a] px-4 py-2.5">
        <div>
          <div className="text-sm font-semibold text-neutral-100">Walk-Forward Backtest · M1 Trend-Pullback &amp; M2 Mean-Reversion</div>
          <div className="text-[10px] text-neutral-500">
            {data ? `${data.params.days}d · ${data.universe.length} Curated-58 perps · ${data.trades.length} trades · generated ${new Date(data.generatedAt).toISOString().slice(0, 16).replace("T", " ")}Z` : "no run yet"}
            {data ? ` · ${data.source}` : ""}
          </div>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <select
            value={runDays}
            onChange={(e) => setRunDays(Number(e.target.value))}
            className="rounded-md border border-neutral-800 bg-[#0b0e11] px-2 py-1 text-xs text-neutral-100"
          >
            {[7, 14, 30, 60, 90].map((d) => (
              <option key={d} value={d}>{d} days</option>
            ))}
          </select>
          <button
            onClick={() => void triggerRun()}
            disabled={isRunning}
            className="rounded-md bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-300 ring-1 ring-emerald-500/40 hover:bg-emerald-500/25 disabled:opacity-40"
          >
            {isRunning ? "running…" : "Re-run backtest"}
          </button>
          <a
            href="/api/cg/backtest?export=csv"
            className="rounded-md border border-neutral-700 px-2.5 py-1 text-xs text-neutral-300 hover:border-emerald-500 hover:text-emerald-300"
          >
            CSV
          </a>
          <a
            href="/api/cg/backtest?export=json"
            className="rounded-md border border-neutral-700 px-2.5 py-1 text-xs text-neutral-300 hover:border-emerald-500 hover:text-emerald-300"
          >
            JSON
          </a>
        </div>
      </div>

      {(isRunning || runMsg) && (
        <div className="rounded-lg border border-amber-900/50 bg-amber-950/20 px-4 py-2 text-xs text-amber-300">
          {isRunning
            ? `backtest running — asset ${status?.progress.done ?? 0}/${status?.progress.total ?? "?"} (${status?.progress.current ?? "…"})`
            : runMsg}
          {status?.lastError ? <span className="ml-2 text-rose-300">last error: {status.lastError}</span> : null}
        </div>
      )}

      {!data?.trades?.length && !isRunning && (
        <div className="rounded-lg border border-neutral-800 bg-[#11151a] px-4 py-6 text-center text-xs text-neutral-500">
          {q.loading ? "loading backtest…" : "no backtest result on disk yet — press Re-run (first run fetches ~30 days of 15m klines per asset, typically 1-3 minutes)"}
        </div>
      )}

      {data?.trades?.length ? (
        <>
          {/* equity curve */}
          <div className="rounded-lg border border-neutral-800 bg-[#11151a] p-3">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">Equity Curve — cumulative net R (after fees, slippage, funding)</span>
              <span className="font-mono text-[10px] text-neutral-500">
                sharpe/trade {fmtNum(data.metricsAll.sharpePerTrade, 3)} · sortino {fmtNum(data.metricsAll.sortinoPerTrade, 3)} · maxDD {data.metricsAll.maxDrawdownR}R ({data.metricsAll.maxDrawdownPct ?? "–"}% @ 1% risk/trade)
              </span>
            </div>
            <EquityCurve points={data.equity} />
          </div>

          {/* headline metrics by model / regime / tier */}
          <div className="space-y-2">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">Per-Model · Per-Regime · Per-Asset-Class</div>
            <MetricsTable
              rows={[
                { label: "ALL", m: data.metricsAll },
                { label: "M1 Trend-Pullback", m: data.byModel?.["M1_TREND_PULLBACK"] },
                { label: "M2 Mean-Reversion", m: data.byModel?.["M2_MEAN_REVERSION"] },
                { label: "Regime · TREND_UP", m: data.byRegime?.["TREND_UP"] },
                { label: "Regime · TREND_DOWN", m: data.byRegime?.["TREND_DOWN"] },
                { label: "Regime · STRETCH (M2)", m: data.byRegime?.["STRETCH"] },
                { label: "Tier · Crypto Majors", m: data.byTier?.["crypto-major"] },
                { label: "Tier · Crypto Alts", m: data.byTier?.["crypto-alt"] },
                { label: "Tier · TradFi perps", m: data.byTier?.["tradfi"] },
              ]}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {/* monthly breakdown */}
            <div className="space-y-2">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">Monthly Breakdown</div>
              <MetricsTable rows={monthRows} />
            </div>

            {/* MFE/MAE */}
            <div className="space-y-2">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">MFE / MAE (R units, per closed trade)</div>
              <div className="rounded-lg border border-neutral-800 bg-[#11151a] p-3">
                <MfeMaeScatter trades={data.trades} />
                <div className="mt-1 grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-[10px] text-neutral-400">
                  {(["M1_TREND_PULLBACK", "M2_MEAN_REVERSION"] as const).map((mo) => {
                    const m = data.byModel?.[mo];
                    return (
                      <div key={mo}>
                        <span className="text-neutral-300">{mo === "M1_TREND_PULLBACK" ? "M1" : "M2"}</span> MFE p25/p50/p75{" "}
                        {fmtNum(m?.mfe.p25)}/{fmtNum(m?.mfe.p50)}/{fmtNum(m?.mfe.p75)}R · MAE {fmtNum(m?.mae.p25)}/{fmtNum(m?.mae.p50)}/{fmtNum(m?.mae.p75)}R
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* sensitivity grid */}
          <div className="space-y-2">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">Parameter Sensitivity (representative 20-asset subset)</div>
            <div className="overflow-x-auto rounded-lg border border-neutral-800 bg-[#11151a]">
              <table className="w-full min-w-[640px] border-collapse text-left text-[11px]">
                <thead>
                  <tr className="border-b border-neutral-800 bg-[#0d1117] text-[10px] uppercase tracking-wider text-neutral-500">
                    <th className="px-3 py-2">Axis</th>
                    <th className="px-2 py-2 text-right">Value</th>
                    <th className="px-2 py-2 text-right">Trades</th>
                    <th className="px-2 py-2 text-right">Win %</th>
                    <th className="px-2 py-2 text-right">PF</th>
                    <th className="px-2 py-2 text-right">Exp Net R</th>
                    <th className="px-2 py-2 text-right">Total R</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800/60 font-mono tabular-nums">
                  {data.sensitivity?.map((c, i) => (
                    <tr key={i} className="hover:bg-neutral-800/40">
                      <td className="px-3 py-1.5 font-sans">{c.axis === "m2Sigma" ? "M2 σ threshold" : "M1 R filter"}</td>
                      <td className="px-2 py-1.5 text-right">{c.value}</td>
                      <td className="px-2 py-1.5 text-right">{c.metrics.trades}</td>
                      <td className="px-2 py-1.5 text-right">{c.metrics.winRatePct ?? "–"}</td>
                      <td className={`px-2 py-1.5 text-right ${(c.metrics.profitFactor ?? 0) >= 1 ? "text-emerald-400" : "text-rose-400"}`}>{c.metrics.profitFactor ?? "–"}</td>
                      <td className={`px-2 py-1.5 text-right ${(c.metrics.expectancyNetR ?? 0) > 0 ? "text-emerald-400" : "text-rose-400"}`}>{fmtNum(c.metrics.expectancyNetR)}</td>
                      <td className={`px-2 py-1.5 text-right ${(c.metrics.totalNetR ?? 0) >= 0 ? "text-emerald-400" : "text-rose-400"}`}>{fmtNum(c.metrics.totalNetR, 1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* calibration summary */}
          <div className="space-y-2">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
              Calibration Curves (probability.ts blends these with w_emp = n/(n+30))
            </div>
            <div className="overflow-x-auto rounded-lg border border-neutral-800 bg-[#11151a]">
              <table className="w-full min-w-[720px] border-collapse text-left text-[11px]">
                <thead>
                  <tr className="border-b border-neutral-800 bg-[#0d1117] text-[10px] uppercase tracking-wider text-neutral-500">
                    <th className="px-3 py-2">Model</th>
                    <th className="px-2 py-2">Regime</th>
                    <th className="px-2 py-2">Tier</th>
                    <th className="px-2 py-2 text-right">n</th>
                    <th className="px-2 py-2 text-right">Win rate</th>
                    <th className="px-2 py-2 text-right">Avg net R</th>
                    <th className="px-2 py-2 text-left">Logit fit σ(a + b·logit(prior))</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800/60 font-mono tabular-nums">
                  {data.calibration?.slice(0, 24).map((c, i) => (
                    <tr key={i} className="hover:bg-neutral-800/40">
                      <td className="px-3 py-1.5 font-sans">{c.model === "M1_TREND_PULLBACK" ? "M1" : "M2"}</td>
                      <td className="px-2 py-1.5 font-sans">{c.regime}</td>
                      <td className="px-2 py-1.5 font-sans">{c.tier}</td>
                      <td className="px-2 py-1.5 text-right">{c.n}</td>
                      <td className="px-2 py-1.5 text-right">{c.winRate ?? "–"}</td>
                      <td className={`px-2 py-1.5 text-right ${(c.avgNetR ?? 0) > 0 ? "text-emerald-400" : "text-rose-400"}`}>{c.avgNetR ?? "–"}</td>
                      <td className="px-2 py-1.5 text-left text-neutral-400">
                        {c.logitFit ? `σ(${c.logitFit.intercept} + ${c.logitFit.slope}·x)${c.logitFit.converged ? "" : " (not converged)"}` : "n/a"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="text-[10px] text-neutral-600">
              {metricsLine("M1", data.byModel?.["M1_TREND_PULLBACK"])}
              <br />
              {metricsLine("M2", data.byModel?.["M2_MEAN_REVERSION"])}
            </div>
          </div>

          {/* data coverage honesty strip */}
          <div className="rounded-lg border border-neutral-800 bg-[#11151a] px-4 py-2 text-[10px] text-neutral-500">
            Coverage: {data.coverage?.filter((c) => c.coveragePct >= 60).length ?? 0}/{data.universe?.length ?? 0} assets with ≥ 60% bar coverage
            {data.coverage?.some((c) => c.coveragePct < 60)
              ? ` · skipped (gaps): ${data.coverage.filter((c) => c.coveragePct < 60).map((c) => c.sym).join(", ")}`
              : ""}
            · funding events loaded: {data.coverage?.reduce((s, c) => s + c.fundingEvents, 0) ?? 0} · stop-first intrabar accounting · taker{" "}
            {data.params.takerFeeBps}bps / maker {data.params.makerFeeBps}bps + tier spread &amp; ATR slippage
          </div>
        </>
      ) : null}
    </div>
  );
}
