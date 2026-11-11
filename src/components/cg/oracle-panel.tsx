"use client";

import { usePolling } from "@/components/cg/use-cg-data";
import {
  AlertTriangle,
  Mountain,
  RefreshCw,
  Scale,
  Skull,
  Sparkles,
  Sun,
  Waves,
  Zap,
  type LucideIcon,
} from "lucide-react";

/**
 * OraclePanel — ATHENA ORACLE, the confluence panel (Quant × Divine).
 *
 * One composite 0-100 score from six real-data factors (Apollo trend ·
 * Poseidon order-flow · Hades liquidation gravity · Zeus whale strikes ·
 * Atlas wall pressure · Nemesis funding reversion), polled from
 * /api/cg/oracle every 60s. Honest by design: a failed source renders as a
 * neutral 50 "source unavailable" row (flagged in partial), never a fake
 * number — and the panel says so.
 */

interface OracleFactor {
  id: string;
  name: string;
  icon: "sun" | "waves" | "skull" | "zap" | "mountain" | "scale";
  score: number;
  weight: number;
  detail: string;
}

interface OracleResp {
  ok: boolean;
  sym: string;
  at: number;
  score: number;
  verdict: string;
  factors: OracleFactor[];
  regime: "trend" | "range" | "squeeze" | null;
  partial?: string[];
  error?: string;
}

const FACTOR_ICONS: Record<OracleFactor["icon"], LucideIcon> = {
  sun: Sun,
  waves: Waves,
  skull: Skull,
  zap: Zap,
  mountain: Mountain,
  scale: Scale,
};

/** composite score color — gold accent for the divine, green/red for the quant */
function scoreCls(s: number): string {
  if (s >= 70) return "text-emerald-400";
  if (s >= 55) return "text-emerald-300";
  if (s > 45) return "text-amber-200";
  if (s >= 30) return "text-rose-300";
  return "text-rose-400";
}

function barCls(s: number): string {
  if (s > 55) return "bg-emerald-500";
  if (s < 45) return "bg-rose-500";
  return "bg-neutral-500";
}

function numCls(s: number): string {
  if (s > 55) return "text-emerald-400";
  if (s < 45) return "text-rose-400";
  return "text-neutral-400";
}

function OracleSkeleton() {
  return (
    <div
      role="status"
      aria-label="Athena Oracle loading"
      className="max-h-[260px] animate-pulse rounded-lg border border-amber-900/40 bg-[#11151a]"
    >
      <div className="flex items-center justify-between border-b border-neutral-800/80 px-3 py-2">
        <div className="h-3 w-28 rounded bg-neutral-800" />
        <div className="h-3 w-14 rounded bg-neutral-800" />
      </div>
      <div className="flex items-center gap-3 border-b border-neutral-800/80 px-3 py-2.5">
        <div className="h-8 w-14 rounded bg-neutral-800" />
        <div className="h-3 flex-1 rounded bg-neutral-800/80" />
      </div>
      <div className="space-y-2 px-3 py-2.5">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="h-3.5 w-3.5 rounded bg-neutral-800" />
            <div className="h-3 flex-1 rounded bg-neutral-800/70" />
            <div className="h-1.5 w-16 rounded-full bg-neutral-800" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function OraclePanel({ sym }: { sym: string }) {
  const q = usePolling<OracleResp>(`/api/cg/oracle?sym=${encodeURIComponent(sym)}`, 60_000);

  if (q.loading && !q.data) return <OracleSkeleton />;

  if (q.error || !q.data || q.data.ok !== true || q.data.sym !== sym) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-lg border border-amber-800/50 bg-amber-950/20 px-3 py-2.5">
        <div className="flex items-center gap-2 text-[11px] text-amber-300">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>
            <span className="font-bold tracking-wider text-amber-200">ATHENA ORACLE</span> —{" "}
            {q.error ?? q.data?.error ?? "no verdict available"} (retrying every 60s)
          </span>
        </div>
        <button
          onClick={() => void q.refresh()}
          className="flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-semibold text-amber-300/80 transition-colors hover:bg-amber-900/30 hover:text-amber-200"
        >
          <RefreshCw className="h-3 w-3" aria-hidden="true" />
          retry
        </button>
      </div>
    );
  }

  const d = q.data;
  const partial = d.partial ?? [];

  return (
    <section
      aria-label={`Athena Oracle confluence panel for ${sym}`}
      className="max-h-[260px] overflow-hidden rounded-lg border border-amber-900/40 bg-[#11151a]"
    >
      {/* header */}
      <div className="flex items-center justify-between border-b border-neutral-800/80 px-3 py-1.5">
        <div className="flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-amber-400" aria-hidden="true" />
          <span className="text-[11px] font-bold tracking-[0.2em] text-amber-300">ATHENA ORACLE</span>
          <span className="text-[9px] text-neutral-600">· {sym} · 60s</span>
        </div>
        <div className="flex items-center gap-2">
          {partial.length > 0 && (
            <span
              title={`neutral fallback (source unavailable): ${partial.join(", ")}`}
              className="rounded bg-amber-950/50 px-1.5 py-0.5 text-[9px] font-semibold text-amber-500/90"
            >
              fallback ×{partial.length}
            </span>
          )}
          <span className="rounded bg-neutral-800 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-neutral-400">
            {d.regime ?? "regime –"}
          </span>
        </div>
      </div>

      {/* composite score + verdict */}
      <div className="flex items-center gap-3 border-b border-neutral-800/80 px-3 py-2">
        <div className="flex shrink-0 items-baseline gap-1" aria-label={`Composite confluence score ${d.score} of 100`}>
          <span className={`font-mono text-[28px] font-bold leading-none tabular-nums ${scoreCls(d.score)}`}>
            {d.score}
          </span>
          <span className="text-[10px] font-semibold text-neutral-600">/100</span>
        </div>
        <p className="min-w-0 flex-1 text-[11px] leading-snug text-neutral-400">{d.verdict}</p>
      </div>

      {/* six factors */}
      <div className="max-h-[146px] space-y-1.5 overflow-y-auto px-3 py-2 [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-neutral-700 [&::-webkit-scrollbar-track]:bg-transparent">
        {d.factors.map((f) => {
          const Icon = FACTOR_ICONS[f.icon] ?? Sun;
          return (
            <div key={f.id} className="flex items-center gap-2" title={f.detail}>
              <Icon className="h-3.5 w-3.5 shrink-0 text-neutral-400" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[11px] font-semibold text-neutral-200">{f.name}</span>
                  <span className="text-[9px] tabular-nums text-neutral-600">w {Math.round(f.weight * 100)}%</span>
                </div>
                <div className={`truncate text-[10px] ${partial.includes(f.id) ? "text-amber-600/80" : "text-neutral-500"}`}>
                  {f.detail}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <div className="h-1.5 w-16 overflow-hidden rounded-full bg-neutral-800" aria-hidden="true">
                  <div className={`h-full rounded-full ${barCls(f.score)}`} style={{ width: `${f.score}%` }} />
                </div>
                <span className={`w-5 text-right font-mono text-[10px] font-bold tabular-nums ${numCls(f.score)}`}>
                  {f.score}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
