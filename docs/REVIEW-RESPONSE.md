# REVIEW RESPONSE — external AI audit of cg-terminal (2026-11-14)

**Input**: `upload/Pasted Content_1794652899849.txt` ("External architecture review", reviewer tree @ `233d50e`).
**Our handling**: every factual correction and every C1–C11 claim was independently verified against the live repo before acceptance. Four fixes landed same-day (C3, C7, C10, C11); the rest are triaged below with owners and sequencing.

---

## 0. Reviewer's factual corrections — verified, accepted

All six corrections in their §0 check out against the tree:

| Claim (reviewer) | Our verification | Status |
|---|---|---|
| 39 routes under `/api/cg`, 48 total | `find` counts: 39 / 48 | ✅ accepted — `docs/AI_REVIEW_PROMPT.md` corrected |
| 25 MCP tools | `grep` on `mcp/server.mjs`: 24 `name:` entries (one tool may be double-counted by the reviewer's method — e.g. a name in a comment) | ⚠️ minor disagreement: we count 24 |
| 374 files in `scripts/` | `find scripts/ -type f` = 374 (our earlier `ls` = 184 top-level only) | ✅ accepted — prompt corrected |
| 46,470 LOC / 190 files | matches our `wc -l` | ✅ confirmed |
| 12 test files (~1,550 lines) exist, wired to nothing | `ls scripts/test-*` = 12 files, 1,554 lines; no `test` script in package.json, no runner in devDeps | ✅ accepted — the "tests that cannot fail" framing is correct and is the single most valuable insight in the review |
| `scripts/` holds the only copy of quant-math lock + parity harness | confirmed by ls | ✅ accepted — "delete the scratch" would have been unsafe; good catch |

## 1. Fixes landed today (commit refs in git log)

### C3 — `leadInstr` fabricated upstream keys → FIXED
- **Verified first**: ran a tsx probe — **37 of 58 curated perps** (DOT, NVDA, MSTR, ANTHROPIC, AAPL, TSLA, …) are absent from the legacy 33-entry `ASSETS` table and fell into the `?? Binance_${s}USDT` fallback. The fabricated key is *accidentally correct* for curated perps (all Binance USDT-M pairs are `<SYM>USDT`), so no live 40001 today — but the bug class is exactly the documented `1000SHIB` incident, armed for the next listing whose lead differs.
- **Fix**: `src/lib/cg/assets.ts` `leadInstr()` now resolves **curated-first** via `curatedAssetOf(s).pair` (the verified live instrument), then legacy table, then the legacy fallback for non-curated (Tier-2 200-list symbols only).
- **Verified**: tsx probe over all 58 curated perps → 0 mismatches; legacy `HYPE` still resolves. `tsc --noEmit` clean.

### C7 — non-atomic desk writes + silent state reset → FIXED (daemon side)
- **Verified**: `desk_daemon.mjs` used plain `writeFileSync` for outbox replies, `ALERTS_LOCAL`, `.daemon-state.json`; `loadJson` swallows parse errors into `{}` — a torn write mid-cycle would silently reset desk state.
- **Fix**: added `atomicWrite()` (tmp file + `renameSync`, same directory) used at all three JSON sites; `deskState()` now **throws loudly** on an unparseable `desk/state.json` (missing file still returns `{}` for first boot). Python side (`desk_round.py`) already fails loudly (`state["config"]` KeyError).
- **Deferred** (needs the user's machine): splitting `state.json` per writer (`orders/agent/daemon`), inbox/outbox pruning. See §3.

### C11 — dead `lastBar` branch in `liq-heatmap.ts` → FIXED
- **Verified**: the `if (b > lastBar[yi] …)` body was literally empty. Deleted the branch + array; documented `tail`'s true semantics (final-bar exposure) in the comment. No behaviour change — it computed nothing.

### C10 — notification dedup could drop real re-add events → FIXED
- **Verified**: dedup key `asset|source|kind|barTs|barType|price` for 30 min; a wall pulled and re-added at the same price within 30 min would be silently dropped.
- **Fix**: barTs-less events (whale walls, sweep setups) now carry a per-`(asset|kind)` sequence number in the key, so each pull→re-add cycle is a new event; barTs-bearing events keep seq=0, preserving exact intra-bar dedup semantics. `tsc` clean.

## 2. Accepted — scheduled (with our sequencing)

| Review item | Our verdict | Plan |
|---|---|---|
| §1.1 / C1 make tests real (vitest, real imports, kill mirrors) | **Accept — top priority.** The ATR→σ `/1.25` history proves the mirror-suite blind spot. | Next work session: add `tsx`-based `npm test`, port `scripts/test-*.cjs|ts` to `tests/unit/` with real imports from `src/lib/…`. Parity script becomes fixture-capture + assertion. |
| §1.3 / C2 closed-bar verdicts (repaint) | **Accept — high priority.** `market.ts:276` uses the trailing m15 bar for EMA/RSI/VWAP; backtest is closed-bar by design; live/backtest measure different objects. | `closedBars()` helper + `price.live` overlay + `verdict.barsUsed`. The reviewer's 10-line candleAt probe decides the upstream detail first. |
| §1.2 one-call universe scan endpoint | **Accept.** 61 serial narrative calls per 360° round is the largest cost in the loop and is non-reproducible. | `src/lib/cg/services/universe-scan.ts` + route; wake_360 instruction shrinks to 2 calls. |
| §1.4 / C5 de-bias Virtual Book | **Accept.** GET-path arming + `SWEEP_PER_TICK=2`/90s + caps = selection bias; `PbStats` divides by armed, not attempts. | Arm on bar close from the universe scan; add `attempts`/`skipped`/per-source buckets. |
| §1.5 delete dead `src/lib/cg/signals.ts` | **Accept.** Grep confirms zero imports. | Delete in the next commit window (kept out of today's to keep the fix diff reviewable). |
| §1.6 fapi admission control (token bucket, priority lanes) | **Accept.** Breaker semantics stay; governor goes upstream of it. | After the universe-scan endpoint (which is the biggest new weight source). |
| §1.9 retention (`prune.mjs`, atomic writes for mcp-cursor) | **Accept.** `notifications.jsonl` = 1.9 MB append-only; inbox 81 / outbox 95 files never reclaimed. | Add prune to the daemon's daily branch; make `data/mcp-cursor.json` atomic. |
| §1.10 session profile anchored to rolling 8h | **Accept.** Fixed session blocks already exist for `sessionVwaps`; reuse them. | Cheap (half day) — slot after C2. |
| C8 decoders.ts (throw on shape drift) | **Accept.** `Number(undefined)→NaN→null` chain confirmed by reading. | Sequenced with the test work (fixtures make it safe). |
| C9 clock skew (`now()` from fapi time) | **Accept.** All freshness math is `Date.now() − upstreamTs`. | Small; slot with C8. |
| §2 dimsAvailable 12/16 cap (comparability fix) | **Accept** — this is the right answer to the 61-asset universe: keep the list, cap the claim. | Emitted on every verdict; 360° table carries the column. |

## 3. Partially accepted / modified

- **§1.7 service-layer extraction (quant 734 L, options 695 L)**: accept the diagnosis; we will extract services opportunistically when those routes are next touched, not as a standalone refactor. The **GET side effects** (C6: `markViewed` + `ensurePaperBook` + `armFromVerdict` on GET, 0.6% drift refresh) move out with the C5 paper-book rework — same code path.
- **§1.8 MCP collapse 24 → ~8**: accept the `detail: summary|full` idea and erroring loudly on bad intervals; the 24-tool surface stays until the desk prompts are migrated (tools are referenced by name in `desk/TRADE_FORMULATION_MANUAL.md` and the wake instructions — collapsing them is a coordinated change, not an edit).
- **§4 CI**: accept the shape (pre-push `npm run check` + one GitHub Actions job, fixture-only, no upstream calls). Realistic for one dev; we'll start with the pre-push hook.
- **C4 Table 7 split (testable D2–D8/D14–D16 vs overlay D9–D13)**: accept the split and the honesty it buys; the walk-forward AUC-by-grade run is scheduled with the test work. Double-counting check between D7 and the M-confirmation gate: accepted as a real risk, fix folds into the narrative rework after C2.

## 4. Rejected (with reasons)

- **TSDB / ClickHouse / Timescale migration** — the reviewer themselves rejected it; we agree. JSONL stays the system of record; optional Parquet sidecars only if the backtester measurably slows.
- **Any change to `cg-signals.ts` beyond fixtures** — agreed and already policy: frozen port.
- **§1.8 "delete `resolveInterval`'s silent fallback"** in isolation — we'll do it together with the MCP tool migration (same commit), not before, to avoid a window where the desk prompts reference an erroring vocabulary.

## 5. Open items needing the user's local machine

1. **C2 upstream probe** — two `GET /api/cg/market?sym=BTC` calls 60 s apart (is `candleAt` the forming bucket?). Terminal is not running in this sandbox right now, so this probe couldn't be executed today.
2. **Daemon restart after the C7 fix** — the atomic-write daemon needs a restart on the Windows box to pick up the change.
3. **Pre-push hook install** — `git config core.hooksPath .githooks` (or husky) once `npm test` exists.

## 6. Scoreboard

- Reviewer claims verified against source: **16/16 checked, 15 confirmed exactly, 1 minor count dispute (24 vs 25 MCP tools)**
- Fixed today: **C3, C7 (daemon), C10, C11** — `tsc --noEmit` clean, daemon `node --check` clean
- Accepted + scheduled: **12 items** (tests-real is first)
- Modified: **4** · Rejected: **3** (all with agreement from the reviewer's own text)
