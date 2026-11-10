"use client";

import { useState } from "react";
import FootprintTool from "@/components/cg/footprint-tool";
import LargeOrdersTool from "@/components/cg/large-orders-tool";
import LiquidationLevelsTool from "@/components/cg/liquidation-levels-tool";
import BookWallsTool from "@/components/cg/book-walls-tool";
import CvdTool from "@/components/cg/cvd-tool";
import OverviewTool from "@/components/cg/overview-tool";
import AlertsTool from "@/components/cg/alerts-tool";
import { ASSETS } from "@/lib/cg/assets";
import EngineStatus from "@/components/cg/engine-status";
import LivePrice from "@/components/cg/live-price";

type Tool = "overview" | "footprint" | "large-orders" | "liquidation-levels" | "book-walls" | "cvd" | "alerts";

const TOOLS: { key: Tool; label: string; sub: string }[] = [
  { key: "overview", label: "Overview", sub: "Auction · EMA · RSI · VWAP" },
  { key: "footprint", label: "Footprint", sub: "Signals · order flow" },
  { key: "large-orders", label: "Large Orders", sub: "Whale walls · open orders" },
  { key: "liquidation-levels", label: "Liq Levels + Stops", sub: "Clusters · stop heatmap" },
  { key: "book-walls", label: "Book Walls", sub: "Depth · bid/ask walls" },
  { key: "cvd", label: "CVD", sub: "Delta · divergences" },
  { key: "alerts", label: "Alerts", sub: "Live notification feed" },
];

// the 12 assets come from the single registry (src/lib/cg/assets.ts) —
// adding an asset there updates every tool, route and this tab bar
const ASSET_LIST = ASSETS.map(({ sym, name, kind }) => ({ sym, name, kind }));

export default function Home() {
  const [tool, setTool] = useState<Tool>("overview");
  const [sym, setSym] = useState<string>("BTC");

  return (
    <div className="flex min-h-screen flex-col bg-[#0b0e11]">
      {/* top bar */}
      <header className="sticky top-0 z-40 border-b border-neutral-800 bg-[#0b0e11]/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-3 px-4 py-2.5">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-gradient-to-br from-emerald-500 to-emerald-700 font-bold text-black">
              ⌁
            </div>
            <div className="leading-tight">
              <div className="text-sm font-semibold text-neutral-100">Order-Flow Terminal</div>
              <div className="text-[10px] text-neutral-500">
                12 assets · real-time Binance WS + live Coinglass aggregates · continuity engine
              </div>
            </div>
          </div>

          {/* asset switcher */}
          <div className="flex flex-wrap gap-1" role="tablist" aria-label="Asset">
            {ASSET_LIST.map((a) => (
              <button
                key={a.sym}
                role="tab"
                aria-selected={sym === a.sym}
                onClick={() => setSym(a.sym)}
                title={a.name}
                className={`rounded px-2 py-1 text-[11px] font-bold tracking-wide transition-colors ${
                  sym === a.sym
                    ? a.kind === "metal"
                      ? "bg-amber-500/20 text-amber-300 ring-1 ring-amber-500/40"
                      : "bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/40"
                    : "text-neutral-500 hover:bg-neutral-900 hover:text-neutral-300"
                }`}
              >
                {a.sym}
              </button>
            ))}
          </div>

          <LivePrice sym={sym} />

          <nav className="flex flex-wrap gap-1.5" aria-label="Tools">
            {TOOLS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTool(t.key)}
                className={`rounded-md px-3 py-1.5 text-left transition-colors ${
                  tool === t.key
                    ? "bg-neutral-800 text-neutral-100"
                    : "text-neutral-400 hover:bg-neutral-900 hover:text-neutral-200"
                }`}
                aria-current={tool === t.key ? "page" : undefined}
              >
                <div className="text-xs font-semibold">{t.label}</div>
                <div className="hidden text-[10px] text-neutral-500 sm:block">{t.sub}</div>
              </button>
            ))}
          </nav>
          <div className="ml-auto hidden md:block">
            <EngineStatus />
          </div>
        </div>
      </header>

      {/* tool content */}
      <main className="mx-auto w-full max-w-[1600px] flex-1 px-4 py-4">
        {tool === "overview" && <OverviewTool sym={sym} />}
        {tool === "footprint" && <FootprintTool sym={sym} />}
        {tool === "large-orders" && <LargeOrdersTool sym={sym} />}
        {tool === "liquidation-levels" && <LiquidationLevelsTool sym={sym} />}
        {tool === "book-walls" && <BookWallsTool sym={sym} />}
        {tool === "cvd" && <CvdTool sym={sym} />}
        {tool === "alerts" && <AlertsTool sym={sym} />}
      </main>

      <footer className="mt-auto border-t border-neutral-800 px-4 py-3">
        <div className="mx-auto max-w-[1600px] text-[10px] leading-relaxed text-neutral-600">
          Data sourced live from the Coinglass web API for personal analysis. Figures are estimates reported by the
          upstream provider and are not investment advice. XAU/XAG trade as USDT-margined perps (no Hyperliquid venue).
        </div>
      </footer>
    </div>
  );
}
