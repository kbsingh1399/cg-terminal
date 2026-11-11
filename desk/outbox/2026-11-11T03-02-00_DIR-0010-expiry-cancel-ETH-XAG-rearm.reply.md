# Reply: DIR-0010 · Expiry Cancel Re-Arm (ETHUSD `209422601` & XAGUSD `209422699`)

**VERDICT**: EXECUTED-EXTERNAL (cancelled in MT5; zero fills; state synced)
**TIMESTAMP**: 2026-11-11 07:18 UTC
**DIRECTIVE**: `desk/inbox/2026-11-11T03-02-00_DIR-0010-expiry-cancel-ETH-XAG-rearm.json` (re-arm of `DIR-0007`)

---

### CHECKS
- [x] **MT5 Live Account & Orders (`desk/mt5.json` @ `ts 1794381115791` / `07:11:55 UTC`)**:
  * `positions`: `[]` (flat).
  * `orders`: `[]` (zero pending orders).
  * `account`: balance `$4,649.96`, equity `$4,649.96`, profit `$0.00` (unchanged).
- [x] **MT5 Order History Verification (`mt5.history_orders_get`)**:
  * Ticket `209422601` (`ETHUSD` sell limit `0.53 @ 2095.26`): `state = 2` (`ORDER_STATE_CANCELED`), `time_setup = 2026-11-10 20:55:53+00:00` (broker UTC+2 = `18:55:53 UTC`), `time_done = 2026-11-11 09:08:39+00:00` (broker UTC+2 = `07:08:39 UTC`). Never filled.
  * Ticket `209422699` (`XAGUSD` sell limit `0.01 @ 53.099`): `state = 2` (`ORDER_STATE_CANCELED`), `time_setup = 2026-11-10 20:57:06+00:00` (broker UTC+2 = `18:57:06 UTC`), `time_done = 2026-11-11 09:08:40+00:00` (broker UTC+2 = `07:08:40 UTC`). Never filled.
- [x] **Broker Rules Verification**:
  * Python MT5 automated order cancellation remains disabled at prop-firm account level; cancellations were completed manually inside the MT5 terminal at `07:08:39–40 UTC`, leaving the account 100% flat with zero fills.

---

### REASONING
Both pending orders remained unfilled and were cancelled in MT5 prior to fill (`state = 2`). Account equity remains intact at `$4,649.96`. Because `desk/state.json` still showed both orders as `"placed"`, atomic state reconciliation (`cancelled-expiry`) is required so downstream rounds see accurate live capacity and flat exposure.

---

### ACTION
1. Atomically updated (`state.json.tmp` + `os.replace`) orders `R18-ETH-1` (`209422601`) and `R18-XAG-1` (`209422699`) in `desk/state.json`:
   * `status`: `"cancelled-expiry"`
   * `statusTs`: current UTC ms
   * `notes`: appended cancellation & zero-fill MT5 history evidence.
2. Appended `EXEC` entry to `desk/log.md` with MT5 history ticket evidence.

---

### EVIDENCE
```
mt5.history_orders_get:
  209422601 ETHUSD state=2 (ORDER_STATE_CANCELED) time_done=2026-11-11 09:08:39+00:00 (07:08:39 UTC)
  209422699 XAGUSD state=2 (ORDER_STATE_CANCELED) time_done=2026-11-11 09:08:40+00:00 (07:08:40 UTC)
mt5.json:
  balance: 4649.96, equity: 4649.96, positions: [], orders: []
```
