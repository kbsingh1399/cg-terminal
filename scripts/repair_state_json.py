#!/usr/bin/env python3
"""Repair desk/state.json after a stash-pop conflict (2026-11-10 20:5x UTC).

Second occurrence of the daemon-vs-desk state.json race (first: 205d867).
Strategy: reconstruct BOTH sides (upstream = daemon's R23 round state,
stash = desk's 17-entry symbol_map edit), merge — daemon-fresh analysis/orders
as base, desk symbol_map + config wins — then validate JSON round-trip.
"""
import json, re, subprocess, sys

P = "desk/state.json"
txt = open(P).read()

MARK_O = re.compile(r"^<<<<<<< Updated upstream\n", re.M)
MARK_S = re.compile(r"^=======\n", re.M)
MARK_C = re.compile(r"^>>>>>>> Stashed changes\n", re.M)


def side(which):
    """Reconstruct one side by dropping the other side's text and the markers."""
    out = []
    state = "keep"  # outside conflict
    for ln in txt.splitlines(keepends=True):
        if MARK_O.match(ln):
            state = "upstream" if which == "upstream" else "drop"
            continue
        if MARK_S.match(ln):
            state = "drop" if which == "upstream" else "keep"
            continue
        if MARK_C.match(ln):
            state = "keep"
            continue
        if state != "drop":
            out.append(ln)
    return "".join(out)


ups, stash = side("upstream"), side("stash")
try:
    d_up = json.loads(ups)
    print("upstream side: CLEAN ·", d_up.get("analysis", {}).get("last_round"), "· map", len(d_up.get("config", {}).get("symbol_map", {})))
except Exception as e:
    sys.exit(f"upstream side still broken: {e}")
try:
    d_st = json.loads(stash)
    print("stash side:    CLEAN ·", d_st.get("analysis", {}).get("last_round"), "· map", len(d_st.get("config", {}).get("symbol_map", {})))
except Exception as e:
    sys.exit(f"stash side still broken: {e}")

# merge: daemon-fresh base (newer analysis/orders), desk config wins
base, cfg = d_up, d_st.get("config") or {}
base["config"] = {**(d_up.get("config") or {}), **cfg}
# orders: keep the LONGER array (more complete order history of the two sides)
if len(d_st.get("orders", [])) > len(d_up.get("orders", [])):
    base["orders"] = d_st["orders"]
json.dump(base, open(P, "w"), indent=2)
chk = json.load(open(P))
sm = chk["config"]["symbol_map"]
assert sm.get("DOGE") == "DOGUSD" and sm.get("LINK") == "LNKUSD" and sm.get("XPT") == "XPTUSD" and sm.get("UKO") == "UKOUSD"
print(f"REPAIRED · round {chk['analysis']['last_round']} · symbol_map {len(sm)} entries · orders {len(chk.get('orders', []))}")
print("map:", json.dumps(sm))
