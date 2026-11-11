#!/usr/bin/env node
/**
 * desk_daemon.mjs — the local trade-desk event loop (atg-exec machine).
 *
 * Git is the message bus between the two agents:
 *   zai-desk (sandbox)  ──push──►  GitHub main  ──fetch/pull──►  this daemon
 *   daemon results (desk/outbox, desk/mt5.json, WAKE.md) ──push──► GitHub
 *
 * Every cycle (default 45 s — desk/daemon.json):
 *   1. auto-commit dirty desk/ files, git fetch, pull --rebase when behind
 *   2. run scripts/desk_round.sh when a 15-min analysis round is due
 *   3. process new desk/inbox/*.json instructions → desk/outbox/<same name>
 *      (fixed action vocabulary: PING · MT5_SNAPSHOT · ROUND_NOW · REPORT ·
 *       AGENT_TASK — NEVER arbitrary shell from the repo)
 *   4. new suggested orders / agent tasks → append desk/inbox/WAKE.md
 *      (the wake beacon for the local agent) + desktop notification
 *      + optional wake_cmd hook
 *   5. refresh desk/mt5.json (account, positions, running PnL, spreads)
 *      via scripts/mt5_report.py when due
 *   6. commit + push all desk/ changes
 *
 * Run:   node scripts/desk_daemon.mjs          (daemon, forever)
 *        node scripts/desk_daemon.mjs --once   (single cycle, testing)
 *        DESK_MT5_ENABLED=0 node ... --once    (env overrides config)
 *
 * Windows: run from Git Bash (the round script needs bash).
 */
import { execFile, spawn } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, appendFileSync, mkdirSync, readdirSync, unlinkSync, statSync } from "node:fs";
import { promisify } from "node:util";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
process.chdir(ROOT);
const X = promisify(execFile);
const ONCE = process.argv.includes("--once");

const log = (m) => console.log(`[desk-daemon ${new Date().toISOString().slice(11, 19)}] ${m}`);
const loadJson = (p, dflt) => { try { return JSON.parse(readFileSync(p, "utf8")); } catch { return dflt; } };
const deskState = () => loadJson("desk/state.json", {});

// ---------------- config (env overrides json, reloaded every cycle) ----------------
function getConfig() {
  const raw = loadJson("desk/daemon.json", {});
  const envBool = (k, dflt) => (process.env[k] === undefined ? dflt : !["0", "false", "off"].includes(process.env[k]));
  return {
    poll_secs: raw.poll_secs ?? 45,
    round_every_min: raw.round_every_min ?? 15,
    terminal_boot_cmd: raw.terminal_boot_cmd ?? "npm run dev",
    mt5: {
      enabled: envBool("DESK_MT5_ENABLED", raw.mt5?.enabled ?? true),
      python_cmd: raw.mt5?.python_cmd ?? "python",
      interval_secs: raw.mt5?.interval_secs ?? 45,
      max_consecutive_errors: raw.mt5?.max_consecutive_errors ?? 10,
    },
    wake_cmd: raw.wake_cmd ?? "",
    notify_cmd: raw.notify_cmd ?? "python scripts/bell_alert.py",
  };
}
let cfg = getConfig();

// ---------------- daemon bookkeeping (local only, gitignored) ----------------
const DSTATE = "desk/.daemon-state.json";
let dst = loadJson(DSTATE, {});
if (!dst.startedTs) dst.startedTs = Date.now();
if (!dst.lastRoundTs) dst.lastRoundTs = deskState().analysis?.last_round_ts ?? 0;
if (!Array.isArray(dst.orderSig)) dst.orderSig = [];
let roundFails = dst.roundFails ?? 0;
const saveDstate = () => writeFileSync(DSTATE, JSON.stringify(dst, null, 2));

// ---------------- shell helper (never throws) ----------------
async function sh(cmd, args, opts = {}) {
  try {
    const { stdout, stderr } = await X(cmd, args, { timeout: 120_000, ...opts });
    return { code: 0, out: stdout, err: stderr };
  } catch (e) {
    return { code: typeof e.code === "number" ? e.code : 1, out: e.stdout ?? "", err: String(e.stderr || e.message || "").slice(0, 400) };
  }
}

// ---------------- git helpers ----------------
async function gitDeskDirty() {
  const r = await sh("git", ["status", "--porcelain", "--", "desk/"]);
  return r.out.trim();
}
async function commitDesk(msg) {
  if (!(await gitDeskDirty())) return false;
  await sh("git", ["add", "--", "desk/"]);
  await sh("git", ["-c", "user.name=atg-desk-daemon", "-c", "user.email=atg-desk-daemon@local", "commit", "-q", "-m", msg]);
  return true;
}
async function pushDesk(msg) {
  const did = await commitDesk(msg);
  let r = await sh("git", ["push", "--quiet", "origin", "main"]);
  if (r.code !== 0) {
    await sh("git", ["pull", "--rebase", "--quiet", "origin", "main"]);
    r = await sh("git", ["push", "--quiet", "origin", "main"]);
  }
  if (r.code !== 0) return `PUSH FAILED: ${r.err}`;
  return did ? "pushed" : "clean";
}
async function gitSync() {
  const f = await sh("git", ["fetch", "--quiet", "origin", "main"]);
  if (f.code !== 0) return `fetch failed: ${f.err}`;
  const h = await sh("git", ["rev-parse", "HEAD"]);
  const o = await sh("git", ["rev-parse", "origin/main"]);
  if (h.out.trim() === o.out.trim()) return "up-to-date";
  const p = await sh("git", ["pull", "--rebase", "--quiet", "origin", "main"]);
  return p.code === 0 ? "pulled" : `pull failed: ${p.err}`;
}

// ---------------- bash resolver (prefers Git Bash over WSL on Windows) ----------------
function resolveBash() {
  if (process.platform === "win32") {
    const candidates = [
      "C:\\Users\\SIGMA\\AppData\\Local\\hermes\\git\\bin\\bash.exe",
      "C:\\Program Files\\Git\\bin\\bash.exe",
      "C:\\Program Files (x86)\\Git\\bin\\bash.exe",
    ];
    for (const c of candidates) {
      if (existsSync(c)) return c;
    }
  }
  return "bash";
}

// ---------------- notifications / wake ----------------

/**
 * Quote-aware tokenizer for CONFIGURED command strings (desk/daemon.json
 * `notify_cmd` / `wake_cmd` — trusted, atg/human-owned config, NOT git-synced
 * desk content). Splits on whitespace like a POSIX shell for the simple
 * cases; double-quoted spans survive spaces and lose their quotes (the
 * quotes are consumed, never re-interpreted). No escapes, no expansion —
 * that is the point: the result is a plain argv array, and everything
 * dynamic (alert titles, agent-task text from git-synced desk/ files) is
 * appended as its own argv element, so untrusted metacharacters can never
 * reach a shell. There is no shell.
 */
function tokenizeCmd(s) {
  const out = [];
  let cur = "";
  let inQ = false;
  let hasTok = false;
  for (const ch of String(s ?? "")) {
    if (ch === '"') {
      inQ = !inQ;
      hasTok = true; // "" is an explicit empty argument
    } else if (!inQ && /\s/.test(ch)) {
      if (hasTok) {
        out.push(cur);
        cur = "";
        hasTok = false;
      }
    } else {
      cur += ch;
      hasTok = true;
    }
  }
  if (hasTok) out.push(cur);
  return out;
}

/** Detached best-effort runner — argv arrays ONLY, shell:false, always. */
function spawnDetached(cmd, args) {
  if (typeof cmd !== "string" || !cmd || !Array.isArray(args)) return;
  try {
    const c = spawn(cmd, args, { shell: false, detached: true, stdio: "ignore" });
    c.on("error", () => {}); // async spawn errors must not crash the daemon
    c.unref();
  } catch { /* best effort */ }
}
function sendTelegram(text) {
  const token = process.env.TG_BOT_TOKEN;
  const chatId = process.env.TG_CHAT_ID;
  if (!token || !chatId) return;
  try {
    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    const payload = JSON.stringify({ chat_id: chatId, text: text });
    sh("curl", ["-s", "-X", "POST", "-H", "Content-Type: application/json", "-d", payload, url]).catch(() => {});
  } catch {}
}

function notify(title, text) {
  sendTelegram(`[${title}] ${text}`);
  if (cfg.notify_cmd === "") return;
  // title/text derive from git-synced desk/ files (alert actions, inbox
  // instructions) — untrusted. Tokenize the CONFIGURED command and append
  // title/text as separate argv elements; never build a shell line from
  // them (the old `"${cfg.notify_cmd} \"${title}\" \"${text}\""` +
  // shell:true let a crafted title run arbitrary commands on this machine).
  if (cfg.notify_cmd && cfg.notify_cmd !== "auto") {
    const argv = tokenizeCmd(cfg.notify_cmd);
    if (argv.length) spawnDetached(argv[0], [...argv.slice(1), title, text]);
  } else if (process.platform === "win32") {
    spawnDetached("python", ["scripts/bell_alert.py", title, text]);
  } else {
    spawnDetached("notify-send", [title, text]);
  }
}
function fireWake(text) {
  if (!cfg.wake_cmd) return;
  // {msg} substitution happens at the argv-TOKEN level (a token that is
  // exactly {msg} is replaced by the message) — the old string-level
  // `.replace()` into a shell line turned message text into shell code.
  const argv = tokenizeCmd(cfg.wake_cmd).map((tok) => (tok === "{msg}" ? text : tok));
  if (argv.length) spawnDetached(argv[0], argv.slice(1));
}

// ---------------- WAKE.md beacon (daemon appends, agent clears) ----------------
const WAKE = "desk/inbox/WAKE.md";
const readWake = () => { try { return readFileSync(WAKE, "utf8"); } catch { return ""; } };
function wakeAdd(title, lines) {
  mkdirSync("desk/inbox", { recursive: true });
  const base = readWake() || "# WAKE — pending tasks for atg-exec (daemon appends; agent handles then clears)\n";
  const ts = new Date().toISOString().replace("T", " ").slice(0, 16);
  writeFileSync(WAKE, base.replace(/\n*$/, "\n") + `\n## ${ts} UTC — ${title}\n` + lines.map((l) => `- ${l}`).join("\n") + "\n");
}

// ---------------- 15-min analysis round ----------------
async function runRound(force = false) {
  const lastKnown = Math.max(dst.lastRoundTs ?? 0, deskState().analysis?.last_round_ts ?? 0);
  if (!force && Date.now() - lastKnown < cfg.round_every_min * 60_000) return false;
  // guard: a clobbered/empty round script would exit 0 and silently no-op
  try {
    const st = statSync("scripts/desk_round.sh");
    if (st.size < 500) {
      log(`desk_round.sh is only ${st.size} bytes — REFUSING to run (clobbered?). Fix + push it.`);
      notify("Trade desk", `desk_round.sh clobbered (${st.size}B) — rounds halted until fixed`);
      dst.lastRoundTs = Date.now(); // retry in 15 min, not every cycle
      return false;
    }
  } catch { /* fall through */ }
  log(`analysis round due (last ${Math.round((Date.now() - lastKnown) / 60000)} min ago) — running desk_round.sh`);
  appendFileSync("desk/rounds.local.log", `\n===== ${new Date().toISOString()} daemon round =====\n`);
  const r = await sh(resolveBash(), ["scripts/desk_round.sh"], {
    timeout: 600_000,
    env: { ...process.env, DESK_BOOT_CMD: cfg.terminal_boot_cmd },
  });
  appendFileSync("desk/rounds.local.log", (r.out || "") + (r.err ? `\n[stderr] ${r.err}\n` : ""));
  dst.lastRoundTs = Date.now();
  if (r.code !== 0) {
    roundFails++; dst.roundFails = roundFails;
    log(`round FAILED rc=${r.code} (see desk/rounds.local.log)`);
    if (roundFails >= 2) notify("Trade desk", `analysis round failed ${roundFails}x in a row — check desk/rounds.local.log`);
  } else if (roundFails) { roundFails = 0; dst.roundFails = 0; }
  return true;
}

// ---------------- wake on new suggested orders ----------------
function checkNewOrders() {
  const sug = (deskState().orders ?? []).filter((o) => o.status === "suggested");
  const ids = sug.map((o) => o.id);
  const fresh = ids.filter((id) => !dst.orderSig.includes(id));
  const wakeTxt = readWake();
  for (const o of sug.filter((o) => fresh.includes(o.id))) {
    if (wakeTxt.includes(o.id)) continue; // already queued
    const exp = o.expiresTs ? new Date(o.expiresTs).toISOString().slice(0, 16).replace("T", " ") + " UTC" : "?";
    const lines = [
      `${o.id} ${o.sym} ${o.side.toUpperCase()} ${o.type} entry ${o.entry} · stop ${o.stop} · targets ${(o.targets ?? []).join(" / ")} · R ${o.riskR} · expires ${exp}`,
      `BASIS: levels are PERP prices (perpRef ${o.perpRefPrice ?? "?"}). Before placing in MT5 read spreads.${o.mt5Symbol}.basisPct in desk/mt5.json and set every level = perpLevel × (1 + basisPct/100). Remember the broker spread — a SHORT fills at bid.`,
    ];
    for (const x of o.debate ?? []) {
      if (x.verdict !== "NEUTRAL") lines.push(`[${x.verdict}] ${x.source}: ${x.evidence}`);
    }
    lines.push(`→ place on ${o.mt5Symbol} in MT5, then set status "placed" + ticket + ACTUAL MT5 levels in desk/state.json and append an EXEC entry to desk/log.md`);
    wakeAdd(`new suggested order — place in MT5 (debate FOR ${(o.debate ?? []).filter((x) => x.verdict === "FOR").length}/AGAINST ${(o.debate ?? []).filter((x) => x.verdict === "AGAINST").length})`, lines);
    notify("Trade desk", `new ${o.side} ${o.sym} order ${o.id} — wake agent`);
  }
  dst.orderSig = ids;
}

// ---------------- MT5 snapshot ----------------
async function runMt5(force = false) {
  if (!cfg.mt5.enabled) return { ok: false, skipped: "mt5 disabled in config" };
  if (!force && Date.now() - (dst.lastMt5Ts ?? 0) < cfg.mt5.interval_secs * 1000) return { ok: true, skipped: "not due" };
  if (!force && (dst.mt5Errors ?? 0) >= cfg.mt5.max_consecutive_errors)
    return { ok: false, skipped: "mt5 errored too many times — send an MT5_SNAPSHOT inbox instruction to retry" };
  const r = await sh(cfg.mt5.python_cmd, ["scripts/mt5_report.py"], { timeout: 90_000 });
  dst.lastMt5Ts = Date.now();
  const mt = loadJson("desk/mt5.json", {});
  if (r.code !== 0 || mt.error) {
    dst.mt5Errors = (dst.mt5Errors ?? 0) + 1;
    return { ok: false, error: mt.error || r.err || `rc=${r.code}` };
  }
  dst.mt5Errors = 0;
  return { ok: true, positions: (mt.positions ?? []).length, equity: mt.account?.equity, floating: mt.floating?.total };
}

// ---------------- inbox processing (fixed vocabulary) ----------------
async function processInbox() {
  mkdirSync("desk/outbox", { recursive: true });
  let files = [];
  try { files = readdirSync("desk/inbox").filter((f) => f.endsWith(".json")).sort(); } catch { return; }
  for (const f of files) {
    const outp = path.join("desk/outbox", f);
    if (existsSync(outp)) continue; // already replied
    const ins = loadJson(path.join("desk/inbox", f), null);
    if (!ins || !ins.action) {
      writeFileSync(outp, JSON.stringify({ file: f, replyTs: Date.now(), status: "error", reason: "unparseable JSON or missing action" }, null, 2));
      continue;
    }
    let res;
    switch (ins.action) {
      case "PING":
        res = { status: "done", result: { pong: true, host: os.hostname(), node: process.version, uptimeSec: Math.round(process.uptime()), lastRoundTs: dst.lastRoundTs } };
        break;
      case "MT5_SNAPSHOT": {
        dst.mt5Errors = 0;
        const r = await runMt5(true);
        res = { status: r.ok ? "done" : "error", result: r };
        break;
      }
      case "ROUND_NOW": {
        await runRound(true);
        const a = deskState().analysis ?? {};
        res = { status: "done", result: { round: a.last_round, ts: a.last_round_ts } };
        break;
      }
      case "REPORT": {
        await runMt5(true);
        const st = deskState();
        const mt = loadJson("desk/mt5.json", {});
        res = { status: "done", result: {
          round: st.analysis?.last_round,
          suggested: (st.orders ?? []).filter((o) => o.status === "suggested").map((o) => `${o.id} ${o.sym} ${o.side} @${o.entry}`),
          placed: (st.orders ?? []).filter((o) => o.status === "placed").map((o) => `${o.id} ${o.sym} ticket ${o.ticket}`),
          mt5: mt.error ? `unavailable: ${mt.error}` : {
            equity: mt.account?.equity,
            floatingPnl: mt.floating?.total,
            positions: (mt.positions ?? []).map((p) => `${p.symbol} ${p.side} ${p.volume} ${p.profit >= 0 ? "+" : ""}${p.profit}`),
          },
        } };
        break;
      }
      case "AGENT_TASK": {
        const text = String(ins.instruction ?? ins.payload?.instruction ?? "(no instruction text)");
        wakeAdd("agent task from zai-desk", [text]);
        notify("Trade desk", "agent task from zai — see desk/inbox/WAKE.md");
        fireWake(text);
        res = { status: "dispatched", result: { beacon: "desk/inbox/WAKE.md" } };
        break;
      }
      default:
        res = { status: "skipped", reason: `unknown action ${ins.action}` };
    }
    writeFileSync(outp, JSON.stringify({ ...ins, replyTs: Date.now(), ...res }, null, 2));
    log(`inbox ${f}: ${res.status}`);
  }
}

// ---------------- alerts engine (DIR-0006, desk/alerts.json) ----------------
const ALERTS_CFG = "desk/alerts.json";
const ALERTS_LOCAL = "desk/alerts.local.json";

function loadAlertsLocal() {
  return loadJson(ALERTS_LOCAL, {
    fired: {},
    prevOrders: [],
    prevPositions: [],
    prevOutboxFiles: [],
  });
}

function saveAlertsLocal(st) {
  try {
    writeFileSync(ALERTS_LOCAL, JSON.stringify(st, null, 2) + "\n");
  } catch {}
}

async function checkAlerts() {
  const alertsDef = loadJson(ALERTS_CFG, null);
  if (!alertsDef || !Array.isArray(alertsDef.events)) return;

  const local = loadAlertsLocal();
  const mt = loadJson("desk/mt5.json", {});
  const positions = mt.positions ?? [];
  const orders = mt.orders ?? [];
  const spreads = mt.spreads ?? {};

  // Cadence control: tighten snapshot while position open
  if (positions.length > 0) {
    cfg.mt5.interval_secs = Math.min(cfg.mt5.interval_secs, 120);
  }

  for (const ev of alertsDef.events) {
    const id = ev.id;
    if (ev.oneShot && local.fired[id]) continue;

    let triggered = false;
    let alertMsg = ev.action;

    switch (ev.type) {
      case "fill": {
        const targetTicket = ev.ticket;
        const wasPending = local.prevOrders.some((o) => o.ticket === targetTicket);
        const isPosition = positions.some((p) => p.ticket === targetTicket);
        if (wasPending && isPosition) {
          triggered = true;
        }
        break;
      }

      case "level": {
        const isPosOpen = positions.some((p) => p.symbol === ev.sym);
        if (isPosOpen && spreads[ev.sym] && spreads[ev.sym].ok) {
          const sp = spreads[ev.sym];
          const mid = sp.perpMid ?? ((sp.bid + sp.ask) / 2);
          if (ev.level) {
            if (ev.condition.includes(">=") && (sp.bid >= ev.level || sp.ask >= ev.level || mid >= ev.level)) {
              triggered = true;
            } else if (ev.condition.includes("<=") && (sp.bid <= ev.level || sp.ask <= ev.level || mid <= ev.level)) {
              triggered = true;
            }
          }
        }
        break;
      }

      case "position-close": {
        if (local.prevPositions.length > 0 && positions.length === 0) {
          triggered = true;
        }
        break;
      }

      case "expiry": {
        // Expiry comes from LIVE order data: desk/state.json orders[] carry
        // expiresTs, and the alert's ticket binds it to the order. The old
        // check hardcoded epoch 1794336822399 (A6's expiry, 2026-11-10
        // 18:53:42 UTC) plus a daily 18:53:42 UTC window — a frozen constant
        // that kept "expiring" every evening forever. No matching order with
        // an expiry → skip entirely; never fire on a stale constant.
        const stOrder = (deskState().orders ?? []).find((o) => o.ticket === ev.ticket && Number(o.expiresTs) > 0);
        if (stOrder) {
          const expiryPassed = Date.now() >= Number(stOrder.expiresTs);
          const stillPending = orders.some((o) => o.ticket === ev.ticket);
          if (expiryPassed && stillPending) {
            triggered = true;
          }
        }
        break;
      }

      case "broker-normalize": {
        const sp = spreads[ev.sym];
        if (sp) {
          if (id === "A7" || id === "A8") {
            if (sp.ok && sp.spreadPct != null && sp.spreadPct <= 0.15 && Math.abs(sp.basisPct ?? 999) <= 0.5) {
              triggered = true;
            }
          } else if (id === "A9") {
            if (sp.ok && sp.bid != null && sp.ask != null) {
              triggered = true;
            }
          }
        }
        break;
      }

      case "outbox-reply": {
        try {
          const outboxFiles = readdirSync("desk/outbox").filter((f) => f.endsWith(".reply.md"));
          const freshReplies = outboxFiles.filter((f) => !local.prevOutboxFiles.includes(f));
          if (freshReplies.length > 0) {
            triggered = true;
            alertMsg = `BELL: atg replied to directive (${freshReplies.join(", ")}) — zai-desk to verify on next wake`;
            local.prevOutboxFiles = outboxFiles;
          }
        } catch {}
        break;
      }
    }

    if (triggered) {
      log(`[ALERT] fired ${id}: ${alertMsg}`);
      notify(`ALERT ${id}`, alertMsg);
      wakeAdd(`ALERT ${id} — ${ev.type}`, [alertMsg]);
      local.fired[id] = Date.now();
      saveAlertsLocal(local);
    }
  }

  local.prevOrders = orders.map((o) => ({ ticket: o.ticket, symbol: o.symbol }));
  local.prevPositions = positions.map((p) => ({ ticket: p.ticket, symbol: p.symbol }));
  try {
    local.prevOutboxFiles = readdirSync("desk/outbox").filter((f) => f.endsWith(".reply.md"));
  } catch {}
  saveAlertsLocal(local);
}

// ---------------- the cycle ----------------
async function cycle() {
  cfg = getConfig();
  const t0 = Date.now();
  await commitDesk("desk(daemon): auto-commit (pre-sync)");
  log(`sync: ${await gitSync()}`);
  await runRound(false);
  checkNewOrders();
  await processInbox();
  await runMt5(false);
  await checkAlerts();
  const pushed = await pushDesk(`desk(daemon): ${new Date().toISOString().slice(0, 16)} — inbox/outbox/mt5/wake sync`);
  if (pushed !== "clean") log(`git: ${pushed}`);
  saveDstate();
  log(`cycle done in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
}

// ---------------- single-instance lock + lifecycle ----------------
const LOCK = "desk/.daemon.lock";
function acquireLock() {
  if (existsSync(LOCK)) {
    const pid = Number(readFileSync(LOCK, "utf8").trim());
    if (Number.isFinite(pid) && pid > 0) {
      try { process.kill(pid, 0); console.error(`[desk-daemon] already running (pid ${pid}) — exiting`); process.exit(1); } catch { /* stale lock */ }
    }
  }
  writeFileSync(LOCK, String(process.pid));
}
const release = () => { try { unlinkSync(LOCK); } catch {} saveDstate(); };
process.on("SIGINT", () => { release(); process.exit(0); });
process.on("SIGTERM", () => { release(); process.exit(0); });
process.on("exit", () => { try { unlinkSync(LOCK); } catch {} });

acquireLock();
if (ONCE) {
  cycle().then(() => { release(); process.exit(0); }).catch((e) => { console.error("[desk-daemon] cycle error:", e); release(); process.exit(1); });
} else {
  log(`starting — poll ${cfg.poll_secs}s · round every ${cfg.round_every_min}min · mt5 ${cfg.mt5.enabled ? "on" : "off"} · wake_cmd ${cfg.wake_cmd ? "set" : "off"}`);
  (async function loop() {
    for (;;) {
      try { await cycle(); } catch (e) { console.error("[desk-daemon] cycle error:", e.message); }
      await new Promise((r) => setTimeout(r, cfg.poll_secs * 1000));
    }
  })();
}
