#!/usr/bin/env python3
"""R8 post-round desk updates: ADA cancel bookkeeping, broker-gate verdicts,
manual placement card for R4-BTC-1, log EXEC entry."""
import json, time
from pathlib import Path

ROOT = Path('/home/z/my-project')
now_ms = int(time.time() * 1000)
now_iso = '2026-11-10 16:49 UTC'

# ---------- 1. state.json ----------
sp = json.load(open(ROOT / 'desk/state.json'))
for o in sp['orders']:
    if o['id'] == 'R6-ADA-1' and o.get('status') == 'placed':
        o['status'] = 'cancelled'
        o['statusTs'] = now_ms
        o['notes'] = ('CANCELLED — ticket 209375723 gone from mt5.json orders[] at 16:40 snapshot, '
                      'no ADAUSD position on account (positions[] shows only XAUUSD buy 0.01). '
                      'Desk verdict CANCEL (log.md EXEC 15:47) executed: spread 2.19-2.20% made '
                      'any fill an instant stop-out. R8: ADA confluence -3.8 but still no structural '
                      'target >= 2.0R — no re-entry order.')
    if o['id'] == 'R4-BTC-1':
        o['notes'] = ('R8 16:46 re-debate FOR 6/AGAINST 1 — stands. Broker gates PASS (16:40 snapshot): '
                      'basisPct -0.010%, spreadPct 0.032%. MT5 card for MANUAL placement: SELL LIMIT 0.06 lots '
                      'entry 74262.9 / SL 74664.6 (ask-trigger, spread-padded) / TP 72957.5 (T1). '
                      'Risk $22.70 = 0.49% equity. Re-verify basisPct in fresh desk/mt5.json before placing; '
                      'skip if |basis|>0.5% or spread>0.15%. Expires 18:53 UTC.')
    if o['id'] == 'R7-LTC-1':
        o['notes'] = ('R8 16:46 re-debate FOR 6/AGAINST 0 — stands on perp side, but BROKER BLOCKED at 16:40: '
                      'LTCUSD basisPct +0.841% (rule max 0.5%) AND spreadPct 2.40% (rule max 0.15%). '
                      'Do NOT place on this broker quote — same pathology as ADA. '
                      'Re-check each round; withdraw at expiry 20:29 UTC if never placeable.')
    if o['id'] == 'R4-DOGE-3':
        o['notes'] = ('R8 16:46 re-debate FOR 4/AGAINST 1 — stands on perp side, but BROKER BLOCKED: '
                      'DOGEUSD has no tick (broker symbol name/suffix unknown — DIR-0003 investigation with atg). '
                      'Expires 18:53 UTC.')
json.dump(sp, open(ROOT / 'desk/state.json', 'w'), indent=1, ensure_ascii=False)

# ---------- 2. log.md EXEC entry ----------
exec_entry = """
### EXEC · 2026-11-10 16:49 UTC · zai-desk — R8 desk brief for MANUAL placement
- Account: equity 4,652.88 · balance 4,654.42 · margin_level 2,892% · risk budget 0.5% = $23.26
- R6-ADA-1 ticket 209375723 confirmed GONE (orders[] empty 16:40, no ADA position) → status cancelled. DIR-0001 outcome verified remotely.
- ⚠ OPEN POSITION FOUND: XAUUSD BUY 0.01 lot @ 4022.68 (UI Market Buy ~16:37 UTC), NO SL, NO TP. Floating -1.54.
  Desk advice: add SL 3999.4 (risk $23.3 = 0.50% — sits just below 4,000 psych level). XAU confluence only +2.0 (< 3.0 order threshold): news flow bullish, trend/vwap not yet supportive — position is early vs engine framework, discipline via stop.
- R4-BTC-1 (BTC SHORT, R 3.5, debate 6/1): ONLY broker-compliant trade. Gates: basis -0.010% ✓, spread 0.032% ✓.
  MT5 card (re-verify basis at click time): SELL LIMIT 0.06 lots · entry 74,262.9 · SL 74,664.6 (ask-trigger, padded) · TP 72,957.5 · risk $22.70 (0.49%) · expires 18:53 UTC.
- R7-LTC-1 (LTC SHORT, R 4.3, debate 6/0): BROKER BLOCKED — basis +0.841% (>0.5%) AND spread 2.40% (>0.15%). Skip; re-check each round.
- R4-DOGE-3 (DOGE SHORT, R 4.5, debate 4/1): BROKER BLOCKED — no tick (symbol name TBD, DIR-0003).
- Role split (user directive 16:44): USER places manually at MT5 · atg-exec VERIFIES (reply contract on the placement card) · zai-desk runs rounds + arbitration.
"""
with open(ROOT / 'desk/log.md', 'a') as f:
    f.write(exec_entry)

print('state.json + log.md updated')
