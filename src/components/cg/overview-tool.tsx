"use client";

import { useMemo } from "react";
import { usePolling, useTicker } from "./use-cg-data";
import { symDecs } from "@/lib/cg/assets";
import { classicOf } from "@/lib/cg/classic";
import MicrostructurePanel from "./microstructure-panel";
import NarrativeCard from "./narrative-card";
import DerivativesPanel from "./derivatives-panel";

/**
 * Overview — the institutional snapshot: live price, positioning (Funding/OI),
 * auction VAL/POC/VAH (session 8h · UTC day · UTC month), Fib-prime EMA
 * 13/89/233, RSI(14) multi-timeframe, day-anchored VWAP ±1σ/2σ/3σ, live
 * footprint signals, plus L2/COT/CNBC cards whenever mapped.
 */

interface Profile {
  poc: number | null;
  vah: number | null;
  val: number | null;
  high: number | null;
  low: number | null;
}

interface MarketResp {
  ok: boolean;
  sym: string;
  name: string;
  kind: string;
  source?: string;
  priceDecs?: number;
  price: { last: number | null; prevDayClose: number | null; chgDayPct: number | null; dayHigh: number | null; dayLow: number | null; dayVolBase: number | null };
  auction: { session: Profile; day: Profile; month: Profile };
  ema: Record<string, { e13: number | null; e89: number | null; e233: number | null }>;
  rsi: Record<string, number | null>;
  vwap: { vwap: number | null; bands: { sd1: number; sd2: number; sd3: number }; open: number | null; high: number | null; low: number | null; bars: number };
  anchorInfo: { dayStart: number; monthStart: number };
  updatedAt: number;
}

interface SignalsResp {
  ok: boolean;
  supported?: boolean;
  reason?: string;
  sym?: string;
  counts: { all: number; bullish: number; bearish: number };
  sets: { bt: string; label: string; sigs: { t: string; side: string; p: number; ts: number; name?: string; main?: string }[] }[];
  updatedAt: number;
}

interface FundingResp {
  ok: boolean;
  supported?: boolean;
  source?: string;
  sym: string;
  venues: { name: string; rate8h: number; fundingIntervalHours: number }[];
  aggregate: { fundingPct8h: number | null };
}

interface OiResp {
  ok: boolean;
  supported?: boolean;
  source?: string;
  sym: string;
  venues: { name: string; oiUsd: number; sharePct: number }[];
  aggregate: { oiUsd: number | null; oiDelta1hPct: number | null; oiDelta4hPct: number | null; oiDelta24hPct: number | null };
}

function fmtCompactUsd(v: number | null | undefined): string {
  if (null == v || !Number.isFinite(v)) return "–";
  const a = Math.abs(v);
  if (a >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (a >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  if (a >= 1e3) return `$${(v / 1e3).toFixed(1)}K`;
  return `$${v.toFixed(0)}`;
}

function fmt(v: number | null | undefined, decs: number, sign = false): string {
  if (null == v || !Number.isFinite(v)) return "–";
  const s = Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: decs, maximumFractionDigits: decs });
  return (sign && v > 0 ? "+" : v < 0 ? "-" : "") + s;
}

function pct(v: number | null | undefined): string {
  if (null == v || !Number.isFinite(v)) return "–";
  return `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;
}

const TF_ROW = ["m15", "h1", "h4", "d1"] as const;
const TF_LABEL: Record<string, string> = { m15: "15m", h1: "1H", h4: "4H", d1: "1D" };

export default function OverviewTool({ sym = "BTC" }: { sym?: string }) {
  const q = usePolling<MarketResp>(`/api/cg/market?sym=${sym}`, 12_000);
  const sigQ = usePolling<SignalsResp>(`/api/cg/signals?sym=${sym}`, 20_000);
  const fundQ = usePolling<FundingResp>(`/api/cg/funding?sym=${sym}`, 30_000);
  const oiQ = usePolling<OiResp>(`/api/cg/oi?sym=${sym}`, 30_000);
  const tk = useTicker(sym);
  const classic = classicOf(sym);

  const d = q.data && q.data.sym === sym ? q.data : null;
  const sigData = sigQ.data && (sigQ.data.sym ?? sym) === sym ? sigQ.data : null;
  const fund = fundQ.data && fundQ.data.sym === sym ? fundQ.data : null;
  const oi = oiQ.data && oiQ.data.sym === sym ? oiQ.data : null;

  const price = tk.price ?? d?.price.last ?? null;
  const decs = symDecs(sym, price);

  const recentSigs = useMemo(() => {
    if (!sigData?.sets) return [];
    return sigData.sets
      .flatMap((s) => s.sigs.map((g) => ({ ...g, btLabel: s.label })))
      .sort((a, b) => b.ts - a.ts)
      .slice(0, 8);
  }, [sigData]);

  const sigCountByBt = useMemo(() => {
    const m: Record<string, { bull: number; bear: number }> = {};
    for (const s of sigData?.sets ?? []) {
      const e = (m[s.bt] ??= { bull: 0, bear: 0 });
      for (const g of s.sigs) {
        if (g.side === "buy") e.bull++;
        else e.bear++;
      }
    }
    return m;
  }, [sigData]);

  // day change % computed from the 1s live price (prev-day close from the 30s
  // snapshot — only when the snapshot belongs to the CURRENT symbol, else the
  // new price against the old symbol's close would flash ±99%)
  const chgLive =
    d && price != null && d.price.prevDayClose
      ? ((price - d.price.prevDayClose) / d.price.prevDayClose) * 100
      : (d?.price.chgDayPct ?? null);
  const fund8h = fund?.aggregate?.fundingPct8h ?? null;
  const fundApr = fund8h != null ? fund8h * 3 * 365 : null;
  const oiUsd = oi?.aggregate?.oiUsd ?? null;
  const perpSupported =
    (fund && fund.supported !== false) || (oi && oi.supported !== false);
  const vwap = d?.vwap;
  const vwapBands = useMemo(() => {
    if (!vwap || vwap.vwap == null) return [];
    return [
      { label: "+3σ", v: vwap.vwap + vwap.bands.sd3 },
      { label: "+2σ", v: vwap.vwap + vwap.bands.sd2 },
      { label: "+1σ", v: vwap.vwap + vwap.bands.sd1 },
      { label: "VWAP", v: vwap.vwap },
      { label: "−1σ", v: vwap.vwap - vwap.bands.sd1 },
      { label: "−2σ", v: vwap.vwap - vwap.bands.sd2 },
      { label: "−3σ", v: vwap.vwap - vwap.bands.sd3 },
    ];
  }, [vwap]);

  const auctionCols: { title: string; sub: string; p: Profile | undefined }[] = [
    { title: "Session", sub: "trailing 8h", p: d?.auction.session },
    { title: "Day", sub: "UTC calendar day", p: d?.auction.day },
    { title: "Month", sub: "UTC calendar month", p: d?.auction.month },
  ];

  return (
    <div className="space-y-4">
      {/* M1/M2 trade narrative — always visible at the top (Phase 4 directive) */}
      <NarrativeCard sym={sym} />

      {/* price header */}
      <div className="flex flex-wrap items-end gap-x-8 gap-y-3 rounded-lg border border-neutral-800 bg-[#11151a] p-4">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-neutral-500">
            {classic
              ? `${classic.name} · ${classic.broker ?? "Watchlist"}${d?.source ? ` · ${d.source}` : ""}`
              : `${d?.name ?? sym} · ${sym}/USDT perp · ${d?.source === "hl-xyz" ? "Hyperliquid xyz" : d?.source === "binance-fapi" ? "Binance Futures" : d?.source === "yahoo" ? "Yahoo Finance" : "Binance lead"}`}
          </div>
          <div className="flex items-baseline gap-3">
            <div
              className={`text-3xl font-semibold tabular-nums transition-colors duration-300 ${
                price == null ? "text-neutral-500" : tk.dir === "up" ? "text-emerald-300" : tk.dir === "down" ? "text-red-300" : "text-neutral-100"
              }`}
            >
              {fmt(price, decs)}
            </div>
            <div className={`text-sm font-medium tabular-nums ${(chgLive ?? 0) >= 0 ? "text-emerald-400" : "text-red-400"}`}>
              {pct(chgLive)} <span className="text-neutral-500">1D</span>
            </div>
            <span
              className="flex items-center gap-1 rounded border border-neutral-800 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider"
              title="Binance futures WebSocket (real-time) → 0.25s server REST → 3s Coinglass ladder — the badge names the active tier"
            >
              <span className={`h-1.5 w-1.5 rounded-full ${tk.live ? "animate-pulse bg-emerald-400" : "bg-amber-400"}`} />
              <span className={tk.live ? "text-emerald-400" : "text-amber-400"}>
                {tk.live ? (tk.source === "ws" ? "real-time · ws" : tk.source === "hl-ws" ? "real-time · hl" : tk.source === "rest" ? "live · 0.25s" : "live · 3s") : "reconnecting"}
              </span>
            </span>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs sm:grid-cols-4">
          <Stat label="Day high" value={fmt(d?.price.dayHigh, decs)} />
          <Stat label="Day low" value={fmt(d?.price.dayLow, decs)} />
          <Stat label="Prev day close" value={fmt(d?.price.prevDayClose, decs)} />
          <Stat label="Day open (VWAP anchor)" value={fmt(vwap?.open, decs)} />
        </div>
        {(q.error || sigQ.error) && (
          <div className="text-xs text-amber-500">{q.error ? `market: ${q.error}` : `signals: ${sigQ.error}`}</div>
        )}
      </div>

      {/* Perp positioning: 8h Funding + Open Interest + active venues */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-neutral-800 bg-[#11151a] px-4 py-2.5 text-xs">
        {perpSupported ? (
          <>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-neutral-500">Funding · 8h</div>
                <div className="flex items-baseline gap-1.5 tabular-nums">
                  <span className={fund8h == null ? "text-neutral-500" : fund8h >= 0 ? "font-semibold text-emerald-400" : "font-semibold text-red-400"}>
                    {fund8h != null ? `${fund8h >= 0 ? "+" : ""}${fund8h.toFixed(4)}%` : "–"}
                  </span>
                  {fundApr != null && (
                    <span className="text-[10px] text-neutral-500">({fundApr >= 0 ? "+" : ""}{fundApr.toFixed(1)}% APR)</span>
                  )}
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-neutral-500">Open Interest</div>
                <div className="flex items-baseline gap-2 tabular-nums">
                  <span className="font-semibold text-neutral-100">{fmtCompactUsd(oiUsd)}</span>
                  {oi?.aggregate?.oiDelta1hPct != null && (
                    <span className={`text-[10px] ${oi.aggregate.oiDelta1hPct >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                      1h {pct(oi.aggregate.oiDelta1hPct)}
                    </span>
                  )}
                  {oi?.aggregate?.oiDelta24hPct != null && (
                    <span className={`text-[10px] ${oi.aggregate.oiDelta24hPct >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                      24h {pct(oi.aggregate.oiDelta24hPct)}
                    </span>
                  )}
                </div>
              </div>
              {(oi?.venues?.length || fund?.venues?.length) ? (
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-neutral-500">Venues</div>
                  <div className="text-neutral-300">
                    {oi?.venues?.length
                      ? oi.venues.slice(0, 4).map((v) => `${v.name} ${v.sharePct.toFixed(0)}%`).join(" · ")
                      : fund?.venues?.slice(0, 4).map((v) => v.name).join(" · ")}
                  </div>
                </div>
              ) : null}
            </div>
            <span className="rounded border border-neutral-800 bg-[#0e1216] px-2 py-0.5 text-[10px] uppercase tracking-wider text-neutral-500">
              {oi?.source ?? fund?.source ?? "aggregate"}
            </span>
          </>
        ) : (
          <div className="flex w-full items-center justify-between text-[11px] text-neutral-500">
            <span>Perp Positioning · Cash / spot benchmark — no crypto perpetual funding or OI</span>
            <span className="rounded border border-neutral-800 bg-[#0e1216] px-2 py-0.5 text-[10px] uppercase tracking-wider text-neutral-500">
              {classic?.broker ?? d?.source ?? "benchmark"}
            </span>
          </div>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* auction levels */}
        <Card title="Auction · VAL / POC / VAH" note="volume-profile value areas (70%)">
          <div className="grid grid-cols-3 gap-3">
            {auctionCols.map((c) => (
              <div key={c.title} className="rounded-md border border-neutral-800 bg-[#0e1216] p-2.5">
                <div className="mb-1.5 flex items-baseline justify-between">
                  <span className="text-xs font-semibold text-neutral-200">{c.title}</span>
                  <span className="text-[9px] text-neutral-500">{c.sub}</span>
                </div>
                <AuctionRow label="VAH" v={c.p?.vah} decs={decs} price={price} kind="vah" />
                <AuctionRow label="POC" v={c.p?.poc} decs={decs} price={price} kind="poc" />
                <AuctionRow label="VAL" v={c.p?.val} decs={decs} price={price} kind="val" />
                <div className="mt-1.5 flex justify-between border-t border-neutral-800 pt-1.5 text-[10px] text-neutral-500">
                  <span>H {fmt(c.p?.high, decs)}</span>
                  <span>L {fmt(c.p?.low, decs)}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-2 text-[10px] leading-relaxed text-neutral-500">
            Session = trailing 8h · Day = current UTC day · Month = current UTC month. Profiles built from live m15/h1
            klines; price markers show the current price inside each value area.
          </div>
        </Card>

        {/* day VWAP bands */}
        <Card title="Day VWAP ±1σ / 2σ / 3σ" note="anchored at UTC 00:00 — timezone independent">
          <div className="grid gap-4 sm:grid-cols-[1.1fr_0.9fr]">
            <div className="space-y-1">
              {vwapBands.map((b) => {
                const dist = price != null && Number.isFinite(b.v) ? ((price - b.v) / b.v) * 100 : null;
                const isActive = price != null && Math.abs((price - b.v)) < (vwap?.bands.sd1 ?? 0) * 0.6;
                return (
                  <div
                    key={b.label}
                    className={`flex items-center justify-between rounded px-2 py-1 text-xs tabular-nums ${
                      isActive ? "bg-emerald-500/10 text-emerald-300" : b.label === "VWAP" ? "bg-neutral-800/60 text-neutral-200" : "text-neutral-400"
                    }`}
                  >
                    <span className={`w-10 font-semibold ${b.label.includes("−") ? "text-red-300/80" : b.label.includes("+") ? "text-emerald-300/80" : ""}`}>{b.label}</span>
                    <span>{fmt(b.v, decs)}</span>
                    <span className="w-14 text-right text-[10px] text-neutral-500">{dist == null ? "" : `${dist >= 0 ? "+" : ""}${dist.toFixed(2)}%`}</span>
                  </div>
                );
              })}
            </div>
            <div className="space-y-1.5 text-xs">
              <Row label="VWAP" value={fmt(vwap?.vwap, decs)} />
              <Row label="σ (1 band)" value={fmt(vwap?.bands.sd1, decs)} />
              <Row label="Day open" value={fmt(vwap?.open, decs)} />
              <Row label="Bars in day" value={String(vwap?.bars ?? "–")} />
              <div className="mt-2 rounded border border-neutral-800 bg-[#0e1216] p-2 text-[10px] leading-relaxed text-neutral-500">
                VWAP resets at the UTC day open — the exchange/TradingView convention — so every viewer sees the same
                bands whether in IST, UTC or any other timezone.
              </div>
            </div>
          </div>
        </Card>

        {/* EMA + RSI */}
        <Card title="EMA (Fib prime 13 / 89 / 233) + RSI(14)" note="multi-timeframe trend state">
          <table className="w-full text-xs tabular-nums">
            <thead>
              <tr className="text-[10px] uppercase tracking-wider text-neutral-500">
                <th className="py-1 text-left font-medium">TF</th>
                <th className="py-1 text-right font-medium">EMA13</th>
                <th className="py-1 text-right font-medium">EMA89</th>
                <th className="py-1 text-right font-medium">EMA233</th>
                <th className="py-1 text-right font-medium">13×89</th>
                <th className="py-1 pl-3 text-right font-medium">RSI</th>
              </tr>
            </thead>
            <tbody>
              {TF_ROW.map((tf) => {
                const e = d?.ema[tf];
                const r = d?.rsi[tf];
                const cross = e?.e13 != null && e?.e89 != null ? (e.e13 > e.e89 ? "bull" : "bear") : "–";
                const rsiCls = r == null ? "text-neutral-500" : r >= 70 ? "text-red-400" : r <= 30 ? "text-emerald-400" : "text-neutral-300";
                return (
                  <tr key={tf} className="border-t border-neutral-800/60">
                    <td className="py-1.5 font-semibold text-neutral-300">{TF_LABEL[tf]}</td>
                    <td className="py-1.5 text-right text-neutral-300">{fmt(e?.e13, decs)}</td>
                    <td className="py-1.5 text-right text-neutral-300">{fmt(e?.e89, decs)}</td>
                    <td className="py-1.5 text-right text-neutral-500">{fmt(e?.e233, decs)}</td>
                    <td className={`py-1.5 text-right font-semibold ${cross === "bull" ? "text-emerald-400" : cross === "bear" ? "text-red-400" : "text-neutral-500"}`}>
                      {cross === "bull" ? "▲ bull" : cross === "bear" ? "▼ bear" : "–"}
                    </td>
                    <td className={`py-1.5 pl-3 text-right font-semibold ${rsiCls}`}>{r == null ? "–" : r.toFixed(1)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="mt-2 text-[10px] text-neutral-500">
            RSI ≥ 70 overbought (red) · ≤ 30 oversold (green). EMA seeded SMA-style, values from live klines.
          </div>
        </Card>

        {/* signal summary */}
        <Card
          title={sigData?.supported === false ? "Structural tape summary" : "Footprint signal summary"}
          note={sigData?.supported === false ? `${d?.source ?? "market"} · derived structure` : "exact Coinglass engine · 3 bar types"}
        >
          {sigData?.supported === false ? (
            <div className="space-y-2 text-xs">
              <div className="rounded border border-neutral-800 bg-[#0e1216] px-3 py-2 text-[11px] text-neutral-400">
                Order-flow footprint buckets are unavailable on {d?.source ?? "this venue"} for {sym}. Structural bias below is computed from live OHLCV, EMAs, VWAP, and Value Area.
              </div>
              <div className="space-y-1.5">
                {TF_ROW.map((tf) => {
                  const eRow = d?.ema?.[tf];
                  const rsiVal = d?.rsi?.[tf] ?? null;
                  if (!eRow && rsiVal == null) return null;
                  const bull = eRow?.e13 != null && eRow?.e89 != null && eRow.e13 > eRow.e89;
                  const bear = eRow?.e13 != null && eRow?.e89 != null && eRow.e13 < eRow.e89;
                  return (
                    <div key={tf} className="flex items-center justify-between rounded border border-neutral-800/60 bg-[#0e1216] px-2.5 py-1.5 tabular-nums">
                      <span className="font-medium text-neutral-300">{TF_LABEL[tf]}</span>
                      <span className={bull ? "text-emerald-400" : bear ? "text-red-400" : "text-neutral-500"}>
                        {bull ? "EMA13 > EMA89 (Bull)" : bear ? "EMA13 < EMA89 (Bear)" : "Neutral EMAs"}
                      </span>
                      <span className={rsiVal == null ? "text-neutral-500" : rsiVal >= 70 ? "text-red-400" : rsiVal <= 30 ? "text-emerald-400" : "text-neutral-300"}>
                        RSI {rsiVal != null ? rsiVal.toFixed(1) : "–"}
                      </span>
                    </div>
                  );
                })}
                {vwap?.vwap != null && price != null && (
                  <div className="flex items-center justify-between rounded border border-neutral-800/60 bg-[#0e1216] px-2.5 py-1.5 tabular-nums">
                    <span className="font-medium text-neutral-300">Day VWAP</span>
                    <span className={price >= vwap.vwap ? "text-emerald-400" : "text-red-400"}>
                      {price >= vwap.vwap ? "Above VWAP (Premium)" : "Below VWAP (Discount)"}
                    </span>
                    <span className="text-neutral-400">{fmt(vwap.vwap, decs)}</span>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <>
              <div className="mb-3 grid grid-cols-3 gap-3">
                <CountBox label="All" bull={sigData?.counts.bullish ?? 0} bear={sigData?.counts.bearish ?? 0} />
                {["time", "vol", "range"].map((bt) => (
                  <CountBox
                    key={bt}
                    label={bt === "time" ? "15m" : bt === "vol" ? "Volume" : "Range"}
                    bull={sigCountByBt[bt]?.bull ?? 0}
                    bear={sigCountByBt[bt]?.bear ?? 0}
                  />
                ))}
              </div>
              <div className="max-h-56 space-y-1 overflow-y-auto">
                {recentSigs.map((s, i) => (
                  <div key={i} className="flex items-center gap-2 rounded border border-neutral-800/60 bg-[#0e1216] px-2 py-1.5 text-xs">
                    <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${s.side === "buy" ? "bg-emerald-400" : "bg-red-400"}`} />
                    <span className="w-28 shrink-0 truncate font-medium text-neutral-200">{s.name ?? s.t}</span>
                    <span className="shrink-0 text-[10px] text-neutral-500">{s.btLabel}</span>
                    <span className="ml-auto shrink-0 tabular-nums text-neutral-400">{fmt(s.p, decs)}</span>
                    <span className="shrink-0 tabular-nums text-[10px] text-neutral-600">
                      {new Date(s.ts * 1000).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                ))}
                {!recentSigs.length && <div className="py-6 text-center text-xs text-neutral-600">no signals in window</div>}
              </div>
            </>
          )}
        </Card>
      </div>

      {/* L2/L3 microstructure (R4): mounts for metals (XAU/XAG/XPT) and HL xyz symbols */}
      <MicrostructurePanel sym={sym} />

      {/* TradFi / Commodity / Index macro, CFTC COT & options positioning */}
      {classic && <DerivativesPanel sym={sym} cashPrice={price} />}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-neutral-500">{label}</div>
      <div className="tabular-nums text-neutral-200">{value}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-neutral-500">{label}</span>
      <span className="tabular-nums text-neutral-200">{value}</span>
    </div>
  );
}

function AuctionRow({ label, v, decs, price, kind }: { label: string; v: number | null | undefined; decs: number; price: number | null; kind: "vah" | "poc" | "val" }) {
  const near = price != null && v != null && Math.abs(price - v) / v < 0.0015;
  return (
    <div className={`flex items-center justify-between rounded px-1.5 py-0.5 text-xs tabular-nums ${near ? "bg-amber-500/10" : ""}`}>
      <span className={`text-[10px] font-semibold ${kind === "poc" ? "text-sky-400" : "text-neutral-500"}`}>{label}</span>
      <span className={kind === "poc" ? "font-semibold text-sky-300" : "text-neutral-300"}>{fmt(v, decs)}</span>
    </div>
  );
}

function Card({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-neutral-800 bg-[#11151a] p-4">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold text-neutral-100">{title}</h3>
        {note && <span className="text-[10px] text-neutral-500">{note}</span>}
      </div>
      {children}
    </section>
  );
}

function CountBox({ label, bull, bear }: { label: string; bull: number; bear: number }) {
  return (
    <div className="rounded-md border border-neutral-800 bg-[#0e1216] p-2 text-center">
      <div className="text-[10px] uppercase tracking-wider text-neutral-500">{label}</div>
      <div className="mt-0.5 flex items-baseline justify-center gap-2 tabular-nums">
        <span className="text-sm font-semibold text-emerald-400">{bull}</span>
        <span className="text-[10px] text-neutral-600">/</span>
        <span className="text-sm font-semibold text-red-400">{bear}</span>
      </div>
    </div>
  );
}
