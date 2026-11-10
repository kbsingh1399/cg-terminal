import { NextRequest, NextResponse } from "next/server";
import { cgGet } from "@/lib/cg/client";
import { fpVenues, isAsset } from "@/lib/cg/assets";
import type { OrderFlowBucket, OrderFlowBar } from "@/lib/cg/types";

export const dynamic = "force-dynamic";

/**
 * GET /api/cg/orderflow-agg?sym=BTC&interval=m15&limit=300
 * Aggregated futures order flow (footprint) across the deepest perp venues
 * of the requested asset — Binance, OKX, Bybit (+ Hyperliquid where listed;
 * metals drop it) — mirroring the "aggregated futures" view on the
 * Coinglass footprint page. Per-venue price buckets are re-gridded onto a
 * common step and summed.
 */

function niceStep(range: number, target: number): number {
  const raw = range / target;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const n = raw / mag;
  const mult = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return mult * mag;
}

/** Re-grid venue buckets onto a common price step, pro-rating volumes by overlap. */
function aggregateBar(perVenue: { buckets: OrderFlowBucket[]; weight: number }[]): OrderFlowBucket[] {
  let lo = Infinity;
  let hi = -Infinity;
  for (const v of perVenue) {
    for (const bk of v.buckets) {
      lo = Math.min(lo, bk[0]);
      hi = Math.max(hi, bk[1]);
    }
  }
  if (!Number.isFinite(lo) || !Number.isFinite(hi) || hi <= lo) return [];
  const step = niceStep(hi - lo, 80);
  const nCells = Math.ceil((hi - lo) / step);
  const cells: OrderFlowBucket[] = Array.from({ length: nCells }, (_, i) => {
    const cLo = lo + i * step;
    return [cLo, cLo + step, 0, 0, 0, 0, 0, 0, 0, 0];
  });
  for (const v of perVenue) {
    for (const bk of v.buckets) {
      const width = bk[1] - bk[0];
      if (width <= 0) continue;
      const i0 = Math.max(0, Math.floor((bk[0] - lo) / step));
      const i1 = Math.min(nCells - 1, Math.floor((bk[1] - lo - 1e-9) / step));
      for (let i = i0; i <= i1; i++) {
        const c = cells[i];
        const ov = Math.min(bk[1], c[1]) - Math.max(bk[0], c[0]);
        if (ov <= 0) continue;
        const f = (ov / width) * v.weight;
        c[2] += bk[2] * f;
        c[3] += bk[3] * f;
        c[4] += bk[4] * f;
        c[5] += bk[5] * f;
        c[6] += bk[6] * f;
        c[7] += bk[7] * f;
        c[8] += bk[8] * f;
        c[9] += bk[9] * f;
      }
    }
  }
  return cells.filter((c) => c[2] + c[3] > 0);
}

/** Accept either `[[ts, buckets], ...]` or `{ data: [[ts, buckets], ...] }`. */
function parseRows(d: unknown): [number, unknown[][]][] {
  if (Array.isArray(d)) return d as [number, unknown[][]][];
  if (d && typeof d === "object" && Array.isArray((d as { data?: unknown }).data)) {
    return (d as unknown as { data: [number, unknown[][]][] }).data;
  }
  return [];
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const sym = (sp.get("sym") ?? "BTC").toUpperCase();
  if (!isAsset(sym)) {
    return NextResponse.json({ ok: false, error: `unknown asset ${sym}` }, { status: 400 });
  }
  const VENUES = fpVenues(sym).map((v) => v.key);
  const interval = sp.get("interval") ?? "m15";
  const all = sp.get("intervals") === "all";
  // m1 may request a deep window (up to 48h) for volume/range bar construction
  const maxLimit = interval === "m1" || all ? 2880 : 1000;
  const limit = Math.min(Number(sp.get("limit") ?? 300) || 300, maxLimit);
  const intervalList = all ? ["m1", "m5", "m15", "m30", "h1"] : [interval];
  try {
    const results = await Promise.allSettled(
      intervalList.flatMap((iv) =>
        VENUES.map((v) =>
          cgGet(
            `/api/orderFlow?symbol=${encodeURIComponent(`${v}#order_flow`)}&interval=${iv}&minLimit=false&limit=${limit}`,
            20_000
          ).then((r) => ({ iv, r }))
        )
      )
    );

    // interval -> ts -> per-venue bucket lists
    const byIv = new Map<string, Map<number, { buckets: OrderFlowBucket[]; weight: number }[]>>();
    let venuesOk = 0;
    results.forEach((res) => {
      if (res.status !== "fulfilled") return;
      const { iv, r } = res.value;
      const rows = parseRows(r);
      if (!rows.length) return;
      venuesOk++;
      let byTs = byIv.get(iv);
      if (!byTs) {
        byTs = new Map();
        byIv.set(iv, byTs);
      }
      for (const [ts, buckets] of rows) {
        if (!Array.isArray(buckets) || !buckets.length) continue;
        let arr = byTs.get(ts);
        if (!arr) {
          arr = [];
          byTs.set(ts, arr);
        }
        arr.push({ buckets: buckets as OrderFlowBucket[], weight: 1 });
      }
    });

    const barsOf = (iv: string) =>
      [...(byIv.get(iv) ?? new Map()).entries()]
        .map(([ts, perVenue]) => ({ ts, buckets: aggregateBar(perVenue) }))
        .filter((b) => b.buckets.length > 0)
        .sort((a, b) => a.ts - b.ts);

    if (all) {
      const byInterval: Record<string, OrderFlowBar[]> = {};
      for (const iv of intervalList) byInterval[iv] = barsOf(iv);
      return NextResponse.json({
        ok: true,
        venues: VENUES.length,
        venuesOk,
        byInterval,
      });
    }

    return NextResponse.json({
      ok: true,
      interval,
      venues: VENUES.length,
      venuesOk,
      bars: barsOf(interval),
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "fetch failed" },
      { status: 502 }
    );
  }
}
