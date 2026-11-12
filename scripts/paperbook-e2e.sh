#!/usr/bin/env bash
# Virtual Book end-to-end battery (2026-11-12).
# Boots the production server, arms setups via the narrative route, lets the
# tracker+sweep run, then verifies the paperbook API, notifications and the
# full MCP toolset. Everything in one process lifetime (sandbox reaps
# background servers between calls).
set -u
cd /home/z/my-project

echo "=== [1/8] boot server ==="
npm start > /tmp/cg-server.log 2>&1 &
SRV=$!
for i in $(seq 1 40); do
  if curl -s -m 2 http://127.0.0.1:3000/api/health > /dev/null 2>&1; then break; fi
  sleep 1
done
curl -s -m 5 http://127.0.0.1:3000/api/health; echo

echo "=== [2/8] boot engine (ensureEngine → scanner + paperbook) ==="
curl -s -m 90 "http://127.0.0.1:3000/api/cg/engine/status" -o /tmp/eng.json -w "HTTP %{http_code} %{time_total}s\n"
python3 - <<'PY'
import json
d = json.load(open("/tmp/eng.json"))
print("engine started:", d.get("started"), "| dataDir:", d.get("dataDir"))
PY

echo "=== [3/8] narrative route-arms (viewed symbols arm instantly) ==="
for sym in BTC ETH SOL NVDA SPX500; do
  curl -s -m 120 "http://127.0.0.1:3000/api/cg/narrative?sym=$sym" -o "/tmp/narr-$sym.json" -w "$sym HTTP %{http_code} %{time_total}s\n"
done
python3 - <<'PY'
import json
for sym in ["BTC", "ETH", "SOL", "NVDA", "SPX500"]:
    try:
        d = json.load(open(f"/tmp/narr-{sym}.json"))
        print(f"{sym}: {d.get('activeModel')} | {d.get('direction')} | grade {d.get('grade')} | regime {d.get('regime')} | marketAge {round((d.get('freshness',{}).get('ageMs') or 0)/1000)}s")
    except Exception as e:
        print(f"{sym}: PARSE FAIL {e}")
PY

echo "=== [4/8] wait for tracker (track @40s+60s · sweep @70s+90s) ==="
sleep 200

echo "=== [5/8] paperbook API ==="
curl -s -m 30 "http://127.0.0.1:3000/api/cg/paperbook" -o /tmp/pb.json -w "full HTTP %{http_code} %{time_total}s\n"
curl -s -m 30 "http://127.0.0.1:3000/api/cg/paperbook?sym=BTC" -o /tmp/pb-btc.json -w "sym HTTP %{http_code}\n"
curl -s -m 30 "http://127.0.0.1:3000/api/cg/paperbook?status=ARMED" -o /tmp/pb-armed.json -w "armed HTTP %{http_code}\n"
curl -s -m 10 "http://127.0.0.1:3000/api/cg/paperbook?sym=NOTASYM" -o /tmp/pb-bad.json -w "bad-sym HTTP %{http_code} (expect 400)\n"
python3 - <<'PY'
import json
d = json.load(open("/tmp/pb.json"))
tel = d.get("telemetry", {})
fr = d.get("freshness", {})
print(f"universe: {tel.get('universe')} | sweepPos {tel.get('sweepPos')} | armed {tel.get('armed')} open {tel.get('open')} closed {tel.get('closed')}")
print(f"freshness: dataAt={fr.get('dataAt')} ageMs={fr.get('ageMs')} stale={fr.get('stale')}")
print(f"source: {fr.get('source')}")
print(f"lastSweepErr: {tel.get('lastSweepErr')} | lastPassErr: {tel.get('lastPassErr')}")
print(f"armLog: {json.dumps(tel.get('armLog', [])[-6:], indent=None)}")
for t in d.get("tickets", [])[:8]:
    print(f"  ticket {t['sym']} {t['model']} {t['direction']} {t['status']} | zone {t['entryZone']} stop {t['stop']} | mark {t.get('lastMark')} | R {t.get('totalR')} | mfe {t.get('mfeR')} mae {t.get('maeR')}")
btc = json.load(open("/tmp/pb-btc.json"))
print("BTC most-relevant ticket:", "present" if btc.get("ticket") else "none yet (no qualifying BTC setup — honest)")
armed = json.load(open("/tmp/pb-armed.json"))
print(f"ARMED filter count: {len(armed.get('tickets', []))} (all statuses correct: {all(t['status']=='ARMED' for t in armed.get('tickets', []))})")
bad = json.load(open("/tmp/pb-bad.json"))
print(f"unknown sym rejected: ok={bad.get('ok')} error={bad.get('error')}")
PY

echo "=== [6/8] paperbook notifications ==="
curl -s -m 15 "http://127.0.0.1:3000/api/cg/notifications?source=paperbook&limit=8" -o /tmp/pbn.json -w "HTTP %{http_code}\n"
python3 - <<'PY'
import json
d = json.load(open("/tmp/pbn.json"))
items = d.get("items", d.get("notifications", []))
print(f"paperbook notifications: {len(items)}")
for n in items[:6]:
    print(f"  [{n.get('kind')}] {n.get('title')} — {str(n.get('detail'))[:90]}")
PY

echo "=== [7/8] MCP toolset (20 tools incl. paper_book) ==="
node scripts/test-mcp-tools.cjs 2>/dev/null | tail -32

echo "=== [8/8] shutdown ==="
kill $SRV 2>/dev/null
sleep 2
pkill -f "next-server" 2>/dev/null
echo "battery complete"
