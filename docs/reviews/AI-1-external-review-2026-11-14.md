# External architecture review — CG Order-Flow Terminal

**Reviewer role:** staff engineer + quant desk tech lead (paid audit).
**Date:** 2026-11-14. **Tree reviewed:** `kbsingh1399/cg-terminal` @ `233d50e` (local checkout `arena/313ae1b9-cg-terminal`).
**Read:** README, AGENTS, desk/PROTOCOL, desk/TRADE_FORMULATION_MANUAL, `src/lib/cg/*` (cg-signals, signals, narrative, market, indicators, scan, engine, store, client, fp-load, altbars, liq-model, liq-heatmap, book-walls, cvd, paperbook, probability, backtest, notify, assets), `src/lib/live/*` (fapi, feed, forming, hl-feed, server-price), `src/lib/universe/curated.ts`, `src/lib/desk/live.ts`, all 48 `route.ts`, `mcp/server.mjs`, `scripts/desk_daemon.mjs`, `scripts/wake_360.mjs`, `scripts/test-*.{cjs,ts}`, `tests/`, package.json/tsconfig/eslint.

Method: static read only. I did **not** have live Coinglass/Binance credentials in this environment, so every claim about upstream behaviour is either (a) grounded in what the code asserts and how it fails, or (b) explicitly marked *unverified — here is the test that decides it*. I have flagged the difference; where I could not decide a question by reading, I say so rather than guess.

---

## 0. Corrections to the brief (facts, before opinions)

Six numbers in the review request are wrong. They matter because they're the ones you'd use to argue about scope.

| Claim in brief | Actual |
|---|---|
| "48 API routes" under `src/app/api/cg/` | **39** under `/api/cg`; 48 total in `src/app/api` (9 are `binance/*`, `desk/live`, `health`, root). |
| "24 MCP tools" | **25** (`list_assets` … `narrative_ai_brief`). |
| "184 scripts" | **374 files** in `scripts/`. The 184 figure is ~5 weeks stale; the mixture has doubled, not stabilised. |
| "~46.5k LOC" | 46,470 LOC across **190** files — correct. |
| "tests/ — only build/runtime smoke tests" | True for `tests/`, but **6 `scripts/test-*.cjs` + 6 `scripts/test-*.ts` already exist** (~1,100 lines) and are wired to *nothing*: no runner in `devDependencies`, no `npm test`, no CI, no doc reference. Your problem is not "we have no tests", it is "we have tests that cannot fail" (see §3 C1). |
| "scripts/ mixes durable infra with scratch" | Worse than stated — it also contains the *only* copy of the quant-math lock and the parity harness, so "delete the scratch" is not a safe instruction. |

---

## 1. Top 10 improvements, ranked by impact × effort⁻¹

Scores: impact 1–5 (how much money/correctness/velocity it buys), effort in dev-days, ratio = impact/effort. Order is the ratio.

| # | Improvement | Impact | Effort | Ratio |
|---|---|---|---|---|
| 1 | Make the existing tests real, then gate on them | 5 | 0.5 | 10.0 |
| 2 | One-call universe scan endpoint for the 15-min and 360° rounds | 5 | 1.0 | 5.0 |
| 3 | Closed-bar verdicts (kill repaint) + stamp the bar used | 5 | 1.0 | 5.0 |
| 4 | De-bias the Virtual Book (arming, drops, stratification) | 4 | 1.5 | 2.7 |
| 5 | One universe registry; delete the dead second signal engine | 4 | 0.75 | 5.3 |
| 6 | Global fapi weight governor with priority lanes | 4 | 1.5 | 2.7 |
| 7 | Extract services from the 5 fat routes; remove GET side effects | 3.5 | 1.5 | 2.3 |
| 8 | Collapse the MCP surface 25 → ~8 and budget its context | 3.5 | 1.0 | 3.5 |
| 9 | Retention + atomic writes for desk state, notifications, MCP cursor | 3 | 0.75 | 4.0 |
| 10 | Anchor the "session" volume profile to fixed session blocks | 3 | 0.5 | 6.0 |

### 1. Make the existing tests real, then gate on them
`scripts/test-quant-math.cjs` is a 463-line test file that **re-implements the production formulas as mirrors** — its own header says "the .ts modules can't be imported from plain Node; every mirror carries the source location it must stay in sync with." That is a test that passes when the source breaks: the mirror keeps asserting the *old* constant. The comment even documents the exact bug class it failed to catch in the past (the ATR→σ `/1.25` overstatement, "fixed 2026-11-12, verified against close-to-close realized vol") — that fix was verified against a mirror, so nothing in the suite would notice if `probability.ts` regressed tomorrow.

Fix, one afternoon: add `vitest` (or `tsx` + `node --test`, zero new lockfile churn), move `scripts/test-*.cjs|ts` to `tests/unit/*.test.ts`, replace every mirror with a real `import` from `src/lib/…`, add `"test": "vitest run"` and `"check": "tsc --noEmit && eslint . && vitest run"`. Then `scripts/test-signal-parity.ts` needs special handling (see §4) — it is a printout, not a test. This single change is worth more than the next ten features, because it converts your entire quant core from "reviewed by reading" to "reviewed by machine."

### 2. One-call universe scan endpoint
`scripts/wake_360.mjs` instructs the agent to do `GET /api/cg/narrative?sym=<X>` **61 times**, then pull 8 more routes for up to 12 shortlisted symbols. That is ~85 HTTP round-trips serialised through an LLM, each of which may build a cold narrative (4 Coinglass kline calls + a fresh 300-bar footprint aggregate + quant legs + options) and each of which is a separate tool call the agent must reason over. It is the single largest cost — in tokens, latency and upstream weight — in your operating loop, and it produces a tier table that is *not reproducible* because each symbol is sampled at a different second with a different cache state.

Fix: `GET /api/cg/scan/universe` (and `POST` for the tier-2 deep pass) in a new `src/lib/cg/services/universe-scan.ts`, returning the exact table `wake_360` wants: `sym · regime · direction · grade · conf · m1/m2 status · vetoes · dataAt`. Concurrency-bound inside the server (where you can see the cache and the fapi weight), one `dataAt` per row, deterministic ordering. The agent goes from 85 calls to 2 and the desk round stops being a stochastic sampler. This also gives you the object you actually need for §1.4.

### 3. Closed-bar verdicts: kill the repaint, stamp the bar
`buildMarketSnapshot` (`src/lib/cg/market.ts`) computes EMA/RSI/day-VWAP/auction over `m15[m15.length-1]` — the **forming** bar as served by the kline upstream. `buildNarrative` then reads `market.price.last` and derives `z`, the M1/M2 verdict, entry zone and stop from those values. Consequently a Grade A at 14:52 can become SKIP at 14:58 on the same bar, and the paper ticket armed at 14:52 was frozen from indicators that never existed as closed data. Your backtester, by contrast, is deliberately closed-bar ("higher-TF EMAs only use COMPLETED bars; signals fire on bar close and execute from the NEXT bar"). So live and backtest measure different objects, and `calibration.json` is blending curves from one process into priors for the other.

The code is aware of the smell — `narrative.ts:356` computes `marketAgeBeyondBar = max(0, ageMs − 15min)` — but it patches the *freshness label*, not the *data*. Fix: a `closedBars(bars, itv, now)` helper that drops the trailing bar when `now < last.t + itv`, used for every indicator and verdict input; expose the live price as a separate `price.live` overlay for display; and add `verdict.barsUsed = { m15LastClosedTs, h1LastClosedTs }` so the paper book, the backtest and the agent all cite the same bar. One day, and it removes the largest methodological inconsistency in the system.

*Unverified:* whether the Coinglass `/api/v2/kline` response includes the in-progress bar. The 10-line check: call `/api/cg/market?sym=BTC` twice 60s apart, assert `candleAt` is unchanged and `price.last` changed, and compare `candleAt` to `floor(now/15min)*15min`. If `candleAt` equals the current bucket start, the bar is forming.

### 4. De-bias the Virtual Book
Three separate biases make `PbStats` unusable for sizing, which is a shame because the machinery is good (frozen risk at fill, stop-before-target, gap-open fills, real fee/slippage/funding):

- **View-driven sampling.** `armFromVerdict` is called from the `GET /api/cg/narrative` route (`route.ts`, after the cache miss) — so tickets are armed for symbols a human happened to look at, plus a background sweep at `SWEEP_PER_TICK = 2` per `90s` = ~46 min per pass over 61 assets. The sample is neither random nor exhaustive; it is "what I clicked" convolved with "what the sweep phase hit."
- **Silent truncation.** `MAX_ARMED = 24` / `MAX_OPEN = 24` → `skip("armed cap reached")`. The drop *is* recorded in `PB.armLog`, but `PbStats` never divides by attempts, so expectancy is computed only over setups that won the race for a slot.
- **No stratification.** Route-armed, sweep-armed and desk-armed tickets land in one bucket, although they are sampled under different freshness gates (`M2_ARM_MAX_MARKET_AGE_MS = 10min` vs `ZONE_ARM_MAX_MARKET_AGE_MS = 30min`).

Fix: (a) arm deterministically on bar close from the universe scan in §1.2, not from the HTTP path; (b) add `attempts`, `skipped{reason}`, `fillRate` on *attempts* to `PbStats`; (c) tag `source: "route"|"sweep"|"desk"` and report per-source buckets. Then `probability.ts`'s `w_emp = n/(n+30)` shrinkage is shrunk toward a number that means something.

### 5. One universe registry; delete the dead second signal engine
Two parallel registries exist: `src/lib/universe/curated.ts` (61 — canonical, used by the MCP, the wake script and the desk) and `src/lib/cg/assets.ts` (`ASSETS`, 33 entries including `XPT`, which the docs say left the palette). `market.ts` resolves through *both* (`assetOf(cgSym) ?? assetOf(sym)`), and `leadInstr(sym)` ends with `?? \`Binance_${s}USDT\`` — i.e. for any symbol not in the legacy table it **fabricates an instrument key** that will 40001 at Coinglass, causing the multi-venue aggregate to degrade to Binance-only exactly like the documented `1000SHIB` bug. That is a whole bug class waiting for the next listing.

Second: `src/lib/cg/signals.ts` is a complete, *different* signal engine (60-bar percentile, 20% share, 5-bar dedup, 2-bar lookahead hold-check) and **nothing imports it** — I grepped all of `src/`. Two engines with different counts for the same asset is a parity-claim hazard and dead weight in the directory that carries your correctness story.

Fix: delete `signals.ts` (or move to `docs/legacy/` with a one-line "superseded by cg-signals.ts, 1:1 Coinglass port" header); make `ASSETS` a *derived* view over `CURATED`; make `leadInstr` return `string | null` and force every caller to handle null. Removing a fallback that silently invents an upstream key is worth more than the surface it protects.

### 6. Global fapi weight governor
`fapiFetch` already handles 429/418 with real-window backoff (parses the `until` timestamp, +10s, clamps past windows to 60s, retries `-1003`-in-200 once) — that is the best error handling in the repo. What does not exist is *admission control*: the only limits on upstream pressure are per-caller TTLs (`market` 12s, `narrative` 20s, `fp-load` 45s, `backtest` 90s), and every caller thinks it is alone. The 360° wake, the paper-book sweep, the scanner lane and a human clicking through tabs all draw from the same `/fapi/v1/klines` weight budget with no shared accounting, and the first sign of overload is a 418 that shuts the whole terminal down for a minute.

Fix: one token bucket in `src/lib/live/fapi.ts` tuned from the `X-MBX-USED-WEIGHT-1M` response header (they already read headers for the `until` field), with three priority lanes — `interactive` (a route a human is waiting on), `scanner`, `backfill` — where `backfill` **fails fast** instead of queueing, so the backtester degrades rather than the terminal. ~150 lines, and it is the difference between "the desk round occasionally 418s" and "it never does."

### 7. Extract services from the fat routes; remove GET side effects
`src/app/api/cg/quant/route.ts` is 734 lines: upstream fetch, TTL cache, request coalescing, payload decoding, four aggregations, and output formatting, all in one module. `options/route.ts` is 695. The `narrative` route has three side effects on a `GET`: `markViewed(sym)` (mutates scanner priority), `ensurePaperBook()` (boots a tracker) and `armFromVerdict(verdict, "route")` (creates a paper ticket). A browser prefetch, an MCP retry, or the agent's `analyze_setup` calling through can arm a ticket; idempotency rests on a setup fingerprint with a 0.6% drift tolerance, so a drift inside tolerance re-fires a refresh event.

Fix, scoped honestly (not a rewrite of 39 routes): extract `src/lib/cg/services/{quant,options,narrative}.ts` so routes are `parse → service → serialize`; move arming inside `ensurePaperBook`'s bar-close pass (§1.4); make `markViewed` an explicit `POST /api/cg/view` (or infer recency from a `since` query) so a cache warm can't reorder the scan lane. Do the other 36 routes only when touched.

### 8. Collapse the MCP surface
25 tools, each returning **both** `text` (a formatted block) and `data` (the full JSON payload — `market_snapshot` hands back the entire `MarketSnapshot`, `signals` up to 3×30 signals, `stopmap` the cluster set). An LLM consumer pays for both, and `analyze_setup` already exists as the correct one-call bundle. The interval-vocabulary normalisation (`M_INTERVALS` / `PAGE_TO_M` / `BOOKWALLS_ITV` / `CVD_ITV`, with a comment documenting that every tool once 400'd on its own default) is a symptom: the tool surface is a projection of three inconsistent route contracts.

Fix: ~8 tools grouped as `market`, `flow`, `positioning`, `structure`, `desk` with a `detail: "summary"|"full"` flag defaulting to summary (text only, `data` omitted); delete `resolveInterval`'s silent fallback and **error with the legal vocabulary** instead — for an agent, a loud 400 is strictly better than a silent 15m. Keep `analyze_setup` and `notifications` exactly as they are; they are the two most load-bearing tools you have.

### 9. Retention + atomic writes
Bounded: `store.ts` (`MAX_ROWS 60k`, atomic compact rewrite — good), `paperbook.jsonl` (6000→3000), `notify.ts` in-memory (2000). **Unbounded on disk:** `notifications.jsonl` is `appendFileSync`d forever while only the in-memory ring is trimmed; `desk/log.md` is 5,545 lines and append-only; `desk/state.json` is 5,521 lines rewritten every 45s cycle; `desk/inbox` has 82 files and `desk/outbox` 96, never reclaimed. Also non-atomic: `writeFileSync` on `desk/outbox/*.json`, `desk/ALERTS`, `.daemon-state.json`, and `data/mcp-cursor.json` — a crash mid-write leaves torn JSON that `loadJson` swallows into `{}`, silently discarding desk state.

Fix: one `scripts/prune.mjs` (notifications >30d → archive; log.md >2000 lines → rotate to `log-YYYY-MM.jsonl`; inbox/outbox processed >7d → `desk/archive/`) run from the daemon's daily branch, plus a 6-line `atomicWrite(p, obj)` (tmp + `renameSync`) used at every JSON write site. Half a day, and it prevents both a slow leak and a class of "the desk state vanished" incidents.

### 10. Anchor the session profile to fixed session blocks
`auctionLevels` (`indicators.ts`) computes `session: volumeProfile(m15.filter(c => c.t >= now − 8h))` — a profile anchored to *the current instant*, so session POC/VAH/VAL slide continuously. A "session POC" that moves every tick is not an auction level; it is a moving average with extra steps, and Dimension 2 of your manual ("Fade Value Area extremes back to POC") trades it as a structure. You already compute fixed session boundaries for `sessionVwaps` (Asia 00–08 / London 08–16 / NY 16–24 UTC) — reuse them: `session = profile(currentBlock)`, and keep the rolling 8h as a separate, honestly-labelled `rolling8h`. Half a day, and every "session POC" line in the desk logbook becomes comparable across rounds.

**Next five, if the above land:** (11) `decoders.ts` with throw-on-shape-mismatch + a per-upstream drift counter (§3 C8); (12) NTP offset from `fapi /fapi/v1/time` and a single `now()` (§3 C9); (13) route contract test matrix generated from a manifest (§4 T8); (14) Parquet sidecars for series → range scans in the backtester, JSONL stays the write path (§2 persistence); (15) tier the 61 assets into *tradeable* (MT5-mapped, 16) vs *analysis-only* (45) and refuse Grade A on assets missing ≥4 of 16 dimensions.

---

## 2. Architecture verdict

| Subsystem | Verdict | Why |
|---|---|---|
| `cg-signals.ts` (footprint engine) | **Keep — freeze it** | The only component with an external reference implementation. Treat as a vendored port: no refactors, fixtures only. |
| `signals.ts` (legacy percentile engine) | **Delete** | Unimported duplicate; see §1.5. |
| Tier ladder (fapi/feed/forming/client) | **Refactor** | Invariants and backoff are right; admission control and clock discipline are missing (§1.6, C9). |
| Narrative engine (`narrative.ts`) | **Refactor + calibrate, do not rewrite** | 1,209 lines but the structure (regime → M1/M2 → conflict → vetoes → checklist) is sound and the veto layer is the best-designed part of the product. The risk is threshold overfit, not architecture (§3 C4). |
| Route layer (48) | **Refactor** | Layering is broadly right for a local app; 5 routes hold real logic and one mutates on GET. No rewrite — 33 routes are thin enough to leave alone. |
| Persistence (JSONL + SQLite) | **Keep, extend** | JSONL for events + append-only audit is correct for a single machine and matches the "every number traceable" policy. Add Parquet sidecars for series read by the backtester; do **not** migrate to a TSDB. |
| MCP server | **Refactor tool surface** | Zero-dependency JSON-RPC is the right call; 25 tools is not (§1.8). |
| Desk protocol (git transport, files) | **Keep at 15 min; refactor before scaling cadence** | See §3 C7 and the D-section answer, Appendix. |
| Backtest / probability / calibration | **Keep — most under-used asset you have** | Walk-forward, stop-first, funding, fee/slippage, Monte Carlo, logit calibration is a real research stack. It is not wired into any decision gate. |
| Universe (`curated.ts` + `assets.ts`) | **Refactor** | Two registries, one of them fabricates instrument keys (§1.5). |

**On the 61-asset universe.** I would keep the *list* and change the *claim*. The manual's 16 dimensions are not uniformly available: D9 walls, D10 LTO, D11 liq clusters and D12 LSR all depend on multi-venue perp coverage; D13 options exist for BTC/ETH only; the anonymous stopmap exists for BTC only. Your own code documents this honestly (`fpVenues()` drops Hyperliquid for TradFi; `aggVenues()` seeds Binance-only). The consequence is that a TradFi perp with 6 structurally-absent dimensions can never legitimately reach Table 7's 5.0 threshold on the same footing as BTC — and if it does, the missing rows were scored generously, not measured. That is not a data-honesty failure (you do mark them `n/a`), it is a *comparability* failure. Fix is cheap: emit `dimsAvailable: 12/16` on every verdict, cap grade at B when < 12, and let the 360° table carry the column. Then 61 assets is defensible; without it, the graded shortlist is not comparable across the universe and the desk will systematically prefer whichever assets happen to have rich feeds.

**On DuckDB / Parquet / TSDB (your question 8).** Not worth a migration, but worth a sidecar. Your series payload is ~161 MB of small JSONL rows, mostly written once and scanned in time order — a shape Parquet loves and JSONL merely tolerates. But the write path (append-only, human-greppable, crash-safe, no dependency) is *correct for your constraints*, and 161 MB fits in page cache on any dev box. So: keep JSONL as the system of record, and have `backtest.ts` write/read `data/cg-backtest/*.parquet` via DuckDB's Node binding for range scans only. A TSDB (ClickHouse, Timescale) would add a daemon, a schema, a backup story and a port-3000-adjacent operational surface to solve a problem you do not have at 161 MB. That is a taste-free answer: the migration cost buys nothing until you cross ~10 GB or need concurrent readers.

---

## 3. Correctness risks — what I believe is wrong today

Ordered by severity × confidence. Each has reproduction reasoning and a fix. Where I could not fully verify by reading, I say so.

### C1. The quant "unit lock" cannot detect regression (confirmed, high)
`scripts/test-quant-math.cjs` re-implements formulas instead of importing them ("the .ts modules can't be imported from plain Node"), and `scripts/test-signal-parity.ts` has **no assertions at all** — it fetches bars from `localhost:3000`, runs `computeCgSignals`, and prints counts/types/last-8 signals. It never compares against a Coinglass fixture, so "parity verified for BTC/ETH" is a human eyeball event that leaves no artefact.
**Repro:** change `probability.ts`'s `√(8/π)` back to `/1.25`; run `node scripts/test-quant-math.cjs` → green. Change a `|δ| ≥ 15%` threshold in `cg-signals.ts`; run the parity script → prints different numbers, exits 0.
**Fix:** real imports via `tsx`/vitest; convert the parity script's *output* into a committed golden file (`tests/fixtures/btc-m15-300.signals.json`) and assert `computeCgSignals` reproduces it byte-for-byte after any refactor. Ground truth for the algorithm (not the data) can be captured once from the Coinglass page.

### C2. Repaint: verdicts are computed from a forming bar (high confidence, unverified upstream detail)
See §1.3. `market.ts` uses the trailing kline as if closed; `narrative.ts` derives `z`, grade, zone and stop from it; `paperbook.armFromVerdict` freezes them. The backtester explicitly does the opposite.
**Repro:** one test decides it — two `/api/cg/market?sym=BTC` calls 60s apart; if `candleAt` is unchanged and equals the current 15-min bucket start, the bar is forming. If so, a Grade A printed at T+2min is not reproducible at T+13min.
**Fix:** `closedBars()` for indicator inputs; `price.live` overlay; `verdict.barsUsed`.

### C3. `leadInstr` fabricates upstream instrument keys (confirmed, high)
`assets.ts:leadInstr` = `assetOf(s)?.leadKey(s) ?? \`Binance_${s}USDT\``. Any curated symbol absent from the legacy 33-entry `ASSETS` table gets a plausible-looking key rather than a null. Coinglass returns 40001/empty, `fp-load` degrades to fewer venues, and the aggregate is thinner than the badge implies. This is the same failure shape as the documented `1000SHIB` incident ("every non-Binance fp leg 40001s and the aggregate silently degrades to binance-only").
**Repro:** add a 62nd symbol to `CURATED` only, request `/api/cg/orderflow-agg?sym=<new>`; observe `missing[]` on all venues except Binance while the response is `ok: true`.
**Fix:** derived `ASSETS`; `leadInstr → string | null`; a boot assertion that every `CURATED` perp resolves to a non-null lead key.

### C4. Table 7 can double-count one event, and its untestable dimensions gate decisions (confirmed structurally)
Two paths consume the *same* footprint signal: the M1 trigger/confirmation (Bias 2-of-3 + "absorption/CVD-div at the zone" for A/A+) and Dimension 7's 2.0-point row ("at/inside the zone, ≤8h recency"), both computed from the same `computeCgSignals` output on the same aggregate. The manual forbids double-counting between D9 walls and D10 LTO; the same discipline is not visible between D7 and the model's own confirmation gate.
Worse for calibration: D9, D10, D11, D12 and D13 have **no historical source** in your backtest harness (it replays klines + funding only). So 5–6 of the 16 scored dimensions are structurally untestable, yet Table 7's ≥5.0 threshold and the LSR gate are presented as the objective that separates trades. You can never measure whether they help.
**Fix:** split Table 7 into `testable` (D2–D8, D14–D16 — replayable today) and `overlay` (D9–D13 — unverifiable, disclosed as such). Then run the existing walk-forward harness to report the testable sub-score's AUC/expectancy by grade. If the graded threshold shows no separation on 30 days × 58 assets, that is the single most valuable number this repo could produce — and it is already 80% implemented.

### C5. Paper-book statistics are selection-biased and truncated (confirmed)
See §1.4. `armFromVerdict` is called from a `GET`; sweep covers 2 symbols per 90s; caps skip silently into `armLog` which no report reads.
**Repro:** armed tickets will over-represent the handful of symbols a human visited; `PbStats.fillRatePct` divides by `armed` after caps, not by attempts.
**Fix:** as §1.4 (a/b/c).

### C6. GET has side effects, and the idempotency key tolerates drift (confirmed)
`narrative/route.ts`: `markViewed`, `ensurePaperBook`, `armFromVerdict` on `GET`. Fingerprint = `sym|model|direction|zone|stop`, but `isRefreshSibling` allows 0.6% drift → refreshes emit events and re-stamp `lastSeenAt`; a retried MCP call can therefore extend a ticket's life.
**Fix:** move arming out of the request/mutation path entirely (§1.7); keep the fingerprint for dedup but make refresh *not* extend `expiresAt` more than once.

### C7. Desk transport: single JSON rewritten non-atomically, merged by `git rebase` (confirmed mechanics, high risk at cadence)
`desk_daemon.mjs` runs `git pull --rebase origin main` then writes with plain `writeFileSync` (outbox replies, ALERTS, `.daemon-state.json`). `desk/state.json` is one 5,521-line JSON document that both agents and the human edit; JSON is not line-mergeable, so any concurrent edit during a rebase either conflicts wholesale or, if auto-merged, produces syntactically valid but semantically mixed state. `loadJson` swallows parse failures into `{}` — so a torn write does not error, it **silently resets the desk**.
`wake_360.mjs` drops a task file and then runs `desk_daemon.mjs --once` synchronously (15-min timeout); the daemon has a pid lock, so if the always-on daemon holds it the `--once` cycle exits — fine — but the task then waits up to 45s, and if both fire the state file has two writers within one cycle on two machines.
**Repro (mechanical):** kill the daemon during `writeFileSync` of `desk/outbox/*.json` → truncated file → next cycle reads `{}` → the reply is lost with no error.
**Fix (cheap, ordered):** (1) `atomicWrite` everywhere; (2) split state per writer — `desk/state/orders.json` (human/exec only), `desk/state/agent.json` (analysis only), `desk/state/daemon.json` — merged read-side, so no file has two writers; (3) `loadJson` must *throw* on parse failure for `state.json` and refuse to run a cycle rather than run on empty state. At 15 min this is comfortable; if you ever go below ~5 min, file+git stops being tenable and you need a local append-only log (JSONL with `git merge` on an append-only file is actually fine) rather than a mutated document.

### C8. Upstream decoding assumes shape; drift becomes `NaN` and then `null` (confirmed pattern)
Boundary code casts: `as { data?: KlineRow[] }`, then `Number(r[0])`, `+r[1]` on tuple positions. `Number(undefined) === NaN`, which flows into `emaSeries`/`dayVwap`, is filtered by `Number.isFinite` guards, and surfaces as a `null` field in a 200 response. A schema change upstream looks identical to a quiet market. `catch { m15 = [] }` in `market.ts` and `catch { return null }` in `quant`'s `cachedUpstream` compound it: the failure is invisible unless you happen to read `source`.
**Fix:** `src/lib/cg/decoders.ts` — explicit per-upstream decoders that throw with the offending field, plus a per-endpoint `shapeDrift` counter exposed in `/api/health`; propagate a `degraded: string[]` alongside `missing[]` (a pattern `fp-load` already uses correctly — extend it).

### C9. Clock skew is unhandled and freshness math degrades silently (confirmed logic, unverified severity)
Every freshness signal is `Date.now() − upstreamTs`. If the local clock is ahead, `ageMs` goes negative, `stale` is permanently false, `marketAgeBeyondBar = max(0, …)` clamps to zero, and the narrative will happily grade a set-up on hours-old bars while reporting millisecond freshness. Conversely a lagging clock makes every feed look stale and the desk refuses to trade — the safe direction, but indistinguishable from a real outage. `paperbook` TTLs/`expiresAt` and `M2_ARM_MAX_MARKET_AGE_MS` are all local-clock.
**Fix:** derive an offset from `GET /fapi/v1/time` once per minute (you already call fapi constantly), expose `now()` from `src/lib/live/clock.ts`, and clamp negative ages to a hard `stale: true` + `clockSkewMs` field.

### C10. Notification dedup can drop real events (low severity, confirmed)
`emit()` dedups on `asset|source|kind|barTs|barType|price` for 30 min, with `price` in the key "because whale walls and sweep setups carry no barTs". A wall that is pulled and re-added at the same price within 30 min is one event; a liquidation cluster re-entered twice at the same level is one event.
**Fix:** include an incrementing per-(asset,kind) sequence or the source's own event id where available; keep price as a tie-breaker, not an identity.

### C11. Dead code that masks intent (low, confirmed)
`liq-heatmap.ts:buildStopModel` computes `lastBar[]`, branches on it with an **empty body** (`// track the newest bar value per row (cross-section)` + no statement), then computes `tail` from the final bar only. `tail` therefore reports ~0 for any row absent from the last bar, and the abandoned code suggests the author knew.
**Fix:** delete `lastBar` and the empty branch; or implement last-seen age per row and label `tail` as "exposure at final bar" — do not leave a comment claiming a cross-section that isn't computed.

---

## 4. Testing & CI plan (minimal, single dev, single machine)

Non-negotiable constraint: **CI must not touch upstreams.** Every test below runs on committed fixtures. Your repo currently cannot distinguish "the market is quiet" from "the decoder broke"; a fixture-based suite is the only thing that fixes that in one weekend.

### The first 10 tests, in protection-per-hour order
1. **`indicators` golden** — 300 frozen BTC m15 bars → EMA13/89/233, RSI14, day VWAP + σ1/2/3, session/day/month POC-VAH-VAL, compared to values captured once from TradingView. Catches every "I cleaned up the loop" regression.
2. **`computeCgSignals` golden (time bars)** — frozen m15×300 → committed signal list (`ts|type|side|price|r|q`). The algorithm is a port; pin it.
3. **`computeCgSignals` golden (vol + range derived bars)** — plus `autoThreshold` determinism on the same m1 fixture. Three bar types are the product; test all three.
4. **`buildStopModel` golden** — frozen `liqHeatMap` payload → profile/tail/bands/totals. Pins the derived liquidation model.
5. **`fp-load` merge identity (property)** — merging Hyperliquid alone must equal the price-shifted lead series within float epsilon; merged `b+s` USD must equal the sum of venue contributions (no double-count). This is *the* invariant of AGENTS.md and it has no test today.
6. **`volumeProfile` conservation (property)** — Σ bins ≈ Σ bar volumes; `val ≤ poc ≤ vah`; every bin index in range for adversarial OHLC (zero-range bars, single-print bars).
7. **`dayVwap` sanity (property)** — `vwap ∈ [low, high]`, `sd1 ≤ sd2 ≤ sd3`, empty day → nulls not NaN.
8. **Route contract matrix** — generated from a manifest: for every route, `BTC` → 200 + schema-valid; unknown sym → 400 with `ok:false`; every interval token in the *route's own* vocabulary accepted. This single test makes the MCP-vocabulary bug class extinct.
9. **`buildNarrative` determinism** — frozen `market/signals/cvd/whale/liq/quant` fixtures injected → exact `{regime, activeModel, direction, grade, vetoes}`. Plus a **no-lookahead assertion**: every input's `dataAt`/bar ts ≤ `verdict.barsUsed.lastClosedTs`.
10. **Paper-book replay** — frozen m1 bars + one ticket → deterministic `ARMED → OPEN → TP1 → BE` sequence, plus the accounting identity `realized R = Σ legs frac × dir × (exit−entry)/risk`.

Then, in the same pass: delete the mirror tests in `scripts/test-quant-math.cjs` (port their *intent*, not their code), and convert `test-signal-parity.ts` into fixture capture + assertion.

### Pipeline (realistic for one dev)
```jsonc
// package.json
"test":  "vitest run",
"check": "tsc --noEmit && eslint . && vitest run"
```
- **Pre-push hook** (`.husky/pre-push` or a plain `.git/hooks/pre-push`): `npm run check`. This is the gate that actually matters for a solo dev on one machine — it catches the class of bug that costs you a desk round.
- **GitHub Actions**, one job, on `push` + `pull_request`: `npm ci && npm run check && npm run build`. No network beyond npm; no secrets; ~2–3 min with a warm cache. That is the whole CI. Do not add matrix builds, coverage thresholds or e2e — those are maintenance you will not pay.
- **Nightly (optional, cron on your own box, not CI):** `scripts/test-signal-parity.ts` against the live terminal + a live-fixture re-capture, producing a diff report. Live tests belong on the machine that has the terminal, never in CI.

Maintenance cost: ~1 fixture refresh per upstream schema change, ~0 ongoing. Expect 3–6 hours to get 1–8 green; that is the highest-return 6 hours available in this repo.

---

## 5. What I would NOT change

1. **`cg-signals.ts` as a frozen port.** It is the only component with an external ground truth, it is deliberately faithful (bars 5..n−2, median-of-20 gate, 40-bar pivot window), and every refactor of a faithful port is a parity regression waiting to happen. Fixtures over refactors.
2. **The tier ladder and the one-price rule.** Tier 0/1/2 with the badge naming the active tier, and "every displayed number resolves to one price" is the correct design for this product, and it is what makes the desk logbook auditable. The `+1.5s` strictly-newer guard on the aggregate/Binance tape merge is the right call — it trades a little freshness for eliminating double-counted volume.
3. **The fapi breaker's specific semantics.** Parsing the 418 `until` window, +10s, clamping past windows to 60s, retrying `-1003`-in-200 once then backing off 60s. That is hard-won and correct; the fix needed is admission control upstream of it (§1.6), not a rewrite of it.
4. **Freshness telemetry as a first-class field.** `dataAt / ageMs / stale` on every payload, the split `fastDataAt/slowDataAt` in `quant`, `candleAt` instead of `Date.now()` in `market`, and `missing[]` in `fp-load`. This is the best engineering in the repo and it is what makes the zero-mock policy enforceable rather than aspirational. Do not "simplify" it into a single `updatedAt`.
5. **`stale-while-revalidate` on the narrative route.** Serving the last verdict instead of a 502 is right for a desk UI — a stale grade you can see beats a blank card. (The *side effect* on GET must go; the resilience pattern must stay.)
6. **Paper-book conservatism.** Stop-before-target within a bar, frozen risk against `stopInitial` (not the BE-moved stop), gap opens filling at the open, real fees/slippage/funding, deterministic LCG. That is genuine backtest discipline and it is rarer than the features above it.
7. **`tokenizeCmd` + `shell:false` argv spawn in the daemon.** The comment documents a real RCE (`notify_cmd` interpolated into a shell with git-synced titles). The replacement is correct and the reasoning is written down. Do not let anyone "simplify" it back to a template string.
8. **The file-based desk transport at 15 minutes.** Two agents, one human, one machine, a 15-minute beat, and a requirement that every proposal be auditable after the fact — `git log` is a better audit trail than any message queue you would hand-roll, and the failure modes (conflict, partial write) are *loud* and fixable with atomic writes and per-writer files. It stops being tenable below ~5-minute cadence, not before.
9. **TypeScript/Next.js on :3000 and Zustand/TanStack client-side.** For a single-user local terminal the server-render-plus-SSE model is fine and the route-per-view mapping keeps the MCP surface trivial to derive. No reason to churn.
10. **The backtest/probability/calibration stack.** Do not touch it — wire it up (C4). It is the only part of the system that can tell you whether the rest of it works.

---

## Appendix — direct answers to the ranked questions not covered above

**A1 (heuristics spuriously firing).** The `sdiv` gate (±3 pivot, CVD gap > 25% of median, within 40 bars) and `abs`'s "30% zone + 1.2× opposing + closePos" are the two most fragile: both depend on a *median* over a window whose contents shift with venue coverage. When `fp-load` silently loses a venue (§3 C3), CVD per-bar values drop proportionally and the 25%-of-median test changes verdict without any market event. Recommendation: compute sdiv on *normalised* CVD (share of taker volume) rather than USD, and emit the venue count in the signal's `meta` so a venue dropout is visible on the chart.

**A2 (lookahead / overfit in narrative).** No lookahead in the *ordering* sense (everything is computed from bars ≤ now); the exposure is repaint (C2) and threshold density. `|z| ≥ 2.0` chase guard, `RISK` vetoes at 1.2R/1.5R, `spread > 12% → C / > 25% → SKIP`, `3-of-5 checks for A/A+` — each is individually defensible, jointly they are ~12 free parameters fitted to a handful of remembered trades. Your backtester already supports sensitivity grids (`m2Sigma`, `m1RFilter`); extend it to the narrative thresholds and publish a plateau, not a point.

**A3 (Hyperliquid price-shift alignment).** Shifting a USD-quoted venue's price onto the Binance lead level and merging footprint is defensible for *flow aggregation* (you are summing taker buy/sell in USD, which is shift-invariant) and defensible-but-lossy for *price-level* work (POC, absorption at a level), because the shift is a single scalar applied to the whole series: it removes the mean basis but not the basis *drift*. Honest error bar: on a 15m bar, the basis between HL and Binance USDT-M is typically a few bps and mean-reverting; the error you introduce at a level is ~|basis drift over the bar| / bar range — i.e. small relative to a 15m range, non-trivial on m1 derived vol/range bars. Say so in the UI (one line, "aggregate: Binance+OKX+Bybit+HL, HL price-shifted") and stop there. Do not build a dynamic basis model for this.

**A4 (validating liq/whale estimates).** Three cheap checks, all offline-computable from what you already archive: (1) **Persistence** — a cluster that "exists" should still be there 5 min later; your `liq-live` collector already stores 5m windows, so measure the level-survival rate and publish it as the model's own quality metric. (2) **Realised sweep rate** — of the top-5 clusters per day, how many were traded through within 24h? That number is the honest "magnet" hit rate; if it's ~50% the clusters are chart decoration. (3) **Stability of `strength`** — if the 0–100 strength of a fixed price level jumps ±30 points across consecutive snapshots, the number is noise and should not gate a trade (it currently can, via D11's "strength ≥ 50"). Weight by persistence × realised-sweep rate, not by raw USD.

**B5/B6 (races, stale windows, resilience).** Concrete races I can see by reading: (i) `forming.ts` commits a bar at 4 Hz from a 40 s tape while `engine.ts` polls klines every 60 s for the same series key — if a forming commit for bar *k* lands after the CG poll has written the closed bar *k*, the aggregate is replaced by a partial. *Unverified precedence — the deciding test is 15 lines: freeze a bar, force a forming commit after a kline poll, assert the closed bar wins.* (ii) `quant`'s inflight coalescing is keyed by string but the cache eviction is `cache.size > 128 → delete first key` (insertion order, not LRU) so a hot key can be evicted while cold ones live. (iii) `engine`'s 3-asset/60 s rotation over 58 assets is a ~20 min full pass, so a symbol's `stopmap`/`liqlevels` can be 20 min old while its `signals` are 2 min old — the narrative's per-field freshness tracker catches this correctly, which is why it exists; keep it.
Resilience: WS disconnect storms are handled at the transport level (5 s watchdog, singleton feed), but a *silent* upstream schema change is not (C8), and clock skew is not (C9). Partial backfills: `store.ts`'s resume-from-last-timestamp is sound for append-only series, and its 60k cap means a long offline gap is silently truncated at the head — the honest fix is a `truncated: true` flag on any series whose first row is not the requested start.

**C9 (three worst type/error patterns).** See C8 (unvalidated casts at the upstream boundary), plus: **errors collapsed to null with no trace** (`catch { m15 = [] }`, `catch { /* non-fatal */ }`, `catch { return null }`) so a degraded payload is indistinguishable from a quiet market; and **ad-hoc cache identity** — `cache.get(sym)` in `market.ts`, string keys in `quant`, `snapCache` in `fp-load`, with TTL constants (12s/20s/45s/90s) scattered per module. Fix the third with a named tier registry (`TIER0_LIVE`, `TIER1_REST`, `TIER2_AGG`) and a `key(...parts)` helper; it removes a whole class of cross-route aliasing.

**D11/D12 (MCP, desk).** Covered in §1.8 and C7. One addition on MCP: the cursor (`data/mcp-cursor.json`) is a per-machine mutable file with no atomic write and no lock — two MCP clients (or a restarted agent) can replay or skip notifications. Make it atomic, and add a server-side `since` echo in the response so the agent can detect a gap (`items.length === limit` → there may be more).

**E13 (UI).** Your information density is closer to an institutional footprint tool than most retail dashboards, and the tier badge is a genuinely good idea. Where institutional UIs differ, in order of value: (1) **one number per concept, with its timestamp adjacent** — you do this for data, not for derived values (a Grade A card should carry the bar it was graded on, per C2); (2) **ladder/price-axis alignment** — footprint, book walls, liq clusters and stopmap are four views of one price axis and should share it; (3) **explicit uncertainty** — an institutional screen labels "estimate" inline, not in a tooltip. You already write the words in the code comments; surface them in the UI.

---

### One-paragraph verdict

This is an unusually serious local trading system with a real research stack (walk-forward + Monte Carlo + calibration), genuine data-honesty discipline, and a signal engine that is a faithful port rather than an invention. Its weaknesses are not architectural — they are **epistemic**: the tests cannot fail, the verdicts are computed from a bar that is still moving, the paper book samples what the human clicked, "parity" is a printout, and 5 of 16 scored dimensions are unmeasurable while gating real trades. Fix those five things (≈4 dev-days) and the system's own numbers start being trustworthy; everything else on this list is then worth doing in the order given.