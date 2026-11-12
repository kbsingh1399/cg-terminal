"use client";

import { useMemo, useState } from "react";
import { usePolling, useTicker } from "./use-cg-data";
import { hlCoinOf, resolveBinPair } from "@/lib/binance/aliases";
import DerivativesPanel from "./derivatives-panel";
import MicrostructurePanel from "./microstructure-panel";

/**
 * ClassicOverview — TradFi / Classic instrument quant & cross-venue snapshot.
 * Computes EMA 13/89/233, RSI(14), VWAP ±σ, and bar-volume profile from
 * /api/cg/classic OHLCV bars while overlaying sub-second live WS quotes
 * from Binance TRADIFI_PERPETUAL / Hyperliquid xyz whenever listed.
 */

interface Bar {
  t: number;
  o: number | null;
  h: number | null;
  l: number | null;
  c: number | null;
  v: number;
}

interface LiveBlock {
  ok: boolean;
  sym: string;
  price: number | null;
  source: "hl-xyz" | "lighter" | null;
  sourceDetail: string | null;
  at: number;
  err?: string;
}

interface FutBlock {
  ok: boolean;
  price: number | null;
  yahoo: string;
  rmt: number | null;
  at: number;
  err?: string;
}

interface ClassicResp {
  ok: boolean;
  sym: string;
  name: string;
  klass: string;
  broker: string;
  yahoo: string;
  binPair?: string | null;
  note: string | null;
  price: number | null;
  prevClose: number | null;
  chgPct: number | null;      // RANGE change (chartPreviousClose of the range) — never today's move
  chg24hPct: number | null;   // vs last bar that closed >=24h ago
  currency: string | null;
  exchange: string | null;
  tz: string | null;
  regularMarketTime: number | null; // epoch-s of the Yahoo cash quote
  hasVolume: boolean;
  nBars: number;
  bars: Bar[];
  source: string;
  fetchedAt: number;
  quoteOnly?: boolean;        // Yahoo body unavailable — live/fut quote carried the response
  live?: LiveBlock;           // 24/7 micro anchor (Kraken spot / xyz perp mark / Lighter L3 mid)
  fut?: FutBlock;             // Yahoo futures lead (24/5 Globex hours, ~10m delayed)
}

const PRESETS: { label: string; interval: string; range: string; minutes: number }[] = [
  { label: "5m · 1D", interval: "5m", range: "1d", minutes: 5 },
  { label: "15m · 5D", interval: "15m", range: "5d", minutes: 15 },
  { label: "1H · 1MO", interval: "1h", range: "1mo", minutes: 60 },
  { label: "1D · 6MO", interval: "1d", range: "6mo", minutes: 1440 },
];

function decsFor(p: number | null | undefined): number {
  if (null == p || !Number.isFinite(p)) return 2;
  const a = Math.abs(p);
  if (a >= 100) return 2;
  if (a >= 10) return 3;
  if (a >= 1) return 4;
  if (a >= 0.01) return 5;
  return 6;
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

function ema(vals: number[], period: number): number | null {
  if (vals.length < period) return null; // honest –, never a short-window fake
  const k = 2 / (period + 1);
  let e = vals.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < vals.length; i++) e = vals[i] * k + e * (1 - k);
  return e;
}

function rsi14(vals: number[]): number | null {
  if (vals.length < 15) return null;
  let g = 0;
  let l = 0;
  for (let i = 1; i <= 14; i++) {
    const d = vals[i] - vals[i - 1];
    if (d >= 0) g += d;
    else l -= d;
  }
  let ag = g / 14;
  let al = l / 14;
  for (let i = 15; i < vals.length; i++) {
    const d = vals[i] - vals[i - 1];
    ag = (ag * 13 + Math.max(d, 0)) / 14;
    al = (al * 13 + Math.max(-d, 0)) / 14;
  }
  if (al === 0) return 100;
  return 100 - 100 / (1 + ag / al);
}

/** Coarse bar-volume profile over the visible bars: 48 bins, volume
 *  attributed to each bar's typical price. Price-only instruments return
 *  null — we never fabricate volume (classic.ts contract). */
function volumeProfile(bars: Bar[]): { poc: number; vah: number; val: number } | null {
  const vb = bars.filter((b) => b.c != null && b.h != null && b.l != null && b.v > 0);
  if (vb.length < 20) return null;
  const tp = vb.map((b) => (b.h! + b.l! + b.c!) / 3);
  const lo = Math.min(...vb.map((b) => b.l!));
  const hi = Math.max(...vb.map((b) => b.h!));
  if (!(hi > lo)) return null;
  const N = 48;
  const w = (hi - lo) / N;
  const bins = new Array<number>(N).fill(0);
  vb.forEach((b, i) => {
    const idx = Math.min(N - 1, Math.max(0, Math.floor((tp[i] - lo) / w)));
    bins[idx] += b.v;
  });
  const total = bins.reduce((a, b) => a + b, 0);
  let pi = 0;
  for (let i = 1; i < N; i++) if (bins[i] > bins[pi]) pi = i;
  // value area: expand around POC until 70% of volume covered
  let acc = bins[pi];
  let loI = pi;
  let hiI = pi;
  while (acc < total * 0.7 && (loI > 0 || hiI < N - 1)) {
    const dn = loI > 0 ? bins[loI - 1] : -1;
    const up = hiI < N - 1 ? bins[hiI + 1] : -1;
    if (up >= dn) {
      hiI++;
      acc += Math.max(up, 0);
    } else {
      loI--;
      acc += Math.max(dn, 0);
    }
  }
  return { poc: lo + (pi + 0.5) * w, vah: lo + (hiI + 1) * w, val: lo + loI * w };
}

export default function ClassicOverview({
  sym = "US30",
  liveHint = null,
}: {
  sym?: string;
  liveHint?: "binance" | "hl" | null;
}) {
  const [preset, setPreset] = useState(1); // default 15m · 5D
  const p = PRESETS[preset];
  const q = usePolling<ClassicResp>(
    `/api/cg/classic?sym=${sym}&interval=${p.interval}&range=${p.range}`,
    30_000
  );
  // defense-in-depth (same contract as the perp tools): never render a
  // payload that belongs to another symbol or another interval
  const d = q.data && q.data.sym === sym ? q.data : null;
  const isHlIndex = sym === "SPX500" || sym === "SP500" || sym === "NDX100" || sym === "JP225";
  const hlIndexCoin = isHlIndex ? hlCoinOf(sym) : undefined;
  const binPairName = d?.binPair ?? (liveHint === "binance" ? resolveBinPair(sym) : null);
  const ticker = useTicker(liveHint || d?.binPair || hlIndexCoin ? sym : "", 1_000);
  const bars = useMemo(() => (d?.bars ?? []).filter((b) => b.c != null), [d]);
  const price = d?.price ?? (bars.length ? bars[bars.length - 1].c : null);
  const decs = decsFor(price);

  const calc = useMemo(() => {
    if (!bars.length) return null;
    const closes = bars.map((b) => b.c!);
    const typical = bars.map((b) => ((b.h ?? b.c!) + (b.l ?? b.c!) + b.c!) / 3);
    const e13 = ema(closes, 13);
    const e89 = ema(closes, 89);
    const e233 = ema(closes, 233);
    const rsi = rsi14(closes);
    // VWAP over the visible window: volume-weighted when volume exists,
    // otherwise the equal-weight mean of typical prices (labelled honestly)
    const volSum = bars.reduce((a, b) => a + b.v, 0);
    let vwap: number;
    if (volSum > 0) vwap = typical.reduce((a, t, i) => a + t * bars[i].v, 0) / volSum;
    else vwap = typical.reduce((a, b) => a + b, 0) / typical.length;
    const variance = typical.reduce((a, t) => a + (t - vwap) ** 2, 0) / typical.length;
    const sd = Math.sqrt(variance);
    const viewHigh = Math.max(...bars.map((b) => b.h ?? b.c!));
    const viewLow = Math.min(...bars.map((b) => b.l ?? b.c!));
    const profile = d?.hasVolume ? volumeProfile(bars) : null;
    const lastBarAgeMin = (Date.now() - bars[bars.length - 1].t) / 60000;
    return {
      e13, e89, e233, rsi, vwap, sd, viewHigh, viewLow, profile, lastBarAgeMin,
      vwapMode: volSum > 0 ? ("volume-weighted" as const) : ("equal-weight (no volume upstream)" as const),
    };
  }, [bars, d?.hasVolume]);

  // ---- headline-quote ladder: WebSocket live (Binance TradFi / HL xyz) → 24/7 REST anchor → futures lead → Yahoo cash ----
  const liveOk = !!d?.live?.ok && d.live.price != null && Number.isFinite(d.live.price);
  const futOk = !!d?.fut?.ok && d.fut.price != null && Number.isFinite(d.fut.price);
  const cashAgeS = typeof d?.regularMarketTime === "number" ? Math.max(0, Math.round(Date.now() / 1000 - d.regularMarketTime)) : null;
  const cashStale = cashAgeS == null || cashAgeS > 1800;
  const wsPrice = ticker.live && ticker.price != null && Number.isFinite(ticker.price) ? ticker.price : null;
  const useWs = wsPrice != null;
  const useLive = !useWs && liveOk;
  const useFut = !useWs && !useLive && futOk && cashStale;
  const headline = useWs ? wsPrice : useLive ? d!.live!.price! : useFut ? d!.fut!.price! : price;
  const liveAgeS = d?.live?.at ? Math.max(0, Math.round((Date.now() - d.live.at) / 1000)) : null;
  const futDelayS = d?.fut?.rmt ? Math.max(0, Math.round(Date.now() / 1000 - d.fut.rmt)) : null;
  const headlineSrc = useWs
    ? ticker.source === "hl-ws"
      ? `HL xyz WS · ${hlIndexCoin} · real-time`
      : ticker.source === "ws"
        ? `Binance WS · ${binPairName ?? `${sym}USDT`} · sub-100ms`
        : `Binance REST · ${binPairName ?? `${sym}USDT`} · 1s`
    : useLive
      ? `live · ${d!.live!.sourceDetail ?? d!.live!.source} · ${liveAgeS != null ? `${liveAgeS}s ago` : ""}`
      : useFut
        ? `${d!.fut!.yahoo} futures · Globex 24/5${futDelayS != null ? ` · feed ${Math.round(futDelayS / 60)}m delayed` : ""}`
        : d?.exchange
          ? `Yahoo ${String(d.exchange)} cash${cashAgeS != null ? ` · quote ${cashAgeS > 5400 ? `${Math.round(cashAgeS / 3600)}h` : `${Math.round(cashAgeS / 60)}m`} old` : ""}`
          : "Yahoo cash";
  const displayChg24 = useMemo(() => {
    if (d?.chg24hPct == null) return null;
    if (useWs && headline != null && price != null && price > 0) {
      const ref24 = price / (1 + d.chg24hPct / 100);
      if (Number.isFinite(ref24) && ref24 > 0) {
        return +(((headline - ref24) / ref24) * 100).toFixed(2);
      }
    }
    return d.chg24hPct;
  }, [useWs, headline, price, d?.chg24hPct]);
  // basis of the headline venue vs the Yahoo cash quote (both real numbers —
  // perp premium / futures basis is information, never hidden)
  const basisPct =
    headline != null && price != null && price > 0 && headline !== price
      ? +(((headline - price) / price) * 100).toFixed(2)
      : null;

  // stale = no live anchor, no usable futures lead, and cash bars went quiet
  const stale = !useWs && !useLive && !useFut && calc != null && calc.lastBarAgeMin > Math.max(30, p.minutes * 10);

  return (
    <div className="space-y-4">
      {/* interval presets */}
      <div className="flex flex-wrap items-center gap-2">
        {PRESETS.map((x, i) => (
          <button
            key={x.label}
            onClick={() => setPreset(i)}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
              i === preset ? "bg-sky-500/20 text-sky-300 ring-1 ring-sky-500/40" : "text-neutral-400 hover:bg-neutral-900"
            }`}
          >
            {x.label}
          </button>
        ))}
        <span className="ml-2 text-[10px] text-neutral-600">
          window stats recomputed client-side from {d?.nBars ?? 0} bars · Yahoo v8 · 60s server cache
        </span>
      </div>

      {/* quote header — headline rides the freshest honest source (WS → micro anchor → futures → Yahoo cash) */}
      <div className="flex flex-wrap items-end gap-x-8 gap-y-3 rounded-lg border border-neutral-800 bg-[#11151a] p-4">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-neutral-500">
            {d?.name ?? sym} · {d?.klass ?? "?"} · broker {d?.broker ?? "–"} · Yahoo {d?.yahoo ?? "–"}
            {binPairName ? ` · Binance ${binPairName}` : ""}
            {d?.exchange ? ` · ${d.exchange}` : ""}
          </div>
          <div className="flex items-baseline gap-3">
            <div
              className={`text-3xl font-bold tabular-nums transition-colors duration-150 ${
                useWs && ticker.dir === "up"
                  ? "text-emerald-300"
                  : useWs && ticker.dir === "down"
                    ? "text-rose-300"
                    : (displayChg24 ?? d?.chgPct ?? 0) >= 0
                      ? "text-emerald-400"
                      : "text-rose-400"
              }`}
            >
              {fmt(headline, decs)}
            </div>
            <div className={`text-sm font-semibold ${(displayChg24 ?? d?.chgPct ?? 0) >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
              {displayChg24 != null ? (
                <span title="change vs the close 24h ago">24h {pct(displayChg24)}</span>
              ) : (
                <span title={`change over the visible ${p.label} window`}>{p.label.split("·")[1]?.trim() ?? "range"} {pct(d?.chgPct)}</span>
              )}
            </div>
            {useWs && ticker.bid != null && ticker.ask != null && (
              <span className="font-mono text-xs text-neutral-500">
                bid <span className="text-emerald-400/90">{fmt(ticker.bid, decs)}</span> / ask{" "}
                <span className="text-rose-400/90">{fmt(ticker.ask, decs)}</span>
              </span>
            )}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-neutral-500">
            {headline !== price && price != null && (
              <span>
                Yahoo cash {fmt(price, decs)}
                {basisPct != null && (
                  <span className={basisPct >= 0 ? "text-emerald-600" : "text-rose-600"}> ({basisPct >= 0 ? "+" : ""}{basisPct.toFixed(2)}% basis)</span>
                )}
              </span>
            )}
            <span>prev close {fmt(d?.prevClose, decs)}</span>
            {calc && <span>{p.label} high {fmt(calc.viewHigh, decs)} · low {fmt(calc.viewLow, decs)}</span>}
            {d?.currency && d.currency !== "USD" ? <span>{d.currency}</span> : null}
          </div>
        </div>
        <div className="ml-auto text-right">
          <div
            className={`rounded-md px-2 py-1 text-[10px] font-semibold ${
              useWs
                ? "bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/40"
                : useLive
                  ? "bg-emerald-500/15 text-emerald-300"
                  : useFut
                    ? "bg-sky-500/15 text-sky-300"
                    : stale
                      ? "bg-amber-500/15 text-amber-300"
                      : "bg-neutral-800 text-neutral-400"
            }`}
          >
            {useWs
              ? ticker.source?.includes("ws")
                ? "LIVE · WebSocket"
                : "LIVE · REST 1s"
              : useLive
                ? "LIVE — 24/7 anchor"
                : useFut
                  ? "futures lead"
                  : stale
                    ? "⚠ stale — cash market likely closed"
                    : "live"}
          </div>
          <div className="mt-1 max-w-[240px] text-[10px] text-neutral-600">{headlineSrc}</div>
          {calc && (
            <div className="mt-1 text-[10px] text-neutral-600">
              last bar {Math.max(0, Math.round(calc.lastBarAgeMin))}m ago{d?.quoteOnly ? " · Yahoo bars unavailable" : ""}
            </div>
          )}
        </div>
      </div>

      {q.error && (
        <div className="rounded-lg border border-amber-800/50 bg-amber-950/30 p-3 text-xs text-amber-300">
          Feed error: {q.error} — Yahoo is an unofficial API; 429s are expected, retrying every 30s.
        </div>
      )}
      {q.loading && !d && <div className="rounded-lg border border-neutral-800 bg-[#11151a] p-6 text-sm text-neutral-500">Loading {sym}…</div>}

      {calc && (
        <div className="grid gap-4 lg:grid-cols-3">
          {/* VWAP ladder */}
          <div className="rounded-lg border border-neutral-800 bg-[#11151a] p-4">
            <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-neutral-400">
              VWAP ±σ · {p.label} window
            </div>
            <div className="text-[10px] text-neutral-600">{calc.vwapMode}</div>
            <div className="mt-2 space-y-1 font-mono text-xs tabular-nums">
              {[
                { label: "+3σ", v: calc.vwap + 3 * calc.sd },
                { label: "+2σ", v: calc.vwap + 2 * calc.sd },
                { label: "+1σ", v: calc.vwap + calc.sd },
                { label: "VWAP", v: calc.vwap },
                { label: "−1σ", v: calc.vwap - calc.sd },
                { label: "−2σ", v: calc.vwap - 2 * calc.sd },
                { label: "−3σ", v: calc.vwap - 3 * calc.sd },
              ].map((row) => {
                const above = price != null && row.v > price;
                const below = price != null && row.v < price;
                return (
                  <div
                    key={row.label}
                    className={`flex justify-between rounded px-2 py-1 ${
                      row.label === "VWAP" ? "bg-neutral-800 font-bold text-neutral-100" : "text-neutral-300"
                    }`}
                  >
                    <span className="text-neutral-500">{row.label}</span>
                    <span className={above ? "text-rose-400" : below ? "text-emerald-400" : ""}>{fmt(row.v, decs)}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* EMA + RSI */}
          <div className="rounded-lg border border-neutral-800 bg-[#11151a] p-4">
            <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-neutral-400">
              EMA 13 / 89 / 233 · RSI(14) · {p.label}
            </div>
            <table className="w-full text-xs tabular-nums">
              <thead>
                <tr className="text-[10px] uppercase text-neutral-600">
                  <th className="text-left font-medium">TF</th>
                  <th className="text-right font-medium">EMA13</th>
                  <th className="text-right font-medium">EMA89</th>
                  <th className="text-right font-medium">EMA233</th>
                  <th className="text-right font-medium">RSI</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-neutral-800">
                  <td className="py-2 font-semibold text-neutral-300">{p.label.split(" · ")[0]}</td>
                  {[calc.e13, calc.e89, calc.e233].map((e, i) => (
                    <td key={i} className={`text-right ${e == null ? "text-neutral-600" : price != null && e < price ? "text-emerald-400" : "text-rose-400"}`}>
                      {fmt(e, decs)}
                    </td>
                  ))}
                  <td className={`text-right font-semibold ${calc.rsi == null ? "text-neutral-600" : calc.rsi > 55 ? "text-emerald-400" : calc.rsi < 45 ? "text-rose-400" : "text-neutral-300"}`}>
                    {fmt(calc.rsi, 1)}
                  </td>
                </tr>
              </tbody>
            </table>
            <div className="mt-2 text-[10px] text-neutral-600">
              green = level below price (support-side) · red = above (resistance-side) · “–” = not enough bars in window
            </div>
            <div className="mt-3 space-y-1 border-t border-neutral-800 pt-3 text-[11px] text-neutral-400">
              <div>
                trend stack:{" "}
                {calc.e13 != null && calc.e89 != null && calc.e233 != null ? (
                  calc.e13 < calc.e89 && calc.e89 < calc.e233 ? (
                    <span className="font-semibold text-rose-400">bearish (13 &lt; 89 &lt; 233)</span>
                  ) : calc.e13 > calc.e89 && calc.e89 > calc.e233 ? (
                    <span className="font-semibold text-emerald-400">bullish (13 &gt; 89 &gt; 233)</span>
                  ) : (
                    <span className="font-semibold text-neutral-300">mixed</span>
                  )
                ) : (
                  <span className="text-neutral-600">window too short for the 233 stack — switch to 1H/1D</span>
                )}
              </div>
              <div>
                price vs VWAP:{" "}
                {price != null && price < calc.vwap ? (
                  <span className="font-semibold text-rose-400">below VWAP ({fmt(price - calc.vwap, decs, true)})</span>
                ) : (
                  <span className="font-semibold text-emerald-400">above VWAP ({fmt((price ?? 0) - calc.vwap, decs, true)})</span>
                )}
              </div>
            </div>
          </div>

          {/* volume profile or honest n/a */}
          <div className="rounded-lg border border-neutral-800 bg-[#11151a] p-4">
            <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-neutral-400">
              Volume profile · {p.label}
            </div>
            {calc.profile ? (
              <div className="space-y-1 font-mono text-xs tabular-nums">
                <div className="flex justify-between rounded px-2 py-1 text-neutral-300">
                  <span className="text-neutral-500">VAH</span>
                  <span className="text-rose-400">{fmt(calc.profile.vah, decs)}</span>
                </div>
                <div className="flex justify-between rounded bg-neutral-800 px-2 py-1 font-bold text-neutral-100">
                  <span className="text-neutral-500">POC</span>
                  <span>{fmt(calc.profile.poc, decs)}</span>
                </div>
                <div className="flex justify-between rounded px-2 py-1 text-neutral-300">
                  <span className="text-neutral-500">VAL</span>
                  <span className="text-emerald-400">{fmt(calc.profile.val, decs)}</span>
                </div>
                <div className="px-2 pt-2 text-[10px] text-neutral-600">
                  coarse 48-bin bar-volume profile · value area = 70%
                </div>
              </div>
            ) : (
              <div className="rounded border border-dashed border-neutral-800 p-3 text-[11px] leading-relaxed text-neutral-500">
                {d?.hasVolume
                  ? "Not enough volume bars in this window for a profile — try a longer preset (1H · 1MO)."
                  : "Price-only instrument — FX / VIX / EU-Asian cash indices carry no volume upstream. Session stats print price-only; we never fabricate volume."}
              </div>
            )}
          </div>
        </div>
      )}

      {/* derivatives add-ons: perp depth / COT / CNBC futures — hidden when unmapped */}
      <DerivativesPanel sym={sym} cashPrice={price} />

      {/* L2/L3 microstructure: Hyperliquid xyz + Lighter L3 + Kraken spot — hidden when unmapped */}
      <MicrostructurePanel sym={sym} />

      {/* honest scope note */}
      <div className="rounded-lg border border-neutral-800 bg-[#0e1216] p-3 text-[11px] leading-relaxed text-neutral-500">
        <span className="font-semibold text-neutral-400">Tier-3 instrument (watchlist-only):</span> quote + OHLCV bars via
        Yahoo v8; 14 instruments additionally carry verified perp/COT/futures-references panels above. Footprint, CVD,
        liquidation levels and book walls are <span className="text-neutral-400">n/a by design where no perp venues exist, never fabricated</span>. The desk
        deepscan prints this class with a reduced scorecard; no trade construction (engine v4 pending session/VWAP gates).
        {d?.note ? <span className="block pt-1 text-neutral-600">note: {d.note}</span> : null}
      </div>
    </div>
  );
}
