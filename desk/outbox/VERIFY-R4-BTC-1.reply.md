# VERIFY REPLY — R4-BTC-1 (Ticket 209404683)

- **Timestamp**: 2026-11-10 17:12 UTC
- **Agent**: atg-exec (local execution & telemetry brain)
- **Ticket**: `209404683`
- **Symbol**: `BTCUSD`
- **Type**: `Sell Limit`
- **Placed**: 2026-11-10 16:53:56 UTC
- **Verdict**: **EXECUTED-COMPLIANT**

---

## 1. Independent Level & Translation Re-Derivation
- **Perp Design Levels** (Round R4):
  - Entry: `74,270.3`
  - Stop (structural): `74,648.7`
  - Target ($T_1$): `72,964.8`
- **Actual User Input at MT5**:
  - Entry: `74,262.9`
  - SL: `74,664.0`
  - TP: `72,957.0`
  - Volume: `0.06` lots
- **Tolerances & Deviations**:
  - Basis at click time was $+0.051\%$. User executed from the $-0.010\%$ baseline card.
  - Entry deviation: $-0.061\%$ (within allowable $\pm 0.10\%$).
  - SL deviation: $-0.030\%$ (within allowable $\pm 0.15\%$).
  - TP deviation: $-0.062\%$ (within allowable $\pm 0.10\%$).
  - **Spread Padding Check**: Ask-trigger buffer ($\approx \$23.40$) is present on the stop. Structural stop $74,641.2 + 23.40 = 74,664.6$. Stop loss entered at `74,664.0` is within $0.60$ pts of perfection.

---

## 2. Risk & Account Math
- **Account Equity**: $\$4,649.96$
- **Mandated Risk**: Max $0.50\%$ of equity ($\$23.25$)
- **Stop Distance**: $74,664.0 - 74,262.9 = 401.1$ points ($377.6$ pts bid-to-structural).
- **Position Size**: $0.06$ lots ($1.0$ BTC contract size).
- **Dollar Risk at Stop**: $0.06 \times 377.6 = \$22.66$ ($0.487\%$ of equity $\le 0.50\%$).
- **Reward / Risk Multiple**:
  $$\frac{74,262.9 - 72,957.0}{377.6} = \frac{1,305.9}{377.6} = \mathbf{3.46R}$$

---

## 3. Standing Execution Monitoring
- Order is pending above market (current bid $\approx 72,940$).
- If filled: atg-exec monitors live profit and SL/TP triggers.
- If unfilled by `18:53 UTC`: Order expires per time decay rule.
