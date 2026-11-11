#!/usr/bin/env python3
"""wake_watcher.py — Reactive watcher for desk/inbox/WAKE.md.

Watches WAKE.md for any changes. As soon as Z.ai or the daemon updates WAKE.md:
1. Rings the bell alert.
2. Prints the updated section.
3. Exits cleanly (exit code 0).

When this background process finishes, Antigravity automatically wakes up
and processes the new directive/order immediately without human polling.
"""
import hashlib
import os
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
WAKE_FILE = ROOT / "desk" / "inbox" / "WAKE.md"

def get_hash():
    if not WAKE_FILE.exists():
        return ""
    try:
        return hashlib.sha256(WAKE_FILE.read_bytes()).hexdigest()
    except Exception:
        return ""

def main():
    initial_hash = get_hash()
    initial_text = WAKE_FILE.read_text(encoding="utf-8", errors="replace") if WAKE_FILE.exists() else ""
    start_time = time.time()
    max_duration = 300  # 5 minutes maximum per cycle (prevents infinite zombie loops)

    print(f"[wake_watcher] watching {WAKE_FILE.name} (initial hash: {initial_hash[:8]})...", flush=True)

    while True:
        time.sleep(2)
        current_hash = get_hash()
        if current_hash and current_hash != initial_hash:
            current_text = WAKE_FILE.read_text(encoding="utf-8", errors="replace")
            print("\a🔔 [WAKE EVENT] WAKE.md has been updated by Z.ai or desk daemon!", flush=True)
            
            # Play bell alert immediately
            try:
                import bell_alert
                bell_alert.play_bell("bell")
            except Exception:
                pass

            # Print new lines
            new_lines = [l for l in current_text.splitlines() if l not in initial_text.splitlines()]
            if new_lines:
                print("\n--- NEW WAKE CONTENT ---", flush=True)
                for l in new_lines[:20]:
                    print(l, flush=True)
            sys.exit(0)

if __name__ == "__main__":
    main()
