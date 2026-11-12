import { NextRequest, NextResponse } from "next/server";
import { cgGet } from "@/lib/cg/client";
import { buildLiqModel, liqStats, type RawLiqPayload, type LiqStats } from "@/lib/cg/liq-model";
import { liqVenues, symDecs } from "@/lib/cg/assets";
import { anyTerminalSym, knownSym } from "@/lib/cg/sym-gate";
import { getLivePrice } from "@/lib/live/server-price";
import type { LiquidationLevel } from "@/lib/cg/types";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const sym = (sp.get("sym") ?? "BTC").trim().toUpperCase();
  if (!(await anyTerminalSym(sym))) {
    return NextResponse.json({ ok: false, error: `unknown asset ${sym}` }, { status: 400 });
  }
  const hasPerp = await knownSym(sym);
  const VENUES = liqVenues(sym);
  const rangeRaw = sp.get("range") ?? "3d";
  const range = ["3d", "7d", "30d"].includes(rangeRaw) ? rangeRaw : "3d";
  const lvR = Math.min(Math.max(Number(sp.get("lvR") ?? 4) || 4, 1), 8);
  const limit = Math.min(Number(sp.get("limit") ?? 4000) || 4000, 6000);
  try {
    const live = await getLivePrice(sym).catch(() => null);
    if (!hasPerp) {
      return NextResponse.json({
        ok: true,
        supported: false,
        sym,
        range,
        lvR,
        venues: [],
        perVenue: {},
        stats: null,
        livePrice: live?.price ?? null,
        reason: "Coinglass estimated liquidation clusters apply only to multi-venue perpetual futures",
        updatedAt: Date.now(),
      });
    }

    const results = await Promise.allSettled(
      VENUES.map((v) =>
        cgGet(`/api/liquidationLevels/v2?symbol=${encodeURIComponent(v.key)}&limit=${limit}&range=${range}`, 30_000)
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
      return NextResponse.json({
        ok: true,
        supported: false,
        sym,
        range,
        lvR,
        venues: VENUES.map((v) => v.name),
        perVenue,
        stats: null,
        livePrice: live?.price ?? null,
        reason: "Upstream Coinglass liquidation-level heatmap does not cover this instrument yet",
        updatedAt: Date.now(),
      });
    }

    const model = buildLiqModel(venues);
    if (!model) {
      return NextResponse.json({
        ok: true,
        supported: false,
        sym,
        range,
        lvR,
        venues: VENUES.map((v) => v.name),
        perVenue,
        stats: null,
        livePrice: live?.price ?? null,
        reason: "No usable liquidation price grid returned by upstream",
        updatedAt: Date.now(),
      });
    }
    const stats: LiqStats = liqStats(model, lvR, {
      livePrice: live?.price ?? null,
      priceDecs: symDecs(sym, live?.price ?? null),
    });

    return NextResponse.json({
      ok: true,
      supported: true,
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

export type { LiquidationLevel };
