import json

with open('desk/scratch_crypto_raw.json') as f:
    data = json.load(f)

rows = []
for sym, val in data.items():
    narrative = val.get('narrative') or {}
    liq = val.get('liq') or {}
    
    ok_n = narrative.get('ok', False)
    ok_l = liq.get('ok', False)
    
    regime = narrative.get('regime', 'UNKNOWN')
    direction = narrative.get('direction', 'FLAT')
    grade = narrative.get('grade', 'C')
    conf = narrative.get('confidence', 0)
    m1_dict = narrative.get('m1') or {}
    m1 = m1_dict.get('status', 'OFF')
    m2_dict = narrative.get('m2') or {}
    m2 = m2_dict.get('status', 'OFF')
    vetoes = narrative.get('plan', {}).get('vetoes') or []
    vwapZ = narrative.get('context', {}).get('vwapZ')
    
    stats = liq.get('stats') or {}
    bands = stats.get('bands') or []
    shorts_up_2pct = 0.0
    longs_down_2pct = 0.0
    for b in bands:
        if b.get('b', 999) <= 2:
            shorts_up_2pct += b.get('up', 0.0)
            longs_down_2pct += b.get('down', 0.0)
            
    lsr = None
    dominant = "BALANCED"
    if shorts_up_2pct > 0 and longs_down_2pct > 0:
        if shorts_up_2pct >= longs_down_2pct:
            lsr = shorts_up_2pct / longs_down_2pct
            dominant = "SHORT_ABOVE"
        else:
            lsr = longs_down_2pct / shorts_up_2pct
            dominant = "LONG_BELOW"
    elif shorts_up_2pct > 0:
        lsr = 999.0
        dominant = "SHORT_ABOVE"
    elif longs_down_2pct > 0:
        lsr = 999.0
        dominant = "LONG_BELOW"
    else:
        lsr = 1.0

    # Qualification criteria:
    # (Grade A/A+, or conf >= 80 + triggered, or LSR >= 2.5 magnet, or |score| >= 2.0)
    # triggered means m1 == 'TRIGGERED' or m2 == 'TRIGGERED'
    is_grade_a = grade in ['A', 'A+']
    is_conf_triggered = (conf >= 80) and (m1 == 'TRIGGERED' or m2 == 'TRIGGERED')
    is_lsr_magnet = lsr is not None and lsr >= 2.5
    is_score_extreme = vwapZ is not None and abs(vwapZ) >= 2.0
    
    qualifies = is_grade_a or is_conf_triggered or is_lsr_magnet or is_score_extreme
    
    reasons = []
    if is_grade_a: reasons.append(f"Grade {grade}")
    if is_conf_triggered: reasons.append(f"Conf {conf} + M1/M2 Triggered")
    if is_lsr_magnet: reasons.append(f"LSR {lsr:.1f}:1 ({dominant})")
    if is_score_extreme: reasons.append(f"|vwapZ| {abs(vwapZ):.2f} >= 2.0")
    
    rows.append({
        "sym": sym,
        "regime": regime,
        "direction": direction,
        "grade": grade,
        "conf": conf,
        "m1": m1,
        "m2": m2,
        "vetoes": vetoes,
        "vwapZ": vwapZ,
        "shorts_up_2pct": shorts_up_2pct,
        "longs_down_2pct": longs_down_2pct,
        "lsr": lsr,
        "dominant": dominant,
        "qualifies": qualifies,
        "reasons": reasons
    })

# Sort by Grade (A+, A, B, C), then conf desc
grade_order = {"A+": 0, "A": 1, "B": 2, "C": 3, "UNKNOWN": 4}
rows.sort(key=lambda x: (grade_order.get(x['grade'], 9), -x['conf']))

print(f"{'SYM':8} | {'REGIME':13} | {'DIR':5} | {'GR':3} | {'CONF':4} | {'M1':10} | {'M2':16} | {'vwapZ':6} | {'LSR (±2%)':15} | {'QUAL':5} | {'VETOES'}")
print("-" * 110)
for r in rows:
    z_str = f"{r['vwapZ']:.2f}" if r['vwapZ'] is not None else "n/a"
    lsr_str = f"{r['lsr']:.1f}:1 {r['dominant'][:4]}" if r['lsr'] is not None else "n/a"
    v_str = "; ".join(r['vetoes']) if r['vetoes'] else "none"
    print(f"{r['sym']:8} | {r['regime']:13} | {r['direction']:5} | {r['grade']:3} | {r['conf']:4} | {r['m1']:10} | {r['m2']:16} | {z_str:6} | {lsr_str:15} | {'YES' if r['qualifies'] else 'no':5} | {v_str[:35]}")

print("\n--- QUALIFIERS SUMMARY ---")
qualifiers = [r for r in rows if r['qualifies']]
print(f"Total qualifiers: {len(qualifiers)} / {len(rows)}")
for q in qualifiers:
    print(f"  {q['sym']:8} | Gr:{q['grade']:3} Conf:{q['conf']:2} | {' & '.join(q['reasons'])}")
