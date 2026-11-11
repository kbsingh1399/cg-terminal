"use client";

import type { DepthL2 } from "@/lib/binance/sym-feed";

/**
 * DepthLadder — the REAL-TIME L2 order book for the Binance tier.
 *
 * Fed by the <pair>@depth20@100ms partial-book stream (push snapshots, no
 * REST sync) via useDepth20 — 20 levels per side, throttled to 10 Hz.
 * Rows show price / qty / cumulative notional with a depth bar scaled to
 * the deepest level in view, plus the spread block and the 20-level
 * bid/ask imbalance.
 */

const N_ROWS = 12;

function fmtQty(q: number): string {
  if (q >= 1_000_000) return `${(q / 1_000_000).toFixed(2)}M`;
  if (q >= 1_000) return `${(q / 1_000).toFixed(1)}k`;
  if (q >= 100) return q.toFixed(0);
  if (q >= 1) return q.toFixed(2);
  return q.toPrecision(3);
}

function fmtUsd(v: number): string {
  if (v >= 1_000_000_000) return `$${(v / 1_000_000_000).toFixed(2)}B`;
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}k`;
  return `$${v.toFixed(0)}`;
}

export default function DepthLadder({
  depth,
  status,
  priceDecs,
}: {
  depth: DepthL2 | null;
  status: string;
  priceDecs: number;
}) {
  if (!depth) {
    return (
      <div className="rounded-lg border border-neutral-800 bg-[#11151a] p-4">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-neutral-400">Order book · L2 depth20 @100ms</div>
        <div className="py-8 text-center text-[11px] text-neutral-600">
          {status === "open" ? "waiting for the first book frame…" : `book stream ${status}…`}
        </div>
      </div>
    );
  }
  const asks = depth.asks.slice(0, N_ROWS); // best first
  const bids = depth.bids.slice(0, N_ROWS);
  const bestBid = depth.bids[0]?.[0] ?? 0;
  const bestAsk = depth.asks[0]?.[0] ?? 0;
  const mid = (bestBid + bestAsk) / 2;
  const spread = bestAsk - bestBid;
  const spreadBps = mid > 0 ? (spread / mid) * 10_000 : 0;

  // cumulative notional from the top of book (the honest "wall ahead of me" view)
  const askCum: number[] = [];
  let acc = 0;
  for (const [p, q] of asks) {
    acc += p * q;
    askCum.push(acc);
  }
  const bidCum: number[] = [];
  acc = 0;
  for (const [p, q] of bids) {
    acc += p * q;
    bidCum.push(acc);
  }
  const maxCum = Math.max(askCum[askCum.length - 1] ?? 0, bidCum[bidCum.length - 1] ?? 0, 1);

  // imbalance over ALL 20 levels
  const askUsd20 = depth.asks.reduce((a, [p, q]) => a + p * q, 0);
  const bidUsd20 = depth.bids.reduce((a, [p, q]) => a + p * q, 0);
  const totUsd = askUsd20 + bidUsd20;
  const bidPct = totUsd > 0 ? (bidUsd20 / totUsd) * 100 : 50;

  const px = (p: number) => p.toLocaleString("en-US", { minimumFractionDigits: priceDecs, maximumFractionDigits: priceDecs });

  const Row = ({ p, q, cum, side }: { p: number; q: number; cum: number; side: "ask" | "bid" }) => (
    <div className="relative grid grid-cols-[1.2fr_1fr_1fr] items-center px-2 py-[3px] font-mono text-[11px] tabular-nums">
      <div
        className={`absolute inset-y-[1px] right-0 ${side === "ask" ? "bg-red-500/10" : "bg-emerald-500/10"}`}
        style={{ width: `${Math.min(100, (cum / maxCum) * 100)}%` }}
      />
      <span className={`relative text-right ${side === "ask" ? "text-rose-400" : "text-emerald-400"}`}>{px(p)}</span>
      <span className="relative text-right text-neutral-300">{fmtQty(q)}</span>
      <span className="relative text-right text-neutral-500">{fmtUsd(cum)}</span>
    </div>
  );

  return (
    <div className="rounded-lg border border-neutral-800 bg-[#11151a] p-3">
      <div className="mb-1 flex items-baseline justify-between px-1">
        <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Order book</span>
        <span className="text-[10px] text-neutral-600">
          L2 depth20 @100ms · {status === "open" ? <span className="text-emerald-400">live</span> : status}
        </span>
      </div>
      <div className="grid grid-cols-[1.2fr_1fr_1fr] px-2 pb-1 text-[9px] uppercase tracking-wider text-neutral-600">
        <span className="text-right">price</span>
        <span className="text-right">qty</span>
        <span className="text-right">cum $</span>
      </div>
      {/* asks: worst→best so the best ask sits next to the spread */}
      <div>
        {asks
          .map((a, i) => ({ a, i }))
          .reverse()
          .map(({ a, i }) => (
            <Row key={`a${i}`} p={a[0]} q={a[1]} cum={askCum[i]} side="ask" />
          ))}
      </div>
      <div className="my-1 flex items-baseline justify-between rounded bg-neutral-800/70 px-2 py-1.5 font-mono text-[11px]">
        <span className="text-neutral-400">
          spread <span className="font-semibold text-neutral-200">{spread > 0 ? px(spread) : "–"}</span>
        </span>
        <span className="text-neutral-500">
          mid <span className="font-semibold text-neutral-200">{px(mid)}</span>
        </span>
        <span className="text-neutral-600">{spreadBps > 0 ? `${spreadBps.toFixed(1)} bps` : ""}</span>
      </div>
      <div>
        {bids.map((b, i) => (
          <Row key={`b${i}`} p={b[0]} q={b[1]} cum={bidCum[i]} side="bid" />
        ))}
      </div>
      <div className="mt-2 border-t border-neutral-800 px-2 pt-2">
        <div className="mb-1 flex justify-between text-[10px] text-neutral-500">
          <span className="text-emerald-400">{fmtUsd(bidUsd20)} bids</span>
          <span>20-level imbalance</span>
          <span className="text-rose-400">{fmtUsd(askUsd20)} asks</span>
        </div>
        <div className="flex h-1.5 overflow-hidden rounded-full bg-neutral-800">
          <div className="bg-emerald-500" style={{ width: `${bidPct}%` }} />
          <div className="bg-rose-500" style={{ width: `${100 - bidPct}%` }} />
        </div>
      </div>
    </div>
  );
}
