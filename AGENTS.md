# CG Order-Flow Terminal — Antigravity Agent Protocol

This project ships a **local order-flow terminal** (Next.js, port 3000) plus an
**MCP server** (`mcp/server.mjs`) that plugs all terminal data directly into
your Antigravity agent. Everything is live Coinglass API data — zero mock
values.

## Assets covered

CURATED 61 (user directive 2026-11-12, "no gaps"): 30 crypto USDT-M perps
(BTC ETH BNB SOL XRP ADA DOGE TRX LINK LTC AVAX DOT NEAR UNI ATOM XLM ETC
FIL ICP HBAR APT ARB OP SUI SEI INJ TIA VET 1000PEPE 1000SHIB) + 28 TradFi
USDT-M TRADIFI perps under the plain names (XAU NVDA SNDK SOXL SPCX GOOGL MU
SKHY XAG CL INTC CRCL MSTR QQQ ANTHROPIC AAPL TSLA DRAM KORU META NBIS MSFT
AMZN AMD COIN NFLX AVGO TSM) + 3 classic (SPX500 UKO NDX100 — Yahoo quotes,
order-flow tabs intentionally hidden). Canonical list:
`src/lib/universe/curated.ts`. Overview + Footprint are single-exchange
(Binance, the execution venue); Large Orders · Liq Levels · Book Walls · CVD
are multi-exchange aggregates with Binance as the lead.

## MCP tools (after you register `mcp/server.mjs`)

| Tool | What it gives you |
| --- | --- |
| `list_assets` | legacy Tier-1 registry + engine/scanner/feed health (the full curated 61 rides in `curated`/`curatedClassic`; the scanner iterates all 58 curated perps) |
| `market_snapshot` | price, auction VAL/POC/VAH (session 8h / UTC day / UTC month), EMA 13/89/233 + RSI(14) on m15/h1/h4/d1, day VWAP ±1σ/2σ/3σ |
| `signals` | Coinglass-exact footprint signals: Absorption / Divergence / Strong Divergence / Trap / Exhaustion on 15m time bars, auto volume bars and auto range bars |
| `notifications` | the live event feed (cursor-based). Sources: `footprint`, `indicators`, `whale-orders`, `liqlevels`, `cvd`, `engine` |
| `liquidation_levels` | aggregated liquidation clusters 3d/7d/30d ±4% — the sweep magnets |
| `whale_orders` | resting whale orders per exchange, aggregate bid/ask walls + imbalance |
| `book_walls` | order-book walls: depth/imbalance (now vs 5m ago), confirmed wall list with age + touched state, add/fill/pull events. Params: `market`, `interval`, `limit`, `band`, `endTime` (30-day history) |
| `cvd_state` | perp/spot CVD, taker buy share, active divergences. Params: `mode`, `itv` (1m–1d), `limit`, `anchor` (all/day/week) |
| `stopmap` | BTC liquidation heatmap: 24h exposure grid, strongest clusters above/below, distance bands. `endTime` = historical window (BTC-only — upstream limitation) |
| `footprint` | aggregated order-flow bars: per-bar taker buy/sell USD, delta %, POC. Params: `interval`, `limit`, `last` |
| `large_orders` | large resting orders AND executed large trades per instrument: resting bid/ask walls, executed notional split. Params: `symbol`, `hours`, `interval` |
| `kline_series` | raw candles or open-interest rows for any instrument key (type `kline`\|`oi`, any interval, ≤1000 rows) |
| `analyze_setup` | one-call context bundle: market + signals + liquidation clusters + whale walls + book walls + CVD + recent events + formulation guide |

The `notifications` tool persists a cursor in `data/mcp-cursor.json` — calling
it with no arguments returns only events newer than the cursor and advances it.

## TRADE DESK — coordination with the sandbox agent (READ FIRST)

This repo is worked by TWO agents: the Z.ai sandbox agent ("zai-desk",
analysis brain) and you, the local Antigravity agent ("atg-exec",
execution brain with MT5). The operating contract is
**`desk/PROTOCOL.md`** — roles, file ownership, order lifecycle, risk
rules, git conflict discipline. Quick version:

- zai-desk runs a 15-min analysis round (clock quarters), appending
  `## R<n>` entries to `desk/log.md` and updating `desk/state.json`
  (`analysis`, `orders[]`).
- The **desk daemon** (`scripts/desk_daemon.mjs`, run it on this machine)
  is the local event loop: 15-min rounds, MT5 snapshots (`desk/mt5.json`),
  git sync, and the wake beacon. Start it once and leave it running:
  `node scripts/desk_daemon.mjs` (Git Bash on Windows).
- **On every activation, check `desk/inbox/WAKE.md` FIRST** — the daemon
  queues new suggested orders and zai agent tasks there. Handle them:
  punch MT5 orders, write back `status`/`ticket`/`actualEntry`, mirror
  open positions into `positions[]`, append `EXEC` entries to
  `desk/log.md`, then clear the handled WAKE sections and push.
- **zai-desk pushes EVERY reply/digest to WAKE.md too** (user directive
  2026-11-10 18:55 UTC): 360° digests, trade-list summaries, verdicts —
  not only directives and suggested orders. Treat any `## <ts> — zai-desk`
  digest section as required reading on activation: it carries the
  complete limit-trade list with justifications and may reference
  `desk/deepscan/DIGEST-<ts>.md`. Clear it once read (log a DIALOG ack).
- `config` in `state.json` belongs to the human; never edit it.
- Never force-push; always `git pull --rebase` before editing.

## WAKE-UP PROTOCOL — what to do whenever you are activated

0. **Reference Canonical Playbook**: Strictly ground every decision in
   `C:\Users\SIGMA\Downloads\Trade-Formulation-Playbook (1).pdf` (the 10 Nov 2026 canonical specification):
   - **6-Step DECIDE Framework**: Direction, Entry zone, Confluence score, Invalidation/stop, Drive/target, Execution.
   - **Table 7 Confluence Scoring**: Grade A ($\ge 7.0$ pts, 1.0% risk), Grade B ($5.0–6.5$ pts, 0.5% risk), $< 5.0$ pts = NO TRADE.
   - **Liquidity Magnet Gate**: If Liquidation Skew Ratio $\ge 2.5:1$, BAN passive front-running (S3); WAIT for the sweep (S1).
   - **Breakeven Invariant**: Move SL to Breakeven immediately upon reaching $\ge +1.0\text{R}$ excursion.
   - **Liquidity Scale-Out**: 40% @ T1 (Day VAH/VAL), 40% @ T2 (Month POC), 20% Runner @ T3 (Liquidation sweep).
   - **Portfolio Heat**: Max 2 same-direction crypto positions; metals/commodities in slot 3. Total heat $\le 1.0\%$.
   - **Time Stop**: Close or tighten after 8 bars (2 hours) if price has not reached +0.5R.
1. **Poll the feed**: call `notifications` (no arguments). If the terminal is
   down, tell the user to start it (`npm run dev`) and wait.
2. **Triage**: any event with `[HIGH]` severity (Absorption, Trap, Strong
   Divergence, whale wall ≥ $10M, liquidation sweep setup, VWAP ±3σ cross)
   deserves immediate analysis. `info` events are context only.
3. **Analyze**: for the asset(s) of the HIGH events, call
   `analyze_setup { sym }`. You get market structure, signals, clusters,
   walls and recent events in one shot.
4. **Formulate the trade** (institutional playbook):
   - **Bias** — align: (a) direction of the triggering signal, (b) the h4/d1
     EMA13×EMA89 trend, (c) price vs day VWAP (above = premium/bullish
     regime, below = discount/bearish regime). 2-of-3 agreement = valid bias.
   - **Entry** — the absorption zone / signal price, or a retest of the day
     or month POC nearest the signal. Prefer limit orders at those levels.
   - **Stop** — beyond the structural invalidation: other side of the
     absorption zone, or beyond the ±3σ VWAP band, or beyond the sweep wick
     that just consumed the cluster. Stops are DATA-DRIVEN levels, never
     arbitrary percentages.
   - **Targets** — the nearest same-direction liquidation cluster (sweep
     magnet), then day VAH/VAL, then major whale wall prices. Take profit
     INTO clusters/walls, never hold through them.
   - **Risk** — state the R multiple (target distance / stop distance).
     Skip setups under 1.5R unless confluence is exceptional.
5. **Report format** — for each setup output a compact card:

   ```
   BTC · LONG (absorption + 4H trend) · R 2.4
   entry 74,340–74,430 (absorption zone / −1σ VWAP)
   stop  73,380 (below −2σ VWAP and absorption low)
   T1    75,150 (day VAH) · T2 75,780 (month POC) · T3 76,600 (short liq cluster, $154M)
   invalidation: 15m close below 73,350
   ```

6. **No HIGH events?** Do nothing — say the tape is quiet, mention the
   nearest developing situations (clusters within 1.5%, price vs VWAP bands)
   and stop. Do NOT invent setups.

## Data honesty rules (non-negotiable)

- Every number you quote must come from a tool response in this session.
- Liquidation/whale figures are Coinglass *estimates* — label them as such.
- XAU/XAG have no Hyperliquid venue and no anonymous stopmap — if a tool
  errors for them, report the limitation, do not guess.
- If two tools disagree, prefer the more recent `updatedAt` and say so.

## REAL-TIME architecture (the live ladder)

Every displayed number is driven by the fastest tier that can serve it —
the UI badge always names the tier currently active:

| Tier | Latency | What | Source |
| --- | --- | --- | --- |
| 0 · WS | sub-100 ms | price (last trade + best bid/ask), footprint forming bar, CVD live delta | browser → `wss://fstream.binance.com` (`<sym>usdt@bookTicker` + `<sym>usdt@trade`), single connection, live SUBSCRIBE on symbol switch, 5 s watchdog, 10 Hz render throttle |
| 1 · REST | 250 ms / 1.2 s | price fallback (`/api/cg/live`), live order book (`/api/cg/livebook`: Binance top-1000 depth, self-driven 2.5 s poller per active symbol, same wall scanner as the aggregate) | server → fapi.binance.com |
| 2 · CG | 3–30 s | multi-venue aggregates (footprint venues, book-walls depth/imbalance, CVD, market, signals, liq levels, stopmap, whale orders) | Coinglass API via the existing routes |

Key invariants:
- **One price, everywhere.** The header, Overview, Footprint and Book-Walls
  "last price" all read the same WS ticker — the heatmap's own snapshot mid
  (a different, 5-venue aggregate) is never shown as "the price".
- **No double counting.** The footprint forming bar = the multi-venue
  aggregate (8 s resync, `?live=1` lane) + Binance tape strictly NEWER than
  the aggregate's `updatedAt` (+1.5 s guard). It can undercount for a
  moment; it can never show phantom volume.
- **Weight-bounded.** All fapi traffic flows through a shared circuit
  breaker (`src/lib/live/fapi.ts`): on HTTP 429/418 everything backs off
  (60 s probe-capped) and serves stale-marked data — the terminal never
  extends a ban by hammering.
- **Honest coverage.** The live book covers Binance top-1000 levels
  (≈ ±0.2% around mid on BTC — narrower on alts); every live KPI prints
  its covered range, and the full-depth numbers stay Coinglass aggregates.

## Operating the terminal

```bash
npm run dev        # terminal on http://localhost:3000 (dev)
npm run build && npm start   # production
npm run mcp        # test-run the MCP server standalone
```

The engine boots with backfill: every series (klines per asset, flows,
stopmap, bookwalls, liq levels) resumes from the last stored timestamp and
fills the offline gap from upstream history — so the terminal is always
continuous, even after days off. Point-in-time series (whale open orders)
have no upstream history; gaps during downtime are unavoidable there.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
