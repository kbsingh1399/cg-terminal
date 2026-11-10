import { NextRequest, NextResponse } from "next/server";
import { cgGet, FAPI } from "@/lib/cg/client";
import { isAsset } from "@/lib/cg/assets";
import type { LtoGroup, LtoSupport } from "@/lib/cg/types";

export const dynamic = "force-dynamic";

/**
 * GET /api/cg/lto?minVolUsd=100000
 * Aggregated open large taker orders (whale resting orders) across every
 * supported venue, sourced from fapi /api/largeTakerOrder/v3 exactly like the
 * live Coinglass large-orderbook-statistics page.
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const minVolUsd = Math.max(0, Number(sp.get("minVolUsd") ?? 100_000) || 0);
  const symbol = (sp.get("symbol") ?? "BTC").toUpperCase();
  if (!isAsset(symbol)) {
    return NextResponse.json({ ok: false, error: `unknown asset ${symbol}` }, { status: 400 });
  }
  try {
    const support = (await cgGet(
      `/api/largeTakerOrder/support/v3?symbol=${encodeURIComponent(symbol)}`,
      10 * 60_000,
      FAPI
    )) as LtoSupport | null;

    const sections = [
      ...(support?.futures ?? []).map((s) => ({ ...s, market: "futures" as const })),
      ...(support?.spot ?? []).map((s) => ({ ...s, market: "spot" as const })),
    ];

    // one call per unique exchange — `market=all` already covers perp + spot
    const byExchange = new Map<string, { market: string; instruments: number }>();
    for (const s of sections) {
      const prev = byExchange.get(s.exchange);
      byExchange.set(s.exchange, {
        market: prev ? "all" : s.market,
        instruments: Math.max(prev?.instruments ?? 0, s.instruments?.length ?? 0),
      });
    }
    const exchanges = [...byExchange.entries()];

    // fetch every exchange in parallel (results cached individually upstream of us)
    const settled = await Promise.allSettled(
      exchanges.map(([ex]) =>
        cgGet(
          `/api/largeTakerOrder/v3?exchange=${encodeURIComponent(ex)}&symbol=${encodeURIComponent(
            symbol
          )}&market=all&limit=3000&minVolUsd=${minVolUsd}`,
          30_000,
          FAPI
        )
      )
    );

    const groups: LtoGroup[] = [];
    const seen = new Set<string>();
    const perExchange: Record<
      string,
      { market: string; instruments: number; openOrders: number; hasData: boolean }
    > = {};
    settled.forEach((r, i) => {
      const [ex, meta] = exchanges[i];
      const entry: { market: string; instruments: number; openOrders: number; hasData: boolean } = (perExchange[ex] = {
        market: meta.market,
        instruments: meta.instruments,
        openOrders: 0,
        hasData: false,
      });
      if (r.status !== "fulfilled" || !Array.isArray(r.value)) return;
      for (const g of r.value as LtoGroup[]) {
        const inst = g.instrument ?? {};
        const key = `${inst.exName}|${inst.instrumentId}|${inst.type}`;
        if (seen.has(key)) continue;
        const list = (g.list ?? []).filter(
          (it) => it && typeof it.price === "number" && it.currentUsd >= minVolUsd
        );
        if (!list.length) continue;
        seen.add(key);
        entry.openOrders += list.length;
        entry.hasData = true;
        groups.push({ instrument: inst, list });
      }
    });

    return NextResponse.json({
      ok: true,
      symbol,
      minVolUsd,
      support: { spot: support?.spot ?? [], futures: support?.futures ?? [] },
      perExchange,
      groups,
      updatedAt: Date.now(),
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "fetch failed" },
      { status: 502 }
    );
  }
}
