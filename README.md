# CG Order-Flow Terminal

An institution-style, **100% live-API** order-flow terminal for 12 assets
(BTC · ETH · SOL · BNB · XRP · ADA · AVAX · DOGE · LINK · LTC · **XAU gold** ·
**XAG silver**) with a local continuity engine, live notification feed, and a
bundled **MCP server that plugs straight into Antigravity** for automated
signal analysis and trade formulation.

No API keys required — the terminal speaks the Coinglass web API directly
(same endpoints the coinglass.com website uses in your browser), plus a
**real-time Binance futures WebSocket layer** for the numbers that must
never lag: prices are the exchange tape itself (sub-100 ms, last trade +
best bid/ask), the footprint forming bar accumulates trade-by-trade, and
the order book heatmap carries a live Binance depth column — all merged
on top of the multi-venue Coinglass aggregates without double counting.
Every price badge names its active tier (`real-time` WS · `0.25s` REST ·
`3s` Coinglass), and a shared circuit breaker keeps Binance weight limits
respected under all conditions.

---

## 1. What you get

| Tab | Content |
| --- | --- |
| **Overview** | live price, auction **VAL/POC/VAH** (session 8h · UTC day · UTC month), **EMA 13/89/233** + **RSI(14)** on 15m/1H/4H/1D, **day VWAP ±1σ/2σ/3σ** (anchored at the UTC day open — identical for IST or UTC viewers) |
| **Footprint** | Coinglass-exact signal engine on all three bar types (15m time · auto volume · auto range): Absorption, Divergence, Strong Divergence, Trap, Exhaustion |
| **Large Orders** | whale resting orders ("Open orders") across all supported exchanges, perp + spot, All / Perp / Spot / Invert |
| **Liq Levels + Stops** | 3D/7D/30D liquidation clusters, ±4%, per-asset venue set (metals: Binance+OKX+Bybit), plus the liquidation-heatmap stops map (BTC-only, see §8) |
| **Book Walls** | aggregate order-book depth, bid/ask walls, imbalance, wall events — per-asset aggregate venues (BTC/ETH 5-venue, alts Binance+Hyperliquid, metals Binance) |
| **CVD** | perp/spot/total CVD, taker-buy share, divergence list |
| **Alerts** | **live notification feed** (SSE) — every signal, whale wall, cluster approach, VWAP/RSI/auction event from every tab |

Under the hood:

- **Continuity engine** — on every boot it backfills anything missed while
  the PC was off so the data is continuous, then keeps polling live
  (per-asset m15 klines + the full series set for BTC, see §5).
- **Notification scanner** — computes signals + indicator events + whale
  walls + sweep setups + CVD divergences server-side and pushes them to the
  Alerts tab, `GET /api/cg/notifications`, and the SSE stream
  `GET /api/cg/stream`. For a real-time price in any analysis, poll
  `GET /api/cg/ticker?sym=BTC` (1 s-safe, shared upstream cache).
- **MCP server** (`mcp/server.mjs`) — 10 tools incl. `analyze_setup` for
  one-call trade formulation.

## 2. Prerequisites

- **Node.js 20+** (LTS 22 recommended) — https://nodejs.org
- ~500 MB free disk (node_modules + local data store)
- Internet access to `capi.coinglass.com` / `fapi.coinglass.com`

Check: `node -v` should print v20 or higher.

## 3. Install (any OS)

```bash
# 1) clone / unzip the package and open a terminal INSIDE the folder
cd cg-terminal

# 2) install dependencies (2-4 min)
npm install

# 3) create your env (defaults are fine)
cp .env.example .env        # Windows: copy .env.example .env

# 4) run it
npm run dev
```

Open **http://localhost:3000** — first boot backfills ~3 days of m15 klines
**for every asset** plus the full continuity set (order-flow, stopmap, book
walls, liq levels, whale orders) **for BTC** (2-5 minutes; watch the engine
chip in the header: `engine live · 26 series · 0 gaps`), then everything
updates live.

For a long-running setup use production mode (faster, quieter):

```bash
npm run build
npm start
```

`npm start` binds **127.0.0.1 (loopback only)** by default — the terminal
serves its routes unauthenticated, so that is the safe default. To expose it
on your LAN deliberately: `HOSTNAME=0.0.0.0 npm start` (know what you are
doing — there is no auth). The build itself is fully offline-capable (fonts
are self-hosted; only `npm install` needs the network).

## 4. Plug it into Antigravity

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

## 5. Data continuity — how boot resume works

```
data/cg-series/                        ← append-only JSONL stores (keep this folder!)
  kline_Binance_BTCUSDT_m15.jsonl      m15 candles — ONE FILE PER ASSET (12 files)
  bs_usd_<venue>_m15.jsonl             per-venue taker flows (CVD, BTC venues)
  stopmap.jsonl                        liquidation-heatmap windows (BTC)
  bookwalls.jsonl                      depth snapshots (BTC aggregate)
  lto_open.jsonl                       whale open orders (BTC, point-in-time)
  liqlevels_3d.jsonl                   liquidation-level models (BTC venues)
  notifications.jsonl                  the event feed (all assets)
```

Series scope, honestly: **per-asset** history = m15 klines (all 12 assets,
backfilled on boot). The deeper series (taker flows, stopmap, book walls,
whale orders, liq levels) are persisted **for BTC** — the lead asset the
engine archives continuously. The live API serves every asset on every tab
regardless; only the boot-resume archive is BTC-scoped beyond klines.

- **Shutdown → boot**: every series resumes from its last stored timestamp;
  the engine pages upstream history (`endTime` pagination) to close the gap.
  After a weekend off you boot into a fully continuous dataset.
- Point-in-time series (whale open orders) have no upstream history — gaps
  during downtime are marked, not fabricated.
- `notifications.jsonl` grows unbounded by design (the in-memory feed caps at
  the last 2000 events) — it reaches a few tens of MB per year; archive or
  delete it freely, boot re-seeds from the newest rows.
- Increase kline history depth with `CG_ENGINE_BACKFILL_DAYS=30` in `.env`.
- Back up / migrate your PC? Just copy the `data/` folder.
- Every continuity file is capped per-series (`CG_STORE_MAX_ROWS`, default
  60 000 rows) and compacts atomically (temp file + rename) — a crash can
  never corrupt stored history.

## 6. Architecture (everything is pluggable)

```
Coinglass web API (capi/fapi, encrypted handshake — no keys)
        │
src/lib/cg/client.ts + crypto.ts        one shared cached client
        │
 ┌──────┴─────────────────────────────────────────────┐
 │ engine.ts        boot backfill + pollers           │
 │ scan.ts          signal/indicator/whale/liq/cvd    │
 │                 scanner → notify.ts (SSE + JSONL)  │
 │ fp-load.ts       footprint bars (exact page port)  │
 │ market.ts        auction/EMA/RSI/VWAP snapshots    │
 │ cg-signals.ts    Coinglass signal engine (1:1 port)│
 │ assets.ts        the single asset/venue registry   │
 └──────┬─────────────────────────────────────────────┘
        │
src/app/api/cg/*      REST: ticker (1s price), market, signals,
                      notifications, stream, fp, lto, largeorder,
                      liqlevels, stopmap, bookwalls, cvd, kline,
                      orderflow, engine, assets
        │                          │
  UI (localhost:3000)      mcp/server.mjs (Antigravity)
```

Adding an asset = one line in `src/lib/cg/assets.ts` — the tab bar, every
tool, the route venue sets and the per-asset thresholds all derive from that
single registry. Adding a feed = one poller in `engine.ts` + one scanner in
`scan.ts`.

## 7. Security & troubleshooting

Local trust model, layered:

- `npm start` binds **127.0.0.1** by default (`HOSTNAME` to override).
- A Next.js middleware rejects **cross-site/cross-origin calls** to mutating
  API routes, so a random web page cannot fire `POST /api/cg/engine/backfill`
  from your browser (that route also has a 30 s cooldown + single-flight).
- All API params are validated (asset allowlist / shape checks / clamped
  ranges) and every module-level cache is size-bounded.
- The optional `Caddyfile` reverse proxy (`localhost:81`) is another layer,
  not a substitute — see the comments inside it.

| Symptom | Fix |
| --- | --- |
| `EADDRINUSE :3000` | another app holds the port: `npm run dev -- -p 3100` and set `TERMINAL_URL=http://localhost:3100` for MCP |
| market/footprint tab empty for >2 min | Coinglass rate-limits anonymous bursts — reload; the engine retries automatically (429s back off via Retry-After) |
| stopmap error `code 40000` | that heatmap window needs a Coinglass login upstream (anonymous = 24h view). XAU/XAG stopmap is login-only |
| `node: command not found` | install Node 20+ and reopen the terminal |
| MCP tool says `fetch failed` | the terminal isn't running — start it first (`npm run dev`) |
| Windows PowerShell `cp` error | use `copy .env.example .env` |
| want LAN access | `HOSTNAME=0.0.0.0 npm start` — unauthenticated, LAN-only, know your network |

## 8. Honest data notes

- Every displayed number comes from the Coinglass API or is computed from it
  (EMA/RSI/VWAP/auction from live klines; signals from live order-flow).
- Liquidation levels, whale orders and the stops map are Coinglass **model
  estimates** (they reconstruct positions from public data) — treat them as
  high-quality estimates, not exchange ground truth.
- XAU/XAG trade as USDT-margined perps on Binance/OKX/Bybit; no Hyperliquid
  venue, no anonymous stops map for metals.
- **This is an unofficial, personal-use client.** It replicates the
  logged-out browser handshake against Coinglass's web API: no SLA, no
  guaranteed rate budget, and the scheme can change on their side at any
  time (the terminal degrades gracefully to stale/cached data). Treat it as
  a local analytics tool, not a redistributable data feed, and respect
  Coinglass's terms of service for anything beyond personal use.
- Nothing here is investment advice.
