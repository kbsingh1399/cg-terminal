import { NextRequest, NextResponse } from "next/server";
import { cgGet } from "@/lib/cg/client";
import {
  cvdKpis,
  detectDivergences,
  flowRows,
  FlowGrid,
  pickInstruments,
  recompute,
  type CvdInstrument,
  type CvdSeries,
  type TickerRow,
} from "@/lib/cg/cvd";
import type { KlineRow } from "@/lib/cg/types";
import { isAsset } from "@/lib/cg/assets";
import { BoundedMap } from "@/lib/cg/bounded";

export const dynamic = "force-dynamic";

/**
 * GET /api/cg/cvd?itv=m15&limit=1500&mode=perp|spot|total|split&anchor=all|day|week
 *
 * Cumulative Volume Delta — the Coinglass /cvd/BTC page:
 * futures CVD, spot CVD, taker-buy share, spot-vs-futures quadrant and the
 * Bull/Bear divergence list, all computed by their exact client-side engine
 * (src/lib/cg/cvd.ts) over per-venue taker flows (#bs_usd klines).
 *
 * Pure API data: /api/select/coins/tickers + /api/v2/kline (#kline, #bs_usd).
 */

const ITVS: Record<string, { api: string; ms: number }> = {
  "1m": { api: "m1", ms: 60_000 },
  "5m": { api: "m5", ms: 300_000 },
  "15m": { api: "m15", ms: 900_000 },
  "30m": { api: "m30", ms: 1_800_000 },
  "1h": { api: "h1", ms: 3_600_000 },
  "4h": { api: "h4", ms: 14_400_000 },
  "1d": { api: "d1", ms: 86_400_000 },
};

/** module-level cache per (sym, itv, limit) — the flow fan-out is expensive.
 * BOUNDED: sym is allowlisted and limit clamped, so the key space is small. */
const cache = new BoundedMap<{ at: number; body: unknown }>(16);

async function mapLimit<T, R>(items: T[], limit: number, fn: (t: T, i: number) => Promise<R>): Promise<(R | null)[]> {
  const out: (R | null)[] = new Array(items.length).fill(null);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      try {
        out[i] = await fn(items[i], i);
      } catch {
        out[i] = null;
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

async function buildCvd(sym: string, itvKey: string, limit: number): Promise<{ inst: CvdInstrument[]; priceKey: string; series: CvdSeries; loaded: { key: string; ok: boolean }[]; itv: { api: string; ms: number } }> {
  const itv = ITVS[itvKey];
  // 1) instruments (their er(): FUTURES + SPOT tickers, per-venue best)
  const [fut, spot] = await Promise.all([
    cgGet(`/api/select/coins/tickers?type=FUTURES&keyword=${encodeURIComponent(sym)}`, 120_000) as Promise<TickerRow[] | { data: TickerRow[] }>,
    cgGet(`/api/select/coins/tickers?type=SPOT&keyword=${encodeURIComponent(sym)}`, 120_000)
      .then((d) => d as TickerRow[] | { data: TickerRow[] })
      .catch(() => [] as TickerRow[]),
  ]);
  const futRows = Array.isArray(fut) ? fut : ((fut as { data?: TickerRow[] }).data ?? []);
  const spotRows = Array.isArray(spot) ? spot : ((spot as { data?: TickerRow[] }).data ?? []);
  const { inst, priceKey } = pickInstruments(futRows, spotRows, sym);
  if (!inst.length || !priceKey) throw new Error("no CVD instruments");

  // 2) price candles (their C(): <priceKey>#kline)
  const kl = (await cgGet(
    `/api/v2/kline?symbol=${encodeURIComponent(priceKey + "#kline")}&interval=${itv.api}&limit=${limit}&minLimit=false`,
    60_000
  )) as { data?: KlineRow[] } | KlineRow[];
  const klRows = Array.isArray(kl) ? kl : (kl.data ?? []);
  const candles = klRows.filter((r) => r && Number.isFinite(+r[4]));
  if (!candles.length) throw new Error("no price kline");

  // 3) per-instrument flows (#bs_usd), 6 concurrent like the page
  const grid = new FlowGrid(itv.ms, inst.map((i) => i.key));
  grid.setCandles(candles as unknown as [number, string | number, string | number, string | number, string | number][]);
  const loaded: { key: string; ok: boolean }[] = [];
  const flows = await mapLimit(inst, 6, async (v: CvdInstrument) => {
    const r = (await cgGet(
      `/api/v2/kline?symbol=${encodeURIComponent(v.key + "#bs_usd")}&interval=${itv.api}&limit=${limit}&minLimit=false`,
      60_000
    )) as { data?: [number, string | number, string | number][] } | [number, string | number, string | number][];
    return (Array.isArray(r) ? r : (r.data ?? [])) as [number, string | number, string | number][];
  });
  flows.forEach((rows, i) => {
    const ok = Array.isArray(rows) && rows.length > 0;
    loaded.push({ key: inst[i].key, ok });
    if (ok) grid.mergeFlow(i, flowRows(rows as [number, string | number, string | number][]));
  });

  const series = recompute(grid, inst);
  if (!series) throw new Error("recompute failed");
  return { inst, priceKey, series: series as NonNullable<ReturnType<typeof recompute>>, loaded, itv };
}

function round1e6(x: number) {
  return Math.round(x / 1e6);
}

function symOf(built: { priceKey: string }): string {
  const m = /^\w+_(.+?)(USDT|USD|USDC|PERPETUAL|-)/.exec(built.priceKey);
  return (m?.[1] ?? built.priceKey).toUpperCase();
}

/** accept both "m15" (app convention) and "15m" (page convention) */
const NORMALIZE: Record<string, string> = { m1: "1m", m5: "5m", m15: "15m", m30: "30m", h1: "1h", h4: "4h", d1: "1d" };

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const sym = (sp.get("sym") ?? "BTC").toUpperCase();
  if (!isAsset(sym)) {
    return NextResponse.json({ ok: false, error: `unknown asset ${sym}` }, { status: 400 });
  }
  const rawItv = sp.get("itv") ?? "m15";
  const itvKey = ITVS[rawItv] ? rawItv : (NORMALIZE[rawItv] ?? "m15");
  const itv = ITVS[itvKey];
  const limit = Math.min(Math.max(Number(sp.get("limit") ?? 1500) || 1500, 300), 1500);
  const mode = ["perp", "spot", "total", "split"].includes(sp.get("mode") ?? "") ? (sp.get("mode") as string) : "total";
  const anchor = ["all", "day", "week"].includes(sp.get("anchor") ?? "") ? (sp.get("anchor") as "all" | "day" | "week") : "all";

  void itv;
  const key = `${sym}|${itvKey}|${limit}`;
  let built: { inst: CvdInstrument[]; priceKey: string; series: CvdSeries; loaded: { key: string; ok: boolean }[]; itv: { api: string; ms: number } };
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < 45_000 && hit.body && typeof hit.body === "object" && "built" in (hit.body as object)) {
    built = (hit.body as { built: typeof built }).built;
  } else {
    try {
      built = await buildCvd(sym, itvKey, limit);
    } catch (e) {
      const stale = cache.get(key);
      if (stale) {
        const b = (stale.body as { built: typeof built }).built;
        return render(b, mode, anchor, stale.at);
      }
      return NextResponse.json(
        { ok: false, error: e instanceof Error ? e.message : "fetch failed" },
        { status: 502 }
      );
    }
    cache.set(key, { at: Date.now(), body: { built } });
  }
  return render(built, mode, anchor, (cache.get(key)?.at ?? Date.now()));
}

function render(
  built: { inst: CvdInstrument[]; priceKey: string; series: CvdSeries; loaded: { key: string; ok: boolean }[]; itv: { api: string; ms: number } },
  mode: string,
  anchor: "all" | "day" | "week",
  at: number
) {
  const { series, inst, loaded } = built;
  // divergences follow the selected market (their X(): split → total)
  const cvdArr = mode === "spot" ? series.spot : mode === "perp" ? series.perp : series.total;
  const divs = detectDivergences(series, cvdArr);
  const kpis = cvdKpis(series, anchor, divs);

  const dec = series.c[series.n - 1] >= 1000 ? 1 : 2;
  return NextResponse.json({
    ok: true,
    sym: symOf(built),
    itv: built.itv.api,
    mode,
    anchor,
    priceKey: built.priceKey,
    instruments: inst.map((i) => ({ key: i.key, venue: i.venue, kind: i.kind, vol24hUsd: Math.round(i.volUsd) })),
    flowsLoaded: loaded,
    n: series.n,
    candles: series.ts.map((t, i) => [t, series.o[i], series.h[i], series.l[i], series.c[i]]),
    // CVD in USD millions for compact transport
    perp: Array.from(series.perp.slice(1), round1e6),
    spot: Array.from(series.spot.slice(1), round1e6),
    total: Array.from(series.total.slice(1), round1e6),
    delta: Array.from(series.delta, round1e6),
    ratio: Array.from(series.ratio, (x) => (Number.isFinite(x) ? +x.toFixed(4) : null)),
    divergences: divs.map((d) => ({
      type: d.t,
      ts: d.ts,
      priceA: +d.priceA.toFixed(dec),
      priceB: +d.priceB.toFixed(dec),
      priceC: +d.priceC.toFixed(dec),
      bars: [d.a, d.b, d.c],
      ret12: d.r !== undefined ? +(d.r * 100).toFixed(2) : null,
      hit: d.hit ?? null,
    })),
    kpis: {
      ...kpis,
      perpCvd: round1e6(kpis.perpCvd),
      spotCvd: round1e6(kpis.spotCvd),
      perpBuy: round1e6(kpis.perpBuy),
      perpSell: round1e6(kpis.perpSell),
      spotBuy: round1e6(kpis.spotBuy),
      spotSell: round1e6(kpis.spotSell),
      buyRatio: Number.isFinite(kpis.buyRatio) ? +(kpis.buyRatio * 100).toFixed(1) : null,
      latestDiv: kpis.latestDiv
        ? {
            type: kpis.latestDiv.t,
            ts: kpis.latestDiv.ts,
            price: +(kpis.latestDiv.t === "bear" ? kpis.latestDiv.priceB : kpis.latestDiv.priceB).toFixed(dec),
          }
        : null,
    },
    updatedAt: at,
  });
}
