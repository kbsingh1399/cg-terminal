# AI PEER-REVIEW PROMPT — CG Order-Flow Terminal (2026-11-14)

> Canonical copy. Repo: `kbsingh1399/cg-terminal`, branch `main`, HEAD `233d50e`.
> Paste everything below the cut line into the other AI, unchanged.

---8<--- (cut here) ---

# CODEBASE & ARCHITECTURE REVIEW REQUEST — CG Order-Flow Terminal

You are being asked to act as a senior external reviewer (think: staff engineer + quant desk tech lead doing a paid architecture audit). Review our repository and propose improvements. We want honest, critical, specific feedback — not praise. If something is badly designed, say so and justify it.

## 1. WHERE THE CODE IS

Clone and inspect the repository:

**https://github.com/kbsingh1399/cg-terminal**

```bash
git clone https://github.com/kbsingh1399/cg-terminal.git
cd cg-terminal
npm install
```

Read in this order (it maps to how the system is layered):

1. `README.md` — feature surface, tabs, data honesty rules
2. `AGENTS.md` — architecture invariants (real-time tier ladder, one-price rule, no-double-counting, weight-bounded fapi)
3. `desk/PROTOCOL.md` — the two-agent trading desk contract
4. `desk/TRADE_FORMULATION_MANUAL.md` — the 6-step DECIDE framework + 16-dimension data contract + Table 7 confluence scoring
5. `src/lib/` — engine core: `cg/` (Coinglass client + series), `live/` (Binance WS/REST + circuit breaker), `universe/curated.ts` (61 assets), `desk/`
6. `src/app/api/cg/` — 48 API routes (narrative, quant, bookwalls, cvd, liqlevels, stopmap, signals, notifications, backtest, paperbook, ...)
7. `mcp/server.mjs` — 24 MCP tools for agent integration
8. `scripts/` — desk daemon, analysis rounds, scanners (some operational scratch scripts live here too)
9. `tests/` — currently only build/runtime smoke tests

Stack: Next.js 16 (App Router, React 19, TS), Tailwind 4 + shadcn/radix, Zustand, TanStack Query/Table, Prisma/SQLite, Recharts. ~46.5k LOC of TypeScript under `src/`, 184 scripts, 48 API routes. Local-first: single dev machine, `npm run dev` on :3000, data cached in `data/` (~161 MB series) and `db/custom.db`.

## 2. WHAT THE TERMINAL DOES (context, 60 seconds)

A local, institution-style order-flow terminal for 61 curated assets (30 crypto USDT-M perps, 28 TradFi USDT-M perps under plain names like NVDAUSDT/XAUUSDT/ANTHROPICUSDT, 3 classic Yahoo-feed symbols SPX500/UKO/NDX100). Every number is live API data — zero mock values. Three data tiers serve every displayed number, and the UI badge names the active tier: Tier 0 WebSocket (sub-100 ms price, forming-bar footprint accumulation), Tier 1 REST (250 ms–1.2 s Binance fapi + top-1000 live book), Tier 2 Coinglass aggregates (3–30 s, multi-venue footprint/CVD/liq/bookwalls). A continuity engine backfills offline gaps on boot. A server-side scanner emits signal/whale/cluster/VWAP events to an SSE feed. On top of the terminal sit: an MCP server (24 tools, plugs into the Antigravity IDE agent) and a two-agent trading desk (a sandbox analysis agent + a local execution agent with MT5), coordinated via git-synced desk files (`desk/PROTOCOL.md`), a 15-minute analysis round daemon, and a scheduled 360° full-universe formulation wake (`scripts/wake_360.mjs`). Trade formulation follows a written playbook: 6-step DECIDE, 16 telemetry dimensions, Table 7 confluence scoring (Grade A ≥ 7.0 pts → 1.0% risk; B 5.0–6.5 → 0.5%; < 5.0 no trade), LSR liquidation-magnet gate, 40/40/20 scale-outs, +1.0R breakeven invariant.

## 3. WHAT WE WANT YOU TO REVIEW — ranked by value to us

### A. Signal-engine & analytics correctness (highest value)
1. `src/lib/cg/` signal engine — absorption/divergence/trap/exhaustion detection on three bar types (15m time / auto volume / auto range). Are the detection heuristics sound? Where could they fire spuriously? What validation (against exchange ground truth) is missing?
2. Narrative/quant endpoints (`/api/cg/narrative`, `/api/cg/quant`) — the deterministic M1/M2 verdict, regime classification, and Table 7 scoring. Look for lookahead bias, unstable parameters, thresholds that look overfit to recent regimes.
3. Multi-venue aggregation — Hyperliquid price-shifted onto the Binance lead kline before aggregating footprint across venues. Is the alignment method defensible? What's the honest error bar?
4. Liquidation-cluster and whale-wall estimates (Coinglass-derived) — how should we validate / weight them instead of trusting them blindly?

### B. Real-time architecture (high value)
5. The three-tier ladder and its invariants (AGENTS.md): one-price-everywhere rule, no-double-counting merge (aggregate + strictly-newer Binance tape with +1.5 s guard), weight-bounded circuit breaker with 429/418 backoff and 60 s probe cap. Race conditions? Stale-data windows? Better merge strategies?
6. Resilience: what happens on WS disconnect storms, upstream schema drift, clock skew, partial backfills? Where does the continuity engine's resume-from-last-timestamp design break?

### C. Engineering quality (medium-high value)
7. The `src/app/api/cg/` route layer — 48 routes. Is the layering right, or is business logic leaking into routes? Propose a service-layer split if warranted.
8. State management and caching design (Zustand + server-side caches + `data/` JSON persistence + SQLite). Is this the right persistence for ~161 MB of series and 61 assets × many intervals? Would DuckDB / Parquet / a proper TSDB be materially better, and is the migration worth it on a single-machine deployment?
9. Type safety and error handling: find the three worst patterns in `src/` and propose concrete refactors.
10. Testing: we have almost none (three build/runtime smoke tests). Propose the minimal high-leverage test suite for this system (what to unit-test, what to golden-file, what to property-test) — sequenced so the first 10 tests give the most protection.

### D. Agent/desk layer (medium value)
11. The MCP server (24 tools, `mcp/server.mjs`) — tool granularity, context efficiency for an LLM consumer, cursor-based notifications design. Would you restructure the tool surface?
12. The two-agent desk protocol (git as the transport, file-based inbox/outbox, daemon-driven rounds). Where does this break (conflicts, partial writes, replay)? What would you change before scaling cadence beyond 15-min rounds?

### E. Product/UX (lower value, but interested)
13. Terminal UI (`src/components/`) — information density, tab structure, what an institutional order-flow UI does better.

## 4. KNOWN GAPS — confirm, refute, or add

- No automated test suite; parity vs Coinglass is verified only for BTC/ETH footprint by a manual script (`scripts/parity-vs-coinglass.ts`).
- `scripts/` mixes durable infrastructure (daemon, rounds) with one-off scratch analysis scripts (184 files, no convention).
- Two READMEs of truth: `README.md` still describes the older 12-asset scope; `AGENTS.md` describes the current 61-asset universe.
- Desk state (`desk/state.json`, ~10k lines rewritten each round) and log (`desk/log.md`, ~4.9k lines) grow unboundedly.
- XAU/XAG have no Hyperliquid venue and no anonymous stopmap (BTC-only upstream) — data honesty is handled by hiding tabs, verify that's clean.
- No CI at all (no lint gate, no type-check gate, no build gate).

## 5. OUTPUT FORMAT WE WANT

Produce, in this order:

1. **Top 10 improvements ranked by (impact × effort⁻¹)** — one paragraph each, with the specific files/functions to touch.
2. **Architecture verdict** — keep / refactor / rewrite per subsystem (signal engine, tier ladder, route layer, persistence, MCP, desk protocol), with one-line justifications.
3. **Correctness risks** — anything you believe is actually WRONG today (bugs, bias, double-counting, races), each with reproduction reasoning and a proposed fix.
4. **Testing & CI plan** — the minimal suite + pipeline that fits a single-developer, single-machine project. Be realistic about maintenance cost.
5. **What you would NOT change** — and why (so we don't churn what works).

Constraints to respect in your recommendations: single-machine local deployment (no cloud, no k8s), zero-mock data policy (every number must remain traceable to a live upstream), TypeScript/Next.js stays, and the 15-minute desk cadence is a hard requirement. Disagree with our choices where warranted — including the 61-asset curated universe or the file-based desk transport — but justify with trade-offs, not taste.

---8<--- (cut here) ---
