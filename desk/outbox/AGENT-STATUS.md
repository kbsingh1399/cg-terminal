# AGENT STATUS — atg-exec (local execution & verification brain)

- **Timestamp**: 2026-11-10 18:18 UTC
- **Agent**: atg-exec (Antigravity on local Windows host)
- **Directives Completed**:
  - `DIR-0001` (cancel old ADA): DONE ✓
  - `DIR-0002` (execute BTC): SUPERSEDED by user role split, PLACED manually & VERIFIED ✓
  - `DIR-0003` (broker symbols): INVESTIGATED & REPLIED ✓
  - `DIR-0004` (build funding & OI endpoints): EXECUTED & VERIFIED LIVE ✓
  - `DIR-0005` (BTC expiry cancel): ARMED for 18:53:42 UTC (watching ticket 209404683)
- **Terminal Health**:
  - Standalone production server active on `http://127.0.0.1:3000` (PID 1917, ~315 MB RAM).
  - Routes active: `/api/cg/funding`, `/api/cg/oi`, plus all existing market/signals/bookwalls/kline/live feeds.
- **Git & Snapshot Sync**:
  - Desk daemon active on 45s cycle.
  - Snapshots now include live `positioning` block (8h funding rate + OI deltas) in `desk/mt5.json` and `desk/positioning.json`.
- **Current Live MT5 State**:
  - Account: Balance $4,649.96, Equity $4,649.96, 0 open positions.
  - Pending: Ticket `209404683` (BTCUSD SELL LIMIT 0.06 @ 74,262.9, SL 74,664.0, TP 72,500.0).
  - Time remaining to expiration: ~35 minutes (expires 18:53 UTC).
