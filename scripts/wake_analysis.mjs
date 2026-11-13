#!/usr/bin/env node
/**
 * SCHEDULED ANALYSIS WAKE — cron/Task-Scheduler entry point (2026-11-13).
 *
 * Drops a standard ANALYSIS ROUND agent-task into desk/inbox/ (the daemon's
 * fixed instruction vocabulary — action AGENT_TASK), then runs one daemon
 * cycle so the task is dispatched immediately: appended to
 * desk/inbox/WAKE.md, wake_cmd fired (if configured in desk/daemon.json),
 * desktop notification sent, and everything committed + pushed to GitHub.
 *
 * Setup (see desk/TRADE_FORMULATION_MANUAL.md §8.3):
 *
 *   Windows Task Scheduler (every 30 min):
 *     schtasks /Create /TN "Antigravity Desk Analysis Wake" /SC MINUTE /MO 30 ^
 *       /TR "cmd /c cd /d C:\Users\SIGMA\cg-terminal && node scripts\wake_analysis.mjs"
 *
 *   Linux/macOS cron (every 30 min):
 *     0,30 * * * * cd /path/to/cg-terminal && node scripts/wake_analysis.mjs >> desk/rounds.local.log 2>&1
 *
 * The instruction text embeds the desk/TRADE_FORMULATION_MANUAL.md SOP
 * checklist — the woken Antigravity agent executes that contract.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const INBOX = path.join(ROOT, "desk", "inbox");

const INSTRUCTION = [
  "SCHEDULED ANALYSIS ROUND (manual-bound — desk/TRADE_FORMULATION_MANUAL.md):",
  "1. git pull --rebase origin main",
  "2. Read desk/inbox/WAKE.md + desk/TRADE_FORMULATION_MANUAL.md (the SOP)",
  "3. Pull live telemetry for target symbols: /api/cg/screener, /api/cg/narrative,",
  "   /api/cg/quant, /api/cg/options (BTC/ETH), /api/cg/bookwalls, /api/cg/lto,",
  "   /api/cg/liqlevels (3d/7d/30d), /api/cg/cvd, /api/cg/signals, desk/mt5.json",
  "4. Run the 6-step DECIDE (manual §1) per symbol across ALL 16 dimensions (§2)",
  "5. Compute the LSR and apply the Liquidation Magnet Gate (§4): LSR >= 2.5:1",
  "   bans S3 passive front-runs — wait for the S1 sweep",
  "6. Score Table 7 confluence (§5); apply hard vetoes; assign grade + risk %",
  "7. Grade >= B candidates: Formulation Card (§9.2) to",
  "   desk/deepscan/FORMULATION-<SYMBOL>-<ts>.md; order-worthy ones become",
  "   suggested orders in desk/state.json per desk/PROTOCOL.md",
  "8. Review open positions vs §6 invariants (+1.0R breakeven rule, 8-bar time",
  "   stop, 40/40/20 scale-outs)",
  "9. Commit + push; append the round entry to desk/log.md",
].join("\n");

const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const file = path.join(INBOX, `${ts}_AGENT_TASK-scheduled-analysis.json`);

mkdirSync(INBOX, { recursive: true });

writeFileSync(
  file,
  JSON.stringify(
    {
      id: `wake-analysis-${Date.now()}`,
      ts: Date.now(),
      from: "cron (scheduled analysis wake)",
      action: "AGENT_TASK",
      priority: "info",
      instruction: INSTRUCTION,
    },
    null,
    2
  )
);
console.log(`[wake_analysis] task dropped: ${path.relative(ROOT, file)}`);

// One daemon cycle: pull-rebase -> dispatch (WAKE.md + wake_cmd + notify) ->
// mt5 refresh -> commit + push. Skipped if a daemon is already running
// (the daemon picks the task up on its next 45s cycle anyway).
const res = spawnSync(process.execPath, [path.join(ROOT, "scripts", "desk_daemon.mjs"), "--once"], {
  stdio: "inherit",
  timeout: 15 * 60_000,
});
if (res.error) {
  console.error(`[wake_analysis] daemon cycle not run (${res.error.message}) — the always-on daemon will dispatch the task on its next cycle.`);
} else {
  console.log(`[wake_analysis] daemon cycle exit=${res.status}`);
}
