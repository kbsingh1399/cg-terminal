import { NextRequest, NextResponse } from "next/server";
import { cgGet } from "@/lib/cg/client";
import { isAsset } from "@/lib/cg/assets";

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
  const sym = (sp.get("sym") ?? "BTC").toUpperCase();

  if (!isAsset(sym)) {
    return NextResponse.json({ ok: false, error: `unknown asset ${sym}` }, { status: 400 });
  }

  try {
    // type=0 (USD value), timeType=2 (1-hour points)
    const raw = (await cgGet(
      `/api/openInterest/v3/chart?symbol=${encodeURIComponent(sym)}&type=0&timeType=2`,
      30_000
    )) as RawOiChartResponse | null;

    const dataMap = raw?.dataMap && typeof raw.dataMap === "object" ? raw.dataMap : {};
    const dateList = Array.isArray(raw?.dateList) ? raw.dateList : [];
    const priceList = Array.isArray(raw?.priceList) ? raw.priceList : [];

    const n = dateList.length;
    let totalLatest = 0;
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

    const venues: OiVenue[] = venueEntries
      .sort((a, b) => b.latest - a.latest)
      .map((e) => ({
        name: e.name,
        oiUsd: Math.round(e.latest),
        sharePct: totalLatest > 0 ? Number(((e.latest / totalLatest) * 100).toFixed(2)) : 0,
      }));

    const oiDelta1hPct = total1h > 0 ? Number((((totalLatest - total1h) / total1h) * 100).toFixed(2)) : 0;
    const oiDelta4hPct = total4h > 0 ? Number((((totalLatest - total4h) / total4h) * 100).toFixed(2)) : 0;
    const oiDelta24hPct = total24h > 0 ? Number((((totalLatest - total24h) / total24h) * 100).toFixed(2)) : 0;

    const series: OiPoint[] = [];
    for (let i = 0; i < n; i++) {
      let sum = 0;
      for (const vals of Object.values(dataMap)) {
        if (Array.isArray(vals) && typeof vals[i] === "number") {
          sum += vals[i];
        }
      }
      series.push({
        ts: dateList[i],
        oiUsd: Math.round(sum),
        price: typeof priceList[i] === "number" ? priceList[i] : null,
      });
    }

    return NextResponse.json({
      ok: true,
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
