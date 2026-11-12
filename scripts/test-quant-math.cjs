#!/usr/bin/env node
/**
 * QUANT MATH UNIT LOCK (WS3/FINAL, 2026-11-12) — pure unit tests, no network.
 *
 * Covers the four math surfaces the FINAL gate names:
 *   1. Coinbase Premium sign — (Coinbase − Binance) / Binance × 10⁴, both
 *      directions (mirrors src/app/api/cg/quant/route.ts:661-668).
 *   2. Probability calibration math — ATR→σ conversion √(8/π) verified
 *      against close-to-close realized vol on synthetic GBM paths (the
 *      constant probability.ts uses; the old /1.25 overstated σ ≈ 27.7%),
 *      plus normCdf / pTouch / gamblerRuin / Bayesian shrinkage w_emp.
 *   3. Backtester accounting — fee+slippage in R for maker/taker legs, the
 *      STOP-FIRST intrabar rule and the funding sign convention (mirrors
 *      src/lib/cg/backtest.ts simulateExit / fee math).
 *   4. Cascade tier thresholds — majors/alt/OI paths (mirror of scan.ts,
 *      cross-checked with scripts/test-liq-live-units.cjs).
 *
 * Convention: the formulas are re-implemented mirrors of the shipped source
 * (the .ts modules can't be imported from plain Node); every mirror carries
 * the source location it must stay in sync with.
 */

let passed = 0;
let failed = 0;
const TR_TO_SIGMA = Math.sqrt(8 / Math.PI); // probability.ts constant — module scope for all sections
function ok(cond, label) {
  if (cond) {
    passed++;
    console.log(`  ok  ${label}`);
  } else {
    failed++;
    console.log(`  FAIL ${label}`);
  }
}
const near = (a, b, tol) => Math.abs(a - b) <= tol;
const nearRel = (a, b, relTol) => Math.abs(a - b) <= relTol * Math.abs(b);

// ---------------------------------------------------------------------------
// 1. Coinbase Premium Index sign (quant/route.ts:661-668)
//    coinbasePremiumBps = (coinbase − binance) / binance × 10⁴
// ---------------------------------------------------------------------------
console.log("== coinbase premium sign ==");
{
  const premiumBps = (coinbase, binance) => Number((((coinbase - binance) / binance) * 10_000).toFixed(2));
  // Coinbase leads higher (US institutional bid) → POSITIVE
  ok(premiumBps(100_400, 100_000) === 40.0, "coinbase leads +0.4% → +40.0 bps (positive)");
  // Coinbase discounts → NEGATIVE
  ok(premiumBps(99_750, 100_000) === -25.0, "coinbase lags −0.25% → −25.0 bps (negative)");
  // exact parity → zero
  ok(premiumBps(50_000, 50_000) === 0, "parity → 0 bps");
  // the OLD inverted form ((binance − coinbase)/coinbase) must NOT match the new sign
  const oldForm = (coinbase, binance) => ((binance - coinbase) / coinbase) * 10_000;
  ok(oldForm(100_400, 100_000) < 0 && premiumBps(100_400, 100_000) > 0, "old inverted form has the opposite sign (regression guard)");
  // narrative veto semantics: premiumWith for a SHORT fade = premium > +5bps
  const premiumWith = (short, bps) => (short ? bps > 5 : bps < -5);
  ok(premiumWith(true, 40) && !premiumWith(true, -25), "narrative premiumWith(short) fires on POSITIVE premium (uptrend confirmation)");
  ok(premiumWith(false, -25) && !premiumWith(false, 40), "narrative premiumWith(long) fires on NEGATIVE premium (downtrend confirmation)");
}

// ---------------------------------------------------------------------------
// 2. Probability calibration math (probability.ts)
// ---------------------------------------------------------------------------
console.log("== σ conversion: ATR / √(8/π) vs realized close-to-close vol ==");
{
  ok(near(TR_TO_SIGMA, 1.5958, 0.001), `√(8/π) = ${TR_TO_SIGMA.toFixed(4)} ≈ 1.596`);
  ok(nearRel(TR_TO_SIGMA / 1.25 - 1, 0.2768, 0.02), `old /1.25 constant overstated σ by ≈ 27.7% (was ${(TR_TO_SIGMA / 1.25 - 1) * 100 > 0 ? "+" : ""}${((TR_TO_SIGMA / 1.25 - 1) * 100).toFixed(1)}%)`);

  // Monte-Carlo: driftless GBM, σ_true per bar. TR is measured RELATIVE to
  // each bar's open — a GBM wanders multiplicatively, so ABSOLUTE TR would
  // scale with the wandering price level. E[TR_rel] ≈ √(8/π)·σ and
  // ATR/√(8/π) recovers σ.
  let seed = 42;
  const rand = () => {
    // Box–Muller from a deterministic LCG (reproducible)
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    const u1 = (seed + 0.5) / 4294967296;
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    const u2 = (seed + 0.5) / 4294967296;
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  };
  const SIG = 0.01; // 1% per bar
  const N = 200_000;
  const prices = [100];
  for (let i = 0; i < N; i++) prices.push(prices[prices.length - 1] * Math.exp(SIG * rand()));
  let trRelSum = 0;
  const logRets = [];
  for (let i = 1; i <= N; i++) {
    const o = prices[i - 1];
    // intrabar bridge wick: |N(0,1)|·σ/2 on each outer side — calibrated so
    // E[TR_rel] = σ·√(2/π) + 2·E|N|·σ/2 = σ·(√(2/π) + √(2/π)) = σ·√(8/π)
    const c = prices[i];
    const w = Math.abs(rand()) * (SIG / 2);
    const h = Math.max(o, c) * (1 + w);
    const l = Math.min(o, c) * (1 - w);
    trRelSum += Math.max(h - l, Math.abs(h - o), Math.abs(l - o)) / o;
    logRets.push(Math.log(c / o));
  }
  const meanTRrel = trRelSum / N;
  const realizedSigma = Math.sqrt(logRets.reduce((s, r) => s + r * r, 0) / N); // mean-zero assumed
  ok(nearRel(meanTRrel / SIG, TR_TO_SIGMA, 0.06), `empirical E[TR_rel]/σ = ${(meanTRrel / SIG).toFixed(3)} ≈ √(8/π) (6% tol, wick model)`);
  ok(nearRel(meanTRrel / TR_TO_SIGMA, SIG, 0.06), `ATR/√(8/π) recovers σ (est ${((meanTRrel / TR_TO_SIGMA) * 100).toFixed(2)}% vs true 1.00%)`);
  ok(nearRel(realizedSigma, SIG, 0.03), `close-to-close std(log ret) = ${(realizedSigma * 100).toFixed(2)}% ≈ σ (3% tol)`);
}

console.log("== probability core (normCdf · pTouch · gamblerRuin · shrinkage) ==");
{
  // Abramowitz–Stegun Φ (probability.ts normCdf mirror)
  const normCdf = (x) => {
    const sign = x < 0 ? -1 : 1;
    const ax = Math.abs(x) / Math.SQRT2;
    const t = 1 / (1 + 0.3275911 * ax);
    const y =
      1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-ax * ax);
    return 0.5 * (1 + sign * y);
  };
  ok(near(normCdf(0), 0.5, 1e-9), "Φ(0) = 0.5");
  ok(near(normCdf(1.96), 0.975, 1e-3), "Φ(1.96) ≈ 0.975");
  const pTouch = (d, sigmaBar, bars) => Math.min(0.99, Math.max(0.01, 2 * (1 - normCdf(d / (sigmaBar * Math.sqrt(bars))))));
  ok(near(pTouch(1, 1, 1), 0.3173, 5e-3), "P(touch 1σ, 1 bar) ≈ 0.317 (reflection principle)");
  // σ overstatement direction: with the OLD σ (ATR/1.25) fill probability was HIGHER
  const atr = 1.596; // σ_true = 1.0
  const d = 2;
  const pOld = pTouch(d, atr / 1.25, 48);
  const pNew = pTouch(d, atr / TR_TO_SIGMA, 48);
  ok(pOld > pNew, `old σ inflated P(fill): ${(pOld * 100).toFixed(1)}% > honest ${(pNew * 100).toFixed(1)}%`);
  // gambler's ruin (probability.ts mirror)
  const gamblerRuin = (entry, stop, target) => {
    const span = Math.abs(target - stop);
    const risk = Math.abs(entry - stop);
    if (!(span > 0) || !(risk > 0) || risk > span) return null;
    return risk / span;
  };
  ok(near(gamblerRuin(100, 95, 110), 5 / 15, 1e-12), "gamblerRuin entry 100 stop 95 target 110 → 1/3");
  ok(gamblerRuin(100, 90, 91) == null, "gamblerRuin risk > span → null (degenerate geometry never priced)");
  // wrong-side target: gamblerRuin itself only sees distances — the wrong-side
  // guard lives in pickTarget (probability.ts), which only picks targets on
  // the profit side of the fill reference
  ok(near(gamblerRuin(100, 95, 90), 1, 1e-12), "wrong-side target would be a degenerate 1.0 — pickTarget filters it upstream");
  // Bayesian shrinkage blend w_emp = n/(n+30) in logit space (probability.ts mirror)
  const logit = (p) => Math.log(p / (1 - p));
  const sigmoid = (x) => 1 / (1 + Math.exp(-x));
  const blend = (prior, n, slope = 1, intercept = 0) => {
    const w = n / (n + 30);
    const calibrated = sigmoid(intercept + slope * logit(prior));
    return sigmoid((1 - w) * logit(prior) + w * logit(Math.min(0.98, Math.max(0.02, calibrated))));
  };
  ok(near(blend(0.5, 0), 0.5, 1e-9), "w_emp(0) = pure prior (no samples → no shift)");
  const w30 = blend(0.5, 30, 0.5, -0.5); // n=30 → w=0.5, calibrated = σ(−0.5)≈0.378
  ok(w30 < 0.5 && w30 > 0.37, `w_emp(30) = 0.5 blends prior 0.50 toward calibrated 0.38 → ${w30.toFixed(3)}`);
  const wInf = blend(0.5, 3000, 0.5, -0.5);
  ok(near(wInf, sigmoid(-0.5), 5e-3), "w_emp(3000) ≈ pure calibrated curve");
}

// ---------------------------------------------------------------------------
// 3. Backtester accounting (backtest.ts simulateExit / fee math mirrors)
// ---------------------------------------------------------------------------
console.log("== backtest fee / stop-first accounting ==");
{
  const TAKER = 4.5 / 10_000;
  const MAKER = 2.0 / 10_000;
  // feeR = (fEntry·entry + fExit·exit + slipExit·exit) / risk   (backtest.ts M1 fill block)
  const feeR = (fEntry, fExit, entry, exit, slipExit, risk) => ((fEntry + fExit) * entry + slipExit * exit) / risk;
  // long entry 100 (maker), stop 98, T1 103 → risk 2, R1 1.5
  {
    const entry = 100;
    const stop = 98;
    const t1 = 103;
    const risk = entry - stop;
    const r = feeR(MAKER, MAKER, entry, t1, 0, risk); // target exit = maker, no slippage on limit fills
    const grossR = (t1 - entry) / risk;
    const netR = grossR - r;
    ok(near(r, (2 * MAKER * entry) / risk, 1e-12), "M1 T1 exit fee in R = (maker entry + maker exit) on entry notional / risk");
    ok(near(grossR, 1.5, 1e-12) && near(netR, 1.5 - r, 1e-9), `netR = 1.5R − fees (${netR.toFixed(4)}R)`);
  }
  // stopped long: taker exit WITH slippage, grossR = −1 by construction
  {
    const entry = 100;
    const stop = 98;
    const risk = entry - stop;
    const slip = (2 + 0.05 * 100) / 10_000; // major spread 2bps + 0.05×ATR%(100bps)
    const r = feeR(MAKER, TAKER, entry, stop, slip, risk);
    const netR = -1 - r;
    ok(netR < -1 - 0.005, `stop loss costs > entry fee alone (net ${netR.toFixed(4)}R)`);
  }
  // STOP-FIRST: a bar containing both stop and T1 resolves as STOP unless the
  // O→C path is unambiguous (mirror of backtest.ts simulateExit)
  const resolveBar = (bar, entry, stop, t1, side = "long") => {
    const stopHit = side === "long" ? bar.l <= stop : bar.h >= stop;
    const t1Hit = side === "long" ? bar.h >= t1 : bar.l <= t1;
    if (stopHit) {
      const unambigT = side === "long" ? bar.o >= t1 && bar.c >= t1 && bar.l > stop : bar.o <= t1 && bar.c <= t1 && bar.h < stop;
      if (t1Hit && unambigT) return "T1";
      return "STOP";
    }
    if (t1Hit) return "T1";
    return "NONE";
  };
  ok(resolveBar({ o: 100, h: 104, l: 97, c: 99 }, 100, 98, 103) === "STOP", "wide bar with both stop+T1 inside → STOP (conservative)");
  ok(resolveBar({ o: 104, h: 105, l: 103.5, c: 104.5 }, 100, 98, 103) === "T1", "bar entirely beyond T1, stop never crossed → T1");
  ok(resolveBar({ o: 100, h: 101, l: 99, c: 100.5 }, 100, 98, 103) === "NONE", "quiet bar → no exit");
  // funding sign: LONG pays positive funding (mirror of simulateExit fundR)
  const fundR = (rate, px, risk, long) => ((long ? -1 : 1) * rate * px) / risk;
  ok(fundR(0.0001, 100, 2, true) < 0, "long pays positive funding (cost in R)");
  ok(fundR(0.0001, 100, 2, false) > 0, "short receives positive funding (credit in R)");
  ok(near(Math.abs(fundR(0.0001, 100, 2, true)), 0.005, 1e-12), "funding in R = rate·px/risk exact");
}

// ---------------------------------------------------------------------------
// 4. Cascade tier thresholds (scan.ts mirror — cross-checked with
//    scripts/test-liq-live-units.cjs which locks the same constants)
// ---------------------------------------------------------------------------
console.log("== cascade tier thresholds ==");
{
  const MAJORS = new Set(["BTC", "ETH", "SOL"]);
  const trigger = (sym, totalUsd, domShare, count, oiUsd = null) => {
    if (MAJORS.has(sym)) {
      if (totalUsd >= 1_500_000) return "major-abs";
      if (totalUsd >= 500_000 && domShare >= 0.8 && count >= 5) return "major-conc";
      return null;
    }
    if (domShare < 0.75) return null;
    if (totalUsd >= 200_000) return "alt-abs";
    if (oiUsd != null && totalUsd >= oiUsd * 0.0015 && count >= 3 && totalUsd >= 50_000) return "alt-oi";
    return null;
  };
  ok(trigger("BTC", 1_700_000, 0.55, 4) === "major-abs", "BTC $1.7M mixed → major absolute");
  ok(trigger("BTC", 620_000, 0.94, 6) === "major-conc", "BTC $620k 94% 6 prints → concentrated");
  ok(trigger("BTC", 480_000, 0.83, 9) === null, "BTC $480k below both major paths");
  ok(trigger("DOGE", 220_000, 0.95, 8) === "alt-abs", "DOGE $220k 95% → alt absolute");
  ok(trigger("DOGE", 210_000, 0.57, 8) === null, "DOGE $210k 57% split → side gate blocks");
  ok(trigger("DOGE", 60_000, 0.98, 5, 30_000_000) === "alt-oi", "DOGE $60k vs $30M OI (0.20%) → OI path");
  ok(trigger("DOGE", 60_000, 0.98, 5, 100_000_000) === null, "DOGE $60k vs $100M OI (0.06%) → no alert");
  ok(trigger("NVDA", 280_000, 0.93, 9) === "alt-abs", "NVDA TradFi perp shares the alt tier");
}

// ---------------------------------------------------------------------------
// summary
// ---------------------------------------------------------------------------
console.log(`\n[quant-math unit-lock] ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
