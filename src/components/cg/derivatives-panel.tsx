"use client";

import { usePolling } from "./use-cg-data";

/**
 * DerivativesPanel — the institutional add-ons for Tier-3 instruments
 * (2026-11-11 user directive: "more resources like CME... better trade
 * formulation"). Three live-verified sources, each hidden honestly when the
 * instrument has no mapping (400):
 *   1. /api/cg/perpdepth — Coinglass perp coverage (SP500/JP225/WTI-CL/Brent/
 *      NatGas/FX perps): venue table, OI ±1h/4h/24h, funding, taker flow
 *   2. /api/cot          — CFTC Commitments of Traders: large-spec net,
 *      3y z-score, weekly change, 18-month history sparkline
 *   3. /api/cnbc         — front-month futures reference (settle, OI, roll)
 */

interface PerpDepthResp {
  ok: boolean;
  sym?: string;
  liquidity?: string;
  note?: string | null;
  lead?: { venue: string; key: string; close: number | null; vol24h: number | null };
  oi?: { last: number | null; d1h: number | null; d4h: number | null; d24h: number | null };
  oiSeries?: { t: number; c: number | null }[];
  venues?: { id: string; key: string; close: number | null; vol24h: number | null; lead?: boolean; stale?: boolean }[];
  funding?: { sym: string; venues: { exchange: string; ratePct: number | null; intervalH: number | null }[] } | null;
  takerFlow15mUsd?: number | null;
  flowVenue?: string | null;
  unavailable?: string;
  error?: string;
}

interface CotResp {
  ok: boolean;
  sym?: string;
  contract?: string;
  asOf?: string;
  openInterest?: number | null;
  noncomm?: {
    long: number | null;
    short: number | null;
    net: number | null;
    netPrev: number | null;
    netChgWk: number | null;
    pctOILong: number | null;
    pctOIShort: number | null;
  };
  commercial?: { net: number | null };
  z3y?: number | null;
  zNote?: string | null;
  history?: { date: string; net: number }[];
  error?: string;
}

interface CnbcResp {
  ok: boolean;
  quotes?: Record<string, { ok: boolean; name?: string | null; last?: number | null; changePct?: number | null; settle?: number | null; openInterest?: number | null; activeContract?: string | null; expiry?: string | null; isFuture?: boolean; lastTime?: string | null }>;
  error?: string;
}

function fmtInt(v: number | null | undefined): string {
  if (null == v || !Number.isFinite(v)) return "–";
  return Math.round(v).toLocaleString("en-US");
}

function fmtSigned(v: number | null | undefined, decs = 0): string {
  if (null == v || !Number.isFinite(v)) return "–";
  const s = Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: decs, maximumFractionDigits: decs });
  return (v > 0 ? "+" : v < 0 ? "−" : "") + s;
}

function fmtUsd(v: number | null | undefined): string {
  if (null == v || !Number.isFinite(v)) return "–";
  const a = Math.abs(v);
  if (a >= 1e9) return `${(v / 1e9).toFixed(2)}B`;
  if (a >= 1e6) return `${(v / 1e6).toFixed(2)}M`;
  if (a >= 1e3) return `${(v / 1e3).toFixed(1)}K`;
  return v.toFixed(0);
}

function Spark({ points, color = "#34d399", height = 40 }: { points: number[]; color?: string; height?: number }) {
  if (points.length < 2) return <div className="h-10" />;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const w = 200;
  const path = points
    .map((p, i) => `${(i / (points.length - 1)) * w},${height - ((p - min) / span) * (height - 4) - 2}`)
    .join(" ");
  const zeroY = min <= 0 && max >= 0 ? height - ((0 - min) / span) * (height - 4) - 2 : null;
  return (
    <svg viewBox={`0 0 ${w} ${height}`} className="w-full" preserveAspectRatio="none">
      {zeroY != null && <line x1="0" y1={zeroY} x2={w} y2={zeroY} stroke="#525252" strokeWidth="0.5" strokeDasharray="2 2" />}
      <polyline points={path} fill="none" stroke={color} strokeWidth="1.5" />
    </svg>
  );
}

function Delta({ v, suffix = "%" }: { v: number | null | undefined; suffix?: string }) {
  if (null == v || !Number.isFinite(v)) return <span className="text-neutral-600">–</span>;
  return <span className={v > 0 ? "text-emerald-400" : v < 0 ? "text-rose-400" : "text-neutral-400"}>{fmtSigned(v, 2)}{suffix}</span>;
}

export default function DerivativesPanel({ sym, cashPrice }: { sym: string; cashPrice: number | null }) {
  const depthQ = usePolling<PerpDepthResp>(`/api/cg/perpdepth?sym=${sym}`, 60_000);
  const cotQ = usePolling<CotResp>(`/api/cg/cot?sym=${sym}`, 6 * 60 * 60_000);
  const cnbcQ = usePolling<CnbcResp>(`/api/cg/cnbc?syms=${sym}`, 60_000);

  const depth = depthQ.data && depthQ.data.sym === sym ? depthQ.data : null;
  const cot = cotQ.data && cotQ.data.sym === sym ? cotQ.data : null;
  const cnbc = cnbcQ.data?.quotes?.[sym] ?? null;
  const hasAny = (depth && !depthQ.error) || (cot && !cotQ.error) || (cnbc && cnbc.ok);
  if (!hasAny) return null;

  const cotHist = [...(cot?.history ?? [])].reverse().map((h) => h.net);
  const oiSeries = (depth?.oiSeries ?? []).map((p) => p.c).filter((c): c is number => c != null);
  const cotNet = cot?.noncomm?.net ?? null;
  const cotZ = cot?.z3y ?? null;

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {/* ---- 1. perp market depth ---- */}
      {depth && (
        <div className="rounded-lg border border-neutral-800 bg-[#11151a] p-4">
          <div className="mb-3 flex items-baseline justify-between">
            <div className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Perp market depth</div>
            <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${depth.liquidity === "real" ? "bg-emerald-500/15 text-emerald-400" : "bg-amber-500/15 text-amber-400"}`}>
              {depth.liquidity === "real" ? "REAL LIQUIDITY" : "THIN — watchlist"}
            </span>
          </div>
          <div className="space-y-1 font-mono text-xs tabular-nums">
            {(depth.venues ?? []).map((v) => (
              <div key={v.key} className={`flex items-baseline justify-between rounded px-2 py-1 ${v.lead ? "bg-neutral-800/60" : ""}`}>
                <span className={v.lead ? "font-bold text-neutral-100" : "text-neutral-400"}>
                  {v.lead ? "★ " : ""}{v.id}
                </span>
                <span className="text-neutral-300">{v.close != null ? v.close.toLocaleString("en-US") : "–"}</span>
                <span className="text-neutral-500">{v.vol24h != null ? `vol ${fmtUsd(v.vol24h)}` : v.stale ? "stale" : "–"}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 border-t border-neutral-800 pt-2 font-mono text-[11px] tabular-nums">
            <div className="flex justify-between">
              <span className="text-neutral-500">open interest (lead)</span>
              <span className="text-neutral-200">{fmtInt(depth.oi?.last)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-500">Δ OI 1h / 4h / 24h</span>
              <span>
                <Delta v={depth.oi?.d1h} /> / <Delta v={depth.oi?.d4h} /> / <Delta v={depth.oi?.d24h} />
              </span>
            </div>
            {oiSeries.length > 2 && <Spark points={oiSeries} color="#38bdf8" />}
            {depth.takerFlow15mUsd != null && (
              <div className="flex justify-between">
                <span className="text-neutral-500">taker flow 15m ({depth.flowVenue})</span>
                <Delta v={depth.takerFlow15mUsd} suffix=" USD" />
              </div>
            )}
            {depth.funding && (
              <div className="mt-1 flex flex-wrap gap-1">
                {depth.funding.venues.map((f) => (
                  <span key={f.exchange} className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${(f.ratePct ?? 0) > 0 ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"}`}>
                    {f.exchange} {fmtSigned(f.ratePct, 4)}%/{f.intervalH ?? "?"}h
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className="mt-2 text-[10px] leading-relaxed text-neutral-600">
            n/a upstream: {depth.unavailable}
            {depth.note ? ` · ${depth.note}` : ""}
          </div>
        </div>
      )}

      {/* ---- 2. COT positioning ---- */}
      {cot && cotNet != null && (
        <div className="rounded-lg border border-neutral-800 bg-[#11151a] p-4">
          <div className="mb-3 flex items-baseline justify-between">
            <div className="text-xs font-semibold uppercase tracking-wider text-neutral-400">CFTC COT positioning</div>
            <span className="text-[10px] text-neutral-600">as of {cot.asOf}</span>
          </div>
          <div className="font-mono text-xs tabular-nums">
            <div className="flex justify-between rounded bg-neutral-800 px-2 py-1">
              <span className="text-neutral-500">large-spec net</span>
              <span className={`font-bold ${(cotNet) > 0 ? "text-emerald-400" : "text-rose-400"}`}>{fmtSigned(cotNet)}</span>
            </div>
            <div className="mt-1 flex justify-between px-2 py-0.5">
              <span className="text-neutral-500">weekly change</span>
              <Delta v={cot?.noncomm?.netChgWk ?? null} suffix="" />
            </div>
            <div className="flex justify-between px-2 py-0.5">
              <span className="text-neutral-500">commercial (hedger) net</span>
              <span className={(cot?.commercial?.net ?? 0) > 0 ? "text-emerald-400" : "text-rose-400"}>{fmtSigned(cot?.commercial?.net ?? null)}</span>
            </div>
            <div className="flex justify-between px-2 py-0.5">
              <span className="text-neutral-500">contract OI</span>
              <span className="text-neutral-300">{fmtInt(cot?.openInterest)}</span>
            </div>
            <div className="flex justify-between px-2 py-0.5">
              <span className="text-neutral-500">spec %OI L/S</span>
              <span className="text-neutral-300">{cot?.noncomm?.pctOILong ?? "–"}% / {cot?.noncomm?.pctOIShort ?? "–"}%</span>
            </div>
            <div className="mt-1 flex items-baseline justify-between rounded border border-neutral-800 px-2 py-1">
              <span className="text-neutral-500">3y z-score</span>
              <span className={`text-base font-bold ${cotZ == null ? "text-neutral-600" : Math.abs(cotZ) >= 2 ? (cotZ > 0 ? "text-amber-400" : "text-sky-400") : "text-neutral-200"}`}>
                {cotZ == null ? "–" : fmtSigned(cotZ, 2) + "σ"}
              </span>
            </div>
            {cotHist.length > 2 && <Spark points={cotHist} color={cotNet > 0 ? "#34d399" : "#fb7185"} height={44} />}
          </div>
          <div className="mt-2 text-[10px] leading-relaxed text-neutral-600">
            {cot.contract} (CFTC Legacy Futures-Only, weekly) · |z|≥2 = positioning extreme — contrarian fade / squeeze
            risk. {cot.zNote ?? ""}
          </div>
        </div>
      )}

      {/* ---- 3. CNBC futures reference ---- */}
      {cnbc && cnbc.ok && (
        <div className="rounded-lg border border-neutral-800 bg-[#11151a] p-4">
          <div className="mb-3 flex items-baseline justify-between">
            <div className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
              {cnbc.isFuture ? "Front-month futures" : "CNBC reference"}
            </div>
            <span className="text-[10px] text-neutral-600">{cnbc.activeContract ?? ""}</span>
          </div>
          <div className="space-y-1 font-mono text-xs tabular-nums">
            <div className="flex justify-between">
              <span className="text-neutral-500">{cnbc.isFuture ? "futures last" : "last"}</span>
              <span className="font-bold text-neutral-100">{cnbc.last?.toLocaleString("en-US") ?? "–"}</span>
            </div>
            {cnbc.isFuture && (
              <>
                <div className="flex justify-between">
                  <span className="text-neutral-500">settle</span>
                  <span className="text-neutral-300">{cnbc.settle?.toLocaleString("en-US") ?? "–"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500">open interest</span>
                  <span className="text-neutral-300">{fmtInt(cnbc.openInterest)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500">expiry / roll</span>
                  <span className="text-neutral-300">{cnbc.expiry ?? "–"}</span>
                </div>
              </>
            )}
            <div className="flex justify-between">
              <span className="text-neutral-500">change</span>
              <Delta v={cnbc.changePct} />
            </div>
            {cashPrice != null && cnbc.last != null && (
              <div className="flex justify-between border-t border-neutral-800 pt-1">
                <span className="text-neutral-500">futures − cash basis</span>
                <Delta v={((cnbc.last - cashPrice) / cashPrice) * 100} />
              </div>
            )}
          </div>
          <div className="mt-2 text-[10px] leading-relaxed text-neutral-600">
            {cnbc.name} · CNBC quote webservice (unofficial, ~5s cache){cnbc.lastTime ? ` · updated ${cnbc.lastTime}` : ""}
          </div>
        </div>
      )}
    </div>
  );
}
