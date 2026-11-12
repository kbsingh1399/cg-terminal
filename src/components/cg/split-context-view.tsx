"use client";

import { useCallback, useMemo, useState } from "react";
import { usePolling } from "./use-cg-data";
import { useLiveBar, type LiveBar } from "@/lib/binance/sym-feed";
import { resolveBinPair } from "@/lib/binance/aliases";
import BinanceChart, { type Bar, type ChartLevel } from "@/components/binance/BinanceChart";

/**
 * SplitContextView (WS5, 2026-11-12) — Dual-Pane Context inside the Terminal:
 *
 *   CONTEXT   — 15m execution pane + 4H HTF pane of the SAME asset, the HTF
 *               pane carrying the EMA13/89/233 stack, Day VWAP and POC as
 *               clean reference levels.
 *   BENCHMARK — the active asset's 15m pane side-by-side with the lead
 *               benchmark (BTC for crypto, QQQ for TradFi), both carrying
 *               their own VWAP/±2σ/POC levels.
 *
 * Both panes keep the full TradingView-grade zoom/pan interaction, and the
 * crosshair TIMESTAMP is synchronized: hovering one pane pins a sky-blue
 * time line on the other at the same bar time (fires only when the hovered
 * bar changes — never per pixel).
 */

type SplitMode = "context" | "benchmark";

interface KlinesResp {
  ok: boolean;
  sym?: string;
  rows?: [number, number, number, number, number, number, number][];
}

interface MarketSnapLite {
  ok: boolean;
  sym?: string;
  priceDecs?: number;
  vwap?: { vwap: number | null; bands?: { sd1: number; sd2: number; sd3: number } };
  auction?: { day?: { poc: number | null; vah: number | null; val: number | null } };
  ema?: { h4?: { e13: number | null; e89: number | null; e233: number | null } };
}

function rowsToBars(rows: KlinesResp["rows"]): Bar[] {
  if (!rows) return [];
  const out: Bar[] = [];
  for (const r of rows) {
    if (r && Number.isFinite(r[0]) && Number.isFinite(r[4])) {
      out.push({ t: r[0], o: r[1], h: r[2], l: r[3], c: r[4], v: r[5] });
    }
  }
  return out;
}

function fmtPxShort(v: number): string {
  const abs = Math.abs(v);
  const decs = abs >= 1000 ? 1 : abs >= 10 ? 2 : abs >= 0.1 ? 4 : 6;
  return v.toLocaleString("en-US", { minimumFractionDigits: decs, maximumFractionDigits: decs });
}

/** one pane: klines poll + live forming bar + optional synced crosshair */
function SplitPane({
  sym,
  iv,
  height,
  title,
  levels,
  syncTime,
  onHoverTime,
}: {
  sym: string;
  iv: string;
  height: number;
  title: string;
  levels: ChartLevel[];
  syncTime: number | null;
  onHoverTime?: (t: number | null) => void;
}) {
  const pair = resolveBinPair(sym);
  const kl = usePolling<KlinesResp>(`/api/binance/klines?sym=${encodeURIComponent(sym)}&interval=${iv}&limit=300`, 60_000);
  const [liveState, setLiveState] = useState<{ sym: string; iv: string; bar: LiveBar | null }>({ sym, iv, bar: null });
  useLiveBar(sym, iv, (b) => setLiveState({ sym, iv, bar: b }));
  const liveBar = liveState.sym === sym && liveState.iv === iv ? liveState.bar : null;
  const bars = useMemo<Bar[]>(() => (kl.data?.ok && kl.data.sym === sym ? rowsToBars(kl.data.rows) : []), [kl.data, sym]);
  const priceDecs = levels[0] ? 2 : 2;
  void priceDecs;
  return (
    <div className="min-w-0 flex-1 rounded-lg border border-neutral-800 bg-[#11151a] p-2">
      <div className="mb-1 flex items-center gap-2 px-1">
        <span className="font-mono text-[11px] font-bold text-neutral-200">{title}</span>
        <span className="text-[10px] text-neutral-500">
          {sym} · {iv} · {bars.length} bars{liveBar ? " · live" : kl.error ? " · feed error" : ""}
        </span>
      </div>
      <BinanceChart
        bars={bars.length ? bars : null}
        liveBar={liveBar}
        interval={iv}
        priceDecs={2}
        height={height}
        base={pair.replace(/USDT$/, "")}
        levels={levels}
        syncTime={syncTime}
        onHoverTime={onHoverTime}
      />
    </div>
  );
}

export default function SplitContextView({
  sym,
  isTradfi,
  priceDecs,
}: {
  sym: string;
  isTradfi: boolean;
  priceDecs: number;
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<SplitMode>("context");
  const [timeA, setTimeA] = useState<number | null>(null); // crosshair time from pane A
  const [timeB, setTimeB] = useState<number | null>(null); // crosshair time from pane B

  // the active asset's market snapshot carries the reference levels
  const mkt = usePolling<MarketSnapLite>(`/api/cg/market?sym=${encodeURIComponent(sym)}`, 30_000);
  const benchmark = isTradfi ? "QQQ" : sym === "BTC" ? "ETH" : "BTC";
  const benchMkt = usePolling<MarketSnapLite>(
    open && mode === "benchmark" ? `/api/cg/market?sym=${encodeURIComponent(benchmark)}` : null,
    30_000
  );

  const snap = mkt.data?.sym === sym ? mkt.data : null;
  const benchSnap = benchMkt.data?.sym === benchmark ? benchMkt.data : null;

  const levelsOf = useCallback(
    (m: MarketSnapLite | null, withHtfEmas: boolean): ChartLevel[] => {
      const out: ChartLevel[] = [];
      const vwap = m?.vwap?.vwap;
      const sd1 = m?.vwap?.bands?.sd1;
      if (vwap != null) out.push({ price: vwap, label: `VWAP ${fmtPxShort(vwap)}`, color: "#38bdf8" });
      if (vwap != null && sd1 != null && sd1 > 0) {
        out.push({ price: vwap + 2 * sd1, label: `+2σ ${fmtPxShort(vwap + 2 * sd1)}`, color: "rgba(251,191,36,0.75)" });
        out.push({ price: vwap - 2 * sd1, label: `−2σ ${fmtPxShort(vwap - 2 * sd1)}`, color: "rgba(34,211,238,0.75)" });
      }
      const poc = m?.auction?.day?.poc;
      if (poc != null) out.push({ price: poc, label: `POC ${fmtPxShort(poc)}`, color: "rgba(167,139,250,0.8)" });
      if (withHtfEmas) {
        const e13 = m?.ema?.h4?.e13;
        const e89 = m?.ema?.h4?.e89;
        const e233 = m?.ema?.h4?.e233;
        if (e13 != null) out.push({ price: e13, label: `H4 EMA13 ${fmtPxShort(e13)}`, color: "rgba(52,211,153,0.7)" });
        if (e89 != null) out.push({ price: e89, label: `H4 EMA89 ${fmtPxShort(e89)}`, color: "rgba(244,114,182,0.7)" });
        if (e233 != null) out.push({ price: e233, label: `H4 EMA233 ${fmtPxShort(e233)}`, color: "rgba(148,163,184,0.7)" });
      }
      return out;
    },
    []
  );

  if (!open) {
    return (
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-neutral-800 bg-[#11151a] px-3 py-2">
        <span className="text-[11px] text-neutral-400">Dual-Pane Context — 15m execution + 4H HTF levels, or asset + lead benchmark, with synchronized crosshair timestamps</span>
        <button
          onClick={() => setOpen(true)}
          className="ml-auto rounded bg-sky-500/15 px-2.5 py-1 text-[11px] font-semibold text-sky-300 ring-1 ring-sky-500/40 hover:bg-sky-500/25"
        >
          Open split view
        </button>
      </div>
    );
  }

  const paneA =
    mode === "context" ? (
      <SplitPane
        sym={sym}
        iv="15m"
        height={380}
        title="Execution"
        levels={levelsOf(snap, false)}
        syncTime={timeB}
        onHoverTime={setTimeA}
      />
    ) : (
      <SplitPane
        sym={sym}
        iv="15m"
        height={380}
        title="Active asset"
        levels={levelsOf(snap, false)}
        syncTime={timeB}
        onHoverTime={setTimeA}
      />
    );
  const paneB =
    mode === "context" ? (
      <SplitPane
        sym={sym}
        iv="4h"
        height={380}
        title="HTF context"
        levels={levelsOf(snap, true)}
        syncTime={timeA}
        onHoverTime={setTimeB}
      />
    ) : (
      <SplitPane
        sym={benchmark}
        iv="15m"
        height={380}
        title={`Lead benchmark · ${benchmark}`}
        levels={levelsOf(benchSnap, false)}
        syncTime={timeA}
        onHoverTime={setTimeB}
      />
    );

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-neutral-800 bg-[#11151a] px-3 py-2">
        <div className="flex items-center gap-1 rounded-md border border-neutral-800 bg-[#0b0e11] p-0.5">
          <button
            onClick={() => setMode("context")}
            className={`rounded px-2.5 py-1 text-[11px] font-semibold ${mode === "context" ? "bg-sky-500/20 text-sky-300" : "text-neutral-400 hover:text-neutral-200"}`}
          >
            15m + 4H HTF
          </button>
          <button
            onClick={() => setMode("benchmark")}
            className={`rounded px-2.5 py-1 text-[11px] font-semibold ${mode === "benchmark" ? "bg-sky-500/20 text-sky-300" : "text-neutral-400 hover:text-neutral-200"}`}
          >
            Asset + {isTradfi ? "QQQ" : "BTC"} benchmark
          </button>
        </div>
        <span className="text-[10px] text-neutral-500">
          hover either pane → the other pins the same bar time (sky line) · levels: VWAP ±2σ · POC{mode === "context" ? " · H4 EMA13/89/233" : ""}
        </span>
        <span className="font-mono text-[10px] text-neutral-600">{sym} · {priceDecs}dp</span>
        <button onClick={() => setOpen(false)} className="ml-auto rounded border border-neutral-700 px-2 py-0.5 text-[11px] text-neutral-400 hover:text-neutral-100">
          Close split
        </button>
      </div>
      <div className="flex flex-col gap-2 lg:flex-row">
        {paneA}
        {paneB}
      </div>
    </div>
  );
}
