#!/usr/bin/env bash
set -Eeuo pipefail
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
: "${DATABASE_URL:?DATABASE_URL is required}"
[[ "${1:-}" == 'apply-governed-revrec-004' ]] || {
  echo "Usage: ./scripts/migrate.sh apply-governed-revrec-004" >&2
  exit 2
}
command -v psql >/dev/null || { echo "psql is required" >&2; exit 1; }
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$PROJECT_DIR/backend/migrations/004_governed_revrec.sql"
