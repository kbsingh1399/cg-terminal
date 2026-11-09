import { NextRequest, NextResponse } from "next/server";
import { cgGet } from "@/lib/cg/client";
import { makeObeToken } from "@/lib/cg/crypto";
import { buildStopModel, type LiqHeatmapPayload, type StopModel } from "@/lib/cg/liq-heatmap";
import { isAsset } from "@/lib/cg/assets";

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
 * call, so cgGet's URL-keyed cache would never hit; cache the parsed model. */
const cache = new Map<string, { at: number; body: unknown }>();

async function loadStopmap(sym: string, endTime: number | undefined, ttlMs = 30_000) {
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
  if (!isAsset(sym)) {
    return NextResponse.json({ ok: false, error: `unknown asset ${sym}` }, { status: 400 });
  }
  const REF_SYMBOL = `Binance_${sym}USDT`;
  const endTimeRaw = Number(sp.get("endTime") ?? 0);
  const endTime = Number.isFinite(endTimeRaw) && endTimeRaw > 0 ? Math.floor(endTimeRaw) : undefined;

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
      updatedAt: Date.now(),
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "fetch failed" },
      { status: 502 }
    );
  }
}
