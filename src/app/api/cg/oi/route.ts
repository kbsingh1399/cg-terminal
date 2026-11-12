import { NextRequest, NextResponse } from "next/server";
import { cgGet } from "@/lib/cg/client";
import { isAsset } from "@/lib/cg/assets";
import { anyTerminalSym } from "@/lib/cg/sym-gate";
import { resolveCgSym } from "@/lib/binance/aliases";
import { getUniverse, isBinanceSym } from "@/lib/binance/universe";
import { classicOf } from "@/lib/cg/classic";
import { fetchBinOi, fetchHlCtxAndBook } from "@/lib/cg/fallbacks";

export const dynamic = "force-dynamic";

interface RawOiChartResponse {
  dataMap?: Record<string, number[]>;
  dateList?: number[];
  priceList?: number[];
  code?: string;
  msg?: string;
  success?: boolean;
}

interface OiVenue {
  name: string;
  oiUsd: number;
  sharePct: number;
}

interface OiPoint {
  ts: number;
  oiUsd: number;
  price: number | null;
}

/**
 * GET /api/cg/oi?sym=BTC
 *
 * Open interest per venue (Binance, OKX, Bybit, Hyperliquid, etc.) + 1h/4h/24h deltas.
 * Real Coinglass API data from /api/openInterest/v3/chart.
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const sym = (sp.get("sym") ?? "BTC").trim().toUpperCase();

  if (!(await anyTerminalSym(sym))) {
    return NextResponse.json({ ok: false, error: `unknown asset ${sym}` }, { status: 400 });
  }

  const cgSym = resolveCgSym(sym);

  try {
    let source = "coinglass";
    let venues: OiVenue[] = [];
    let totalLatest = 0;
    let oiDelta1hPct: number | null = 0;
    let oiDelta4hPct: number | null = 0;
    let oiDelta24hPct: number | null = 0;
    let series: OiPoint[] = [];

    try {
      const raw = (await cgGet(
        `/api/openInterest/v3/chart?symbol=${encodeURIComponent(cgSym)}&type=0&timeType=2`,
        30_000
      )) as RawOiChartResponse | null;

      const dataMap = raw?.dataMap && typeof raw.dataMap === "object" ? raw.dataMap : {};
      const dateList = Array.isArray(raw?.dateList) ? raw.dateList : [];
      const priceList = Array.isArray(raw?.priceList) ? raw.priceList : [];
      const n = dateList.length;

      let total1h = 0;
      let total4h = 0;
      let total24h = 0;
      const venueEntries: { name: string; latest: number }[] = [];

      for (const [vName, vals] of Object.entries(dataMap)) {
        if (!Array.isArray(vals) || vals.length === 0) continue;
        const latest = vals[vals.length - 1] ?? 0;
        venueEntries.push({ name: vName, latest });
        totalLatest += latest;
        if (vals.length >= 2) total1h += vals[vals.length - 2] ?? latest;
        if (vals.length >= 5) total4h += vals[vals.length - 5] ?? latest;
        const idx24 = vals.length >= 25 ? vals.length - 25 : 0;
        total24h += vals[idx24] ?? latest;
      }

      if (n > 0 && venueEntries.length > 0 && totalLatest > 0) {
        venues = venueEntries
          .sort((a, b) => b.latest - a.latest)
          .map((e) => ({
            name: e.name,
            oiUsd: Math.round(e.latest),
            sharePct: totalLatest > 0 ? Number(((e.latest / totalLatest) * 100).toFixed(2)) : 0,
          }));
        oiDelta1hPct = total1h > 0 ? Number((((totalLatest - total1h) / total1h) * 100).toFixed(2)) : null;
        oiDelta4hPct = total4h > 0 ? Number((((totalLatest - total4h) / total4h) * 100).toFixed(2)) : null;
        oiDelta24hPct = total24h > 0 ? Number((((totalLatest - total24h) / total24h) * 100).toFixed(2)) : null;
        for (let i = 0; i < n; i++) {
          let sum = 0;
          for (const vals of Object.values(dataMap)) {
            if (Array.isArray(vals) && typeof vals[i] === "number") sum += vals[i];
          }
          series.push({
            ts: dateList[i],
            oiUsd: Math.round(sum),
            price: typeof priceList[i] === "number" ? priceList[i] : null,
          });
        }
      }
    } catch {
      venues = [];
    }

    // Fallback 1: direct Binance openInterest + openInterestHist
    if (!venues.length) {
      await getUniverse();
      const classic = classicOf(sym);
      if (isAsset(cgSym) || isBinanceSym(cgSym) || !!classic?.binPair) {
        const bo = await fetchBinOi(sym);
        if (bo && bo.oiUsd > 0) {
          source = "binance-fapi";
          totalLatest = bo.oiUsd;
          oiDelta1hPct = bo.oiDelta1hPct;
          oiDelta4hPct = bo.oiDelta4hPct;
          oiDelta24hPct = bo.oiDelta24hPct;
          series = bo.series;
          venues = [{ name: "Binance", oiUsd: bo.oiUsd, sharePct: 100 }];
        }
      }
    }

    // Fallback 2: Hyperliquid xyz openInterest
    if (!venues.length) {
      const hl = await fetchHlCtxAndBook(sym);
      const mark = hl?.ctx?.markPx != null ? Number(hl.ctx.markPx) : 0;
      const oiBase = hl?.ctx?.openInterest != null ? Number(hl.ctx.openInterest) : 0;
      if (mark > 0 && oiBase > 0) {
        source = "hl-xyz";
        totalLatest = Math.round(mark * oiBase);
        oiDelta1hPct = null;
        oiDelta4hPct = null;
        oiDelta24hPct = null;
        venues = [{ name: "Hyperliquid", oiUsd: totalLatest, sharePct: 100 }];
      }
    }

    if (!venues.length) {
      return NextResponse.json({
        ok: true,
        supported: false,
        sym,
        reason: "No perpetual open-interest feed upstream for this benchmark",
        venues: [],
        aggregate: { oiUsd: null, oiDelta1hPct: null, oiDelta4hPct: null, oiDelta24hPct: null },
        series: [],
        updatedAt: Date.now(),
      });
    }

    return NextResponse.json({
      ok: true,
      supported: true,
      source,
      sym,
      venues,
      aggregate: {
        oiUsd: Math.round(totalLatest),
        oiDelta1hPct,
        oiDelta4hPct,
        oiDelta24hPct,
      },
      series,
      updatedAt: Date.now(),
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "open interest fetch failed" },
      { status: 502 }
    );
  }
}
