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
import { CURATED } from "@/lib/universe/curated";
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

// ---------------------------------------------------------------------------
// THE CURATED 61 — the terminal's complete, fixed universe (user directive
// 2026-11-12: 30 crypto + 28 TradFi perps + 3 classic, "no gaps" — every
// perp has working data on all 7 tabs). Canonical list:
// src/lib/universe/curated.ts. The old 3-tier build (Tier-1 registry +
// Tier-2 dynamic top-200 + Tier-3 84-instrument classic list) is retired.
// ---------------------------------------------------------------------------
const PERP_LIST: UniAsset[] = CURATED.filter((a) => a.kind !== "classic").map((a) => ({
  sym: a.sym,
  name: a.name,
  kind: a.kind === "crypto-perp" ? "crypto-perp" : "tradfi-perp",
  classic: false,
  sub: a.sub,
  aliases: a.aliases ? [...a.aliases] : undefined,
  punchable: a.punchable,
}));
const CLASSIC_LIST: UniAsset[] = CURATED.filter((a) => a.kind === "classic").map((a) => ({
  sym: a.sym,
  name: a.name,
  kind: "classic",
  classic: true,
  sub: a.sub,
  aliases: a.aliases ? [...a.aliases] : undefined,
  punchable: false,
}));
const UNIVERSE: UniAsset[] = [...PERP_LIST, ...CLASSIC_LIST];
const UNI_OF = new Map(UNIVERSE.map((u) => [u.sym, u]));
const CURATED_RANK = new Map(PERP_LIST.map((a, i) => [a.sym, i + 1]));

/** display-precision defaults while the enriched universe payload is in
 * flight (the server's exchangeInfo tick/step precision replaces them). */
function defaultDecs(sym: string, kind: string): { priceDecs: number; qtyDecs: number } {
  if (kind === "tradfi-perp") return { priceDecs: 2, qtyDecs: 2 };
  if (["1000PEPE", "1000SHIB", "VET", "XLM", "ADA"].includes(sym)) return { priceDecs: 6, qtyDecs: 0 };
  return { priceDecs: 2, qtyDecs: 3 };
}

interface BinUniAsset {
  sym: string;
  pair: string;
  rank: number;
  quoteVol24h: number;
  priceDecs: number;
  qtyDecs: number;
  state?: "trading" | "delisted" | "unverified";
  punchable?: boolean;
}

export default function Home() {
  const [tool, setTool] = useState<Tool>("overview");
  const [sym, setSym] = useState<string>("BTC");
  const [paletteOpen, setPaletteOpen] = useState(false);
  // "markets" = the curated grid (CURATED 61 header button)
  const [view, setView] = useState<"terminal" | "markets">("terminal");
  // live enrichment of the fixed membership (tick/step precision + 24h vols)
  const [binList, setBinList] = useState<BinUniAsset[]>([]);

  // Curated universe enrichment — server route first (authoritative
  // exchangeInfo precision); browser-direct curated fallback when the host
  // is unavailable (e.g. transient fapi weight ban on a cloud egress IP);
  // honest retry every 60s while both tiers fail. Membership never changes —
  // only precision/volumes enrich, so a failure degrades, never blanks.
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
      const d = await fetchUniverseDirect().catch(() => null);
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

  const BIN_OF = useMemo(() => {
    const m = new Map<string, BinUniAsset>();
    for (const a of binList) m.set(a.sym, a);
    return m;
  }, [binList]);

  const uni = UNI_OF.get(sym);
  const classic = uni?.kind === "classic";

  // deep-link ?sym= — captured ONCE on the first client render (before the
  // URL-sync effect below rewrites the address bar around the default sym)
  // and applied immediately: the universe is STATIC now, so a curated symbol
  // (or any alias, e.g. ?sym=PEPE → 1000PEPE) validates without any fetch.
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
    const direct = UNI_OF.has(s.toUpperCase());
    const alias = direct ? undefined : PERP_LIST.find(
      (a) => a.aliases?.some((x) => x.toUpperCase() === s.toUpperCase()) || a.name.toUpperCase() === s.toUpperCase()
    );
    const hit = direct ? s.toUpperCase() : alias?.sym;
    if (hit) setSym(hit);
    urlApplied.current = true; // unknown symbols never flip later — stay on BTC
  }, []);

  // keep the URL shareable
  useEffect(() => {
    const u = new URL(window.location.href);
    u.searchParams.set("sym", sym);
    window.history.replaceState(null, "", u.toString());
  }, [sym]);

  // classic instruments (S&P 500 / Brent / Nasdaq-100) have no perp
  // order-flow data anywhere → Overview only (the honest methodology).
  // Every curated perp — crypto AND TradFi — gets the full 7-tab toolset.
  const pick = (s: string) => {
    setSym(s);
    setView("terminal");
    const u = UNI_OF.get(s);
    if (u?.classic && tool !== "overview") setTool("overview");
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

  // classic instruments are quotes+bars only (Overview); curated perps get
  // the full order-flow toolset
  const visibleTools = useMemo(
    () => TOOLS.filter((t) => (classic ? t.key === "overview" : true)),
    [classic]
  );

  // BinanceView props — enriched when the universe payload has landed,
  // curated defaults before that (rank = fixed curated position)
  const binProps = useMemo(() => {
    const b = BIN_OF.get(sym);
    const kind = UNI_OF.get(sym)?.kind ?? "crypto-perp";
    const d = defaultDecs(sym, kind);
    return {
      rank: b?.rank ?? CURATED_RANK.get(sym) ?? 1,
      priceDecs: b?.priceDecs ?? d.priceDecs,
      qtyDecs: b?.qtyDecs ?? d.qtyDecs,
      punchable: b?.punchable ?? UNI_OF.get(sym)?.punchable ?? true,
    };
  }, [BIN_OF, sym]);

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
                curated {UNIVERSE.length}: 30 crypto + 28 TradFi + 3 classic · ←/→ rotate · ⌄ all assets
              </div>
            </div>
          </div>

          {/* asset switcher: curated quick-bar (scrollable) + palette toggle + grid */}
          <div
            className="relative flex max-w-full items-center gap-1 overflow-x-auto py-0.5 [mask-image:linear-gradient(to_right,transparent,black_16px,black_100%)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            role="tablist"
            aria-label="Asset"
          >
            {PERP_LIST.map((a) => {
              const tradfi = a.kind === "tradfi-perp";
              const delisted = BIN_OF.get(a.sym)?.state === "delisted";
              return (
                <button
                  key={a.sym}
                  role="tab"
                  aria-selected={sym === a.sym}
                  onClick={() => pick(a.sym)}
                  title={`${a.name} · ${a.sub}${delisted ? " · NOT TRADING (flagged)" : ""}`}
                  className={`shrink-0 rounded px-2 py-1 text-[11px] font-bold tracking-wide transition-colors ${
                    sym === a.sym && view === "terminal"
                      ? tradfi
                        ? "bg-amber-500/20 text-amber-300 ring-1 ring-amber-500/40"
                        : "bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/40"
                      : delisted
                        ? "text-neutral-700 hover:bg-neutral-900"
                        : tradfi
                          ? "text-amber-600/80 hover:bg-neutral-900 hover:text-amber-300"
                          : "text-neutral-500 hover:bg-neutral-900 hover:text-neutral-300"
                  }`}
                >
                  {a.sym}
                </button>
              );
            })}
            <button
              onClick={() => setView(view === "markets" ? "terminal" : "markets")}
              title="The curated 61 grid — live prices via the !miniTicker stream"
              className={`ml-1 shrink-0 rounded px-2.5 py-1 text-[11px] font-bold tracking-wide transition-colors ${
                view === "markets"
                  ? "bg-cyan-500/20 text-cyan-300 ring-1 ring-cyan-500/40"
                  : "bg-neutral-800 text-neutral-300 hover:bg-neutral-700"
              }`}
            >
              CURATED 61
            </button>
            <button
              onClick={() => setPaletteOpen(true)}
              title="All assets — search the curated universe (crypto perps · TradFi perps · indices · oil)"
              className={`shrink-0 rounded px-2.5 py-1 text-[11px] font-bold tracking-wide transition-colors ${
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
                  className={`relative rounded-md px-3 py-1.5 text-left transition-colors after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:rounded-full after:transition-all ${
                    tool === t.key
                      ? "bg-neutral-800 text-neutral-100 after:bg-emerald-400"
                      : "text-neutral-400 after:bg-transparent hover:bg-neutral-900 hover:text-neutral-200"
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
        ) : (
          <>
            {tool === "overview" && (
              <>
                {/* Overview = the Binance execution venue (single-exchange
                    methodology): live book/tape/candles/funding/OI + demo
                    ticket, stacked with the institution snapshot
                    (auction VAL/POC/VAH · EMA · RSI · VWAP — also computed
                    from Binance perp klines via Coinglass). */}
                <BinanceView sym={sym} rank={binProps.rank} priceDecs={binProps.priceDecs} qtyDecs={binProps.qtyDecs} punchable={binProps.punchable} />
                <div className="mt-4">
                  <OverviewTool sym={sym} />
                </div>
              </>
            )}
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
          Curated 61 — 30 crypto + 28 TradFi USDT-M perps + 3 classic (S&P 500 · Brent · Nasdaq-100). Data sourced live
          from the Coinglass web API (order-flow aggregates — whale resting orders across all supported exchanges,
          liquidation-level clusters, book walls, CVD), the Binance USDT-M futures public market (REST + fstream
          WebSocket — book/tape/klines/funding/OI; demo order execution on the futures TESTNET only), Yahoo Finance v8
          (classic instruments), and — for microstructure — the free Hyperliquid xyz HIP-3 perps, Lighter DEX L3 order
          books, and Kraken spot FX depth, for personal analysis. Footprint uses the Coinglass aggregated method
          (Binance+OKX+Bybit+Hyperliquid perps, Hyperliquid price-shifted onto the Binance lead) with their exact
          signal engine — BTC/ETH signal parity is verified by scripts/parity-vs-coinglass.ts. Large Orders · Liq
          Levels · Book Walls · CVD are multi-exchange aggregates with Binance as the lead. Figures are estimates
          reported by the upstream providers and are not investment advice. Classic instruments are quotes+bars only —
          never fabricated.
        </div>
      </footer>
    </div>
  );
}
