"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
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
import { hlCoinOf, resolveBinSym } from "@/lib/binance/aliases";
import { getHlMid, useHlAllMids } from "@/lib/live/hl-feed";
import type { DeskLiveSnapshot } from "@/lib/desk/live";

type CockpitView = "terminal" | "matrix" | "desk" | "markets";
type ToolTab = "overview" | "footprint" | "largeorders" | "liqlevels" | "bookwalls" | "cvd" | "alerts" | "l2" | "quant";

interface PerpAssetsResp {
  ok: boolean;
  assets: { sym: string; name: string; kind: string; sector?: string; tier?: "fast" | "slow"; hyperliquid?: string }[];
}

interface ClassicListResp {
  ok: boolean;
  assets: {
    sym: string;
    name: string;
    klass: string;
    broker: string | null;
    binPair?: string;
    tradfiCore?: boolean;
    note?: string;
  }[];
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
const DEFAULT_PINS = ["BTC", "ETH", "SOL", "HYPE", "XAU", "SPX500", "NVDA", "MU", "USO"];
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

interface ScreenerStripResp {
  ok: boolean;
  crypto?: { sym: string; price: number | null; chg24hPct: number | null }[];
}

export default function TerminalHome() {
  const perpQ = usePolling<PerpAssetsResp>("/api/cg/assets", 300_000);
  const classicQ = usePolling<ClassicListResp>("/api/cg/classic?list=1", 300_000);
  const binQ = usePolling<BinanceUniResp>("/api/binance/universe", 300_000);
  const deskQ = usePolling<DeskLiveSnapshot>("/api/desk/live", 15_000);
  const cnbcQ = usePolling<CnbcStripResp>("/api/cg/cnbc?syms=SP500,NDX100", 60_000);
  const scrStripQ = usePolling<ScreenerStripResp>("/api/cg/screener", 15_000);

  useMiniFeed();
  const hlMids = useHlAllMids(true);

  const [view, setView] = useState<CockpitView>("terminal");
  const [sym, setSym] = useState<string>("BTC");
  const [tab, setTab] = useState<ToolTab>("overview");
  const [urlReady, setUrlReady] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteFilter, setPaletteFilter] = useState<PaletteFilter>("all");

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

  const perpList = useMemo(() => perpQ.data?.assets ?? [], [perpQ.data]);
  const classicList = useMemo(() => classicQ.data?.assets ?? [], [classicQ.data]);
  const binList = useMemo(() => binQ.data?.assets ?? [], [binQ.data]);

  const perpMap = useMemo(() => new Map(perpList.map((a) => [a.sym, a])), [perpList]);
  const classicMap = useMemo(() => new Map(classicList.map((a) => [a.sym, a])), [classicList]);
  const binMap = useMemo(() => new Map(binList.map((a) => [a.sym, a])), [binList]);

  const universe = useMemo<UniAsset[]>(() => {
    const out: UniAsset[] = [];
    const seen = new Set<string>();
    for (const a of perpList) {
      seen.add(a.sym);
      out.push({
        sym: a.sym,
        name: a.name,
        kind: a.kind,
        sector: a.sector,
        tier: a.tier,
        classic: false,
      });
    }
    for (const c of classicList) {
      if (seen.has(c.sym)) continue;
      seen.add(c.sym);
      seen.add(resolveBinSym(c.sym));
      const bMatch = binMap.get(c.sym) ?? binMap.get(resolveBinSym(c.sym));
      out.push({
        sym: c.sym,
        name: c.name,
        kind: c.klass,
        classic: true,
        tradfiCore: c.tradfiCore,
        broker: c.broker,
        rank: bMatch?.rank,
        note: c.note,
      });
    }
    for (const b of binList) {
      if (seen.has(b.sym)) continue;
      seen.add(b.sym);
      const isTradFi = b.contractType === "TRADIFI_PERPETUAL";
      out.push({
        sym: b.sym,
        name: `${b.sym}USDT Perp`,
        kind: isTradFi ? (b.underlyingType === "COMMODITY" ? "commodity" : "equity") : "binance",
        sector: isTradFi ? (b.underlyingType?.toLowerCase() ?? "tradfi") : undefined,
        classic: false,
        rank: b.rank,
      });
    }
    return out;
  }, [perpList, classicList, binList, binMap]);

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
      const next = nextRaw.trim().toUpperCase();
      if (!next) return;
      const isP = perpMap.has(next);
      const isC = !isP && classicMap.has(next);
      const hasBin = binMap.has(next) || binMap.has(resolveBinSym(next));

      let nextTab = tab;
      if (nextTab === "quant" && !isC) nextTab = "overview";
      if (nextTab === "l2" && !hasBin) nextTab = "overview";

      setUrlReady(true);
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
    [perpMap, classicMap, binMap, tab]
  );

  const switchCockpit = useCallback((nextView: CockpitView) => {
    setUrlReady(true);
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

  // Apply URL `?sym=` and `?view=` once universe lists are available
  useEffect(() => {
    if (urlReady || typeof window === "undefined") return;
    const sp = new URLSearchParams(window.location.search);
    const reqView = sp.get("view") as CockpitView | null;
    const reqSym = sp.get("sym")?.trim().toUpperCase() ?? "";
    const reqTab = sp.get("tab")?.trim().toLowerCase() as ToolTab | null;

    // Wait until either the requested sym resolves or the main registries finish loading
    const resolved =
      !reqSym || perpMap.has(reqSym) || classicMap.has(reqSym) || binMap.has(reqSym) || binMap.has(resolveBinSym(reqSym));
    const registriesReady = perpList.length > 0 && classicList.length > 0 && binList.length > 0;
    if (!resolved && !registriesReady) return;

    const timer = setTimeout(() => {
      if (reqSym && resolved) {
        setSym(reqSym);
      }
      if (reqTab && ALL_TOOL_TABS.has(reqTab)) {
        const tgt = reqSym || sym;
        const isC = !perpMap.has(tgt) && classicMap.has(tgt);
        const hasBin = binMap.has(tgt) || binMap.has(resolveBinSym(tgt));
        if ((reqTab === "quant" && !isC) || (reqTab === "l2" && !hasBin)) {
          setTab("overview");
        } else {
          setTab(reqTab);
        }
      }
      if (reqView && ["terminal", "matrix", "desk", "markets"].includes(reqView)) {
        setView(reqView);
      }
      setUrlReady(true);
    }, 0);
    return () => clearTimeout(timer);
  }, [urlReady, sym, perpList.length, classicList.length, binList.length, perpMap, classicMap, binMap]);

  const isPerp = perpMap.has(sym);
  const classicMeta = !isPerp ? classicMap.get(sym) : undefined;
  const resolvedBinMeta = binMap.get(sym) ?? binMap.get(resolveBinSym(sym));
  const binMeta = !isPerp && !classicMeta ? resolvedBinMeta : undefined;
  const classicBinMeta = classicMeta ? resolvedBinMeta : undefined;
  const perpMeta = perpMap.get(sym);
  const isHlIndex = sym === "SPX500" || sym === "SP500" || sym === "NDX100" || sym === "JP225";
  const hasLivePrice = Boolean(isPerp || binMeta || classicBinMeta || (classicMeta && isHlIndex && hlCoinOf(sym)));

  const spTarget = classicMap.has("SPX500")
    ? "SPX500"
    : classicMap.has("SP500")
      ? "SP500"
      : classicMap.has("US500")
        ? "US500"
        : "SPX500";
  const ndxTarget = classicMap.has("NDX100") ? "NDX100" : classicMap.has("USTEC") ? "USTEC" : "NDX100";
  const spQuote = cnbcQ.data?.quotes?.SP500;
  const ndxQuote = cnbcQ.data?.quotes?.NDX100;
  const spHl = hlMids.tick >= 0 ? getHlMid("xyz:SP500") : undefined;
  const ndxHl = hlMids.tick >= 0 ? getHlMid("xyz:XYZ100") : undefined;
  const scrStripMap = useMemo(
    () => new Map((scrStripQ.data?.crypto ?? []).map((r) => [r.sym, r])),
    [scrStripQ.data]
  );

  const deskPosCount = deskQ.data?.mt5.positions.length ?? 0;
  const deskOrdCount = deskQ.data?.mt5.orders.length ?? 0;

  // Macro WS mini tickers read cleanly during render (subscribed via useMiniFeed above)
  const macroCryptos = [
    { label: "BTC", pair: "BTCUSDT" },
    { label: "ETH", pair: "ETHUSDT" },
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
              Crypto {perpList.filter((a) => a.kind === "crypto").length || 30}
            </button>
            <button
              onClick={() => openDrawer("tradfi")}
              className="rounded border border-neutral-800 bg-[#11151a] px-2 py-1 text-[11px] font-medium text-sky-300 hover:border-neutral-700"
            >
              TradFi Core
            </button>
            <button
              onClick={() => openDrawer("equity")}
              className="hidden rounded border border-neutral-800 bg-[#11151a] px-2 py-1 text-[11px] font-medium text-rose-300 hover:border-neutral-700 sm:inline-flex"
            >
              Equities &amp; ETFs
            </button>
            <button
              onClick={() => openDrawer("all")}
              className="flex items-center gap-2 rounded-md border border-neutral-700 bg-[#11151a] px-3 py-1 text-xs text-neutral-300 hover:border-emerald-500/60 hover:text-neutral-100"
            >
              <span>Search Universe…</span>
              <kbd className="rounded bg-neutral-800 px-1.5 py-0.5 font-mono text-[10px] text-neutral-400">
                Ctrl+K
              </kbd>
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
                const fb = scrStripMap.get(m.label);
                const px = tk?.last ?? fb?.price ?? null;
                const chg =
                  tk && tk.open > 0
                    ? ((tk.last - tk.open) / tk.open) * 100
                    : fb?.chg24hPct ?? null;
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
                { label: "SPX", target: spTarget, q: spQuote, hl: spHl },
                { label: "NDX", target: ndxTarget, q: ndxQuote, hl: ndxHl },
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
          <AlphaMatrix
            currentSym={sym}
            pinned={pinned}
            onTogglePin={togglePin}
            onPickAsset={pickAsset}
          />
        )}

        {view === "desk" && <DeskBlotter onPickAsset={pickAsset} />}

        {view === "markets" && <BinanceMarkets onPick={pickAsset} />}

        {urlReady && view === "terminal" && (
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
                <span className="text-xs text-neutral-400">
                  {perpMeta?.name ?? classicMeta?.name ?? (binMeta ? `${binMeta.sym}USDT Perp` : "Instrument")}
                </span>
                {perpMeta && (
                  <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-emerald-300">
                    Tier-1 · {perpMeta.sector ?? perpMeta.kind}
                  </span>
                )}
                {binMeta && (
                  <span className="rounded bg-cyan-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-cyan-300">
                    Binance #{binMeta.rank}
                  </span>
                )}
                {classicMeta && (
                  <span className="rounded bg-sky-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-sky-300">
                    {classicMeta.klass} {classicMeta.broker ? `· MT5:${classicMeta.broker}` : "· Watchlist"}
                  </span>
                )}
                {classicBinMeta && (
                  <span className="rounded bg-cyan-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-cyan-300">
                    Binance #{classicBinMeta.rank} WS
                  </span>
                )}
              </div>

              {hasLivePrice && <LivePrice sym={sym} />}
            </div>

            {/* Unified Modern Terminal Tool Bar + Active Panel (attached for ALL 4 asset tiers) */}
            {(() => {
              const liveBookMeta = binMeta ?? classicBinMeta ?? (isPerp ? resolvedBinMeta : undefined);
              const tabs: { id: ToolTab; label: string; badge?: string }[] = [
                ...BASE_TABS,
                ...(liveBookMeta ? [{ id: "l2" as const, label: "Live L2 & Tape", badge: "WS" }] : []),
                ...(classicMeta ? [{ id: "quant" as const, label: "TradFi Quant", badge: "COT" }] : []),
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

                  {activeTab === "overview" && <OverviewTool sym={sym} />}
                  {activeTab === "footprint" && <FootprintTool sym={sym} />}
                  {activeTab === "largeorders" && <LargeOrdersTool sym={sym} />}
                  {activeTab === "liqlevels" && <LiquidationLevelsTool sym={sym} />}
                  {activeTab === "bookwalls" && <BookWallsTool sym={sym} />}
                  {activeTab === "cvd" && <CvdTool sym={sym} />}
                  {activeTab === "alerts" && <AlertsTool sym={sym} tier2={!isPerp} />}
                  {activeTab === "l2" && liveBookMeta && (
                    <BinanceView
                      sym={sym}
                      rank={liveBookMeta.rank}
                      priceDecs={liveBookMeta.priceDecs}
                      qtyDecs={liveBookMeta.qtyDecs}
                    />
                  )}
                  {activeTab === "quant" && classicMeta && (
                    <ClassicOverview
                      sym={sym}
                      liveHint={classicBinMeta ? "binance" : isHlIndex ? "hl" : null}
                    />
                  )}
                </>
              );
            })()}
          </div>
        )}
      </main>

      <AssetPalette
        universe={universe}
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
