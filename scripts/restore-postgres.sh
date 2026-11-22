#!/usr/bin/env sh
set -eu

if [ "$#" -lt 1 ]; then
  echo "Usage: $0 <path-to-backup.sql.gz>"
  exit 1
fi

BACKUP_FILE="$1"
if [ ! -f "${BACKUP_FILE}" ]; then
  echo "Backup file not found: ${BACKUP_FILE}"
  exit 1
fi

echo "[restore] Restoring ${BACKUP_FILE} into PostgreSQL..."
gunzip -c "${BACKUP_FILE}" | docker compose -f docker-compose.prod.yml exec -T postgres \
  psql -U "${POSTGRES_USER:-clipnetwork}" -d "${POSTGRES_DB:-clipnetwork}"

echo "[restore] Verification count check:"
docker compose -f docker-compose.prod.yml exec -T postgres \
  psql -U "${POSTGRES_USER:-clipnetwork}" -d "${POSTGRES_DB:-clipnetwork}" \
  -c "SELECT count(*) AS workspaces FROM \"Workspace\";"
