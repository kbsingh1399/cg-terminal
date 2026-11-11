"use client";

import { useMemo, useState } from "react";
import { usePolling } from "./use-cg-data";
import type { LiqStats } from "@/lib/cg/liq-model";
import { liqVenues, symDecs } from "@/lib/cg/assets";
import { Button } from "@/components/ui/button";
import StopmapSection from "./stopmap-section";

/**
 * Liquidation levels — 3D / 7D / 30D estimated clusters within ±4% of price,
 * AGGREGATED over Binance + OKX + Bybit (+ Hyperliquid where listed — metals
 * drop it), using the EXACT model of the live Coinglass page (ported in
 * src/lib/cg/liq-model.ts):
 *  - 520-row price grid over 0.88×–1.12× of the candle range
 *  - only levels price has NOT touched yet count as open strength
 *  - key levels = top-5 rows per side within the ±% window, strength
 *    normalized to the strongest row (100)
 *  - leverage tier of a row = h1/h2/h3 (High ~100× / Mid ~50× / Low ~25×)
 *    with the largest summed size in that row
 */

const RANGES = [
  { v: "3d", l: "3D" },
  { v: "7d", l: "7D" },
  { v: "30d", l: "30D" },
] as const;
const WINDOWS = [1, 2, 3, 4, 5, 6, 7, 8] as const;
const VENUE_COLORS: Record<string, string> = {
  Binance: "#f0b90b",
  OKX: "#7cc4ff",
  Bybit: "#f7a600",
  Hyperliquid: "#97fce4",
};

interface LiqResponse {
  ok: boolean;
  error?: string;
  sym: string;
  range: string;
  lvR: number;
  venues: string[];
  perVenue: Record<string, number>;
  stats: LiqStats;
  updatedAt: number;
}

function fmtM(n: number): string {
  const a = Math.abs(n);
  if (a >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (a >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return n.toFixed(a >= 100 ? 0 : 1);
}

export default function LiquidationLevelsTool({ sym = "BTC" }: { sym?: string }) {
  const [range, setRange] = useState<string>("3d");
  const [windowPct, setWindowPct] = useState<number>(4);
  const [tab, setTab] = useState<"levels" | "stops">("levels");

  const liqQ = usePolling<LiqResponse>(tab === "levels" ? `/api/cg/liqlevels?sym=${sym}&range=${range}&lvR=${windowPct}` : null, 30_000);
  // defense-in-depth: never render stats that belong to another symbol
  const stats = liqQ.data?.sym === sym ? liqQ.data.stats ?? null : null;
  const err = liqQ.error;
  const decs = symDecs(sym, stats?.last ?? null);
  const fmtP = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: decs, maximumFractionDigits: decs });
  // venues that actually carry this symbol's liquidation data (response-
  // driven once loaded — Tier-2 symbols discover their venue set live)
  const venueList = (
    liqQ.data?.sym === sym
      ? Object.entries(liqQ.data.perVenue ?? {})
          .filter(([, n]) => n > 0)
          .map(([v]) => v)
      : liqVenues(sym).map((v) => v.name)
  ).join(" + ");

  const bandMax = useMemo(
    () => (stats ? Math.max(1, ...stats.bands.map((b) => b.up + b.down)) : 1),
    [stats]
  );
  const tierMax = useMemo(
    () =>
      stats
        ? Math.max(
            1,
            ...stats.levTiers.shorts,
            ...stats.levTiers.longs
          )
        : 1,
    [stats]
  );

  return (
    <div className="flex flex-col gap-3">
      {/* controls */}
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-neutral-800 bg-neutral-900/60 p-2.5">
        <div className="flex items-center gap-1.5 pr-2">
          <span className="text-sm font-semibold text-neutral-100">{sym}</span>
          <span className="rounded bg-neutral-800 px-1.5 py-0.5 text-[10px] text-neutral-400">
            aggregated · {venueList}
          </span>
        </div>
        <div className="flex overflow-hidden rounded border border-neutral-700">
          <button
            onClick={() => setTab("levels")}
            className={`px-3 py-1 text-xs ${tab === "levels" ? "bg-neutral-700 text-white" : "text-neutral-400 hover:bg-neutral-800"}`}
          >
            Levels 3D/7D/30D
          </button>
          <button
            onClick={() => setTab("stops")}
            className={`px-3 py-1 text-xs ${tab === "stops" ? "bg-neutral-700 text-white" : "text-neutral-400 hover:bg-neutral-800"}`}
          >
            Stops heatmap 24h
          </button>
        </div>
        {tab === "levels" && (
          <>
            <div className="flex overflow-hidden rounded border border-neutral-700">
              {RANGES.map((r) => (
                <button
                  key={r.v}
                  onClick={() => setRange(r.v)}
                  className={`px-3 py-1 text-xs ${range === r.v ? "bg-neutral-700 text-white" : "text-neutral-400 hover:bg-neutral-800"}`}
                >
                  {r.l}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-neutral-500">window</span>
              <div className="flex overflow-hidden rounded border border-neutral-700">
                {WINDOWS.map((w) => (
                  <button
                    key={w}
                    onClick={() => setWindowPct(w)}
                    className={`px-1.5 py-1 text-[11px] ${windowPct === w ? "bg-neutral-700 text-white" : "text-neutral-400 hover:bg-neutral-800"}`}
                  >
                    ±{w}%
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
        <div className="ml-auto flex items-center gap-2">
          <span className={`flex items-center gap-1.5 text-xs ${err ? "text-red-400" : "text-emerald-400"}`}>
            <span className={`inline-block h-1.5 w-1.5 rounded-full ${err ? "bg-red-400" : "animate-pulse bg-emerald-400"}`} />
            {err ? "offline" : "live"}
          </span>
          {tab === "levels" && (
            <Button variant="outline" size="sm" className="h-7 border-neutral-700 text-xs" onClick={() => liqQ.refresh()}>
              Refresh
            </Button>
          )}
        </div>
      </div>

      {tab === "stops" ? (
        sym === "BTC" ? (
          <StopmapSection sym={sym} />
        ) : (
          <div className="flex h-64 flex-col items-center justify-center gap-2 rounded-lg border border-neutral-800 bg-neutral-900/60 text-sm text-neutral-500">
            <div>The 24h stops heatmap is BTC-only on the anonymous Coinglass API.</div>
            <div className="text-xs text-neutral-600">
              The liqHeatMap endpoint rejects {sym} (upstream code 40000). Switch to BTC for the stops map — the 3D/7D/30D
              levels above work for every asset.
            </div>
          </div>
        )
      ) : (
        <>
      {err && (
        <div className="rounded border border-red-900/60 bg-red-950/40 px-3 py-2 text-xs text-red-300">
          Data error: {err} — retrying automatically.
        </div>
      )}

      {!stats ? (
        <div className="flex h-64 items-center justify-center rounded-lg border border-neutral-800 bg-neutral-900/60 text-sm text-neutral-500">
          {liqQ.loading ? "Loading aggregated liquidation levels…" : "No data"}
        </div>
      ) : (
        <>
          {/* summary strip */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
            <Stat label="Last price" value={fmtP(stats.last)} sub={`range ${range.toUpperCase()} · window ±${windowPct}%`} />
            <Stat
              label="Open levels"
              value={fmtM(stats.counts.open)}
              sub={`${fmtM(stats.counts.hit)} already hit`}
            />
            <Stat
              label="Total short strength"
              value={fmtM(stats.totals.shorts)}
              sub="above price (longs get liquidated)"
              tone="down"
            />
            <Stat
              label="Total long strength"
              value={fmtM(stats.totals.longs)}
              sub="below price (shorts get liquidated)"
              tone="up"
            />
            <Stat
              label="Short / long ratio"
              value={(stats.totals.shorts / (stats.totals.longs || 1)).toFixed(2)}
              sub={`${stats.totals.rows} active price rows`}
            />
            <Stat
              label="Venues"
              value={String(stats.counts.venues.length)}
              sub={Object.entries(liqQ.data?.perVenue ?? {})
                .map(([v, n]) => `${v} ${n}`)
                .join(" · ")}
            />
          </div>

          <div className="grid gap-3 xl:grid-cols-2">
            {/* key liquidation levels */}
            <div className="rounded-lg border border-neutral-800 bg-neutral-900/60 p-3">
              <div className="mb-2 flex items-baseline justify-between">
                <h3 className="text-sm font-semibold text-neutral-100">Key liquidation levels</h3>
                <span className="text-[11px] text-neutral-500">
                  Within ±{windowPct}% · sorted by strength · top 5 per side
                </span>
              </div>
              <table className="w-full text-[11px]">
                <thead className="text-neutral-500">
                  <tr>
                    <th className="py-1 text-left font-medium">Side</th>
                    <th className="py-1 text-right font-medium">Price</th>
                    <th className="py-1 text-right font-medium">Distance</th>
                    <th className="py-1 text-right font-medium">Leverage</th>
                    <th className="py-1 pl-3 text-left font-medium">Strength</th>
                  </tr>
                </thead>
                <tbody>
                  {[...stats.keyLevels.above].reverse().map((k, i) => (
                    <KeyRow k={k} fmtP={fmtP} key={`a${i}`} />
                  ))}
                  <tr>
                    <td colSpan={5} className="py-1.5 text-center">
                      <span className="rounded bg-neutral-800 px-2 py-0.5 font-mono text-[11px] text-neutral-300">
                        Last price {fmtP(stats.last)}
                      </span>
                    </td>
                  </tr>
                  {stats.keyLevels.below.map((k, i) => (
                    <KeyRow k={k} fmtP={fmtP} key={`b${i}`} />
                  ))}
                  {!stats.keyLevels.above.length && !stats.keyLevels.below.length && (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-neutral-600">
                        No open levels within ±{windowPct}% on this range.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col gap-3">
              {/* strength by distance */}
              <div className="rounded-lg border border-neutral-800 bg-neutral-900/60 p-3">
                <div className="mb-2 flex items-baseline justify-between">
                  <h3 className="text-sm font-semibold text-neutral-100">Strength by distance</h3>
                  <span className="text-[11px] text-neutral-500">
                    Shorts {fmtM(stats.totals.shorts)} · Longs {fmtM(stats.totals.longs)}
                  </span>
                </div>
                {stats.bands.map((b) => {
                  const up = (b.up / bandMax) * 50;
                  const down = (b.down / bandMax) * 50;
                  return (
                    <div key={`${b.a}-${b.b}`} className="mb-1.5 flex items-center gap-2 text-[11px]">
                      <span className="w-12 shrink-0 text-right font-mono text-neutral-400">
                        {b.a}–{b.b}%
                      </span>
                      <div className="flex h-4 flex-1 items-center justify-end">
                        <div className="h-3 rounded-l bg-red-500/70" style={{ width: `${up}%` }} title={`shorts ${fmtM(b.up)}`} />
                      </div>
                      <span className="w-24 shrink-0 text-center font-mono text-[10px] text-neutral-500">
                        {fmtM(b.up)} · {fmtM(b.down)}
                      </span>
                      <div className="flex h-4 flex-1 items-center">
                        <div className="h-3 rounded-r bg-emerald-500/70" style={{ width: `${down}%` }} title={`longs ${fmtM(b.down)}`} />
                      </div>
                    </div>
                  );
                })}
                <div className="mt-1 flex justify-between text-[10px] text-neutral-500">
                  <span>← short strength (above price)</span>
                  <span>long strength (below price) →</span>
                </div>
              </div>

              {/* leverage tiers */}
              <div className="rounded-lg border border-neutral-800 bg-neutral-900/60 p-3">
                <div className="mb-2 flex items-baseline justify-between">
                  <h3 className="text-sm font-semibold text-neutral-100">By leverage tier</h3>
                  <span className="text-[11px] text-neutral-500">open-level strength per tier</span>
                </div>
                {(["High", "Mid", "Low"] as const).map((label, tier) => {
                  const s = stats.levTiers.shorts[tier];
                  const l = stats.levTiers.longs[tier];
                  return (
                    <div key={label} className="mb-1.5 flex items-center gap-2 text-[11px]">
                      <span className="w-24 shrink-0 text-neutral-400">{label} leverage</span>
                      <div className="flex h-4 flex-1 items-center justify-end gap-0.5">
                        <div className="h-3 rounded-l bg-red-500/70" style={{ width: `${(s / tierMax) * 50}%` }} />
                      </div>
                      <span className="w-28 shrink-0 text-center font-mono text-[10px] text-neutral-500">
                        {fmtM(s)} · {fmtM(l)}
                      </span>
                      <div className="flex h-4 flex-1 items-center gap-0.5">
                        <div className="h-3 rounded-r bg-emerald-500/70" style={{ width: `${(l / tierMax) * 50}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* venue contribution of the key clusters */}
              <div className="rounded-lg border border-neutral-800 bg-neutral-900/60 p-3">
                <h3 className="mb-2 text-sm font-semibold text-neutral-100">Venue contribution · key clusters</h3>
                <div className="flex flex-wrap gap-3 text-[11px]">
                  {[...stats.keyLevels.above.slice(0, 3), ...stats.keyLevels.below.slice(0, 3)].map((k, i) => (
                    <div key={i} className="min-w-[130px] rounded border border-neutral-800 bg-neutral-900 px-2 py-1.5">
                      <div className="font-mono text-neutral-300">{fmtP(k.price)}</div>
                      <div className="mt-1 flex gap-1">
                        {k.venues.map((v) => (
                          <span key={v} className="inline-block h-1.5 w-4 rounded-full" style={{ background: VENUE_COLORS[v] ?? "#888" }} title={v} />
                        ))}
                      </div>
                      <div className="mt-0.5 text-[10px] text-neutral-500">
                        {k.lev} · strength {k.strength}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-neutral-800 bg-neutral-900/40 px-3 py-2 text-[10px] leading-relaxed text-neutral-500">
            Levels are estimated from open interest and common leverage settings — they are not resting orders. A level
            stops counting once price has touched it (endX set). Strength is the summed estimated size of open levels in
            the price row, normalized so the strongest key row = 100. Aggregated over {venueList} with the live
            page&apos;s exact 520-row grid model.
          </div>
        </>
      )}
      </>
      )}
    </div>
  );
}

function KeyRow({ k, fmtP }: { k: LiqStats["keyLevels"]["above"][number]; fmtP: (n: number) => string }) {
  const short = k.side === "short";
  return (
    <tr className="border-t border-neutral-800/40">
      <td className="py-1.5">
        <span className={`rounded px-1 py-0.5 text-[10px] font-semibold ${short ? "bg-red-900/60 text-red-400" : "bg-emerald-900/60 text-emerald-400"}`}>
          {short ? "Short" : "Long"}
        </span>
      </td>
      <td className="py-1.5 text-right font-mono text-neutral-200">{fmtP(k.price)}</td>
      <td className={`py-1.5 text-right font-mono ${short ? "text-red-400/80" : "text-emerald-400/80"}`}>
        {k.distPct > 0 ? "+" : ""}
        {k.distPct.toFixed(2)}%
      </td>
      <td className="py-1.5 text-right text-neutral-400">{k.lev} leverage</td>
      <td className="py-1.5 pl-3">
        <div className="flex items-center gap-2">
          <div className="h-2 flex-1 overflow-hidden rounded bg-neutral-800">
            <div
              className={`h-full ${short ? "bg-red-500/80" : "bg-emerald-500/80"}`}
              style={{ width: `${k.strength}%` }}
            />
          </div>
          <span className="w-10 shrink-0 text-right font-mono text-neutral-300">{k.strength.toFixed(1)}</span>
        </div>
      </td>
    </tr>
  );
}

function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "up" | "down" }) {
  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900/60 px-3 py-2">
      <div className="truncate text-[10px] uppercase tracking-wide text-neutral-500">{label}</div>
      <div
        className={`mt-0.5 font-mono text-sm font-semibold ${
          tone === "up" ? "text-emerald-400" : tone === "down" ? "text-red-400" : "text-neutral-100"
        }`}
      >
        {value}
      </div>
      {sub && <div className="truncate text-[10px] text-neutral-500">{sub}</div>}
    </div>
  );
}
