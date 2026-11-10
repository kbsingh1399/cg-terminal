"use client";

import { usePolling } from "./use-cg-data";

/**
 * Continuity-engine indicator — shows whether the local engine is running,
 * whether boot backfill is still in progress and how many series are
 * tracking. Click to expand per-series coverage.
 */

interface EngineStatusResponse {
  ok: boolean;
  enabled: boolean;
  started: boolean;
  startedAt: number;
  backfillDays: number;
  instrumentKeys: string[];
  series: { name: string; count: number; lastTs: number | null; lastPoll: number | null; lastError: string | null; backfilling: boolean }[];
  klineGaps: number;
}

function ago(ms: number): string {
  const s = Math.max(0, (Date.now() - ms) / 1000);
  if (s < 90) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

export default function EngineStatus() {
  const q = usePolling<EngineStatusResponse>("/api/cg/engine/status", 30_000);
  const d = q.data;
  if (!d) {
    return (
      <span className="rounded bg-neutral-800 px-2 py-1 text-[10px] text-neutral-500" title="Continuity engine">
        engine …
      </span>
    );
  }
  const backfilling = d.series.some((s) => s.backfilling);
  const withErrors = d.series.filter((s) => s.lastError).length;
  const state = !d.enabled
    ? { label: "engine off", cls: "bg-neutral-800 text-neutral-400" }
    : backfilling
      ? { label: "backfilling…", cls: "bg-blue-950 text-blue-300" }
      : withErrors
        ? { label: `engine live · ${withErrors} err`, cls: "bg-amber-950 text-amber-300" }
        : { label: "engine live", cls: "bg-emerald-950 text-emerald-300" };

  return (
    <div className="group relative">
      <div className="flex items-center gap-2">
        <span className={`rounded px-2 py-1 text-[10px] ${state.cls}`}>{state.label}</span>
        <span className="rounded bg-neutral-800 px-2 py-1 font-mono text-[10px] text-neutral-400" title="stored series · kline gaps">
          {d.series.length} series · {d.klineGaps} gaps
        </span>
      </div>
      <div className="invisible absolute right-0 top-full z-50 mt-1 w-96 rounded-lg border border-neutral-700 bg-neutral-900 p-2.5 opacity-0 shadow-xl transition-opacity group-hover:visible group-hover:opacity-100">
        <div className="mb-1.5 flex items-baseline justify-between">
          <span className="text-xs font-semibold text-neutral-200">Continuity engine</span>
          <span className="text-[10px] text-neutral-500">boot backfill {d.backfillDays}d · {d.instrumentKeys.length} flow venues</span>
        </div>
        <div className="max-h-72 overflow-auto">
          <table className="w-full text-[10px]">
            <thead className="text-neutral-500">
              <tr>
                <th className="text-left font-medium">Series</th>
                <th className="text-right font-medium">Rows</th>
                <th className="text-right font-medium">Last bar</th>
                <th className="text-right font-medium">Poll</th>
              </tr>
            </thead>
            <tbody>
              {d.series.map((s) => (
                <tr key={s.name} className="border-t border-neutral-800/50">
                  <td className="py-1 font-mono text-neutral-300">{s.name}</td>
                  <td className="py-1 text-right font-mono text-neutral-400">{s.count}</td>
                  <td className="py-1 text-right font-mono text-neutral-500">
                    {s.lastTs ? new Date(s.lastTs).toLocaleString([], { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—"}
                  </td>
                  <td className={`py-1 text-right font-mono ${s.lastError ? "text-red-400" : "text-neutral-500"}`}>
                    {s.lastPoll ? ago(s.lastPoll) : "—"} {s.backfilling ? "· filling" : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-1.5 text-[9px] leading-relaxed text-neutral-500">
          On startup the engine pages upstream history from each series&apos; last stored timestamp — restart-safe and
          gap-free. Data lives in data/cg-series/*.jsonl on your machine.
        </div>
      </div>
    </div>
  );
}
