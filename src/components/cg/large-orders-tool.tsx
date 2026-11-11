"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import LargeOrdersCanvas from "./charts/large-orders-canvas";
import { usePolling, rowsToCandles, type KlinePayload, type LtoPayload } from "./use-cg-data";
import type { LtoOrder } from "@/lib/cg/types";
import { fmtAge, fmtNum, fmtPct, fmtUsd } from "@/lib/cg/format";
import { leadInstr } from "@/lib/cg/assets";
import { assetOf } from "@/lib/cg/assets";
import { Button } from "@/components/ui/button";

/**
 * Whale orders — open large resting orders across ALL exchanges, mirroring the
 * Coinglass large-orderbook-statistics page: exchange filter with no-data
 * markers, net/buy/sell wall summary, and the open-orders table.
 */

type SortKey = "near-price" | "price-desc" | "price-asc" | "time-desc" | "size-desc";

const THRESHOLDS = [
  { v: 0, l: "All" },
  { v: 100_000, l: "≥$100K" },
  { v: 500_000, l: "≥$500K" },
  { v: 1_000_000, l: "≥$1M" },
  { v: 5_000_000, l: "≥$5M" },
];

export default function LargeOrdersTool({ sym = "BTC" }: { sym?: string }) {
  const [minVolUsd, setMinVolUsd] = useState(1_000_000);
  // multi-select exchange set, like the Coinglass dropdown (14/14 venues)
  const [exSelected, setExSelected] = useState<Set<string> | null>(null); // null = all
  const [marketMode, setMarketMode] = useState<"all" | "perp" | "spot">("all");
  const [sideFilter, setSideFilter] = useState<"all" | "bid" | "ask">("all");
  const [sortKey, setSortKey] = useState<SortKey>("near-price");
  const [showChart, setShowChart] = useState(false);
  const [exMenuOpen, setExMenuOpen] = useState(false);
  const [selected, setSelected] = useState<LtoOrder | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const klineQ = usePolling<KlinePayload>(`/api/cg/kline?type=kline&interval=m15&limit=300&symbol=${leadInstr(sym)}`, 30_000);
  const ltoQ = usePolling<LtoPayload>(`/api/cg/lto?symbol=${sym}&minVolUsd=${minVolUsd}`, 20_000);

  // symbol switched: drop the detail selection so a stale BTC order can
  // never render under the new symbol's unit labels — render-time adjust
  // (no one-frame flash)
  const [prevSym, setPrevSym] = useState(sym);
  if (sym !== prevSym) {
    setPrevSym(sym);
    setSelected(null);
  }

  // payload guard: the kline route now echoes the instrument key — never
  // render candles that belong to another symbol's series
  const candles = useMemo(
    () => rowsToCandles(klineQ.data && klineQ.data.symbol === leadInstr(sym) ? klineQ.data.rows : undefined),
    [klineQ.data, sym]
  );
  const lastPrice = candles.length ? candles[candles.length - 1].c : null;
  // defense-in-depth: never render orders that belong to another symbol
  const groups = ltoQ.data?.symbol === sym ? ltoQ.data.groups : [];
  const decs = assetOf(sym)?.priceDecs ?? 2;
  const fmtP = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: decs, maximumFractionDigits: decs });

  const marketOf = (t: number) => (t === 1 ? "futures" : "spot");

  // flattened orders in the current filter scope (selected exchanges + market mode)
  const scoped = useMemo(() => {
    const out: { order: LtoOrder; exName: string; market: string; instrumentId: string }[] = [];
    for (const g of groups) {
      const ex = g.instrument?.exName ?? "";
      const mkt = marketOf(g.instrument?.type ?? 10);
      if (exSelected && !exSelected.has(ex)) continue;
      if (marketMode === "perp" && mkt !== "futures") continue;
      if (marketMode === "spot" && mkt !== "spot") continue;
      for (const o of g.list) out.push({ order: o, exName: ex, market: mkt, instrumentId: g.instrument?.instrumentId ?? "" });
    }
    return out;
  }, [groups, exSelected, marketMode]);

  const summary = useMemo(() => {
    let bid = 0;
    let ask = 0;
    for (const { order: o } of scoped) {
      if (o.side === 2) bid += o.currentUsd;
      else ask += o.currentUsd;
    }
    return { bid, ask, net: bid - ask, count: scoped.length };
  }, [scoped]);

  // per-exchange chips (all venues that currently have orders)
  const exchangeChips = useMemo(() => {
    const m = new Map<string, { bid: number; ask: number; count: number; markets: Set<string> }>();
    for (const g of groups) {
      const ex = g.instrument?.exName ?? "?";
      let e = m.get(ex);
      if (!e) {
        e = { bid: 0, ask: 0, count: 0, markets: new Set() };
        m.set(ex, e);
      }
      e.markets.add(marketOf(g.instrument?.type ?? 10));
      for (const o of g.list) {
        e.count++;
        if (o.side === 2) e.bid += o.currentUsd;
        else e.ask += o.currentUsd;
      }
    }
    return [...m.entries()].sort((a, b) => b[1].bid + b[1].ask - (a[1].bid + a[1].ask));
  }, [groups]);

  const tableRows = useMemo(() => {
    let rows = scoped;
    if (sideFilter === "bid") rows = rows.filter((r) => r.order.side === 2);
    if (sideFilter === "ask") rows = rows.filter((r) => r.order.side === 1);
    const s = [...rows];
    switch (sortKey) {
      case "near-price":
        s.sort((a, b) => Math.abs(a.order.price - (lastPrice ?? 0)) - Math.abs(b.order.price - (lastPrice ?? 0)));
        break;
      case "price-desc":
        s.sort((a, b) => b.order.price - a.order.price);
        break;
      case "price-asc":
        s.sort((a, b) => a.order.price - b.order.price);
        break;
      case "time-desc":
        s.sort((a, b) => b.order.startTime - a.order.startTime);
        break;
      case "size-desc":
        s.sort((a, b) => b.order.currentUsd - a.order.currentUsd);
        break;
    }
    return s;
  }, [scoped, sideFilter, sortKey, lastPrice]);

  // exchange dropdown data: support list + live availability
  const exchangeList = useMemo(() => {
    const support = ltoQ.data?.support;
    const perEx = ltoQ.data?.perExchange ?? {};
    const rows: { exchange: string; perp: boolean; spot: boolean; openOrders: number; hasData: boolean }[] = [];
    const seen = new Set<string>();
    for (const section of ["futures", "spot"] as const) {
      for (const s of support?.[section] ?? []) {
        let r = rows.find((x) => x.exchange === s.exchange);
        if (!r) {
          r = { exchange: s.exchange, perp: false, spot: false, openOrders: 0, hasData: false };
          rows.push(r);
        }
        if (section === "futures") r.perp = true;
        else r.spot = true;
        const meta = perEx[s.exchange];
        if (meta) {
          r.openOrders = Math.max(r.openOrders, meta.openOrders);
          r.hasData = r.hasData || meta.hasData;
        }
        seen.add(s.exchange);
      }
    }
    rows.sort((a, b) => Number(b.hasData) - Number(a.hasData) || a.exchange.localeCompare(b.exchange));
    return rows;
  }, [ltoQ.data]);

  // walls for the optional chart
  const chartOrders = useMemo(
    () =>
      scoped.map(({ order: o, exName }) => ({
        id: o.id,
        exchangeName: exName,
        name: o.name,
        symbol: sym,
        price: o.price,
        side: o.side,
        baseVol: o.currentAmount,
        quoteVol: o.currentUsd,
        volUsd: o.currentUsd,
        createTime: o.startTime,
      })),
    [scoped]
  );

  const err = klineQ.error ?? ltoQ.error;

  return (
    <div className="flex flex-col gap-3">
      {/* controls */}
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-neutral-800 bg-neutral-900/60 p-2.5">
        <div className="flex items-center gap-1.5 pr-2">
          <span className="text-sm font-semibold text-neutral-100">{sym}</span>
          <span className="rounded bg-neutral-800 px-1.5 py-0.5 text-[10px] text-neutral-400">
            all exchanges · large resting orders
          </span>
        </div>
        <div className="flex overflow-hidden rounded border border-neutral-700">
          {THRESHOLDS.map((t) => (
            <button
              key={t.v}
              onClick={() => setMinVolUsd(t.v)}
              className={`px-2.5 py-1 text-xs ${minVolUsd === t.v ? "bg-neutral-700 text-white" : "text-neutral-400 hover:bg-neutral-800"}`}
            >
              {t.l}
            </button>
          ))}
        </div>

        {/* exchange dropdown — multi-select, like the Coinglass page */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setExMenuOpen((v) => !v)}
            className="flex items-center gap-1.5 rounded border border-neutral-700 bg-neutral-800 px-2.5 py-1 text-xs text-neutral-200 hover:bg-neutral-700"
          >
            <span className="text-neutral-500">Exchanges</span>
            <span className="text-emerald-500">+{Math.max(0, (exSelected?.size ?? exchangeList.length) - 3)}</span>
            <span className="text-neutral-400">
              ({exSelected?.size ?? exchangeList.length}/{exchangeList.length})
            </span>
            <span className="text-neutral-500">▾</span>
          </button>
          {exMenuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setExMenuOpen(false)} />
              <div className="absolute left-0 top-full z-20 mt-1 max-h-96 w-80 overflow-y-auto rounded-lg border border-neutral-700 bg-neutral-900 p-1.5 shadow-xl">
                {/* quick chips: All · Perp only · Spot only · Invert */}
                <div className="mb-1.5 flex flex-wrap items-center gap-1 border-b border-neutral-800 px-1 pb-2 pt-1">
                  <button
                    onClick={() => setExSelected(null)}
                    className={`rounded-full px-2 py-0.5 text-[10px] ${
                      !exSelected ? "bg-neutral-600 text-white" : "bg-neutral-800 text-neutral-400 hover:bg-neutral-700/60"
                    }`}
                  >
                    All
                  </button>
                  <button
                    onClick={() => setMarketMode((m) => (m === "perp" ? "all" : "perp"))}
                    className={`rounded-full px-2 py-0.5 text-[10px] ${
                      marketMode === "perp" ? "bg-emerald-700 text-white" : "bg-neutral-800 text-neutral-400 hover:bg-neutral-700/60"
                    }`}
                  >
                    Perp only
                  </button>
                  <button
                    onClick={() => setMarketMode((m) => (m === "spot" ? "all" : "spot"))}
                    className={`rounded-full px-2 py-0.5 text-[10px] ${
                      marketMode === "spot" ? "bg-sky-700 text-white" : "bg-neutral-800 text-neutral-400 hover:bg-neutral-700/60"
                    }`}
                  >
                    Spot only
                  </button>
                  <button
                    onClick={() =>
                      setExSelected((prev) => {
                        const all = exchangeList.map((e) => e.exchange);
                        const cur = prev ?? new Set(all);
                        return new Set(all.filter((x) => !cur.has(x)));
                      })
                    }
                    className="rounded-full bg-neutral-800 px-2 py-0.5 text-[10px] text-neutral-400 hover:bg-neutral-700/60"
                  >
                    Invert
                  </button>
                  <span className="ml-auto font-mono text-[10px] text-neutral-600">
                    {marketMode === "all" ? "perp+spot" : marketMode}
                  </span>
                </div>
                {exchangeList.map((e) => {
                  const on = !exSelected || exSelected.has(e.exchange);
                  return (
                    <div
                      key={e.exchange}
                      className={`flex items-center justify-between gap-2 rounded px-2 py-1.5 text-xs ${
                        on ? "bg-neutral-800/60" : "opacity-50 hover:opacity-80"
                      }`}
                    >
                      <button
                        onClick={() =>
                          setExSelected((prev) => {
                            const all = exchangeList.map((x) => x.exchange);
                            const cur = new Set(prev ?? all);
                            if (cur.has(e.exchange)) cur.delete(e.exchange);
                            else cur.add(e.exchange);
                            return cur.size === all.length ? null : cur;
                          })
                        }
                        className="flex flex-1 items-center gap-2 text-left"
                      >
                        <span
                          className={`inline-block h-3 w-3 shrink-0 rounded-sm border text-[9px] leading-3 ${
                            on ? "border-emerald-500 bg-emerald-500 text-black" : "border-neutral-600"
                          }`}
                        >
                          {on ? "✓" : ""}
                        </span>
                        <span className={e.hasData ? "text-neutral-200" : "text-neutral-500"}>{e.exchange}</span>
                        {!e.hasData && <span className="text-[10px] text-neutral-600">no data</span>}
                      </button>
                      <span className="flex items-center gap-1">
                        {e.perp && (
                          <button
                            onClick={() => {
                              setExSelected(new Set([e.exchange]));
                              setMarketMode("perp");
                            }}
                            className={`rounded px-1.5 py-0.5 text-[10px] ${
                              marketMode === "perp" && on && exSelected?.size === 1 && exSelected.has(e.exchange)
                                ? "bg-emerald-700 text-white"
                                : "bg-neutral-800 text-emerald-400 hover:bg-neutral-700"
                            }`}
                          >
                            Perp
                          </button>
                        )}
                        {e.spot && (
                          <button
                            onClick={() => {
                              setExSelected(new Set([e.exchange]));
                              setMarketMode("spot");
                            }}
                            className={`rounded px-1.5 py-0.5 text-[10px] ${
                              marketMode === "spot" && on && exSelected?.size === 1 && exSelected.has(e.exchange)
                                ? "bg-sky-700 text-white"
                                : "bg-neutral-800 text-sky-400 hover:bg-neutral-700"
                            }`}
                          >
                            Spot
                          </button>
                        )}
                        {e.hasData && (
                          <span className="w-8 text-right font-mono text-[10px] text-neutral-500">{e.openOrders}</span>
                        )}
                      </span>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        <div className="flex overflow-hidden rounded border border-neutral-700">
          {(["all", "bid", "ask"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setSideFilter(s)}
              className={`px-2.5 py-1 text-xs ${sideFilter === s ? "bg-neutral-700 text-white" : "text-neutral-400 hover:bg-neutral-800"}`}
            >
              {s.toUpperCase()}
            </button>
          ))}
        </div>

        <select
          value={sortKey}
          onChange={(e) => setSortKey(e.target.value as SortKey)}
          className="rounded border border-neutral-700 bg-neutral-800 px-1.5 py-1 text-xs text-neutral-200"
        >
          <option value="near-price">Sort: near price</option>
          <option value="price-desc">Sort: price ↓</option>
          <option value="price-asc">Sort: price ↑</option>
          <option value="time-desc">Sort: newest</option>
          <option value="size-desc">Sort: size ↓</option>
        </select>

        <label className="flex items-center gap-1.5 text-xs text-neutral-400">
          <input type="checkbox" checked={showChart} onChange={(e) => setShowChart(e.target.checked)} className="accent-emerald-500" />
          Chart
        </label>

        <div className="ml-auto flex items-center gap-2">
          <span className={`flex items-center gap-1.5 text-xs ${ltoQ.error ? "text-red-400" : "text-emerald-400"}`}>
            <span className={`inline-block h-1.5 w-1.5 rounded-full ${ltoQ.error ? "bg-red-400" : "animate-pulse bg-emerald-400"}`} />
            {ltoQ.error ? "offline" : "live"}
          </span>
          <Button variant="outline" size="sm" className="h-7 border-neutral-700 text-xs" onClick={() => { klineQ.refresh(); ltoQ.refresh(); }}>
            Refresh
          </Button>
        </div>
      </div>

      {/* summary */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        <Metric
          label="Buy/sell wall balance"
          value={
            summary.bid + summary.ask > 0
              ? `${Math.round((summary.bid / (summary.bid + summary.ask)) * 100)}:${Math.round(
                  (summary.ask / (summary.bid + summary.ask)) * 100
                )}`
              : "50:50"
          }
          tone={summary.net >= 0 ? "up" : "down"}
          sub={`${fmtUsd(summary.bid)} bid : ${fmtUsd(summary.ask)} ask`}
        />
        <Metric
          label="Net wall"
          value={fmtSignedUsd(summary.net)}
          tone={summary.net >= 0 ? "up" : "down"}
          sub={`${exSelected ? `${exSelected.size} exchanges` : "all venues"}${marketMode !== "all" ? ` · ${marketMode} only` : ""}`}
        />
        <Metric label="Open orders" value={String(summary.count)} sub={`${exchangeChips.length} exchanges with data`} />
        <Metric label="Last price" value={lastPrice ? fmtP(lastPrice) : "—"} sub="Binance perp · 15m" />
        <Metric label="Threshold" value={`≥ ${fmtUsd(minVolUsd)}`} sub="resting order size filter" />
      </div>

      {/* per-exchange chips */}
      <div className="flex flex-wrap gap-1.5">
        {exchangeChips.map(([ex, s]) => {
          const net = s.bid - s.ask;
          const active = exSelected ? exSelected.has(ex) : true;
          return (
            <button
              key={ex}
              onClick={() =>
                setExSelected((prev) => {
                  const cur = new Set(prev ?? exchangeList.map((x) => x.exchange));
                  if (cur.has(ex)) cur.delete(ex);
                  else cur.add(ex);
                  return cur.size === exchangeList.length ? null : cur;
                })
              }
              className={`flex items-center gap-2 rounded border px-2 py-1 text-[11px] transition-colors ${
                active ? "border-neutral-500 bg-neutral-800" : "border-neutral-800 bg-neutral-900/60 opacity-50 hover:opacity-80"
              }`}
            >
              <span className="font-medium text-neutral-300">{ex}</span>
              <span className="text-neutral-600">
                {[...s.markets].map((m) => (m === "futures" ? "Perp" : "Spot")).join("+")}
              </span>
              <span className={net >= 0 ? "text-emerald-400" : "text-red-400"}>{fmtSignedUsd(net)}</span>
              <span className="font-mono text-neutral-600">{s.count}</span>
            </button>
          );
        })}
      </div>

      {err && (
        <div className="rounded border border-red-900/60 bg-red-950/40 px-3 py-2 text-xs text-red-300">
          Data error: {err} — retrying automatically.
        </div>
      )}

      {/* optional chart */}
      {showChart && (
        <div className="h-[420px] overflow-hidden rounded-lg border border-neutral-800 bg-[#0b0e11]">
          {candles.length > 0 ? (
            <LargeOrdersCanvas
              candles={candles}
              orders={chartOrders}
              trades={[]}
              lastPrice={lastPrice}
              imbalanceWindowPct={2}
              showWalls
              showTrades={false}
              showImbalance={false}
              resetKey={`${sym}-${[...(exSelected ?? [])].sort().join(",")}-${minVolUsd}-${marketMode}`}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-neutral-500">Loading price data…</div>
          )}
        </div>
      )}

      {/* open orders table */}
      <div className="rounded-lg border border-neutral-800 bg-neutral-900/60">
        <div className="flex items-center justify-between border-b border-neutral-800 px-3 py-2">
          <div className="text-xs font-semibold text-neutral-300">
            Open large orders · {tableRows.length}
            {exSelected ? ` · ${exSelected.size} exchanges` : " · all exchanges"}
            {marketMode !== "all" ? ` · ${marketMode === "perp" ? "Perp only" : "Spot only"}` : ""}
            {sideFilter !== "all" ? ` · ${sideFilter}` : ""}
          </div>
          <div className="text-[10px] text-neutral-500">click a row for order detail</div>
        </div>
        <div className="max-h-[560px] overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 z-10 bg-neutral-900">
              <tr className="text-neutral-500">
                <th className="px-3 py-1.5 text-left font-medium">Venue / side</th>
                <th className="px-3 py-1.5 text-right font-medium">Price</th>
                <th className="px-3 py-1.5 text-right font-medium">From price</th>
                <th className="px-3 py-1.5 text-right font-medium">Initial</th>
                <th className="px-3 py-1.5 text-right font-medium">Remaining</th>
                <th className="px-3 py-1.5 text-right font-medium">Filled</th>
                <th className="px-3 py-1.5 text-right font-medium">Fills</th>
                <th className="px-3 py-1.5 text-right font-medium">Age</th>
                <th className="px-3 py-1.5 text-right font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {tableRows.map(({ order: o, exName, market, instrumentId }) => {
                const isBid = o.side === 2;
                const filledPct = o.startUsd > 0 ? Math.min(100, (o.volUsd / o.startUsd) * 100) : 0;
                return (
                  <tr
                    key={`${o.id}-${instrumentId}`}
                    onClick={() => setSelected(selected?.id === o.id && selected.name === o.name ? null : o)}
                    className={`cursor-pointer border-t border-neutral-800/60 hover:bg-neutral-800/40 ${
                      selected?.id === o.id ? "bg-neutral-800/60" : ""
                    }`}
                  >
                    <td className="px-3 py-1.5">
                      <span className={isBid ? "text-emerald-400" : "text-red-400"}>
                        {exName}{" "}
                        <span className="rounded bg-neutral-800 px-1 py-0.5 text-[9px] uppercase tracking-wide text-neutral-400">
                          {market === "futures" ? "Perp" : "Spot"}
                        </span>{" "}
                        {isBid ? "Bid" : "Ask"}
                      </span>
                    </td>
                    <td className="px-3 py-1.5 text-right font-mono text-neutral-200">{fmtP(o.price)}</td>
                    <td className="px-3 py-1.5 text-right font-mono text-neutral-400">
                      {lastPrice ? fmtPct(((o.price - lastPrice) / lastPrice) * 100) : ""}
                    </td>
                    <td className="px-3 py-1.5 text-right font-mono text-neutral-300">{fmtUsd(o.startUsd)}</td>
                    <td className="px-3 py-1.5 text-right font-mono text-neutral-100">
                      {fmtUsd(o.currentUsd)}
                      {filledPct > 0.5 && (
                        <span className="ml-1 text-[9px] text-neutral-500">{(100 - filledPct).toFixed(0)}% left</span>
                      )}
                    </td>
                    <td className="px-3 py-1.5 text-right font-mono text-neutral-500">
                      {o.volUsd > 0 ? fmtUsd(o.volUsd) : "$0"}
                    </td>
                    <td className="px-3 py-1.5 text-right font-mono text-neutral-500">{o.count}</td>
                    <td className="px-3 py-1.5 text-right text-neutral-400">{fmtAge(Date.now() - o.startTime)}</td>
                    <td className="px-3 py-1.5 text-right">
                      <span className="rounded bg-emerald-900/40 px-1.5 py-0.5 text-[10px] text-emerald-400">Open</span>
                    </td>
                  </tr>
                );
              })}
              {tableRows.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-3 py-8 text-center text-neutral-500">
                    No open orders in the current filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* whale-order walls — the order-book wall view derived purely from
          open whale orders (subset of the full book: only ≥ threshold) */}
      <WhaleWalls scoped={scoped} lastPrice={lastPrice} fmtP={fmtP} />

      {/* order detail */}
      {selected && (
        <div className="rounded-lg border border-neutral-800 bg-neutral-900/60 p-3">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-xs font-semibold text-neutral-300">Order detail</div>
            <button onClick={() => setSelected(null)} className="text-xs text-neutral-500 hover:text-neutral-300">
              close ✕
            </button>
          </div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-[11px] sm:grid-cols-4">
            <Detail label="Venue" value={`${selected.name}`} />
            <Detail label="Side" value={selected.side === 2 ? "Bid (buy wall)" : "Ask (sell wall)"} tone={selected.side === 2 ? "up" : "down"} />
            <Detail label="Price" value={fmtP(selected.price)} />
            <Detail label="Status" value="Open" tone="up" />
            <Detail label="Initial size" value={`${fmtNum(selected.startAmount, 3)} ${sym} · ${fmtUsd(selected.startUsd)}`} />
            <Detail label="Remaining" value={`${fmtNum(selected.currentAmount, 3)} ${sym} · ${fmtUsd(selected.currentUsd)}`} />
            <Detail label="Filled" value={`${fmtNum(selected.vol, 3)} ${sym} · ${fmtUsd(selected.volUsd)}`} />
            <Detail label="Fills" value={String(selected.count)} />
            <Detail label="Placed" value={new Date(selected.startTime).toISOString().replace("T", " ").slice(0, 16) + " UTC"} />
            <Detail label="Last update" value={new Date(selected.currentTime).toISOString().replace("T", " ").slice(0, 16) + " UTC"} />
          </div>
        </div>
      )}
    </div>
  );
}

function Detail({ label, value, tone }: { label: string; value: string; tone?: "up" | "down" }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-neutral-800/50 py-1">
      <span className="text-neutral-500">{label}</span>
      <span className={`font-mono ${tone === "up" ? "text-emerald-400" : tone === "down" ? "text-red-400" : "text-neutral-200"}`}>
        {value}
      </span>
    </div>
  );
}

function fmtSignedUsd(n: number): string {
  const s = fmtUsd(Math.abs(n));
  return `${n >= 0 ? "+" : "−"}${s}`;
}

function Metric({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "up" | "down" }) {
  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900/60 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-neutral-500">{label}</div>
      <div
        className={`mt-0.5 font-mono text-sm font-semibold ${
          tone === "up" ? "text-emerald-400" : tone === "down" ? "text-red-400" : "text-neutral-100"
        }`}
      >
        {value}
      </div>
      {sub && <div className="text-[10px] text-neutral-500">{sub}</div>}
    </div>
  );
}

/**
 * Whale-order walls — bid/ask wall levels derived purely from the open
 * whale orders table (resting orders ≥ the size threshold). This is the
 * whale-order subset of the full order-book wall view (the complete book
 * lives in the Book Walls tab).
 */
function WhaleWalls({
  scoped,
  lastPrice,
  fmtP,
}: {
  scoped: { order: LtoOrder; exName: string; market: string; instrumentId: string }[];
  lastPrice: number | null;
  fmtP: (n: number) => string;
}) {
  // bucket ≈ price/500, rounded to 1-2-5×10ⁿ — BTC@74k → $200 buckets,
  // XRP@$1.09 → $0.005 buckets (a fixed $50 grid collapses sub-$10 assets
  // into a single "$0.00" row)
  const BUCKET = useMemo(() => {
    if (!lastPrice || lastPrice <= 0) return 50;
    const raw = lastPrice / 500;
    const mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const n = raw / mag;
    const mult = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
    return mult * mag;
  }, [lastPrice]);
  const band = useMemo(() => {
    if (!lastPrice) return null;
    const m = new Map<number, { bid: number; ask: number; orders: number; venues: Set<string> }>();
    for (const { order: o, exName } of scoped) {
      const p = o.price;
      if (!(p > 0) || Math.abs(p - lastPrice) / lastPrice > 0.05) continue;
      const k = Math.round(p / BUCKET) * BUCKET;
      let e = m.get(k);
      if (!e) {
        e = { bid: 0, ask: 0, orders: 0, venues: new Set() };
        m.set(k, e);
      }
      if (o.side === 2) e.bid += o.currentUsd;
      else e.ask += o.currentUsd;
      e.orders++;
      e.venues.add(exName);
    }
    const rows = [...m.entries()]
      .map(([price, v]) => ({ price, ...v, usd: v.bid + v.ask }))
      .sort((a, b) => b.usd - a.usd);
    const bids = rows.filter((r) => r.bid > 0).sort((a, b) => b.bid - a.bid);
    const asks = rows.filter((r) => r.ask > 0).sort((a, b) => b.ask - a.ask);
    // the ladder shows the 14 BIGGEST buckets by USD, then price-sorted —
    // slicing a price-sorted list instead would keep only the highest-priced
    // (farthest) asks and hide every bid wall
    const top = rows.slice(0, 14).sort((a, b) => b.price - a.price);
    return {
      rows: top,
      maxBid: bids[0] ?? null,
      maxAsk: asks[0] ?? null,
      bidTotal: scoped.filter((s) => s.order.side === 2 && Math.abs(s.order.price - lastPrice) / lastPrice <= 0.05).reduce((t, s) => t + s.order.currentUsd, 0),
      askTotal: scoped.filter((s) => s.order.side === 1 && Math.abs(s.order.price - lastPrice) / lastPrice <= 0.05).reduce((t, s) => t + s.order.currentUsd, 0),
    };
  }, [scoped, lastPrice, BUCKET]);

  if (!band || !lastPrice) return null;
  const maxUsd = Math.max(1, ...band.rows.map((r) => r.usd));

  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900/60 p-3">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold text-neutral-100">
          Whale-order walls <span className="text-[11px] font-normal text-neutral-500">open orders ≥ threshold aggregated at ${fmtP(BUCKET)} price buckets · ±5%</span>
        </h3>
        <span className="font-mono text-[11px] text-neutral-400">
          bid {fmtUsd(band.bidTotal)} · ask {fmtUsd(band.askTotal)} · net{" "}
          <span className={band.bidTotal - band.askTotal >= 0 ? "text-emerald-400" : "text-red-400"}>
            {fmtSignedUsd(band.bidTotal - band.askTotal)}
          </span>
        </span>
      </div>
      <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Metric label="Largest bid wall" value={band.maxBid ? fmtP(band.maxBid.price) : "—"} sub={band.maxBid ? `${fmtUsd(band.maxBid.bid)} · ${(((band.maxBid.price - lastPrice) / lastPrice) * 100).toFixed(2)}%` : "none"} tone="up" />
        <Metric label="Largest ask wall" value={band.maxAsk ? fmtP(band.maxAsk.price) : "—"} sub={band.maxAsk ? `${fmtUsd(band.maxAsk.ask)} · +${(((band.maxAsk.price - lastPrice) / lastPrice) * 100).toFixed(2)}%` : "none"} tone="down" />
        <Metric label="Whale bid depth" value={fmtUsd(band.bidTotal)} sub="sum of open buy walls ±5%" tone="up" />
        <Metric label="Whale ask depth" value={fmtUsd(band.askTotal)} sub="sum of open sell walls ±5%" tone="down" />
      </div>
      <div className="space-y-1">
        {band.rows.map((r) => {
          const bidW = (r.bid / maxUsd) * 46;
          const askW = (r.ask / maxUsd) * 46;
          return (
            <div key={r.price} className="flex items-center gap-1.5 text-[11px]">
              <div className="flex h-4 flex-1 items-center justify-end">
                <div className="h-3 rounded-l bg-emerald-500/70" style={{ width: `${bidW}%` }} title={`bid ${fmtUsd(r.bid)}`} />
              </div>
              <span className={`w-16 shrink-0 text-center font-mono ${r.price < lastPrice ? "text-neutral-300" : "text-neutral-100"}`}>
                {fmtP(r.price)}
              </span>
              <div className="flex h-4 flex-1 items-center">
                <div className="h-3 rounded-r bg-red-500/70" style={{ width: `${askW}%` }} title={`ask ${fmtUsd(r.ask)}`} />
              </div>
              <span className="w-24 shrink-0 text-right font-mono text-[10px] text-neutral-500" title={[...r.venues].join(", ")}>
                {r.orders} ord · {r.venues.size} venue{r.venues.size > 1 ? "s" : ""}
              </span>
            </div>
          );
        })}
        {!band.rows.length && (
          <div className="py-4 text-center text-[11px] text-neutral-600">No whale orders within ±5% in the current filter.</div>
        )}
      </div>
      <div className="mt-2 text-[10px] leading-relaxed text-neutral-500">
        Derived only from whale orders (single resting orders above the threshold) — the same wall levels the Coinglass
        large-orderbook page tracks. For the complete depth walls including all smaller resting liquidity see the Book
        Walls tab.
      </div>
    </div>
  );
}
