#!/usr/bin/env python3
"""R9/R10 desk updates: record BTC placement 209404683 with verification math,
R9-ADA-1 broker-block note, EXEC entry, beacon refresh."""
import json, time
from pathlib import Path

ROOT = Path('/home/z/my-project')
now_ms = int(time.time() * 1000)

# ---------- 1. state.json ----------
sp = json.load(open(ROOT / 'desk/state.json'))
for o in sp['orders']:
    if o['id'] == 'R4-BTC-1':
        o.update({
            'status': 'placed', 'statusTs': now_ms,
            'ticket': 209404683,
            'actualEntry': 74262.9,
            'notes': ('PLACED by USER 16:53:56 UTC — BTCUSD SELL LIMIT 0.06 @ 74,262.9 SL 74,664.0 '
                      'TP 72,957.0 (ticket 209404683, pending above market). DESK VERIFICATION (placement-time '
                      'basis +0.051%, snapshot 16:53:34): entry dev -0.061% (tol ±0.1%), SL dev -0.030% (tol '
                      '±0.15%), TP dev -0.062% (tol ±0.1%) — uniform stale-basis shift, ALL WITHIN TOLERANCE. '
                      'Stop geometry intact: bid-based stop dist 377.6 vs perp design 378.4 (SL pad present). '
                      'Risk $22.66 = 0.487% equity (mandate 0.5%). R to T1 3.46. Spread 0.032% ✓ basis +0.051% ✓. '
                      'VERDICT: EXECUTED-COMPLIANT. R10 17:07 re-debate FOR 6/AGAINST 1 — stands. '
                      'Expires 18:53 UTC if never filled.')
        })
    if o['id'] == 'R9-ADA-1':
        o['notes'] = ('R9 17:01 (run locally by atg desk) — perp setup strong: debate 5/0, T1 long-liq magnet '
                      'str 92 (~$4M) at 0.1702, R 3.0. R10 re-debate 6/0. BROKER BLOCKED at 17:00: ADAUSD '
                      'spread 2.2016% (rule max 0.15%) — 13x over limit; basis +0.174% would pass but spread '
                      'makes any fill an instant stop-out (same pathology as R6-ADA-1). DO NOT place on this '
                      'broker quote. Re-check each round; expires 19:41 UTC.')
    if o['id'] == 'R7-LTC-1':
        o['notes'] = ('R10 17:07 re-debate FOR 5/AGAINST 1 — stands on perp side. BROKER BLOCKED at 17:00: '
                      'basis +1.134% (worse than 16:53) AND spread 2.4006%. Do NOT place. '
                      'Expires 20:29 UTC if never placeable.')
json.dump(sp, open(ROOT / 'desk/state.json', 'w'), indent=1, ensure_ascii=False)

# ---------- 2. log.md EXEC entry ----------
exec_entry = """
### EXEC · 2026-11-10 17:09 UTC · zai-desk — BTC placement verified + trade status sweep
- TICKET 209404683 (R4-BTC-1): USER placed 16:53:56 — BTCUSD SELL LIMIT 0.06 @ 74,262.9 · SL 74,664.0 · TP 72,957.0, pending above market (bid 72,945 at 17:00, needs +1.8% rally to fill).
- VERIFICATION (placement-time basis +0.051%, spread$ 23.49): entry dev -0.061% ✓ · SL dev -0.030% ✓ · TP dev -0.062% ✓ — uniform stale-basis shift (user used the 16:40 card basis -0.010%), ALL WITHIN TOLERANCES (±0.1/0.15/0.1%).
- Geometry: bid-based stop dist 377.6 (design 378.4, SL pad present ✓) · risk $22.66 = 0.487% equity ✓ · R to T1 3.46 ✓ · spread 0.032% ✓ · basis +0.051% ✓.
- VERDICT: EXECUTED-COMPLIANT. Lesson logged: place from the LATEST mt5.json basis, not an older card — deviation was harmless this time.
- Trade ledger: R6-ADA-1 (209375723) cancelled ✓ · XAU 0.01 (209400100) closed −$4.46 ✓ · R4-BTC-1 (209404683) placed pending ✓ · R7-LTC-1 not placeable (basis +1.13%, spread 2.40%) · R9-ADA-1 not placeable (spread 2.20%) · R4-DOGE-3 not placeable (no tick).
- R10 17:07: bias BTC −7.2 · ADA −6.3 (rising) · LTC −4.9 · XAG −3.7 · ETH −3.3; no new candidates; all 4 standing orders re-debated and stand.
"""
with open(ROOT / 'desk/log.md', 'a') as f:
    f.write(exec_entry)
print('state + log updated')
