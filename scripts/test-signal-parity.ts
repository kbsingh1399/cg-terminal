/**
 * Parity test: run the exact-ported Coinglass signal engine on the exact same
 * API data the live page uses (m15×300 time set, m1×1000 for vol/range sets),
 * print the three signal sets like the live Signals panel.
 *
 * Run: bun scripts/test-signal-parity.ts
 */
import { autoThreshold, buildDerivedBars, computeCgSignals, cgSigName, cgSigText, fmtQty, fmtPriceDec, priceDecimals, type FpBar } from "../src/lib/cg/cg-signals";

const BASE = "http://localhost:3000";

async function loadSeries(itv: string, limit: number): Promise<FpBar[]> {
  const res = await fetch(`${BASE}/api/cg/fp?sym=BTC&itv=${itv}&limit=${limit}`);
  const json = await res.json();
  if (!json.ok) throw new Error(`fp ${itv}: ${json.error}`);
  return json.bars as FpBar[];
}

function summarize(name: string, bars: FpBar[], label: string) {
  const sigs = computeCgSignals(bars);
  const bull = sigs.filter((s) => s.side === "buy").length;
  console.log(`\n=== ${name} [${label}] — ${sigs.length} signals: ${bull} bullish, ${sigs.length - bull} bearish ===`);
  const byType: Record<string, number> = {};
  for (const s of sigs) byType[s.t] = (byType[s.t] ?? 0) + 1;
  console.log("by type:", JSON.stringify(byType));
  const dp = priceDecimals(bars[bars.length - 1]?.c ?? 0);
  for (const s of sigs.slice(-8)) {
    const [title, detail] = cgSigText(s, bars, "qty");
    console.log(
      `  ${new Date(s.ts * 1000).toISOString().slice(5, 16).replace("T", " ")} [${label}] ${cgSigName(s)} (${s.side}) · ${title} — ${detail} · ${fmtPriceDec(s.p, dp)}`
    );
  }
  return sigs;
}

async function main() {
  const timeBars = await loadSeries("m15", 300);
  const m1 = await loadSeries("m1", 1000);
  console.log(`m15 bars: ${timeBars.length}, m1 bars: ${m1.length}`);

  const volThr = autoThreshold(m1, "vol");
  const rangeThr = autoThreshold(m1, "range");
  console.log(`auto volume threshold: ${volThr} (${fmtQty(volThr)} BTC)`);
  console.log(`auto range threshold: ${rangeThr}`);

  const timeSigs = summarize("TIME 15m", timeBars, "15m");
  const volBars = buildDerivedBars(m1, "vol", volThr);
  const volSigs = summarize(`VOLUME ${fmtQty(volThr)} BTC`, volBars, `Volume ${fmtQty(volThr)} BTC`);
  const rangeBars = buildDerivedBars(m1, "range", rangeThr);
  const rangeSigs = summarize(`RANGE ${rangeThr}`, rangeBars, `Range ${rangeThr}`);

  const all = timeSigs.length + volSigs.length + rangeSigs.length;
  const allBull = [...timeSigs, ...volSigs, ...rangeSigs].filter((s) => s.side === "buy").length;
  console.log(`\n>>> ALL: ${all} signals: ${allBull} bullish, ${all - allBull} bearish (15m ${timeSigs.length}, Volume ${volSigs.length}, Range ${rangeSigs.length})`);
  console.log(`>>> vol bars: ${volBars.length}, range bars: ${rangeBars.length}`);
}

main().catch((e) => {
  console.error("FAILED:", e);
  process.exit(1);
});
