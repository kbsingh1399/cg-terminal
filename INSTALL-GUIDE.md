# CG Order-Flow Terminal — Local Install Guide (Antigravity Edition)

An institution-style, **100% live-API** order-flow terminal for 12 assets
(BTC · ETH · SOL · BNB · XRP · ADA · AVAX · DOGE · LINK · LTC · **XAU gold** ·
**XAG silver**) with a local continuity engine, live notification feed, and a
bundled **MCP server that plugs straight into Antigravity** for automated
signal analysis and trade formulation.

No API keys required — the terminal speaks the Coinglass web API directly
(same endpoints the coinglass.com website uses in your browser).

---

## 1. What you get

| Tab | Content |
| --- | --- |
| **Overview** | live price, auction **VAL/POC/VAH** (session 8h · UTC day · UTC month), **EMA 13/89/233** + **RSI(14)** on 15m/1H/4H/1D, **day VWAP ±1σ/2σ/3σ** (anchored at the UTC day open — identical for IST or UTC viewers) |
| **Footprint** | Coinglass-exact signal engine on all three bar types (15m time · auto volume · auto range): Absorption, Divergence, Strong Divergence, Trap, Exhaustion |
| **Large Orders** | whale resting orders ("Open orders") across all supported exchanges, perp + spot, All / Perp / Spot / Invert |
| **Liq Levels + Stops** | 3D/7D/30D liquidation clusters, ±4%, Binance+OKX+Bybit+Hyperliquid, plus the liquidation-heatmap stops map |
| **Book Walls** | aggregate order-book depth, bid/ask walls, imbalance, wall events (ask/bid-wall info like the Liquidity Heatmap page) |
| **CVD** | perp/spot/total CVD, taker-buy share, divergence list |
| **Alerts** | **live notification feed** (SSE) — every signal, whale wall, cluster approach, VWAP/RSI/auction event from every tab |

Under the hood:

- **Continuity engine** — on every boot it backfills anything missed while
  the PC was off (klines, flows, stopmap windows, book walls, liq levels)
  so the data is continuous, then keeps polling live.
- **1-second price ticker** — the header price on every tab ticks every
  second (forming m1 candle close, shared ~3 s upstream cache).
- **Notification scanner** — computes signals + indicator events + whale
  walls + sweep setups + CVD divergences server-side and pushes them to the
  Alerts tab, `GET /api/cg/notifications`, and the SSE stream
  `GET /api/cg/stream`.
- **MCP server** (`mcp/server.mjs`) — 10 tools incl. `analyze_setup` for
  one-call trade formulation.

## 2. Prerequisites

- **Node.js 20+** (LTS 22 recommended) — https://nodejs.org
- ~500 MB free disk (node_modules + local data store)
- Internet access to `capi.coinglass.com` / `fapi.coinglass.com`

Check: `node -v` should print v20 or higher.

## 3. Install (any OS)

```bash
# 1) unzip the package and open a terminal INSIDE the folder
cd cg-terminal

# 2) install dependencies (2-4 min)
npm install

# 3) create your env (defaults are fine)
cp .env.example .env        # Windows: copy .env.example .env

# 4) run it
npm run dev
```

Open **http://localhost:3000** — first boot backfills ~3 days of history per
asset (2-5 minutes; watch the engine chip in the header: `engine live ·
26 series · 0 gaps`), then everything updates live.

For a long-running setup use production mode (faster, quieter):

```bash
npm run build
npm start
```

## 4. How live is it? (refresh cadence)

| Data | Refreshes | Fresh to within |
| --- | --- | --- |
| **Price — header ticker + Overview big price, every tab** | **every 1 s** (shared ~3 s upstream fetch, `/api/cg/ticker`) | ≤ 4 s |
| Alerts / notification feed | **pushed the moment detected** (SSE — no polling) | seconds |
| Overview auction · EMA · RSI · VWAP | 30 s | ~1 min |
| Footprint signals & bar charts | 30–45 s | ~1 min |
| Whale open orders table | 45 s | ~1–2 min |
| Liquidation levels / stops map / book walls / CVD | 45–120 s | ~2 min |

The 1-second ticker reads the forming m1 candle close from Coinglass —
the same live number their charts show — served from one shared cache so
any number of tabs/agents stay gentle on upstream. Tune it with
`CG_TICKER_TTL_MS` in `.env` (default 3000 ms).

## 5. Plug it into Antigravity

1. Start the terminal first (`npm run dev` or `npm start`).
2. In Antigravity open **Settings → MCP → Add custom server** and register:

   ```json
   {
     "mcpServers": {
       "cg-terminal": {
         "command": "node",
         "args": ["/ABSOLUTE/PATH/TO/cg-terminal/mcp/server.mjs"],
         "env": { "TERMINAL_URL": "http://localhost:3000" }
       }
     }
   }
   ```

   (On Windows the path looks like `C:\\cg-terminal\\mcp\\server.mjs`.)
3. Copy `AGENTS.md` (already in the project root) into your workspace root if
   your workspace is a different folder — Antigravity reads it automatically.
4. Test it: ask the agent *"check the terminal feed"* — it should call
   `notifications`, report new events, and for anything `[HIGH]` run
   `analyze_setup` and return a trade card.

### Auto-wake

The agent acts whenever you open Antigravity / start a task — the wake-up
protocol lives in `AGENTS.md` (poll cursor → analyze HIGH events → formulate).
To make it fully hands-off, add an Antigravity **scheduled agent task**
(Agent Manager → schedule / cron) such as:

> "Every 15 minutes: run the CG wake-up protocol from AGENTS.md."

The MCP `notifications` tool keeps its own cursor (`data/mcp-cursor.json`), so
each run only sees genuinely new events.

## 6. Data continuity — how boot resume works

```
data/cg-series/            ← append-only JSONL stores (keep this folder!)
  kline:Binance_BTCUSDT:m15.jsonl      3-day m15 candles per asset
  bs_usd:<venue>:m15.jsonl             per-venue taker flows (CVD)
  stopmap.jsonl                        liquidation-heatmap windows
  bookwalls.jsonl                      depth snapshots
  lto:open.jsonl                       whale open orders (point-in-time)
  liqlevels:3d.jsonl                   liquidation-level models
  notifications.jsonl                  the event feed
```

- **Shutdown → boot**: every series resumes from its last stored timestamp;
  the engine pages upstream history (`endTime` pagination) to close the gap.
  After a weekend off you boot into a fully continuous dataset.
- Point-in-time series (whale open orders) have no upstream history — gaps
  during downtime are marked, not fabricated.
- Increase history depth with `CG_ENGINE_BACKFILL_DAYS=30` in `.env`.
- Back up / migrate your PC? Just copy the `data/` folder.

## 7. Architecture (everything is pluggable)

```
Coinglass web API (capi/fapi, encrypted handshake — no keys)
        │
src/lib/cg/client.ts + crypto.ts        one shared cached client
        │
 ┌──────┴─────────────────────────────────────────────┐
 │ engine.ts        boot backfill + pollers (per asset)│
 │ scan.ts          signal/indicator/whale/liq/cvd     │
 │                 scanner → notify.ts (SSE + JSONL)   │
 │ fp-load.ts       footprint bars (exact page port)   │
 │ market.ts        auction/EMA/RSI/VWAP snapshots     │
 │ cg-signals.ts    Coinglass signal engine (1:1 port) │
 └──────┬─────────────────────────────────────────────┘
        │
src/app/api/cg/*      REST: ticker, market, signals, notifications, stream,
                      fp, lto, largeorder, liqlevels, stopmap,
                      bookwalls, cvd, kline, orderflow, engine, assets
        │                          │
  UI (localhost:3000)      mcp/server.mjs (Antigravity)
```

Adding an asset = one line in `src/lib/cg/assets.ts` (venue instruments are
derived from the table). Adding a feed = one poller in `engine.ts` + one
scanner in `scan.ts`.

## 8. Troubleshooting

| Symptom | Fix |
| --- | --- |
| `EADDRINUSE :3000` | another app holds the port: `npm run dev -- -p 3100` and set `TERMINAL_URL=http://localhost:3100` for MCP |
| market/footprint tab empty for >2 min | Coinglass rate-limits anonymous bursts — reload; the engine retries automatically |
| stopmap error `code 40000` | that heatmap window needs a Coinglass login upstream (anonymous = 24h view). XAU/XAG stopmap is login-only |
| `node: command not found` | install Node 20+ and reopen the terminal |
| MCP tool says `fetch failed` | the terminal isn't running — start it first (`npm run dev`) |
| Windows PowerShell `cp` error | use `copy .env.example .env` |

## 9. Honest data notes

- Every displayed number comes from the Coinglass API or is computed from it
  (EMA/RSI/VWAP/auction from live klines; signals from live order-flow).
- Liquidation levels, whale orders and the stops map are Coinglass **model
  estimates** (they reconstruct positions from public data) — treat them as
  high-quality estimates, not exchange ground truth.
- XAU/XAG trade as USDT-margined perps on Binance/OKX/Bybit; no Hyperliquid
  venue, no anonymous stops map for metals.
- Nothing here is investment advice.

## 10. Long-term production stability

- **Windows/NTFS safe continuity stores**: Series filenames with colons are safely flattened to `_` in `src/lib/cg/store.ts` (`migrateLegacy()` auto-migrates existing data stores on first load).
- **Bounded storage growth**: In-memory rows and JSONL files are capped at `CG_STORE_MAX_ROWS=60000` (default) with automatic file compaction when 20% over cap.
- **Bounded upstream cache**: Upstream response cache in `src/lib/cg/client.ts` uses insertion-order eviction past `CG_CLIENT_CACHE_MAX=800` entries.
- **Secure local proxy**: Caddyfile binds strictly to `localhost:81` to prevent unauthenticated network exposure.
- **Strict type checking**: `next.config.ts` enforces `ignoreBuildErrors: false`, excluding non-app directories in `tsconfig.json`.
