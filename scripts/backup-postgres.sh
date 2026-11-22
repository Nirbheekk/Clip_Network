#!/usr/bin/env sh
set -eu

BACKUP_DIR="${BACKUP_DIR:-./backups}"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUT_FILE="${BACKUP_DIR}/clipnetwork_${TIMESTAMP}.sql.gz"

mkdir -p "${BACKUP_DIR}"
echo "[backup] Dumping PostgreSQL database to ${OUT_FILE}..."
docker compose -f docker-compose.prod.yml exec -T postgres \
  pg_dump -U "${POSTGRES_USER:-clipnetwork}" -d "${POSTGRES_DB:-clipnetwork}" --clean --if-exists \
  | gzip > "${OUT_FILE}"

echo "[backup] Completed: $(ls -lh "${OUT_FILE}")"
