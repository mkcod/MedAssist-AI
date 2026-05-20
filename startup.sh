#!/usr/bin/env bash
# ============================================================
#  MediAssist-AI — App Service Startup Script
#
#  IMPORTANT: Node.js starts FIRST to satisfy the 230s warmup probe.
#  Python setup (venv + pip install + uvicorn) runs in the background.
#
#  Port layout:
#    3000 — Node.js Express (receives all external traffic via App Service)
#    8000 — Python uvicorn (internal only, proxied by Express /api/agent/*)
# ============================================================
set -euo pipefail

WWWROOT="/home/site/wwwroot"
LOG="/home/LogFiles/startup.log"
mkdir -p /home/LogFiles

echo "[startup] $(date) — MediAssist-AI starting" | tee -a "$LOG"

# ── Validate required directories ────────────────────────────
if [ ! -d "$WWWROOT/backend" ]; then
  echo "[startup] ERROR: $WWWROOT/backend not found. Deployment may be incomplete." | tee -a "$LOG"
  exit 1
fi

# ── Python setup runs entirely in the background ─────────────
# Node.js must start before the 230s warmup probe deadline.
# All Python work (venv create, pip install, uvicorn start) is async.
(
  set +e  # don't let Python errors kill the subshell affecting the main script
  VENV="$WWWROOT/python-agents/.venv"
  PYBIN="$(command -v python3 2>/dev/null || command -v python 2>/dev/null || echo '')"

  if [ ! -d "$WWWROOT/python-agents" ] || [ -z "$PYBIN" ]; then
    echo "[startup] Python skipped (no python-agents dir or no python binary)" >> "$LOG"
    exit 0
  fi

  if [ ! -x "$VENV/bin/python" ]; then
    echo "[startup] Creating Python venv..." >> "$LOG"
    "$PYBIN" -m venv "$VENV" >> "$LOG" 2>&1 || {
      echo "[startup] WARN: venv creation failed — Python agents disabled" >> "$LOG"
      exit 0
    }
  fi

  PVENV="$VENV/bin/python"

  # Ensure pip
  "$PVENV" -m pip --version >/dev/null 2>&1 || \
    curl -fsSL https://bootstrap.pypa.io/get-pip.py | "$PVENV" >> "$LOG" 2>&1 || true

  echo "[startup] Installing Python dependencies (background)..." >> "$LOG"
  "$PVENV" -m pip install \
    -r "$WWWROOT/python-agents/requirements_combined.txt" \
    --quiet >> "$LOG" 2>&1 \
    || echo "[startup] WARN: some pip packages failed" >> "$LOG"

  echo "[startup] Python deps installed" >> "$LOG"

  # Write .env files for Python agents from App Service env vars
  for DIR in \
    "$WWWROOT/python-agents" \
    "$WWWROOT/python-agents/summarizer_agent" \
    "$WWWROOT/python-agents/Publishing_Agent"; do
    [ -d "$DIR" ] || continue
    env | grep -E \
      "^(AZURE_|SPEECH_|OPENAI_|DEPLOYMENT_|ORCHESTRATION_|MONGO_|COSMOS_|INTERNAL_|NODEJS_|USE_COSMOS|SPAWN_|START_|MCP_)" \
      > "$DIR/.env" 2>/dev/null || true
  done

  # Start Python FastAPI (uvicorn) on port 8000
  echo "[startup] Starting Python agent bridge on 127.0.0.1:8000" >> "$LOG"
  cd "$WWWROOT/python-agents"
  exec "$PVENV" -m uvicorn api_server:app \
    --host 127.0.0.1 \
    --port 8000 \
    --workers 1 \
    --log-level info \
    >> "$LOG" 2>&1
) &

# ── Start Node.js Express immediately (serves API + React SPA) ───
# Node.js starts right away — Python setup continues in background above.
echo "[startup] Starting Node.js on port ${PORT:-3000}" | tee -a "$LOG"
cd "$WWWROOT/backend"
exec node src/app.js
