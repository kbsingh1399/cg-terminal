/**
 * Reproduce the FootprintTool client-side computation for the CURRENT live
 * state (volume bars from the aggregated m1 series) and hunt for the bar
 * that poisons the y-scale (pLo ~ 0).
 */
import { autoThreshold, buildDerivedBars, type FpBar } from "../src/lib/cg/cg-signals";

const BASE = "http://localhost:3000";

async function load(itv: string, limit: number, live = false): Promise<FpBar[]> {
  const res = await fetch(`${BASE}/api/cg/fp?sym=BTC&itv=${itv}&limit=${limit}${live ? "&live=1" : ""}`);
  const j = (await res.json()) as { ok: boolean; bars?: FpBar[] };
  if (!j.ok || !j.bars) throw new Error("load failed");
  return j.bars;
}

// mergeTail — same semantics as the tool (same-ts: fresh wins)
function mergeTail(big: FpBar[], small: FpBar[]): FpBar[] {
  if (!small.length) return big;
  const byTs = new Map(small.map((b) => [b.ts, b]));
  return big.map((b) => byTs.get(b.ts) ?? b).concat(small.filter((b) => !big.some((x) => x.ts === b.ts)));
}

async function main() {
  const m1 = await load("m1", 1000);
  const liveM1 = await load("m1", 8, true);
  const series = mergeTail(m1, liveM1);
  console.log("m1 bars:", m1.length, "live bars:", liveM1.length, "merged:", series.length);

  const thr = autoThreshold(series, "vol");
  console.log("auto vol threshold:", thr);

  const volBars = buildDerivedBars(series, "vol", thr);
  console.log("vol bars:", volBars.length);
  const bad = volBars.filter((b) => !(b.l > 1000 && b.h >= b.l));
  console.log("bad vol bars (l<=1000):", bad.length);
  for (const b of bad.slice(0, 10)) {
    console.log("  BAD ts", b.ts, "o", b.o, "h", b.h, "l", b.l, "c", b.c, "fp", b.fp ? `tick=${b.fp.tick} lo=${b.fp.lo} rows=${b.fp.b.length}` : "null");
  }
  const lows = volBars.map((b) => b.l).sort((a, b) => a - b);
  console.log("lowest 5 vol-bar lows:", lows.slice(0, 5));
  // also fp grid extremes vs bar range
  for (const b of volBars) {
    if (!b.fp) continue;
    const hi = b.fp.lo + b.fp.b.length * b.fp.tick;
    if (b.fp.lo < b.l * 0.8 || hi > b.h * 1.25) {
      console.log("  EXT ts", b.ts, "fp.lo", b.fp.lo, "fp.hi", hi, "bar l", b.l, "bar h", b.h, "tick", b.fp.tick, "rows", b.fp.b.length);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
