"use client";

import { useMemo } from "react";
import { usePolling } from "./use-cg-data";
import StopmapCanvas from "./charts/stopmap-canvas";
import { assetOf } from "@/lib/cg/assets";

/**
 * Stops (liquidation heatmap) — the intra-day leveraged-position stop map
 * from the Coinglass /pro/futures/LiquidationHeatMap page (Model 1):
 * 24h of 5-minute estimated liquidation exposure, per price level.
 * Window: 288 bars; the local continuity engine archives every window so
 * history accumulates without gaps while you host it locally.
 */

interface StopmapResponse {
  ok: boolean;
  error?: string;
  sym: string;
  window: { interval: string; bars: number; from: number; to: number };
  instrument: string;
  model: {
    candles: { ts: number; o: number; h: number; l: number; c: number }[];
    y: number[];
    grid: { ts: number; cells: [number, number][] }[];
    profile: number[];
    lastPrice: number;
    clusters: {
      below: { price: number; usd: number; distPct: number; strength: number }[];
      above: { price: number; usd: number; distPct: number; strength: number }[];
    };
    bands: { a: number; b: number; below: number; above: number }[];
    totals: { below: number; above: number; all: number; rows: number };
  };
}

function fmtB(n: number): string {
  const a = Math.abs(n);
  if (a >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (a >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (a >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return n.toFixed(0);
}

export default function StopmapSection({ sym = "BTC" }: { sym?: string }) {
  const q = usePolling<StopmapResponse>(`/api/cg/stopmap?sym=${sym}`, 60_000);
  // defense-in-depth: never render a model that belongs to another symbol
  const m = q.data && q.data.sym === sym ? q.data.model : undefined;
  const decs = assetOf(sym)?.priceDecs ?? 2;
  const fmtP = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: decs, maximumFractionDigits: decs });

  const bandMax = useMemo(() => (m ? Math.max(1, ...m.bands.map((b) => b.below + b.above)) : 1), [m]);

  if (!m) {
    return (
      <div className="flex h-64 items-center justify-center rounded-lg border border-neutral-800 bg-neutral-900/60 text-sm text-neutral-500">
        {q.loading ? "Loading 24h liquidation heatmap…" : q.error ? `Stops data error: ${q.error}` : "No data"}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-5">
        <div className="rounded-lg border border-neutral-800 bg-neutral-900/60 px-3 py-2">
          <div className="text-[10px] uppercase tracking-wide text-neutral-500">Last price</div>
          <div className="mt-0.5 font-mono text-sm font-semibold text-neutral-100">{fmtP(m.lastPrice)}</div>
          <div className="text-[10px] text-neutral-500">{q.data?.instrument} · 24h / 5m grid</div>
        </div>
        <div className="rounded-lg border border-neutral-800 bg-neutral-900/60 px-3 py-2">
          <div className="text-[10px] uppercase tracking-wide text-neutral-500">Long stops below</div>
          <div className="mt-0.5 font-mono text-sm font-semibold text-emerald-400">{fmtB(m.totals.below)}</div>
          <div className="text-[10px] text-neutral-500">estimated exposure under price</div>
        </div>
        <div className="rounded-lg border border-neutral-800 bg-neutral-900/60 px-3 py-2">
          <div className="text-[10px] uppercase tracking-wide text-neutral-500">Short stops above</div>
          <div className="mt-0.5 font-mono text-sm font-semibold text-red-400">{fmtB(m.totals.above)}</div>
          <div className="text-[10px] text-neutral-500">estimated exposure over price</div>
        </div>
        <div className="rounded-lg border border-neutral-800 bg-neutral-900/60 px-3 py-2">
          <div className="text-[10px] uppercase tracking-wide text-neutral-500">Sweep magnet</div>
          <div className="mt-0.5 font-mono text-sm font-semibold text-neutral-100">
            {fmtP([...m.clusters.below, ...m.clusters.above].sort((a, b) => b.usd - a.usd)[0]?.price ?? 0)}
          </div>
          <div className="text-[10px] text-neutral-500">strongest cluster (24h build-up)</div>
        </div>
        <div className="rounded-lg border border-neutral-800 bg-neutral-900/60 px-3 py-2">
          <div className="text-[10px] uppercase tracking-wide text-neutral-500">Heat cells</div>
          <div className="mt-0.5 font-mono text-sm font-semibold text-neutral-100">{fmtB(m.totals.rows)}</div>
          <div className="text-[10px] text-neutral-500">{m.y.length} price levels tracked</div>
        </div>
      </div>

      <div className="rounded-lg border border-neutral-800 bg-neutral-900/60 p-2">
        <StopmapCanvas model={m} height={380} priceDecs={decs} />
      </div>

      <div className="grid gap-3 xl:grid-cols-3">
        {/* clusters below */}
        <div className="rounded-lg border border-neutral-800 bg-neutral-900/60 p-3">
          <h3 className="mb-2 text-sm font-semibold text-neutral-100">
            Long-stop clusters <span className="text-[11px] font-normal text-neutral-500">below price · sweeps target these</span>
          </h3>
          <table className="w-full text-[11px]">
            <thead className="text-neutral-500">
              <tr>
                <th className="py-1 text-left font-medium">Price</th>
                <th className="py-1 text-right font-medium">Distance</th>
                <th className="py-1 text-right font-medium">Exposure</th>
                <th className="py-1 pl-2 text-left font-medium">Strength</th>
              </tr>
            </thead>
            <tbody>
              {m.clusters.below.slice(0, 8).map((c, i) => (
                <tr key={i} className="border-t border-neutral-800/40">
                  <td className="py-1 font-mono text-neutral-200">{fmtP(c.price)}</td>
                  <td className="py-1 text-right font-mono text-emerald-400/80">{c.distPct.toFixed(2)}%</td>
                  <td className="py-1 text-right font-mono text-neutral-300">${fmtB(c.usd)}</td>
                  <td className="py-1 pl-2">
                    <div className="h-2 w-full overflow-hidden rounded bg-neutral-800">
                      <div className="h-full bg-emerald-500/80" style={{ width: `${c.strength}%` }} />
                    </div>
                  </td>
                </tr>
              ))}
              {!m.clusters.below.length && (
                <tr><td colSpan={4} className="py-4 text-center text-neutral-600">No clusters below.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* clusters above */}
        <div className="rounded-lg border border-neutral-800 bg-neutral-900/60 p-3">
          <h3 className="mb-2 text-sm font-semibold text-neutral-100">
            Short-stop clusters <span className="text-[11px] font-normal text-neutral-500">above price · squeeze fuel</span>
          </h3>
          <table className="w-full text-[11px]">
            <thead className="text-neutral-500">
              <tr>
                <th className="py-1 text-left font-medium">Price</th>
                <th className="py-1 text-right font-medium">Distance</th>
                <th className="py-1 text-right font-medium">Exposure</th>
                <th className="py-1 pl-2 text-left font-medium">Strength</th>
              </tr>
            </thead>
            <tbody>
              {m.clusters.above.slice(0, 8).map((c, i) => (
                <tr key={i} className="border-t border-neutral-800/40">
                  <td className="py-1 font-mono text-neutral-200">{fmtP(c.price)}</td>
                  <td className="py-1 text-right font-mono text-red-400/80">+{c.distPct.toFixed(2)}%</td>
                  <td className="py-1 text-right font-mono text-neutral-300">${fmtB(c.usd)}</td>
                  <td className="py-1 pl-2">
                    <div className="h-2 w-full overflow-hidden rounded bg-neutral-800">
                      <div className="h-full bg-red-500/80" style={{ width: `${c.strength}%` }} />
                    </div>
                  </td>
                </tr>
              ))}
              {!m.clusters.above.length && (
                <tr><td colSpan={4} className="py-4 text-center text-neutral-600">No clusters above.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* exposure by distance */}
        <div className="rounded-lg border border-neutral-800 bg-neutral-900/60 p-3">
          <h3 className="mb-2 text-sm font-semibold text-neutral-100">
            Stop exposure by distance <span className="text-[11px] font-normal text-neutral-500">24h build-up</span>
          </h3>
          {m.bands.map((b) => {
            const up = (b.above / bandMax) * 50;
            const down = (b.below / bandMax) * 50;
            return (
              <div key={`${b.a}-${b.b}`} className="mb-1.5 flex items-center gap-2 text-[11px]">
                <span className="w-12 shrink-0 text-right font-mono text-neutral-400">{b.a}–{b.b}%</span>
                <div className="flex h-4 flex-1 items-center justify-end">
                  <div className="h-3 rounded-l bg-red-500/70" style={{ width: `${up}%` }} title={`short stops $${fmtB(b.above)}`} />
                </div>
                <span className="w-20 shrink-0 text-center font-mono text-[10px] text-neutral-500">
                  {fmtB(b.above)} · {fmtB(b.below)}
                </span>
                <div className="flex h-4 flex-1 items-center">
                  <div className="h-3 rounded-r bg-emerald-500/70" style={{ width: `${down}%` }} title={`long stops $${fmtB(b.below)}`} />
                </div>
              </div>
            );
          })}
          <div className="mt-1 flex justify-between text-[10px] text-neutral-500">
            <span>← short stops (above)</span>
            <span>long stops (below) →</span>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-neutral-800 bg-neutral-900/40 px-3 py-2 text-[10px] leading-relaxed text-neutral-500">
        Data-driven, honestly framed: these levels are Coinglass&apos;s model estimates of where leveraged positions
        would be force-closed (from aggregate OI, funding and leverage tiers — exchanges do not publish individual
        liquidation prices). Strong clusters are liquidity magnets that <em>attract</em> sweeps, not guaranteed
        targets: whether price reaches them depends on volatility and order flow at the time. Read them together
        with the 3D/7D/30D levels tab (position-open cohorts) and the Book Walls tab (resting depth). The engine
        archives every 24h window locally, so your multi-day stop map grows gap-free over time.
      </div>
    </div>
  );
}
