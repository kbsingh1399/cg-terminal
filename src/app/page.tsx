"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import FootprintTool from "@/components/cg/footprint-tool";
import LargeOrdersTool from "@/components/cg/large-orders-tool";
import LiquidationLevelsTool from "@/components/cg/liquidation-levels-tool";
import BookWallsTool from "@/components/cg/book-walls-tool";
import CvdTool from "@/components/cg/cvd-tool";
import OverviewTool from "@/components/cg/overview-tool";
import ClassicOverview from "@/components/cg/classic-overview";
import AlertsTool from "@/components/cg/alerts-tool";
import AssetPalette, { type UniAsset } from "@/components/cg/asset-palette";
import BinanceView from "@/components/binance/BinanceView";
import BinanceMarkets from "@/components/binance/BinanceMarkets";
import { fetchUniverseDirect } from "@/lib/binance/direct";
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

// Full universe (user directives 2026-11-11): Tier-1 perp registry (order-flow
// engine) + Tier-2 Binance top-liquidity perps (loaded live from
// /api/binance/universe — the top-200 by 24h quote volume) + Tier-3 classic
// registry (Yahoo quotes). Registry duplicates (BTC/ETH/… XAU/XAG/XPT rank in
// the top-200 too) keep their Tier-1 identity and are dropped from Tier-2.
const PERP_LIST: UniAsset[] = ASSETS.map(({ sym, name, kind }) => ({ sym, name, kind, classic: false }));
const CLASSIC_LIST: UniAsset[] = CLASSIC_ASSETS.map(({ sym, name, klass }) => ({ sym, name, kind: klass, classic: true }));
const REGISTRY_SYMS = new Set(PERP_LIST.map((a) => a.sym));

interface BinUniAsset {
  sym: string;
  pair: string;
  rank: number;
  quoteVol24h: number;
  priceDecs: number;
  qtyDecs: number;
}

export default function Home() {
  const [tool, setTool] = useState<Tool>("overview");
  const [sym, setSym] = useState<string>("BTC");
  const [paletteOpen, setPaletteOpen] = useState(false);
  // "markets" = the Binance top-200 grid (BINANCE 200 header button)
  const [view, setView] = useState<"terminal" | "markets">("terminal");
  const [binList, setBinList] = useState<BinUniAsset[]>([]);

  // Tier-2 universe — server route first (authoritative exchangeInfo
  // precision, 4h cache); browser-direct fapi fallback when the host is
  // unavailable (e.g. transient fapi weight ban on a cloud egress IP);
  // honest retry every 60s while both tiers fail.
  useEffect(() => {
    let alive = true;
    let retry: ReturnType<typeof setTimeout> | null = null;
    const load = async () => {
      try {
        const res = await fetch("/api/binance/universe");
        const j = (await res.json()) as { ok: boolean; assets?: BinUniAsset[] };
        if (alive && j.ok && Array.isArray(j.assets)) {
          setBinList(j.assets);
          return;
        }
      } catch {
        /* fall through to the direct tier */
      }
      const d = await fetchUniverseDirect(200).catch(() => null);
      if (alive && d && d.length > 0) {
        setBinList(d);
        return;
      }
      if (alive) retry = setTimeout(load, 60_000);
    };
    void load();
    return () => {
      alive = false;
      if (retry) clearTimeout(retry);
    };
  }, []);

  const BIN_LIST: UniAsset[] = useMemo(
    () =>
      binList
        .filter((a) => !REGISTRY_SYMS.has(a.sym))
        .map((a) => ({ sym: a.sym, name: `${a.pair} perp`, kind: "binance", classic: false, rank: a.rank })),
    [binList]
  );

  const UNIVERSE = useMemo(() => [...PERP_LIST, ...BIN_LIST, ...CLASSIC_LIST], [BIN_LIST]);
  const UNI_OF = useMemo(() => new Map(UNIVERSE.map((u) => [u.sym, u])), [UNIVERSE]);
  const BIN_OF = useMemo(
    () => new Map(binList.filter((a) => !REGISTRY_SYMS.has(a.sym)).map((a) => [a.sym, a])),
    [binList]
  );

  const uni = UNI_OF.get(sym);
  const classic = !!uni?.classic;
  const binance = uni?.kind === "binance";

  // deep-link ?sym= — captured ONCE on the first client render (before the
  // URL-sync effect below rewrites the address bar around the default sym)
  // and applied as soon as the symbol validates against the universe. A
  // Binance-tier symbol cannot validate before its list loads; if the list
  // is loaded and the symbol is still unknown, give up (stay on BTC).
  const urlSymRef = useRef<string | null>(null);
  if (urlSymRef.current === null && typeof window !== "undefined") {
    urlSymRef.current = new URLSearchParams(window.location.search).get("sym") ?? "";
  }
  const urlApplied = useRef(false);
  useEffect(() => {
    if (urlApplied.current) return;
    const s = urlSymRef.current;
    if (!s) {
      urlApplied.current = true;
      return;
    }
    const up = s.toUpperCase();
    if (UNI_OF.has(up)) {
      setSym(up);
      urlApplied.current = true;
    } else if (binList.length > 0) {
      urlApplied.current = true; // unknown symbol — never flip later
    }
  }, [binList.length, UNI_OF]);

  // keep the URL shareable
  useEffect(() => {
    const u = new URL(window.location.href);
    u.searchParams.set("sym", sym);
    window.history.replaceState(null, "", u.toString());
  }, [sym]);

  // perp-only tools don't exist for classic/Binance-tier instruments → Overview
  const pick = (s: string) => {
    setSym(s);
    setView("terminal");
    const u = UNI_OF.get(s);
    if ((u?.classic || u?.kind === "binance") && tool !== "overview") setTool("overview");
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
  }, [sym, paletteOpen, tool, UNIVERSE]);

  const visibleTools = useMemo(
    () => TOOLS.filter((t) => (classic || binance ? t.key === "overview" : true)),
    [classic, binance]
  );

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
                {PERP_LIST.length} perp + {BIN_LIST.length > 0 ? BIN_LIST.length : "…"} binance + {CLASSIC_LIST.length} classic ={" "}
                {UNIVERSE.length} instruments · ←/→ rotate · ⌄ all assets
              </div>
            </div>
          </div>

          {/* asset switcher: perp quick-bar + ALL-assets palette toggle + Binance-200 grid */}
          <div className="flex flex-wrap items-center gap-1" role="tablist" aria-label="Asset">
            {PERP_LIST.map((a) => (
              <button
                key={a.sym}
                role="tab"
                aria-selected={sym === a.sym}
                onClick={() => pick(a.sym)}
                title={a.name}
                className={`rounded px-2 py-1 text-[11px] font-bold tracking-wide transition-colors ${
                  sym === a.sym && view === "terminal"
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
              onClick={() => setView(view === "markets" ? "terminal" : "markets")}
              title="Binance top-200 liquidity grid — live prices, all USDT-M perpetuals"
              className={`ml-1 flex items-center gap-1.5 rounded px-2.5 py-1 text-[11px] font-bold tracking-wide transition-colors ${
                view === "markets"
                  ? "bg-cyan-500/20 text-cyan-300 ring-1 ring-cyan-500/40"
                  : "bg-neutral-800 text-neutral-300 hover:bg-neutral-700"
              }`}
            >
              BINANCE 200
            </button>
            <button
              onClick={() => setPaletteOpen(true)}
              title="All assets — search the full universe (crypto perps · binance top-200 · indices · FX · equities · commodities)"
              className={`flex items-center gap-1.5 rounded px-2.5 py-1 text-[11px] font-bold tracking-wide transition-colors ${
                classic
                  ? "bg-sky-500/20 text-sky-300 ring-1 ring-sky-500/40"
                  : "bg-neutral-800 text-neutral-300 hover:bg-neutral-700"
              }`}
            >
              {classic ? sym : "ALL"} <span className="text-[9px]">⌄</span>
            </button>
          </div>

          {view === "terminal" && !classic && <LivePrice sym={sym} />}

          {view === "terminal" && (
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
          )}
          <div className="ml-auto hidden md:block">
            <EngineStatus />
          </div>
        </div>
      </header>

      {/* tool content */}
      <main className="mx-auto w-full max-w-[1600px] flex-1 px-4 py-4">
        {view === "markets" ? (
          <BinanceMarkets onPick={pick} />
        ) : classic ? (
          tool === "overview" ? (
            <ClassicOverview sym={sym} />
          ) : null // perp-only tabs are filtered out of visibleTools for classic
        ) : binance && BIN_OF.has(sym) ? (
          (() => {
            const b = BIN_OF.get(sym)!;
            return <BinanceView sym={b.sym} rank={b.rank} priceDecs={b.priceDecs} qtyDecs={b.qtyDecs} />;
          })()
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
          Data sourced live from the Coinglass web API (Tier-1 perp assets), the Binance USDT-M futures public market
          (Tier-2 top-200: REST + fstream WebSocket — book/tape/klines/funding/OI; demo order execution on the futures
          TESTNET only), Yahoo Finance v8 (Tier-3 classic instruments), and — for microstructure — the free Hyperliquid
          xyz HIP-3 perps, Lighter DEX L3 order books, and Kraken spot FX depth, for personal analysis. Figures are
          estimates reported by the upstream providers and are not investment advice. Classic instruments without micro
          mappings are quotes+bars only — never fabricated.
        </div>
      </footer>
    </div>
  );
}
