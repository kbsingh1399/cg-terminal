"use client";

import { useTicker, type TickerSource } from "./use-cg-data";
import { assetOf } from "@/lib/cg/assets";

/**
 * LivePrice — the top-bar REAL-TIME ticker shown on every tab.
 *
 * Tier 0 is the Binance futures WebSocket (sub-100 ms): the price is the
 * last PRINTED trade (aggTrade) — the exact number the exchange app shows —
 * with the live best bid/ask underneath. If the browser cannot hold the WS,
 * the badge degrades honestly: REST 0.25s → Coinglass 3s.
 */

const SOURCE_BADGE: Record<Exclude<TickerSource, null>, { label: string; cls: string; title: string }> = {
  ws: {
    label: "real-time",
    cls: "bg-emerald-500/15 text-emerald-400 ring-emerald-500/40",
    title: "Binance USDT-M futures WebSocket · bookTicker + aggTrade · sub-100ms",
  },
  rest: {
    label: "0.25s",
    cls: "bg-emerald-500/15 text-emerald-400 ring-emerald-500/40",
    title: "Server REST fallback · Binance futures bookTicker · 250ms refresh",
  },
  "rest-cg": {
    label: "3s · cg",
    cls: "bg-amber-500/15 text-amber-300 ring-amber-500/40",
    title: "Coinglass fallback · forming m1 close · ~3s refresh (Binance REST unreachable)",
  },
};

export default function LivePrice({ sym }: { sym: string }) {
  const { price, bid, ask, dir, live, source } = useTicker(sym);
  const cfg = assetOf(sym);
  const decs = cfg?.priceDecs ?? 2;
  const fmt = (n: number | null | undefined) =>
    n == null || !Number.isFinite(n)
      ? "–"
      : n.toLocaleString("en-US", { minimumFractionDigits: decs, maximumFractionDigits: decs });
  const badge = source ? SOURCE_BADGE[source] : null;

  return (
    <div
      className="flex items-center gap-2.5 rounded-md border border-neutral-800 bg-[#11151a] px-3 py-1.5"
      title={`${sym}/USDT perp · Binance lead venue (real-time WS → 0.25s REST → 3s Coinglass ladder)${badge ? ` · active: ${badge.title}` : ""}`}
    >
      <span className="text-[10px] font-bold tracking-wide text-neutral-500">{sym}/USDT</span>
      <span
        className={`text-sm font-semibold tabular-nums transition-colors duration-150 ${
          dir === "up" ? "text-emerald-400" : dir === "down" ? "text-red-400" : "text-neutral-100"
        }`}
      >
        {fmt(price)}
      </span>
      {bid != null && ask != null && (
        <span className="hidden font-mono text-[10px] leading-tight text-neutral-500 sm:block">
          <span className="text-emerald-500/90">{fmt(bid)}</span>
          <span className="mx-0.5 text-neutral-700">/</span>
          <span className="text-red-500/90">{fmt(ask)}</span>
        </span>
      )}
      <span className="flex items-center gap-1.5">
        <span className={`h-1.5 w-1.5 rounded-full ${live ? "animate-pulse bg-emerald-400" : "bg-amber-400"}`} />
        {badge ? (
          <span
            className={`rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider ring-1 ${badge.cls}`}
          >
            {badge.label}
          </span>
        ) : (
          <span className="text-[9px] uppercase tracking-wider text-amber-400">connecting</span>
        )}
      </span>
    </div>
  );
}
