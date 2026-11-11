import { NextRequest, NextResponse } from "next/server";
import { cgGet } from "@/lib/cg/client";
import { isAsset } from "@/lib/cg/assets";

export const dynamic = "force-dynamic";

interface RawVenueItem {
  exchangeName: string;
  rate?: number;
  predictedRate?: number;
  fundingIntervalHours?: number;
  nextFundingTime?: number;
  status?: number;
}

interface RawSymbolItem {
  symbol?: string;
  uMarginList?: RawVenueItem[];
  cMarginList?: RawVenueItem[];
}

interface FundingVenue {
  name: string;
  rate: number;
  rate8h: number;
  fundingIntervalHours: number;
  predictedRate?: number;
  nextFundingTime?: number;
  status: number;
}

/**
 * GET /api/cg/funding?sym=BTC
 *
 * Funding rates per venue (Binance, OKX, Bybit, Hyperliquid, etc.) + 8h normalized aggregate.
 * Real Coinglass API data from /api/fundingRate/v2/home and /api/fundingRate/chart.
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const sym = (sp.get("sym") ?? "BTC").toUpperCase();

  if (!isAsset(sym)) {
    return NextResponse.json({ ok: false, error: `unknown asset ${sym}` }, { status: 400 });
  }

  try {
    const rawHome = (await cgGet("/api/fundingRate/v2/home", 30_000)) as RawSymbolItem[] | null;
    const items = Array.isArray(rawHome) ? rawHome : [];
    const symItem = items.find((x) => x.symbol?.toUpperCase() === sym);

    const rawList = symItem?.uMarginList ?? symItem?.cMarginList ?? [];
    const venues: FundingVenue[] = [];

    for (const item of rawList) {
      if (!item || !item.exchangeName) continue;
      const rate = typeof item.rate === "number" ? item.rate : 0;
      const interval = typeof item.fundingIntervalHours === "number" && item.fundingIntervalHours > 0 ? item.fundingIntervalHours : 8;
      const rate8h = interval === 1 ? Number((rate * 8).toFixed(6)) : Number(rate.toFixed(6));

      venues.push({
        name: item.exchangeName,
        rate: Number(rate.toFixed(6)),
        rate8h,
        fundingIntervalHours: interval,
        predictedRate: typeof item.predictedRate === "number" ? Number(item.predictedRate.toFixed(6)) : undefined,
        nextFundingTime: item.nextFundingTime,
        status: item.status ?? 1,
      });
    }

    // Key venues priority for aggregate: Binance, OKX, Bybit, Hyperliquid
    const keyNames = new Set(["Binance", "OKX", "Bybit", "Hyperliquid"]);
    const activeKey = venues.filter((v) => keyNames.has(v.name) && v.status === 1);
    const pool = activeKey.length > 0 ? activeKey : venues.filter((v) => v.status === 1);

    const fundingPct8h = pool.length > 0
      ? Number((pool.reduce((acc, v) => acc + v.rate8h, 0) / pool.length).toFixed(6))
      : 0;

    // Optional series from chart endpoint if reachable
    let series: unknown[] = [];
    try {
      const rawChart = (await cgGet(`/api/fundingRate/chart?symbol=${encodeURIComponent(sym)}`, 60_000)) as Record<string, unknown> | null;
      if (rawChart && typeof rawChart === "object" && !Array.isArray(rawChart)) {
        // Collect quotes across exchanges
        const points: { exchange: string; quote: string; rate: number; ts: number }[] = [];
        for (const [ex, list] of Object.entries(rawChart)) {
          if (Array.isArray(list)) {
            for (const row of list) {
              if (row && typeof row === "object" && "fundingRate" in row) {
                points.push({
                  exchange: ex,
                  quote: String((row as { quoteCurrency?: string }).quoteCurrency ?? "USDT"),
                  rate: Number((row as { fundingRate: number }).fundingRate ?? 0),
                  ts: Number((row as { updateTime?: number }).updateTime ?? Date.now()),
                });
              }
            }
          }
        }
        series = points;
      }
    } catch {
      series = [];
    }

    return NextResponse.json({
      ok: true,
      sym,
      venues,
      aggregate: {
        fundingPct8h,
      },
      series,
      updatedAt: Date.now(),
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "funding fetch failed" },
      { status: 502 }
    );
  }
}
