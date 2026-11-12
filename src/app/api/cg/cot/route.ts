import { NextRequest, NextResponse } from "next/server";
import { perpMapOf } from "@/lib/cg/perpmap";

export const dynamic = "force-dynamic";

/**
 * GET /api/cg/cot?sym=SP500 — CFTC Commitments of Traders (Legacy Futures-Only,
 * Socrata dataset 6dca-aqww — live-verified 2026-11-11, no key, CORS *).
 * Weekly institutional positioning: non-commercial (large-spec) net, hedger
 * net, spread, OI, weekly changes, and a 3-year z-score of the net — the
 * contrarian/extreme dimension none of our other sources provide.
 *
 * Caching: 6h in-memory (data refreshes Fri 3:30pm ET; Tuesday releases
 * carry the prior week). Contract codes verified live per instrument —
 * see perpmap.ts.
 */

const TTL_MS = 6 * 60 * 60_000;
const ERR_TTL_MS = 5 * 60_000;
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

interface CotRaw {
  report_date_as_yyyy_mm_dd?: string;
  contract_market_name?: string;
  open_interest_all?: number;
  noncomm_positions_long_all?: number;
  noncomm_positions_short_all?: number;
  comm_positions_long_all?: number;
  comm_positions_short_all?: number;
  change_in_noncomm_long_all?: number;
  change_in_noncomm_short_all?: number;
  pct_of_oi_noncomm_long_all?: number;
  pct_of_oi_noncomm_short_all?: number;
  traders_noncomm_long_all?: number;
  traders_noncomm_short_all?: number;
}

interface CotPoint { date: string; net: number }

interface CacheEntry { at: number; body: unknown; err?: string }
const g = globalThis as unknown as { __cotCache?: Map<string, CacheEntry> };
const cache = (g.__cotCache ??= new Map());

function zscore(valsDesc: number[]): number | null {
  // valsDesc is NEWEST-FIRST (Socrata $order DESC) — the z-score must use
  // the LATEST net (valsDesc[0]), not the oldest (review RV-ARCH B1/RV-DATA).
  if (valsDesc.length < 30) return null;
  const mean = valsDesc.reduce((a, b) => a + b, 0) / valsDesc.length;
  const sd = Math.sqrt(valsDesc.reduce((a, b) => a + (b - mean) ** 2, 0) / valsDesc.length);
  if (sd === 0) return null;
  return +(((valsDesc[0] - mean) / sd).toFixed(2));
}

export async function GET(req: NextRequest) {
  const sym = (req.nextUrl.searchParams.get("sym") ?? "").toUpperCase();
  if (!sym) return NextResponse.json({ ok: false, error: "missing sym" }, { status: 400 });
  const entry = perpMapOf(sym);
  if (!entry?.cot) {
    if (req.nextUrl.searchParams.get("quiet") === "1") {
      return NextResponse.json({
        ok: true,
        supported: false,
        sym,
        reason: `No CFTC COT contract mapped for ${sym}`,
      });
    }
    return NextResponse.json(
      { ok: false, error: `no COT contract mapped for ${sym} — mapped: SP500 NDX100 US2000 JP225 USO UKO XAU XAG XPT` },
      { status: 400 }
    );
  }
  const hit = cache.get(sym);
  if (hit) {
    // successful bodies cache 6h (weekly data); errors cache only 5 min —
    // a transient CFTC hiccup must not pin a dead panel for hours (RV-ARCH M1)
    const ttl = hit.err ? ERR_TTL_MS : TTL_MS;
    if (Date.now() - hit.at < ttl) {
      if (hit.err) return NextResponse.json({ ok: false, error: hit.err }, { status: 502 });
      return NextResponse.json(hit.body);
    }
  }

  const code = entry.cot.code;
  const url =
    `https://publicreporting.cftc.gov/resource/6dca-aqww.json?cftc_contract_market_code=${encodeURIComponent(code)}` +
    `&$order=report_date_as_yyyy_mm_dd%20DESC&$limit=170&$select=` +
    [
      "report_date_as_yyyy_mm_dd",
      "contract_market_name",
      "open_interest_all",
      "noncomm_positions_long_all",
      "noncomm_positions_short_all",
      "comm_positions_long_all",
      "comm_positions_short_all",
      "change_in_noncomm_long_all",
      "change_in_noncomm_short_all",
      "pct_of_oi_noncomm_long_all",
      "pct_of_oi_noncomm_short_all",
      "traders_noncomm_long_all",
      "traders_noncomm_short_all",
    ].join(",");
  let raw: CotRaw[] | null = null;
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" }, cache: "no-store", signal: AbortSignal.timeout(12_000) });
    if (res.status !== 200) {
      cache.set(sym, { at: Date.now(), body: null, err: `cftc HTTP ${res.status}` });
      return NextResponse.json({ ok: false, error: `cftc HTTP ${res.status} for ${code}` }, { status: 502 });
    }
    raw = (await res.json()) as CotRaw[];
  } catch (e) {
    const msg = e instanceof Error ? e.message : "network error";
    cache.set(sym, { at: Date.now(), body: null, err: msg });
    return NextResponse.json({ ok: false, error: `cftc request failed: ${msg}` }, { status: 502 });
  }
  if (!raw || !raw.length) {
    cache.set(sym, { at: Date.now(), body: null, err: `no COT records for code ${code}` });
    return NextResponse.json({ ok: false, error: `no COT records for code ${code} (contract may be dormant or code changed)` }, { status: 502 });
  }

  const latest = raw[0];
  const netSeries: CotPoint[] = raw
    .map((r) => ({
      date: (r.report_date_as_yyyy_mm_dd ?? "").slice(0, 10),
      net: (r.noncomm_positions_long_all ?? 0) - (r.noncomm_positions_short_all ?? 0),
    }))
    .filter((p) => p.date);
  const z3y = zscore(netSeries.map((p) => p.net));
  const netNow = netSeries.length ? netSeries[0].net : null;
  const netPrev = netSeries.length > 1 ? netSeries[1].net : null;

  const body = {
    ok: true,
    sym,
    source: "CFTC Legacy Futures-Only COT (publicreporting.cftc.gov, Socrata 6dca-aqww)",
    contract: entry.cot.contract,
    code,
    asOf: (latest.report_date_as_yyyy_mm_dd ?? "").slice(0, 10),
    openInterest: latest.open_interest_all ?? null,
    noncomm: {
      long: latest.noncomm_positions_long_all ?? null,
      short: latest.noncomm_positions_short_all ?? null,
      net: netNow,
      netPrev,
      netChgWk: netNow != null && netPrev != null ? netNow - netPrev : null,
      pctOILong: latest.pct_of_oi_noncomm_long_all ?? null,
      pctOIShort: latest.pct_of_oi_noncomm_short_all ?? null,
      tradersLong: latest.traders_noncomm_long_all ?? null,
      tradersShort: latest.traders_noncomm_short_all ?? null,
    },
    commercial: {
      net: (latest.comm_positions_long_all ?? 0) - (latest.comm_positions_short_all ?? 0),
    },
    z3y,
    zNote: z3y != null ? `${Math.abs(z3y)}σ ${z3y > 0 ? "above" : "below"} 3y mean of large-spec net (|z|>2 = positioning extreme)` : null,
    history: netSeries.slice(0, 78), // ~18 months, oldest→newest for charts
    fetchedAt: Date.now(),
  };
  cache.set(sym, { at: Date.now(), body });
  if (cache.size > 32) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  return NextResponse.json(body);
}
