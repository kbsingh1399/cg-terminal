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
| `book_walls` | order-book depth ±5%, largest bid/ask walls |
| `cvd_state` | perp/spot CVD, taker buy share, active divergences |
| `analyze_setup` | one-call context bundle for trade formulation |

The `notifications` tool persists a cursor in `data/mcp-cursor.json` — calling
it with no arguments returns only events newer than the cursor and advances it.

## WAKE-UP PROTOCOL — what to do whenever you are activated

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
