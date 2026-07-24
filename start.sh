#!/usr/bin/env bash
set -Eeuo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
set -a
source "$PROJECT_DIR/.env"
set +a
BACKEND_PORT="${BACKEND_PORT:-${PORT:-3001}}"
FRONTEND_PORT="${FRONTEND_PORT:-3000}"
export ALLOWED_ORIGINS="${ALLOWED_ORIGINS:-http://127.0.0.1:$FRONTEND_PORT,http://localhost:$FRONTEND_PORT}"

for directory in "$PROJECT_DIR/backend/node_modules" "$PROJECT_DIR/frontend/node_modules"; do
  [[ -d "$directory" ]] || { echo "Missing dependencies. Run ./scripts/bootstrap.sh explicitly." >&2; exit 1; }
done
: "${DATABASE_URL:?DATABASE_URL is required}"
: "${JWT_SECRET:?JWT_SECRET is required}"
: "${ALLOWED_ORIGINS:?ALLOWED_ORIGINS is required}"
[[ ${#JWT_SECRET} -ge 32 ]] || { echo "JWT_SECRET must contain at least 32 characters." >&2; exit 1; }

for port in "$BACKEND_PORT" "$FRONTEND_PORT"; do
  if lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1; then
    echo "Port $port is already in use; no process was changed." >&2
    exit 1
  fi
done

backend_pid=''
frontend_pid=''
cleanup() {
  [[ -z "$frontend_pid" ]] || kill "$frontend_pid" 2>/dev/null || true
  [[ -z "$backend_pid" ]] || kill "$backend_pid" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

(cd "$PROJECT_DIR/backend" && PORT="$BACKEND_PORT" npm start) &
backend_pid=$!
(cd "$PROJECT_DIR/frontend" && BROWSER=none PORT="$FRONTEND_PORT" npm start -- --host 127.0.0.1 --port "$FRONTEND_PORT" --strictPort) &
frontend_pid=$!

echo "Governed revenue API: http://localhost:$BACKEND_PORT"
echo "Frontend: http://localhost:$FRONTEND_PORT"
wait "$backend_pid" "$frontend_pid"
