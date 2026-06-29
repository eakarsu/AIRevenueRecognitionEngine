#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT_DIR="${ROOT_DIR}/backups"
mkdir -p "${OUT_DIR}"

STAMP="$(date +%Y%m%d-%H%M%S)"
DB_NAME="${DB_NAME:-revenue_recognition}"
DB_USER="${DB_USER:-postgres}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"

pg_dump "postgresql://${DB_USER}@${DB_HOST}:${DB_PORT}/${DB_NAME}" > "${OUT_DIR}/revrec-${STAMP}.sql"
echo "Created ${OUT_DIR}/revrec-${STAMP}.sql"
