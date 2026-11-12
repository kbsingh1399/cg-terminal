"use client";

import { useEffect, useMemo, useState } from "react";
import { usePolling } from "./use-cg-data";
import type { NarrativeVerdict } from "@/lib/cg/narrative";
import type { SetupProbability } from "@/lib/cg/probability";
import type { PaperBookTicketView } from "@/lib/cg/paperbook";

/**
 * NarrativeCard — the deterministic M1/M2 trade verdict, always visible at
 * the top of Overview (Phase 4 directive): regime → active model → grade →
 * thesis → plan (entry zone · stop · T1-T3 R-ladder) → 1-click "Stage Setup
 * into Ticket" with exact position sizing (equity × risk% / |entry−stop|).
 *
 * Data: /api/cg/narrative (20s server cache; 30s poll). Every checklist row
 * shows the exact measured value — n/a rows mark unavailable feeds, never
 * invented passes. Classic instruments show the honest reduced checklist.
 */

interface AcctLite {
  ok: boolean;
  totalWalletBalance?: number;
}

interface PaperBookLite {
  ok: boolean;
  ticket: PaperBookTicketView | null;
  freshness?: { dataAt: number; ageMs: number; stale: boolean; source: string };
}

const PB_STATUS_STYLE: Record<string, string> = {
  ARMED: "bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/40",
  OPEN: "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/40",
  CLOSED: "bg-neutral-800 text-neutral-400 ring-1 ring-neutral-700",
};

const PB_OUTCOME_STYLE: Record<string, string> = {
  TP1: "text-emerald-300",
  TP2: "text-emerald-300",
  SL: "text-rose-300",
  BE: "text-neutral-300",
  TIME_STOP: "text-amber-300",
  FLIP_CLOSE: "text-amber-300",
  EXPIRED: "text-neutral-400",
  CANCELLED: "text-neutral-400",
};

function fmtRelTime(from: number | null | undefined, now: number): string {
  if (!from) return "–";
  const s = Math.max(0, Math.round((now - from) / 1000));
  if (s < 90) return `${s}s`;
  const m = Math.round(s / 60);
  if (m < 90) return `${m}m`;
  const h = Math.round(m / 60);
  if (h < 36) return `${h}h`;
  return `${Math.round(h / 24)}d`;
}

function fmtInTime(until: number | null | undefined, now: number): string {
  if (!until) return "–";
  const s = Math.max(0, Math.round((until - now) / 1000));
  if (s < 90) return `${s}s`;
  const m = Math.round(s / 60);
  if (m < 90) return `${m}m`;
  const h = Math.round(m / 60);
  if (h < 36) return `${h}h`;
  return `${Math.round(h / 24)}d`;
}

const MODEL_LABEL: Record<string, string> = {
  M1_TREND_PULLBACK: "M1 · Trend Pullback",
  M2_MEAN_REVERSION: "M2 · VWAP ±2σ Mean-Rev",
  WAIT_PULLBACK: "M1 · Wait for Pullback",
  WATCH_EXHAUSTION: "M2 · Watch Exhaustion",
  NO_TRADE: "No Trade",
};

const REGIME_STYLE: Record<string, string> = {
  TREND_UP: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/40",
  TREND_DOWN: "bg-rose-500/15 text-rose-300 ring-rose-500/40",
  RANGE_BALANCE: "bg-sky-500/15 text-sky-300 ring-sky-500/40",
  COMPRESSION_SQUEEZE: "bg-amber-500/15 text-amber-300 ring-amber-500/40",
};

const GRADE_STYLE: Record<string, string> = {
  "A+": "bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-400/60",
  A: "bg-emerald-500/10 text-emerald-300/90 ring-1 ring-emerald-500/30",
  B: "bg-amber-500/10 text-amber-300 ring-1 ring-amber-500/30",
  SKIP: "bg-neutral-800 text-neutral-400 ring-1 ring-neutral-700",
};

function fmtPx(v: number | null | undefined, decs = 2): string {
  return v == null || !Number.isFinite(v) ? "–" : v.toLocaleString("en-US", { minimumFractionDigits: decs, maximumFractionDigits: decs });
}

function fmtUsd(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "–";
  const abs = Math.abs(v);
  const s = v < 0 ? "-" : "";
  if (abs >= 1e9) return `${s}$${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${s}$${(abs / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${s}$${(abs / 1e3).toFixed(1)}k`;
  return `${s}$${abs.toFixed(2)}`;
}

/** horizontal 0-100% meter for the probability block */
function PMeter({ label, p, tone }: { label: string; p: number; tone?: "good" | "bad" }) {
  const pct = Math.round(p * 100);
  return (
    <div className="min-w-[128px] flex-1">
      <div className="flex items-baseline justify-between">
        <span className="text-[9px] uppercase tracking-wider text-neutral-500">{label}</span>
        <span className={`font-mono text-[11px] font-bold ${tone === "good" ? "text-emerald-300" : tone === "bad" ? "text-rose-300" : "text-neutral-100"}`}>{pct}%</span>
      </div>
      <div className="mt-0.5 h-1.5 overflow-hidden rounded bg-neutral-800">
        <div
          className={`h-full rounded ${tone === "good" ? "bg-emerald-400/80" : tone === "bad" ? "bg-rose-400/80" : "bg-sky-400/70"}`}
          style={{ width: `${Math.max(2, Math.min(100, pct))}%` }}
        />
      </div>
    </div>
  );
}

/** Probability block - the structural odds engine read on the quoted setup */
function ProbabilityBlock({ prob }: { prob: SetupProbability }) {
  const hasAny = prob.pFill != null || prob.pT1 != null || prob.pMeanRevert != null;
  if (!hasAny) return null;
  return (
    <div className="border-t border-neutral-800/70 px-4 py-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[9px] uppercase tracking-wider text-cyan-300/80">Probability - structural odds</span>
        {prob.horizonH != null && prob.pFill != null && prob.pFill < 1 && (
          <span className="font-mono text-[9px] text-neutral-600">
            over {prob.horizonH}h · sigma {prob.sigmaBar != null ? prob.sigmaBar.toPrecision(3) : "n/a"}/bar
          </span>
        )}
      </div>
      <div className="mt-1.5 flex flex-wrap gap-3">
        {prob.pFill != null && prob.pFill < 1 && <PMeter label={`P(fill zone <= ${prob.horizonH ?? "?"}h)`} p={prob.pFill} />}
        {prob.pT1 != null && <PMeter label="P(T1 first | fill)" p={prob.pT1} />}
        {prob.pWin != null && prob.pFill != null && prob.pFill < 1 && <PMeter label="P(fill + T1 first)" p={prob.pWin} />}
        {prob.pMeanRevert != null && <PMeter label="P(revert to 0-sigma VWAP)" p={prob.pMeanRevert} />}
        {prob.evR != null && (
          <div className="min-w-[86px]">
            <div className="text-[9px] uppercase tracking-wider text-neutral-500">EV (R units)</div>
            <div className={`font-mono text-sm font-bold ${prob.evR > 0 ? "text-emerald-300" : prob.evR < 0 ? "text-rose-300" : "text-neutral-300"}`}>
              {prob.evR > 0 ? "+" : ""}
              {prob.evR.toFixed(2)}R
            </div>
          </div>
        )}
      </div>
      {/* confluence factor chips - signed log-odds weights */}
      <div className="mt-1.5 flex flex-wrap gap-1">
        {prob.factors.map((f) => (
          <span
            key={f.key}
            title={`${f.label}: ${f.value}`}
            className={`rounded px-1.5 py-0.5 font-mono text-[9px] ${
              f.dir === 1 ? "bg-emerald-500/10 text-emerald-300/90" : f.dir === -1 ? "bg-rose-500/10 text-rose-300/90" : "bg-neutral-800/60 text-neutral-600"
            }`}
          >
            {f.dir === 1 ? "+" : f.dir === -1 ? "-" : "·"} {f.label.split(" ")[0]} {f.weight.toFixed(2)}
          </span>
        ))}
      </div>
      <div className="mt-1 font-mono text-[9px] leading-snug text-neutral-600">
        {prob.caveats[0] ?? ""}
        {prob.empirical
          ? ` · virtual book: ${prob.empirical.closed} closed · fill ${prob.empirical.fillRatePct ?? "-"}% · win ${prob.empirical.winRatePct ?? "-"}% · avg ${prob.empirical.avgR ?? "-"}R`
          : ""}
      </div>
    </div>
  );
}

export default function NarrativeCard({ sym }: { sym: string }) {
  const q = usePolling<NarrativeVerdict>(`/api/cg/narrative?sym=${encodeURIComponent(sym)}`, 30_000);
  const acct = usePolling<AcctLite>("/api/binance/account", 30_000);
  const pb = usePolling<PaperBookLite>(`/api/cg/paperbook?sym=${encodeURIComponent(sym)}`, 20_000);
  const v = q.data;
  const ticket = pb.data?.ticket ?? null;
  const [showDetail, setShowDetail] = useState(false);
  const [riskPct, setRiskPct] = useState(1);
  const [equity, setEquity] = useState<number | null>(null);
  const [staged, setStaged] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const stagedForSym = staged === sym;

  // 30 s clock for elapsed-time labels (one interval, cleaned up on unmount)
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const effEquity = equity ?? acct.data?.totalWalletBalance ?? null;

  const sizing = useMemo(() => {
    if (!v?.plan?.entryZone || v.plan.entryZone[0] == null || v.plan.stop == null) return null;
    const entryMid = (v.plan.entryZone[0] + v.plan.entryZone[1]) / 2;
    const riskPerUnit = Math.abs(entryMid - v.plan.stop);
    if (!(riskPerUnit > 0) || effEquity == null) return null;
    const riskUsd = (effEquity * riskPct) / 100;
    const qty = riskUsd / riskPerUnit;
    const notional = qty * entryMid;
    return { entryMid, riskPerUnit, riskUsd, qty, notional, margin10x: notional / 10 };
  }, [v, effEquity, riskPct]);

  const decs = useMemo(() => {
    const p = v?.plan?.entryZone?.[0] ?? v?.freshness?.dataAt;
    if (typeof p === "number" && p > 0) {
      if (p >= 1000) return 2;
      if (p >= 10) return 3;
      if (p >= 1) return 4;
      if (p >= 0.01) return 5;
      return 6;
    }
    return 2;
  }, [v]);

  const stageIntoTicket = () => {
    if (!v || !sizing || !v.plan.entryZone) return;
    window.dispatchEvent(
      new CustomEvent("cg-stage-setup", {
        detail: {
          sym: v.sym,
          side: v.direction === "SHORT" ? "SELL" : "BUY",
          price: Number(sizing.entryMid.toFixed(decs)),
          qty: Number(sizing.qty.toFixed(3)),
          stop: v.plan.stop,
          direction: v.direction,
        },
      })
    );
    setStaged(sym);
  };

  if (q.loading && !v) {
    return (
      <div className="rounded-xl border border-neutral-800 bg-[#11151a] p-4 text-[11px] text-neutral-500">
        computing trade narrative…
      </div>
    );
  }
  if (!v || v.ok !== true) {
    return (
      <div className="rounded-xl border border-dashed border-neutral-800 p-4 text-[11px] leading-relaxed text-neutral-500">
        trade narrative unavailable for {sym} — {v && "supported" in v && v.supported === false ? "no perp order-flow feeds for this instrument" : (q.error ?? "feed error")}.
      </div>
    );
  }
  if (v.supported === false) {
    return (
      <div className="rounded-xl border border-dashed border-neutral-800 p-4 text-[11px] leading-relaxed text-neutral-500">
        {v.regimeNote === "no market data" ? `no live market snapshot for ${sym}` : `narrative engine: ${v.thesis}`}
      </div>
    );
  }

  const dirStyle = v.direction === "LONG" ? "text-emerald-300" : v.direction === "SHORT" ? "text-rose-300" : "text-neutral-400";
  const passCount = v.checklist.filter((c) => c.pass === true).length;
  const naCount = v.checklist.filter((c) => c.pass === null).length;

  return (
    <div className="rounded-xl border border-neutral-800 bg-[#11151a]">
      {/* header row */}
      <div className="flex flex-wrap items-center gap-2 border-b border-neutral-800/70 px-4 py-3">
        <span className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ring-1 ${REGIME_STYLE[v.regime] ?? REGIME_STYLE.RANGE_BALANCE}`}>
          {v.regime.replace("_", " ")}
        </span>
        <span className="text-xs font-semibold text-neutral-200">{MODEL_LABEL[v.activeModel] ?? v.activeModel}</span>
        {v.direction !== "NEUTRAL" && (
          <span className={`font-mono text-xs font-bold ${dirStyle}`}>{v.direction}</span>
        )}
        <span className={`rounded px-1.5 py-0.5 font-mono text-[10px] font-bold ${GRADE_STYLE[v.grade] ?? GRADE_STYLE.SKIP}`}>{v.grade}</span>
        <span className="font-mono text-[10px] text-neutral-500">conf {v.confidence}/100</span>
        <span className="font-mono text-[10px] text-neutral-600">
          {v.checklist.length - naCount > 0 ? `${passCount}/${v.checklist.length - naCount} checks` : "checks n/a"} · age{" "}
          {(v.freshness.worstAgeMs / 1000).toFixed(0)}s
          {v.freshness.staleFields.length ? ` · STALE: ${v.freshness.staleFields.join(",")}` : ""}
        </span>
        <button
          type="button"
          onClick={() => setShowDetail((s) => !s)}
          className="ml-auto rounded border border-neutral-700 px-2 py-0.5 text-[10px] text-neutral-400 hover:border-neutral-500 hover:text-neutral-200"
        >
          {showDetail ? "hide" : "show"} checklist & math
        </button>
      </div>

      {/* thesis */}
      <div className="px-4 py-3 text-[12px] leading-relaxed text-neutral-300">{v.thesis}</div>

      {/* plan strip */}
      {v.plan.entryZone && (
        <div className="grid gap-2 px-4 pb-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border border-neutral-800/80 bg-[#0b0e11] px-3 py-2">
            <div className="text-[9px] uppercase tracking-wider text-neutral-500">Entry zone</div>
            <div className="font-mono text-xs text-neutral-100">
              {fmtPx(v.plan.entryZone[0], decs)} – {fmtPx(v.plan.entryZone[1], decs)}
            </div>
          </div>
          <div className="rounded-lg border border-neutral-800/80 bg-[#0b0e11] px-3 py-2">
            <div className="text-[9px] uppercase tracking-wider text-neutral-500">Stop / invalidation</div>
            <div className="font-mono text-xs text-rose-300">{fmtPx(v.plan.stop, decs)}</div>
            <div className="text-[9px] leading-tight text-neutral-600">{v.plan.invalidation}</div>
          </div>
          <div className="rounded-lg border border-neutral-800/80 bg-[#0b0e11] px-3 py-2">
            <div className="text-[9px] uppercase tracking-wider text-neutral-500">Targets (R ladder)</div>
            <div className="space-y-0.5 font-mono text-[10px]">
              {v.plan.targets.filter((t) => t.level != null).map((t) => (
                <div key={t.label} className="flex justify-between gap-2">
                  <span className="truncate text-neutral-400">{t.label}</span>
                  <span className="text-neutral-100">
                    {fmtPx(t.level, decs)}
                    {t.rMultiple != null && <span className="ml-1 text-emerald-300/80">{t.rMultiple.toFixed(1)}R</span>}
                  </span>
                </div>
              ))}
              {v.plan.targets.every((t) => t.level == null) && <span className="text-neutral-600">no measurable targets</span>}
            </div>
          </div>
          {/* position sizing */}
          <div className="rounded-lg border border-neutral-800/80 bg-[#0b0e11] px-3 py-2">
            <div className="flex items-center justify-between">
              <div className="text-[9px] uppercase tracking-wider text-neutral-500">Position sizing</div>
              <div className="flex items-center gap-1">
                {[0.5, 1, 2].map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRiskPct(r)}
                    className={`rounded px-1.5 py-0.5 font-mono text-[9px] ${riskPct === r ? "bg-emerald-500/20 text-emerald-300" : "bg-neutral-800 text-neutral-500 hover:text-neutral-300"}`}
                  >
                    {r}%
                  </button>
                ))}
              </div>
            </div>
            {sizing ? (
              <div className="space-y-0.5 font-mono text-[10px] tabular-nums">
                <div className="flex justify-between text-neutral-400">
                  <span>risk</span>
                  <span className="text-neutral-100">{fmtUsd(sizing.riskUsd)} @ {fmtPx(sizing.entryMid, decs)}</span>
                </div>
                <div className="flex justify-between text-neutral-400">
                  <span>size</span>
                  <span className="text-neutral-100">
                    {sizing.qty.toLocaleString("en-US", { maximumFractionDigits: 3 })} {v.sym}
                  </span>
                </div>
                <div className="flex justify-between text-neutral-400">
                  <span>notional / margin 10×</span>
                  <span className="text-neutral-100">
                    {fmtUsd(sizing.notional)} / {fmtUsd(sizing.margin10x)}
                  </span>
                </div>
              </div>
            ) : (
              <div className="text-[10px] text-neutral-600">
                {effEquity == null ? "add testnet keys for live equity sizing" : "no measurable entry/stop pair"}
              </div>
            )}
            {v.plan.bestR != null && (
              <div className="mt-1 font-mono text-[9px] text-neutral-500">bestR {v.plan.bestR.toFixed(2)} · min 1.5</div>
            )}
          </div>
        </div>
      )}

            {/* probability \u2014 structural odds for the quoted setup */}
      {v.probability && <ProbabilityBlock prob={v.probability} />}

{/* virtual book outcome — what this setup is doing as a paper trade */}
      {ticket && (
        <div className="border-t border-neutral-800/70 px-4 py-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[9px] uppercase tracking-wider text-fuchsia-300/80">Virtual book · paper outcome</span>
            <span className={`rounded px-1.5 py-0.5 font-mono text-[10px] font-bold ${PB_STATUS_STYLE[ticket.status] ?? PB_STATUS_STYLE.CLOSED}`}>
              {ticket.status === "CLOSED" ? ticket.outcome ?? "CLOSED" : ticket.status}
            </span>
            {ticket.totalR != null && (
              <span className={`font-mono text-xs font-bold ${ticket.totalR >= 0 ? "text-emerald-300" : "text-rose-300"}`}>
                {ticket.totalR >= 0 ? "+" : ""}
                {ticket.totalR.toFixed(2)}R
                {ticket.status === "OPEN" ? " live" : " final"}
              </span>
            )}
            {ticket.status === "CLOSED" && ticket.totalR == null && <span className="font-mono text-[10px] text-neutral-500">no fill</span>}
            <span className="font-mono text-[10px] text-neutral-500">
              {ticket.status === "ARMED"
                ? `waiting for fill · expires in ${fmtInTime(ticket.expiresAt, now)}`
                : ticket.status === "OPEN"
                  ? `filled ${fmtRelTime(ticket.filledAt, now)} ago · ${ticket.legs.length ? `${Math.round(ticket.remainingFrac * 100)}% still on` : "full size on"}`
                  : `closed ${fmtRelTime(ticket.closedAt, now)} ago · ${ticket.outcome ?? ""}`}
            </span>
            <button
              type="button"
              onClick={() => window.dispatchEvent(new CustomEvent("cg-open-desk"))}
              className="ml-auto rounded border border-fuchsia-500/30 px-2 py-0.5 text-[10px] text-fuchsia-300/90 hover:border-fuchsia-400/60 hover:text-fuchsia-200"
              title="Open the Desk view with the full Virtual Book"
            >
              Open Paper Book →
            </button>
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[10px] tabular-nums text-neutral-400">
            {ticket.status !== "ARMED" && ticket.filledPrice != null && (
              <span>
                entry <span className="text-neutral-100">{fmtPx(ticket.filledPrice, decs)}</span>
                {ticket.lastMark != null && (
                  <>
                    {" → mark "}
                    <span className={ticket.lastMark >= ticket.filledPrice ? "text-emerald-300" : "text-rose-300"}>{fmtPx(ticket.lastMark, decs)}</span>
                  </>
                )}
              </span>
            )}
            {ticket.status === "ARMED" && (
              <span>
                zone <span className="text-neutral-100">{fmtPx(ticket.entryZone[0], decs)} – {fmtPx(ticket.entryZone[1], decs)}</span>
              </span>
            )}
            <span>
              stop <span className="text-rose-300">{fmtPx(ticket.stop, decs)}</span>
              {ticket.stopAtBe && <span className="ml-1 text-[9px] uppercase text-emerald-400/80">(BE)</span>}
            </span>
            {ticket.targets.filter((t) => t.level != null).map((t, i) => (
              <span key={i} className={t.hitAt != null ? "text-emerald-300" : ""}>
                {t.hitAt != null ? "✓" : "·"} T{i + 1} {fmtPx(t.level, decs)}
                {t.rMultiple != null && <span className="text-neutral-500"> {t.rMultiple.toFixed(1)}R</span>}
              </span>
            ))}
            <span>
              MFE <span className="text-emerald-300/80">+{ticket.mfeR.toFixed(2)}R</span> · MAE{" "}
              <span className="text-rose-300/80">{ticket.maeR.toFixed(2)}R</span>
            </span>
            {ticket.legs.length > 0 && (
              <span>
                booked: {ticket.legs.map((l) => `${Math.round(l.frac * 100)}% @ ${l.r >= 0 ? "+" : ""}${l.r.toFixed(2)}R`).join(" · ")}
              </span>
            )}
            {ticket.status === "CLOSED" && ticket.outcome && (
              <span className={PB_OUTCOME_STYLE[ticket.outcome] ?? "text-neutral-400"}>outcome {ticket.outcome}</span>
            )}
          </div>
        </div>
      )}

      {/* trigger + stage button */}
      {v.plan.entryZone && (
        <div className="flex flex-wrap items-center gap-3 border-t border-neutral-800/70 px-4 py-2.5">
          <span className="text-[10px] leading-snug text-neutral-500">
            <span className="font-semibold text-neutral-400">Trigger:</span> {v.plan.triggerRule}
          </span>
          <button
            type="button"
            disabled={!sizing}
            onClick={stageIntoTicket}
            className={`ml-auto rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
              sizing
                ? "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/40 hover:bg-emerald-500/25"
                : "cursor-not-allowed bg-neutral-800 text-neutral-600"
            }`}
            title="Fill the execution ticket with entry/stop/size"
          >
            {stagedForSym ? "✓ staged — see ticket below" : "Stage Setup into Ticket →"}
          </button>
        </div>
      )}

      {/* vetoes */}
      {v.plan.vetoes.length > 0 && (
        <div className="border-t border-neutral-800/70 px-4 py-2">
          <div className="text-[9px] uppercase tracking-wider text-rose-400/80">Vetoes</div>
          <ul className="mt-0.5 space-y-0.5">
            {v.plan.vetoes.map((x) => (
              <li key={x} className="text-[10px] leading-snug text-rose-300/80">
                ⛔ {x}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* collapsible: checklist + model notes + beta */}
      {showDetail && (
        <div className="space-y-3 border-t border-neutral-800/70 px-4 py-3">
          <div>
            <div className="mb-1 text-[9px] uppercase tracking-wider text-neutral-500">
              Checklist — exact measured values ({naCount} n/a)
            </div>
            <div className="grid gap-1 md:grid-cols-2">
              {v.checklist.map((c) => (
                <div
                  key={c.key}
                  className={`flex items-start justify-between gap-2 rounded border px-2 py-1 ${
                    c.pass === true
                      ? "border-emerald-800/40 bg-emerald-950/20"
                      : c.pass === false
                        ? "border-rose-800/40 bg-rose-950/20"
                        : "border-neutral-800 bg-neutral-900/30"
                  }`}
                >
                  <span className="text-[10px] font-medium text-neutral-300">
                    {c.pass === true ? "✓" : c.pass === false ? "✗" : "–"} {c.label}
                  </span>
                  <span className="shrink-0 font-mono text-[10px] text-neutral-400">{c.value}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            {v.m1 && (
              <div className="rounded border border-neutral-800 bg-[#0b0e11] px-2 py-1.5">
                <div className="text-[9px] uppercase tracking-wider text-neutral-500">Model 1 — trend pullback</div>
                <div className="text-[10px] text-neutral-300">
                  <span className="font-mono font-semibold text-neutral-200">{v.m1.status}</span> — {v.m1.note}
                </div>
              </div>
            )}
            {v.m2 && (
              <div className="rounded border border-neutral-800 bg-[#0b0e11] px-2 py-1.5">
                <div className="text-[9px] uppercase tracking-wider text-neutral-500">Model 2 — ±2σ mean reversion</div>
                <div className="text-[10px] text-neutral-300">
                  <span className="font-mono font-semibold text-neutral-200">{v.m2.status}</span> — {v.m2.note}
                </div>
              </div>
            )}
          </div>
          {v.beta.length > 0 && (
            <div className="font-mono text-[10px] text-neutral-500">
              rolling beta —{" "}
              {v.beta
                .map((b) => `vs ${b.vs}: 24h ${b.b24h != null ? b.b24h.toFixed(2) : "–"} / 7d ${b.b7d != null ? b.b7d.toFixed(2) : "–"}`)
                .join(" · ")}
            </div>
          )}
          <div className="font-mono text-[9px] text-neutral-600">
            source {v.freshness.source} · regime {v.regimeNote} · generated {new Date(v.generatedAt).toLocaleTimeString("en-US")}
          </div>
        </div>
      )}
    </div>
  );
}
