"use client";

import { useMemo, useState } from "react";
import { usePolling } from "./use-cg-data";
import { getMini, useMiniFeed } from "@/lib/binance/mini-feed";
import { getHlMid, useHlAllMids } from "@/lib/live/hl-feed";
import type { ScreenerCryptoRow, ScreenerPayload, ScreenerTradFiRow } from "@/lib/cg/screener";

/**
 * AlphaMatrix — Cross-asset live screener across 30 Crucial Crypto + 3 Metals +
 * Curated TradFi Core (Hyperliquid xyz + MT5 + Watchlist equities).
 *
 * Combines 1Hz Binance `!miniTicker@arr` WebSocket updates with `/api/cg/screener`
 * scanner metrics (VWAP σ, 4H EMA, 1H RSI, Footprint signal, Liquidation magnet,
 * Funding, Whale imbalance, Confluence score, Desk status).
 */

type MatrixTab = "crypto" | "tradfi";
type CryptoSortKey = "confluence" | "vol" | "chg" | "vwapZ" | "liqDist" | "funding" | "sym";
type TradFiSortKey = "vol" | "oi" | "disloc" | "funding" | "sym";

const SECTOR_ORDER = ["fast", "majors", "l1", "l2", "defi", "ai", "meme", "privacy", "metal"];

function fmtUsdCompact(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "–";
  const abs = Math.abs(v);
  const sign = v < 0 ? "-" : "";
  if (abs >= 1_000_000_000) return `${sign}$${(abs / 1_000_000_000).toFixed(2)}B`;
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(0)}k`;
  return `${sign}$${abs.toFixed(0)}`;
}

function fmtPriceVal(v: number | null | undefined, decs: number): string {
  if (v == null || !Number.isFinite(v)) return "–";
  return v.toLocaleString("en-US", { minimumFractionDigits: decs, maximumFractionDigits: decs });
}

function fmtAge(sec: number | null | undefined): string {
  if (sec == null || !Number.isFinite(sec)) return "cold";
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h`;
}

function readinessBadge(r: NonNullable<ScreenerCryptoRow["confluence"]>): string {
  if (r.readiness === "A+") {
    return r.bias === "BULL"
      ? "bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/50"
      : r.bias === "BEAR"
        ? "bg-rose-500/20 text-rose-300 ring-1 ring-rose-500/50"
        : "bg-amber-500/15 text-amber-300";
  }
  if (r.readiness === "A") {
    return r.bias === "BULL"
      ? "bg-emerald-500/12 text-emerald-400"
      : r.bias === "BEAR"
        ? "bg-rose-500/12 text-rose-400"
        : "bg-neutral-800 text-neutral-300";
  }
  if (r.readiness === "B") return "bg-sky-500/10 text-sky-300";
  return "bg-neutral-800/80 text-neutral-500";
}

export default function AlphaMatrix({
  currentSym,
  pinned,
  onTogglePin,
  onPickAsset,
}: {
  currentSym: string;
  pinned: string[];
  onTogglePin: (sym: string) => void;
  onPickAsset: (sym: string) => void;
}) {
  const [tab, setTab] = useState<MatrixTab>("crypto");
  const q = usePolling<ScreenerPayload>("/api/cg/screener", 15_000);
  const mini = useMiniFeed({ sweepAll: tab === "tradfi" });
  const hlMids = useHlAllMids(tab === "tradfi");
  const [override, setOverride] = useState<{ at: number; data: ScreenerPayload } | null>(null);
  const [warmingSym, setWarmingSym] = useState<string | null>(null);
  const [warmError, setWarmError] = useState<string | null>(null);

  const [sectorFilter, setSectorFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [warmOnly, setWarmOnly] = useState(false);
  const [setupsOnly, setSetupsOnly] = useState(false);

  const [cryptoSort, setCryptoSort] = useState<CryptoSortKey>("confluence");
  const [cryptoAsc, setCryptoAsc] = useState(false);
  const [tradfiSort, setTradfiSort] = useState<TradFiSortKey>("vol");
  const [tradfiAsc, setTradfiAsc] = useState(false);
  const [tradfiKlass, setTradfiKlass] = useState<string>("all");

  const data = override && override.at > q.updatedAt ? override.data : q.data;
  const pinnedSet = useMemo(() => new Set(pinned), [pinned]);

  const handleWarm = async (sym: string) => {
    setWarmingSym(sym);
    setWarmError(null);
    try {
      const res = await fetch(`/api/cg/screener?warm=${encodeURIComponent(sym)}`);
      const json = (await res.json()) as ScreenerPayload & { error?: string };
      if (!json.ok) {
        setWarmError(json.error ?? `warm failed for ${sym}`);
      } else {
        setOverride({ at: Date.now(), data: json });
      }
    } catch (e) {
      setWarmError(e instanceof Error ? e.message : "warm network error");
    } finally {
      setWarmingSym(null);
    }
  };

  // Overlay 1Hz Binance !miniTicker@arr prices onto server screener rows
  const cryptoLive = useMemo(() => {
    const rows = data?.crypto ?? [];
    return rows.map((r) => {
      const m = getMini(`${r.sym}USDT`);
      if (!m) return r;
      const chg = m.open > 0 ? Number((((m.last - m.open) / m.open) * 100).toFixed(2)) : r.chg24hPct;
      const vwapZ =
        r.vwap != null && m.last > 0 && r.vwapZ != null && r.price != null && r.price !== r.vwap
          ? (() => {
              // Preserve server SD scale implied by server (price - vwap)/vwapZ when non-zero
              const sd = Math.abs((r.price - r.vwap) / r.vwapZ);
              return sd > 0 ? Number(((m.last - r.vwap) / sd).toFixed(2)) : r.vwapZ;
            })()
          : r.vwapZ;
      return {
        ...r,
        price: m.last,
        chg24hPct: chg,
        vol24hUsd: m.quoteVol > 0 ? m.quoteVol : r.vol24hUsd,
        vwapZ,
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, mini.tick]);

  const sectors = useMemo(() => {
    const counts = new Map<string, number>();
    let fastCount = 0;
    for (const r of cryptoLive) {
      if (r.tier === "fast") fastCount++;
      const k = r.sector.toLowerCase();
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    const keys = [...counts.keys()].sort((a, b) => {
      const ia = SECTOR_ORDER.indexOf(a);
      const ib = SECTOR_ORDER.indexOf(b);
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    });
    return { fastCount, items: keys.map((k) => ({ key: k, count: counts.get(k) ?? 0 })) };
  }, [cryptoLive]);

  const stats = useMemo(() => {
    let aPlus = 0;
    let gradeA = 0;
    let bull = 0;
    let bear = 0;
    let deskActive = 0;
    for (const r of cryptoLive) {
      if (r.deskBadge) deskActive++;
      if (!r.confluence) continue;
      if (r.confluence.readiness === "A+") aPlus++;
      else if (r.confluence.readiness === "A") gradeA++;
      if (r.confluence.bias === "BULL") bull++;
      else if (r.confluence.bias === "BEAR") bear++;
    }
    return { aPlus, gradeA, bull, bear, deskActive };
  }, [cryptoLive]);

  const filteredCrypto = useMemo(() => {
    const s = search.trim().toUpperCase();
    const list = cryptoLive.filter((r) => {
      if (sectorFilter === "fast" && r.tier !== "fast") return false;
      else if (sectorFilter !== "all" && sectorFilter !== "fast" && r.sector.toLowerCase() !== sectorFilter) {
        return false;
      }
      if (warmOnly && !r.warm) return false;
      if (setupsOnly && (!r.confluence || r.confluence.readiness === "WAIT")) return false;
      if (!s) return true;
      return r.sym.includes(s) || r.name.toUpperCase().includes(s) || r.sector.toUpperCase().includes(s);
    });

    const dir = cryptoAsc ? 1 : -1;
    return [...list].sort((a, b) => {
      switch (cryptoSort) {
        case "sym":
          return a.sym.localeCompare(b.sym) * dir;
        case "vol":
          return ((a.vol24hUsd ?? -1) - (b.vol24hUsd ?? -1)) * dir;
        case "chg":
          return ((a.chg24hPct ?? -999) - (b.chg24hPct ?? -999)) * dir;
        case "vwapZ":
          return (Math.abs(a.vwapZ ?? -1) - Math.abs(b.vwapZ ?? -1)) * dir;
        case "liqDist":
          return ((a.liqMagnet?.distPct ?? 999) - (b.liqMagnet?.distPct ?? 999)) * dir;
        case "funding":
          return (Math.abs(a.funding8hPct ?? -1) - Math.abs(b.funding8hPct ?? -1)) * dir;
        case "confluence":
        default: {
          const sa = a.confluence ? Math.abs(a.confluence.score) + (a.deskBadge ? 0.4 : 0) : -1;
          const sb = b.confluence ? Math.abs(b.confluence.score) + (b.deskBadge ? 0.4 : 0) : -1;
          if (sa !== sb) return (sa - sb) * dir;
          return ((b.vol24hUsd ?? 0) - (a.vol24hUsd ?? 0));
        }
      }
    });
  }, [cryptoLive, sectorFilter, warmOnly, setupsOnly, search, cryptoSort, cryptoAsc]);

  const tradfiLive = useMemo(() => {
    const rows = data?.tradfi ?? [];
    return rows.map((r: ScreenerTradFiRow) => {
      const bm = r.binPair ? getMini(r.binPair) : undefined;
      const hl = getHlMid(r.hlCoin);
      const binLast = bm?.last ?? r.binLast;
      const binChg24hPct =
        bm && bm.open > 0
          ? Number((((bm.last - bm.open) / bm.open) * 100).toFixed(2))
          : r.binChg24hPct;
      const binVol24hUsd = bm && bm.quoteVol > 0 ? Math.round(bm.quoteVol) : r.binVol24hUsd;
      const mark = hl?.mid ?? r.mark;
      const dislocationPct =
        mark != null && r.oracle && r.oracle > 0
          ? Number((((mark - r.oracle) / r.oracle) * 100).toFixed(3))
          : r.dislocationPct;
      return {
        ...r,
        binLast,
        binChg24hPct,
        binVol24hUsd,
        mark,
        dislocationPct,
        binDir: bm?.dir ?? ("flat" as const),
        hlDir: hl?.dir ?? ("flat" as const),
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.tradfi, mini.tick, hlMids.tick]);

  const filteredTradFi = useMemo(() => {
    const s = search.trim().toUpperCase();
    const list = tradfiLive.filter((r) => {
      if (tradfiKlass === "mt5" && !r.broker) return false;
      else if (tradfiKlass === "wl" && r.broker != null) return false;
      else if (tradfiKlass === "binance" && !r.binPair) return false;
      else if (
        tradfiKlass !== "all" &&
        tradfiKlass !== "mt5" &&
        tradfiKlass !== "wl" &&
        tradfiKlass !== "binance" &&
        r.klass !== tradfiKlass
      ) {
        return false;
      }
      if (!s) return true;
      return (
        r.sym.includes(s) ||
        r.name.toUpperCase().includes(s) ||
        (r.hlCoin?.toUpperCase().includes(s) ?? false) ||
        (r.binPair?.toUpperCase().includes(s) ?? false)
      );
    });
    const dir = tradfiAsc ? 1 : -1;
    return [...list].sort((a, b) => {
      switch (tradfiSort) {
        case "sym":
          return a.sym.localeCompare(b.sym) * dir;
        case "oi":
          return ((a.oiNotionalUsd ?? -1) - (b.oiNotionalUsd ?? -1)) * dir;
        case "disloc":
          return (Math.abs(a.dislocationPct ?? -1) - Math.abs(b.dislocationPct ?? -1)) * dir;
        case "funding":
          return (Math.abs(a.fundingAprPct ?? -1) - Math.abs(b.fundingAprPct ?? -1)) * dir;
        case "vol":
        default: {
          const va = Math.max(a.binVol24hUsd ?? -1, a.vol24hUsd ?? -1);
          const vb = Math.max(b.binVol24hUsd ?? -1, b.vol24hUsd ?? -1);
          return (va - vb) * dir;
        }
      }
    });
  }, [tradfiLive, tradfiKlass, search, tradfiSort, tradfiAsc]);

  const toggleCryptoSort = (key: CryptoSortKey) => {
    if (cryptoSort === key) setCryptoAsc(!cryptoAsc);
    else {
      setCryptoSort(key);
      setCryptoAsc(key === "sym" || key === "liqDist");
    }
  };

  const toggleTradFiSort = (key: TradFiSortKey) => {
    if (tradfiSort === key) setTradfiAsc(!tradfiAsc);
    else {
      setTradfiSort(key);
      setTradfiAsc(key === "sym");
    }
  };

  return (
    <div className="space-y-3">
      {/* Cockpit KPI strip */}
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-neutral-800 bg-[#11151a] px-4 py-2.5">
        <div className="flex items-center gap-1 rounded-md border border-neutral-800 bg-[#0b0e11] p-0.5">
          <button
            onClick={() => setTab("crypto")}
            className={`rounded px-3 py-1 text-xs font-semibold transition-colors ${
              tab === "crypto" ? "bg-emerald-500/20 text-emerald-300" : "text-neutral-400 hover:text-neutral-200"
            }`}
          >
            Crypto &amp; Metals ({data?.totalCount ?? 33})
          </button>
          <button
            onClick={() => setTab("tradfi")}
            className={`rounded px-3 py-1 text-xs font-semibold transition-colors ${
              tab === "tradfi" ? "bg-sky-500/20 text-sky-300" : "text-neutral-400 hover:text-neutral-200"
            }`}
          >
            TradFi Core ({data?.tradfi.length ?? 0})
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-[11px]">
          <span className="font-mono text-neutral-400" title="Assets scanned in backend scanner lanes">
            Warm{" "}
            <strong className="text-neutral-100">
              {data?.warmCount ?? 0}/{data?.totalCount ?? 33}
            </strong>
          </span>
          <span className="font-mono text-emerald-400">A+ {stats.aPlus}</span>
          <span className="font-mono text-sky-400">A {stats.gradeA}</span>
          <span className="font-mono text-neutral-400">
            Bias <span className="text-emerald-400">{stats.bull}B</span> /{" "}
            <span className="text-rose-400">{stats.bear}S</span>
          </span>
          {stats.deskActive > 0 && (
            <span className="rounded bg-amber-500/15 px-1.5 py-0.5 font-mono text-[10px] text-amber-300">
              Desk {stats.deskActive}
            </span>
          )}
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter ticker / sector…"
            className="w-44 rounded-md border border-neutral-800 bg-[#0b0e11] px-2.5 py-1 text-xs text-neutral-100 placeholder:text-neutral-600 focus:border-emerald-500 focus:outline-none"
          />
          <span
            className={`rounded px-2 py-0.5 font-mono text-[10px] ${
              mini.status === "open"
                ? "bg-emerald-500/15 text-emerald-400"
                : data?.fapiOk
                  ? "bg-amber-500/15 text-amber-300"
                  : "bg-neutral-800 text-neutral-500"
            }`}
          >
            {mini.status === "open" ? "WS 1Hz" : data?.fapiOk ? "REST 15s" : "SYNC"}
          </span>
        </div>
      </div>

      {q.error && !data && (
        <div className="rounded-lg border border-rose-900/50 bg-rose-950/30 px-4 py-3 text-xs text-rose-300">
          Screener failed: {q.error}
        </div>
      )}
      {warmError && (
        <div className="rounded-lg border border-amber-900/50 bg-amber-950/30 px-4 py-2 text-xs text-amber-300">
          {warmError}
        </div>
      )}

      {tab === "crypto" ? (
        <>
          {/* Sector & readiness filter bar */}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={() => setSectorFilter("all")}
              className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors ${
                sectorFilter === "all"
                  ? "bg-neutral-100 text-neutral-900"
                  : "bg-[#11151a] text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200"
              }`}
            >
              All ({cryptoLive.length})
            </button>
            <button
              onClick={() => setSectorFilter("fast")}
              className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors ${
                sectorFilter === "fast"
                  ? "bg-emerald-400 text-neutral-950"
                  : "bg-[#11151a] text-emerald-400/90 hover:bg-neutral-800"
              }`}
            >
              ⚡ Fast ({sectors.fastCount})
            </button>
            {sectors.items.map((sec) => (
              <button
                key={sec.key}
                onClick={() => setSectorFilter(sec.key)}
                className={`rounded-md px-2.5 py-1 text-[11px] font-medium uppercase transition-colors ${
                  sectorFilter === sec.key
                    ? "bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/40"
                    : "bg-[#11151a] text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200"
                }`}
              >
                {sec.key} ({sec.count})
              </button>
            ))}

            <div className="ml-auto flex items-center gap-1.5">
              <button
                onClick={() => setWarmOnly((v) => !v)}
                className={`rounded px-2 py-1 text-[11px] font-medium ${
                  warmOnly ? "bg-cyan-500/20 text-cyan-300" : "bg-[#11151a] text-neutral-500 hover:text-neutral-300"
                }`}
              >
                Warm only
              </button>
              <button
                onClick={() => setSetupsOnly((v) => !v)}
                className={`rounded px-2 py-1 text-[11px] font-medium ${
                  setupsOnly ? "bg-amber-500/20 text-amber-300" : "bg-[#11151a] text-neutral-500 hover:text-neutral-300"
                }`}
              >
                A+/A/B Setups
              </button>
            </div>
          </div>

          {/* Crypto & Metals Alpha Table */}
          <div className="overflow-x-auto rounded-lg border border-neutral-800 bg-[#11151a]">
            <table className="w-full min-w-[1060px] border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-neutral-800 bg-[#0d1117] text-[10px] uppercase tracking-wider text-neutral-500">
                  <th className="px-3 py-2.5">
                    <button onClick={() => toggleCryptoSort("sym")} className="hover:text-neutral-200">
                      Asset {cryptoSort === "sym" ? (cryptoAsc ? "↑" : "↓") : ""}
                    </button>
                  </th>
                  <th className="px-2 py-2.5 text-right">Price</th>
                  <th className="px-2 py-2.5 text-right">
                    <button onClick={() => toggleCryptoSort("chg")} className="hover:text-neutral-200">
                      24h % {cryptoSort === "chg" ? (cryptoAsc ? "↑" : "↓") : ""}
                    </button>
                  </th>
                  <th className="px-2 py-2.5 text-right">
                    <button onClick={() => toggleCryptoSort("vol")} className="hover:text-neutral-200">
                      24h Vol {cryptoSort === "vol" ? (cryptoAsc ? "↑" : "↓") : ""}
                    </button>
                  </th>
                  <th className="px-2 py-2.5">
                    <button onClick={() => toggleCryptoSort("confluence")} className="hover:text-neutral-200">
                      Setup / Factors {cryptoSort === "confluence" ? (cryptoAsc ? "↑" : "↓") : ""}
                    </button>
                  </th>
                  <th className="px-2 py-2.5 text-right">
                    <button onClick={() => toggleCryptoSort("vwapZ")} className="hover:text-neutral-200">
                      VWAP σ {cryptoSort === "vwapZ" ? (cryptoAsc ? "↑" : "↓") : ""}
                    </button>
                  </th>
                  <th className="px-2 py-2.5">4H EMA · RSI1H</th>
                  <th className="px-2 py-2.5">Footprint Signal</th>
                  <th className="px-2 py-2.5">
                    <button onClick={() => toggleCryptoSort("liqDist")} className="hover:text-neutral-200">
                      Liq Magnet {cryptoSort === "liqDist" ? (cryptoAsc ? "↑" : "↓") : ""}
                    </button>
                  </th>
                  <th className="px-2 py-2.5 text-right">
                    <button onClick={() => toggleCryptoSort("funding")} className="hover:text-neutral-200">
                      Fund 8h / Whale {cryptoSort === "funding" ? (cryptoAsc ? "↑" : "↓") : ""}
                    </button>
                  </th>
                  <th className="px-3 py-2.5 text-right">Scan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800/60">
                {filteredCrypto.length === 0 && (
                  <tr>
                    <td colSpan={11} className="px-4 py-8 text-center text-sm text-neutral-500">
                      {q.loading ? "Loading cross-asset screener…" : "No assets match the current filters."}
                    </td>
                  </tr>
                )}
                {filteredCrypto.map((r) => {
                  const isCur = r.sym === currentSym;
                  const isPin = pinnedSet.has(r.sym);
                  const chgCls =
                    r.chg24hPct == null
                      ? "text-neutral-500"
                      : r.chg24hPct >= 0
                        ? "text-emerald-400"
                        : "text-rose-400";
                  const zCls =
                    r.vwapZ == null
                      ? "text-neutral-600"
                      : Math.abs(r.vwapZ) >= 2
                        ? r.vwapZ > 0
                          ? "text-amber-300 font-semibold"
                          : "text-cyan-300 font-semibold"
                        : r.vwapZ > 0
                          ? "text-emerald-400/90"
                          : "text-rose-400/90";

                  return (
                    <tr
                      key={r.sym}
                      onClick={() => onPickAsset(r.sym)}
                      className={`cursor-pointer transition-colors hover:bg-neutral-800/40 ${
                        isCur ? "bg-emerald-500/8" : ""
                      }`}
                    >
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onTogglePin(r.sym);
                            }}
                            title={isPin ? "Unpin" : "Pin"}
                            className={`text-xs ${isPin ? "text-amber-400" : "text-neutral-700 hover:text-amber-400"}`}
                          >
                            {isPin ? "★" : "☆"}
                          </button>
                          <span className="font-mono font-bold text-neutral-100">{r.sym}</span>
                          <span className="rounded bg-neutral-800 px-1 text-[9px] uppercase text-neutral-400">
                            {r.sector}
                          </span>
                          {r.tier === "fast" && (
                            <span className="text-[10px] text-emerald-400" title="Fast 20s scan lane">
                              ⚡
                            </span>
                          )}
                          {r.deskBadge && (
                            <span
                              className={`rounded px-1 text-[9px] font-semibold ${
                                r.deskBadge.tone === "pos"
                                  ? "bg-emerald-500/20 text-emerald-300"
                                  : r.deskBadge.tone === "limit"
                                    ? "bg-cyan-500/20 text-cyan-300"
                                    : "bg-amber-500/20 text-amber-300"
                              }`}
                            >
                              {r.deskBadge.badge}
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="px-2 py-2 text-right font-mono tabular-nums text-neutral-100">
                        {fmtPriceVal(r.price, r.priceDecs)}
                      </td>

                      <td className={`px-2 py-2 text-right font-mono tabular-nums ${chgCls}`}>
                        {r.chg24hPct != null ? `${r.chg24hPct >= 0 ? "+" : ""}${r.chg24hPct.toFixed(2)}%` : "–"}
                      </td>

                      <td className="px-2 py-2 text-right font-mono tabular-nums text-neutral-400">
                        {fmtUsdCompact(r.vol24hUsd)}
                      </td>

                      <td className="px-2 py-2">
                        {r.confluence ? (
                          <div className="flex flex-wrap items-center gap-1" title={r.confluence.factors.join(" · ")}>
                            <span className={`rounded px-1.5 py-0.5 font-mono text-[10px] font-bold ${readinessBadge(r.confluence)}`}>
                              {r.confluence.readiness} {r.confluence.bias === "BULL" ? "▲" : r.confluence.bias === "BEAR" ? "▼" : "•"}
                            </span>
                            <span className="truncate max-w-[175px] text-[10px] text-neutral-400">
                              {r.confluence.factors.slice(0, 2).join(" · ")}
                            </span>
                          </div>
                        ) : (
                          <span className="text-[10px] text-neutral-600">–</span>
                        )}
                      </td>

                      <td className={`px-2 py-2 text-right font-mono tabular-nums ${zCls}`}>
                        {r.vwapZ != null ? `${r.vwapZ >= 0 ? "+" : ""}${r.vwapZ.toFixed(2)}σ` : "–"}
                      </td>

                      <td className="px-2 py-2 font-mono text-[11px] tabular-nums">
                        <span
                          className={`mr-1.5 rounded px-1 py-0.5 text-[9px] font-semibold ${
                            r.ema4h === "bull"
                              ? "bg-emerald-500/15 text-emerald-400"
                              : r.ema4h === "bear"
                                ? "bg-rose-500/15 text-rose-400"
                                : "text-neutral-600"
                          }`}
                        >
                          {r.ema4h ? r.ema4h.toUpperCase() : "–"}
                        </span>
                        <span
                          className={
                            r.rsi1h == null
                              ? "text-neutral-600"
                              : r.rsi1h <= 32
                                ? "text-emerald-300 font-semibold"
                                : r.rsi1h >= 68
                                  ? "text-rose-300 font-semibold"
                                  : "text-neutral-400"
                          }
                        >
                          {r.rsi1h != null ? r.rsi1h.toFixed(0) : "–"}
                        </span>
                      </td>

                      <td className="px-2 py-2">
                        {r.signal ? (
                          <div className="flex items-center gap-1">
                            <span
                              className={`rounded px-1 py-0.5 text-[9px] font-bold uppercase ${
                                r.signal.side === "buy"
                                  ? "bg-emerald-500/15 text-emerald-300"
                                  : "bg-rose-500/15 text-rose-300"
                              }`}
                            >
                              {r.signal.side}
                            </span>
                            <span className="max-w-[115px] truncate text-[10px] text-neutral-300">
                              {r.signal.title}
                            </span>
                            <span className="text-[9px] text-neutral-500">({r.signal.bt})</span>
                          </div>
                        ) : (
                          <span className="text-[10px] text-neutral-600">–</span>
                        )}
                      </td>

                      <td className="px-2 py-2 font-mono text-[11px] tabular-nums">
                        {r.liqMagnet ? (
                          <span
                            className={r.liqMagnet.side === "short" ? "text-rose-300" : "text-emerald-300"}
                            title={`Cluster @ ${fmtPriceVal(r.liqMagnet.price, r.priceDecs)} · Strength ${r.liqMagnet.strength}`}
                          >
                            {r.liqMagnet.side === "short" ? "↑" : "↓"} {r.liqMagnet.distPct.toFixed(2)}%{" "}
                            <span className="text-neutral-500">{fmtUsdCompact(r.liqMagnet.usd)}</span>
                          </span>
                        ) : (
                          <span className="text-neutral-600">–</span>
                        )}
                      </td>

                      <td className="px-2 py-2 text-right font-mono text-[11px] tabular-nums">
                        <span
                          className={
                            r.funding8hPct == null
                              ? "text-neutral-600"
                              : r.funding8hPct >= 0.03
                                ? "text-amber-300"
                                : r.funding8hPct <= -0.02
                                  ? "text-cyan-300"
                                  : "text-neutral-400"
                          }
                        >
                          {r.funding8hPct != null
                            ? `${r.funding8hPct >= 0 ? "+" : ""}${r.funding8hPct.toFixed(3)}%`
                            : "–"}
                        </span>
                        {r.whaleImbPct != null && (
                          <span
                            className={`ml-1.5 text-[10px] ${
                              r.whaleImbPct >= 15
                                ? "text-emerald-400"
                                : r.whaleImbPct <= -15
                                  ? "text-rose-400"
                                  : "text-neutral-500"
                            }`}
                            title="Aggregate whale bid vs ask wall imbalance"
                          >
                            W{r.whaleImbPct >= 0 ? "+" : ""}
                            {r.whaleImbPct}%
                          </span>
                        )}
                      </td>

                      <td className="px-3 py-2 text-right font-mono text-[10px]">
                        {r.warm ? (
                          <span className="text-emerald-400/90" title="Scanner state age">
                            {fmtAge(r.scanAgeS)} →
                          </span>
                        ) : (
                          <button
                            type="button"
                            disabled={warmingSym === r.sym}
                            onClick={(e) => {
                              e.stopPropagation();
                              void handleWarm(r.sym);
                            }}
                            className="rounded border border-neutral-700 bg-neutral-900 px-2 py-0.5 text-[10px] text-neutral-300 hover:border-emerald-500 hover:text-emerald-300 disabled:opacity-50"
                          >
                            {warmingSym === r.sym ? "…" : "Warm"}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        /* Curated TradFi Core Tab */
        <div className="space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5">
              {[
                { id: "all", label: `All (${data?.tradfi.length ?? 0})` },
                { id: "binance", label: "Binance TradFi WS" },
                { id: "mt5", label: "MT5 Executable" },
                { id: "wl", label: "Watchlist Only (HL/Yahoo)" },
                { id: "equity", label: "Equities / ETFs" },
                { id: "index", label: "Indices" },
                { id: "commodity", label: "Commodities" },
              ].map((pill) => (
                <button
                  key={pill.id}
                  onClick={() => setTradfiKlass(pill.id)}
                  className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors ${
                    tradfiKlass === pill.id
                      ? "bg-sky-500/20 text-sky-300 ring-1 ring-sky-500/40"
                      : "bg-[#11151a] text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200"
                  }`}
                >
                  {pill.label}
                </button>
              ))}
            </div>
            <span className="text-[10px] text-neutral-500">
              Live Binance TRADIFI_PERPETUAL + Hyperliquid xyz WS · <strong className="text-neutral-300">No MT5</strong> = watchlist only
            </span>
          </div>

          <div className="overflow-x-auto rounded-lg border border-neutral-800 bg-[#11151a]">
            <table className="w-full min-w-[1040px] border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-neutral-800 bg-[#0d1117] text-[10px] uppercase tracking-wider text-neutral-500">
                  <th className="px-3 py-2.5">
                    <button onClick={() => toggleTradFiSort("sym")} className="hover:text-neutral-200">
                      Symbol {tradfiSort === "sym" ? (tradfiAsc ? "↑" : "↓") : ""}
                    </button>
                  </th>
                  <th className="px-2 py-2.5">Class / Venue</th>
                  <th className="px-2 py-2.5 text-right">Binance WS</th>
                  <th className="px-2 py-2.5 text-right">24h %</th>
                  <th className="px-2 py-2.5">HL Perp</th>
                  <th className="px-2 py-2.5 text-right">HL Mark</th>
                  <th className="px-2 py-2.5 text-right">Oracle</th>
                  <th className="px-2 py-2.5 text-right">
                    <button onClick={() => toggleTradFiSort("disloc")} className="hover:text-neutral-200">
                      Basis % {tradfiSort === "disloc" ? (tradfiAsc ? "↑" : "↓") : ""}
                    </button>
                  </th>
                  <th className="px-2 py-2.5 text-right">
                    <button onClick={() => toggleTradFiSort("vol")} className="hover:text-neutral-200">
                      24h Vol {tradfiSort === "vol" ? (tradfiAsc ? "↑" : "↓") : ""}
                    </button>
                  </th>
                  <th className="px-2 py-2.5 text-right">
                    <button onClick={() => toggleTradFiSort("oi")} className="hover:text-neutral-200">
                      HL OI {tradfiSort === "oi" ? (tradfiAsc ? "↑" : "↓") : ""}
                    </button>
                  </th>
                  <th className="px-2 py-2.5 text-right">
                    <button onClick={() => toggleTradFiSort("funding")} className="hover:text-neutral-200">
                      Fund APR {tradfiSort === "funding" ? (tradfiAsc ? "↑" : "↓") : ""}
                    </button>
                  </th>
                  <th className="px-3 py-2.5">Note</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800/60">
                {filteredTradFi.map((r) => {
                  const isPin = pinnedSet.has(r.sym);
                  const bestVol = Math.max(r.binVol24hUsd ?? 0, r.vol24hUsd ?? 0) || null;
                  const binDecs = r.binLast != null && r.binLast < 10 ? 3 : 2;
                  return (
                    <tr
                      key={r.sym}
                      onClick={() => onPickAsset(r.sym)}
                      className={`cursor-pointer transition-colors hover:bg-neutral-800/40 ${
                        r.sym === currentSym ? "bg-sky-500/8" : ""
                      }`}
                    >
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onTogglePin(r.sym);
                            }}
                            className={`text-xs ${isPin ? "text-amber-400" : "text-neutral-700 hover:text-amber-400"}`}
                          >
                            {isPin ? "★" : "☆"}
                          </button>
                          <span className="font-mono font-bold text-neutral-100">{r.sym}</span>
                          <span className="truncate max-w-[140px] text-[10px] text-neutral-500">{r.name}</span>
                        </div>
                      </td>

                      <td className="px-2 py-2">
                        <div className="flex items-center gap-1">
                          <span className="rounded bg-neutral-800 px-1.5 py-0.5 text-[9px] uppercase text-neutral-400">
                            {r.klass}
                          </span>
                          <span
                            className={`rounded px-1.5 py-0.5 text-[9px] font-semibold ${
                              r.broker ? "bg-emerald-500/15 text-emerald-300" : "bg-neutral-800 text-neutral-500"
                            }`}
                          >
                            {r.broker ? `MT5:${r.broker}` : "No MT5"}
                          </span>
                        </div>
                      </td>

                      <td
                        className={`px-2 py-2 text-right font-mono tabular-nums transition-colors ${
                          r.binDir === "up"
                            ? "text-emerald-300 font-semibold"
                            : r.binDir === "down"
                              ? "text-rose-300 font-semibold"
                              : "text-neutral-100"
                        }`}
                        title={r.binPair ?? undefined}
                      >
                        {r.binLast != null ? fmtPriceVal(r.binLast, binDecs) : "–"}
                      </td>

                      <td
                        className={`px-2 py-2 text-right font-mono tabular-nums ${
                          r.binChg24hPct == null
                            ? "text-neutral-600"
                            : r.binChg24hPct >= 0
                              ? "text-emerald-400"
                              : "text-rose-400"
                        }`}
                      >
                        {r.binChg24hPct != null
                          ? `${r.binChg24hPct >= 0 ? "+" : ""}${r.binChg24hPct.toFixed(2)}%`
                          : "–"}
                      </td>

                      <td className="px-2 py-2 font-mono text-[11px] text-cyan-400">{r.hlCoin ?? "–"}</td>

                      <td
                        className={`px-2 py-2 text-right font-mono tabular-nums transition-colors ${
                          r.hlDir === "up"
                            ? "text-emerald-300"
                            : r.hlDir === "down"
                              ? "text-rose-300"
                              : "text-neutral-100"
                        }`}
                      >
                        {r.mark != null ? r.mark.toLocaleString("en-US", { maximumFractionDigits: 4 }) : "–"}
                      </td>

                      <td className="px-2 py-2 text-right font-mono tabular-nums text-neutral-400">
                        {r.oracle != null ? r.oracle.toLocaleString("en-US", { maximumFractionDigits: 4 }) : "–"}
                      </td>

                      <td
                        className={`px-2 py-2 text-right font-mono tabular-nums ${
                          r.dislocationPct == null
                            ? "text-neutral-600"
                            : Math.abs(r.dislocationPct) >= 0.15
                              ? "text-amber-300 font-semibold"
                              : r.dislocationPct >= 0
                                ? "text-emerald-400"
                                : "text-rose-400"
                        }`}
                      >
                        {r.dislocationPct != null
                          ? `${r.dislocationPct >= 0 ? "+" : ""}${r.dislocationPct.toFixed(3)}%`
                          : "–"}
                      </td>

                      <td className="px-2 py-2 text-right font-mono tabular-nums text-neutral-300">
                        {fmtUsdCompact(bestVol)}
                        {r.thin && (
                          <span className="ml-1 rounded bg-amber-500/15 px-1 text-[9px] text-amber-300">THIN</span>
                        )}
                      </td>

                      <td className="px-2 py-2 text-right font-mono tabular-nums text-neutral-400">
                        {fmtUsdCompact(r.oiNotionalUsd)}
                      </td>

                      <td
                        className={`px-2 py-2 text-right font-mono tabular-nums ${
                          r.fundingAprPct == null
                            ? "text-neutral-600"
                            : r.fundingAprPct >= 0
                              ? "text-emerald-400"
                              : "text-rose-400"
                        }`}
                      >
                        {r.fundingAprPct != null
                          ? `${r.fundingAprPct >= 0 ? "+" : ""}${r.fundingAprPct.toFixed(1)}%`
                          : "–"}
                      </td>

                      <td className="px-3 py-2 text-[10px] text-neutral-500">{r.note ?? "→"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
