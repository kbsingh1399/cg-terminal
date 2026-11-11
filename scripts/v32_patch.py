#!/usr/bin/env python3
"""v3.2 patch: fix targetSources landmine + regime detector + dual templates + reversion vote."""
import re

P = '/home/z/my-project/scripts/desk_round.py'
src = open(P).read()
orig = src

# ---------- 0. fix the malformed targetSources line (whatever invisible chars it has) ----------
src = re.sub(r'"targetSources":\s*\[1\][^\]]*\][^\n]*,',
             '"targetSources": [m[1] for m in ladder],', src, count=1)
assert '"targetSources": [m[1] for m in ladder],' in src, "targetSources fix failed"

# ---------- 1. regime detector (insert before "# ------ 6. build orders") ----------
regime_fn = '''
# ------------------------------------------------- 5b. regime detection (v3.2)
def regime_of(rec, parts):
    """TREND-UP / TREND-DOWN / RANGE / TRANSITION — decides the trade template."""
    trend = parts.get("trend", 0) or 0
    price, vw = rec.get("price"), rec.get("vwap") or {}
    vwap, b = vw.get("vwap") or price, vw.get("bands") or {}
    sd1 = b.get("sd1") or (price * 0.005 if price else 0)
    if not price or not sd1:
        return "TRANSITION", 0.0
    dist_sd = (price - vwap) / sd1
    if abs(trend) >= 2 and abs(dist_sd) >= 0.5:
        return ("TREND-DOWN" if trend < 0 else "TREND-UP"), dist_sd
    if abs(trend) <= 1 and abs(dist_sd) < 0.5:
        return "RANGE", dist_sd
    return "TRANSITION", dist_sd

regimes = {s: regime_of(assets[s], scored[s].get("parts") or {})[0]
           for s in scored if scored.get(s, {}).get("score") is not None}

'''
anchor = '# ------------------------------------------------- 6. build orders'
assert anchor in src
src = src.replace(anchor, regime_fn + anchor, 1)

# ---------- 2. build_order: regime param + dual template ----------
src = src.replace(
    "def build_order(sym, side, score, parts, rec, deep):",
    "def build_order(sym, side, score, parts, rec, deep, regime=\"TRANSITION\"):", 1)

old_entry = '''    if long:
        entry = min(price, vwap - sd1)
        if day.get("poc") and day["poc"] < price and day["poc"] > entry:
            entry = day["poc"]
    else:
        entry = max(price, vwap + sd1)
        if day.get("poc") and day["poc"] > price and day["poc"] < entry:
            entry = day["poc"]

    base_risk = max(sd2 - sd1, price * 0.004)
    stop = entry - sgn * base_risk'''
new_entry = '''    mode = "mean-revert" if regime == "RANGE" else "trend-pullback"
    if regime == "RANGE":
        # v3.2 mean-revert template: fade the 2-sigma band extreme back to the VWAP mean
        entry = vwap - 2.0 * sd1 if long else vwap + 2.0 * sd1
        if day.get("poc") and ((long and vwap > day["poc"] > entry) or (not long and vwap < day["poc"] < entry)):
            entry = day["poc"]
        base_risk = 0.75 * sd1
        stop = entry - sgn * base_risk
    else:
        # trend-pullback template (v2/v3): limit into the value band, aligned with the trend
        if long:
            entry = min(price, vwap - sd1)
            if day.get("poc") and day["poc"] < price and day["poc"] > entry:
                entry = day["poc"]
        else:
            entry = max(price, vwap + sd1)
            if day.get("poc") and day["poc"] > price and day["poc"] < entry:
                entry = day["poc"]

        base_risk = max(sd2 - sd1, price * 0.004)
        stop = entry - sgn * base_risk'''
assert old_entry in src, "entry block not found"
src = src.replace(old_entry, new_entry, 1)

# ---------- 3. RANGE mode: prepend VWAP-mean target ----------
old_mag = '''    magnets = []
    if long:
        if day.get("vah") and day["vah"] > entry:
            magnets.append((day["vah"], "day VAH"))'''
new_mag = '''    magnets = []
    if regime == "RANGE":
        magnets.append(((vwap - 0.2 * sd1) if long else (vwap + 0.2 * sd1), "VWAP mean (reversion)"))
    if long:
        if day.get("vah") and day["vah"] > entry:
            magnets.append((day["vah"], "day VAH"))'''
assert old_mag in src
src = src.replace(old_mag, new_mag, 1)

# ---------- 4. debate call inside build_order gets regime ----------
src = src.replace("    debate = build_debate(sym, side, rec, deep)\n    ok, nf, na = debate_ok(debate, side)",
                  "    debate = build_debate(sym, side, rec, deep, regime=regime)\n    ok, nf, na = debate_ok(debate, side)", 1)

# ---------- 5. rationale carries mode/regime; order dict tagged ----------
old_rat = '''        f"; entry {'VWAP-1σ/day-POC' if long else 'VWAP+1σ/day-POC'} {fmt(sym, entry)}"'''
new_rat = '''        f"; entry {'VWAP-1σ/day-POC' if long else 'VWAP+1σ/day-POC'} {fmt(sym, entry)} [{mode} · {regime}]"'''
assert old_rat in src
src = src.replace(old_rat, new_rat, 1)

old_dict = '''        "perpRefPrice": price,
        "debate": debate,
        "rationale": rationale,'''
new_dict = '''        "perpRefPrice": price,
        "regime": regime, "mode": mode,
        "debate": debate,
        "rationale": rationale,'''
assert old_dict in src
src = src.replace(old_dict, new_dict, 1)

# ---------- 6. emission loop: regime-aware gates ----------
old_gate = '''for sym in cands:
    sc = scored[sym]
    score, parts = sc["score"], sc["parts"]
    if abs(score) < MIN_CONF:
        continue
    side = "long" if score > 0 else "short"
    al = (1 if parts.get("signals", 0) * (1 if side == "long" else -1) > 0 else 0,
          1 if parts.get("trend", 0) * (1 if side == "long" else -1) > 0 else 0,
          1 if parts.get("vwap", 0) * (1 if side == "long" else -1) > 0 else 0)
    if sum(al) < 2:
        continue'''
new_gate = '''for sym in cands:
    sc = scored[sym]
    score, parts = sc["score"], sc["parts"]
    regime = regimes.get(sym, "TRANSITION")
    if regime == "RANGE":
        # v3.2 mean-revert lane: weak directional lean picks the fade side; no momentum alignment required
        if abs(score) < 1.5:
            continue
        side = "long" if score > 0 else "short"
    else:
        if abs(score) < MIN_CONF:
            continue
        side = "long" if score > 0 else "short"
        al = (1 if parts.get("signals", 0) * (1 if side == "long" else -1) > 0 else 0,
              1 if parts.get("trend", 0) * (1 if side == "long" else -1) > 0 else 0,
              1 if parts.get("vwap", 0) * (1 if side == "long" else -1) > 0 else 0)
        if sum(al) < 2:
            continue'''
assert old_gate in src
src = src.replace(old_gate, new_gate, 1)

src = src.replace("    order, note = build_order(sym, side, score, parts, assets[sym], deep_for(sym))",
                  "    order, note = build_order(sym, side, score, parts, assets[sym], deep_for(sym), regime=regime)", 1)

# ---------- 7. re-debate keeps order regime ----------
src = src.replace('    deb = build_debate(sym, o["side"], assets[sym], deep_for(sym))',
                  '    deb = build_debate(sym, o["side"], assets[sym], deep_for(sym), regime=regimes.get(sym))', 1)

# ---------- 8. bias table + stdout show regimes ----------
src = src.replace(
    'bias_tbl = "  ".join(f"{s}{scored[s][\'score\']:+.0f}" for s in cands if abs(scored[s]["score"]) >= 2)',
    'bias_tbl = "  ".join(f"{s}{scored[s][\'score\']:+.0f}({regimes.get(s, \'?\')[:5]})" for s in cands if abs(scored[s]["score"]) >= 2)', 1)

# stdout per-asset line: append regime
old_line = re.search(r'for s in cands:\n    sc = scored\[s\]\n    if sc\.get\("score"\) is None:\n        continue\n    parts = sc\.get\("parts", \{\}\)\n', src)
# find the print loop near the end
old_print = '''for s in cands:
    sc = scored[s]
    if sc.get("score") is None:
        continue
    parts = sc.get("parts", {})'''
# leave stdout as-is (compact); regime visible in log bias table + order rationale

# ---------- 9. version bump ----------
src = src.replace("engine v3.1", "engine v3.2 (regime-aware: trend-pullback + mean-revert)")

open(P, 'w').write(src)
print("v3.2 patch applied. delta lines:", len(src.splitlines()) - len(orig.splitlines()))
