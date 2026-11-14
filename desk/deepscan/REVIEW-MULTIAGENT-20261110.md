# MULTI-AGENT ARCHITECTURE REVIEW · FundedNext Universe Expansion

2026-11-10 20:25 UTC · panel deployed per user directive (github.com/cliffano/tech-team-agents specs, run as 4 parallel review agents) · reviewed object: `EXPANSION-PLAN-20261110.md` + the actual working tree · guidelines: github.com/multica-ai/andrej-karpathy-skills (assumptions surfaced · simplicity first · surgical changes · verifiable criteria)

**Panel**: Gilfoyle (Systems Architect) · Elliot Alderson (Security & Data-Integrity) · Laurie Bream (Quant & Risk) · Jared Dunn (QA & Operations)

**Consolidated verdict: APPROVE-WITH-CONDITIONS (4/4)** — Phase 1 + Phase 2a ship; Phase 2b (XPT/USO) **BLOCKED** pending quant gates; Tier 3 stays deferred. Two security conditions are user-side and urgent (repo visibility, directive-channel auth).

---

## Blockers found → desk actions taken THIS RUN

| # | Finding (agent) | Desk action taken |
|---|---|---|
| B1 | Phase 1/2a code uncommitted, 2 commits unpushed — sandbox recycle erases it; atg-exec acting on stale 19:52 broadcast (Jared F1, Gilfoyle F2) | **Fixed**: explicit code commits + safe-window push below |
| B2 | `360 XLM XMR` silently fell back to scanning BTC — a trap, not a gate (Gilfoyle F1, Jared F2) | **Fixed**: unknown symbols now hard-error with the known-symbol list; legacy silent BTC fallback refused |
| B3 | XLM/XMR absent from `config.symbol_map` → §7 would false-negative "feed dead" forever (Jared F3) | **Fixed**: `XLM: XLMUSD`, `XMR: XMRUSD` added (directive-authorized evaluation) |
| B4 | DECS staging gate extended + smoke test: **`360 XLM XMR` → 2 full 8-section reports, all sources OK** (Jared runbook step 3) | **Done** (reports `XLM-20261110-2020.md`, `XMR-20261110-2020.md`; both scorecards resolve SHORT 7×–1×; XLMUSD/XMRUSD broker keys pending daemon feed) |
| B5 | Sandbox terminal is dev-mode with hot reload — already serves 14 assets incl. XLM/XMR (Jared F6); plan criteria 5-7 re-scoped | **Verified live**: `/api/cg/assets` = 14 syms; `market?sym=XLM` 200 @ 0.1448; `market?sym=XMR` 200 @ 558.89 |

## Blockers/major findings requiring USER decision (not desk-actionable)

### Security (Elliot) — urgent, user-side
- **S1 [BLOCKER] Repo is PUBLIC and streams live trading telemetry**: `desk/mt5.json` (broker acct REDACTED, equity, positions), live tickets/entries/stops in WAKEUP.md broadcast, pushed every 45s. → **Fix: make repo private (2 min, zero pipeline impact)**; swap classic PAT → fine-grained scoped to this repo.
- **S2 [BLOCKER] Directive channel unauthenticated**: any push to `desk/inbox/*.json` fires on the Windows box within 45s (no signature, no freshness check, filename-dedupe only). → **Fix: HMAC-SHA256 sig + ts freshness on inbox processing (~15 lines, daemon side)**.
- **S3 [MAJOR] daemon.json command fields are git-tracked and shell-executed** (`notify_cmd`/`wake_cmd`/`terminal_boot_cmd`) + `notify()` interpolates alerts.json text through `shell:true` → injection path. → **Fix: move commands to gitignored `desk/daemon.local.json`, argv-array not shell string.**
- **S4 [MAJOR] Sizing is circular-trust**: spec fields come from the same mt5.json being validated; spoofed tickValue/equity prints self-consistent lies; no notional/margin bound. Zero-fields fail safe today, but XAG-live-at-0.72% proves caveats are advisory. → **Fix proposals in quant section (Q5-Q7).**
- **S5 [MAJOR] Secret proliferation**: Coinglass static AES key + TOTP in tracked files + now untracked probe copies. It's Coinglass's shared web-client key (not a user credential) — real risk is a public greppable ToS-bypass artifact. → repo-private (S1) mostly contains it; move live keys to env going forward; do NOT history-rewrite (breaks both machines, key already archived publicly).

### Quant & risk (Laurie) — engine-rule proposals, user approval required
- **Q1 [BLOCKER for Phase 2b] str≥40 is RANK-NORMALIZED per symbol** (`liq-model.ts: strength = 100×row/max-of-own-top10`): thin books do not degrade to "honest rejects" — they **confidently pass phantom magnets** (USO's 368 levels will print str-100 clusters that are str-10 noise on ETH). R inflates exactly where data is weakest (lone far magnets pass R≥2 with no leverage mass behind them).
- **Q2 [MAJOR] USO scorecard partially synthetic**: OKX-only lead → CVD/footprint-Δ single-source; 3 of 8 dimensions broken-but-voting.
- **Q3 [MAJOR] Funding on XPT/USO** = read on a 2-4-venue niche, no arb anchor to the physical commodity; signal market ≠ execution market.
- **Q4 [MAJOR] Expansion is a selection machine, not diversification**: pairwise ρ≈0.7-0.85; variance factor 0.90 (n=2) → 0.81 (n=13) = +1.3% variance reduction for +31% upstream calls; candidate queue already 3× oversubscribed (6 cards ≥2R for 2 slots).
- **Q5 [MAJOR] Min-lot policy is a negotiation, not a control**: round-to-nearest-step can round UP above mandate; XAG live at 0.72% on a one-time verbal acceptance = 30% of the daily loss budget deleted (10 full-R losses at 0.5% → 6.9 at 0.72%); joint ETH+XAG book = 1.22% burnable in one correlated squeeze.
- **Proposed engine v3.3 rules (each testable, one line)**: (1) data-depth gate for PLACEABLE: liq-levels ≥1,000 AND fp venues ≥3 — XLM 2,263/4v ✓, XMR 1,748/3v ✓, XPT 1,363/2v ✗, USO 368 ✗; (2) absolute magnet floor: T1 USD ≥ max($5M, 0.25% perp OI) on top of str≥40; (3) lone-magnet guard: R≥2 by T1 + a second str≥40 within 1.5× T1 distance, or T1 ≥$10M; (4) sizing floor-to-step (never round up) + status BLOCKED (not PLACEABLE-with-⚠) when volumeMin forces risk > mandate; (5) per-symbol risk overrides in config only, hard-capped 1.5× mandate, concurrent cap drops to 1 while an override is live; (6) correlation cap as config (2 when ≥80% candidates share bias); (7) funding vote → context-only when perp OI <$100M or ≤2 funding venues; (8) numeric Δ-div persistence: cancel standing entries after 2 consecutive scan cycles or one full m15 impulse against bias.
- **Do NOT (Laurie)**: ship Phase 2b as written; basket-adjust XAG by widening stops (destroys 2σ structure) — XAG is simply untradeable at 0.5% until equity ≥ $6,704; build Tier 3 (negative option value at a 1-2 concurrent cap).

### Architecture (Gilfoyle) — follow-ups
- **A1 [MAJOR]** `desk_round.py` still scores/suggests SOL/BNB/AVAX orders (NOT_LISTED lives only in deepscan) — two sources of truth for broker reality. → adopt "symbol_map value = ticker, null = not listed" semantics across desk_round/desk_deepscan/mt5_report in a follow-up commit (deferred: touches the 700-line round engine; suggestions still pass user-DIR approval, so blast radius today = noise, not risk).
- **A2 [MAJOR]** Phase 2b's `mk()` leadKey override is necessary but INSUFFICIENT: `Binance_${sym}USDT` is hardcoded in 5 call sites (market.ts:72, scan.ts:477, engine.ts:125/345/497, bookwalls:119, ticker:35). Centralize lead derivation before USO. Also `kind:"commodity"` doesn't compile (`AssetCfg.kind = "crypto"|"metal"`).
- **A3 [MINOR→win]** XPT needs NO new abstraction: `mk("XPT","Platinum","metal",2,"slow",false)` + DECS entry = ships today (Binance lead exists, metals branch handles venues) — blocked only by Laurie's data-depth gate (2 venues < 3).
- **A4 [MINOR]** Scanner budget: slow lane 9→11 assets = +22% rescan latency; SOL occupies the FAST lane despite no execution path — demote in a follow-up. XMR Binance spot was delisted (privacy coin) → spot-heatmap tab may stream-error; verify or gate.
- **A5 [MINOR]** Per-asset SPOF: single Binance lead, no fallback chain (fp-load throws if lead dies) — XMR's Binance relisting is volatile; pre-loaded failure for USO.

### Operations (Jared) — adopted now / follow-ups
- **O1 (adopted)** `git config rebase.autoStash true` on desk side; explicit code commits separate from desk/ data sweeps; push in the safe window (right after a `desk(round)` commit lands on origin — state.json idle).
- **O2 (adopted)** `.gitignore`: `external/` (the two cloned skill repos) + `scripts/probe-new-syms.mjs` (contains a key copy; untracked copies under /tmp are ephemeral).
- **O3 (adopted)** CHECKLIST-360 v1.4: universe 14, runtime note, sandbox boot = `npm run dev` (NOT start-server.mjs — no .next/standalone here), record which terminal served the run.
- **O4 (follow-up, user note)** WAKEUP convention line for atg-exec: on daemon "pull failed"/mid-rebase → `git rebase --abort && git pull --rebase origin main`.
- **O5 (deployed as DIR-0008)** Windows-side productionize: pull → `npm ci` → `npm run build` → restart terminal → verify `/api/cg/assets` includes XLM,XMR on that box + confirm DOGUSD/LNKUSD/XLMUSD/XMRUSD spread keys appear in next mt5.json pushes (mt5_report maps automatically via symbol_map).

---

## Karpathy-guideline compliance statement (how the diff honored the four rules)
1. **Think before coding**: assumptions surfaced in plan §7 (5 numbered, incl. the XMR-relisting volatility and daemon key-timing assumption); multiple interpretations resolved to the tiered design instead of silently picking "scan all 96".
2. **Simplicity first**: tiered data-gating refuses the 96-asset scanner; XPT's "new abstraction" (Phase 2b leadKey override) was CUT after review showed the metals pattern needs zero new code; UKO/T3 not built.
3. **Surgical changes**: desk diff = resolver + map + NOT_LISTED handling + loud-fallback fix (every line traces to the directive or a panel blocker); no adjacent refactors; daemon untouched.
4. **Goal-driven execution**: plan §6 criteria table; B1-B5 above closed the loop this run (unknown-symbol error tested, XLM/XMR smoke-tested, 14-asset terminal verified live); criteria 5 (daemon feed keys) is DIR-0008's verification task.

## Residual risk register (accepted, with owner)
| Risk | Owner | Trigger to revisit |
|---|---|---|
| Repo public (S1) | USER | immediately — before next session ideally |
| Inbox auth (S2/S3) | USER + atg-exec | before scaling directive volume |
| str-rank-normalization (Q1) | user approval → desk engine v3.3 | before ANY Phase 2b asset goes PLACEABLE |
| state.json config round-trip race | desk+atg | if a symbol_map edit ever reverts post-push |
| XMR Binance relisting reverts | desk | criterion: XMR market/fp route errors → remove from DECS |
