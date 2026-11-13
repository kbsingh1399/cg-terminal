#!/usr/bin/env node
/**
 * SCHEDULED 360° FULL-UNIVERSE TRADE FORMULATION WAKE — cron/Task-Scheduler
 * entry point (2026-11-13).
 *
 * Same mechanism as scripts/wake_analysis.mjs (manual §8.3): drops a standard
 * AGENT_TASK into desk/inbox/, then runs one daemon cycle so the task is
 * dispatched immediately (appended to desk/inbox/WAKE.md, wake_cmd fired if
 * configured, desktop notification, commit + push). The difference is the
 * INSTRUCTION: the full 61-asset curated universe (30 crypto-perp + 28
 * tradfi-perp + 3 classic) under the funnel — Tier A sweep of all 61, Tier B
 * deep 16-dimension DECIDE on the shortlist, Tier C LSR Magnet Gate +
 * Table 7 + Formulation Cards + suggested orders on the MT5-map subset.
 *
 * Setup (manual §8.3b):
 *
 *   Windows Task Scheduler (every 2 hours):
 *     schtasks /Create /TN "Antigravity 360 Universe Formulation" /SC HOURLY /MO 2 ^
 *       /TR "cmd /c cd /d C:\Users\SIGMA\cg-terminal && node scripts\wake_360.mjs"
 *
 *   Linux/macOS cron (every 2 hours, on the half hour):
 *     30 0-23/2 * * * cd /path/to/cg-terminal && node scripts/wake_360.mjs >> desk/rounds.local.log 2>&1
 *
 * Prerequisite: wake_cmd configured in desk/daemon.json (manual §8.2).
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const INBOX = path.join(ROOT, "desk", "inbox");

const INSTRUCTION = [
  "360 FULL-UNIVERSE TRADE FORMULATION ROUND (manual-bound — desk/TRADE_FORMULATION_MANUAL.md):",
  "SCOPE: ALL 61 curated assets (src/lib/universe/curated.ts). Crypto 30:",
  "  BTC ETH BNB SOL XRP ADA DOGE TRX LINK LTC AVAX DOT NEAR UNI ATOM XLM ETC FIL ICP HBAR APT ARB OP SUI SEI INJ TIA VET 1000PEPE 1000SHIB",
  "TradFi 28:",
  "  XAU NVDA SNDK SOXL SPCX GOOGL MU SKHY XAG CL INTC CRCL MSTR QQQ ANTHROPIC AAPL TSLA DRAM KORU META NBIS MSFT AMZN AMD COIN NFLX AVGO TSM",
  "Classic 3: SPX500 UKO NDX100",
  "",
  "FUNNEL — three tiers, do NOT deep-pull all 61:",
  "1. git pull --rebase origin main; read desk/inbox/WAKE.md + the manual (the SOP)",
  "2. TIER A (universe sweep, all 61): /api/cg/narrative?sym=<X> per symbol.",
  "   Record regime, direction, grade, confidence, M1/M2 status, plan.vetoes.",
  "3. TIER B (candidate shortlist — qualify on ANY of):",
  "   - narrative grade A or A+ (any confidence), OR",
  "   - confidence >= 80 with M1 or M2 TRIGGERED, OR",
  "   - LSR >= 2.5 magnet candidate (S1 watch), OR",
  "   - engine score |value| >= 2.0 (desk debate / desk_round output)",
  "   Cap the deep pass at the top 12 by (confidence x grade rank); if more",
  "   qualify, rank and cut. For each Tier B symbol pull:",
  "   /api/cg/market, /api/cg/quant, /api/cg/options (BTC/ETH only),",
  "   /api/cg/bookwalls, /api/cg/lto, /api/cg/liqlevels?range=3d, /api/cg/cvd,",
  "   /api/cg/signals — then run the full 6-step DECIDE (manual §1) across",
  "   ALL 16 dimensions (§2).",
  "4. TIER C (gates on every Tier B symbol):",
  "   - LSR Magnet Gate (§3), ±2% window: LSR >= 2.5 → passive entries BANNED,",
  "     arm S1 sweep-reversal; 2.0–2.5 → half-size S3 Grade B max; < 2.0 → open.",
  "   - Table 7 confluence score (§5) + all hard vetoes.",
  "   - Desk R-standard (§1): >= 2.0R to T1 continuations; 1.5R floor only via",
  "     the 40/40/20 composite; chase guard |z| >= 2.0 bans chasing.",
  "5. OUTPUTS:",
  "   a. desk/deepscan/UNIVERSE-360-<ts>.md — the full-universe tier table,",
  "      one line per asset (all 61): sym · regime · direction · grade · conf ·",
  "      LSR · gate verdict · tier (A/B/C/SKIP). Commit this every run.",
  "   b. Formulation Cards (§9.2) for every Grade >= B Tier B candidate:",
  "      desk/deepscan/FORMULATION-<SYMBOL>-<ts>.md",
  "   c. Order-worthy candidates that are on the MT5 map (desk/state.json",
  "      symbol_map: BTC ETH SOL BNB XRP ADA AVAX DOGE LINK LTC XAU XAG XLM",
  "      XMR XPT USO UKO) become suggested orders in desk/state.json per",
  "      desk/PROTOCOL.md — max 4 concurrent incl. open, 0.5% risk cap each,",
  "      desk min R 2.0, expiry 4h. Non-MT5 symbols are analysis/watch only.",
  "   d. Magnet watchlist (LSR >= 2.5): sweep trigger levels + S1 entry plan.",
  "6. Review open positions vs §6 invariants (+1.0R breakeven rule, 8-bar",
  "   M15 time stop, 40/40/20 scale-outs) — every round, no exceptions.",
  "7. Commit + push; append the round entry to desk/log.md with the tier",
  "   summary (counts per tier, top candidates, magnet list).",
].join("\n");

const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const file = path.join(INBOX, `${ts}_AGENT_TASK-360-universe-formulation.json`);

mkdirSync(INBOX, { recursive: true });

writeFileSync(
  file,
  JSON.stringify(
    {
      id: `wake-360-${Date.now()}`,
      ts: Date.now(),
      from: "cron (scheduled 360 universe formulation wake)",
      action: "AGENT_TASK",
      priority: "info",
      instruction: INSTRUCTION,
    },
    null,
    2
  )
);
console.log(`[wake_360] task dropped: ${path.relative(ROOT, file)}`);

// One daemon cycle: pull-rebase -> dispatch (WAKE.md + wake_cmd + notify) ->
// mt5 refresh -> commit + push. Skipped if a daemon is already running
// (the daemon picks the task up on its next 45s cycle anyway).
const res = spawnSync(process.execPath, [path.join(ROOT, "scripts", "desk_daemon.mjs"), "--once"], {
  stdio: "inherit",
  timeout: 15 * 60_000,
});
if (res.error) {
  console.error(`[wake_360] daemon cycle not run (${res.error.message}) — the always-on daemon will dispatch the task on its next cycle.`);
} else {
  console.log(`[wake_360] daemon cycle exit=${res.status}`);
}
