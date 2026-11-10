# DIR-0003 REPLY — Broker Symbols, ADA Verification & Rounds Status

- **Directive ID**: `2026-11-10T16-10-00_DIR-0003-broker-symbols-and-status`
- **Agent**: atg-exec (Antigravity on local Windows execution host)
- **Timestamp**: 2026-11-10 17:06 UTC
- **Verdict**: EXECUTED (Investigation Complete)

---

## 1. Broker Symbol Discovery (FundedNext-Server)

Queried full broker symbol universe (`mt5.symbols_get()`, 96 symbols total). Findings:

| Asset | Broker Symbol | Status | Tick / Spread Details |
| :--- | :--- | :--- | :--- |
| **DOGE** | `DOGUSD` | Tradeable | Bid `0.0667`, Ask `0.0676`. Spread $\approx 1.34\%$ (exceeds $0.15\%$ threshold; skip trades on wide spread). |
| **LINK** | `LNKUSD` | Inactive | `time=0`, bid=0, ask=0 (dormant/no live quotes from broker feed). |
| **SOL** | *Not listed* | Missing | Not offered in FundedNext 96-symbol universe. |
| **AVAX** | *Not listed* | Missing | Not offered in FundedNext 96-symbol universe. |
| **BNB** | *Not listed* | Missing | Not offered in FundedNext 96-symbol universe. |
| **BTC** | `BTCUSD` | Active | Spread $\approx 0.032\% - 0.040\%$, Basis $\approx +0.05\%$. **Compliant**. |
| **ETH** | `ETHUSD` | Active | Spread $\approx 0.027\%$, Basis $\approx +0.03\%$. **Compliant**. |
| **LTC** | `LTCUSD` | Active | Spread $\approx 2.40\%$ (blocked by spread gate). |
| **ADA** | `ADAUSD` | Active | Spread $\approx 2.20\%$ (blocked by spread gate). |
| **XRP** | `XRPUSD` | Active | Listed. |
| **XAU** | `XAUUSD` | Active | Spread compliant. |
| **XAG** | `XAGUSD` | Active | Spread compliant. |

### Proposed `symbol_map` update for human config:
```json
{
  "DOGE": "DOGUSD",
  "LINK": "LNKUSD"
}
```
*(SOL, AVAX, BNB should be marked unmapped / broker-unavailable).*

---

## 2. ADA Cancel & Current Account State
- **ADA Order `209375723`**: Confirmed **CANCELLED**. `orders_get()` returns empty for ADA.
- **XAUUSD Test Position `209400100`**: User manually closed in MT5 at ~16:52 UTC. Realized PnL: $-\$4.46$.
- **Current Account State**:
  - Balance: `4,649.96 USD`
  - Equity: `4,649.96 USD`
  - Margin: `0.00 USD` (Account flat)
  - Free Margin: `4,649.96 USD`

---

## 3. Rounds Status
- Rounds are running and healthy!
- `desk_round.sh` was fixed and line endings permanently enforced via `.gitattributes` (`*.sh text eol=lf`).
- Git Bash path resolution (`C:\Users\SIGMA\AppData\Local\hermes\git\bin\bash.exe`) configured in `scripts/desk_daemon.mjs` to bypass WSL localhost routing.
- Round R8 and R9 completed cleanly and synced to git.
- Daemon polling MT5 every 45s (`mt5.interval_secs: 45`).
- Audio bell alert (`scripts/bell_alert.py`) active on Windows audio for all new suggestions and directives.
