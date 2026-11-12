import { NextRequest, NextResponse } from "next/server";
import { anyTerminalSym, gateReject, knownSym } from "@/lib/cg/sym-gate";
import { resolveCgSym } from "@/lib/binance/aliases";

export const dynamic = "force-dynamic";

/**
 * GET /api/cg/options?sym=BTC
 *
 * Deribit public options analytics (BTC + ETH only — this terminal lists
 * Deribit option data for those two currencies; everything else gets an
 * honest supported:false). All inputs are real Deribit payloads; the only
 * derived numbers are closed-form Black-Scholes gammas computed from real
 * mark_iv / underlying_price / time-to-expiry (the book-summary rows carry
 * no greeks — verified live) and the approximated 25-delta risk reversal.
 *
 *   a) DVOL index (60 s cache)   — /public/get_volatility_index_data, 24h of
 *      hourly points; dvol = latest close, changePct24h vs the ~24h-ago point.
 *   b) Full option chain (120 s cache) — /public/get_book_summary_by_currency
 *      (kind=option, expired=false). Instrument names "BTC-27NOV26-90000-C"
 *      carry expiry / strike / type; options expire 08:00 UTC.
 *   c) ATM IV term structure (7d/30d/90d), 25-delta risk reversal, max pain
 *      (nearest 3 monthly expiries), top call/put OI walls, dealer net gamma
 *      (GEX) regime, put/call OI + volume ratios.
 *
 * Any Deribit failure nulls its section with a reason — the route never
 * throws and never fabricates numbers.
 */

const DERIBIT = "https://www.deribit.com/api/v2";
const OPTIONS_CURRENCIES = new Set(["BTC", "ETH"]);
const DVOL_TTL_MS = 60_000;
const CHAIN_TTL_MS = 120_000;
const YEAR_MS = 365 * 24 * 3_600_000;
const SQRT_2PI = Math.sqrt(2 * Math.PI);

// ───────────────────────── local TTL cache + coalescing ─────────────────────

interface FetchPayload<T> {
  data: T;
  dataAt: number;
}

interface CacheEntry {
  at: number;
  dataAt: number;
  data: unknown;
}

const g = globalThis as unknown as {
  __optionsRouteCache?: Map<string, CacheEntry>;
  __optionsRouteInflight?: Map<string, Promise<FetchPayload<unknown> | null>>;
};
const cache = (g.__optionsRouteCache ??= new Map());
const inflight = (g.__optionsRouteInflight ??= new Map());

async function cachedUpstream<T>(
  key: string,
  ttlMs: number,
  fetcher: () => Promise<FetchPayload<T>>
): Promise<FetchPayload<T> | null> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < ttlMs) {
    return { data: hit.data as T, dataAt: hit.dataAt };
  }
  const running = inflight.get(key);
  if (running) return (await running) as FetchPayload<T> | null;
  const p = (async (): Promise<FetchPayload<unknown> | null> => {
    try {
      const r = await fetcher();
      if (cache.size > 64) {
        const oldest = cache.keys().next().value;
        if (oldest) cache.delete(oldest);
      }
      cache.set(key, { at: Date.now(), dataAt: r.dataAt, data: r.data });
      return r as FetchPayload<unknown>;
    } catch {
      return null; // never cache failures
    } finally {
      inflight.delete(key);
    }
  })();
  inflight.set(key, p);
  return p as unknown as FetchPayload<T> | null;
}

// ───────────────────────────── upstream shapes ──────────────────────────────

interface DeribitEnvelope<T> {
  jsonrpc?: string;
  result?: T;
  error?: { code?: number; message?: string };
}

async function deribitGet<T>(pathAndQuery: string, timeoutMs: number): Promise<T> {
  const res = await fetch(`${DERIBIT}${pathAndQuery}`, {
    cache: "no-store",
    signal: AbortSignal.timeout(timeoutMs),
    headers: { accept: "application/json" },
  });
  if (!res.ok) throw new Error(`deribit HTTP ${res.status}`);
  const body = (await res.json().catch(() => null)) as DeribitEnvelope<T> | null;
  if (!body || typeof body !== "object") throw new Error("deribit non-JSON");
  if (body.error) throw new Error(`deribit error ${body.error.code ?? "?"}: ${body.error.message ?? ""}`);
  if (body.result === undefined) throw new Error("deribit missing result");
  return body.result;
}

interface DeribitOptionRow {
  instrument_name?: string;
  mark_iv?: number | null;
  underlying_price?: number | null;
  open_interest?: number;
  volume_usd?: number;
  creation_timestamp?: number;
  /** absent in book-summary rows (verified live) — kept for forward compat */
  delta?: number | null;
  gamma?: number | null;
}

interface DvolPoint {
  ts: number;
  close: number;
}

// ───────────────────────────── parsed chain ─────────────────────────────────

const MONTHS: Record<string, number> = {
  JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5,
  JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11,
};

function parseInstrument(
  name: string
): { expiry: string; expTs: number; strike: number; type: "C" | "P" } | null {
  const parts = name.split("-");
  if (parts.length !== 4) return null;
  const exp = parts[1] ?? "";
  const strike = Number(parts[2]);
  const type = parts[3];
  const m = /^(\d{1,2})([A-Z]{3})(\d{2})$/.exec(exp);
  if (!m) return null;
  const monthIdx = MONTHS[m[2] ?? ""];
  if (monthIdx === undefined) return null;
  if ((type !== "C" && type !== "P") || !Number.isFinite(strike) || strike <= 0) return null;
  // Deribit options expire 08:00 UTC on the expiry date.
  const expTs = Date.UTC(2000 + Number(m[3]), monthIdx, Number(m[1]), 8, 0, 0);
  return { expiry: exp, expTs, strike, type };
}

interface OptLeg {
  expiry: string;
  expTs: number;
  strike: number;
  type: "C" | "P";
  markIv: number | null;
  oi: number;
  volUsd: number;
  und: number;
  delta: number | null;
  gamma: number | null;
}

/** Black-Scholes gamma with r = 0, q = 0 (real inputs, closed-form math). */
function bsGamma(s: number, k: number, ivPct: number, tYears: number): number | null {
  if (!(s > 0) || !(k > 0) || !(tYears > 0)) return null;
  const sigma = ivPct / 100;
  if (!(sigma > 0)) return null;
  const sqT = Math.sqrt(tYears);
  const d1 = (Math.log(s / k) + 0.5 * sigma * sigma * tYears) / (sigma * sqT);
  return Math.exp(-0.5 * d1 * d1) / (SQRT_2PI * s * sigma * sqT);
}

/** Deribit monthly options expire on the last Friday of the month. */
function isLastFriday(ts: number): boolean {
  const d = new Date(ts);
  if (d.getUTCDay() !== 5) return false;
  return new Date(ts + 7 * 86_400_000).getUTCMonth() !== d.getUTCMonth();
}

function pickAtmLeg(rows: OptLeg[], side: "C" | "P"): OptLeg | null {
  let best: OptLeg | null = null;
  let bestD = Infinity;
  for (const r of rows) {
    if (r.type !== side || r.markIv == null || !(r.und > 0)) continue;
    const d = Math.abs(r.strike / r.und - 1);
    if (d < bestD) {
      bestD = d;
      best = r;
    }
  }
  return best;
}

function telemetryOf(stamps: number[], source: string): {
  dataAt: number | null;
  ageMs: number | null;
  stale: boolean;
  source: string;
} {
  const dataAt = stamps.length > 0 ? Math.min(...stamps) : null;
  const ageMs = dataAt != null ? Date.now() - dataAt : null;
  return { dataAt, ageMs, stale: ageMs != null ? ageMs > 60_000 : false, source };
}

// ─────────────────────────────────── route ──────────────────────────────────

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const sym = (sp.get("sym") ?? "BTC").trim().toUpperCase();

  if (!(await anyTerminalSym(sym))) {
    return NextResponse.json({ ok: false, error: gateReject(sym) }, { status: 400 });
  }
  if (!(await knownSym(sym))) {
    return NextResponse.json({
      ok: true,
      supported: false,
      sym,
      reason: `classic instrument ${sym} has no options data`,
      notes: [],
      ...telemetryOf([], "none"),
    });
  }

  const cgSym = resolveCgSym(sym);
  if (!OPTIONS_CURRENCIES.has(cgSym)) {
    return NextResponse.json({
      ok: true,
      supported: false,
      sym,
      reason: "Deribit lists options only for BTC/ETH on this terminal",
      notes: [],
      ...telemetryOf([], "none"),
    });
  }

  try {
    const notes: string[] = [];

    // ── fetch both payloads concurrently (each may fail independently) ──

    const dvolP = cachedUpstream<DvolPoint[]>(`options:dvol:${cgSym}`, DVOL_TTL_MS, async () => {
      const end = Date.now();
      const start = end - 86_400_000;
      // NOTE: result is { data: [[ts,o,h,l,c],...] } (object-wrapped array —
      // verified live); tolerate a bare array too in case Deribit changes.
      const res = await deribitGet<{ data?: unknown[][] } | unknown[][]>(
        `/public/get_volatility_index_data?currency=${cgSym}&start_timestamp=${start}&end_timestamp=${end}&resolution=3600`,
        10_000
      );
      const rows = Array.isArray(res) ? res : Array.isArray(res?.data) ? (res as { data: unknown[][] }).data : [];
      const pts = rows
        .map((r) => ({ ts: Number(r?.[0]), close: Number(r?.[4]) }))
        .filter((p) => Number.isFinite(p.ts) && p.ts > 0 && Number.isFinite(p.close) && p.close > 0)
        .sort((a, b) => a.ts - b.ts);
      if (pts.length === 0) throw new Error("empty DVOL series");
      // Hourly candles are stamped at hour START and the forming candle's
      // close updates live (verified: value moved between two fetches inside
      // the same hour) — so data-as-of is the hour end, clamped to now.
      const windowEnd = pts[pts.length - 1].ts + 3_600_000;
      return { data: pts, dataAt: Math.min(windowEnd, Date.now()) };
    });

    const chainP = cachedUpstream<DeribitOptionRow[]>(
      `options:chain:${cgSym}`,
      CHAIN_TTL_MS,
      async () => {
        const rows = await deribitGet<DeribitOptionRow[]>(
          `/public/get_book_summary_by_currency?currency=${cgSym}&kind=option&expired=false`,
          15_000
        );
        if (!Array.isArray(rows) || rows.length === 0) throw new Error("empty option chain");
        const cts = rows
          .map((r) => Number(r?.creation_timestamp ?? 0))
          .filter((t) => Number.isFinite(t) && t > 0);
        return { data: rows, dataAt: cts.length > 0 ? Math.min(...cts) : Date.now() };
      }
    );

    const [dvol, chain] = await Promise.all([dvolP, chainP]);

    // ── DVOL ──

    let dvolOut: { value: number; changePct24h: number | null } | null = null;
    if (dvol) {
      const pts = dvol.data;
      const last = pts[pts.length - 1];
      const first = pts[0];
      dvolOut = {
        value: Number(last.close.toFixed(2)),
        changePct24h:
          pts.length >= 2 && first.close > 0
            ? Number((((last.close - first.close) / first.close) * 100).toFixed(2))
            : null,
      };
    } else {
      notes.push("dvol unavailable (Deribit get_volatility_index_data failed)");
    }

    // ── option chain analytics ──

    const termStructure: Record<"7d" | "30d" | "90d", number | null> = {
      "7d": null,
      "30d": null,
      "90d": null,
    };
    let riskReversal25d: {
      value: number | null;
      method: "delta-match" | "approx-strikes" | null;
      expiry: string | null;
      reason?: string;
    } | null = null;
    let riskReversalReason: string | undefined;
    const maxPain: { expiry: string; strike: number }[] = [];
    let oiWalls: {
      expiry: string;
      calls: { strike: number; oi: number; oiUsd: number }[];
      puts: { strike: number; oi: number; oiUsd: number }[];
    } | null = null;
    let gex: {
      netGexUsd: number;
      netGexUsdPer1Pct: number | null;
      regime: "POSITIVE_PIN" | "NEGATIVE_GAMMA_EXPANSION";
      spot: number | null;
      legsCounted: number;
    } | null = null;
    const putCallRatio: { oi: number | null; vol24h: number | null } = { oi: null, vol24h: null };

    if (chain) {
      const now = Date.now();

      // parse every row once
      const legs: OptLeg[] = [];
      for (const r of chain.data) {
        const p = parseInstrument(String(r?.instrument_name ?? ""));
        if (!p) continue;
        const und = Number(r?.underlying_price);
        const markIv = typeof r?.mark_iv === "number" && r.mark_iv > 0 ? r.mark_iv : null;
        legs.push({
          ...p,
          markIv,
          oi: typeof r?.open_interest === "number" && Number.isFinite(r.open_interest) ? r.open_interest : 0,
          volUsd:
            typeof r?.volume_usd === "number" && Number.isFinite(r.volume_usd) ? r.volume_usd : 0,
          und: Number.isFinite(und) && und > 0 ? und : 0,
          delta: typeof r?.delta === "number" && Number.isFinite(r.delta) && r.delta !== 0 ? r.delta : null,
          gamma: typeof r?.gamma === "number" && Number.isFinite(r.gamma) && r.gamma !== 0 ? r.gamma : null,
        });
      }

      // expiry list (name -> ts, ascending, only unexpired)
      const expiryTs = new Map<string, number>();
      for (const l of legs) if (!expiryTs.has(l.expiry)) expiryTs.set(l.expiry, l.expTs);
      const futureExpiries = [...expiryTs.entries()]
        .filter(([, ts]) => ts > now)
        .sort((a, b) => a[1] - b[1]);

      // per-expiry helpers
      const legsOf = (exp: string) => legs.filter((l) => l.expiry === exp);
      const undOf = (exp: string): number => {
        const withUnd = legsOf(exp).filter((l) => l.und > 0);
        return withUnd.length > 0 ? withUnd[0].und : 0;
      };
      const totalOiOf = (exp: string): number =>
        legsOf(exp).reduce((a, l) => a + l.oi, 0);

      // (c1) ATM IV term structure — nearest expiry beyond each horizon
      const horizons = [
        ["7d", 7 * 86_400_000],
        ["30d", 30 * 86_400_000],
        ["90d", 90 * 86_400_000],
      ] as const;
      const expiryBeyond = (ms: number): string | null => {
        for (const [name, ts] of futureExpiries) {
          if (ts - now >= ms) return name;
        }
        return null;
      };
      const atmIvOf = (exp: string): number | null => {
        const rows = legsOf(exp).filter((l) => l.markIv != null);
        const call = pickAtmLeg(rows, "C");
        const put = pickAtmLeg(rows, "P");
        if (!call || !put || call.markIv == null || put.markIv == null) return null;
        return Number(((call.markIv + put.markIv) / 2).toFixed(2));
      };
      for (const [h, ms] of horizons) {
        const exp = expiryBeyond(ms);
        termStructure[h] = exp ? atmIvOf(exp) : null;
      }

      // (c2) 25-delta risk reversal on the ~30d expiry
      const rrExpiry = expiryBeyond(30 * 86_400_000);
      if (!rrExpiry) {
        riskReversalReason = "no Deribit expiry beyond the 30d horizon";
      } else {
        const rows = legsOf(rrExpiry).filter((l) => l.markIv != null && l.und > 0);
        const anyDelta = rows.some((l) => l.delta != null);
        if (rows.length === 0) {
          riskReversalReason = `no priced options on the ${rrExpiry} expiry`;
        } else if (anyDelta) {
          let call: OptLeg | null = null;
          let put: OptLeg | null = null;
          let dc = Infinity;
          let dp = Infinity;
          for (const l of rows) {
            if (l.delta == null) continue;
            if (l.type === "C") {
              const d = Math.abs(l.delta - 0.25);
              if (d < dc) {
                dc = d;
                call = l;
              }
            } else {
              const d = Math.abs(l.delta + 0.25);
              if (d < dp) {
                dp = d;
                put = l;
              }
            }
          }
          if (call && put && call.markIv != null && put.markIv != null) {
            riskReversal25d = {
              value: Number((call.markIv - put.markIv).toFixed(2)),
              method: "delta-match",
              expiry: rrExpiry,
            };
          } else {
            riskReversalReason = "no 25-delta call/put pair found";
          }
        } else {
          // documented approximation: put IV near 0.9xS vs call IV near 1.1xS
          const undRef = undOf(rrExpiry);
          const nearest = (side: "C" | "P", target: number): OptLeg | null => {
            let best: OptLeg | null = null;
            let bd = Infinity;
            for (const l of rows) {
              if (l.type !== side) continue;
              const d = Math.abs(l.strike - target);
              if (d < bd) {
                bd = d;
                best = l;
              }
            }
            return best;
          };
          const call = undRef > 0 ? nearest("C", 1.1 * undRef) : null;
          const put = undRef > 0 ? nearest("P", 0.9 * undRef) : null;
          if (call && put && call.markIv != null && put.markIv != null) {
            riskReversal25d = {
              value: Number((call.markIv - put.markIv).toFixed(2)),
              method: "approx-strikes",
              expiry: rrExpiry,
            };
            notes.push(
              "riskReversal25d approximated: call IV at the strike nearest 1.1x spot vs put IV nearest 0.9x spot (book-summary rows carry no deltas)"
            );
          } else {
            riskReversalReason = "no strikes near the 0.9x/1.1x approximation targets";
          }
        }
      }

      // (c3) max pain — nearest 3 monthly (last-Friday) expiries
      let monthly = futureExpiries.filter(([, ts]) => isLastFriday(ts));
      if (monthly.length === 0) {
        monthly = futureExpiries.slice(0, 3);
        notes.push("maxPain: no last-Friday monthly expiries detected — used the nearest expiries");
      }
      for (const [exp] of monthly.slice(0, 3)) {
        const rows = legsOf(exp).filter((l) => l.oi > 0);
        if (rows.length === 0) continue;
        const strikes = [...new Set(rows.map((r) => r.strike))].sort((a, b) => a - b);
        let bestK: number | null = null;
        let bestPain = Infinity;
        for (const k of strikes) {
          // standard max pain: the settlement strike minimizing the total
          // intrinsic payout to option holders (what writers would pay out)
          let pain = 0;
          for (const r of rows) {
            pain +=
              r.oi * (r.type === "C" ? Math.max(k - r.strike, 0) : Math.max(r.strike - k, 0));
          }
          if (pain < bestPain) {
            bestPain = pain;
            bestK = k;
          }
        }
        if (bestK != null) maxPain.push({ expiry: exp, strike: bestK });
      }
      if (maxPain.length === 0) notes.push("maxPain: no open interest on monthly expiries");

      // (c4) top call/put OI walls — nearest expiry with meaningful OI
      const oiByExpiry = new Map<string, number>();
      for (const l of legs) oiByExpiry.set(l.expiry, (oiByExpiry.get(l.expiry) ?? 0) + l.oi);
      const maxExpOi = Math.max(0, ...oiByExpiry.values());
      let wallExpiry: string | null = null;
      for (const [name] of futureExpiries) {
        const tot = oiByExpiry.get(name) ?? 0;
        if (tot > 0 && tot >= 0.05 * maxExpOi) {
          wallExpiry = name;
          break;
        }
      }
      if (!wallExpiry) {
        const byOi = [...oiByExpiry.entries()].sort((a, b) => b[1] - a[1]);
        wallExpiry = byOi[0]?.[0] ?? null;
        if (wallExpiry) notes.push("oiWalls: nearest expiries had negligible OI — used the max-OI expiry");
      }
      if (wallExpiry) {
        const undRef = undOf(wallExpiry);
        const topWalls = (side: "C" | "P") =>
          legsOf(wallExpiry)
            .filter((l) => l.type === side && l.oi > 0)
            .sort((a, b) => b.oi - a.oi || a.strike - b.strike)
            .slice(0, 5)
            .map((l) => ({
              strike: l.strike,
              oi: Number(l.oi.toFixed(2)),
              oiUsd: undRef > 0 ? Math.round(l.oi * undRef) : 0,
            }));
        oiWalls = { expiry: wallExpiry, calls: topWalls("C"), puts: topWalls("P") };
        notes.push("oiWalls oiUsd = open_interest (BTC/ETH contracts) x underlying_price");
      } else {
        notes.push("oiWalls unavailable (no expiry with open interest)");
      }

      // (c5) dealer net gamma (GEX) — calls +, puts − (dealer short-call /
      // long-put convention); gamma from the chain when present, otherwise
      // closed-form Black-Scholes on real mark_iv / underlying / T (r=q=0)
      let netGex = 0;
      let gexLegs = 0;
      for (const l of legs) {
        if (!(l.oi > 0)) continue;
        const tYears = (l.expTs - now) / YEAR_MS;
        const gamma = l.gamma ?? (l.markIv != null ? bsGamma(l.und, l.strike, l.markIv, tYears) : null);
        if (gamma == null) continue;
        netGex += (l.type === "C" ? 1 : -1) * l.oi * gamma;
        gexLegs++;
      }
      const gexSpot = futureExpiries.length > 0 ? undOf(futureExpiries[0][0]) : 0;
      gex = {
        netGexUsd: Number(netGex.toFixed(4)),
        netGexUsdPer1Pct: gexSpot > 0 ? Number((netGex * gexSpot * gexSpot * 0.01).toFixed(2)) : null,
        regime: netGex > 0 ? "POSITIVE_PIN" : "NEGATIVE_GAMMA_EXPANSION",
        spot: gexSpot > 0 ? gexSpot : null,
        legsCounted: gexLegs,
      };
      notes.push(
        "gex: gamma computed via Black-Scholes (r=0, q=0) from mark_iv + underlying_price + time-to-expiry"
      );
      notes.push(
        "gex: netGexUsd = sum(call OI x gamma) - sum(put OI x gamma); netGexUsdPer1Pct scales it by spot^2 x 1%"
      );

      // (c6) put/call ratios (whole listed chain)
      let oiC = 0;
      let oiP = 0;
      let volC = 0;
      let volP = 0;
      for (const l of legs) {
        if (l.type === "C") {
          oiC += l.oi;
          volC += l.volUsd;
        } else {
          oiP += l.oi;
          volP += l.volUsd;
        }
      }
      putCallRatio.oi = oiP > 0 ? Number((oiC / oiP).toFixed(3)) : null;
      putCallRatio.vol24h = volP > 0 ? Number((volC / volP).toFixed(3)) : null;
    } else {
      notes.push(
        "termStructure/riskReversal/maxPain/oiWalls/gex/putCallRatio unavailable (Deribit get_book_summary_by_currency failed)"
      );
    }

    // ── freshness telemetry: oldest contributing payload ──

    const stamps: number[] = [];
    if (dvol) stamps.push(dvol.dataAt);
    if (chain) stamps.push(chain.dataAt);
    const srcParts: string[] = [];
    if (dvol) srcParts.push("deribit/dvol");
    if (chain) srcParts.push("deribit/option-chain");

    return NextResponse.json({
      ok: true,
      supported: true,
      sym,
      currency: cgSym,
      dvol: dvolOut,
      termStructure,
      riskReversal25d:
        riskReversal25d ??
        (riskReversalReason ? { value: null, method: null, expiry: null, reason: riskReversalReason } : null),
      maxPain,
      oiWalls,
      gex,
      putCallRatio,
      notes,
      ...telemetryOf(stamps, srcParts.length > 0 ? srcParts.join("+") : "none"),
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "options analytics fetch failed" },
      { status: 502 }
    );
  }
}
