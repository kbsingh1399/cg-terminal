# VERIFICATION · TICKET 209422601 · ETHUSD SHORT LIMIT (R18-ETH-1)

- **Ticket**: `209422601`
- **Asset**: `ETHUSD`
- **Timestamp**: `2026-11-10T19:00:00Z`
- **Verdict**: `VERIFIED-COMPLIANT`

---

## 1. PARAMETER AUDIT
| Parameter | Planned (Desk Card) | Actual (MT5 Placement) | Deviation | Status |
|---|---|---|---|---|
| **Type** | Sell Limit | Sell Limit | None | PASS |
| **Volume** | 0.53 lots | 0.53 lots | None | PASS |
| **Price** | 2,095.26 (broker) | 2,095.26 | 0.00 pts (0.00%) | PASS |
| **Stop Loss** | 2,139.06 (with pad) | 2,138.89 | 0.17 pts (0.008%) | PASS (Exact VWAP +2σ) |
| **Take Profit** | 2,004.76 (T1 magnet) | 2,004.76 | 0.00 pts (0.00%) | PASS |

---

## 2. RISK & REWARD MATH
* **Stop Distance**: `2,138.89 - 2,095.26 = 43.63 pts`.
* **Dollar Risk**: `43.63 pts * 1.0 contractSize * 0.53 lots = $23.12`.
* **Account Risk %**: `$23.12 / $4,649.96 = 0.497%` (strictly within $\le 0.50\%$ mandate).
* **Target Distance**: `2,095.26 - 2,004.76 = 90.50 pts`.
* **Dollar Reward**: `90.50 pts * 1.0 * 0.53 = $47.96`.
* **Reward/Risk Multiple**: `90.50 / 43.63 = 2.07R` (exceeds $\ge 2.0\text{R}$ gate).

---

## 3. CONCLUSION
Order placement is **100% COMPLIANT** with institutional execution rules. Added to `desk/state.json`.
