"use client";

import { useMemo, useState } from "react";
import { usePolling, useTicker } from "./use-cg-data";
import BookHeatCanvas, { type LiveOverlay } from "./charts/book-heat-canvas";
import { fmtNum } from "@/lib/cg/format";
import { assetOf } from "@/lib/cg/assets";
import { Button } from "@/components/ui/button";

/**
 * Book Walls — the aggregate order-book heatmap of the Coinglass
 * /LiquidityHeatmap page: bid/ask depth ±band%, imbalance, largest walls,
 * the live wall list and add/fill/pull events — computed with their exact
 * wall scanner over the aggregate (price-shift aligned) depth stream.
 *
 * Futures aggregate = Binance+OKX+Gate+Bitget+Hyperliquid perps for BTC/ETH;
 * alt perps aggregate over Binance+Hyperliquid, metals over Binance only
 * (per-asset venue lists live in src/lib/cg/assets.ts → aggVenues).
 * Spot aggregate = Binance+Coinbase+OKX+Bitget+Gate+Kraken+Bitfinex (BTC/ETH;
 * alts Binance-only, metals have no spot books).
 */

interface WallsResponse {
  ok: boolean;
  error?: string;
  sym: string;
  market: string;
  interval: string;
  band: number;
  venues: string[];
  minWallUsd: number;
  model: {
    snapshots: number;
    from: number;
    to: number;
    grid: number;
    last: { price: number; bid: number; ask: number };
    depth: { bandPct: number; bidUsd: number; askUsd: number; bidBase: number; askBase: number } | null;
    imbalance: number | null;
    imbalance5mAgo: number | null;
    walls: { side: "b" | "a"; price: number; usd: number; qty: number; distPct: number; ageMs: number; touched: boolean }[];
    events: { t: number; type: "add" | "fill" | "pull"; side: "b" | "a"; p: number; usd: number }[];
    strip: { t: number; mid: number; cells: [number, number][] }[];
    ladder: { price: number; qty: number; usd: number; side: "b" | "a" }[];
  };
}

interface LiveBookResponse {
  ok: boolean;
  error?: string;
  sym: string;
  band: number;
  grid: number;
  covered: { lo: number; hi: number; loPct: number; hiPct: number; levels: number };
  model: WallsResponse["model"];
  updatedAt: number;
}

function fmtM(n: number): string {
  const a = Math.abs(n);
  if (a >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (a >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (a >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return n.toFixed(0);
}

const MARKETS = [
  { v: "futures", l: "Futures Aggregated" },
  { v: "spot", l: "Spot Aggregated" },
] as const;
const INTERVALS = [
  { v: "1m", l: "1m" },
  { v: "5m", l: "5m" },
  { v: "m15", l: "15m" },
  { v: "1h", l: "1h" },
  { v: "4h", l: "4h" },
] as const;
const BANDS = [0.5, 1, 2, 5] as const;

export default function BookWallsTool({ sym = "BTC" }: { sym?: string }) {
  const [market, setMarket] = useState<string>("futures");
  const [interval, setIntervalItv] = useState<string>("m15");
  const [band, setBand] = useState<number>(5);

  // multi-venue aggregate (full depth, ~18 s) + REAL-TIME layers:
  // WS price (sub-100 ms) + Binance top-1000 book (1.5 s)
  const q = usePolling<WallsResponse>(
    `/api/cg/bookwalls?sym=${sym}&market=${market}&interval=${interval}&limit=150&band=${band}`,
    15_000
  );
  const grid = q.data && q.data.sym === sym ? q.data.model.grid : 0;
  const lb = usePolling<LiveBookResponse>(
    market === "futures" && grid ? `/api/cg/livebook?sym=${sym}&band=${band}&grid=${grid}` : null,
    2_000
  );
  const tk = useTicker(sym);

  // defense-in-depth: never render a model that belongs to another symbol
  const m = q.data && q.data.sym === sym ? q.data.model : undefined;
  const lm = lb.data && lb.data.sym === sym && lb.data.grid === grid ? lb.data.model : undefined;
  const liveBook = lm && lb.data ? lb.data : undefined;
  const err = q.error;
  const decs = assetOf(sym)?.priceDecs ?? 2;
  const fmtP = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: decs, maximumFractionDigits: decs });
  const minUsd = q.data?.minWallUsd ?? 100_000;

  // live overlay for the heatmap: real-time price + live book column + ladder
  const liveOverlay: LiveOverlay | null = useMemo(() => {
    if (!liveBook || !lm) return null;
    const strip = lm.strip;
    const lastCol = strip[strip.length - 1];
    if (!lastCol) return null;
    return {
      price: tk.price ?? lm.last.price,
      cells: lastCol.cells,
      ladder: lm.ladder,
      at: liveBook.updatedAt,
    };
  }, [liveBook, lm, tk.price]);

  // live size lookup for the walls table (same price grid → exact bucket match)
  const liveLadderByPrice = useMemo(() => {
    const map = new Map<number, number>();
    if (lm) for (const l of lm.ladder) map.set(l.price, l.usd);
    return map;
  }, [lm]);

  const maxBidWall = m ? [...m.walls].filter((w) => w.side === "b").sort((a, b) => b.usd - a.usd)[0] : null;
  const maxAskWall = m ? [...m.walls].filter((w) => w.side === "a").sort((a, b) => b.usd - a.usd)[0] : null;

  return (
    <div className="flex flex-col gap-3">
      {/* controls */}
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-neutral-800 bg-neutral-900/60 p-2.5">
        <div className="flex items-center gap-1.5 pr-2">
          <span className="text-sm font-semibold text-neutral-100">{sym}</span>
          <span className="rounded bg-neutral-800 px-1.5 py-0.5 text-[10px] text-neutral-400">
            order-book heatmap · aggregate
          </span>
        </div>
        <div className="flex overflow-hidden rounded border border-neutral-700">
          {MARKETS.map((mk) => (
            <button
              key={mk.v}
              onClick={() => setMarket(mk.v)}
              className={`px-3 py-1 text-xs ${market === mk.v ? "bg-neutral-700 text-white" : "text-neutral-400 hover:bg-neutral-800"}`}
            >
              {mk.l}
            </button>
          ))}
        </div>
        <div className="flex overflow-hidden rounded border border-neutral-700">
          {INTERVALS.map((iv) => (
            <button
              key={iv.v}
              onClick={() => setIntervalItv(iv.v)}
              className={`px-2.5 py-1 text-xs ${interval === iv.v ? "bg-neutral-700 text-white" : "text-neutral-400 hover:bg-neutral-800"}`}
            >
              {iv.l}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-neutral-500">depth band</span>
          <div className="flex overflow-hidden rounded border border-neutral-700">
            {BANDS.map((b) => (
              <button
                key={b}
                onClick={() => setBand(b)}
                className={`px-1.5 py-1 text-[11px] ${band === b ? "bg-neutral-700 text-white" : "text-neutral-400 hover:bg-neutral-800"}`}
              >
                ±{b}%
              </button>
            ))}
          </div>
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

      {!m ? (
        <div className="flex h-64 items-center justify-center rounded-lg border border-neutral-800 bg-neutral-900/60 text-sm text-neutral-500">
          {q.loading ? "Streaming aggregate order book…" : "No data"}
        </div>
      ) : (
        <>
          {/* KPI cards — the exact set of the LiquidityHeatmap header, with
              the REAL-TIME layer wired in: last price is the live WS tape,
              depth/imbalance KPIs carry a live Binance top-1000 sub-line */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            <Kpi
              label={`Last price · ${market === "futures" ? (tk.source === "ws" ? "real-time tape" : "live rest") : "spot agg"}`}
              value={fmtP(tk.price ?? m.last.price)}
              sub={`Bid ${fmtP(tk.bid ?? m.last.bid)} · Ask ${fmtP(tk.ask ?? m.last.ask)}${tk.source === "ws" ? " · ws" : ""}`}
            />
            <Kpi
              label={`Bid depth · ${band}% below`}
              value={`$${fmtM(m.depth?.bidUsd ?? 0)}`}
              sub={
                lm?.depth && liveBook
                  ? `live ±${liveBook.covered.loPct.toFixed(2)}%: $${fmtM(lm.depth.bidUsd)} · ${fmtNum(m.depth?.bidBase ?? 0, 1)} ${sym}`
                  : `${fmtNum(m.depth?.bidBase ?? 0, 1)} ${sym}`
              }
              tone="up"
            />
            <Kpi
              label={`Ask depth · ${band}% above`}
              value={`$${fmtM(m.depth?.askUsd ?? 0)}`}
              sub={
                lm?.depth && liveBook
                  ? `live +${liveBook.covered.hiPct.toFixed(2)}%: $${fmtM(lm.depth.askUsd)} · ${fmtNum(m.depth?.askBase ?? 0, 1)} ${sym}`
                  : `${fmtNum(m.depth?.askBase ?? 0, 1)} ${sym}`
              }
              tone="down"
            />
            <Kpi
              label={`Imbalance · ±${band}%`}
              value={`${m.imbalance != null ? (m.imbalance * 100).toFixed(1) : "—"}%`}
              sub={
                lm?.imbalance != null
                  ? `live ${lm.imbalance >= 0 ? "+" : ""}${(lm.imbalance * 100).toFixed(1)}% · 5m ago ${
                      m.imbalance5mAgo != null ? (m.imbalance5mAgo * 100).toFixed(1) + "%" : "—"
                    }`
                  : m.imbalance != null
                    ? `${m.imbalance >= 0 ? "bids" : "asks"} heavier · 5m ago ${
                        m.imbalance5mAgo != null ? (m.imbalance5mAgo * 100).toFixed(1) + "%" : "—"
                      }`
                    : "—"
              }
              tone={m.imbalance != null ? (m.imbalance >= 0 ? "up" : "down") : undefined}
            />
            <Kpi
              label="Largest bid wall"
              value={maxBidWall ? fmtP(maxBidWall.price) : "—"}
              sub={
                maxBidWall
                  ? `$${fmtM(liveLadderByPrice.get(maxBidWall.price) ?? maxBidWall.usd)} · ${maxBidWall.distPct.toFixed(2)}% away`
                  : "none"
              }
              tone="up"
            />
            <Kpi
              label="Largest ask wall"
              value={maxAskWall ? fmtP(maxAskWall.price) : "—"}
              sub={
                maxAskWall
                  ? `$${fmtM(liveLadderByPrice.get(maxAskWall.price) ?? maxAskWall.usd)} · +${maxAskWall.distPct.toFixed(2)}% away`
                  : "none"
              }
              tone="down"
            />
          </div>

          <div className="rounded-lg border border-neutral-800 bg-neutral-900/60 p-2">
            <BookHeatCanvas model={m} height={320} priceDecs={decs} live={liveOverlay} />
            <div className="px-1 pb-1 pt-2 text-[10px] text-neutral-500">
              {m.snapshots} depth snapshots · grid ${m.grid} · {q.data?.venues.join(" + ")} — books of the same moment are
              summed price-by-price with mid-price shift alignment (their aggregate model).
              {liveOverlay && liveBook
                ? ` LIVE column = Binance top-1000 levels (${liveBook.covered.loPct.toFixed(2)}%..+${liveBook.covered.hiPct.toFixed(2)}% around mid), ~1.5 s.`
                : ""}
            </div>
          </div>

          <div className="grid gap-3 xl:grid-cols-3">
            {/* walls list */}
            <div className="rounded-lg border border-neutral-800 bg-neutral-900/60 p-3 xl:col-span-2">
              <div className="mb-2 flex items-baseline justify-between">
                <h3 className="text-sm font-semibold text-neutral-100">Walls · within ±3% of price</h3>
                <span className="text-[11px] text-neutral-500">
                  {m.walls.length} tracked · sorted by distance{" "}
                  {liveLadderByPrice.size ? <span className="text-emerald-500/80">· live size @ {new Date(liveBook!.updatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span> : ""}
                </span>
              </div>
              <div className="max-h-[420px] overflow-auto">
                <table className="w-full text-[11px]">
                  <thead className="sticky top-0 bg-neutral-900 text-neutral-500">
                    <tr>
                      <th className="py-1 text-left font-medium">Side</th>
                      <th className="py-1 text-right font-medium">Price</th>
                      <th className="py-1 text-right font-medium">Distance</th>
                      <th className="py-1 text-right font-medium">Size</th>
                      <th className="py-1 text-right font-medium">Live size</th>
                      <th className="py-1 text-right font-medium">Δ</th>
                      <th className="py-1 text-right font-medium">Age</th>
                      <th className="py-1 text-right font-medium">Touched</th>
                    </tr>
                  </thead>
                  <tbody>
                    {m.walls.slice(0, 30).map((w, i) => {
                      const liveUsd = liveLadderByPrice.get(w.price);
                      const dPct = liveUsd != null && w.usd > 0 ? ((liveUsd - w.usd) / w.usd) * 100 : null;
                      return (
                        <tr key={`${w.side}${w.price}`} className="border-t border-neutral-800/40">
                          <td className="py-1">
                            <span className={`rounded px-1 py-0.5 text-[10px] font-semibold ${w.side === "b" ? "bg-emerald-900/60 text-emerald-400" : "bg-red-900/60 text-red-400"}`}>
                              {w.side === "b" ? "BID" : "ASK"}
                            </span>
                          </td>
                          <td className="py-1 text-right font-mono text-neutral-200">{fmtP(w.price)}</td>
                          <td className={`py-1 text-right font-mono ${w.side === "b" ? "text-emerald-400/80" : "text-red-400/80"}`}>
                            {w.distPct > 0 ? "+" : ""}
                            {w.distPct.toFixed(2)}%
                          </td>
                          <td className="py-1 text-right font-mono text-neutral-300">${fmtM(w.usd)}</td>
                          <td className="py-1 text-right font-mono text-neutral-100">
                            {liveUsd != null ? `$${fmtM(liveUsd)}` : <span className="text-neutral-600">outside live book</span>}
                          </td>
                          <td
                            className={`py-1 text-right font-mono ${
                              dPct == null ? "text-neutral-600" : dPct >= 0 ? "text-emerald-400" : "text-red-400"
                            }`}
                          >
                            {dPct != null ? `${dPct >= 0 ? "+" : ""}${dPct.toFixed(1)}%` : "—"}
                          </td>
                          <td className="py-1 text-right font-mono text-neutral-400">
                            {w.ageMs >= 3_600_000 ? `${Math.round(w.ageMs / 3_600_000)}h` : `${Math.round(w.ageMs / 60_000)}m`}
                          </td>
                          <td className="py-1 text-right text-neutral-500">{w.touched ? "yes" : ""}</td>
                        </tr>
                      );
                    })}
                    {!m.walls.length && (
                      <tr><td colSpan={8} className="py-6 text-center text-neutral-600">No walls above the size threshold right now.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* events feed */}
            <div className="rounded-lg border border-neutral-800 bg-neutral-900/60 p-3">
              <h3 className="mb-2 text-sm font-semibold text-neutral-100">Wall events</h3>
              <div className="max-h-[420px] space-y-1 overflow-auto pr-1">
                {m.events.map((e, i) => (
                  <div key={i} className="flex items-center gap-2 rounded border border-neutral-800/60 bg-neutral-900 px-2 py-1 text-[11px]">
                    <span
                      className={`rounded px-1 py-0.5 text-[9px] font-semibold ${
                        e.type === "add" ? "bg-blue-900/60 text-blue-300" : e.type === "fill" ? "bg-purple-900/60 text-purple-300" : "bg-neutral-800 text-neutral-400"
                      }`}
                    >
                      {e.type.toUpperCase()}
                    </span>
                    <span className={`font-mono ${e.side === "b" ? "text-emerald-400" : "text-red-400"}`}>
                      {e.side === "b" ? "BID" : "ASK"} {fmtP(e.p)}
                    </span>
                    <span className="ml-auto font-mono text-neutral-400">${fmtM(e.usd)}</span>
                    <span className="w-10 text-right font-mono text-neutral-600">
                      {new Date(e.t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                ))}
                {!m.events.length && <div className="py-6 text-center text-[11px] text-neutral-600">No wall events in this window.</div>}
              </div>
              <div className="mt-2 text-[10px] leading-relaxed text-neutral-500">
                add = wall confirmed (2 consecutive scans) · fill = price reached it · pull = wall canceled.
                These are the exact event semantics of the live page&apos;s scanner.
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-neutral-800 bg-neutral-900/40 px-3 py-2 text-[10px] leading-relaxed text-neutral-500">
            Walls come from full depth snapshots (every resting order in the aggregated book), not just whale orders —
            same data as the Coinglass order-book heatmap. A wall is a price bucket whose USD size passes their
            adaptive threshold (≥ 6× the local ±1% median, min ${fmtM(minUsd)} for {sym}), confirmed on 2 consecutive
            snapshots. For the subset of walls built from explicitly large single orders see the Large Orders tab.
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
