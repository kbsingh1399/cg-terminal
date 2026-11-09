import { NextRequest, NextResponse } from "next/server";
import { cgGet } from "@/lib/cg/client";
import { buildLiqModel, liqStats, type RawLiqPayload, type LiqStats } from "@/lib/cg/liq-model";
import { isAsset, liqVenues } from "@/lib/cg/assets";
import type { LiquidationLevel } from "@/lib/cg/types";

export const dynamic = "force-dynamic";

/**
 * GET /api/cg/liqlevels?sym=BTC&range=3d|7d|30d&lvR=4
 *
 * Aggregated liquidation levels over the four perp venues — Binance, OKX,
 * Bybit, Hyperliquid — using the EXACT model of the live Coinglass
 * liquidation-levels page (ported to src/lib/cg/liq-model.ts): 520-row price
 * grid, unhit levels only, top key levels within ±lvR% with strength
 * normalized to the strongest row, leverage tiers h1/h2/h3.
 *
 * Pure API data: every value comes from /api/liquidationLevels/v2 per venue.
 */

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const sym = (sp.get("sym") ?? "BTC").toUpperCase();
  if (!isAsset(sym)) {
    return NextResponse.json({ ok: false, error: `unknown asset ${sym}` }, { status: 400 });
  }
  const VENUES = liqVenues(sym);
  const rangeRaw = sp.get("range") ?? "3d";
  const range = ["3d", "7d", "30d"].includes(rangeRaw) ? rangeRaw : "3d";
  const lvR = Math.min(Math.max(Number(sp.get("lvR") ?? 4) || 4, 1), 8);
  const limit = Math.min(Number(sp.get("limit") ?? 4000) || 4000, 6000);
  try {
    const results = await Promise.allSettled(
      VENUES.map((v) =>
        cgGet(`/api/liquidationLevels/v2?symbol=${encodeURIComponent(v.key)}&limit=${limit}&range=${range}`, 60_000)
      )
    );

    const venues: { name: string; payload: RawLiqPayload | null }[] = [];
    const perVenue: Record<string, number> = {};
    results.forEach((r, i) => {
      const v = VENUES[i];
      let payload: RawLiqPayload | null = null;
      if (r.status === "fulfilled" && r.value) {
        const val = r.value as RawLiqPayload | { data?: RawLiqPayload };
        payload = (Array.isArray((val as RawLiqPayload)?.prices) ? (val as RawLiqPayload) : ((val as { data?: RawLiqPayload }).data ?? null)) as RawLiqPayload | null;
      }
      perVenue[v.name] = payload?.data?.length ?? 0;
      venues.push({ name: v.name, payload });
    });

    if (!venues.some((v) => v.payload)) {
      return NextResponse.json({ ok: false, error: "no liquidation-level data from any venue" }, { status: 502 });
    }

    const model = buildLiqModel(venues);
    if (!model) {
      return NextResponse.json({ ok: false, error: "no usable price series" }, { status: 502 });
    }
    const stats: LiqStats = liqStats(model, lvR);

    return NextResponse.json({
      ok: true,
      sym,
      range,
      lvR,
      venues: VENUES.map((v) => v.name),
      perVenue,
      stats,
      updatedAt: Date.now(),
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "fetch failed" },
      { status: 502 }
    );
  }
}

// keep the old types import referenced for back-compat consumers
export type { LiquidationLevel };
