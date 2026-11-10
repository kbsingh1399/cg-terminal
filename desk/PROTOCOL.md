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

- zai-desk creates an order only when ALL gates pass (engine v2):
  1. |confluence score| ≥ 3.0 — components: recency-weighted notification
     bias, footprint signal counts, h4/d1 EMA trend, VWAP regime, RSI
     exhaustion, CVD (taker buy share + recent divergence)
  2. ≥2 of 3 alignment checks (signal direction, h4/d1 EMA trend, VWAP regime)
  3. R multiple to T1 ≥ `config.min_r_multiple` (**2.0 — user mandate:
     minimum 1:2, prefer more**); targets are structural magnets only
     (day VAH/VAL, month POC, liquidation clusters ≥40 strength)
  4. no opposite liquidation magnet (strength ≥50) within 1.2R of entry
  5. no opposing whale wall ≥ $5M within 1.5R into the profit path
  6. stop pushed beyond any liq magnet inside the risk zone, with the
     geometry staying ≤ 1.6× base risk
- Orders whose `riskR` falls below `config.min_r_multiple` (e.g. after a
  config change) are auto-withdrawn on the next round.
- Orders carry `expiresTs` (`config.order_expiry_hours` after creation). An
  unfilled, still-valid order survives rounds; an invalidated one is
  withdrawn with a reason in `log.md`.
- Every suggested order is **re-debated every round** with fresh data
  (all 8 sources below). A lost debate withdraws the order.

## The debate — every data source must vote (engine v3)

Each order carries a `debate[]`: one FOR/AGAINST/NEUTRAL verdict with
evidence per source — `overview` (EMAs/VWAP/RSI/day change) ·
`footprint` (signal counts + recent signals) · `largeOrders` (whale
walls ±2%) · `liquidation` (target magnet) · `liquidation-hazard` ·
`stops(BTC heatmap)` · `bookWalls` (±5% depth imbalance, 5m delta) ·
`cvd` (taker share, perp/spot CVD, divergence) · `notifications`
(weighted 6h bias). An order is emitted only if **FOR ≥ 3 AND
FOR > AGAINST** (on top of the numeric gates). WAKE.md shows every
non-neutral vote so the human can audit the reasoning before anything
is punched.

## Broker basis — MT5 prices ≠ terminal perp prices (mandatory rule)

Terminal levels are **USDT-M perp** prices; MT5 is a CFD with its own
spread. Before placing ANY order in MT5:

1. Read `desk/mt5.json` → `spreads.<SYMBOL>.basisPct` (computed live by
   the daemon: MT5 mid vs terminal perp mid) and `spreadPct`.
2. Translate EVERY level: `mt5Level = perpLevel × (1 + basisPct/100)`.
   The order's `perpRefPrice` field is the perp price the levels were
   built from.
3. Mind the quote side: a SHORT fills at **bid** and its SL triggers on
   ask / TP on bid (MT5 convention); pad tight levels by the spread.
4. If `|basisPct| > 0.5%` or `spreadPct > 0.15%`: flag it in `log.md`
   and widen the stop accordingly (or skip) — never place raw perp
   levels on the broker.

- atg-exec should treat `suggested` orders as **proposals**: it may skip any
  (spread, session, news), but must log why in `log.md`.

## User prompts (canonical)

- **`desk round now`** — zai pulls latest, boots the terminal if needed,
  runs the full v3 round (12-asset scan → deep data → debate-gated order
  formulation → lifecycle → position review), refreshes WAKE.md, pushes
  to GitHub, and reports a digest with the debates.
- **`desk review`** — no new orders: review open MT5 positions, running
  PnL, suggested/placed orders, verdicts and basis; report only.

## Directive protocol — zai directs, atg reasons (v1)

zai-desk issues **directives** as inbox instructions
(`desk/inbox/<ts>-DIR-<n>-<slug>.json`, action `AGENT_TASK`, the directive
embedded as structured markdown in `instruction`). The daemon routes them to
WAKE.md + desktop notification as usual. Directives are how zai exercises
directional control; the reasoning mandate below is how atg keeps its brain.

### Directive kinds

| kind | risk | use |
| --- | --- | --- |
| `EXECUTE_ORDER` | adds | place a `suggested` order in MT5 (levels + sizing per constraints) |
| `CANCEL_ORDER` | reduces | cancel a pending ticket |
| `MODIFY_POSITION` | reduces if tightening | move SL / TP on an open position |
| `CLOSE_POSITION` | reduces | exit an open position |
| `INVESTIGATE` | none | research + report (broker symbols, data quality, logs) |
| `PREPARE` | none | analysis only, no action |

### The reasoning mandate (non-negotiable)

atg-exec **never executes a directive on trust**. Before acting it must:

1. **Re-derive every number itself** — re-pull `desk/mt5.json`, recompute
   the basis translation `mt5Level = perpLevel × (1 + basisPct/100)`, recompute
   lot size from live equity × `max_risk_per_trade_pct`, re-check spread/side.
2. **Re-verify validity** — order still `suggested`, debate still FOR > AGAINST,
   not expired, position cap respected.
3. **Apply local knowledge** — session, imminent news, broker quirks, terminal health.
4. **Form its own opinion** — "would I take this trade / make this change?"
   If NO → reply `COUNTER` with the alternative and reasoning. Do not execute.

### Reply contract

atg replies in `desk/outbox/<same-basename>.reply.md` (git-committed):

```
VERDICT: EXECUTED | COUNTER | REJECTED | DEFERRED
CHECKS:   <each directive checklist item → pass/fail + the value YOU observed>
REASONING: <your own analysis, 3–10 lines — why you agree or not>
ACTION:    <what you did, or propose instead>
EVIDENCE:  <tickets, order_send results, command output, screenshots>
```

- `EXECUTED` → also update `desk/state.json` (status/ticket/actualEntry/notes)
  + `EXEC` entry in `desk/log.md`.
- `COUNTER` → NO execution; the proposal + reasoning stand for zai to re-debate
  or escalate to the user on the next wake.
- `REJECTED` → missing data / mandate conflict; logged + escalated.
- `DEFERRED` → waiting on a condition (e.g. spread normalization); re-check each round.

### Disagreements

Neither agent overrides the other. A `COUNTER`/`REJECTED` is logged in
`desk/log.md` as a `DIALOG` entry; zai answers with the next directive or
escalates to the user. The human remains the only config authority.

### Autonomy levels — `config.autonomy_level` (human-owned, default 1)

| level | meaning |
| --- | --- |
| 0 `PROPOSE` | nothing executes without explicit user approval |
| 1 `REASON-EXECUTE` | atg executes directives that pass its checklist (**current default**) |
| 2 `AUTO-GUARD` | risk-reducing acts (cancel / close / tighten SL) may execute without a directive; placements still need one |
| 3 `FULL` | atg initiates trades within mandate caps and reports after |

### Heartbeat

Every atg activation **overwrites** `desk/outbox/AGENT-STATUS.md`: last-active
ts, directives handled (ids + verdicts), open questions for zai, machine notes
(terminal / MT5 health). zai reads it on every wake — this is how zai knows
the agent's state without guessing.

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
