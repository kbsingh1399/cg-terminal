"use client";

import { useTicker } from "./use-cg-data";
import { assetOf } from "@/lib/cg/assets";

/**
 * LivePrice — the top-bar 1-second ticker shown on every tab.
 * Pulses green when the feed is live, amber when degraded (stale).
 */
export default function LivePrice({ sym }: { sym: string }) {
  const { price, dir, live } = useTicker(sym);
  const cfg = assetOf(sym);
  const decs = cfg?.priceDecs ?? 2;
  const txt =
    price == null
      ? "–"
      : price.toLocaleString("en-US", { minimumFractionDigits: decs, maximumFractionDigits: decs });
  return (
    <div
      className="flex items-center gap-2 rounded-md border border-neutral-800 bg-[#11151a] px-3 py-1.5"
      title={`Live ${sym}/USDT perp price · Binance lead via Coinglass · 1s refresh`}
    >
      <span className="text-[10px] font-bold tracking-wide text-neutral-500">{sym}/USDT</span>
      <span
        className={`text-sm font-semibold tabular-nums transition-colors duration-300 ${
          dir === "up" ? "text-emerald-400" : dir === "down" ? "text-red-400" : "text-neutral-100"
        }`}
      >
        {txt}
      </span>
      <span className="flex items-center gap-1">
        <span className={`h-1.5 w-1.5 rounded-full ${live ? "animate-pulse bg-emerald-400" : "bg-amber-400"}`} />
        <span className="text-[9px] uppercase tracking-wider text-neutral-500">{live ? "live 1s" : "reconnecting"}</span>
      </span>
    </div>
  );
}
