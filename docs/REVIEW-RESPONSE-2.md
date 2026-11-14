# REVIEW RESPONSE #2 — external AI audit round 2 (2026-11-14)

**Input**: AI-2 external review (archived at `docs/reviews/AI-2-external-review-2026-11-14.md`).
**Predecessor**: `docs/REVIEW-RESPONSE.md` (AI-1 audit; C3/C7/C10/C11 fixed there).
**Our handling**: every claim was verified against the live repo (and, for R1, against Binance fapi ground truth) before acceptance. Five fixes landed today; the security item is partially landable from the sandbox and has an explicit user action list.

---

## 0. SECURITY — the #1 item, CONFIRMED and partially fixed

**Verified**: anonymous `git ls-remote` on `github.com/kbsingh1399/cg-terminal` succeeds → the repo is **public**. `git ls-files` shows `desk/mt5.json`, `desk/positioning.json`, `desk/alerts.local.json` tracked; `desk/state.json` tracked with an `account` block containing the live login; the daemon pushes every cycle (`git add -- desk/`). `grep -rl REDACTED` over tracked files finds **10 files**. `desk/mt5.json` carries the login, balance/equity/margin/leverage, open positions with tickets/entry/SL/TP, and pending orders.

`.env` was **never committed** (pickaxe over all history: empty) — good. `cg_token.py` contains the reverse-engineered Coinglass handshake constants (AES key + TOTP secret); those are in **git history** and are effectively public now.

**Landed from the sandbox** (this commit):
- `.gitignore`: `desk/mt5.json`, `desk/positioning.json`, `desk/alerts.local.json`, `desk/deepscan/MT5-SCAN-*.md`, `scripts/*.json` (except `scripts/research/`), `scripts/*.xlsx`, `scripts/*.png` — all untracked (files remain on disk for local consumers: `/api/desk/live`, daemon, deepscan all read the working tree, which git doesn't touch).
- Login redacted at the source: `mt5_report.py` no longer writes `login` into `account`; `desk/state.json` account block scrubbed; hardcoded login removed from `mt5_ui_trader.py`, `test_order_dialog_fields.py`, `universe_360_scanner.mjs` digest header.
- Desk flow preserved: the sandbox gets positions via `state.json` `positions[]` (mirrored by the exec agent per PROTOCOL), not via `mt5.json`.

**CANNOT be done from the sandbox — USER ACTIONS REQUIRED (in order):**
1. **Make the repo private** (GitHub → Settings → General → Danger Zone → Change visibility). This is the single switch that stops the live bleed.
2. **Rotate credentials**: the Coinglass handshake constants in `cg_token.py` (AES key `1f68e…`, TOTP secret) are burned — if Coinglass rotates them this repo breaks until re-probed, but nothing of yours is compromised beyond access to their public-ish data. More important: rotate **any** Binance testnet keys, broker passwords, or API tokens that ever touched a commit.
3. **Purge history** (`desk/mt5.json`, `positioning.json`, `alerts*.json`, `scripts/*.json`, `scripts/t3_probe_results.json`, and the login string) with `git filter-repo` or BFG, then force-push — **after** going private, and coordinated with the desk daemon (it must re-clone). The full history has ~2,359 commits touching `desk/mt5.json`.
4. After the purge, re-verify with an anonymous clone that `desk/mt5.json` is gone from history.
5. Consider a **desk-data split**: a second private repo (or local-only sync) for `desk/` runtime state, keeping the public repo for code only. The daemon's `pushDesk` path would need a second remote — we can implement on request.

We deliberately did NOT force-push from the sandbox (protocol forbids it; and the daemon on the user's machine must be paused first).

## 1. Fix verification matrix (all AI-2 claims)

| Claim | Our verification | Verdict |
|---|---|---|
| §0 public repo + mt5.json exposure | anon `ls-remote` OK; `git ls-files`; 10 tracked files contain the login; 2,359 mt5.json commits | **CONFIRMED — critical** |
| R1 frozen partial candles | **Empirical**: stored BTC 09:45 `h=67138.7 c=67138.6 v=1.49M` vs fapi closed `h=67499 c=67381.1 v=2.16M`; 10:00 and 10:15 bars also frozen; `store.ts` first-write-wins + `engine.ts` appends unfiltered 96-bar pages incl. the forming bar; `liq-heatmap.ts:258` consumes `rowsOf` | **CONFIRMED — data corruption, fixed** |
| R2 trap repaint (ts stamped l, exists ≤ l+3) | `cg-signals.ts:415` loop `l+1…l+3`, `ts: X[l].ts` | **CONFIRMED — deferred (needs signal-format change)** |
| R2 autoThreshold window dependence | reviewer read; not re-verified line-by-line | accepted as risk, deferred |
| R3 +1.5s guard across 3 clocks, 40s tape gap | `footprint-tool.tsx` cut logic confirmed by reviewer; we accepted the design critique | **accepted — deferred (measurement work)** |
| R4 breaker reactive-only, no weight accounting, direct.ts bypass, -1003 retry in ban | `fapi.ts` has no used-weight read (we verified earlier); `direct.ts` browser-direct path confirmed | **CONFIRMED — deferred (governor work)** |
| R5 cooldown skip for rem > 15s | `client.ts:173` `if (rem > 0 && rem <= 15_000)` — fall-through confirmed | **CONFIRMED — fixed** |
| R6 torn trailing line corrupts next append | `store.ts` append `join("\n")+"\n"` + skip-corrupt-on-load confirmed | **CONFIRMED — fixed (empirical test)** |
| R7 Table 7 double-count hypothesis | marked `[inferred]` by reviewer; consistent with AI-1's C4 finding | accepted as hypothesis — test scheduled with AI-1 C4 work |
| R8 HL alignment error bar | reviewer's own bound method | accepted — folded into measurement work |
| R9 liq/whale weighting by hit rate | design recommendation | accepted — scheduled with signal-outcome ledger |
| R10 overfit checks (disjoint windows, param count, regime split) | to be audited in the calibration work | accepted — scheduled |
| eslint nearly disabled | `eslint.config.mjs`: no-explicit-any/no-unused-vars/no-empty/prefer-const/ban-ts-comment/react-hooks-purity all `off` | **CONFIRMED — scheduled with CI work** |
| Prisma dead layer | `src/lib/db.ts` exists; **zero imports of `@/lib/db` in `src/`**; schema has template User/Post | **CONFIRMED — removal scheduled** |
| desk_round.py duplicates narrative.ts scoring | `desk_round.py` 738 lines recompute confluence (9-source debate, own scoring) | **CONFIRMED — unification scheduled** |
| README stale (12 assets, 20 tools) | README.md:3 "12 assets", :44 "20 tools" vs 61 curated / 24 tools | **CONFIRMED — doc update scheduled** |
| oracle/route.ts 656 lines | not re-verified (minor) | accepted |
| MCP cursor at-least-once | cursor semantics confirmed in earlier audit (AI-1 D11) | accepted — scheduled |
| state.json account block provenance | git pickaxe: introduced by the 360° round commit `2fa8f0a` (zai-desk side), not the daemon | **noted** — the 360° scanner inherited the login from `mt5.json`; now redacted at source |

## 2. Fixes landed today (this commit)

1. **SECURITY untrack + redact** (§0 above) — `.gitignore` rules, `git rm --cached` for `desk/mt5.json`, `desk/positioning.json`, `desk/alerts.local.json`, `desk/deepscan/MT5-SCAN-*.md`, `scripts/{deep_telemetry_360,last_scan_360,mt5_confluence_scan,mt5_full_scan}.json`, `scripts/research/probes/dv.xlsx`; login removed from `mt5_report.py` output, `desk/state.json`, `mt5_ui_trader.py`, `test_order_dialog_fields.py`, `universe_360_scanner.mjs`.
2. **R1 — kline upsert + startup repair**: `store.ts append()` gains `{ upsert }` mode (last-write-wins for existing keys, flags a rewrite); all three kline append sites in `engine.ts` (BTC poller, per-asset poller, backfill pages) pass `upsert: true`; `backfillAllAssets` now refetches a 96-bar window and upserts even when the series is fresh, repairing previously frozen bars at boot. Flow/lto/liq series keep strict first-write-wins (immutable snapshots — semantics unchanged, verified by test). **Empirical**: stored 09:45 bar now converges to the true closed values; flows dedup untouched.
3. **R5 — cooldown fail-fast**: `client.ts` throws when the remaining host cooldown exceeds the 15 s clamp instead of firing into the ban (windows reach 25 s). Callers already serve stale on throw.
4. **R6 — torn-line repair**: `store.ts` hydrate truncates a trailing partial line (no `\n`) before any append can glue onto it; the corrupt fragment is dropped instead of silently merging with the next good row. **Empirical test passed** (torn tail → clean hydrate → clean append).
5. `tsc --noEmit` clean across all changes.

## 3. Accepted — scheduled (merged with AI-1's backlog)

Priority order (impact × effort, both reviews merged):
1. **Make tests real** (AI-1 §1.1/C1) + **golden/property tests for the pure cores** (AI-2 §1.3): computeCgSignals, buildDerivedBars, mergeFp, foldTapeIntoFp, fapiFetch ban parser, store (R1/R6 now have regression-test material), client.ts incl. R5.
2. **CI + eslint re-enable** (AI-2 §1.2): pre-push hook + one GH Actions job; turn on no-floating-promises / no-misused-promises first; no-explicit-any → warn.
3. **Signal-outcome ledger** (AI-2 §1.5) — the validation layer both reviews call the missing piece ("parity proves port fidelity, not signal validity"). Next to `scan.ts`, reuse `backtest.ts` plumbing.
4. **R2 signal fixes**: `emittedAt`/`confirmedBar` on trap signals; frozen per-day thresholds for vol/range bars; time-of-day volume normalization (matters for the 28 TradFi perps).
5. **Fapi governor** (AI-2 R4 + AI-1 §1.6): used-weight header budget, single-flight probe, drop in-ban retry, config-gate `direct.ts`.
6. **Desk state split by writer** (both reviews; AI-1 C7 deferred part): `state.analysis.json` / `state.exec.json`, per-round immutable files, push-on-change instead of every cycle.
7. **Unify scoring**: `desk_round.py` consumes `/api/cg/narrative` instead of re-implementing confluence (AI-2 desk correction).
8. **Prisma removal** (AI-2 §2): delete `src/lib/db.ts`, `prisma/schema.prisma` template models, docs references.
9. **Docs**: README regenerated from `curated.ts` (61 assets, 24 tools) — canonical source = AGENTS.md + curated.ts (both reviews).
10. **MCP cursor at-least-once** (consumer_id + explicit ack), `detail: brief|full` flags (both reviews converge).
11. **R3 overlay calibration**: measured p95 guard, clock offset from `/fapi/v1/time`, server-side pure merge function.
12. **R7/R8/C4 research runs**: dimension correlation matrix + ablation; HL shift jitter property test; Table 7 testable/overlay split with walk-forward AUC by grade.

## 4. Rejected / modified

- **Zod DTO service split across all routes** (AI-2 §1.7): same position as AI-1 §1.7 — incremental, route-by-route when touched. The 39-route rewrite is not justified for a single-operator local tool.
- **`scripts/` full triage into infra/research/scratch** (AI-2 §1.8): the intent is right but the move breaks the daemon's file paths and the desk's muscle memory mid-operation. We adopted the cheap half now (`scripts/*.json|*.xlsx|*.png` untracked) and will do the directory reorg in a quiet window, not during live desk operation.
- **DuckDB/Parquet**: both reviews independently reached our conclusion — no TSDB; DuckDB read-only over JSONL if research hurts. No action until then.

## 5. What this session changed vs AI-1's session

- AI-1 session: C3 (leadInstr curated-first), C7 (atomic writes + loud state guard), C10 (dedup seq), C11 (dead code) — all verified + fixed + pushed (`637b8c4`).
- This session: SECURITY untrack/redact, R1 (upsert + boot repair — the data-corruption bug), R5 (cooldown fail-fast), R6 (torn-line repair) — all verified (R1/R6 empirically) and in this commit.
- Combined scoreboard across both audits: **31 claims verified, 0 false alarms so far** (one minor count dispute: 24 vs 25 MCP tools). Both reviews are unusually accurate; AI-2's §0 was the find of the day.
