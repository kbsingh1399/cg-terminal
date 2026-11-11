"use client";

import { useEffect, useMemo, useState } from "react";
import FootprintTool from "@/components/cg/footprint-tool";
import LargeOrdersTool from "@/components/cg/large-orders-tool";
import LiquidationLevelsTool from "@/components/cg/liquidation-levels-tool";
import BookWallsTool from "@/components/cg/book-walls-tool";
import CvdTool from "@/components/cg/cvd-tool";
import OverviewTool from "@/components/cg/overview-tool";
import ClassicOverview from "@/components/cg/classic-overview";
import AlertsTool from "@/components/cg/alerts-tool";
import AssetPalette, { type UniAsset } from "@/components/cg/asset-palette";
import { ASSETS } from "@/lib/cg/assets";
import { CLASSIC_ASSETS } from "@/lib/cg/classic";
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

// Full universe (user directive 2026-11-11: toggle/rotate between ALL assets):
// perp registry (order-flow engine) + classic registry (Tier-3 Yahoo quotes).
const PERP_LIST: UniAsset[] = ASSETS.map(({ sym, name, kind }) => ({ sym, name, kind, classic: false }));
const CLASSIC_LIST: UniAsset[] = CLASSIC_ASSETS.map(({ sym, name, klass }) => ({ sym, name, kind: klass, classic: true }));
const UNIVERSE = [...PERP_LIST, ...CLASSIC_LIST];
const UNI_OF = new Map(UNIVERSE.map((u) => [u.sym, u]));

export default function Home() {
  const [tool, setTool] = useState<Tool>("overview");
  const [sym, setSym] = useState<string>("BTC");
  const [paletteOpen, setPaletteOpen] = useState(false);
  const uni = UNI_OF.get(sym);
  const classic = !!uni?.classic;

  // deep-link ?sym= on mount (validated against the universe)
  useEffect(() => {
    const s = new URLSearchParams(window.location.search).get("sym");
    if (s) {
      const up = s.toUpperCase();
      if (UNI_OF.has(up)) setSym(up);
    }
  }, []);

  // keep the URL shareable
  useEffect(() => {
    const u = new URL(window.location.href);
    u.searchParams.set("sym", sym);
    window.history.replaceState(null, "", u.toString());
  }, [sym]);

  // perp-only tools don't exist for classic instruments → force Overview
  const pick = (s: string) => {
    setSym(s);
    if (UNI_OF.get(s)?.classic && tool !== "overview") setTool("overview");
  };

  // keyboard rotate (the "toggle rotate"): ←/→ cycle the whole universe when
  // nothing is focused (body) and the palette is closed — tools keep their
  // own arrow-key handling for charts/tables
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (paletteOpen) return;
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      const t = e.target as HTMLElement | null;
      if (t && t !== document.body) return;
      const i = UNIVERSE.findIndex((u) => u.sym === sym);
      if (i < 0) return;
      const j = (i + (e.key === "ArrowRight" ? 1 : UNIVERSE.length - 1)) % UNIVERSE.length;
      pick(UNIVERSE[j].sym);
      e.preventDefault();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sym, paletteOpen, tool]);

  const visibleTools = useMemo(() => TOOLS.filter((t) => !classic || t.key === "overview"), [classic]);

  return (
    <div className="flex min-h-screen flex-col bg-[#0b0e11]">
      <AssetPalette universe={UNIVERSE} current={sym} onPick={pick} open={paletteOpen} onClose={() => setPaletteOpen(false)} />

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
                {PERP_LIST.length} perp + {CLASSIC_LIST.length} classic = {UNIVERSE.length} instruments · ←/→ rotate ·
                ⌄ all assets
              </div>
            </div>
          </div>

          {/* asset switcher: perp quick-bar + ALL-assets palette toggle */}
          <div className="flex flex-wrap items-center gap-1" role="tablist" aria-label="Asset">
            {PERP_LIST.map((a) => (
              <button
                key={a.sym}
                role="tab"
                aria-selected={sym === a.sym}
                onClick={() => pick(a.sym)}
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
            <button
              onClick={() => setPaletteOpen(true)}
              title="All assets — search all 98 instruments (indices · FX · equities · commodities)"
              className={`ml-1 flex items-center gap-1.5 rounded px-2.5 py-1 text-[11px] font-bold tracking-wide transition-colors ${
                classic
                  ? "bg-sky-500/20 text-sky-300 ring-1 ring-sky-500/40"
                  : "bg-neutral-800 text-neutral-300 hover:bg-neutral-700"
              }`}
            >
              {classic ? sym : "ALL"} <span className="text-[9px]">⌄</span>
            </button>
          </div>

          {!classic && <LivePrice sym={sym} />}

          <nav className="flex flex-wrap gap-1.5" aria-label="Tools">
            {visibleTools.map((t) => (
              <button
                key={t.key}
                onClick={() => setTool(t.key)}
                className={`rounded-md px-3 py-1.5 text-left transition-colors ${
                  tool === t.key ? "bg-neutral-800 text-neutral-100" : "text-neutral-400 hover:bg-neutral-900 hover:text-neutral-200"
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
        {classic ? (
          tool === "overview" ? (
            <ClassicOverview sym={sym} />
          ) : null // perp-only tabs are filtered out of visibleTools for classic
        ) : (
          <>
            {tool === "overview" && <OverviewTool sym={sym} />}
            {tool === "footprint" && <FootprintTool sym={sym} />}
            {tool === "large-orders" && <LargeOrdersTool sym={sym} />}
            {tool === "liquidation-levels" && <LiquidationLevelsTool sym={sym} />}
            {tool === "book-walls" && <BookWallsTool sym={sym} />}
            {tool === "cvd" && <CvdTool sym={sym} />}
            {tool === "alerts" && <AlertsTool sym={sym} />}
          </>
        )}
      </main>

      <footer className="mt-auto border-t border-neutral-800 px-4 py-3">
        <div className="mx-auto max-w-[1600px] text-[10px] leading-relaxed text-neutral-600">
          Data sourced live from the Coinglass web API (perp assets) and Yahoo Finance v8 (Tier-3 classic instruments)
          for personal analysis. Figures are estimates reported by the upstream provider and are not investment advice.
          XAU/XAG/XPT trade as USDT-margined perps (no Hyperliquid venue); classic instruments are quotes+bars only.
        </div>
      </footer>
    </div>
  );
}
