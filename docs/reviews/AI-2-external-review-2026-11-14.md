# External architecture review #2 — CG Order-Flow Terminal (2026-11-14)

> **Archived copy.** The AI-2 review was supplied in the user message
> (2026-11-14, "Prompt output AI 2"); no separate upload file exists — the
> two `upload/Pasted Content_*.txt` files both contain the AI-1 review.
> Content below is preserved verbatim from the message.

---

**0. Most urgent: the repo appears to be public and contains live account data**

I cloned it anonymously. desk/mt5.json is committed and contains: the MT5
account login (REDACTED); balance, equity, margin and leverage; open
positions with ticket numbers, entry, SL and TP; pending orders.
desk/state.json, positioning.json and alerts*.json are committed too, and
the daemon pushes them every cycle. If the repo is public, anyone can see
your live positions and stops in near-real time, and a broker login number
is a social-engineering aid. .env.example is committed and probably
harmless, but check it. The .gitignore I saw has no desk/ runtime rules and
no .env rule in its first 30 lines. Confirm .env is ignored.

Fix (about an hour): make the repo private, or move desk/ runtime state to a
private repo. Add desk/mt5.json, desk/positioning.json, desk/*.local.*,
scripts/*.json and scripts/*.xlsx to .gitignore. Purge history with git
filter-repo. Rotate anything that ever touched the repo, including Binance
testnet keys and Coinglass tokens, if scripts/cg_token.py or
decrypt_capture.py outputs were ever committed.

**1. Top 10 improvements, ranked by impact ÷ effort**

1. Close the public-data leak (section 0). Impact is high and effort is
   hours, so this is #1.
2. Add CI with real gates. There is no .github/. Add one workflow running
   next typegen, tsc --noEmit, eslint, vitest run and next build.
   eslint.config.mjs turns off nearly everything useful: no-explicit-any,
   no-unused-vars, no-empty, prefer-const, ban-ts-comment, and
   react-hooks/purity. Turn on no-floating-promises and
   no-misused-promises first (type-aware). Those matter most in a codebase
   with 22 module-level cache maps and many pollers. Make no-explicit-any a
   warning. Effort is half a day.
3. Write golden and property tests for the pure cores (section 4).
   computeCgSignals, buildDerivedBars, mergeFp, foldTapeIntoFp and the
   fapiFetch ban parser are pure and deterministic, so they are cheap to
   test. This is the highest-leverage engineering work after CI.
4. Fix the frozen partial-candle bug in the store (R1 below). It is cheap
   to fix and it silently corrupts the liquidation-heatmap model input.
5. Add a signal-outcome ledger, which is the validation you're missing.
   Persist every emitted signal and notification with {asset, bar type,
   signal type, bar close ts, emitted_at, price at emission}. A nightly job
   fills in forward returns at +1, +4, +16 bars and the MFE/MAE in ATR
   units, split by signal type, asset tier and time of day. You then get
   hit rates with confidence intervals and can retire or reweight
   heuristics from evidence. Today "parity with Coinglass" proves the port
   is faithful, not that the signals predict anything. Put this next to
   scan.ts, which already emits events, and reuse backtest.ts plumbing.
6. Calibrate the live-overlay merge empirically. The +1.5 s guard is a
   guess. See R3. Effort is about 2 days, mostly the measurement script.
7. Split the route layer into thin handlers and services. Several routes
   are big: quant/route.ts 734 lines, options/route.ts 695,
   oracle/route.ts 656. Create src/server/services/{quant,options,oracle,...}.ts
   that take typed inputs and return typed DTOs. Routes keep only parsing
   (params.ts is already a good chokepoint), the call, and the envelope. Use
   zod for the DTOs, which also gives you MCP tool schemas. Do this
   incrementally, one route per commit, starting with the ones that get
   tests.
8. Triage scripts/. It has 184 files and 33 MB, with 81 .py, 31 .mjs and
   13 .ts. Create scripts/infra/ (desk daemon, round, start-server,
   migrate), scripts/research/ (parity, audits, scanners) and
   scripts/scratch/ (gitignored). Delete analyze_fills[2-5].py-style
   numbered iterations and commit nothing under scripts/*.json or *.xlsx.
   Add one README of a few lines. This is cheap and removes a lot of
   cognitive load.
9. Make the desk state conflict-free by construction (section 2, desk
   protocol). Split state.json by writer and make round artifacts immutable
   per-round files. This fixes growth, merge conflicts and replay in one
   design.
10. Harden the breaker and the Coinglass client (R4 and R5). Add real
    weight accounting from x-mbx-used-weight-1m, single-flight under a ban,
    and route the browser-direct fallback through the same budget. Fix the
    cooldown skip bug. Effort is about a day.

**2. Architecture verdict**

- Signal engine (cg-signals.ts): Keep the port, refactor the usage. The 1:1
  port is good practice and deterministic. The risk is in how it's
  consumed: repainting trap signals, bar thresholds that depend on window
  length, no outcome tracking. Add the ledger and time-of-day normalization.
- Tier ladder (Tier 0/1/2): Keep the concept, refactor the merge. The tier
  badge and one-price rule are the right idea. The merge currently lives in
  the browser (footprint-tool.tsx displayBars) with a timestamp-guess guard
  and two unsynchronized clocks. Move the reconciliation into a testable
  pure module.
- Route layer: Refactor (incremental). 48 routes is fine. Business logic in
  routes is the problem. Service split is mechanical and can be done per
  route.
- Persistence: Keep JSONL for hot data, fix correctness, add DuckDB for
  research only. A 60k-row-per-series cap with whole-file in-memory load is
  fine for 61 assets × a few intervals on one machine. A TSDB migration
  costs more than it returns. DuckDB reading the JSONL read-only
  (read_json_auto) gives you analytics for near-zero migration. Parquet
  matters only if you start doing cross-asset research on the full 161 MB.
- Prisma/SQLite: Remove. Only src/lib/db.ts references it, and
  prisma/schema.prisma has just the template User and Post models. It's
  dead weight and a source of misleading documentation.
- MCP server: Refactor lightly. Tool granularity is mostly fine. The real
  issues are the cursor semantics and response size.
- Desk protocol (git transport): Keep git, change the file layout. Git is a
  reasonable transport when one side is a sandbox that can't reach your
  machine. The problem is the shape of the files, not git.
- Coinglass dependency: Keep, but treat as the top operational risk. Add
  contract tests with sanitized recorded fixtures; keep Binance-native
  fallbacks wherever a number can be derived; don't build new features that
  exist only on the Coinglass side without a degrade path.

Existential dependency: the reverse-engineered Coinglass handshake is the
single point of failure for Tier 2. Your own README notes it replicates the
logged-out browser handshake with no SLA and no ToS cover.

MCP: cursor semantics (mcp/server.mjs:190) — the notifications tool
advances the stored cursor on read, from a single shared file
data/mcp-cursor.json. If the agent crashes after the fetch but before
acting, those events are lost. If two clients share the file, one steals the
other's events. Use a per-client consumer_id and make the advance an
explicit ack. Context efficiency: add detail: "brief" | "full" to the heavy
tools and default to brief. analyze_setup as a one-call bundle is the right
idea; let it accept include=[...]. Tool count: 24 is acceptable. Rather
than cutting, make the descriptions say when not to call a tool.

Desk protocol — correction to the premise: PROTOCOL.md says the analysis
agent (zai-desk) wakes only 3 times a day plus on user messages. The
15-minute cadence is driven locally by desk_round.sh and desk_round.py (738
lines of deterministic logic). So the 15-minute requirement is a script, not
an LLM loop. That's good, because it's testable, but it means desk_round.py
re-implements confluence logic that also exists in TypeScript (narrative.ts).
Two implementations of the same scoring will drift. Have the Python round
call /api/cg/narrative and consume its output instead of recomputing.

Where git breaks: conflicts (daemon auto-commits + pull --rebase with both
agents editing one 5.5k-line state.json); partial writes (no atomic
temp-and-rename in the desk writers — store.ts does it correctly, the desk
layer doesn't); replay (if processed inbox files are marked by presence in
outbox/, a lost outbox push means the instruction replays — include an
idempotency key, the DIR number, and check it against the broker's order
comments before placing); growth (desk/ is 43 MB on disk already, with a
push every cycle). Fix before raising cadence: split state by writer
(state.analysis.json / state.exec.json); write each round's output as an
immutable file under desk/rounds/YYYY/MM/DD/<ts>.json; keep state.*.json
small; rotate log.md daily; write all files via temp-and-rename with a
schema_version. Cadence: git at 15 minutes is fine. Don't push every 45 s
cycle. Push when something changed.

**3. Correctness risks**

R1. In-progress candles are persisted and frozen (likely a real bug).
store.ts dedups by key with first-write-wins. engine.ts:53 defines keyKline
= r => String(r.t). The pollers append fetchKlines(inst, "m15", 96) results
with no filtering of the still-open bar. So the open 15-minute candle gets
appended with partial OHLC, and when the final version arrives with the same
t, it is discarded as a duplicate. liq-heatmap.ts:258 reads those archived
klines via rowsOf(...), so the liquidation heatmap model consumes truncated
candles. Reproduce: run the engine across a bar boundary, then compare the
stored row for the last-closed bar with the exchange's final kline. Fix:
make kline append an upsert (last-write-wins for a bar whose t is within one
interval of now), or drop the final row of each fetch unless closeTime <
now. Add a startup repair that refetches the last few archived bars.

R2. Signals repaint, and bar boundaries depend on the loaded window. Trap:
a trap on bar l is only emitted if one of bars l+1…l+3 reverses; the signal
is stamped ts: X[l].ts but only exists up to 3 bars after that — it must
carry an emitted_at or confirmed_at_bar, and backtests must use the
confirmation bar. Auto volume and range bars: autoThreshold derives the
threshold from the loaded window (10× average 1m volume; 0.25% of the last
close) — same history, different fetch length gives different bar
boundaries. Freeze the threshold per (asset, UTC day) and record it with
each signal. Seasonality: the volume gate is 0.8 × median(prior ≤20 bars) —
straddles the overnight-to-open transition; normalize by a time-of-day
volume profile instead of the trailing median. Multiple-testing: 61 assets
× 3 bar types × ~5 signal types × every bar — the outcome ledger is what
tells you the base rate.

R3. The live overlay's +1.5 s guard is a heuristic across two clocks. In
footprint-tool.tsx, cut = max(aggUpdatedAt + 1_500, Date.now() - 40_000).
Browser event time, server timestamp and browser clock are compared
directly. If the aggregate goes stale > 40 s, the tape ring silently drops
the trades between the aggregate cut and 40 s ago. aggTrade merges
consecutive same-price fills, so per-row trade counts are systematically
lower than venue trade counts [inferred, verify]. Fix: measure the offset
distribution, use the measured p95 as the guard; estimate clock offset from
/fapi/v1/time once a minute; extend the tape ring to cover the aggregate's
age up to a cap; move the fold to a pure function with tests.

R4. The "weight-bounded" breaker is reactive only, and one path bypasses
it. fapiFetch has no weight accounting; it doesn't read x-mbx-used-weight-1m.
Nothing is single-flight — many requests can pass fapiBanned() before the
first 429 lands, and each one in the burst extends a 418 ban. The
-1003-in-HTTP-200 branch waits 400 ms and fires a second request during a
claimed ban. src/lib/binance/direct.ts calls fapi.binance.com straight from
the browser, bypassing the breaker — in a local deployment that hits the
same banned IP and can prolong the ban. Fix: read the used-weight header
and keep a local sliding-window budget (leave about 30% headroom); add a
single-flight probe when tripped; drop the in-ban retry; gate direct.ts on
a config flag that defaults to off for local deployments.

R5. Coinglass client skips the cooldown wait when it's longest. In
client.ts cgGetInner, during a host cooldown the code sleeps the remaining
window only if (rem > 0 && rem <= 15_000). Otherwise it falls through and
fires the request. The cooldown is set from waitMs, which can be up to
25 s. For remaining windows of 15–25 s, callers send requests into the ban.
Fix: if remaining time exceeds the cap, throw a typed CooldownError
(callers already handle stale-serve) rather than proceeding.

R6. Torn trailing line corrupts the next appended row. store.ts skips
corrupt lines on load, but append uses appendFileSync(... rows.join("\n")
+ "\n"). If a crash left a partial last line with no newline, the next
append merges the partial text and the first good new row into one invalid
line. You lose a good row, silently. Fix: on hydrate, if the file doesn't
end with \n, truncate to the last newline. Test it by writing a truncated
fixture and appending.

R7. Table 7 confluence probably double-counts one signal source [inferred].
The 16 dimensions include footprint signals, CVD, delta, absorption, book
walls and large-order flow, and most are views of the same taker-flow
stream. Test it: compute the correlation matrix of the dimension scores
over the history you archive, and run an ablation that drops one dimension
at a time. If the correlation clusters are strong, weight clusters rather
than dimensions.

R8. Hyperliquid alignment error bar. Shifting HL prices by one offset per
bar assumes the basis is constant within the bar. Compute (a) the intrabar
variance of the HL−Binance basis relative to the footprint tick and (b) the
fraction of HL volume that lands in a different price row than a per-trade
alignment would give. Cheapest check: a property test that jitters the
shift by ±1 tick and counts how often signals flip.

R9. Liquidation clusters and whale walls: how to weight them. Score
clusters against the actual liquidation stream (@forceOrder, already in the
Binance tier); score walls by persistence, touched-and-held, and pull rate.
Feed these hit rates back as weights into the narrative, with a
minimum-sample rule so an unproven source gets weight zero.

R10. Narrative and backtest overfit risk. Check: (1) the calibration
(logit) and thresholds are fit on a window disjoint from the evaluation
window; (2) the number of parameter combinations tried is recorded, so you
can apply a deflated-Sharpe-style haircut; (3) results are broken out by
regime.

**4. Testing and CI plan for one developer on one machine**

Principle: test the pure functions that can silently produce wrong numbers.
Skip UI tests. Use Vitest. First 10 tests: computeCgSignals golden file;
computeCgSignals invariants (property tests, fast-check); buildDerivedBars
volume conservation; mergeFp / fpFromBuckets conservation and venue-order
independence; foldTapeIntoFp conservation and cut handling; fapiFetch
breaker (mock fetch: 429 with/without Retry-After, 418 future/past/none,
-1003 in 200, no request while banned); client.ts (coalescing, 429
cooldown, stale-serve, byte-budget eviction, the R5 bug); store.ts (dedup,
retention, atomic rewrite, torn-line recovery R6, kline upsert R1);
narrative determinism + no-lookahead; contract tests for upstream schemas
with recorded sanitized fixtures. Pipeline: local pre-push hook (tsc
--noEmit + vitest run); GitHub Actions on push and PR (npm ci, next typegen,
tsc, eslint, vitest, next build — about 4 minutes); nightly parity + ledger
update + schema-drift probe. Maintenance: about an hour a month.

**5. What I would not change**

The tier ladder and its badge; the 1:1 port of the Coinglass signal engine
including quirks; the curated 61-asset universe (tier the scanning cadence
rather than shrinking the list; the TradFi perps need time-of-day
normalization, not removal); stale-serve with explicit marking, the LRU
with a byte budget, request coalescing, and the baton-pass concurrency
gate; atomic temp-and-rename compaction and loopback-by-default binding
(proxy.ts Sec-Fetch-Site + Host-allowlist guard); walk-forward backtest
with fees, slippage and funding in R; JSONL plus in-memory index for hot
series (add DuckDB read-only if research becomes painful); Next.js and
TypeScript, single process, globalThis singletons; git as the desk
transport.

**6. Known gaps: confirmed or refuted**

No tests, parity only for BTC/ETH — confirmed (parity proves port fidelity,
not signal validity). scripts/ mixes infrastructure and scratch — confirmed
(184 files, 33 MB, with outputs committed). Two sources of truth for scope —
confirmed (README still describes 12 assets, AGENTS.md says 61; README says
"20 tools"; pick AGENTS.md as canonical). Desk state grows unboundedly —
confirmed, and worse than a size issue because it is a conflict surface.
XAU/XAG tab hiding — not verified. No CI — confirmed, and ESLint is nearly
disabled.

New findings not in your list: public repo with live account data; frozen
partial candles; repainting trap signals; breaker bypass in direct.ts;
cooldown skip; torn-line corruption; dead Prisma layer; duplicated scoring
logic in Python and TypeScript.
