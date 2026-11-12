"use client";

import { useMemo, useState } from "react";
import { usePolling } from "./use-cg-data";
import { getMini, useMiniFeed } from "@/lib/binance/mini-feed";
import type { ScreenerPayload, ScreenerRow } from "@/lib/cg/screener";

/**
 * AlphaMatrix (WS2 rebuild, 2026-11-12) — Curated-61 live radar:
 * 30 crypto perps + 28 TradFi perps + 3 classics in ONE table, powered by the
 * narrative radar's progressive M1/M2 sweep.
 *
 * Columns: M1/M2 state (regime · model · grade · direction), EV (R) from the
 * structural probability engine, VWAP σ, RVOL, OI 4h Δ + quadrant, OI-weighted
 * funding APR, trailing-5m live liquidation cascade USD, confluence factors,
 * footprint signal, liquidation magnet, and honest scan/radar ages.
 *
 * Filter pills: M1 Armed · M2 ±2σ · Cascade Active (5m) · Grade A/A+ ·
 * Crypto 30 · TradFi 28 · Classic 3. Sorts: EV (R) · Grade · |VWAP Z| ·
 * 5m Liq USD · volume · change · symbol.
 */

type CatFilter = "all" | "crypto" | "tradfi" | "classic";
type StatePill = "m1" | "m2" | "cascade" | "gradeA";
type SortKey = "ev" | "grade" | "vwapZ" | "liq5m" | "vol" | "chg" | "confluence" | "sym";

const GRADE_RANK: Record<string, number> = { "A+": 4, A: 3, B: 2, SKIP: 1 };

const MAJORS = new Set(["BTC", "ETH", "SOL"]);
/** cascade-pill threshold mirrors the scanner's concentrated tier (majors
 *  ≥ $500k, everything else ≥ $200k inside the trailing 5 minutes) */
function cascadeActive(r: ScreenerRow): boolean {
  if (!r.liq5m) return false;
  return r.liq5m.usd >= (MAJORS.has(r.sym) ? 500_000 : 200_000);
}

function m1Armed(r: ScreenerRow): boolean {
  return r.m1m2?.activeModel === "M1_TREND_PULLBACK" || r.m1m2?.activeModel === "WAIT_PULLBACK";
}

function m2Live(r: ScreenerRow): boolean {
  if (r.m1m2?.activeModel === "M2_MEAN_REVERSION" || r.m1m2?.activeModel === "WATCH_EXHAUSTION") return true;
  return r.vwapZ != null && Math.abs(r.vwapZ) >= 2;
}

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

function readinessBadge(r: NonNullable<ScreenerRow["confluence"]>): string {
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

function gradeBadge(grade: string): string {
  if (grade === "A+") return "bg-emerald-500/25 text-emerald-200 ring-1 ring-emerald-400/60";
  if (grade === "A") return "bg-emerald-500/15 text-emerald-300";
  if (grade === "B") return "bg-sky-500/10 text-sky-300";
  return "bg-neutral-800/80 text-neutral-500";
}

function modelShort(m: string): string {
  if (m === "M1_TREND_PULLBACK") return "M1 TRIG";
  if (m === "WAIT_PULLBACK") return "M1 WAIT";
  if (m === "M2_MEAN_REVERSION") return "M2 TRIG";
  if (m === "WATCH_EXHAUSTION") return "M2 WATCH";
  return "NO-TRADE";
}

function modelBadge(m: string): string {
  if (m === "M1_TREND_PULLBACK") return "bg-amber-500/20 text-amber-300 ring-1 ring-amber-500/40";
  if (m === "WAIT_PULLBACK") return "bg-amber-500/10 text-amber-400/90";
  if (m === "M2_MEAN_REVERSION") return "bg-violet-500/20 text-violet-300 ring-1 ring-violet-500/40";
  if (m === "WATCH_EXHAUSTION") return "bg-violet-500/10 text-violet-400/90";
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
  const q = usePolling<ScreenerPayload>("/api/cg/screener", 15_000);
  const mini = useMiniFeed();
  const [override, setOverride] = useState<{ at: number; data: ScreenerPayload } | null>(null);
  const [warmingSym, setWarmingSym] = useState<string | null>(null);
  const [warmError, setWarmError] = useState<string | null>(null);

  const [cat, setCat] = useState<CatFilter>("all");
  const [pills, setPills] = useState<Set<StatePill>>(new Set());
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("ev");
  const [asc, setAsc] = useState(false);

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

  const togglePill = (p: StatePill) => {
    setPills((prev) => {
      const next = new Set(prev);
      if (next.has(p)) next.delete(p);
      else next.add(p);
      return next;
    });
  };

  // Overlay 1Hz Binance !miniTicker@arr prices onto the server rows
  const rowsLive = useMemo(() => {
    const rows = data?.rows ?? [];
    return rows.map((r) => {
      if (!r.pair) return r;
      const m = getMini(r.pair);
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
      return { ...r, price: m.last, chg24hPct: chg, vol24hUsd: m.quoteVol > 0 ? m.quoteVol : r.vol24hUsd, vwapZ };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, mini.tick]);

  const stats = useMemo(() => {
    let m1 = 0;
    let m2 = 0;
    let gradeA = 0;
    let cascade = 0;
    let deskActive = 0;
    for (const r of rowsLive) {
      if (r.deskBadge) deskActive++;
      if (m1Armed(r)) m1++;
      if (m2Live(r)) m2++;
      if (r.m1m2 && (r.m1m2.grade === "A" || r.m1m2.grade === "A+")) gradeA++;
      if (cascadeActive(r)) cascade++;
    }
    return { m1, m2, gradeA, cascade, deskActive };
  }, [rowsLive]);

  const filtered = useMemo(() => {
    const s = search.trim().toUpperCase();
    const list = rowsLive.filter((r) => {
      if (cat === "crypto" && r.kind !== "crypto-perp") return false;
      if (cat === "tradfi" && r.kind !== "tradfi-perp") return false;
      if (cat === "classic" && r.kind !== "classic") return false;
      if (pills.has("m1") && !m1Armed(r)) return false;
      if (pills.has("m2") && !m2Live(r)) return false;
      if (pills.has("cascade") && !cascadeActive(r)) return false;
      if (pills.has("gradeA") && !(r.m1m2 && (r.m1m2.grade === "A" || r.m1m2.grade === "A+"))) return false;
      if (!s) return true;
      return r.sym.includes(s) || r.name.toUpperCase().includes(s) || r.sub.toUpperCase().includes(s);
    });

    const dir = asc ? 1 : -1;
    return [...list].sort((a, b) => {
      switch (sort) {
        case "sym":
          return a.sym.localeCompare(b.sym) * dir;
        case "vol":
          return ((a.vol24hUsd ?? -1) - (b.vol24hUsd ?? -1)) * dir;
        case "chg":
          return ((a.chg24hPct ?? -999) - (b.chg24hPct ?? -999)) * dir;
        case "vwapZ":
          return (Math.abs(a.vwapZ ?? -1) - Math.abs(b.vwapZ ?? -1)) * dir;
        case "liq5m":
          return ((a.liq5m?.usd ?? -1) - (b.liq5m?.usd ?? -1)) * dir;
        case "grade":
          return ((GRADE_RANK[a.m1m2?.grade ?? ""] ?? 0) - (GRADE_RANK[b.m1m2?.grade ?? ""] ?? 0)) * dir;
        case "ev":
          return ((a.m1m2?.evR ?? -Infinity) - (b.m1m2?.evR ?? -Infinity)) * dir;
        case "confluence":
        default: {
          const sa = a.confluence ? Math.abs(a.confluence.score) + (a.deskBadge ? 0.4 : 0) : -1;
          const sb = b.confluence ? Math.abs(b.confluence.score) + (b.deskBadge ? 0.4 : 0) : -1;
          if (sa !== sb) return (sa - sb) * dir;
          return (b.vol24hUsd ?? 0) - (a.vol24hUsd ?? 0);
        }
      }
    });
  }, [rowsLive, cat, pills, search, sort, asc]);

  const toggleSort = (key: SortKey) => {
    if (sort === key) setAsc(!asc);
    else {
      setSort(key);
      setAsc(key === "sym");
    }
  };

  const radar = data?.radar;
  const cryptoCount = rowsLive.filter((r) => r.kind === "crypto-perp").length;
  const tradfiCount = rowsLive.filter((r) => r.kind === "tradfi-perp").length;
  const classicCount = rowsLive.filter((r) => r.kind === "classic").length;

  return (
    <div className="space-y-3">
      {/* Cockpit KPI strip */}
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-neutral-800 bg-[#11151a] px-4 py-2.5">
        <div className="flex flex-wrap items-center gap-3 text-[11px]">
          <span className="font-mono text-neutral-400" title="Assets with warm scanner state">
            Warm{" "}
            <strong className="text-neutral-100">
              {data?.warmCount ?? 0}/{data?.totalCount ?? 61}
            </strong>
          </span>
          <span className="font-mono text-amber-400" title="M1 trend-pullback armed/waiting (narrative radar)">
            M1 {stats.m1}
          </span>
          <span className="font-mono text-violet-400" title="M2 ±2σ watch/triggered (narrative radar + live VWAP σ)">
            M2 {stats.m2}
          </span>
          <span className="font-mono text-emerald-400" title="Grade A / A+ setups (narrative radar)">
            A/A+ {stats.gradeA}
          </span>
          <span className="font-mono text-red-400" title="Trailing-5m liquidation cascade ≥ tier threshold (liq-live rings)">
            Cascade {stats.cascade}
          </span>
          {stats.deskActive > 0 && (
            <span className="rounded bg-amber-500/15 px-1.5 py-0.5 font-mono text-[10px] text-amber-300">Desk {stats.deskActive}</span>
          )}
          {radar && (
            <span
              className="font-mono text-[10px] text-neutral-500"
              title={`Narrative radar: ${radar.source} · next ${radar.nextSym ?? "?"} · errors ${radar.errors}`}
            >
              Radar {radar.statesCached}/{radar.universeSize} · {radar.fresh5m} fresh · next {radar.nextSym ?? "–"}
            </span>
          )}
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter ticker / name…"
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

      {/* Category + state filter pills */}
      <div className="flex flex-wrap items-center gap-1.5">
        {(
          [
            { id: "all", label: `All 61 (${rowsLive.length})` },
            { id: "crypto", label: `Crypto 30 (${cryptoCount})` },
            { id: "tradfi", label: `TradFi 28 (${tradfiCount})` },
            { id: "classic", label: `Classic 3 (${classicCount})` },
          ] as { id: CatFilter; label: string }[]
        ).map((pill) => (
          <button
            key={pill.id}
            onClick={() => setCat(pill.id)}
            className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors ${
              cat === pill.id
                ? "bg-neutral-100 text-neutral-900"
                : "bg-[#11151a] text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200"
            }`}
          >
            {pill.label}
          </button>
        ))}
        <span className="mx-1 h-4 w-px bg-neutral-800" />
        {(
          [
            { id: "m1", label: `M1 Armed (${stats.m1})`, cls: "bg-amber-500/20 text-amber-300 ring-1 ring-amber-500/40" },
            { id: "m2", label: `M2 ±2σ (${stats.m2})`, cls: "bg-violet-500/20 text-violet-300 ring-1 ring-violet-500/40" },
            { id: "cascade", label: `Cascade Active 5m (${stats.cascade})`, cls: "bg-red-600/25 text-red-300 ring-1 ring-red-500/40" },
            { id: "gradeA", label: `Grade A/A+ (${stats.gradeA})`, cls: "bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/40" },
          ] as { id: StatePill; label: string; cls: string }[]
        ).map((pill) => (
          <button
            key={pill.id}
            onClick={() => togglePill(pill.id)}
            className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors ${
              pills.has(pill.id) ? pill.cls : "bg-[#11151a] text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200"
            }`}
          >
            {pill.label}
          </button>
        ))}
      </div>

      {/* Curated-61 Alpha Table */}
      <div className="overflow-x-auto rounded-lg border border-neutral-800 bg-[#11151a]">
        <table className="w-full min-w-[1420px] border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-neutral-800 bg-[#0d1117] text-[10px] uppercase tracking-wider text-neutral-500">
              <th className="px-3 py-2.5">
                <button onClick={() => toggleSort("sym")} className="hover:text-neutral-200">
                  Asset {sort === "sym" ? (asc ? "↑" : "↓") : ""}
                </button>
              </th>
              <th className="px-2 py-2.5 text-right">Price</th>
              <th className="px-2 py-2.5 text-right">
                <button onClick={() => toggleSort("chg")} className="hover:text-neutral-200">
                  24h % {sort === "chg" ? (asc ? "↑" : "↓") : ""}
                </button>
              </th>
              <th className="px-2 py-2.5 text-right">
                <button onClick={() => toggleSort("vol")} className="hover:text-neutral-200">
                  24h Vol {sort === "vol" ? (asc ? "↑" : "↓") : ""}
                </button>
              </th>
              <th className="px-2 py-2.5">
                <button onClick={() => toggleSort("grade")} className="hover:text-neutral-200">
                  M1/M2 State {sort === "grade" ? (asc ? "↑" : "↓") : ""}
                </button>
              </th>
              <th className="px-2 py-2.5 text-right">
                <button onClick={() => toggleSort("ev")} className="hover:text-neutral-200">
                  EV (R) {sort === "ev" ? (asc ? "↑" : "↓") : ""}
                </button>
              </th>
              <th className="px-2 py-2.5 text-right">
                <button onClick={() => toggleSort("vwapZ")} className="hover:text-neutral-200">
                  VWAP σ {sort === "vwapZ" ? (asc ? "↑" : "↓") : ""}
                </button>
              </th>
              <th className="px-2 py-2.5 text-right" title="Relative volume (last h1 bar vs 20-bar average)">
                RVOL
              </th>
              <th className="px-2 py-2.5 text-right" title="Open-interest 4h change + OI×price quadrant (via /api/cg/quant)">
                OI 4h
              </th>
              <th className="px-2 py-2.5 text-right" title="OI-weighted funding APR (via /api/cg/quant)">
                Fund APR
              </th>
              <th className="px-2 py-2.5 text-right">
                <button onClick={() => toggleSort("liq5m")} className="hover:text-neutral-200">
                  Liq 5m {sort === "liq5m" ? (asc ? "↑" : "↓") : ""}
                </button>
              </th>
              <th className="px-2 py-2.5">
                <button onClick={() => toggleSort("confluence")} className="hover:text-neutral-200">
                  Confluence {sort === "confluence" ? (asc ? "↑" : "↓") : ""}
                </button>
              </th>
              <th className="px-2 py-2.5">Footprint Signal</th>
              <th className="px-2 py-2.5">Liq Magnet</th>
              <th className="px-3 py-2.5 text-right">Scan</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-800/60">
            {filtered.length === 0 && (
              <tr>
                <td colSpan={15} className="px-4 py-8 text-center text-sm text-neutral-500">
                  {q.loading ? "Loading Curated-61 radar…" : "No assets match the current filters."}
                </td>
              </tr>
            )}
            {filtered.map((r) => {
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
              const m = r.m1m2;
              const ev = m?.evR;
              const evCls =
                ev == null
                  ? "text-neutral-600"
                  : ev >= 0.5
                    ? "text-emerald-300 font-semibold"
                    : ev > 0
                      ? "text-emerald-400"
                      : "text-rose-400";
              const cascade = cascadeActive(r);

              return (
                <tr
                  key={r.sym}
                  onClick={() => onPickAsset(r.sym)}
                  className={`cursor-pointer transition-colors hover:bg-neutral-800/40 ${isCur ? "bg-emerald-500/8" : ""}`}
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
                      <span
                        className={`rounded px-1 text-[9px] uppercase ${
                          r.kind === "crypto-perp"
                            ? "bg-neutral-800 text-neutral-400"
                            : r.kind === "tradfi-perp"
                              ? "bg-sky-500/10 text-sky-400"
                              : "bg-violet-500/10 text-violet-400"
                        }`}
                      >
                        {r.sub}
                      </span>
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
                    {m ? (
                      <div
                        className="flex flex-wrap items-center gap-1"
                        title={`${m.regime} · ${m.activeModel} · ${m.direction} · grade ${m.grade} · confidence ${m.confidence}/100 · bestR ${
                          m.bestR != null ? m.bestR.toFixed(2) : "n/a"
                        } · pFill ${m.pFill != null ? `${Math.round(m.pFill * 100)}%` : "n/a"} · pT1 ${
                          m.pT1 != null ? `${Math.round(m.pT1 * 100)}%` : "n/a"
                        } · pMeanRevert ${m.pMeanRevert != null ? `${Math.round(m.pMeanRevert * 100)}%` : "n/a"} · verdict ${fmtAge(m.ageS)} old`}
                      >
                        <span className={`rounded px-1.5 py-0.5 font-mono text-[10px] font-bold ${modelBadge(m.activeModel)}`}>
                          {modelShort(m.activeModel)}
                        </span>
                        <span
                          className={`rounded px-1 py-0.5 font-mono text-[10px] font-bold ${gradeBadge(m.grade)}`}
                        >
                          {m.grade}
                        </span>
                        <span
                          className={`text-[10px] font-semibold ${
                            m.direction === "LONG"
                              ? "text-emerald-400"
                              : m.direction === "SHORT"
                                ? "text-rose-400"
                                : "text-neutral-500"
                          }`}
                        >
                          {m.direction !== "NEUTRAL" ? (m.direction === "LONG" ? "▲" : "▼") : "•"}
                        </span>
                        <span className="text-[9px] text-neutral-500">{m.regime.replace("_", " ").toLowerCase()}</span>
                        <span className="text-[9px] text-neutral-600">{fmtAge(m.ageS)}</span>
                      </div>
                    ) : (
                      <span className="text-[10px] text-neutral-600" title="Narrative radar hasn't reached this asset yet (progressive 12 s/asset sweep)">
                        warming…
                      </span>
                    )}
                  </td>

                  <td className={`px-2 py-2 text-right font-mono tabular-nums ${evCls}`} title="Structural expected value in R (fill-weighted, T1 ladder rung 1)">
                    {ev != null ? `${ev >= 0 ? "+" : ""}${ev.toFixed(2)}R` : "–"}
                  </td>

                  <td className={`px-2 py-2 text-right font-mono tabular-nums ${zCls}`}>
                    {r.vwapZ != null ? `${r.vwapZ >= 0 ? "+" : ""}${r.vwapZ.toFixed(2)}σ` : "–"}
                  </td>

                  <td
                    className={`px-2 py-2 text-right font-mono tabular-nums ${
                      r.rvol == null
                        ? "text-neutral-600"
                        : r.rvol >= 2
                          ? "text-amber-300 font-semibold"
                          : r.rvol >= 1.2
                            ? "text-emerald-400"
                            : "text-neutral-400"
                    }`}
                    title="Relative volume: last h1 bar volume / 20-bar average"
                  >
                    {r.rvol != null ? `${r.rvol.toFixed(2)}×` : "–"}
                  </td>

                  <td className="px-2 py-2 text-right font-mono text-[11px] tabular-nums">
                    {r.oi ? (
                      <span
                        title={`OI×price 4h quadrant: ${r.oi.quadrant4h ?? "n/a"} · OI-weighted funding APR ${
                          r.oi.fundingAprPct != null ? `${r.oi.fundingAprPct.toFixed(1)}%` : "n/a"
                        }`}
                      >
                        <span
                          className={
                            r.oi.delta4hPct == null
                              ? "text-neutral-500"
                              : r.oi.delta4hPct >= 0
                                ? "text-emerald-400"
                                : "text-rose-400"
                          }
                        >
                          {r.oi.delta4hPct != null ? `${r.oi.delta4hPct >= 0 ? "+" : ""}${r.oi.delta4hPct.toFixed(1)}%` : "–"}
                        </span>{" "}
                        <span className="text-[9px] text-neutral-500">
                          {r.oi.quadrant4h
                            ? r.oi.quadrant4h === "NEW_LONGS"
                              ? "NL"
                              : r.oi.quadrant4h === "SHORT_COVERING"
                                ? "SC"
                                : r.oi.quadrant4h === "NEW_SHORTS"
                                  ? "NS"
                                  : "LL"
                            : ""}
                        </span>
                      </span>
                    ) : (
                      <span className="text-neutral-600">–</span>
                    )}
                  </td>

                  <td
                    className={`px-2 py-2 text-right font-mono tabular-nums ${
                      r.oi?.fundingAprPct == null
                        ? "text-neutral-600"
                        : r.oi.fundingAprPct >= 0
                          ? "text-emerald-400"
                          : "text-rose-400"
                    }`}
                    title="OI-weighted funding APR (annualized, cross-venue)"
                  >
                    {r.oi?.fundingAprPct != null ? `${r.oi.fundingAprPct >= 0 ? "+" : ""}${r.oi.fundingAprPct.toFixed(1)}%` : "–"}
                  </td>

                  <td className="px-2 py-2 text-right font-mono tabular-nums">
                    {r.liq5m ? (
                      <span
                        className={cascade ? "font-semibold text-red-300" : "text-neutral-400"}
                        title={`${r.liq5m.count} liquidation prints in the trailing 5 minutes · dominant side ${r.liq5m.side} (liq-live multi-venue rings)`}
                      >
                        {fmtUsdCompact(r.liq5m.usd)}
                        <span className={`ml-1 text-[9px] ${r.liq5m.side === "long" ? "text-rose-400" : r.liq5m.side === "short" ? "text-emerald-400" : "text-neutral-500"}`}>
                          {r.liq5m.side === "long" ? "L" : r.liq5m.side === "short" ? "S" : "M"}
                        </span>
                      </span>
                    ) : (
                      <span className="text-neutral-600">–</span>
                    )}
                  </td>

                  <td className="px-2 py-2">
                    {r.confluence ? (
                      <div className="flex flex-wrap items-center gap-1" title={r.confluence.factors.join(" · ")}>
                        <span className={`rounded px-1.5 py-0.5 font-mono text-[10px] font-bold ${readinessBadge(r.confluence)}`}>
                          {r.confluence.readiness} {r.confluence.bias === "BULL" ? "▲" : r.confluence.bias === "BEAR" ? "▼" : "•"}
                        </span>
                        <span className="truncate max-w-[140px] text-[10px] text-neutral-400">
                          {r.confluence.factors.slice(0, 2).join(" · ")}
                        </span>
                      </div>
                    ) : (
                      <span className="text-[10px] text-neutral-600">–</span>
                    )}
                  </td>

                  <td className="px-2 py-2">
                    {r.signal ? (
                      <div className="flex items-center gap-1">
                        <span
                          className={`rounded px-1 py-0.5 text-[9px] font-bold uppercase ${
                            r.signal.side === "buy" ? "bg-emerald-500/15 text-emerald-300" : "bg-rose-500/15 text-rose-300"
                          }`}
                        >
                          {r.signal.side}
                        </span>
                        <span className="max-w-[115px] truncate text-[10px] text-neutral-300">{r.signal.title}</span>
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

      {data && (
        <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] text-neutral-500">
          <span>
            {data.source} · data age {data.ageMs != null ? `${Math.round(data.ageMs / 1000)}s` : "n/a"}
            {data.stale ? " · STALE" : ""}
          </span>
          <span>
            Narrative radar: {radar?.statesCached ?? 0}/{radar?.universeSize ?? 61} swept · {radar?.fresh5m ?? 0} fresh &lt; 5m ·{" "}
            {radar?.built ?? 0} built · {radar?.errors ?? 0} errors · sweep ≈ {radar?.sweepMinutes ?? "–"} min
          </span>
        </div>
      )}
    </div>
  );
}
