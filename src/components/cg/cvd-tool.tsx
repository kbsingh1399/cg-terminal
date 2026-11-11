"use client";

import { useState } from "react";
import { usePolling } from "./use-cg-data";
import CvdCanvas from "./charts/cvd-canvas";
import { symDecs } from "@/lib/cg/assets";
import { useLiveForming } from "@/lib/live/forming";
import { Button } from "@/components/ui/button";

/**
 * CVD — Cumulative Volume Delta, the Coinglass /cvd/BTC page:
 * futures CVD, spot CVD, taker-buy share, spot-vs-futures quadrant and the
 * Bull/Bear divergence list with 12-bar hit tracking. Their exact client-side
 * engine runs in our API route over per-venue #bs_usd taker flows.
 */

interface CvdResponse {
  ok: boolean;
  error?: string;
  sym: string;
  itv: string;
  mode: string;
  anchor: string;
  priceKey: string;
  instruments: { key: string; venue: string; kind: string; vol24hUsd: number }[];
  flowsLoaded: { key: string; ok: boolean }[];
  n: number;
  candles: [number, number, number, number, number][];
  perp: number[];
  spot: number[];
  total: number[];
  delta: number[];
  ratio: (number | null)[];
  divergences: { type: "bull" | "bear"; ts: number; priceA: number; priceB: number; priceC: number; bars: [number, number, number]; ret12: number | null; hit: boolean | null }[];
  kpis: {
    scope: string;
    perpCvd: number;
    spotCvd: number;
    perpBuy: number;
    perpSell: number;
    spotBuy: number;
    spotSell: number;
    buyRatio: number | null;
    quadrant: string;
    latestDiv: { type: string; ts: number; price: number } | null;
    hitRate: { hits: number; total: number } | null;
  };
}

const ITVS = [
  { v: "m5", l: "5m" },
  { v: "m15", l: "15m" },
  { v: "m30", l: "30m" },
  { v: "h1", l: "1H" },
  { v: "h4", l: "4H" },
] as const;
const MODES = [
  { v: "total", l: "Combined" },
  { v: "perp", l: "Futures" },
  { v: "spot", l: "Spot" },
] as const;
const ANCHORS = [
  { v: "all", l: "All loaded" },
  { v: "week", l: "1 week" },
  { v: "day", l: "24 hours" },
] as const;
const QUADRANTS: Record<string, { label: string; tone: "up" | "down" | "flat"; hint: string }> = {
  "both-buying": { label: "Both buying", tone: "up", hint: "spot and futures net buying" },
  "both-selling": { label: "Both selling", tone: "down", hint: "spot and futures net selling" },
  "spot-bid": { label: "Spot bid", tone: "flat", hint: "spot net buying · futures net selling (absorption)" },
  "perp-driven": { label: "Perp-driven", tone: "flat", hint: "futures net buying · spot net selling (leveraged push)" },
  partial: { label: "Partial", tone: "flat", hint: "select both spot and futures" },
};

function fmtM(n: number): string {
  const a = Math.abs(n);
  if (a >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (a >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (a >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return n.toFixed(0);
}

function ago(ts: number): string {
  const s = Math.max(0, (Date.now() - ts) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export default function CvdTool({ sym = "BTC" }: { sym?: string }) {
  const [itv, setItv] = useState("m15");
  const [mode, setMode] = useState<"total" | "perp" | "spot">("total");
  const [anchor, setAnchor] = useState("all");
  const [showDelta, setShowDelta] = useState(true);
  const [showRatio, setShowRatio] = useState(false);

  const q = usePolling<CvdResponse>(
    `/api/cg/cvd?sym=${sym}&itv=${itv}&limit=1500&mode=${mode === "total" ? "total" : mode}&anchor=${anchor}`,
    15_000
  );
  // defense-in-depth: never render data that belongs to another symbol
  const d = q.data && q.data.sym === sym ? q.data : undefined;
  const err = q.error;
  const k = d?.kpis;
  const lastClose = d?.candles?.length ? Number(d.candles[d.candles.length - 1][4]) : null;
  const decs = symDecs(sym, lastClose);
  const fmtP = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: decs, maximumFractionDigits: decs });
  const quad = k ? QUADRANTS[k.quadrant] ?? QUADRANTS.partial : null;

  // REAL-TIME tape: the forming bar's taker delta off the Binance perp WS —
  // the same sub-100ms stream the footprint overlay uses (Binance share,
  // labeled as such; the multi-venue CVD resyncs every 15 s)
  const forming = useLiveForming(sym, itv);
  const liveDeltaUsd =
    forming && forming.lastPrice != null && forming.barTs > 0
      ? (forming.buyQty - forming.sellQty) * forming.lastPrice
      : null;

  return (
    <div className="flex flex-col gap-3">
      {/* controls */}
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-neutral-800 bg-neutral-900/60 p-2.5">
        <div className="flex items-center gap-1.5 pr-2">
          <span className="text-sm font-semibold text-neutral-100">{sym}</span>
          <span className="rounded bg-neutral-800 px-1.5 py-0.5 text-[10px] text-neutral-400">
            CVD · {d ? d.instruments.length : "…"} venues · taker flows
          </span>
        </div>
        <div className="flex overflow-hidden rounded border border-neutral-700">
          {ITVS.map((i) => (
            <button
              key={i.v}
              onClick={() => setItv(i.v)}
              className={`px-2.5 py-1 text-xs ${itv === i.v ? "bg-neutral-700 text-white" : "text-neutral-400 hover:bg-neutral-800"}`}
            >
              {i.l}
            </button>
          ))}
        </div>
        <div className="flex overflow-hidden rounded border border-neutral-700">
          {MODES.map((mo) => (
            <button
              key={mo.v}
              onClick={() => setMode(mo.v as "total" | "perp" | "spot")}
              className={`px-2.5 py-1 text-xs ${mode === mo.v ? "bg-neutral-700 text-white" : "text-neutral-400 hover:bg-neutral-800"}`}
            >
              {mo.l}
            </button>
          ))}
        </div>
        <div className="flex overflow-hidden rounded border border-neutral-700">
          {ANCHORS.map((a) => (
            <button
              key={a.v}
              onClick={() => setAnchor(a.v)}
              className={`px-2.5 py-1 text-xs ${anchor === a.v ? "bg-neutral-700 text-white" : "text-neutral-400 hover:bg-neutral-800"}`}
            >
              {a.l}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowDelta((v) => !v)}
            className={`rounded border px-2 py-1 text-[11px] ${showDelta ? "border-blue-800 bg-blue-950/50 text-blue-300" : "border-neutral-700 text-neutral-500"}`}
          >
            Delta
          </button>
          <button
            onClick={() => setShowRatio((v) => !v)}
            className={`rounded border px-2 py-1 text-[11px] ${showRatio ? "border-yellow-800 bg-yellow-950/40 text-yellow-300" : "border-neutral-700 text-neutral-500"}`}
          >
            Buy ratio
          </button>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className={`flex items-center gap-1.5 text-xs ${err ? "text-red-400" : "text-emerald-400"}`}>
            <span className={`inline-block h-1.5 w-1.5 rounded-full ${err ? "bg-red-400" : "animate-pulse bg-emerald-400"}`} />
            {err ? "offline" : "live"}
          </span>
          <Button variant="outline" size="sm" className="h-7 border-neutral-700 text-xs" onClick={() => q.refresh()}>
            Refresh
          </Button>
        </div>
      </div>

      {err && (
        <div className="rounded border border-red-900/60 bg-red-950/40 px-3 py-2 text-xs text-red-300">
          Data error: {err} — retrying automatically.
        </div>
      )}

      {!d || !k ? (
        <div className="flex h-64 items-center justify-center rounded-lg border border-neutral-800 bg-neutral-900/60 text-sm text-neutral-500">
          {q.loading ? "Loading taker flows across venues…" : "No data"}
        </div>
      ) : (
        <>
          {/* KPI cards — the exact header set of the /cvd page */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
            <Kpi
              label={`Live delta · ${ITVS.find((i) => i.v === itv)?.l ?? itv} tape`}
              value={liveDeltaUsd != null ? `${liveDeltaUsd >= 0 ? "+" : "−"}$${fmtM(Math.abs(liveDeltaUsd))}` : "—"}
              sub={
                forming && forming.lastPrice != null
                  ? `Binance ws · ${fmtM(forming.buyQty)} buy vs ${fmtM(forming.sellQty)} sell ${sym}`
                  : "waiting for tape…"
              }
              tone={liveDeltaUsd != null ? (liveDeltaUsd >= 0 ? "up" : "down") : undefined}
            />
            <Kpi
              label={`Futures CVD · ${anchor}`}
              value={`${k.perpCvd >= 0 ? "+" : ""}${fmtM(k.perpCvd)}`}
              sub={`buy ${fmtM(k.perpBuy)} · sell ${fmtM(k.perpSell)}`}
              tone={k.perpCvd >= 0 ? "up" : "down"}
            />
            <Kpi
              label={`Spot CVD · ${anchor}`}
              value={`${k.spotCvd >= 0 ? "+" : ""}${fmtM(k.spotCvd)}`}
              sub={`buy ${fmtM(k.spotBuy)} · sell ${fmtM(k.spotSell)}`}
              tone={k.spotCvd >= 0 ? "up" : "down"}
            />
            <Kpi
              label="Taker buy share"
              value={k.buyRatio != null ? `${k.buyRatio.toFixed(1)}%` : "—"}
              sub={`futures ${((k.perpBuy / Math.max(1, k.perpBuy + k.perpSell)) * 100).toFixed(1)}% · spot ${((k.spotBuy / Math.max(1, k.spotBuy + k.spotSell)) * 100).toFixed(1)}%`}
            />
            <Kpi label="Spot vs futures" value={quad?.label ?? "—"} sub={quad?.hint} tone={quad?.tone === "up" ? "up" : quad?.tone === "down" ? "down" : undefined} />
            <Kpi
              label="Latest divergence"
              value={k.latestDiv ? (k.latestDiv.type === "bear" ? "Bear div" : "Bull div") : "—"}
              sub={k.latestDiv ? `${fmtP(k.latestDiv.price)} · ${ago(k.latestDiv.ts)}` : "none in window"}
              tone={k.latestDiv ? (k.latestDiv.type === "bull" ? "up" : "down") : undefined}
            />
            <Kpi
              label="Divergence hit rate"
              value={k.hitRate ? `${Math.round((k.hitRate.hits / k.hitRate.total) * 100)}%` : "—"}
              sub={k.hitRate ? `${k.hitRate.hits}/${k.hitRate.total} confirmed signals followed through (12 bars)` : "no scored signals"}
            />
          </div>

          <div className="grid gap-3 xl:grid-cols-4">
            <div className="rounded-lg border border-neutral-800 bg-neutral-900/60 p-2 xl:col-span-3">
              <CvdCanvas model={d} mode={mode} showDelta={showDelta} showRatio={showRatio} height={480} priceDecs={decs} />
              <div className="px-1 pb-1 pt-2 text-[10px] text-neutral-500">
                {d.n} bars · {d.itv} · price from {d.priceKey} · CVD over {d.instruments.filter((i) => (mode === "spot" ? i.kind === "spot" : mode === "perp" ? i.kind === "perp" : true)).length} venues.
                Blue = CVD (own scale), dashed = zero. Markers: Bull div (green) / Bear div (red) connect the two swings.
              </div>
            </div>

            {/* divergence list */}
            <div className="rounded-lg border border-neutral-800 bg-neutral-900/60 p-3">
              <div className="mb-2 flex items-baseline justify-between">
                <h3 className="text-sm font-semibold text-neutral-100">Divergences</h3>
                <span className="text-[11px] text-neutral-500">{d.divergences.length} signals</span>
              </div>
              <div className="max-h-[480px] space-y-1 overflow-auto pr-1">
                {[...d.divergences].reverse().map((dv, i) => (
                  <div key={i} className="rounded border border-neutral-800/60 bg-neutral-900 px-2 py-1.5 text-[11px]">
                    <div className="flex items-center gap-2">
                      <span className={`rounded px-1 py-0.5 text-[9px] font-semibold ${dv.type === "bull" ? "bg-emerald-900/60 text-emerald-400" : "bg-red-900/60 text-red-400"}`}>
                        {dv.type === "bull" ? "Bull div" : "Bear div"}
                      </span>
                      <span className="font-mono text-neutral-300">{fmtP(dv.priceA)} → {fmtP(dv.priceB)}</span>
                      <span className="ml-auto font-mono text-neutral-500">
                        {new Date(dv.ts).toLocaleDateString([], { month: "2-digit", day: "2-digit" })}{" "}
                        {new Date(dv.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    <div className="mt-0.5 flex justify-between text-[10px] text-neutral-500">
                      <span>confirmed {ago(dv.ts)}</span>
                      {dv.ret12 != null && (
                        <span className={dv.hit ? "text-emerald-400/80" : "text-red-400/80"}>
                          12-bar move {dv.ret12 > 0 ? "+" : ""}{dv.ret12}% {dv.hit ? "· hit" : "· miss"}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
                {!d.divergences.length && (
                  <div className="py-6 text-center text-[11px] text-neutral-600">No divergences in the loaded data.</div>
                )}
              </div>
            </div>
          </div>

          {/* venue flow table */}
          <div className="rounded-lg border border-neutral-800 bg-neutral-900/60 p-3">
            <h3 className="mb-2 text-sm font-semibold text-neutral-100">Venues in the aggregate</h3>
            <div className="flex flex-wrap gap-2">
              {d.instruments.map((i) => (
                <span
                  key={i.key}
                  className={`rounded border px-2 py-1 text-[10px] ${
                    d.flowsLoaded.find((f) => f.key === i.key)?.ok
                      ? "border-neutral-700 bg-neutral-900 text-neutral-300"
                      : "border-red-900/60 bg-red-950/30 text-red-400"
                  }`}
                >
                  {i.venue} {i.kind === "perp" ? "perp" : "spot"} · 24h ${(i.vol24hUsd / 1e9).toFixed(1)}B
                </span>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-neutral-800 bg-neutral-900/40 px-3 py-2 text-[10px] leading-relaxed text-neutral-500">
            CVD = Σ(taker buy − taker sell) per bar, computed from every venue&apos;s #bs_usd taker flow exactly like the
            live page. A bear div prints when two consecutive swing highs (5-bar pivots, 4–60 bars apart) make a higher
            price on lower CVD; a bull div is the mirror on swing lows. Signals confirm 5 bars after the second pivot and
            never repaint. Hit rate = how the next 12 bars resolved, measured on this window — history, not a promise.
          </div>
        </>
      )}
    </div>
  );
}

function Kpi({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "up" | "down" }) {
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
