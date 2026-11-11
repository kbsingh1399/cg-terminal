"use client";

import { useEffect, useRef, useState } from "react";
import { useLiveQuote, useTradeTape, type LiveTrade } from "@/lib/live/feed";

/**
 * TradeTapePanel — every executed print on the Binance perp, straight from
 * the browser fstream @trade stream (shared with the perp live feed), the
 * moment it happens. Prints are batched in a ref and flushed to the DOM at
 * 4 Hz so even BTC's tape can never jank the page.
 */

interface TapeRow {
  id: number;
  p: number;
  q: number;
  buy: boolean;
  t: number;
}

const MAX_ROWS = 36;
const FLUSH_MS = 250;

function fmtUsd(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}k`;
  return `$${v.toFixed(0)}`;
}

let rowId = 0;

export default function TradeTapePanel({ sym, priceDecs }: { sym: string; priceDecs: number }) {
  const [rows, setRows] = useState<TapeRow[]>([]);
  const [rate, setRate] = useState<number>(0);
  const buf = useRef<TapeRow[]>([]);
  const rateWin = useRef<number[]>([]);
  const { status } = useLiveQuote(sym);

  useTradeTape(sym, (tr: LiveTrade) => {
    if (buf.current.length < 500) buf.current.push({ id: ++rowId, p: tr.p, q: tr.q, buy: tr.buy, t: tr.t });
    rateWin.current.push(tr.t);
  });

  useEffect(() => {
    const t = setInterval(() => {
      if (buf.current.length) {
        const fresh = buf.current;
        buf.current = [];
        setRows((prev) => [...fresh.reverse(), ...prev].slice(0, MAX_ROWS));
      }
      // prints/sec over the trailing 5s window (t = trade event time)
      const cutoff = Date.now() - 5_000;
      rateWin.current = rateWin.current.filter((t0) => t0 >= cutoff);
      setRate(Math.round(rateWin.current.length / 5));
    }, FLUSH_MS);
    return () => {
      clearInterval(t);
      buf.current = [];
      rateWin.current = [];
    };
  }, []);

  return (
    <div className="rounded-lg border border-neutral-800 bg-[#11151a] p-3">
      <div className="mb-1 flex items-baseline justify-between px-1">
        <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Trade tape</span>
        <span className="text-[10px] text-neutral-600">
          {status === "open" ? (
            <>
              <span className="text-emerald-400">{rate}/s</span> · fstream @trade
            </>
          ) : (
            `tape stream ${status} — reconnecting`
          )}
        </span>
      </div>
      <div className="grid grid-cols-[1fr_1fr_1fr_auto] px-2 pb-1 text-[9px] uppercase tracking-wider text-neutral-600">
        <span className="text-right">price</span>
        <span className="text-right">qty</span>
        <span className="text-right">notional</span>
        <span className="text-right">time</span>
      </div>
      <div className="max-h-[260px] overflow-y-auto">
        {rows.length === 0 && (
          <div className="py-6 text-center text-[11px] text-neutral-600">waiting for prints…</div>
        )}
        {rows.map((r, i) => (
          <div
            key={r.id}
            className={`grid grid-cols-[1fr_1fr_1fr_auto] items-center px-2 py-[3px] font-mono text-[11px] tabular-nums ${
              i === 0 ? "bg-neutral-800/50" : ""
            }`}
          >
            <span className={`text-right ${r.buy ? "text-emerald-400" : "text-rose-400"}`}>
              {r.p.toLocaleString("en-US", { minimumFractionDigits: priceDecs, maximumFractionDigits: priceDecs })}
            </span>
            <span className="text-right text-neutral-300">{r.q >= 1000 ? `${(r.q / 1000).toFixed(1)}k` : r.q.toPrecision(3)}</span>
            <span className={`text-right ${r.p * r.q >= 50_000 ? "font-semibold text-amber-300" : "text-neutral-500"}`}>
              {fmtUsd(r.p * r.q)}
            </span>
            <span className="pl-2 text-right text-neutral-600">
              {new Date(r.t).toISOString().slice(11, 19)}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-1 px-2 text-[9px] text-neutral-600">
        green = aggressive buy (taker bought) · amber notional ≥ $50k
      </div>
    </div>
  );
}
