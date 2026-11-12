/**
 * SETUP PROBABILITY ENGINE (2026-11-12 directive — "probability consideration
 * in trading setups: probability of pullback entry, mean reversion etc").
 *
 * Transparent structural odds for every armed/quoted agent setup, computed
 * ONLY from live-measured quantities (VWAP z, ATR, entry/stop/target
 * geometry, checklist outcomes). Layers:
 *
 *  1. P(fill) — first-passage (reflection principle) for a driftless walk:
 *     P(max excursion ≥ d within N bars) ≈ 2·(1 − Φ(d / (σ√N)))
 *     σ_bar = ATR(h1) / √(8/π) = ATR(h1) / 1.596 — for a driftless Brownian
 *     motion E[True Range] = σ·√(8/π) ≈ 1.596σ (2026-11-12 WS3 fix: the old
 *     /1.25 constant OVERSTATED per-bar σ by ≈ 27.7% (1.596/1.25 − 1), making
 *     every fill/touch first-passage probability too optimistic; verified
 *     against close-to-close realized vol std(log returns) in
 *     scripts/test-quant-math.cjs). N = the model's TTL in h1 bars (M1 48h,
 *     M2 18h — the same TTLs the Virtual Book expires tickets at, so the
 *     probability describes the exact bet the tracker grades).
 *
 *  2. P(T1 before stop | filled) — gambler's ruin on the fill frame:
 *     p₀ = |E − S| / |T1 − S| (the driftless bound for a two-barrier walk),
 *     then shifted in LOG-ODDS by the checklist edge: each confirming factor
 *     adds its weight, each contradicting factor subtracts it, n/a rows add
 *     nothing (never invented). Result clamped to [0.10, 0.90] — a checklist
 *     can never turn geometry into a "sure thing".
 *
 *  3. P(mean-reversion) for M2 — the user's named case: from the current VWAP
 *     z with the stop at ±3σ, the driftless probability of touching 0σ (the
 *     VWAP magnet) before the stop boundary is p₀ = (3 − |z|)/3, then the
 *     same log-odds edge shift.
 *
 *  4. EMPIRICAL CALIBRATION (WS3 bridge, 2026-11-12): when the walk-forward
 *     backtester has persisted data/cg-series/calibration.json (curves + a
 *     1-D logit fit of realized T1-first outcomes on the structural prior,
 *     per model × regime × tier), the quoted pT1/pMeanRevert blend toward the
 *     empirical curve with Bayesian shrinkage w_emp = n / (n + 30) — a full
 *     prior↔empirical handshake in logit space. The output exposes all three
 *     views (structural prior · historical-backtest calibrated · live Virtual
 *     Book) so nothing is silently overwritten.
 *
 * EV is quoted in R units of the actual plan: EV = pFill·(p·R1 − (1−p)·1)
 * for limit-entry models (the option value of the resting order), and
 * p·R1 − (1−p)·1 for market-entry M2.
 *
 * HONESTY CONTRACT: without calibration the numbers are structural MODEL
 * ESTIMATES (first-passage + gambler's ruin + confluence weights), NOT
 * backtested win rates. The `caveats` field says so in plain words, every
 * factor row carries its weight and direction, and when the Virtual Book has
 * ≥ 10 closed outcomes for the model, the empirical fill/win rates are
 * attached alongside for calibration (small-sample labeled).
 */

import fs from "fs";
import { calibrationPath } from "./backtest";
import type { ActiveModel, ChecklistItem, Direction, NarrativePlan } from "./narrative";
import type { PbStats } from "./paperbook";

// ---------------------------------------------------------------------------
// math helpers
// ---------------------------------------------------------------------------

/** Abramowitz–Stegun 7.1.26 Φ(x) — |err| < 7.5e-8 */
export function normCdf(x: number): number {
  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * ax);
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
      t *
      Math.exp(-ax * ax);
  return 0.5 * (1 + sign * y);
}

/** P(a driftless walk touches distance d within N bars) — reflection principle */
export function pTouch(d: number, sigmaBar: number, bars: number): number | null {
  if (!(d > 0) || !(sigmaBar > 0) || !(bars > 0)) return null;
  const z = d / (sigmaBar * Math.sqrt(bars));
  return Math.min(0.99, Math.max(0.01, 2 * (1 - normCdf(z))));
}

/** driftless two-barrier probability: hit `target` before `stop` from `entry` */
export function gamblerRuin(entry: number, stop: number, target: number): number | null {
  const span = Math.abs(target - stop);
  const risk = Math.abs(entry - stop);
  if (!(span > 0) || !(risk > 0) || risk > span) return null;
  return risk / span;
}

function logit(p: number): number {
  return Math.log(p / (1 - p));
}
function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

/** E[True Range] of a driftless Brownian motion = σ·√(8/π) ≈ 1.5958·σ —
 *  the exact constant converting an ATR estimate back to per-bar σ. */
export const TR_TO_SIGMA = Math.sqrt(8 / Math.PI); // ≈ 1.5958

// ---------------------------------------------------------------------------
// historical calibration curves (data/cg-series/calibration.json — written by
// scripts/backtest-models.ts / runBacktest; read with a 5-min cache)
// ---------------------------------------------------------------------------

interface CalibCurve {
  model: string;
  regime: string;
  tier: string;
  n: number;
  winRate: number | null;
  avgNetR: number | null;
  logitFit: { slope: number; intercept: number; n: number; converged: boolean } | null;
}

interface CalibFile {
  generatedAt: number;
  curves: CalibCurve[];
}

const gCal = globalThis as unknown as { __cgProbCalib?: { at: number; file: CalibFile | null } };

function loadCalibration(): CalibFile | null {
  const hit = gCal.__cgProbCalib;
  if (hit && Date.now() - hit.at < 5 * 60_000) return hit.file;
  let file: CalibFile | null = null;
  try {
    file = JSON.parse(fs.readFileSync(calibrationPath(), "utf8")) as CalibFile;
    if (!file || !Array.isArray(file.curves)) file = null;
  } catch {
    file = null; // no calibration yet — structural estimates stand alone (honest)
  }
  gCal.__cgProbCalib = { at: Date.now(), file };
  return file;
}

/** best calibration curve for this quote (most specific match with n ≥ 10) */
function pickCurve(model: string, regime: string, tier: string): CalibCurve | null {
  const file = loadCalibration();
  if (!file) return null;
  const cands = file.curves.filter(
    (c) =>
      c.model === model &&
      (c.regime === regime || c.regime === "all") &&
      (c.tier === tier || c.tier === "all") &&
      c.n >= 10 &&
      c.logitFit?.converged
  );
  // most specific first: regime+tier > regime > tier > all/all
  const score = (c: CalibCurve) => (c.regime !== "all" ? 2 : 0) + (c.tier !== "all" ? 1 : 0);
  cands.sort((a, b) => score(b) - score(a) || b.n - a.n);
  return cands[0] ?? null;
}

/** Bayesian shrinkage blend in logit space: w_emp = n / (n + 30). */
function blendCalibrated(prior: number, curve: CalibCurve): number {
  const w = curve.n / (curve.n + 30);
  const lp = logit(prior);
  const calibrated = sigmoid((curve.logitFit as { slope: number; intercept: number }).intercept + (curve.logitFit as { slope: number; intercept: number }).slope * lp);
  return sigmoid((1 - w) * lp + w * logit(Math.min(0.98, Math.max(0.02, calibrated))));
}

// ---------------------------------------------------------------------------
// inputs
// ---------------------------------------------------------------------------

export interface ProbInput {
  model: ActiveModel;
  direction: Direction;
  plan: NarrativePlan;
  checklist: ChecklistItem[];
  /** current price */
  price: number | null;
  /** Day VWAP z-score of the current price */
  vwapZ: number | null;
  /** ATR(14) on h1 bars (same series the regime gate uses) */
  atrH1: number | null;
  /** per-bar σ estimate (defaults to atrH1 / √(8/π) ≈ atrH1 / 1.596) */
  sigmaBar?: number | null;
  /** regime label for the historical calibration match (TREND_UP / TREND_DOWN / STRETCH) */
  regime?: string;
  /** asset tier for the historical calibration match (crypto-major / crypto-alt / tradfi) */
  tier?: string;
}

export interface ProbFactor {
  key: string;
  label: string;
  /** log-odds weight magnitude */
  weight: number;
  /** +1 confirming · −1 contradicting · 0 n/a (not counted) */
  dir: 1 | -1 | 0;
  value: string;
}

export interface SetupProbability {
  model: ActiveModel;
  direction: Direction;
  /** P(entry zone touched within TTL) — limit models; 1 for market entries */
  pFill: number | null;
  /** P(T1 before stop | filled) */
  pT1: number | null;
  /** P(T1-first trade taken at the plan's geometry) = pFill × pT1 */
  pWin: number | null;
  /** expected value in R of the plan (T1 ladder rung 1, stop = −1R) */
  evR: number | null;
  /** M2: P(touch 0σ VWAP before the ±3σ stop) from the CURRENT z */
  pMeanRevert: number | null;
  /** hours the probabilities are quoted over (model TTL) */
  horizonH: number | null;
  /** the per-bar σ actually used (measured, documented) */
  sigmaBar: number | null;
  factors: ProbFactor[];
  empirical: { bucket: string; closed: number; fillRatePct: number | null; winRatePct: number | null; avgR: number | null } | null;
  /** Model Prior vs Historical Backtest vs Live Virtual Book (WS3 bridge) */
  views: {
    structuralPrior: { pT1: number | null; pMeanRevert: number | null };
    backtestCalibrated: { pT1: number | null; pMeanRevert: number | null; n: number; curve: string; wEmp: number } | null;
    method: string;
  };
  method: string;
  caveats: string[];
}

/** confluence weights (log-odds units) — documented, sum ≈ 1.75 → a full
 *  pass sheet moves p=0.50 → ≈0.83, a full fail sheet → ≈0.17 */
const WEIGHTS: Record<string, number> = {
  "htf-emas": 0.35,
  footprint: 0.3,
  cvd: 0.2,
  walls: 0.15,
  liq: 0.1,
  "funding-ls": 0.15,
  gex: 0.1,
  r: 0.2,
};

const TTL_H: Record<string, number> = {
  M1_TREND_PULLBACK: 48,
  WAIT_PULLBACK: 48,
  M2_MEAN_REVERSION: 18,
  WATCH_EXHAUSTION: 18,
};

function modelBucket(model: ActiveModel): string {
  if (model === "M1_TREND_PULLBACK" || model === "WAIT_PULLBACK" || model === "M2_MEAN_REVERSION") return model;
  return "ALL";
}

function empiricalOf(model: ActiveModel, stats: PbStats[] | null): SetupProbability["empirical"] {
  if (!stats) return null;
  const bucket = modelBucket(model);
  const row = stats.find((s) => s.bucket === bucket) ?? stats.find((s) => s.bucket === "ALL") ?? null;
  if (!row || row.armed < 10) return null; // small-sample honesty: ≥ 10 armed
  return {
    bucket: row.bucket,
    closed: row.wins + row.losses,
    fillRatePct: row.fillRatePct,
    winRatePct: row.winRatePct,
    avgR: row.expectancyR,
  };
}


/** first plan target on the PROFIT side of `ref` (LONG: above · SHORT: below);
 *  rMultiple from the plan when present, geometry otherwise. A wrong-side
 *  level (data gap) must never price the bet. */
function pickTarget(
  plan: NarrativePlan,
  ref: number,
  direction: Direction
): { level: number; rMultiple: number | null } | null {
  const long = direction !== "SHORT";
  for (const t of plan.targets) {
    if (t.level == null || !Number.isFinite(t.level)) continue;
    const onSide = long ? t.level > ref : t.level < ref;
    if (!onSide) continue;
    return { level: t.level, rMultiple: t.rMultiple };
  }
  return null;
}

// ---------------------------------------------------------------------------
// the engine
// ---------------------------------------------------------------------------

export function buildProbability(input: ProbInput, pbStats?: PbStats[] | null): SetupProbability {
  const { model, direction, plan, checklist, price, vwapZ, atrH1 } = input;
  const caveats: string[] = [];
  const sigmaBar =
    input.sigmaBar != null && input.sigmaBar > 0 ? input.sigmaBar : atrH1 != null && atrH1 > 0 ? atrH1 / TR_TO_SIGMA : null;
  const ttlH = TTL_H[model] ?? null;

  const factors: ProbFactor[] = checklist
    .filter((c) => WEIGHTS[c.key] != null)
    .map((c) => ({
      key: c.key,
      label: c.label,
      weight: WEIGHTS[c.key],
      dir: c.pass === true ? 1 : c.pass === false ? -1 : 0,
      value: c.value,
    }));

  // freshness penalty (measured, not a checklist row weight)
  const freshRow = checklist.find((c) => c.key === "freshness");
  if (freshRow && freshRow.pass === false) {
    factors.push({ key: "freshness", label: "Freshness", weight: 0.2, dir: -1, value: freshRow.value });
  }

  const edge = factors.reduce((s, f) => s + (f.dir === 0 ? 0 : f.dir * f.weight), 0);

  const noGeometry = "no measurable entry/stop/target geometry — probability undefined, not zero";
  const base: SetupProbability = {
    model,
    direction,
    pFill: null,
    pT1: null,
    pWin: null,
    evR: null,
    pMeanRevert: null,
    horizonH: ttlH,
    sigmaBar,
    factors,
    empirical: null,
    views: {
      structuralPrior: { pT1: null, pMeanRevert: null },
      backtestCalibrated: null,
      method: "structural prior (reflection-principle + gambler's ruin + checklist log-odds)",
    },
    method: "reflection-principle first passage + gambler's ruin + checklist log-odds edge",
    caveats,
  };

  if (sigmaBar == null) caveats.push("ATR(h1) unavailable — σ estimated from coarser context or omitted");
  if (model === "NO_TRADE") {
    caveats.push("no position model quoted — nothing to probability-price");
    return base;
  }
  base.empirical = empiricalOf(model, pbStats ?? null);
  if (base.empirical == null) {
    caveats.push("structural model estimate, NOT a backtested win rate — calibrates against the Virtual Book once ≥ 10 outcomes exist per model");
  } else if (base.empirical.closed < 30) {
    caveats.push(`virtual-book sample still small (${base.empirical.closed} closed) — treat empirical rates as indicative`);
  }

  // ---- M2 family: market entry at price, stop/targets from the plan ----
  if (model === "M2_MEAN_REVERSION" || model === "WATCH_EXHAUSTION") {
    // probability of mean reversion to the VWAP (0σ) before the ±3σ stop,
    // quoted from the CURRENT stretch — the user's named probability
    if (vwapZ != null && Math.abs(vwapZ) >= 0.5) {
      const p0 = Math.max(0.02, Math.min(0.98, (3 - Math.abs(vwapZ)) / 3));
      const priorMR = +sigmoid(logit(p0) + edge).toFixed(3);
      base.pMeanRevert = priorMR;
      base.views.structuralPrior.pMeanRevert = priorMR;
    }
    const t1 = price != null && direction !== "NEUTRAL" ? pickTarget(plan, price, direction) : null;
    if (price != null && plan.stop != null && t1 != null && direction !== "NEUTRAL") {
      const p0 = gamblerRuin(price, plan.stop, t1.level);
      if (p0 != null) {
        const prior = +sigmoid(logit(p0) + edge).toFixed(3);
        base.views.structuralPrior.pT1 = prior;
        // empirical calibration (WS3): blend toward the backtester's fitted
        // curve with Bayesian shrinkage w_emp = n / (n + 30)
        const curve = pickCurve(model, "STRETCH", input.tier ?? "all");
        let pT1 = prior;
        if (curve && curve.logitFit) {
          pT1 = +blendCalibrated(prior, curve).toFixed(3);
          base.views.backtestCalibrated = {
            pT1,
            pMeanRevert: null,
            n: curve.n,
            curve: `${curve.model}|${curve.regime}|${curve.tier}`,
            wEmp: +(curve.n / (curve.n + 30)).toFixed(3),
          };
          caveats.push(`pT1 calibrated against ${curve.n} historical walk-forward trades (w_emp ${base.views.backtestCalibrated.wEmp}); pMeanRevert stays structural — no dedicated VWAP-touch fit yet`);
        }
        const r1 = t1.rMultiple ?? Math.abs(t1.level - price) / Math.abs(price - plan.stop);
        base.pFill = 1; // market-entry model — born filled
        base.pT1 = pT1;
        base.pWin = pT1;
        base.evR = +(pT1 * r1 - (1 - pT1)).toFixed(2);
      }
    } else {
      caveats.push(noGeometry);
    }
    if (model === "WATCH_EXHAUSTION") caveats.push("WATCH state — the anti-knife-catching gate is not satisfied; probabilities describe the plan IF triggered");
    return base;
  }

  // ---- M1 family: limit entry at the zone ----
  const zone = plan.entryZone;
  if (!zone || price == null || plan.stop == null || direction === "NEUTRAL") {
    caveats.push(noGeometry);
    return base;
  }
  const [zLo, zHi] = zone;
  const inZone = price >= zLo && price <= zHi;
  // fill reference: the FAR edge (worst fill) for risk, the NEAR edge for the
  // touch distance — a fill anywhere in the zone counts
  const nearEdge = direction === "SHORT" ? zLo : zHi;
  const farEdge = direction === "SHORT" ? zHi : zLo;
  const fillPx = inZone ? price : nearEdge;
  const t1 = pickTarget(plan, fillPx, direction);
  if (!t1) {
    caveats.push(noGeometry);
    return base;
  }
  const d = inZone ? 0 : Math.abs(price - nearEdge);

  let pFill: number | null = null;
  if (inZone) pFill = 1;
  else if (sigmaBar != null && ttlH != null) pFill = pTouch(d, sigmaBar, ttlH);
  if (pFill == null && sigmaBar == null) caveats.push("σ unavailable — P(fill) not computable from measured vol");

  let pT1: number | null = null;
  let evR: number | null = null;
  const p0 = gamblerRuin(fillPx, plan.stop, t1.level);
  if (p0 != null) {
    const prior = +sigmoid(logit(p0) + edge).toFixed(3);
    base.views.structuralPrior.pT1 = prior;
    const regimeLabel = direction === "LONG" ? "TREND_UP" : direction === "SHORT" ? "TREND_DOWN" : "all";
    const curve = pickCurve(model, regimeLabel, input.tier ?? "all");
    pT1 = prior;
    if (curve && curve.logitFit) {
      pT1 = +blendCalibrated(prior, curve).toFixed(3);
      base.views.backtestCalibrated = {
        pT1,
        pMeanRevert: null,
        n: curve.n,
        curve: `${curve.model}|${curve.regime}|${curve.tier}`,
        wEmp: +(curve.n / (curve.n + 30)).toFixed(3),
      };
      caveats.push(`pT1 calibrated against ${curve.n} historical walk-forward trades (w_emp ${base.views.backtestCalibrated.wEmp})`);
    }
    const r1 = t1.rMultiple ?? Math.abs(t1.level - fillPx) / Math.abs(fillPx - plan.stop);
    // option value of the resting order: fill-weighted expectancy in R
    evR = pFill != null ? +(pFill * (pT1 * r1 - (1 - pT1))).toFixed(2) : null;
  }
  // far-edge honesty: a zone fill at the far edge changes the geometry —
  // quote the worst-case variant when it moves EV by ≥ 0.15R
  const p0Far = gamblerRuin(farEdge, plan.stop, t1.level);
  if (p0Far != null && pFill != null && pFill > 0 && pFill < 1) {
    const pFar = +sigmoid(logit(p0Far) + edge).toFixed(3);
    const r1Far = Math.abs(t1.level - farEdge) / Math.abs(farEdge - plan.stop);
    const evFar = +(pFill * (pFar * r1Far - (1 - pFar))).toFixed(2);
    if (evR != null && Math.abs(evFar - evR) >= 0.15) {
      caveats.push(`zone-edge sensitivity: EV ${evFar >= evR ? "up to" : "down to"} ${evFar.toFixed(2)}R on a far-edge fill (${farEdge.toPrecision(6)})`);
    }
  }

  return {
    ...base,
    pFill: pFill != null ? +pFill.toFixed(3) : null,
    pT1,
    pWin: pFill != null && pT1 != null ? +(pFill * pT1).toFixed(3) : null,
    evR,
  };
}
