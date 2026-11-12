"use client";

import { useMemo } from "react";
import { useLiquidations } from "@/lib/binance/sym-feed";
import { usePolling } from "@/components/cg/use-cg-data";

/**
 * LiquidationFeed — LIVE liquidation prints for the active asset.
 *
 * Two sources merged (deduped by venue+time+price+qty):
 *  1. SERVER collector (/api/cg/liq-live): Binance !forceOrder@arr + Bybit
 *     allLiquidation + OKX liquidation-orders, persisted per asset
 *     (data/cg-liq/<SYM>.jsonl) — full multi-venue history, 1h/24h aggregates,
 *     warm across restarts. 5s poll.
 *  2. BROWSER fstream per-pair forceOrder overlay — instant local prints the
 *     moment they happen (kept from the old feed; it was never wrong, only
 *     session-only and single-venue).
 *
 * Honesty rules: a healthy collector with zero recent prints shows "quiet
 * book — last print X ago" (episodic feeds go minutes without events in calm
 * markets); a dead/reconnecting collector shows the venue telemetry, never a
 * fabricated quiet state.
 */

interface LiqPrintLite {
  t: number;
  venue: "binance" | "bybit" | "okx";
  asset: string;
  pair: string;
  side: "long" | "short";
  price: number;
  qtyBase: number | null;
  usd: number | null;
}

interface LiqStatsWinLite {
  count: number;
  longs: number;
  shorts: number;
  usd: number;
  largestUsd: number | null;
  lastAt: number | null;
}

interface LiqLiveAssetResp {
  ok: boolean;
  dataAt: number;
  ageMs: number;
  stale: boolean;
  quiet: boolean;
  source: string;
  venues: { venue: string; status: string; lastFrameAt: number | null; lastEventAt: number | null; frames: number; events: number; lastError: string | null }[];
  asset: {
    sym: string;
    supported: boolean;
    reason?: string;
    events: LiqPrintLite[];
    stats1h: LiqStatsWinLite;
    stats24h: LiqStatsWinLite;
    venuesSeen: string[];
  };
}

interface LiqLiveGlobalResp {
  ok: boolean;
  global: {
    universe1h: { count: number; usd: number; longs: number; shorts: number };
    universe24h: { count: number; usd: number; longs: number; shorts: number };
    assets: { sym: string; count1h: number; count24h: number; usd24h: number; lastAt: number | null }[];
  };
}

const VENUE_TAG: Record<string, string> = { binance: "BIN", bybit: "BYB", okx: "OKX" };
const VENUE_LIVE_STYLE: Record<string, string> = {
  open: "bg-emerald-500/15 text-emerald-300",
  connecting: "bg-amber-500/15 text-amber-300",
  reconnecting: "bg-amber-500/15 text-amber-300",
  dead: "bg-rose-500/15 text-rose-300",
  unavailable: "bg-neutral-800 text-neutral-500",
};

function fmtUsd(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "–";
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}k`;
  return `$${v.toFixed(0)}`;
}

function fmtAge(at: number, now: number): string {
  const s = Math.max(0, Math.round((now - at) / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.round(s / 60);
  if (m < 90) return `${m}m`;
  const h = Math.round(m / 60);
  if (h < 36) return `${h}h`;
  return `${Math.round(h / 24)}d`;
}

function hms(t: number): string {
  return new Date(t).toISOString().slice(11, 19);
}

export default function LiquidationFeed({ sym, priceDecs }: { sym: string; priceDecs: number }) {
  const server = usePolling<LiqLiveAssetResp>(`/api/cg/liq-live?sym=${encodeURIComponent(sym)}&limit=60`, 5_000);
  const globalQ = usePolling<LiqLiveGlobalResp>("/api/cg/liq-live?globalLimit=1", 30_000);
  const { liqs: clientLiqs, status: wsStatus } = useLiquidations(sym);
  const now = Date.now();

  const merged = useMemo(() => {
    const sv = server.data?.asset;
    const out: (LiqPrintLite & { live?: boolean })[] = [];
    const seen = new Set<string>();
    const keyOf = (venue: string, t: number, side: string, price: number, qty: number | null) =>
      `${venue}|${Math.round(t / 1000)}|${side}|${price.toFixed(8)}|${qty != null ? qty.toFixed(6) : "?"}`;
    if (sv?.supported) {
      for (const p of sv.events) {
        const k = keyOf(p.venue, p.t, p.side, p.price, p.qtyBase);
        if (seen.has(k)) continue;
        seen.add(k);
        out.push(p);
      }
    }
    // client fstream overlay (binance, active pair) — instant prints
    for (const l of clientLiqs) {
      const k = keyOf("binance", l.at, l.side, l.price, l.qty);
      if (seen.has(k)) continue;
      seen.add(k);
      out.push({ t: l.at, venue: "binance", asset: sym, pair: l.pair, side: l.side, price: l.price, qtyBase: l.qty, usd: l.qty * l.price, live: true });
    }
    out.sort((a, b) => b.t - a.t);
    return out.slice(0, 60);
  }, [server.data, clientLiqs, sym]);

  const a = server.data?.asset;
  const venues = server.data?.venues ?? [];
  const openVenues = venues.filter((v) => v.status === "open");
  const s1 = a?.stats1h;
  const s24 = a?.stats24h;
  const g1 = globalQ.data?.global?.universe1h;
  const gTop = (globalQ.data?.global?.assets ?? []).filter((x) => x.count1h > 0).slice(0, 4);

  return (
    <div className="rounded-lg border border-neutral-800 bg-[#11151a] p-3">
      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-x-3 px-1">
        <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
          Liquidations <span className="text-emerald-400">live</span>
        </span>
        <span className="flex items-center gap-1">
          {venues.map((v) => (
            <span
              key={v.venue}
              title={`${v.venue}: ${v.status}${v.lastError ? ` — ${v.lastError}` : ""} · ${v.frames} frames / ${v.events} events`}
              className={`rounded px-1 py-0.5 font-mono text-[9px] font-bold ${VENUE_LIVE_STYLE[v.status] ?? VENUE_LIVE_STYLE.unavailable}`}
            >
              {VENUE_TAG[v.venue] ?? v.venue.slice(0, 3).toUpperCase()}
            </span>
          ))}
          {wsStatus === "open" && (
            <span title="browser fstream forceOrder (instant prints)" className="rounded bg-emerald-500/15 px-1 py-0.5 font-mono text-[9px] font-bold text-emerald-300">
              WS·{sym}
            </span>
          )}
        </span>
      </div>

      {/* aggregates: 1h + 24h */}
      {a?.supported ? (
        <div className="mb-1.5 grid grid-cols-2 gap-1.5 px-1 font-mono text-[10px] tabular-nums">
          <div className="rounded border border-neutral-800/80 bg-[#0b0e11] px-2 py-1">
            <span className="text-[9px] uppercase tracking-wider text-neutral-500">1h</span>{" "}
            <span className="text-neutral-100">{s1?.count ?? 0} prints</span>{" "}
            <span className="text-amber-300/90">{fmtUsd(s1?.usd ?? 0)}</span>{" "}
            <span className="text-rose-400">{s1?.longs ?? 0}L</span>/<span className="text-emerald-400">{s1?.shorts ?? 0}S</span>
          </div>
          <div className="rounded border border-neutral-800/80 bg-[#0b0e11] px-2 py-1">
            <span className="text-[9px] uppercase tracking-wider text-neutral-500">24h</span>{" "}
            <span className="text-neutral-100">{s24?.count ?? 0} prints</span>{" "}
            <span className="text-amber-300/90">{fmtUsd(s24?.usd ?? 0)}</span>{" "}
            <span className="text-rose-400">{s24?.longs ?? 0}L</span>/<span className="text-emerald-400">{s24?.shorts ?? 0}S</span>
            {s24?.largestUsd != null && <span className="ml-1 text-neutral-500">max {fmtUsd(s24.largestUsd)}</span>}
          </div>
        </div>
      ) : null}

      {!a ? (
        <div className="py-5 text-center text-[11px] text-neutral-600">{server.error ? `liq feed error: ${server.error}` : "connecting liquidation collector…"}</div>
      ) : !a.supported ? (
        <div className="py-4 text-center text-[11px] leading-relaxed text-neutral-600">
          no liquidation events for {sym} — {a.reason ?? "no perp venue carries this instrument"}
        </div>
      ) : merged.length === 0 ? (
        <div className="py-5 text-center text-[11px] leading-relaxed text-neutral-600">
          {server.data?.stale ? (
            <>collector reconnecting — {openVenues.length === 0 ? "no venue connection live" : "all connections silent"} · last update {fmtAge(server.data.dataAt, now)} ago</>
          ) : (
            <>
              quiet book — no {sym} prints in the stored 24h window
              {a.stats24h.lastAt != null ? ` (last ${fmtAge(a.stats24h.lastAt, now)} ago)` : ""}
              <span className="block text-[10px] text-neutral-700">healthy collector · calm tape — liquidations are episodic, not constant</span>
            </>
          )}
        </div>
      ) : (
        <div className="max-h-[240px] overflow-y-auto">
          {merged.map((l, i) => (
            <div
              key={`${l.venue}-${l.t}-${i}`}
              className={`flex items-baseline justify-between gap-1 px-2 py-[3px] font-mono text-[11px] tabular-nums ${i === 0 ? "bg-neutral-800/50" : ""}`}
            >
              <span
                className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${
                  l.side === "long" ? "bg-red-500/15 text-rose-400" : "bg-emerald-500/15 text-emerald-400"
                }`}
              >
                {l.side === "long" ? "LONG LIQ" : "SHORT LIQ"}
              </span>
              <span className="truncate text-neutral-300">
                {l.qtyBase != null ? `${l.qtyBase.toPrecision(3)} @ ` : ""}
                {l.price.toLocaleString("en-US", { minimumFractionDigits: priceDecs, maximumFractionDigits: priceDecs })}
              </span>
              <span className={l.usd != null && l.usd >= 100_000 ? "font-semibold text-amber-300" : "text-neutral-500"}>{fmtUsd(l.usd)}</span>
              <span className="w-8 shrink-0 text-[9px] text-neutral-600">{VENUE_TAG[l.venue] ?? l.venue.slice(0, 3)}</span>
              <span className="w-14 shrink-0 text-right text-neutral-600">{hms(l.t)}</span>
            </div>
          ))}
        </div>
      )}

      {/* universe strip — market-wide liquidation pressure */}
      {g1 && (
        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 border-t border-neutral-800/60 px-1 pt-1.5 font-mono text-[9px] text-neutral-500">
          <span className="uppercase tracking-wider text-neutral-600">universe 1h</span>
          <span className="text-neutral-300">
            {g1.count} prints · {fmtUsd(g1.usd)}
          </span>
          <span className="text-rose-400">{Math.round((g1.longs / Math.max(1, g1.longs + g1.shorts)) * 100)}% long liqs</span>
          {gTop.length > 0 && <span className="text-neutral-600">hot: {gTop.map((x) => `${x.sym} ${x.count1h}`).join(" · ")}</span>}
        </div>
      )}
    </div>
  );
}
