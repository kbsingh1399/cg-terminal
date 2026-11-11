/**
 * SIGNAL PARITY vs COINGLASS — the gold-standard test.
 *
 * Runs the EXACT signal engine Coinglass's footprint page ships in the
 * browser (their `ey`, extracted VERBATIM from their published page bundle —
 * scripts/cg-js/footprint-page.js, byte-identical, eval'd below) against OUR
 * 1:1 port (src/lib/cg/cg-signals.ts computeCgSignals) on the IDENTICAL bar
 * series from our /api/cg/fp route (the Coinglass agg-perp aggregate:
 * Binance+OKX+Bybit+Hyperliquid order flow, Hyperliquid price-shifted onto
 * the Binance lead kline — their eM loader).
 *
 * If both engines emit the same signal list (same bar index, type, side,
 * price and every payload field) for BTC and ETH across time / volume / range
 * bar sets, our Footprint tab generates exactly the same number and type of
 * signals as coinglass.com's footprint page on the same aggregate.
 *
 * Run: bun scripts/parity-vs-coinglass.ts
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  autoThreshold,
  buildDerivedBars,
  computeCgSignals,
  type CgSignal,
  type FpBar,
} from "../src/lib/cg/cg-signals";

const BASE = process.env.PARITY_BASE ?? "http://localhost:3000";

// ---- their engine, VERBATIM (eval guard: local file we control) -----------
const eySrc = readFileSync(join(__dirname, "..", "scripts", "cg-ey-verbatim.js"), "utf8");
const cgEy = new Function(`${eySrc}; return ey;`)() as (e: CgSeries) => unknown[];

interface CgSeries {
  n: number;
  F: (FpBar["fp"] | null)[];
  O: number[];
  H: number[];
  L: number[];
  C: number[];
}

function toTheirShape(bars: FpBar[]): CgSeries {
  return {
    n: bars.length,
    F: bars.map((b) => b.fp ?? null),
    O: bars.map((b) => b.o),
    H: bars.map((b) => b.h),
    L: bars.map((b) => b.l),
    C: bars.map((b) => b.c),
  };
}

// ---- compare --------------------------------------------------------------
const NUMERIC_KEYS = ["i", "p", "r", "q", "u", "lo", "hi", "j", "i0", "p0", "dc"] as const;

function diffSignals(ours: CgSignal[], theirs: unknown[]): string[] {
  const problems: string[] = [];
  if (ours.length !== theirs.length) {
    problems.push(`COUNT ours=${ours.length} coinglass=${theirs.length}`);
  }
  const n = Math.min(ours.length, theirs.length);
  for (let k = 0; k < n; k++) {
    const a = ours[k] as Record<string, unknown>;
    const b = theirs[k] as Record<string, unknown>;
    if (a.i !== b.i || a.t !== b.t || a.side !== b.side) {
      problems.push(`#${k} identity ours=(${a.i},${a.t},${a.side}) cg=(${b.i},${b.t},${b.side})`);
      continue;
    }
    for (const key of NUMERIC_KEYS) {
      const av = a[key];
      const bv = b[key];
      const aNum = typeof av === "number";
      const bNum = typeof bv === "number";
      if (aNum !== bNum) {
        problems.push(`#${k} bar ${a.i} ${a.t}.${key} kind ours=${String(av)} cg=${String(bv)}`);
      } else if (aNum && bNum && Math.abs((av as number) - (bv as number)) > 1e-9) {
        problems.push(`#${k} bar ${a.i} ${a.t}.${key} ours=${av} cg=${bv}`);
      }
    }
  }
  return problems;
}

async function loadSeries(sym: string, itv: string, limit: number): Promise<FpBar[]> {
  const res = await fetch(`${BASE}/api/cg/fp?sym=${sym}&itv=${itv}&limit=${limit}`);
  const json = (await res.json()) as { ok: boolean; error?: string; bars?: FpBar[]; venues?: string[]; missing?: string[] };
  if (!json.ok || !json.bars) throw new Error(`fp ${sym} ${itv}: ${json.error}`);
  const withFp = json.bars.filter((b) => b.fp).length;
  console.log(`  loaded ${sym} ${itv}×${limit}: ${json.bars.length} bars, ${withFp} with fp, venues=[${json.venues?.join(",")}] missing=[${json.missing?.join(",") ?? "-"}]`);
  return json.bars;
}

function summarize(name: string, sigs: CgSignal[]): void {
  const byType: Record<string, number> = {};
  for (const s of sigs) byType[s.t] = (byType[s.t] ?? 0) + 1;
  const bull = sigs.filter((s) => s.side === "buy").length;
  console.log(`    ${name}: ${sigs.length} signals (${bull} buy / ${sigs.length - bull} sell) by type ${JSON.stringify(byType)}`);
}

async function parityFor(sym: string): Promise<boolean> {
  console.log(`\n=== ${sym} — parity vs Coinglass ey (verbatim) ===`);
  let allOk = true;

  const timeBars = await loadSeries(sym, "m15", 300);
  const m1 = await loadSeries(sym, "m1", 1000);

  const sets: [string, FpBar[]][] = [["TIME 15m×300", timeBars]];
  const volThr = autoThreshold(m1, "vol");
  const rangeThr = autoThreshold(m1, "range");
  sets.push([`VOLUME ${volThr}`, buildDerivedBars(m1, "vol", volThr)]);
  sets.push([`RANGE ${rangeThr}`, buildDerivedBars(m1, "range", rangeThr)]);

  for (const [label, bars] of sets) {
    const ours = computeCgSignals(bars);
    const theirs = cgEy(toTheirShape(bars));
    const problems = diffSignals(ours, theirs);
    summarize(`${label} ours`, ours);
    summarize(`${label} cg  `, theirs as CgSignal[]);
    if (problems.length) {
      allOk = false;
      console.log(`    ✗ MISMATCH (${problems.length}):`);
      for (const p of problems.slice(0, 8)) console.log(`      ${p}`);
    } else {
      console.log(`    ✓ identical (${ours.length} signals, every field)`);
    }
  }
  return allOk;
}

async function main() {
  const ok1 = await parityFor("BTC");
  const ok2 = await parityFor("ETH");
  console.log(`\n>>> PARITY ${ok1 && ok2 ? "PASS — our engine emits exactly what Coinglass's own page engine emits on the same aggregate" : "FAIL"}`);
  if (!(ok1 && ok2)) process.exit(1);
}

main().catch((e) => {
  console.error("FAILED:", e);
  process.exit(1);
});
