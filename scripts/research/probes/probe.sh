#!/bin/bash
# probe.sh URL LABEL OUTFILE
UA="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
URL="$1"; LABEL="$2"; OUT="$3"
curl -s --max-time 30 -w "\n---META---\nHTTP %{http_code}\nSIZE %{size_download}\nTIME %{time_total}\nCT %{content_type}\n" \
  -H "User-Agent: $UA" \
  -H "Accept: application/json, text/plain, */*" \
  -H "Accept-Language: en-US,en;q=0.9" \
  -H "Referer: https://www.cmegroup.com/" \
  --compressed "$URL" > "$OUT" 2>&1
echo "[$LABEL] $(tail -4 "$OUT" | tr '\n' ' ')"
