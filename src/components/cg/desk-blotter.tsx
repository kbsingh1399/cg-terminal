"use client";

import { useEffect, useState } from "react";
import { usePolling } from "./use-cg-data";
import type { DeskLiveSnapshot } from "@/lib/desk/live";

/**
 * DeskBlotter — Strictly Read-Only Live MT5 + `zai-desk` / `atg-exec` Coordination Blotter.
 *
 * Reads `/api/desk/live` (`desk/mt5.json`, `desk/state.json`, `desk/log.md` tail) with
 * live terminal price overlays. Never writes or modifies any desk file or broker order.
 */

function fmtMoney(v: number | null | undefined, currency = "USD"): string {
  if (v == null || !Number.isFinite(v)) return "–";
  const prefix = currency === "USD" ? "$" : `${currency} `;
  return `${prefix}${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtLevel(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "–";
  const abs = Math.abs(v);
  const decs = abs >= 1000 ? 1 : abs >= 10 ? 2 : abs >= 0.1 ? 4 : 6;
  return v.toLocaleString("en-US", { minimumFractionDigits: decs, maximumFractionDigits: decs });
}

function fmtRelTime(ts: number | null | undefined, now: number): string {
  if (!ts || !Number.isFinite(ts)) return "–";
  const diffS = Math.round((now - ts) / 1000);
  if (diffS < 0) {
    const remM = Math.max(0, Math.round(-diffS / 60));
    return remM >= 60 ? `in ${Math.floor(remM / 60)}h ${remM % 60}m` : `in ${remM}m`;
  }
  if (diffS < 60) return `${diffS}s ago`;
  const m = Math.floor(diffS / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m ago`;
}

function KpiTile({
  label,
  value,
  sub,
  cls = "text-neutral-100",
}: {
  label: string;
  value: string;
  sub?: string;
  cls?: string;
}) {
  return (
    <div className="rounded-md border border-neutral-800/80 bg-[#0d1117] px-3 py-2">
      <div className="text-[9px] uppercase tracking-wider text-neutral-500">{label}</div>
      <div className={`font-mono text-sm font-bold tabular-nums ${cls}`}>{value}</div>
      {sub && <div className="text-[10px] text-neutral-500">{sub}</div>}
    </div>
  );
}

export default function DeskBlotter({
  onPickAsset,
}: {
  onPickAsset: (sym: string) => void;
}) {
  const q = usePolling<DeskLiveSnapshot>("/api/desk/live", 10_000);
  const d = q.data;
  const [orderFilter, setOrderFilter] = useState<"active" | "all">("active");
  const [expandedRound, setExpandedRound] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 5_000);
    return () => clearInterval(t);
  }, []);

  if (q.error && !d) {
    return (
      <div className="rounded-lg border border-rose-900/50 bg-rose-950/30 p-4 text-xs text-rose-300">
        Desk bridge error: {q.error}
      </div>
    );
  }

  const acct = d?.mt5.account;
  const currency = acct?.currency ?? "USD";
  const mt5Stale = d?.mt5.ts != null && now - d.mt5.ts > 5 * 60_000;
  const visibleDeskOrders = (d?.orders ?? []).filter((o) =>
    orderFilter === "active"
      ? ["pending", "suggested", "armed", "open", "placed"].includes(o.status.toLowerCase())
      : true
  );

  return (
    <div className="space-y-4">
      {/* Read-only MT5 Account Telemetry */}
      <div className="rounded-lg border border-neutral-800 bg-[#11151a] p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-neutral-300">
              Live MT5 &amp; Trade Desk Blotter
            </span>
            <span className="rounded bg-neutral-800 px-1.5 py-0.5 text-[10px] font-medium text-neutral-400">
              READ-ONLY · ZERO MUTATION
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono">
            {d?.analysis.lastRound && (
              <span className="rounded bg-sky-500/15 px-2 py-0.5 text-sky-300">
                Round {d.analysis.lastRound} · {fmtRelTime(d.analysis.lastRoundTs, now)}
              </span>
            )}
            <span
              className={`rounded px-2 py-0.5 ${
                d?.mt5.error
                  ? "bg-rose-500/20 text-rose-300"
                  : mt5Stale
                    ? "bg-amber-500/20 text-amber-300"
                    : "bg-emerald-500/15 text-emerald-300"
              }`}
            >
              MT5 {d?.mt5.error ? "ERROR" : mt5Stale ? "STALE" : "SYNC"} · {fmtRelTime(d?.mt5.ts, now)}
            </span>
          </div>
        </div>

        {d?.mt5.error && (
          <div className="mb-3 rounded border border-rose-900/50 bg-rose-950/30 px-3 py-2 text-xs text-rose-300">
            MT5 snapshot warning: {d.mt5.error}
          </div>
        )}

        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 lg:grid-cols-7">
          <KpiTile label="Balance" value={fmtMoney(acct?.balance, currency)} />
          <KpiTile label="Equity" value={fmtMoney(acct?.equity, currency)} />
          <KpiTile
            label="Floating PnL"
            value={acct ? `${acct.profit >= 0 ? "+" : ""}${fmtMoney(acct.profit, currency)}` : "–"}
            cls={acct ? (acct.profit >= 0 ? "text-emerald-400" : "text-rose-400") : "text-neutral-500"}
          />
          <KpiTile label="Free Margin" value={fmtMoney(acct?.marginFree, currency)} sub={acct ? `Used ${fmtMoney(acct.margin, currency)}` : undefined} />
          <KpiTile label="Leverage" value={acct ? `1:${acct.leverage}` : "–"} />
          <KpiTile
            label="Risk Slots"
            value={d ? `${d.mt5.slotsUsed} / ${d.mt5.maxSlots}` : "–"}
            cls={
              d && d.mt5.slotsUsed >= d.mt5.maxSlots
                ? "text-amber-300"
                : "text-emerald-400"
            }
            sub={`${d?.mt5.positions.length ?? 0} pos · ${d?.mt5.orders.length ?? 0} limits`}
          />
          <KpiTile label="Desk Engine" value={d?.analysis.engine ?? "–"} sub={`${d?.analysis.assets.length ?? 0} tracked`} />
        </div>
      </div>

      {/* Live MT5 Open Positions */}
      <div className="rounded-lg border border-neutral-800 bg-[#11151a] p-4">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-300">
            Open MT5 Positions ({d?.mt5.positions.length ?? 0})
          </h3>
        </div>
        {!d?.mt5.positions.length ? (
          <div className="rounded border border-dashed border-neutral-800 py-4 text-center text-xs text-neutral-500">
            No open MT5 positions.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[780px] border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-neutral-800 text-[10px] uppercase tracking-wider text-neutral-500">
                  <th className="px-2 py-2">Ticket</th>
                  <th className="px-2 py-2">Symbol</th>
                  <th className="px-2 py-2">Side</th>
                  <th className="px-2 py-2 text-right">Lots</th>
                  <th className="px-2 py-2 text-right">Entry</th>
                  <th className="px-2 py-2 text-right">Live</th>
                  <th className="px-2 py-2 text-right">SL (Dist %)</th>
                  <th className="px-2 py-2 text-right">TP (Dist %)</th>
                  <th className="px-2 py-2 text-right">Unrealized PnL</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800/60 font-mono tabular-nums">
                {d.mt5.positions.map((p) => (
                  <tr
                    key={p.ticket}
                    onClick={() => onPickAsset(p.sym)}
                    className="cursor-pointer hover:bg-neutral-800/40"
                  >
                    <td className="px-2 py-2 text-neutral-400">#{p.ticket}</td>
                    <td className="px-2 py-2 font-bold text-neutral-100">
                      {p.sym} <span className="text-[10px] font-normal text-neutral-500">{p.mt5Symbol}</span>
                    </td>
                    <td className="px-2 py-2">
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                          p.side === "long" ? "bg-emerald-500/20 text-emerald-300" : "bg-rose-500/20 text-rose-300"
                        }`}
                      >
                        {p.side}
                      </span>
                    </td>
                    <td className="px-2 py-2 text-right text-neutral-300">{p.volume.toFixed(2)}</td>
                    <td className="px-2 py-2 text-right text-neutral-200">{fmtLevel(p.openPrice)}</td>
                    <td className="px-2 py-2 text-right text-neutral-100">{fmtLevel(p.livePrice)}</td>
                    <td className="px-2 py-2 text-right text-rose-300">
                      {fmtLevel(p.sl)}{" "}
                      {p.distToSlPct != null && <span className="text-[10px] text-neutral-500">({p.distToSlPct.toFixed(2)}%)</span>}
                    </td>
                    <td className="px-2 py-2 text-right text-emerald-300">
                      {fmtLevel(p.tp)}{" "}
                      {p.distToTpPct != null && <span className="text-[10px] text-neutral-500">({p.distToTpPct.toFixed(2)}%)</span>}
                    </td>
                    <td
                      className={`px-2 py-2 text-right font-bold ${
                        p.profitUsd >= 0 ? "text-emerald-400" : "text-rose-400"
                      }`}
                    >
                      {p.profitUsd >= 0 ? "+" : ""}
                      {fmtMoney(p.profitUsd, currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Live MT5 Pending Broker Limits */}
      <div className="rounded-lg border border-neutral-800 bg-[#11151a] p-4">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-300">
            Active MT5 Limit Orders ({d?.mt5.orders.length ?? 0})
          </h3>
          <span className="text-[10px] text-neutral-500">Sorted with live fill distance</span>
        </div>
        {!d?.mt5.orders.length ? (
          <div className="rounded border border-dashed border-neutral-800 py-4 text-center text-xs text-neutral-500">
            No resting MT5 pending orders.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-neutral-800 text-[10px] uppercase tracking-wider text-neutral-500">
                  <th className="px-2 py-2">Ticket</th>
                  <th className="px-2 py-2">Symbol</th>
                  <th className="px-2 py-2">Type</th>
                  <th className="px-2 py-2 text-right">Lots</th>
                  <th className="px-2 py-2 text-right">Entry</th>
                  <th className="px-2 py-2 text-right">Live</th>
                  <th className="px-2 py-2 text-right">Dist %</th>
                  <th className="px-2 py-2 text-right">SL / TP</th>
                  <th className="px-2 py-2 text-right">R / Spread</th>
                  <th className="px-2 py-2 text-right">Age</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800/60 font-mono tabular-nums">
                {d.mt5.orders.map((o) => {
                  const near = o.distToEntryPct != null && Math.abs(o.distToEntryPct) <= 1.0;
                  return (
                    <tr
                      key={o.ticket}
                      onClick={() => onPickAsset(o.sym)}
                      className="cursor-pointer hover:bg-neutral-800/40"
                    >
                      <td className="px-2 py-2 text-neutral-400">#{o.ticket}</td>
                      <td className="px-2 py-2 font-bold text-neutral-100">
                        {o.sym} <span className="text-[10px] font-normal text-neutral-500">{o.mt5Symbol}</span>
                      </td>
                      <td className="px-2 py-2">
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                            o.side === "long" ? "bg-emerald-500/15 text-emerald-300" : "bg-rose-500/15 text-rose-300"
                          }`}
                        >
                          {o.type}
                        </span>
                      </td>
                      <td className="px-2 py-2 text-right text-neutral-300">{o.volume.toFixed(2)}</td>
                      <td className="px-2 py-2 text-right text-neutral-100">{fmtLevel(o.entry)}</td>
                      <td className="px-2 py-2 text-right text-neutral-300">{fmtLevel(o.livePrice)}</td>
                      <td className="px-2 py-2 text-right">
                        {o.distToEntryPct != null ? (
                          <span
                            className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${
                              near ? "bg-amber-500/20 text-amber-300" : "text-neutral-400"
                            }`}
                          >
                            {o.distToEntryPct >= 0 ? "+" : ""}
                            {o.distToEntryPct.toFixed(2)}%
                          </span>
                        ) : (
                          "–"
                        )}
                      </td>
                      <td className="px-2 py-2 text-right text-[11px]">
                        <span className="text-rose-300">{fmtLevel(o.sl)}</span>
                        <span className="mx-1 text-neutral-600">/</span>
                        <span className="text-emerald-300">{fmtLevel(o.tp)}</span>
                      </td>
                      <td className="px-2 py-2 text-right text-[11px]">
                        <span className="text-sky-300">{o.riskR != null ? `${o.riskR.toFixed(1)}R` : "–"}</span>
                        {o.spreadPct != null && (
                          <span className="ml-1.5 text-[10px] text-neutral-500">· {o.spreadPct.toFixed(3)}%</span>
                        )}
                      </td>
                      <td className="px-2 py-2 text-right text-[10px] text-neutral-500">
                        {fmtRelTime(o.placedTs, now)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Desk Agent Coordination Orders (`desk/state.json`) */}
      <div className="rounded-lg border border-neutral-800 bg-[#11151a] p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-300">
            Agent Setups Queue ({visibleDeskOrders.length} / {d?.orders.length ?? 0})
          </h3>
          <div className="flex items-center gap-1 rounded border border-neutral-800 bg-[#0b0e11] p-0.5 text-[11px]">
            <button
              onClick={() => setOrderFilter("active")}
              className={`rounded px-2 py-0.5 ${orderFilter === "active" ? "bg-neutral-800 text-neutral-100" : "text-neutral-500"}`}
            >
              Active / Pending
            </button>
            <button
              onClick={() => setOrderFilter("all")}
              className={`rounded px-2 py-0.5 ${orderFilter === "all" ? "bg-neutral-800 text-neutral-100" : "text-neutral-500"}`}
            >
              All ({d?.orders.length ?? 0})
            </button>
          </div>
        </div>
        {visibleDeskOrders.length === 0 ? (
          <div className="rounded border border-dashed border-neutral-800 py-4 text-center text-xs text-neutral-500">
            No {orderFilter === "active" ? "active " : ""}agent setups recorded.
          </div>
        ) : (
          <div className="space-y-2">
            {visibleDeskOrders.map((o) => (
              <div
                key={o.id}
                onClick={() => onPickAsset(o.sym)}
                className="cursor-pointer rounded-md border border-neutral-800/80 bg-[#0d1117] px-3 py-2.5 transition-colors hover:border-neutral-700"
              >
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="font-mono font-bold text-neutral-100">{o.sym}</span>
                  <span
                    className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                      o.side === "long" ? "bg-emerald-500/20 text-emerald-300" : "bg-rose-500/20 text-rose-300"
                    }`}
                  >
                    {o.side} · {o.type}
                  </span>
                  <span className="rounded bg-neutral-800 px-1.5 py-0.5 font-mono text-[10px] text-neutral-300">
                    {o.status}
                  </span>
                  <span className="font-mono text-[10px] text-neutral-500">{o.round}</span>
                  {o.riskR != null && (
                    <span className="rounded bg-sky-500/15 px-1.5 py-0.5 font-mono text-[10px] text-sky-300">
                      {o.riskR.toFixed(1)}R
                    </span>
                  )}
                  {o.ticket != null && (
                    <span className="font-mono text-[10px] text-emerald-400">#{o.ticket}</span>
                  )}
                  <span className="ml-auto font-mono text-[11px] tabular-nums text-neutral-300">
                    Entry {fmtLevel(o.entry)} · SL {fmtLevel(o.stop)}
                    {o.targets.length > 0 ? ` · TP ${o.targets.map(fmtLevel).join(" / ")}` : ""}
                    {o.distToEntryPct != null ? (
                      <span className="ml-2 text-amber-300">
                        ({o.distToEntryPct >= 0 ? "+" : ""}
                        {o.distToEntryPct.toFixed(2)}%)
                      </span>
                    ) : null}
                  </span>
                </div>
                {(o.rationale || o.notes) && (
                  <p className="mt-1.5 text-[11px] leading-relaxed text-neutral-400">
                    {o.rationale ?? o.notes}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Multi-Asset Round Matrix + Digest Tail */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-neutral-800 bg-[#11151a] p-4">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-neutral-300">
            Last Round Scores ({d?.analysis.lastRound ?? "–"})
          </h3>
          {!d?.analysis.assets.length ? (
            <div className="text-xs text-neutral-500">No round asset summary recorded.</div>
          ) : (
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
              {d.analysis.assets.map((a) => (
                <button
                  key={a.sym}
                  onClick={() => onPickAsset(a.sym)}
                  className="flex items-center justify-between rounded border border-neutral-800/80 bg-[#0d1117] px-2.5 py-1.5 text-left hover:border-neutral-700"
                >
                  <div>
                    <div className="font-mono text-xs font-bold text-neutral-100">{a.sym}</div>
                    <div className="font-mono text-[10px] text-neutral-400">
                      {a.price != null ? fmtLevel(a.price) : "–"}
                    </div>
                  </div>
                  <div className="text-right font-mono tabular-nums">
                    <div
                      className={`text-xs font-bold ${
                        a.score == null
                          ? "text-neutral-500"
                          : a.score > 0
                            ? "text-emerald-400"
                            : a.score < 0
                              ? "text-rose-400"
                              : "text-neutral-400"
                      }`}
                    >
                      {a.score != null ? `${a.score >= 0 ? "+" : ""}${a.score.toFixed(1)}` : "–"}
                    </div>
                    <div
                      className={`text-[10px] ${
                        a.chgDayPct == null
                          ? "text-neutral-600"
                          : a.chgDayPct >= 0
                            ? "text-emerald-400/80"
                            : "text-rose-400/80"
                      }`}
                    >
                      {a.chgDayPct != null ? `${a.chgDayPct >= 0 ? "+" : ""}${a.chgDayPct.toFixed(2)}%` : "–"}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-lg border border-neutral-800 bg-[#11151a] p-4">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-neutral-300">
            Recent Desk Log ({d?.recentLog.length ?? 0} entries)
          </h3>
          {!d?.recentLog.length ? (
            <div className="text-xs text-neutral-500">No log entries found.</div>
          ) : (
            <div className="max-h-72 space-y-1.5 overflow-y-auto pr-1">
              {d.recentLog.map((entry) => {
                const open = expandedRound === entry.heading;
                return (
                  <div key={entry.heading} className="rounded border border-neutral-800/80 bg-[#0d1117]">
                    <button
                      type="button"
                      onClick={() => setExpandedRound(open ? null : entry.heading)}
                      className="flex w-full items-center justify-between px-3 py-1.5 text-left text-[11px] font-semibold text-neutral-200 hover:bg-neutral-800/40"
                    >
                      <span className="truncate font-mono">{entry.heading}</span>
                      <span className="ml-2 shrink-0 text-[10px] text-neutral-500">
                        {open ? "▾" : "▸"} {entry.lines.length}L
                      </span>
                    </button>
                    {open && (
                      <pre className="overflow-x-auto border-t border-neutral-800/80 px-3 py-2 font-mono text-[10px] leading-relaxed text-neutral-400">
                        {entry.lines.join("\n")}
                      </pre>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
