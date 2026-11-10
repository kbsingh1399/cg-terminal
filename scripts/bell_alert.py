#!/usr/bin/env python3
"""bell_alert.py — Trade desk audio bell alert for Windows.

Plays a distinctive, pleasant bell chime sequence when a trade needs to be
punched or modified in MT5, and optionally prints / logs the alert.
"""
import sys
import time
import os

def play_bell(sound_type="bell"):
    try:
        import winsound
        media_dir = os.path.join(os.environ.get("WINDIR", r"C:\Windows"), "Media")
        chimes = os.path.join(media_dir, "chimes.wav")
        ring = os.path.join(media_dir, "Ring01.wav")
        ding = os.path.join(media_dir, "ding.wav")
        tada = os.path.join(media_dir, "tada.wav")

        if sound_type == "chimes" and os.path.exists(chimes):
            winsound.PlaySound(chimes, winsound.SND_FILENAME)
        elif os.path.exists(chimes):
            winsound.PlaySound(chimes, winsound.SND_FILENAME)
        elif os.path.exists(ding):
            winsound.PlaySound(ding, winsound.SND_FILENAME)
        else:
            # Fallback synthesizer chord
            winsound.Beep(1046, 150) # C6
            time.sleep(0.05)
            winsound.Beep(1318, 150) # E6
            time.sleep(0.05)
            winsound.Beep(1567, 350) # G6
    except Exception as e:
        # Fallback console bell
        print("\a", end="", flush=True)

if __name__ == "__main__":
    title = sys.argv[1] if len(sys.argv) > 1 else "Trade Desk Alert"
    msg = sys.argv[2] if len(sys.argv) > 2 else "New trade action required"
    print(f"\a🔔 [BELL ALERT] {title}: {msg}", flush=True)
    play_bell()
