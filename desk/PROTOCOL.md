# TRADE DESK PROTOCOL — the operating contract between two agents

This desk coordinates the **analysis brain** (Z.ai sandbox agent, "zai-desk")
and the **execution brain** (local Antigravity agent + MT5, "atg-exec").
GitHub `main` is the only transport. Read this file before your first action,
then read `desk/state.json` and the tail of `desk/log.md`.

## Roles

| | zai-desk (sandbox) | atg-exec (local Antigravity) |
| --- | --- | --- |
| Cadence | **3 scheduled wakes/day** (01:00 · 09:00 · 17:00 IST — platform cron limit) + a round on every user message | **runs the 15-min round continuously** (always-on machine next to MT5) |
| Does | market analysis, opportunity confluence, order suggestions, running-trade reviews, order lifecycle (expire/withdraw), user reporting & interpretation | runs `scripts/desk_round.sh` every 15 min, punches MT5 orders, reports positions/fills, closes trades, appends execution entries |
| Never does | places trades, edits `positions[]` or order execution fields | edits `analysis`, invents levels, overrides suggested stops without logging why |

### Cadence architecture (why it is split)

The sandbox platform caps scheduled agent turns at 3/day, so the
**continuous 15-minute cadence is driven locally** by atg-exec — the round
script (`scripts/desk_round.sh` + `desk_round.py`) is deterministic and
self-sufficient: it is zai's confluence brain codified (recency-weighted
notification bias, footprint signals, h4/d1 EMA trend, VWAP regime, RSI
modifier, order lifecycle, position verdicts). zai-desk adds the
interpretation layer on top at each wake + whenever the user messages.

**The local daemon is the recommended scheduler** — see the next section.
Plain-cron alternative (rounds only, no inbox/MT5/wake):

```bash
# Linux/macOS cron — every 15 min at :05/:20/:35/:50
5,20,35,50 * * * * cd /path/to/cg-terminal && bash scripts/desk_round.sh >> desk/rounds.local.log 2>&1
```

## The local daemon — `scripts/desk_daemon.mjs`

One always-on process on the atg machine does everything:

```bash
node scripts/desk_daemon.mjs          # daemon, forever (Git Bash on Windows)
node scripts/desk_daemon.mjs --once   # single cycle (testing)
```

Each cycle (default 45 s — `desk/daemon.json`):
1. auto-commit dirty `desk/` files → `git fetch` → `pull --rebase` when behind
2. run `scripts/desk_round.sh` when a round is due (default every 15 min;
   rounds run by EITHER machine count, via `analysis.last_round_ts`)
3. process new `desk/inbox/*.json` instructions → `desk/outbox/`
4. new suggested orders / agent tasks → append `desk/inbox/WAKE.md`
   (wake beacon) + desktop notification + optional `wake_cmd`
5. refresh `desk/mt5.json` — account, positions, running PnL, spread per
   mapped symbol (Windows + MT5 terminal running + `pip install
   MetaTrader5`; failures are reported in the file, never guessed)
6. commit + push all `desk/` changes

`desk/daemon.json` is atg/human-owned runtime config (poll interval,
terminal boot command, MT5 python command, wake/notify commands). Local
files `desk/.daemon.lock`, `desk/.daemon-state.json`,
`desk/rounds.local.log` are gitignored.

## Instruction channel — git as the message bus

zai-desk remote-controls the local machine by pushing one JSON file per
instruction into `desk/inbox/`; the daemon replies in `desk/outbox/` with
the same filename. **Fixed action vocabulary — the daemon never runs
arbitrary shell from the repo.**

| action | effect | reply contains |
| --- | --- | --- |
| `PING` | liveness check | host, uptime, last round ts |
| `MT5_SNAPSHOT` | force a fresh `desk/mt5.json` | ok / error |
| `ROUND_NOW` | force an analysis round immediately | round id |
| `REPORT` | MT5 refresh + compact desk report | orders, positions, PnL, equity |
| `AGENT_TASK` | queue text for the local agent (WAKE.md + notify + `wake_cmd`) | dispatched |

Instruction file shape:
`{"id":"...","ts":<ms>,"from":"zai-desk","action":"...","priority":"info|high","instruction":"text (AGENT_TASK)"}`

**Waking the agent**: `desk/inbox/WAKE.md` is the beacon — the daemon
appends tasks (new suggested orders, zai agent tasks), the local agent
handles them on activation (place MT5 orders, update state, EXEC log
entries) and clears the handled sections. If your Antigravity install
exposes a CLI/URL trigger for agents, set it as `wake_cmd` in
`desk/daemon.json` (`{msg}` is replaced with the task text) for a hard
wake; beacon + desktop notification is the baseline otherwise.

## Files (field ownership)

- `desk/state.json` — machine-readable single source of truth.
  - `config` — owned by the **human** (risk limits, symbol map). Agents may
    read, never write. Change requests go into `desk/log.md` as a `CONFIG?`
    entry for the user to apply.
  - `analysis` — written only by zai-desk (replaced wholesale each round).
  - `orders[]` — zai-desk appends with `status:"suggested"` and may update
    `status` to `expired`/`withdrawn`. atg-exec updates `status` →
    `placed`/`filled`/`cancelled` and fills `ticket`, `actualEntry`,
    `filledTs`, `notes`.
  - `positions[]` — written only by atg-exec (mirrors MT5 open positions).
  - `closed[]` — either agent appends a final record (atg-exec for MT5
    closes; zai-desk only moves orders there, never positions).
- `desk/log.md` — append-only journal. One entry per round (`## R<n>`) and
  one entry per execution action. Never edit or delete older entries.

## Order lifecycle

```
suggested ──(atg places in MT5)──► placed ──(fill)──► filled ──(close)──► closed
    │                                │                   │
    ├──(expiry ts passed)─────────► expired              ├──(SL/TP hit → atg)──► closed
    └──(confluence invalidated)───► withdrawn            └──(zai review: CLOSE rec)
```

- zai-desk creates an order only when: |confluence score| ≥ 3.0 AND ≥2 of 3
  alignment checks pass (signal direction, h4/d1 EMA trend, VWAP regime)
  AND the R multiple to T1 ≥ `config.min_r_multiple`.
- Orders carry `expiresTs` (`config.order_expiry_hours` after creation). An
  unfilled, still-valid order survives rounds; an invalidated one is
  withdrawn with a reason in `log.md`.
- atg-exec should treat `suggested` orders as **proposals**: it may skip any
  (spread, session, news), but must log why in `log.md`.

## Levels are data-driven (institutional playbook — from AGENTS.md)

- **Entry**: limit at the pullback magnet — day VWAP −1σ (long) / +1σ
  (short), or the session/day POC nearest price. If price is already in
  the zone, the entry is the zone itself.
- **Stop**: beyond structural invalidation — VWAP −2σ (long) / +2σ (short),
  or the other side of the referenced POC zone.
- **Targets**: T1 day VAH/VAL · T2 month POC · T3 nearest same-direction
  liquidation cluster (sweep magnet — Coinglass estimate). Take profit INTO
  clusters, never hold through them.
- Every level in every order cites its source in `rationale`.

## Running-trade review (every zai round)

For each `positions[]` entry, zai computes and logs one verdict:
`HOLD` · `MOVE_STOP_TO_BREAKEVEN` (≥ +1.0R open) · `TIGHTEN_STOP` (≥ +1.5R) ·
`TAKE_PARTIAL` (within 0.3×stop-distance of T1) · `CLOSE_RECOMMENDED`
(VWAP regime flipped against the position AND confluence sign reversed) ·
`CHECK_MT5` (price beyond stop — MT5 should already have closed it).

atg-exec applies (or rejects, with reason in `log.md`). zai never simulates
a close.

## MT5 execution notes (atg-exec)

- Symbol mapping in `config.symbol_map` (BTC→BTCUSD … XAU→XAUUSD). Adjust to
  your broker's suffixes (BTCUSD.a etc.) — config is yours.
- Terminal prices are **perp** (USDT-M) prices; MT5 retail symbols may be
  spot or CFD. Small basis is normal; if basis > 0.5% flag it in `log.md`.
- Sizing is atg-exec's responsibility: `config.max_risk_per_trade_pct` of
  account equity per trade, `config.max_concurrent_positions` cap. zai
  suggests levels only, never lot sizes.

## Git discipline (avoid conflicts)

1. `git pull --rebase origin main` IMMEDIATELY before every edit.
2. Keep the edit window short; commit + push immediately after.
3. zai commits at quarter hours; atg polls/commits offset (≥4 min away).
4. If a rebase conflict on `state.json` ever happens: `git rebase --abort`,
    re-pull, re-apply your change on the fresh file. NEVER force-push.
5. Commit message prefixes: `desk(round):` (zai) · `desk(exec):` (atg).

## Data honesty (non-negotiable)

- Every number quoted must come from a tool/API response in that session.
- Liquidation clusters and whale walls are Coinglass **estimates** — orders
  must say so in `rationale` when they anchor a level to one.
- XAU/XAG: no Hyperliquid venue, no stopmap. If an endpoint errors, report
  the limitation — never guess a level.
- If two data sources disagree, prefer the more recent `updatedAt` and say so.

## Failure handling

- Terminal down on a zai round → the round script boots it (`desk_round.sh`)
  and retries; if still down after 3 min, the round is skipped and logged
  as `ROUND FAILED` in `log.md`. Two consecutive failures → tell the user.
- GitHub push fails → rebase-retry once; then log and continue (analysis
  output is still in `log.md` locally; it syncs on the next successful push).
- If the GitHub token is rotated, both sides must update their remote URL.
