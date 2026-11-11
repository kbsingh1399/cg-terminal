"use client";

import { useLiquidations } from "@/lib/binance/sym-feed";

/**
 * LiquidationFeed — live Binance forceOrder prints for the active symbol
 * (the same event class the terminal's Coinglass liq-levels tool describes
 * in aggregate, here raw and per-print from the venue itself). Honest
 * empty state: quiet books say so.
 */

function fmtUsd(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}k`;
  return `$${v.toFixed(0)}`;
}

export default function LiquidationFeed({ sym, priceDecs }: { sym: string; priceDecs: number }) {
  const { liqs } = useLiquidations(sym);
  return (
    <div className="rounded-lg border border-neutral-800 bg-[#11151a] p-3">
      <div className="mb-1 flex items-baseline justify-between px-1">
        <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Liquidations</span>
        <span className="text-[10px] text-neutral-600">fstream forceOrder · {liqs.length} this session</span>
      </div>
      {liqs.length === 0 ? (
        <div className="py-5 text-center text-[11px] text-neutral-600">
          no liquidation prints for {sym}USDT yet — quiet book
        </div>
      ) : (
        <div className="max-h-[170px] overflow-y-auto">
          {liqs.map((l, i) => (
            <div
              key={`${l.at}-${i}`}
              className={`flex items-baseline justify-between px-2 py-[3px] font-mono text-[11px] tabular-nums ${
                i === 0 ? "bg-neutral-800/50" : ""
              }`}
            >
              <span
                className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${
                  l.side === "long" ? "bg-red-500/15 text-rose-400" : "bg-emerald-500/15 text-emerald-400"
                }`}
              >
                {l.side === "long" ? "LONG LIQ" : "SHORT LIQ"}
              </span>
              <span className="text-neutral-300">
                {l.qty.toPrecision(3)} @ {l.price.toLocaleString("en-US", { minimumFractionDigits: priceDecs, maximumFractionDigits: priceDecs })}
              </span>
              <span className={l.qty * l.price >= 100_000 ? "font-semibold text-amber-300" : "text-neutral-500"}>
                {fmtUsd(l.qty * l.price)}
              </span>
              <span className="text-neutral-600">{new Date(l.at).toISOString().slice(11, 19)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
