#!/usr/bin/env bash
# Trade-desk round orchestrator (zai-desk) — run every 15 minutes.
#   1. git pull --rebase (best effort)
#   2. ensure the terminal is up (boot `npm run dev` if needed, wait ≤150s)
#   3. scripts/desk_round.py  (analysis + state.json + log.md) — python3 or python
#   4. commit + push desk/ changes (desk(round): ...)
set -uo pipefail
cd "$(dirname "$0")/.."
# self-report to a TRACKED log (zai reads it via git; rounds.local.log is the
# daemon's local copy). Also dumps environment — rounds must never fail silently.
if [[ "${OSTYPE:-}" == "msys"* || "${OSTYPE:-}" == "cygwin"* ]]; then
  exec >> desk/rounds.log 2>&1
else
  exec > >(tee -a desk/rounds.log) 2>&1
fi
export GIT_AUTHOR_NAME="kbsingh1399" GIT_AUTHOR_EMAIL="kbsingh1399@users.noreply.github.com"
export GIT_COMMITTER_NAME="kbsingh1399" GIT_COMMITTER_EMAIL="kbsingh1399@users.noreply.github.com"
TS=$(date -u +"%Y-%m-%dT%H%MZ")

log() { echo "[desk_round $TS] $*"; }
log "env: bash=${BASH:-?} v${BASH_VERSION:-?} · uname=$(uname -a 2>/dev/null | cut -c1-100) · pwd=$PWD"

# ---- 1. sync (best effort; analysis proceeds regardless) -------------------
git pull --rebase origin main >/dev/null 2>&1 && log "git: pulled" || log "git: pull failed (continuing offline)"

# ---- 2. terminal health / boot ---------------------------------------------
if curl -sf -m 5 http://localhost:3000/api/cg/assets >/dev/null 2>&1; then
  log "terminal: up"
else
  log "terminal: down — booting (${DESK_BOOT_CMD:-npm run dev})"
  if [ -f /tmp/cg-terminal-dev.log ]; then mv /tmp/cg-terminal-dev.log "/tmp/cg-terminal-dev.$(date -u +%s).log"; fi
  nohup ${DESK_BOOT_CMD:-npm run dev} >/tmp/cg-terminal-dev.log 2>&1 &
  ok=""
  for i in $(seq 1 30); do
    sleep 5
    if curl -sf -m 5 http://localhost:3000/api/cg/assets >/dev/null 2>&1; then ok=1; break; fi
  done
  if [ -z "$ok" ]; then
    log "terminal: FAILED to boot after 150s — round aborted"
    printf '\n## ROUND FAILED · %s · zai-desk\n\nterminal did not boot within 150s; see /tmp/cg-terminal-dev.log\n\n' \
      "$(date -u +'%Y-%m-%d %H:%M UTC')" >> desk/log.md
    exit 2
  fi
  log "terminal: booted (${i}x5s)"
fi

# ---- 3. analysis ------------------------------------------------------------
# Windows Git Bash often has no `python3` — fall back to `python` (daemon.json
# mt5.python_cmd uses "python" for the same reason).
PY="${DESK_PYTHON:-$(command -v python3 || command -v python || true)}"
[ -z "$PY" ] && PY=python
log "python resolved: $PY ($($PY --version 2>&1 || echo 'VERSION CHECK FAILED'))"
"$PY" scripts/desk_round.py
rc=$?
if [ $rc -ne 0 ]; then
  log "analysis FAILED rc=$rc"
  printf '\n## ROUND FAILED · %s · zai-desk\n\nanalysis script rc=%d\n\n' \
    "$(date -u +'%Y-%m-%d %H:%M UTC')" "$rc" >> desk/log.md
  exit $rc
fi

# ---- 4. commit + push -------------------------------------------------------
if [ -n "$(git status --porcelain desk/)" ]; then
  git add desk/
  if git commit -q -m "desk(round): ${TS} — 15-min analysis round"; then
    if git push origin main 2>/dev/null; then
      log "git: pushed"
    elif git pull --rebase origin main >/dev/null 2>&1 && git push origin main 2>/dev/null; then
      log "git: pushed after rebase retry"
    else
      log "git: PUSH FAILED — will sync next round"
    fi
  fi
else
  log "git: no desk changes"
fi
exit 0
