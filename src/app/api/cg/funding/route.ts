import { NextRequest, NextResponse } from "next/server";
import { cgGet } from "@/lib/cg/client";
import { isAsset } from "@/lib/cg/assets";
import { anyTerminalSym } from "@/lib/cg/sym-gate";
import { resolveCgSym } from "@/lib/binance/aliases";
import { getUniverse, isBinanceSym } from "@/lib/binance/universe";
import { classicOf } from "@/lib/cg/classic";
import { fetchBinFunding, fetchHlCtxAndBook } from "@/lib/cg/fallbacks";

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
 * Curated perps are members since 2026-11-12 — verified live: the funding
 * home list carries every TradFi plain name too (NVDA/XAU 4h intervals,
 * SOXL/ANTHROPIC 8h, across Binance/OKX/Bybit/KuCoin/MEXC).
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const sym = (sp.get("sym") ?? "BTC").trim().toUpperCase();

  if (!(await anyTerminalSym(sym))) {
    return NextResponse.json({ ok: false, error: `unknown asset ${sym}` }, { status: 400 });
  }

  const cgSym = resolveCgSym(sym);

  try {
    let venues: FundingVenue[] = [];
    let series: unknown[] = [];
    let source = "coinglass";

    try {
      const rawHome = (await cgGet("/api/fundingRate/v2/home", 30_000)) as RawSymbolItem[] | null;
      const items = Array.isArray(rawHome) ? rawHome : [];
      const symItem = items.find((x) => x.symbol?.toUpperCase() === cgSym);
      const rawList = symItem?.uMarginList ?? symItem?.cMarginList ?? [];

      for (const item of rawList) {
        if (!item || !item.exchangeName) continue;
        const rate = typeof item.rate === "number" ? item.rate : 0;
        const interval =
          typeof item.fundingIntervalHours === "number" && item.fundingIntervalHours > 0
            ? item.fundingIntervalHours
            : 8;
        const rate8h = Number((rate * (8 / interval)).toFixed(6));

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

      if (venues.length > 0) {
        try {
          const rawChart = (await cgGet(`/api/fundingRate/chart?symbol=${encodeURIComponent(cgSym)}`, 60_000)) as Record<
            string,
            unknown
          > | null;
          if (rawChart && typeof rawChart === "object" && !Array.isArray(rawChart)) {
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
      }
    } catch {
      venues = [];
    }

    // Fallback 1: direct Binance USDT-M /fapi/v1/premiumIndex
    if (!venues.length) {
      await getUniverse();
      const classic = classicOf(sym);
      if (isAsset(cgSym) || isBinanceSym(cgSym) || !!classic?.binPair) {
        const bf = await fetchBinFunding(sym);
        if (bf) {
          source = "binance-fapi";
          venues = [
            {
              name: "Binance",
              rate: bf.ratePct8h,
              rate8h: bf.ratePct8h,
              fundingIntervalHours: 8,
              nextFundingTime: bf.nextFundingTime,
              status: 1,
            },
          ];
        }
      }
    }

    // Fallback 2: Hyperliquid xyz perp funding (1h interval -> *8 for 8h carry)
    if (!venues.length) {
      const hl = await fetchHlCtxAndBook(sym);
      if (hl?.ctx?.funding != null) {
        source = "hl-xyz";
        const r1h = Number((Number(hl.ctx.funding) * 100).toFixed(6));
        const r8h = Number((r1h * 8).toFixed(6));
        venues = [
          {
            name: "Hyperliquid",
            rate: r1h,
            rate8h: r8h,
            fundingIntervalHours: 1,
            status: 1,
          },
        ];
      }
    }

    if (!venues.length) {
      return NextResponse.json({
        ok: true,
        supported: false,
        sym,
        reason: "No perpetual funding contract upstream for this benchmark",
        venues: [],
        aggregate: { fundingPct8h: null },
        series: [],
        updatedAt: Date.now(),
      });
    }

    const keyNames = new Set(["Binance", "OKX", "Bybit", "Hyperliquid"]);
    const activeKey = venues.filter((v) => keyNames.has(v.name) && v.status === 1);
    const pool = activeKey.length > 0 ? activeKey : venues.filter((v) => v.status === 1);

    const fundingPct8h =
      pool.length > 0
        ? Number((pool.reduce((acc, v) => acc + v.rate8h, 0) / pool.length).toFixed(6))
        : 0;

    return NextResponse.json({
      ok: true,
      supported: true,
      source,
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
