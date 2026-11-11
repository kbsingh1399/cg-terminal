# Reply: DIR-0008 · Terminal Rebuild & Feed Verification (14 Assets)

**VERDICT**: EXECUTED
**TIMESTAMP**: 2026-11-10 20:32 UTC
**DIRECTIVE**: `desk/inbox/2026-11-10T20-30-00_DIR-0008-terminal-rebuild-and-feed-verify.json`

---

### CHECKS
- [x] **Git Pull**: Rebased cleanly onto `origin/main` (commit `7b458d5`).
- [x] **Config Check**: Verified `desk/state.json` `config.symbol_map` contains:
  * `DOGE`: `DOGUSD`
  * `LINK`: `LNKUSD`
  * `XLM`: `XLMUSD`
  * `XMR`: `XMRUSD`
- [x] **Terminal Rebuild**:
  * Freed port 3000 / `.next` file locks by stopping standalone server task.
  * Executed `npm run build` (Turbopack, compiled in 1158ms, all 24 API routes generated).
  * Restarted production standalone server on `http://127.0.0.1:3000`.
- [x] **Endpoint Check (`/api/cg/assets`)**: Returns all 14 assets (`BTC`, `ETH`, `SOL`, `BNB`, `XRP`, `ADA`, `AVAX`, `DOGE`, `LINK`, `LTC`, `XLM`, `XMR`, `XAU`, `XAG`).
- [x] **Endpoint Check (`/api/cg/market?sym=XLM`)**: Returns HTTP 200 with live price `0.14426`, day POC `0.142865`, VWAP `0.145018`, EMA stack, and RSI.
- [x] **MT5 Feed Verification (`desk/mt5.json`)**: Live broker quotes confirmed for all 4 mapped assets:
  * **`DOGUSD`**: `ok: True`, bid `0.0672`, ask `0.0681`, basis `+0.0888%`, spread `1.3304%`
  * **`LNKUSD`**: `ok: True`, bid `10.313`, ask `10.369`, basis `+0.1259%`, spread `0.5415%`
  * **`XLMUSD`**: `ok: True`, bid `0.14428`, ask `0.14448`, basis `+0.0554%`, spread `0.1385%` (**TRADEABLE** — passes $\le 0.15\%$ spread and $\le 0.50\%$ basis gates)
  * **`XMRUSD`**: `ok: True`, bid `558.50`, ask `559.82`, basis `+0.1352%`, spread `0.2361%`

---

### REASONING
The symbol mapping correctly aligns Coinglass perp feeds with FundedNext's MT5 symbol nomenclature, completely resolving the previous "feed dead" blocker for Dogecoin and Chainlink.
Rebuilding the Next.js standalone binary successfully injected the 14-asset registry into the local terminal, WebSocket manager, and continuity engine.
Crucially, **XLMUSD** is immediately tradeable: with basis `+0.055%` (well within $\pm0.5\%$) and spread `0.1385%` (below the $0.15\%$ threshold), it passes all broker gates.

---

### ACTION
1. Rebuilt and restarted production terminal on `http://127.0.0.1:3000` (PID active).
2. Appended `CONFIG-CHECK` and `EXEC` entries to `desk/log.md`.
3. Updated `desk/mt5.json` and `desk/outbox/AGENT-STATUS.md`.

---

### EVIDENCE

#### 1. Assets API (`/api/cg/assets`)
```json
{
  "ok": true,
  "assets": [
    {"sym": "BTC", "name": "Bitcoin", "kind": "crypto"},
    {"sym": "ETH", "name": "Ethereum", "kind": "crypto"},
    {"sym": "SOL", "name": "Solana", "kind": "crypto"},
    {"sym": "BNB", "name": "BNB", "kind": "crypto"},
    {"sym": "XRP", "name": "XRP", "kind": "crypto"},
    {"sym": "ADA", "name": "Cardano", "kind": "crypto"},
    {"sym": "AVAX", "name": "Avalanche", "kind": "crypto"},
    {"sym": "DOGE", "name": "Dogecoin", "kind": "crypto"},
    {"sym": "LINK", "name": "Chainlink", "kind": "crypto"},
    {"sym": "LTC", "name": "Litecoin", "kind": "crypto"},
    {"sym": "XLM", "name": "Stellar", "kind": "crypto", "tier": "slow", "hyperliquid": true},
    {"sym": "XMR", "name": "Monero", "kind": "crypto", "tier": "slow", "hyperliquid": true},
    {"sym": "XAU", "name": "Gold", "kind": "metal"},
    {"sym": "XAG", "name": "Silver", "kind": "metal"}
  ]
}
```

#### 2. XLM Market Endpoint (`/api/cg/market?sym=XLM`)
```json
{
  "ok": true,
  "sym": "XLM",
  "name": "Stellar",
  "kind": "crypto",
  "price": {
    "last": 0.14426,
    "prevDayClose": 0.14748,
    "chgDayPct": -2.1833,
    "dayHigh": 0.14969,
    "dayLow": 0.14069
  },
  "auction": {
    "day": {"poc": 0.142865, "vah": 0.147065, "val": 0.142115}
  },
  "vwap": {
    "vwap": 0.145018,
    "bands": {"sd1": 0.002119, "sd2": 0.004238, "sd3": 0.006357}
  }
}
```

#### 3. MT5 Spreads Check (`desk/mt5.json`)
```
DOGUSD: ok=True bid=0.06720 ask=0.06810 basisPct=+0.0888% spreadPct=1.3304%
LNKUSD: ok=True bid=10.3130 ask=10.3690 basisPct=+0.1259% spreadPct=0.5415%
XLMUSD: ok=True bid=0.14428 ask=0.14448 basisPct=+0.0554% spreadPct=0.1385% (TRADEABLE)
XMRUSD: ok=True bid=558.500 ask=559.820 basisPct=+0.1352% spreadPct=0.2361%
```
