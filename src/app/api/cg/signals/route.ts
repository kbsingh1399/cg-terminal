import { NextRequest, NextResponse } from "next/server";
import { getSignalsSnapshot, type SignalSetInfo } from "@/lib/cg/scan";
import { isAsset } from "@/lib/cg/assets";
import { loadFpBars } from "@/lib/cg/fp-load";
import { autoThreshold, buildDerivedBars, computeCgSignals, cgSigName, cgSigText, type FpBar } from "@/lib/cg/cg-signals";

export const dynamic = "force-dynamic";

/**
 * GET /api/cg/signals?sym=BTC&bt=all|time|vol|range
 *
 * Footprint signals for the notification feed / MCP consumers: the exact
 * Coinglass client signal engine on all three bar types (15m time · auto
 * volume · auto range). Served from the scanner cache when warm; computed
 * live on first request otherwise.
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const sym = (sp.get("sym") ?? "BTC").toUpperCase();
  const bt = sp.get("bt") ?? "all";
  if (!isAsset(sym)) {
    return NextResponse.json({ ok: false, error: `unknown asset ${sym}` }, { status: 400 });
  }
  let snap = getSignalsSnapshot(sym);
  let computed = false;
  if (!snap) {
    computed = true;
    try {
      const timeRes = await loadFpBars(sym, "m15", 300);
      const m1Res = await loadFpBars(sym, "m1", 1000);
      const volThr = autoThreshold(m1Res.bars, "vol");
      const rangeThr = autoThreshold(m1Res.bars, "range");
      const seriesByBt = new Map<string, FpBar[]>([["time", timeRes.bars]]);
      const sets: SignalSetInfo[] = [
        { bt: "time", label: "15m", sigs: computeCgSignals(timeRes.bars).map((s) => ({ ...s, bt: "time" as const })) },
      ];
      if (volThr > 0) {
        const bars = buildDerivedBars(m1Res.bars, "vol", volThr);
        seriesByBt.set("vol", bars);
        sets.push({ bt: "vol", label: `Volume ${volThr.toLocaleString("en-US")} ${sym}`, sigs: computeCgSignals(bars).map((s) => ({ ...s, bt: "vol" as const })) });
      }
      if (rangeThr > 0) {
        const bars = buildDerivedBars(m1Res.bars, "range", rangeThr);
        seriesByBt.set("range", bars);
        sets.push({ bt: "range", label: `Range ${rangeThr}`, sigs: computeCgSignals(bars).map((s) => ({ ...s, bt: "range" as const })) });
      }
      let bullish = 0;
      let bearish = 0;
      for (const set of sets) for (const s of set.sigs) s.side === "buy" ? bullish++ : bearish++;
      snap = {
        sym,
        sets: sets.map((set) => ({
          ...set,
          sigs: set.sigs.map((s) => {
            const [main, sub] = cgSigText(s, seriesByBt.get(set.bt) ?? timeRes.bars, "usd");
            return { ...s, name: cgSigName(s), main, sub };
          }),
        })),
        counts: { all: bullish + bearish, bullish, bearish },
        thresholds: { vol: volThr, range: rangeThr },
        bars: timeRes.bars.length,
        updatedAt: Date.now(),
      };
    } catch (e) {
      return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "compute failed" }, { status: 502 });
    }
  }
  const sets = bt === "all" ? snap.sets : snap.sets.filter((s) => s.bt === bt);
  return NextResponse.json({ ok: true, sym, bt, computed, counts: snap.counts, thresholds: snap.thresholds, sets, updatedAt: snap.updatedAt });
}
