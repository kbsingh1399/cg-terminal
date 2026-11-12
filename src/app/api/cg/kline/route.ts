import { NextRequest, NextResponse } from "next/server";
import { cgGet } from "@/lib/cg/client";
import { parseInterval, clampLimit, instrumentKeyOK } from "@/lib/cg/params";
import { fetchBinCandles } from "@/lib/cg/fallbacks";
import type { KlineRow, OiKlineRow } from "@/lib/cg/types";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const type = sp.get("type") === "oi" ? "oi_kline" : "kline";
  const interval = parseInterval(sp.get("interval"));
  if (!interval) {
    return NextResponse.json({ ok: false, error: "invalid interval" }, { status: 400 });
  }
  const limit = clampLimit(sp.get("limit"), 300, 2880);
  const symbol = sp.get("symbol") ?? "Binance_BTCUSDT";
  if (!instrumentKeyOK(symbol)) {
    return NextResponse.json({ ok: false, error: `invalid symbol ${symbol}` }, { status: 400 });
  }
  try {
    let rows = (await cgGet(
      `/api/v2/kline?symbol=${encodeURIComponent(`${symbol}#${type}`)}&interval=${interval}&minLimit=false&limit=${limit}`,
      15_000
    ).catch(() => null)) as KlineRow[] | OiKlineRow[] | null;

    if ((!Array.isArray(rows) || !rows.length) && type === "kline" && symbol.startsWith("Binance_")) {
      const rawBase = symbol.replace(/^Binance_/, "").replace(/USDT$/, "");
      const bin = await fetchBinCandles(rawBase, interval, limit).catch(() => []);
      if (bin.length) {
        rows = bin.map((b) => [Math.floor(b.t / 1000), b.o, b.h, b.l, b.c, b.v] as unknown as KlineRow);
      }
    }

    if (!Array.isArray(rows)) {
      return NextResponse.json({ ok: true, symbol, interval, rows: [] });
    }
    return NextResponse.json({ ok: true, symbol, interval, type, rows });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "fetch failed" }, { status: 502 });
  }
}
