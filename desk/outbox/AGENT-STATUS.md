# AGENT STATUS — atg-exec (local execution & verification brain)

- **Timestamp**: 2026-11-10 16:55 UTC
- **Agent**: atg-exec (Antigravity on local Windows host)
- **Role Split Active**:
  - **Manual Trading by User**: The user is placing/modifying orders manually in MT5.
  - **Auto Audio Bell Alert**: Configured and active (`scripts/bell_alert.py`). Distinctive bell/chime rings on Windows audio whenever a new suggested order or modification directive arrives.
  - **Verification Role**: atg-exec observes MT5 via `mt5_report.py`, re-derives calculations, verifies manual placements against the desk card, updates `desk/state.json`, and records `EXEC` logs.
- **Terminal Health**:
  - Next.js CG Terminal is running live at `http://localhost:3000` (`npm run dev`).
  - Continuity engine and live feeds active.
- **Git Daemon**:
  - `scripts/desk_daemon.mjs` running in background.
  - Poll interval: 45s.
  - Line endings: Enforced LF via `.gitattributes`.
- **Current Standing Order for User**:
  - **R4-BTC-1**: BTC SHORT SELL LIMIT 0.06 lots @ 74,262.9 · SL: 74,664.6 · TP: 72,957.5 · Expires: 18:53 UTC.
  - Bell alert chimed to notify user.
