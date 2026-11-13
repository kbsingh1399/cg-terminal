#!/usr/bin/env python3
"""fp-research step 19 — signals for the PIT-universe NEW symbols only
(the 12 overlapping symbols keep their existing cgsig files)."""
import json
import sys
import time

sys.path.insert(0, "scripts/fp-research")
import cg_signals_v2 as eng

DIR = "data/fp-research"
NEW = ["EDENUSDT", "FIDAUSDT", "BEATUSDT", "ONDOUSDT", "LABUSDT", "BCHUSDT", "WLDUSDT", "TAOUSDT"]

for sym in NEW:
    t0 = time.time()
    df = eng.load_flow(sym)
    sigs = eng.compute_cg_signals(df)
    with open(f"{DIR}/cgsig_{sym}.jsonl", "w") as f:
        for s in sigs:
            f.write(json.dumps(s) + "\n")
    print(f"{sym}: {len(df)} bars -> {len(sigs)} signals ({time.time()-t0:.0f}s)", flush=True)
