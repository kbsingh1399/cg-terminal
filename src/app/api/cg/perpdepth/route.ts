import { NextRequest, NextResponse } from "next/server";
import { cgGet, FAPI, CAPI } from "@/lib/cg/client";
import { perpMapOf } from "@/lib/cg/perpmap";

export const dynamic = "force-dynamic";

/**
 * GET /api/cg/perpdepth?sym=USO — verified derivatives coverage for a
 * classic (Tier-3) instrument: per-venue price + 24h volume, lead-venue OI
 * series with 1h/4h/24h deltas, funding (where fundingRate/v2/home carries
 * it), and the net taker-flow of the last 15m bar on flow-capable venues.
 *
 * Everything from the live-verified perpmap (src/lib/cg/perpmap.ts) — the
 * instruments NOT in the map get an honest 400. Liquidation levels, whale
 * walls and CVD are NOT available upstream for this class (probed 2026-11-11,
 * empty on every venue) and are never fabricated.
 */

type Row = unknown[]; // Coinglass kline row: [tsSec, o, h, l, c, v] (values are strings or numbers)

function toBars(rows: unknown): { t: number; c: number | null; v: number | null }[] {
  const list = Array.isArray(rows) ? rows : ((rows as { data?: unknown[] })?.data ?? []);
  const out: { t: number; c: number | null; v: number | null }[] = [];
  for (const row of list as Row[]) {
    if (!Array.isArray(row) || null == row[0]) continue;
    out.push({ t: 1000 * Number(row[0]), c: row[4] != null ? Number(row[4]) : null, v: row[5] != null ? Number(row[5]) : null });
  }
  return out;
}

function sumVol(bars: { v: number | null }[]): number {
  return bars.reduce((a, b) => a + (b.v ?? 0), 0);
}

function oiDeltas(bars: { c: number | null }[]): { last: number | null; d1h: number | null; d4h: number | null; d24h: number | null } {
  if (!bars.length) return { last: null, d1h: null, d4h: null, d24h: null };
  const oi = bars.map((b) => b.c);
  const last = oi[oi.length - 1];
  const at = (back: number) => (oi.length > back ? oi[oi.length - 1 - back] : null);
  const rel = (a: number | null, b: number | null) => (a != null && b != null && b !== 0 ? +(((a - b) / b) * 100).toFixed(2) : null);
  return {
    last,
    d1h: rel(last, at(4)),
    d4h: rel(last, at(16)),
    d24h: rel(last, at(96)),
  };
}

function netFlowBars(rows: unknown): number[][][] {
  // orderFlow bars are arrays: [tsSec, [[pLo, pHi, buyVol, sellVol, buyUsd, sellUsd, ...], ...]]
  const list = Array.isArray(rows) ? rows : ((rows as { data?: unknown[] })?.data ?? []);
  const out: number[][][] = [];
  for (const b of list as unknown[][]) {
    if (Array.isArray(b) && Array.isArray(b[1])) out.push(b[1] as number[][]);
  }
  return out;
}

function netFlow(rows: number[][]): number {
  // Coinglass order_flow bucket row: [priceLow, priceHigh, buyVol, sellVol,
  // buyUsd, sellUsd, ...] — net in USD only (RV-ARCH M4: no volume-unit
  // fallback under a USD label; malformed rows are skipped)
  let net = 0;
  for (const r of rows) {
    const buy = Number(r[4]);
    const sell = Number(r[5]);
    if (Number.isFinite(buy) && Number.isFinite(sell)) net += buy - sell;
  }
  return net;
}

const TTL_MS = 60_000;
const g = globalThis as unknown as { __cgPerpDepth?: Map<string, { at: number; body: unknown }> };
const cache = (g.__cgPerpDepth ??= new Map());

export async function GET(req: NextRequest) {
  const sym = (req.nextUrl.searchParams.get("sym") ?? "").toUpperCase();
  if (!sym) return NextResponse.json({ ok: false, error: "missing sym" }, { status: 400 });
  const entry = perpMapOf(sym);
  if (!entry || entry.venues.length === 0) {
    // review RV-ARCH B2: US2000 has a COT mapping but ZERO perp venues —
    // return an honest 400 instead of crashing on lead=undefined (500)
    return NextResponse.json(
      { ok: false, error: `no verified perp venues for ${sym}` + (entry ? ` (COT-only instrument — use /api/cg/cot?sym=${sym})` : ` — registry: SP500/SPX500 NDX100 US2000 JP225 HK50 USO UKO NATGAS EURUSD USDJPY GBPUSD XAU XAG XPT`) },
      { status: 400 }
    );
  }
  const hit = cache.get(sym);
  if (hit && Date.now() - hit.at < TTL_MS) return NextResponse.json(hit.body);

  const lead = entry.venues.find((v) => v.lead) ?? entry.venues[0];
  const jobs: Promise<unknown>[] = [];
  const leadKline = cgGet(
    `/api/v2/kline?symbol=${encodeURIComponent(`${lead.key}#kline`)}&interval=15m&minLimit=false&limit=97`,
    60_000,
    FAPI
  ).catch(() => null);
  const leadOi = cgGet(
    `/api/v2/kline?symbol=${encodeURIComponent(`${lead.key}#oi_kline`)}&interval=15m&minLimit=false&limit=97`,
    60_000,
    FAPI
  ).catch(() => null);
  jobs.push(leadKline, leadOi);
  const venueKlines = entry.venues.map((v) =>
    v.key === lead.key
      ? Promise.resolve(null)
      : cgGet(`/api/v2/kline?symbol=${encodeURIComponent(`${v.key}#kline`)}&interval=15m&minLimit=false&limit=97`, 60_000, FAPI).catch(() => null)
  );
  jobs.push(...venueKlines);
  const flowVenue = entry.venues.find((v) => v.lead && v.flow) ?? entry.venues.find((v) => v.flow);
  const flowP = flowVenue
    ? cgGet(`/api/orderFlow?symbol=${encodeURIComponent(`${flowVenue.key}#order_flow`)}&interval=15m&minLimit=false&limit=3`, 60_000, FAPI).catch(() => null)
    : Promise.resolve(null);
  jobs.push(flowP);
  const fundingP = entry.fundingSym
    ? cgGet("/api/fundingRate/v2/home", 60_000, CAPI).catch(() => null)
    : Promise.resolve(null);
  jobs.push(fundingP);

  const settled = await Promise.all(jobs);
  const leadBars = toBars(settled[0]);
  const oiBars = toBars(settled[1]);
  if (!leadBars.length && !oiBars.length) {
    // review RV-ARCH M3: an all-null body with ok:true would render a dead
    // panel with no explanation — be honest instead
    return NextResponse.json(
      { ok: false, error: `upstream returned no klines/OI for ${sym} (Coinglass down or instrument dormant) — retry next poll` },
      { status: 502 }
    );
  }
  const venuesOut: Record<string, unknown>[] = [];
  const leadLast = leadBars.length ? leadBars[leadBars.length - 1].c : null;
  if (leadBars.length) {
    venuesOut.push({ id: lead.id, key: lead.key, close: leadLast, vol24h: +sumVol(leadBars.slice(-96)).toFixed(2), lead: true });
  }
  entry.venues.forEach((v, i) => {
    const bars = toBars(settled[2 + i]);
    if (v.key === lead.key) return;
    if (!bars.length) {
      venuesOut.push({ id: v.id, key: v.key, close: null, vol24h: null, lead: false, stale: true });
      return;
    }
    venuesOut.push({ id: v.id, key: v.key, close: bars[bars.length - 1].c, vol24h: +sumVol(bars.slice(-96)).toFixed(2), lead: false });
  });

  const flowBars = netFlowBars(settled[2 + entry.venues.length]);
  const flowRows = flowBars.length ? flowBars[flowBars.length - 1] : [];
  const flowNet = flowRows.length ? netFlow(flowRows) : null;

  let funding: { sym: string; venues: { exchange: string; ratePct: number | null; intervalH: number | null }[] } | null = null;
  const home = settled[3 + entry.venues.length] as
    | { symbol?: string; uMarginList?: { exchangeName?: string; rate?: number; fundingIntervalHours?: number }[] }[]
    | null;
  const fItem = Array.isArray(home) ? home.find((h) => h.symbol === entry.fundingSym) : null;
  if (fItem) {
    // RV-DATA F1: Coinglass `rate` is ALREADY in percent (0.008 = 0.008%) —
    // no ×100. Genuine 0% rates are kept (they are honest readings).
    const rows = (fItem.uMarginList ?? [])
      .filter((x) => typeof x.rate === "number")
      .map((x) => ({ exchange: x.exchangeName ?? "?", ratePct: typeof x.rate === "number" ? x.rate : null, intervalH: x.fundingIntervalHours ?? null }));
    funding = rows.length ? { sym: entry.fundingSym!, venues: rows } : null;
  }

  const body = {
    ok: true,
    sym,
    liquidity: entry.liquidity,
    note: entry.note ?? null,
    lead: { venue: lead.id, key: lead.key, close: leadLast, vol24h: leadBars.length ? +sumVol(leadBars.slice(-96)).toFixed(2) : null },
    priceSeries: leadBars.slice(-96).map((b) => ({ t: b.t, c: b.c })),
    oi: oiDeltas(oiBars),
    oiSeries: oiBars.slice(-96).map((b) => ({ t: b.t, c: b.c })),
    venues: venuesOut,
    funding,
    takerFlow15mUsd: flowNet != null ? +flowNet.toFixed(0) : null,
    flowVenue: flowVenue ? flowVenue.id : null,
    unavailable: "liquidation levels · book walls · CVD · large taker orders — not served upstream for this class (probed 2026-11-11)",
    fetchedAt: Date.now(),
  };
  cache.set(sym, { at: Date.now(), body });
  if (cache.size > 32) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  return NextResponse.json(body);
}
