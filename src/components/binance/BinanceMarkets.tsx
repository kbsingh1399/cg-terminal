"use client";

import { useMemo, useState } from "react";
import { getMini, useMiniFeed } from "@/lib/binance/mini-feed";
import { usePolling } from "@/components/cg/use-cg-data";

/**
 * BinanceMarkets — the live Binance USDT-M Crypto & TradFi Perpetuals grid.
 *
 * Prices stream via batched sub-100ms @bookTicker + !bookTicker sweep (plus
 * 60s /fapi/v1/ticker/24hr open/vol/range seeding). When the browser cannot
 * hold WS connections, degrades cleanly to /api/binance/quotes (5s REST).
 */

interface UniResp {
  ok: boolean;
  n?: number;
  err?: string;
  assets: {
    sym: string;
    pair: string;
    rank: number;
    quoteVol24h: number;
    priceDecs: number;
    contractType?: string;
    underlyingType?: string;
  }[];
}

interface QuotesResp {
  ok: boolean;
  quotes: Record<string, { last: number; bid: number; ask: number }>;
}

type SortKey = "rank" | "sym" | "last" | "chg" | "vol";
type CatFilter = "all" | "crypto" | "equity" | "commodity";

function fmtUsd(v: number): string {
  if (v >= 1_000_000_000) return `$${(v / 1_000_000_000).toFixed(2)}B`;
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}k`;
  return `$${v.toFixed(0)}`;
}

export default function BinanceMarkets({ onPick }: { onPick: (sym: string) => void }) {
  const uni = usePolling<UniResp>("/api/binance/universe", 300_000);
  const mini = useMiniFeed({ sweepAll: true });
  const wsOpen = mini.liveStreaming;
  // REST fallback only while WS stream is not actively flowing
  const rest = usePolling<QuotesResp>(wsOpen ? null : "/api/binance/quotes", 5_000);

  const [q, setQ] = useState("");
  const [cat, setCat] = useState<CatFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("rank");
  const [sortAsc, setSortAsc] = useState(true);

  const assets = useMemo(() => uni.data?.assets ?? [], [uni.data]);

  const counts = useMemo(() => {
    let crypto = 0;
    let equity = 0;
    let commodity = 0;
    for (const a of assets) {
      if (a.contractType === "TRADIFI_PERPETUAL") {
        if (a.underlyingType === "COMMODITY") commodity++;
        else equity++;
      } else {
        crypto++;
      }
    }
    return { all: assets.length, crypto, equity, commodity };
  }, [assets]);

  const rows = useMemo(() => {
    const s = q.trim().toUpperCase();
    const filtered = assets.filter((a) => {
      if (cat === "crypto" && a.contractType === "TRADIFI_PERPETUAL") return false;
      if (cat === "equity" && !(a.contractType === "TRADIFI_PERPETUAL" && a.underlyingType !== "COMMODITY")) {
        return false;
      }
      if (cat === "commodity" && !(a.contractType === "TRADIFI_PERPETUAL" && a.underlyingType === "COMMODITY")) {
        return false;
      }
      if (!s) return true;
      return a.sym.includes(s) || a.pair.includes(s) || (a.underlyingType?.toUpperCase().includes(s) ?? false);
    });
    const val = (a: (typeof assets)[number]): number | string => {
      const m = getMini(a.pair);
      const r = rest.data?.quotes?.[a.sym];
      switch (sortKey) {
        case "sym":
          return a.sym;
        case "last":
          return m?.last ?? r?.last ?? 0;
        case "vol":
          return m?.quoteVol ?? a.quoteVol24h;
        case "chg": {
          if (m && m.open > 0) return ((m.last - m.open) / m.open) * 100;
          return null as unknown as number;
        }
        default:
          return a.rank;
      }
    };
    const sorted = [...filtered].sort((a, b) => {
      const va = val(a);
      const vb = val(b);
      const na = typeof va === "number" && Number.isFinite(va) ? va : -Infinity;
      const nb = typeof vb === "number" && Number.isFinite(vb) ? vb : -Infinity;
      if (na === nb) return a.rank - b.rank;
      return sortAsc ? na - nb : nb - na;
    });
    return sorted;
    // mini.tick is intentional: rows read the WS values via getMini() at
    // compute time, so the memo must re-run on every applied batch even
    // though the tick number itself is never referenced in the body
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assets, cat, q, sortKey, sortAsc, rest.data, mini.tick]);

  const sortBtn = (key: SortKey, label: string, cls = "") => (
    <button
      onClick={() => {
        if (sortKey === key) setSortAsc((x) => !x);
        else {
          setSortKey(key);
          setSortAsc(key === "rank" || key === "sym");
        }
      }}
      className={`px-2 py-1 text-[9px] font-semibold uppercase tracking-wider hover:text-neutral-300 ${
        sortKey === key ? "text-neutral-200" : "text-neutral-600"
      } ${cls}`}
    >
      {label} {sortKey === key ? (sortAsc ? "↑" : "↓") : ""}
    </button>
  );

  return (
    <div className="space-y-3">
      {/* header row: search + category filter + live badge */}
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-neutral-800 bg-[#11151a] px-4 py-3">
        <div>
          <div className="text-sm font-semibold text-neutral-100">
            Binance Futures · {assets.length || uni.data?.n || 250} Perpetuals (Crypto + TradFi)
          </div>
          <div className="text-[10px] text-neutral-500">
            every TRADING USDT perp ranked by rolling 24h quote volume · universe re-ranked every 4h ·
            {uni.data?.err ? <span className="text-amber-400"> stale list ({uni.data.err})</span> : " live-ranked"}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1">
          {[
            { id: "all" as const, label: `All (${counts.all})` },
            { id: "crypto" as const, label: `Crypto (${counts.crypto})` },
            { id: "equity" as const, label: `Equities & ETFs (${counts.equity})` },
            { id: "commodity" as const, label: `Commodities (${counts.commodity})` },
          ].map((p) => (
            <button
              key={p.id}
              onClick={() => setCat(p.id)}
              className={`rounded px-2 py-1 text-[10px] font-medium transition-colors ${
                cat === p.id
                  ? "bg-cyan-500/20 text-cyan-300 ring-1 ring-cyan-500/40"
                  : "bg-[#0b0e11] text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <span
          className={`ml-auto rounded px-2 py-1 text-[10px] font-semibold ${
            wsOpen
              ? "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/40"
              : rest.data?.ok
                ? "bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/40"
                : "bg-neutral-800 text-neutral-400"
          }`}
          title={
            wsOpen
              ? "browser WebSocket @bookTicker + !bookTicker sweep + 60s 24h stats seed"
              : "server REST fallback (fapi bookTicker, 5s) — WS reconnecting"
          }
        >
          {wsOpen ? "LIVE · WS" : rest.data?.ok ? "REST · 5s" : "connecting…"}
        </span>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="filter symbol…"
          className="w-44 rounded-md border border-neutral-700 bg-[#0b0e11] px-3 py-1.5 text-sm text-neutral-100 placeholder:text-neutral-600 focus:border-emerald-600 focus:outline-none"
        />
      </div>

      {/* table */}
      <div className="overflow-hidden rounded-lg border border-neutral-800 bg-[#11151a]">
        <div className="grid grid-cols-[3rem_1fr_1fr_1fr_1fr_1fr] border-b border-neutral-800 bg-[#0e1216] text-right">
          {sortBtn("rank", "#", "text-right")}
          {sortBtn("sym", "asset", "text-left pl-2")}
          {sortBtn("last", "last")}
          {sortBtn("chg", "24h chg")}
          <span className="px-2 py-1 text-right text-[9px] font-semibold uppercase tracking-wider text-neutral-600">24h range</span>
          {sortBtn("vol", "24h vol")}
        </div>
        <div className="max-h-[calc(100vh-320px)] overflow-y-auto">
          {rows.length === 0 && (
            <div className="py-10 text-center text-[11px] text-neutral-600">
              {uni.loading ? "loading the liquidity universe…" : "no match"}
            </div>
          )}
          {rows.map((a) => {
            const m = getMini(a.pair);
            const r = rest.data?.quotes?.[a.sym];
            const last = m?.last ?? r?.last ?? null;
            const chg = m && m.open > 0 ? ((m.last - m.open) / m.open) * 100 : null;
            const vol = m?.quoteVol ?? a.quoteVol24h;
            const px = (v: number | null) =>
              v == null
                ? "–"
                : v.toLocaleString("en-US", { minimumFractionDigits: a.priceDecs, maximumFractionDigits: a.priceDecs });
            const dirCls =
              m?.dir === "up"
                ? "text-emerald-300"
                : m?.dir === "down"
                  ? "text-rose-300"
                  : "text-neutral-100";
            return (
              <button
                key={a.sym}
                onClick={() => onPick(a.sym)}
                className="grid w-full grid-cols-[3rem_1fr_1fr_1fr_1fr_1fr] items-center border-b border-neutral-900 px-0 py-1.5 text-right font-mono text-[11px] tabular-nums transition-colors hover:bg-neutral-800/60"
              >
                <span className="pl-2 text-left text-[10px] text-neutral-600">#{a.rank}</span>
                <span className="pl-2 text-left font-sans text-[11px] font-bold text-cyan-300">
                  {a.sym}
                  <span className="ml-1 text-[9px] font-normal text-neutral-600">USDT</span>
                  {a.contractType === "TRADIFI_PERPETUAL" && (
                    <span className="ml-1.5 rounded bg-sky-500/15 px-1 py-0.5 text-[8px] font-semibold uppercase text-sky-300">
                      {a.underlyingType === "COMMODITY" ? "CMDTY" : "TRADFI"}
                    </span>
                  )}
                </span>
                <span className={`px-2 transition-colors ${dirCls}`}>{px(last)}</span>
                <span className={`px-2 font-semibold ${chg == null ? "text-neutral-600" : chg >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                  {chg == null ? "–" : `${chg >= 0 ? "+" : ""}${chg.toFixed(2)}%`}
                </span>
                <span className="px-2 text-[10px] text-neutral-500">
                  {m ? `${px(m.low)} – ${px(m.high)}` : "–"}
                </span>
                <span className="px-2 text-neutral-400">{vol > 0 ? fmtUsd(vol) : "–"}</span>
              </button>
            );
          })}
        </div>
      </div>
      <div className="text-[10px] text-neutral-600">
        Showing {rows.length} of {assets.length} assets · prices: Binance USDT-M futures · click a row for the live
        order-flow view (L2 book · tape · klines · funding/OI · demo ticket)
      </div>
    </div>
  );
}
