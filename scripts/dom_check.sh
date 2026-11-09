#!/bin/bash
# DOM-based verification: real numbers, no NaN/undefined, canvases non-blank.
set -u
cd /home/z/my-project
pkill -f "bun run start" 2>/dev/null; sleep 1
nohup bun run start > prod.log 2>&1 &
sleep 8
B="agent-browser"
$B open "http://localhost:3000/" >/dev/null 2>&1
$B set viewport 1600 1000 >/dev/null 2>&1
sleep 14

check_tool () {
  local NAME="$1" WAIT="$2"
  echo ""
  echo "########## $NAME ##########"
  $B eval "$NAME_CLICK" >/dev/null 2>&1
}

# helper JS: gather visible text of KPI metrics + canvases
INSPECT='(() => {
  const texts = [];
  document.querySelectorAll("h3, .font-mono").forEach((el) => {
    const t = el.textContent.trim();
    if (t && t.length < 90) texts.push(t);
  });
  const bad = texts.filter((t) => /NaN|undefined|Infinity|null/.test(t));
  const canvases = [...document.querySelectorAll("canvas")].map((c) => {
    const ctx = c.getContext("2d");
    const w = c.width, h = c.height;
    if (!w || !h || !ctx) return "empty";
    const d = ctx.getImageData(0, 0, w, h).data;
    let lit = 0, total = 0;
    for (let i = 0; i < d.length; i += 40) {
      total++;
      if (d[i] > 30 || d[i+1] > 30 || d[i+2] > 30) lit++;
    }
    return `${Math.round(100*lit/total)}% lit`;
  });
  return JSON.stringify({ kpiCount: texts.length, sample: texts.slice(0, 26), bad, canvases }, null, 1);
})()'

# --- Footprint (default) ---
echo "########## FOOTPRINT ##########"
$B eval "$INSPECT" 2>/dev/null | head -40

# --- Large Orders ---
$B find text "Large Orders" click >/dev/null 2>&1; sleep 9
echo "########## LARGE ORDERS (top) ##########"
$B eval "$INSPECT" 2>/dev/null | head -30
$B eval "window.scrollTo(0, document.body.scrollHeight - 1800)" >/dev/null 2>&1; sleep 3
echo "--- whale walls panel ---"
$B eval "(() => { const panels = [...document.querySelectorAll('h3')].map(h => h.textContent.trim()); return JSON.stringify(panels); })()" 2>/dev/null
$B eval "$INSPECT" 2>/dev/null | tail -12
$B eval "window.scrollTo(0, 0)" >/dev/null 2>&1; sleep 1

# --- Liq Levels ---
$B find text "Liq Levels + Stops" click >/dev/null 2>&1; sleep 9
echo "########## LIQ LEVELS ##########"
$B eval "$INSPECT" 2>/dev/null | head -32

# --- Stops tab ---
$B find text "Stops heatmap 24h" click >/dev/null 2>&1; sleep 12
echo "########## STOPS ##########"
$B eval "$INSPECT" 2>/dev/null | head -36

# --- Book Walls ---
$B find text "Book Walls" click >/dev/null 2>&1; sleep 14
echo "########## BOOK WALLS ##########"
$B eval "$INSPECT" 2>/dev/null | head -36

# --- CVD ---
$B find text "CVD" click >/dev/null 2>&1; sleep 14
echo "########## CVD ##########"
$B eval "$INSPECT" 2>/dev/null | head -40

# --- engine indicator ---
echo "########## ENGINE HEADER ##########"
$B eval "window.scrollTo(0,0)" >/dev/null 2>&1; sleep 1
$B eval "(() => document.querySelector('header')?.innerText.replace(/\\n/g, ' | ').slice(0, 300))()" 2>/dev/null
echo ""
echo "DONE"
