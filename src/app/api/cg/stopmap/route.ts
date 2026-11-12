import { NextRequest, NextResponse } from "next/server";
import { cgGet } from "@/lib/cg/client";
import { makeObeToken } from "@/lib/cg/crypto";
import { buildStopModel, buildRollingStopModel, lastRollingNullReason, type LiqHeatmapPayload, type StopModel } from "@/lib/cg/liq-heatmap";
import { isAsset } from "@/lib/cg/assets";
import { isCuratedPerp } from "@/lib/cg/assets";
import { anyTerminalSym } from "@/lib/cg/sym-gate";
import { BoundedMap } from "@/lib/cg/bounded";

export const dynamic = "force-dynamic";

/**
 * GET /api/cg/stopmap?sym=BTC&endTime=<unix-sec>
 *
 * Liquidation heatmap ("stops map") — the estimated leveraged-position
 * liquidation exposure grid of the Coinglass
 * /pro/futures/LiquidationHeatMap page (Model 1).
 *
 * Anonymous access serves the 24-hour window (288 × 5-minute bars) —
 * the exact default view of the live page. `endTime` pages history so
 * the local continuity engine archives every window without gaps.
 *
 * Pure API data: every number comes from /api/index/v2/liqHeatMap.
 */

/** module-level cache keyed by sym|endTime — the `data` token changes every
 * call, so cgGet's URL-keyed cache would never hit; cache the parsed model.
 * BOUNDED (the engine pages history here — varying endTime must not grow it). */
const cache = new BoundedMap<{ at: number; body: unknown }>(16);

async function loadStopmap(sym: string, endTime: number | undefined, ttlMs = 25_000) {
  const ck = `${sym}|${endTime ?? ""}`;
  const hit = cache.get(ck);
  if (hit && Date.now() - hit.at < ttlMs) return hit.body;
  const refSymbol = `Binance_${sym}USDT`;
  // URLSearchParams encodes the token once — do NOT pre-encode it
  const q = new URLSearchParams({
    merge: "true",
    symbol: refSymbol,
    interval: "5",
    limit: "288",
    data: makeObeToken(),
  });
  if (endTime) q.set("endTime", String(endTime));
  const payload = await cgGet(`/api/index/v2/liqHeatMap?${q.toString()}`, 0);
  cache.set(ck, { at: Date.now(), body: payload });
  return payload;
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const sym = (sp.get("sym") ?? "BTC").toUpperCase();
  if (!(await anyTerminalSym(sym))) {
    return NextResponse.json({ ok: false, error: `unknown asset ${sym}` }, { status: 400 });
  }
  // The anonymous /api/index/v2/liqHeatMap endpoint serves BTC only — every
  // other symbol returns upstream code 40000 (live-verified for ETH/SOL/XRP/
  // XAU/XAG across the v1/v2/v3/v5/v6 and aggregate variants). The other
  // curated perps get the honest LIQ-SNAPSHOT ROLLING HEATMAP (archived +
  // live multi-venue liquidation levels — see liq-heatmap.ts), clearly
  // badged, never a dead 400.
  if (sym !== "BTC") {
    if (!isCuratedPerp(sym)) {
      return NextResponse.json({
        ok: true,
        supported: false,
        sym,
        reason: "Liquidation heatmaps require perp leverage tiers (unavailable for classic cash/CFD instruments)",
        dataAt: Date.now(),
        ageMs: 0,
        stale: false,
        source: "stopmap-gate",
      });
    }
    try {
      const rolling = await buildRollingStopModel(sym);
      if (!rolling) {
        return NextResponse.json({
          ok: true,
          supported: false,
          sym,
          reason:
            lastRollingNullReason ||
            "no liquidation-level snapshots archived yet for this perp — the engine rotates the full universe every ~45 min; retry after the next pass",
          dataAt: Date.now(),
          ageMs: 0,
          stale: false,
          source: "liq-archive",
        });
      }
      return NextResponse.json({
        ok: true,
        sym,
        symbol: sym,
        reference: `multi-venue:${sym}`,
        window: { interval: "15m", bars: rolling.candles.length, from: rolling.candles[0]?.ts, to: rolling.lastTs },
        instrument: `rolling aggregate (${rolling.source})`,
        model: rolling,
        dataAt: rolling.updateTime,
        ageMs: Date.now() - rolling.updateTime,
        stale: Date.now() - rolling.updateTime > 20 * 60_000,
        source: `liq-snapshot-rolling:${rolling.source}`,
        updatedAt: rolling.updateTime,
      });
    } catch (e) {
      return NextResponse.json(
        { ok: false, error: e instanceof Error ? e.message : "rolling heatmap failed" },
        { status: 502 }
      );
    }
  }
  const REF_SYMBOL = `Binance_${sym}USDT`;
  const endTimeRaw = Number(sp.get("endTime") ?? 0);
  if (Number.isFinite(endTimeRaw) && endTimeRaw !== 0 && !(endTimeRaw > 0)) {
    return NextResponse.json({ ok: false, error: "endTime must be a positive unix-seconds value" }, { status: 400 });
  }
  // anonymous heatmap history reaches back ~30 days — reject anything else
  // (also keeps the cache key from being used as a memory-growth primitive)
  const MAX_LOOKBACK_S = 30 * 86_400;
  let endTime: number | undefined;
  if (Number.isFinite(endTimeRaw) && endTimeRaw > 0) {
    const nowS = Math.floor(Date.now() / 1000);
    if (endTimeRaw > nowS + 300 || endTimeRaw < nowS - MAX_LOOKBACK_S) {
      return NextResponse.json({ ok: false, error: `endTime out of range (max ${MAX_LOOKBACK_S / 86_400} days back)` }, { status: 400 });
    }
    endTime = Math.floor(endTimeRaw);
  }

  try {
    const payload = (await loadStopmap(sym, endTime)) as LiqHeatmapPayload & { code?: string; msg?: string };
    if (!payload || typeof payload !== "object" || !Array.isArray(payload.liq)) {
      const code = (payload as { code?: string })?.code;
      const hint =
        code === "40000"
          ? "this window needs a Coinglass login (anonymous = 24h view only)"
          : code === "50001"
            ? "upstream rate-limited, retry shortly"
            : "upstream returned no heatmap data";
      return NextResponse.json({ ok: false, error: `liqHeatMap ${code ?? "empty"}: ${hint}` }, { status: 502 });
    }

    const model: StopModel | null = buildStopModel(payload);
    if (!model) {
      return NextResponse.json({ ok: false, error: "no usable heatmap window" }, { status: 502 });
    }

    return NextResponse.json({
      ok: true,
      sym,
      symbol: sym,
      reference: REF_SYMBOL,
      window: { interval: "5m", bars: model.candles.length, from: model.candles[0]?.ts, to: model.lastTs },
      instrument: payload.instrument?.exName
        ? `${payload.instrument.exName} ${payload.instrument.instrumentId}`
        : REF_SYMBOL,
      model,
      dataAt: model.updateTime,
      ageMs: Date.now() - model.updateTime,
      stale: Date.now() - model.updateTime > 60_000,
      source: "coinglass:native-heatmap",
      updatedAt: Date.now(),
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "fetch failed" },
      { status: 502 }
    );
  }
}
