"use client";

import { useEffect, useState } from "react";
import { usePolling, useTicker } from "@/components/cg/use-cg-data";
import { useDepth20, useLiveBar, type LiveBar } from "@/lib/binance/sym-feed";
import { useTradeTape } from "@/lib/live/feed";
import { fetchKlinesDirect, fetchMarketDirect, type DirectMarket } from "@/lib/binance/direct";
import BinanceChart, { type Bar } from "./BinanceChart";
import DepthLadder from "./DepthLadder";
import TradeTapePanel from "./TradeTapePanel";
import LiquidationFeed from "./LiquidationFeed";
import DemoAccountPanel from "./DemoAccountPanel";

/**
 * BinanceView — the Tier-2 symbol page: REAL-TIME at every level.
 *
 *   quote      : fstream bookTicker/trade WS (shared ladder with the perps)
 *   book (L2)  : <pair>@depth20@100ms push snapshots
 *   tape       : every print, the moment it prints
 *   candles    : REST bootstrap + live <pair>@kline_<iv> forming bar
 *   derivatives: funding rate + next funding, mark vs last basis, open interest
 *   demo trade : the testnet account + order ticket (server-gated)
 *
 * Honest by design: nothing on this page is estimated — every number is a
 * Binance field, labelled with its stream.
 */

const PRESETS: { label: string; iv: string; ms: number }[] = [
  { label: "1m", iv: "1m", ms: 60_000 },
  { label: "5m", iv: "5m", ms: 300_000 },
  { label: "15m", iv: "15m", ms: 900_000 },
  { label: "1h", iv: "1h", ms: 3_600_000 },
  { label: "4h", iv: "4h", ms: 14_400_000 },
  { label: "1d", iv: "1d", ms: 86_400_000 },
];

interface MarketResp {
  ok: boolean;
  sym?: string;
  error?: string;
  ticker?: { last: number; chgPct: number; high: number; low: number; quoteVol: number; vwap: number; nTrades: number };
  mark?: { markPrice: number; indexPrice: number; fundingRatePct: number; nextFundingMs: number };
  oi?: { contracts: number; usd: number | null };
}

interface KlinesResp {
  ok: boolean;
  sym?: string;
  error?: string;
  rows: [number, number, number, number, number, number, number][];
}

function fmtUsd(v: number): string {
  if (v >= 1_000_000_000) return `$${(v / 1_000_000_000).toFixed(2)}B`;
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}k`;
  return `$${v.toFixed(0)}`;
}

function countdown(ms: number): string {
  if (ms <= 0) return "now";
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  return h > 0 ? `${h}h ${m}m` : m > 0 ? `${m}m ${s}s` : `${s}s`;
}

export default function BinanceView({
  sym,
  rank,
  priceDecs,
  qtyDecs,
}: {
  sym: string;
  rank: number;
  priceDecs: number;
  qtyDecs: number;
}) {
  const [presetIdx, setPresetIdx] = useState(2); // 15m
  const iv = PRESETS[presetIdx].iv;
  const [liveBar, setLiveBar] = useState<LiveBar | null>(null);
  useEffect(() => {
    setLiveBar(null); // never carry the previous symbol's forming bar
  }, [sym]);

  const mkt = usePolling<MarketResp>(`/api/binance/market?sym=${encodeURIComponent(sym)}`, 5_000);
  const kl = usePolling<KlinesResp>(
    `/api/binance/klines?sym=${encodeURIComponent(sym)}&interval=${iv}&limit=300`,
    60_000
  );
  const { depth, status: bookStatus } = useDepth20(sym);
  // Live forming bar — TAPE-DERIVED (authoritative where the kline stream
  // flows; some cloud egress IPs receive @trade/@depth but get @kline frames
  // filtered, and the tape always flows — it is the same stream the tape
  // panel prints). Every print updates o/h/l/c/v of the current interval
  // bucket exactly the way the exchange aggregates klines; the 60s REST
  // poll re-syncs closed bars.
  const ivMs = PRESETS[presetIdx].ms;
  useLiveBar(sym, iv, (b) => setLiveBar(b));
  useTradeTape(sym, (tr) => {
    setLiveBar((prev) => {
      const bucket = Math.floor(tr.t / ivMs) * ivMs;
      if (prev && prev.t === bucket) {
        return {
          t: bucket,
          o: prev.o,
          h: Math.max(prev.h, tr.p),
          l: Math.min(prev.l, tr.p),
          c: tr.p,
          v: prev.v + tr.q,
          final: false,
        };
      }
      return { t: bucket, o: tr.p, h: tr.p, l: tr.p, c: tr.p, v: tr.q, final: false };
    });
  });

  // browser-direct fallbacks — ONLY while the server routes fail (e.g. the
  // terminal host's egress IP carries a transient Binance weight ban): the
  // same public endpoints fetched from the user's own IP, the one already
  // holding the fstream WebSockets. Mirrors the perp live-price ladder.
  const pair = `${sym}USDT`;
  const mktFailed = !!mkt.error || (mkt.data != null && mkt.data.ok !== true);
  const [dm, setDm] = useState<DirectMarket | null>(null);
  useEffect(() => {
    if (!mktFailed) {
      setDm(null);
      return;
    }
    let alive = true;
    const tick = async () => {
      const d = await fetchMarketDirect(pair);
      if (alive && d) setDm(d);
    };
    void tick();
    const t = setInterval(tick, 10_000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [mktFailed, pair]);

  const klFailed = !!kl.error || (kl.data != null && kl.data.ok !== true);
  const [dk, setDk] = useState<[number, number, number, number, number, number, number][] | null>(null);
  useEffect(() => {
    if (!klFailed) {
      setDk(null);
      return;
    }
    let alive = true;
    const tick = async () => {
      const r = await fetchKlinesDirect(pair, iv, 300);
      if (alive && r) setDk(r);
    };
    void tick();
    const t = setInterval(tick, 30_000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [klFailed, pair, iv]);

  // live mid for the order ticket + mark-basis math (WS ladder shared with LivePrice)
  const t = useTicker(sym, 1_000);
  const mid = t.price ?? mkt.data?.ticker?.last ?? null;

  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(timer);
  }, []);

  // payload guard: never render a payload that belongs to another symbol
  const m = mkt.data && mkt.data.sym === sym ? mkt.data : null;
  const bars: Bar[] | null = (() => {
    if (kl.data && kl.data.ok && kl.data.sym === sym) {
      return kl.data.rows.map((r) => ({ t: r[0], o: r[1], h: r[2], l: r[3], c: r[4], v: r[5] }));
    }
    if (dk) return dk.map((r) => ({ t: r[0], o: r[1], h: r[2], l: r[3], c: r[4], v: r[5] }));
    return null;
  })();

  const tk = m?.ticker ?? dm?.ticker;
  const mk = m?.mark ?? dm?.mark;
  const oi = m?.oi ?? dm?.oi;
  const statsSrc = m ? "server · 5s" : dm ? "browser-direct (host fapi-banned)" : "connecting";
  const px = (v: number | null | undefined) =>
    v == null || !Number.isFinite(v)
      ? "–"
      : v.toLocaleString("en-US", { minimumFractionDigits: priceDecs, maximumFractionDigits: priceDecs });
  const refPx = mid ?? tk?.last ?? null;
  const basisPct = mk && refPx && refPx > 0 ? ((mk.markPrice - refPx) / refPx) * 100 : null;
  const fundingApr = mk ? mk.fundingRatePct * 3 * 365 : null; // 8h funding → APR

  const Stat = ({ label, value, cls = "text-neutral-100", title }: { label: string; value: string; cls?: string; title?: string }) => (
    <div className="min-w-[86px]" title={title}>
      <div className="text-[9px] uppercase tracking-wider text-neutral-600">{label}</div>
      <div className={`font-mono text-[12px] font-semibold tabular-nums ${cls}`}>{value}</div>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* interval presets */}
      <div className="flex flex-wrap items-center gap-2">
        {PRESETS.map((p, i) => (
          <button
            key={p.iv}
            onClick={() => {
              setPresetIdx(i);
              setLiveBar(null);
            }}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
              i === presetIdx ? "bg-cyan-500/20 text-cyan-300 ring-1 ring-cyan-500/40" : "text-neutral-400 hover:bg-neutral-900"
            }`}
          >
            {p.label}
          </button>
        ))}
        <span className="ml-2 text-[10px] text-neutral-600">
          {sym}USDT · Binance USDT-M perp · liquidity rank #{rank} · candles REST-bootstrapped then WS-live · stats: {statsSrc}
        </span>
      </div>

      {/* derivatives/stats strip */}
      <div className="flex flex-wrap items-center gap-x-7 gap-y-3 rounded-lg border border-neutral-800 bg-[#11151a] p-4">
        <Stat
          label="24h change"
          value={tk ? `${tk.chgPct >= 0 ? "+" : ""}${tk.chgPct.toFixed(2)}%` : "–"}
          cls={tk ? (tk.chgPct >= 0 ? "text-emerald-400" : "text-rose-400") : "text-neutral-600"}
        />
        <Stat label="24h high" value={px(tk?.high)} />
        <Stat label="24h low" value={px(tk?.low)} />
        <Stat label="24h volume" value={tk ? fmtUsd(tk.quoteVol) : "–"} title="rolling 24h quote volume" />
        <Stat label="24h vwap" value={px(tk?.vwap)} />
        <Stat label="24h trades" value={tk ? tk.nTrades.toLocaleString("en-US") : "–"} />
        <Stat
          label="mark"
          value={px(mk?.markPrice)}
          title="premiumIndex mark price"
          cls={basisPct != null && Math.abs(basisPct) > 0.1 ? "text-amber-300" : "text-neutral-100"}
        />
        <Stat
          label="mark basis"
          value={basisPct != null ? `${basisPct >= 0 ? "+" : ""}${basisPct.toFixed(3)}%` : "–"}
          title="mark vs live mid — perp premium/discount"
          cls={basisPct != null && Math.abs(basisPct) > 0.1 ? "text-amber-300" : "text-neutral-400"}
        />
        <Stat
          label="funding / 8h"
          value={mk ? `${mk.fundingRatePct >= 0 ? "+" : ""}${mk.fundingRatePct.toFixed(4)}%` : "–"}
          cls={mk ? (mk.fundingRatePct >= 0 ? "text-emerald-400" : "text-rose-400") : "text-neutral-600"}
          title={fundingApr != null ? `≈ ${fundingApr.toFixed(1)}% APR paid by the long side` : undefined}
        />
        <Stat label="next funding" value={mk?.nextFundingMs ? countdown(mk.nextFundingMs - now) : "–"} />
        <Stat label="open interest" value={oi?.usd != null ? fmtUsd(oi.usd) : oi ? oi.contracts.toLocaleString("en-US") : "–"} title={oi ? `${oi.contracts.toLocaleString("en-US")} contracts` : undefined} />
      </div>

      {mkt.error && !dm && (
        <div className="rounded-lg border border-amber-800/50 bg-amber-950/30 p-3 text-xs text-amber-300">
          Derivatives feed error: {mkt.error} — retrying every 5s (browser-direct fallback engaging…).
        </div>
      )}

      {/* main grid: chart + book/tape column */}
      <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        <div className="space-y-4">
          <div className="overflow-hidden rounded-lg border border-neutral-800 bg-[#11151a] p-2">
            <BinanceChart bars={bars} liveBar={liveBar} interval={iv} priceDecs={priceDecs} height={400} />
            <div className="flex justify-between px-2 pb-1 text-[9px] text-neutral-600">
              <span>
                {bars?.length ?? 0} bars · {iv} · UTC · live candle forms from the trade tape (kline stream when the
                network delivers it) · closed bars re-sync every 60s
              </span>
              <span>{liveBar ? `forming O ${px(liveBar.o)} H ${px(liveBar.h)} L ${px(liveBar.l)} C ${px(liveBar.c)}` : "waiting for the live bar…"}</span>
            </div>
          </div>
          <DemoAccountPanel sym={sym} qtyDecs={qtyDecs} priceDecs={priceDecs} mid={mid} />
        </div>
        <div className="space-y-4">
          <DepthLadder depth={depth} status={bookStatus} priceDecs={priceDecs} />
          <TradeTapePanel sym={sym} priceDecs={priceDecs} />
          <LiquidationFeed sym={sym} priceDecs={priceDecs} />
        </div>
      </div>

      <div className="rounded-lg border border-neutral-800 bg-[#0e1216] p-3 text-[11px] leading-relaxed text-neutral-500">
        <span className="font-semibold text-neutral-400">Tier-2 Binance-native instrument:</span> every field above is a
        live Binance USDT-M futures stream or endpoint — book L2 (@depth20@100ms), tape (@trade), candles (@kline),
        funding/mark (premiumIndex), OI. Coinglass order-flow tools (footprint · CVD · liq-level aggregates · book walls)
        stay on the 15 Tier-1 registry assets; execution is TESTNET-only by server gate.
      </div>
    </div>
  );
}
