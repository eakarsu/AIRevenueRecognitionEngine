#!/usr/bin/env bash
set -Eeuo pipefail
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
[[ "${NODE_ENV:-development}" != 'production' ]] || { echo "Development fixtures are disabled in production." >&2; exit 1; }
[[ "${1:-}" == 'I_UNDERSTAND_THIS_MUTATES_A_DISPOSABLE_DATABASE' ]] || {
  echo "Usage: ./scripts/seed-development.sh I_UNDERSTAND_THIS_MUTATES_A_DISPOSABLE_DATABASE" >&2
  exit 2
}
: "${DATABASE_URL:?DATABASE_URL must point to a disposable database}"
(cd "$PROJECT_DIR/backend" && node seed.js)
