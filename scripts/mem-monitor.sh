#!/usr/bin/env bash
# RSS monitor: sample the next-server process every 15s into /tmp/memlog.csv
OUT=/tmp/memlog.csv
echo "ts,pid,rss_mb" > "$OUT"
while true; do
  pid=$(pgrep -f "next-server|next dev" | head -1)
  if [ -n "$pid" ]; then
    rss=$(awk '/VmRSS/{print int($2/1024)}' "/proc/$pid/status" 2>/dev/null)
    echo "$(date +%H:%M:%S),$pid,${rss:-NA}" >> "$OUT"
  else
    echo "$(date +%H:%M:%S),DEAD,0" >> "$OUT"
  fi
  sleep 15
done
