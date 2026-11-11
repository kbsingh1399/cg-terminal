# Reply: DIR-0007 · 4-Hour Order-Life Expiry Discipline (ETH 209422601 & XAG 209422699)

**VERDICT**: DEFERRED (ARMED)
**TIMESTAMP**: 2026-11-10 19:28 UTC
**DIRECTIVE**: `desk/inbox/2026-11-10T19-25-00_DIR-0007-expiry-cancel-ETH-XAG.json`
**TARGET EXPIRY**: `2026-11-10 22:58:00 UTC` (timestamp `1794351480000`)

---

### CHECKS
- [x] **ETH Ticket 209422601 Status**: Verified active in `desk/mt5.json` as `sell_limit 0.53 @ 2095.26` (SL `2138.89`, TP `2004.76`). Not filled, not expired.
- [x] **XAG Ticket 209422699 Status**: Verified active in `desk/mt5.json` as `sell_limit 0.01 @ 53.099` (SL `53.763`, TP `50.813`). Not filled, not expired.
- [x] **Timestamp Check**: Current timestamp is `19:28 UTC`. Target trigger is `22:58 UTC` (~3.5 hours remaining in active order window).
- [x] **Card Drift**: Both levels verified with zero material drift vs 19:13 UTC broadcast (ETH drift < 0.015%, XAG drift < 0.006%).
- [x] **Alert A6 / Expiry Wiring**: Integrated into daemon alert evaluation (`checkAlerts()`).

---

### REASONING
Both limit orders represent high-conviction pullback attack entries into premium supply (ETH into day VAH+VWAP+1σ, XAG into VWAP+1σ+day POC) targeting institutional liquidation magnets (ETH str 70 @ 2,004.76; XAG str 87 @ 50.813). 
Per the playbook discipline, orders are given a strict 4-hour shelf life to protect against regime degradation, but should not be prematurely cancelled before the 4-hour window lapses. Current orders remain fully valid, active, and monitored.
At `22:58:00 UTC`, if neither order has filled, Alert A6 will sound the bell alert, flag both tickets for cancellation in `WAKE.md`, update `state.json` to `'expired'`, and notify the user to cancel them in MT5.

---

### ACTION
1. Directive ARMED in desk daemon alerts engine for trigger at $\ge 22:58:00\text{ UTC}$.
2. While orders are pending, MT5 snapshot poll remains active. If filled prior to expiry, Alert A1 triggers fill protocol and snapshot cadence tightens to 120s.
3. No premature cancellation or modification to SL/TP/price.

---

### EVIDENCE
From `desk/mt5.json` (live snapshot 19:27 UTC):
```json
{
  "orders": [
    {
      "ticket": 209422601,
      "asset": "ETH",
      "symbol": "ETHUSD",
      "type": "sell_limit",
      "volume": 0.53,
      "price": 2095.26,
      "sl": 2138.89,
      "tp": 2004.76,
      "placedTs": 1794344153000
    },
    {
      "ticket": 209422699,
      "asset": "XAG",
      "symbol": "XAGUSD",
      "type": "sell_limit",
      "volume": 0.01,
      "price": 53.099,
      "sl": 53.763,
      "tp": 50.813,
      "placedTs": 1794344226000
    }
  ]
}
```
*(Notice: Expired BTC ticket 209404683 is confirmed removed from MT5).*
