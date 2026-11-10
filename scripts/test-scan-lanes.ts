/**
 * Scan-lane cadence test — the P1 from the external AI review: the "fast"
 * tier was scanned every 18.2 min while the "slow" tier got 6.0 min (inverted)
 * and 719/959 fast-lane ticks were no-ops. Simulates BOTH schedules (old vs
 * new) over 24h with the real tier assignments from assets.ts.
 */
const ASSETS = [
  ["BTC", "fast"], ["ETH", "fast"], ["SOL", "fast"],
  ["BNB", "slow"], ["XRP", "slow"], ["ADA", "slow"], ["AVAX", "slow"],
  ["DOGE", "slow"], ["LINK", "slow"], ["LTC", "slow"], ["XAU", "slow"], ["XAG", "slow"],
];

function simulate(name, lanes) {
  const scans = new Map(ASSETS.map(([s]) => [s, 0]));
  const last = new Map();
  const gaps = { fast: [], slow: [] };
  let ticks = 0, noops = 0;
  const H = 24 * 3600_000;
  for (const [lane, periodMs, tier] of lanes) {
    let i = 0;
    for (let t = 0; t < H; t += periodMs) {
      ticks++;
      const sym = lane[i++ % lane.length];
      if (tier && ASSETS.find(([s]) => s === sym)[1] !== tier) { noops++; continue; }
      const gap = last.has(sym) ? t - last.get(sym) : null;
      const t2 = ASSETS.find(([s]) => s === sym)[1];
      if (gap != null) gaps[t2].push(gap);
      last.set(sym, t);
      scans.set(sym, scans.get(sym) + 1);
    }
  }
  const avg = (a) => (a.length ? (a.reduce((x, y) => x + y, 0) / a.length / 60000).toFixed(1) : "-");
  console.log(`\n=== ${name} ===`);
  console.log(`  ticks=${ticks}  no-op ticks=${noops}  (${((noops / ticks) * 100).toFixed(0)}% wasted)`);
  console.log(`  BTC/ETH/SOL scan interval: ${avg(gaps.fast)} min   (24h scans: ${scans.get("BTC")})`);
  console.log(`  alt/metals  scan interval: ${avg(gaps.slow)} min   (24h scans: ${scans.get("XRP")})`);
  const total = [...scans.values()].reduce((a, b) => a + b, 0);
  console.log(`  total scans/24h = ${total}  → ${(total / 1440).toFixed(2)} scans/min`);
}

const list = ASSETS.map(([s]) => s);
// OLD (d656f57): both lanes iterate the FULL 12-item list and skip the other tier
simulate("OLD schedule (shared 12-item index + skip)", [
  [list, 30_000, "slow"],   // skips fast assets
  [list, 90_000, "fast"],   // skips slow assets
]);
// NEW: per-tier lanes over their OWN lists
const fast = list.filter((s) => ASSETS.find(([a]) => a === s)[1] === "fast");
const slow = list.filter((s) => ASSETS.find(([a]) => a === s)[1] === "slow");
simulate("NEW schedule (per-tier lanes)", [
  [slow, 90_000, null],
  [fast, 60_000, null],
]);
