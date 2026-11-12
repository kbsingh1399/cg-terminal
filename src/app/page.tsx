"use client";

import { Suspense, useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useSearchParams } from "next/navigation";
import AlphaMatrix from "@/components/cg/alpha-matrix";
import DeskBlotter from "@/components/cg/desk-blotter";
import OverviewTool from "@/components/cg/overview-tool";
import ClassicOverview from "@/components/cg/classic-overview";
import FootprintTool from "@/components/cg/footprint-tool";
import LargeOrdersTool from "@/components/cg/large-orders-tool";
import LiquidationLevelsTool from "@/components/cg/liquidation-levels-tool";
import BookWallsTool from "@/components/cg/book-walls-tool";
import CvdTool from "@/components/cg/cvd-tool";
import AlertsTool from "@/components/cg/alerts-tool";
import LivePrice from "@/components/cg/live-price";
import EngineStatus from "@/components/cg/engine-status";
import AssetPalette, { type PaletteFilter, type UniAsset } from "@/components/cg/asset-palette";
import BinanceMarkets from "@/components/binance/BinanceMarkets";
import BinanceView from "@/components/binance/BinanceView";
import { usePolling } from "@/components/cg/use-cg-data";
import { getMini, setPriorityPairs, useMiniFeed } from "@/lib/binance/mini-feed";
import { resolveBinSym } from "@/lib/binance/aliases";
import { getHlMid, useHlAllMids } from "@/lib/live/hl-feed";
import { CURATED } from "@/lib/universe/curated";
import type { DeskLiveSnapshot } from "@/lib/desk/live";

type CockpitView = "terminal" | "matrix" | "desk" | "markets";
type ToolTab = "overview" | "footprint" | "largeorders" | "liqlevels" | "bookwalls" | "cvd" | "alerts" | "l2" | "quant";

// ---------------------------------------------------------------------------
// THE CURATED 61 — the terminal's complete, FIXED universe (user directive
// 2026-11-12: 30 crypto + 28 TradFi perps + 3 classic, "no gaps" — every
// perp has working data on every tab). Canonical list:
// src/lib/universe/curated.ts. The universe is STATIC, so deep-links
// (?sym=ANTHROPIC, ?sym=SPX500&tab=overview) resolve SYNCHRONOUSLY at
// first render — zero wasted default-symbol fetches, zero registry race.
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
const CRYPTO_N = PERP_LIST.filter((a) => a.kind === "crypto-perp").length;
const TRADFI_N = PERP_LIST.filter((a) => a.kind === "tradfi-perp").length;

/** Resolve a raw user/URL symbol against the static universe: direct hit
 * first, then alias (PEPE → 1000PEPE, GOLD → XAU, WTI → CL, name match).
 * Returns the canonical sym or undefined — never a fetch. */
function resolveUniSym(raw: string): string | undefined {
  const s = raw.trim().toUpperCase();
  if (!s) return undefined;
  if (UNI_OF.has(s)) return s;
  const alias = PERP_LIST.find(
    (a) => a.aliases?.some((x) => x.toUpperCase() === s) || a.name.toUpperCase() === s
  );
  return alias?.sym;
}

interface BinanceUniResp {
  ok: boolean;
  assets: {
    sym: string;
    pair: string;
    rank: number;
    quoteVol24h: number;
    priceDecs: number;
    qtyDecs: number;
    state?: "trading" | "delisted" | "unverified";
    punchable?: boolean;
    contractType?: string;
    underlyingType?: string;
  }[];
}

interface CnbcStripResp {
  ok: boolean;
  quotes?: Record<string, { ok: boolean; last?: number | null; changePct?: number | null }>;
}

const PIN_KEY = "cg-terminal-pins-v3";
const PIN_EVENT = "cg-pins-changed";
const DEFAULT_PINS = ["BTC", "ETH", "SOL", "HYPE", "XAU", "SPX500", "NVDA", "MU", "CRCL"];
const DEFAULT_PINS_JSON = JSON.stringify(DEFAULT_PINS);

function subscribePins(cb: () => void) {
  const onStorage = (e: StorageEvent) => {
    if (e.key === PIN_KEY) cb();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(PIN_EVENT, cb);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(PIN_EVENT, cb);
  };
}

function getPinsSnapshot(): string {
  try {
    return window.localStorage.getItem(PIN_KEY) ?? DEFAULT_PINS_JSON;
  } catch {
    return DEFAULT_PINS_JSON;
  }
}

const BASE_TABS: { id: ToolTab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "footprint", label: "Footprint" },
  { id: "largeorders", label: "Large Orders" },
  { id: "liqlevels", label: "Liq Levels" },
  { id: "bookwalls", label: "Book Walls" },
  { id: "cvd", label: "CVD" },
  { id: "alerts", label: "Alerts" },
];
const ALL_TOOL_TABS = new Set<ToolTab>([
  "overview",
  "footprint",
  "largeorders",
  "liqlevels",
  "bookwalls",
  "cvd",
  "alerts",
  "l2",
  "quant",
]);

function fmtMacroPx(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "–";
  const abs = Math.abs(v);
  const decs = abs >= 1000 ? 0 : abs >= 50 ? 2 : 3;
  return v.toLocaleString("en-US", { minimumFractionDigits: decs, maximumFractionDigits: decs });
}

/** display-precision defaults while the enriched universe payload is in
 * flight (the server's exchangeInfo tick/step precision replaces them). */
function defaultDecs(sym: string, kind: string): { priceDecs: number; qtyDecs: number } {
  if (kind === "tradfi-perp" || kind === "classic") return { priceDecs: 2, qtyDecs: 2 };
  if (["1000PEPE", "1000SHIB", "VET", "XLM", "ADA"].includes(sym)) return { priceDecs: 6, qtyDecs: 0 };
  return { priceDecs: 2, qtyDecs: 3 };
}

// --- URL bootstrap: ?sym/?tab/?view are read SYNCHRONOUSLY during render via
// Next.js useSearchParams — the App Router server-renders with the REAL
// request URL, so the SSR HTML and the client's first render agree (zero
// hydration mismatch, zero effects, zero wasted default-symbol fetches:
// /?sym=ANTHROPIC or /?sym=SPX500&tab=overview mount the right asset from
// the very first render).
function bootFromSearchParams(sp: URLSearchParams): { sym: string; tab: ToolTab; view: CockpitView } {
  const rawSym = sp.get("sym")?.trim() ?? "";
  const sym = resolveUniSym(rawSym) ?? "BTC";
  const classic = UNI_OF.get(sym)?.classic ?? false;
  const rawTab = (sp.get("tab")?.trim().toLowerCase() ?? "overview") as ToolTab;
  const tab = ALL_TOOL_TABS.has(rawTab) && !(classic && rawTab !== "overview" && rawTab !== "quant") ? rawTab : "overview";
  const rawView = (sp.get("view")?.trim().toLowerCase() ?? "terminal") as CockpitView;
  const view: CockpitView = ["terminal", "matrix", "desk", "markets"].includes(rawView) ? rawView : "terminal";
  return { sym, tab, view };
}

/** prerender-safe shell — mirrors the real layout so the Suspense fallback
 *  paints zero-jank while the search-params boundary resolves. */
function TerminalBootShell() {
  return (
    <div className="min-h-screen bg-[#0b0e11] text-neutral-100">
      <header className="sticky top-0 z-40 border-b border-neutral-800/90 bg-[#0b0e11]/95 px-4 py-2.5">
        <span className="font-mono text-xs font-bold tracking-wider text-emerald-400">CG TERMINAL</span>
        <span className="ml-2 text-[10px] text-neutral-500">booting universe…</span>
      </header>
      <main className="mx-auto max-w-[1600px] px-4 py-4">
        <div className="flex h-64 items-center justify-center rounded-xl border border-neutral-800/90 bg-[#11151a]/90 font-mono text-xs text-neutral-500">
          loading instrument…
        </div>
      </main>
    </div>
  );
}

export default function TerminalHome() {
  return (
    <Suspense fallback={<TerminalBootShell />}>
      <TerminalCockpit />
    </Suspense>
  );
}

function TerminalCockpit() {
  const sp = useSearchParams();
  const [boot] = useState(() => bootFromSearchParams(sp));
  const [view, setView] = useState<CockpitView>(boot.view);
  const [sym, setSym] = useState<string>(boot.sym);
  const [tab, setTab] = useState<ToolTab>(boot.tab);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteFilter, setPaletteFilter] = useState<PaletteFilter>("all");

  // live ENRICHMENT only (rank/precision/24h vols) — membership is static
  const binQ = usePolling<BinanceUniResp>("/api/binance/universe", 300_000);
  const deskQ = usePolling<DeskLiveSnapshot>("/api/desk/live", 15_000);
  const cnbcQ = usePolling<CnbcStripResp>("/api/cg/cnbc?syms=SP500,NDX100", 60_000);

  useMiniFeed();
  const hlMids = useHlAllMids(true);

  // Pinned watchlist stored cleanly in localStorage via useSyncExternalStore
  const pinsRaw = useSyncExternalStore(subscribePins, getPinsSnapshot, () => DEFAULT_PINS_JSON);
  const pinned = useMemo<string[]>(() => {
    try {
      const parsed = JSON.parse(pinsRaw);
      if (Array.isArray(parsed) && parsed.every((x) => typeof x === "string")) return parsed;
    } catch {
      /* fallback */
    }
    return DEFAULT_PINS;
  }, [pinsRaw]);

  useEffect(() => {
    setPriorityPairs(pinned.map((s) => `${resolveBinSym(s)}USDT`));
  }, [pinned]);

  const togglePin = useCallback(
    (target: string) => {
      const up = target.toUpperCase();
      const next = pinned.includes(up) ? pinned.filter((x) => x !== up) : [...pinned, up];
      try {
        window.localStorage.setItem(PIN_KEY, JSON.stringify(next));
        window.dispatchEvent(new Event(PIN_EVENT));
      } catch {
        /* ignore storage quota errors */
      }
    },
    [pinned]
  );

  const binMap = useMemo(() => new Map((binQ.data?.assets ?? []).map((a) => [a.sym, a])), [binQ.data]);

  const uni = UNI_OF.get(sym);
  const classic = uni?.kind === "classic";
  const binMeta = !classic ? binMap.get(sym) : undefined;

  const selectTab = useCallback((nextTab: ToolTab) => {
    setTab(nextTab);
    if (typeof window !== "undefined") {
      const u = new URL(window.location.href);
      u.searchParams.set("tab", nextTab);
      window.history.replaceState(null, "", u.toString());
    }
  }, []);

  const pickAsset = useCallback(
    (nextRaw: string) => {
      const next = resolveUniSym(nextRaw);
      if (!next) return;
      const isC = UNI_OF.get(next)?.classic ?? false;
      let nextTab = tab;
      // classic instruments are quotes+bars only (Overview/Quant); the
      // perp order-flow tabs stay hidden for them.
      if (isC && nextTab !== "overview" && nextTab !== "quant") nextTab = "overview";
      setSym(next);
      setView("terminal");
      if (nextTab !== tab) setTab(nextTab);
      if (typeof window !== "undefined") {
        const u = new URL(window.location.href);
        u.searchParams.set("sym", next);
        u.searchParams.set("view", "terminal");
        u.searchParams.set("tab", nextTab);
        window.history.replaceState(null, "", u.toString());
      }
    },
    [tab]
  );

  const switchCockpit = useCallback((nextView: CockpitView) => {
    setView(nextView);
    if (typeof window !== "undefined") {
      const u = new URL(window.location.href);
      u.searchParams.set("view", nextView);
      window.history.replaceState(null, "", u.toString());
    }
  }, []);

  const openDrawer = useCallback((filter: PaletteFilter) => {
    setPaletteFilter(filter);
    setPaletteOpen(true);
  }, []);

  // Global Ctrl+K / Cmd+K shortcut for Command Asset Palette
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteFilter("all");
        setPaletteOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

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
      pickAsset(UNIVERSE[j].sym);
      e.preventDefault();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [sym, paletteOpen, pickAsset]);

  // keep the URL shareable (sym/tab/view follow state; bootstrap consumed
  // the incoming URL above via useSearchParams during the first render)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const u = new URL(window.location.href);
    u.searchParams.set("sym", sym);
    u.searchParams.set("view", view);
    u.searchParams.set("tab", tab);
    window.history.replaceState(null, "", u.toString());
  }, [sym, view, tab]);

  // NarrativeCard "Open Paper Book →" — jump straight to the Desk view where
  // the Virtual Book (agent-setup paper outcomes) lives
  useEffect(() => {
    const h = () => switchCockpit("desk");
    window.addEventListener("cg-open-desk", h);
    return () => window.removeEventListener("cg-open-desk", h);
  }, [switchCockpit]);

  // BinanceView props — enriched when the universe payload has landed,
  // curated defaults before that (rank = fixed curated position)
  const binProps = useMemo(() => {
    const b = binMap.get(sym);
    const kind = UNI_OF.get(sym)?.kind ?? "crypto-perp";
    const d = defaultDecs(sym, kind);
    return {
      rank: b?.rank ?? CURATED_RANK.get(sym) ?? 1,
      priceDecs: b?.priceDecs ?? d.priceDecs,
      qtyDecs: b?.qtyDecs ?? d.qtyDecs,
      punchable: b?.punchable ?? UNI_OF.get(sym)?.punchable ?? true,
    };
  }, [binMap, sym]);

  const spQuote = cnbcQ.data?.quotes?.SP500;
  const ndxQuote = cnbcQ.data?.quotes?.NDX100;
  const spHl = hlMids.tick >= 0 ? getHlMid("xyz:SP500") : undefined;
  const ndxHl = hlMids.tick >= 0 ? getHlMid("xyz:XYZ100") : undefined;

  const deskPosCount = deskQ.data?.mt5.positions.length ?? 0;
  const deskOrdCount = deskQ.data?.mt5.orders.length ?? 0;

  // Macro WS mini tickers read cleanly during render (subscribed via useMiniFeed above)
  const macroCryptos = [
    { label: "BTC", pair: "BTCUSDT" },
    { label: "ETH", pair: "ETHUSDT" },
    { label: "SOL", pair: "SOLUSDT" },
    { label: "HYPE", pair: "HYPEUSDT" },
    { label: "XAU", pair: "XAUUSDT" },
  ];

  return (
    <div className="min-h-screen bg-[#0b0e11] text-neutral-100">
      {/* Top Sticky Cockpit Header */}
      <header className="sticky top-0 z-40 border-b border-neutral-800/90 bg-[#0b0e11]/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-2 px-4 py-2.5">
          {/* Brand & Engine */}
          <div className="flex items-center gap-2 pr-2">
            <span className="font-mono text-xs font-bold tracking-wider text-emerald-400">CG TERMINAL</span>
            <EngineStatus />
          </div>

          {/* Primary Cockpit Mode Switcher */}
          <nav className="flex items-center gap-1 rounded-lg border border-neutral-800 bg-[#11151a] p-0.5">
            <button
              onClick={() => switchCockpit("matrix")}
              className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${
                view === "matrix" ? "bg-emerald-500/20 text-emerald-300" : "text-neutral-400 hover:text-neutral-200"
              }`}
            >
              Alpha Matrix
            </button>
            <button
              onClick={() => switchCockpit("desk")}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${
                view === "desk" ? "bg-sky-500/20 text-sky-300" : "text-neutral-400 hover:text-neutral-200"
              }`}
            >
              <span>Desk &amp; MT5</span>
              {deskPosCount + deskOrdCount > 0 && (
                <span className="rounded bg-amber-500/20 px-1 font-mono text-[10px] text-amber-300">
                  {deskPosCount}P/{deskOrdCount}L
                </span>
              )}
            </button>
            <button
              onClick={() => switchCockpit("terminal")}
              className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${
                view === "terminal" ? "bg-neutral-800 text-neutral-100" : "text-neutral-400 hover:text-neutral-200"
              }`}
            >
              Terminal · <span className="font-mono text-emerald-400">{sym}</span>
            </button>
            <button
              onClick={() => switchCockpit("markets")}
              className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${
                view === "markets" ? "bg-cyan-500/20 text-cyan-300" : "text-neutral-400 hover:text-neutral-200"
              }`}
            >
              Binance Perps
            </button>
          </nav>

          {/* Category Drawers & Global Command Palette */}
          <div className="ml-auto flex flex-wrap items-center gap-1.5">
            <button
              onClick={() => openDrawer("crypto")}
              className="rounded border border-neutral-800 bg-[#11151a] px-2 py-1 text-[11px] font-medium text-emerald-300 hover:border-neutral-700"
            >
              Crypto {CRYPTO_N}
            </button>
            <button
              onClick={() => openDrawer("tradfi")}
              className="rounded border border-neutral-800 bg-[#11151a] px-2 py-1 text-[11px] font-medium text-sky-300 hover:border-neutral-700"
            >
              TradFi {TRADFI_N}
            </button>
            <button
              onClick={() => openDrawer("all")}
              className="flex items-center gap-2 rounded-md border border-neutral-700 bg-[#11151a] px-3 py-1 text-xs text-neutral-300 hover:border-emerald-500/60 hover:text-neutral-100"
            >
              <span>Search Universe…</span>
              <kbd className="rounded bg-neutral-800 px-1.5 py-0.5 font-mono text-[10px] text-neutral-400">Ctrl+K</kbd>
            </button>
          </div>
        </div>

        {/* Row 2: Live Macro Regime Strip + Customizable Pinned Watchlist Ribbon */}
        <div className="border-t border-neutral-800/60 bg-[#0d1117]">
          <div className="mx-auto flex max-w-[1600px] items-center gap-3 overflow-x-auto px-4 py-1.5 text-[11px]">
            {/* Macro Tickers */}
            <div className="flex shrink-0 items-center gap-2 border-r border-neutral-800 pr-3 font-mono tabular-nums">
              {macroCryptos.map((m) => {
                const tk = getMini(m.pair);
                const px = tk?.last ?? null;
                const chg = tk && tk.open > 0 ? ((tk.last - tk.open) / tk.open) * 100 : null;
                return (
                  <button
                    key={m.label}
                    onClick={() => pickAsset(m.label)}
                    className="flex items-center gap-1 rounded px-1.5 py-0.5 hover:bg-neutral-800/70"
                  >
                    <span className="font-semibold text-neutral-400">{m.label}</span>
                    <span className="text-neutral-100">{fmtMacroPx(px)}</span>
                    {chg != null && (
                      <span className={chg >= 0 ? "text-emerald-400" : "text-rose-400"}>
                        {chg >= 0 ? "+" : ""}
                        {chg.toFixed(1)}%
                      </span>
                    )}
                  </button>
                );
              })}
              {[
                { label: "SPX", target: "SPX500", q: spQuote, hl: spHl },
                { label: "NDX", target: "NDX100", q: ndxQuote, hl: ndxHl },
              ].map((idx) => {
                const liveLast = idx.hl?.mid ?? idx.q?.last ?? null;
                let liveChg = idx.q?.changePct ?? null;
                if (idx.hl?.mid && idx.q?.last && idx.q.changePct != null && idx.q.last > 0) {
                  const refPrev = idx.q.last / (1 + idx.q.changePct / 100);
                  if (Number.isFinite(refPrev) && refPrev > 0) {
                    liveChg = +(((idx.hl.mid - refPrev) / refPrev) * 100).toFixed(2);
                  }
                }
                return (
                  <button
                    key={idx.label}
                    onClick={() => pickAsset(idx.target)}
                    className="flex items-center gap-1 rounded px-1.5 py-0.5 hover:bg-neutral-800/70"
                    title={idx.hl ? "Hyperliquid xyz WS live mid" : "CNBC reference quote"}
                  >
                    <span className="font-semibold text-sky-400">{idx.label}</span>
                    <span
                      className={
                        idx.hl?.dir === "up"
                          ? "text-emerald-300"
                          : idx.hl?.dir === "down"
                            ? "text-rose-300"
                            : "text-neutral-100"
                      }
                    >
                      {fmtMacroPx(liveLast)}
                    </span>
                    {liveChg != null && (
                      <span className={liveChg >= 0 ? "text-emerald-400" : "text-rose-400"}>
                        {liveChg >= 0 ? "+" : ""}
                        {liveChg.toFixed(1)}%
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Pinned Watchlist Ribbon */}
            <div className="flex min-w-0 flex-1 items-center gap-1">
              <span className="shrink-0 text-[10px] uppercase tracking-wider text-neutral-600">Pins</span>
              {pinned.map((pSym) => {
                const active = view === "terminal" && sym === pSym;
                return (
                  <button
                    key={pSym}
                    onClick={() => pickAsset(pSym)}
                    className={`shrink-0 rounded px-2 py-0.5 font-mono text-[11px] font-semibold transition-colors ${
                      active
                        ? "bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/40"
                        : "text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100"
                    }`}
                  >
                    {pSym}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </header>

      {/* Main Workspace */}
      <main className="mx-auto max-w-[1600px] px-4 py-4">
        {view === "matrix" && (
          <AlphaMatrix currentSym={sym} pinned={pinned} onTogglePin={togglePin} onPickAsset={pickAsset} />
        )}

        {view === "desk" && <DeskBlotter onPickAsset={pickAsset} />}

        {view === "markets" && <BinanceMarkets onPick={pickAsset} />}

        {view === "terminal" && (
          <div className="space-y-4">
            {/* Active Instrument Context Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-neutral-800 bg-[#11151a] px-4 py-2.5">
              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => togglePin(sym)}
                  title={pinned.includes(sym) ? "Unpin from ribbon" : "Pin to ribbon"}
                  className={`text-base leading-none ${
                    pinned.includes(sym) ? "text-amber-400" : "text-neutral-600 hover:text-amber-400"
                  }`}
                >
                  {pinned.includes(sym) ? "★" : "☆"}
                </button>
                <span className="font-mono text-base font-bold text-neutral-100">{sym}</span>
                <span className="text-xs text-neutral-400">{uni?.name ?? "Instrument"}</span>
                {uni && !classic && (
                  <span
                    className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
                      uni.kind === "crypto-perp"
                        ? "bg-emerald-500/15 text-emerald-300"
                        : "bg-amber-500/15 text-amber-300"
                    }`}
                  >
                    {uni.kind === "crypto-perp" ? "Crypto perp" : "TradFi perp"} · {uni.sub}
                  </span>
                )}
                {classic && (
                  <span className="rounded bg-sky-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-sky-300">
                    Classic · quotes + bars
                  </span>
                )}
                {binMeta && (
                  <span className="rounded bg-cyan-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-cyan-300">
                    Binance #{binMeta.rank}
                  </span>
                )}
              </div>

              <LivePrice sym={sym} />
            </div>

            {/* Unified Modern Terminal Tool Bar + Active Panel */}
            {(() => {
              // every curated perp (crypto AND TradFi) is Binance-listed →
              // the Live L2 & Tape tab attaches for all of them; classic
              // instruments get Overview + TradFi Quant only.
              const tabs: { id: ToolTab; label: string; badge?: string }[] = classic
                ? [
                    { id: "overview", label: "Overview" },
                    { id: "quant", label: "TradFi Quant", badge: "COT" },
                  ]
                : [
                    ...BASE_TABS,
                    { id: "l2" as const, label: "Live L2 & Ticket", badge: "WS" },
                  ];
              const activeTab = tabs.some((t) => t.id === tab) ? tab : "overview";
              return (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-neutral-800/90 bg-[#11151a]/90 p-1.5 backdrop-blur-sm">
                    <div className="flex flex-wrap items-center gap-1">
                      {tabs.map((t) => (
                        <button
                          key={t.id}
                          onClick={() => selectTab(t.id)}
                          className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                            activeTab === t.id
                              ? "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/40 shadow-[0_0_16px_-6px_rgba(16,185,129,0.5)]"
                              : "text-neutral-400 hover:bg-neutral-800/70 hover:text-neutral-100"
                          }`}
                        >
                          <span>{t.label}</span>
                          {t.badge && (
                            <span
                              className={`rounded px-1 py-0.2 font-mono text-[9px] font-semibold uppercase tracking-wider ${
                                t.badge === "WS"
                                  ? "bg-cyan-500/15 text-cyan-300"
                                  : "bg-sky-500/15 text-sky-300"
                              }`}
                            >
                              {t.badge}
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                    <span className="hidden px-2 font-mono text-[10px] text-neutral-500 xl:inline">
                      {tabs.length} attached modules · {sym}
                    </span>
                  </div>

                  {activeTab === "overview" && !classic && (
                    <>
                      <OverviewTool sym={sym} />
                      <BinanceView
                        sym={sym}
                        rank={binProps.rank}
                        priceDecs={binProps.priceDecs}
                        qtyDecs={binProps.qtyDecs}
                        punchable={binProps.punchable}
                      />
                    </>
                  )}
                  {activeTab === "overview" && classic && <ClassicOverview sym={sym} />}
                  {activeTab === "footprint" && <FootprintTool sym={sym} />}
                  {activeTab === "largeorders" && <LargeOrdersTool sym={sym} />}
                  {activeTab === "liqlevels" && <LiquidationLevelsTool sym={sym} />}
                  {activeTab === "bookwalls" && <BookWallsTool sym={sym} />}
                  {activeTab === "cvd" && <CvdTool sym={sym} />}
                  {activeTab === "alerts" && <AlertsTool sym={sym} />}
                  {activeTab === "l2" && !classic && (
                    <BinanceView
                      sym={sym}
                      rank={binProps.rank}
                      priceDecs={binProps.priceDecs}
                      qtyDecs={binProps.qtyDecs}
                      punchable={binProps.punchable}
                    />
                  )}
                  {activeTab === "quant" && classic && (
                    <ClassicOverview sym={sym} liveHint={binMeta ? "binance" : "hl"} />
                  )}
                </>
              );
            })()}
          </div>
        )}
      </main>

      <AssetPalette
        universe={UNIVERSE}
        current={sym}
        onPick={pickAsset}
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        initialFilter={paletteFilter}
        pinned={pinned}
        onTogglePin={togglePin}
      />
    </div>
  );
}
